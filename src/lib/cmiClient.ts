import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

export interface CmiClientRequest {
	protocol: "http" | "https";
	host: string;
	port: number;
	username: string;
	password: string;
	timeoutMs: number;
	rejectUnauthorized: boolean;
	node: number;
	jsonparam: string;
	useDesignation: boolean;
	signal?: AbortSignal;
}

export interface CmiClientResponse {
	url: string;
	statusCode: number;
	body: unknown;
	rawBody: string;
}

export class CmiHttpError extends Error {
	public constructor(
		message: string,
		public readonly statusCode: number,
	) {
		super(message);
		this.name = "CmiHttpError";
	}
}

export class CmiTimeoutError extends Error {
	public constructor(timeoutMs: number) {
		super(`C.M.I. request timed out after ${timeoutMs} ms`);
		this.name = "CmiTimeoutError";
	}
}

export class CmiJsonError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "CmiJsonError";
	}
}

export class CmiAbortError extends Error {
	public constructor() {
		super("C.M.I. request aborted");
		this.name = "CmiAbortError";
	}
}

export function buildCmiApiUrl(
	request: Pick<CmiClientRequest, "protocol" | "host" | "port" | "node" | "jsonparam" | "useDesignation">,
): URL {
	const url = new URL(`${request.protocol}://${request.host}:${request.port}/INCLUDE/api.cgi`);
	url.searchParams.set("jsonnode", String(request.node));
	url.searchParams.set("jsonparam", request.jsonparam);
	if (request.useDesignation) {
		url.searchParams.set("jsondesignation", "1");
	}
	return url;
}

export function redactCredentials(message: string): string {
	return message
		.replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic <redacted>")
		.replace(/\/\/([^:/?#]+):([^@/?#]+)@/g, "//<redacted>@");
}

function createAuthHeader(username: string, password: string): string {
	return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

export class CmiClient {
	public async requestNode(request: CmiClientRequest): Promise<CmiClientResponse> {
		const url = buildCmiApiUrl(request);
		const transport = request.protocol === "https" ? https : http;

		return new Promise<CmiClientResponse>((resolve, reject) => {
			let settled = false;

			const req = transport.request(
				{
					method: "GET",
					hostname: url.hostname,
					port: url.port,
					path: `${url.pathname}${url.search}`,
					headers: {
						Accept: "application/json",
						Authorization: createAuthHeader(request.username, request.password),
					},
					rejectUnauthorized: request.protocol === "https" ? request.rejectUnauthorized : undefined,
				},
				res => {
					const chunks: Buffer[] = [];
					res.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
					res.on("end", () => {
						if (settled) {
							return;
						}
						settled = true;

						const statusCode = res.statusCode ?? 0;
						const rawBody = Buffer.concat(chunks).toString("utf8");

						if (statusCode === 401 || statusCode === 403) {
							reject(
								new CmiHttpError(
									"Authentication failed; C.M.I. expert credentials required",
									statusCode,
								),
							);
							return;
						}

						if (statusCode !== 200) {
							reject(new CmiHttpError(`HTTP ${statusCode} returned by C.M.I.`, statusCode));
							return;
						}

						try {
							resolve({
								url: url.toString(),
								statusCode,
								body: JSON.parse(rawBody) as unknown,
								rawBody,
							});
						} catch (error) {
							const snippet = rawBody.slice(0, 300);
							reject(
								new CmiJsonError(
									`Failed to parse C.M.I. JSON response: ${redactCredentials((error as Error).message)}; body starts with ${snippet}`,
								),
							);
						}
					});
				},
			);

			req.setTimeout(request.timeoutMs, () => {
				if (!settled) {
					settled = true;
					const error = new CmiTimeoutError(request.timeoutMs);
					reject(error);
					req.destroy(error);
				}
			});

			req.on("error", error => {
				if (settled) {
					return;
				}
				settled = true;
				reject(error);
			});

			const abort = (): void => {
				if (!settled) {
					settled = true;
					const error = new CmiAbortError();
					reject(error);
					req.destroy(error);
				}
			};

			if (request.signal?.aborted) {
				abort();
				return;
			}

			request.signal?.addEventListener("abort", abort, { once: true });
			req.end();
		});
	}
}
