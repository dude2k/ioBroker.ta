import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect } from "chai";
import { CmiClient, CmiHttpError, CmiTimeoutError, buildCmiApiUrl, redactCredentials } from "../../src/lib/cmiClient";
import type { CmiClientRequest } from "../../src/lib/cmiClient";
import { parseCmiResponse } from "../../src/lib/cmiParser";
import { CmiRequestQueue } from "../../src/lib/rateLimiter";

interface TestServer {
	server: http.Server;
	port: number;
	close: () => Promise<void>;
}

async function createServer(handler: http.RequestListener): Promise<TestServer> {
	const server = http.createServer(handler);
	await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
	const address = server.address() as AddressInfo;

	return {
		server,
		port: address.port,
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.close(error => (error ? reject(error) : resolve()));
			}),
	};
}

function baseRequest(port: number): CmiClientRequest {
	return {
		protocol: "http" as const,
		host: "127.0.0.1",
		port,
		username: "expert",
		password: "secret",
		timeoutMs: 500,
		rejectUnauthorized: true,
		node: 1,
		jsonparam: "I,O",
		useDesignation: true,
	};
}

describe("CmiClient integration", () => {
	it("performs a successful authenticated request", async () => {
		const testServer = await createServer((req, res) => {
			expect(req.headers.authorization).to.equal("Basic ZXhwZXJ0OnNlY3JldA==");
			expect(req.url).to.equal("/INCLUDE/api.cgi?jsonnode=1&jsonparam=I%2CO&jsondesignation=1");
			res.setHeader("content-type", "application/json");
			res.end(JSON.stringify({ "Status code": 0, Header: { Device: "87" }, Data: { Inputs: [] } }));
		});

		try {
			const client = new CmiClient();
			const response = await client.requestNode(baseRequest(testServer.port));
			expect(response.statusCode).to.equal(200);
			expect(parseCmiResponse(response.body).header?.deviceName).to.equal("UVR16x2");
		} finally {
			await testServer.close();
		}
	});

	it("returns a clear auth error for 401 responses", async () => {
		const testServer = await createServer((_req, res) => {
			res.writeHead(401);
			res.end("Unauthorized");
		});

		try {
			const client = new CmiClient();
			await expect(client.requestNode(baseRequest(testServer.port))).to.be.rejectedWith(
				CmiHttpError,
				"Authentication failed; C.M.I. expert credentials required",
			);
		} finally {
			await testServer.close();
		}
	});

	it("passes C.M.I. status code 4 to the parser", async () => {
		const testServer = await createServer((_req, res) => {
			res.setHeader("content-type", "application/json");
			res.end(JSON.stringify({ "Status code": 4 }));
		});

		try {
			const client = new CmiClient();
			const response = await client.requestNode(baseRequest(testServer.port));
			const parsed = parseCmiResponse(response.body);
			expect(parsed.statusCode).to.equal(4);
			expect(parsed.statusText).to.equal("TOO MANY REQUESTS");
		} finally {
			await testServer.close();
		}
	});

	it("times out slow requests", async () => {
		const testServer = await createServer((_req, _res) => {
			// Intentionally never finish the response.
		});

		try {
			const client = new CmiClient();
			await expect(client.requestNode({ ...baseRequest(testServer.port), timeoutMs: 30 })).to.be.rejectedWith(
				CmiTimeoutError,
			);
		} finally {
			await testServer.close();
		}
	});

	it("queries multiple nodes sequentially through the rate limiter", async () => {
		let inFlight = 0;
		const requestTimes: number[] = [];
		const testServer = await createServer((req, res) => {
			inFlight += 1;
			expect(inFlight).to.equal(1);
			requestTimes.push(Date.now());
			setTimeout(() => {
				inFlight -= 1;
				res.setHeader("content-type", "application/json");
				res.end(JSON.stringify({ "Status code": 0, node: req.url }));
			}, 5);
		});

		try {
			const client = new CmiClient();
			const queue = new CmiRequestQueue(20);
			await Promise.all([
				queue.execute(signal => client.requestNode({ ...baseRequest(testServer.port), node: 1, signal })),
				queue.execute(signal => client.requestNode({ ...baseRequest(testServer.port), node: 2, signal })),
				queue.execute(signal => client.requestNode({ ...baseRequest(testServer.port), node: 3, signal })),
			]);

			expect(requestTimes).to.have.length(3);
			expect(requestTimes[1] - requestTimes[0]).to.be.greaterThanOrEqual(20);
			expect(requestTimes[2] - requestTimes[1]).to.be.greaterThanOrEqual(20);
		} finally {
			await testServer.close();
		}
	});

	it("does not expose credentials in helper output", () => {
		const url = buildCmiApiUrl({
			protocol: "http",
			host: "example.local",
			port: 80,
			node: 1,
			jsonparam: "I",
			useDesignation: false,
		});
		expect(url.toString()).to.not.contain("secret");
		expect(redactCredentials("Authorization: Basic ZXhwZXJ0OnNlY3JldA==")).to.not.contain("ZXhwZXJ0OnNlY3JldA==");
	});
});
