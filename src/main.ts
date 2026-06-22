/*
 * Created with @iobroker/create-adapter v3.1.5
 */

import * as utils from "@iobroker/adapter-core";
import { CmiAbortError, CmiClient, CmiHttpError, CmiJsonError, CmiTimeoutError } from "./lib/cmiClient";
import { getCmiStatusText, isBackoffStatus } from "./lib/cmiStatus";
import { type TaConfig, type TaNodeConfig, getEnabledNodes, normalizeConfig, validateConfig } from "./lib/config";
import { ObjectFactory } from "./lib/objectFactory";
import { parseCmiResponse, type ParsedCmiResponse } from "./lib/cmiParser";
import { CmiRequestQueue, QueueStoppedError } from "./lib/rateLimiter";

class Ta extends utils.Adapter {
	private cmiClient = new CmiClient();
	private objectFactory?: ObjectFactory;
	private requestQueue?: CmiRequestQueue;
	private configSnapshot?: TaConfig;
	private stopped = false;
	private consecutiveErrors = 0;
	private pollPromise?: Promise<void>;
	private sleepTimer?: NodeJS.Timeout;
	private sleepResolver?: () => void;
	private recreateObjectsOnNextPoll = false;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "ta",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	private async onReady(): Promise<void> {
		this.stopped = false;
		this.objectFactory = new ObjectFactory(this);
		await this.objectFactory.ensureInfoObjects();
		await this.objectFactory.setInfoState("connection", false);
		await this.objectFactory.setInfoState("lastError", "");
		await this.objectFactory.setInfoState("lastStatusCode", 0);
		await this.objectFactory.setInfoState("lastStatusText", getCmiStatusText(0));

		const config = normalizeConfig(this.config);
		this.configSnapshot = config;
		this.requestQueue = new CmiRequestQueue(config.requestSpacingSec * 1_000);
		const enabledNodes = getEnabledNodes(config);
		await this.objectFactory.publishEffectiveNodeInterval(enabledNodes.length * config.requestSpacingSec);

		const validation = validateConfig(config);
		if (!validation.valid) {
			const message = validation.errors.join(" ");
			this.log.warn(`Adapter configuration incomplete: ${message}`);
			await this.objectFactory.setInfoState("lastError", message);
			return;
		}

		this.log.info(
			`Polling ${enabledNodes.length} C.M.I. node(s) with ${config.requestSpacingSec}s request spacing; effective interval per node is ${
				enabledNodes.length * config.requestSpacingSec
			}s.`,
		);
		this.pollPromise = this.pollLoop(config);
	}

	private onUnload(callback: () => void): void {
		this.stopped = true;
		this.requestQueue?.stop();
		if (this.sleepTimer) {
			clearTimeout(this.sleepTimer);
			this.sleepTimer = undefined;
		}
		this.sleepResolver?.();
		this.sleepResolver = undefined;

		void Promise.resolve(this.pollPromise)
			.catch(error => {
				if (!(error instanceof QueueStoppedError) && !(error instanceof CmiAbortError)) {
					this.log.debug(`Poll loop stopped with error: ${(error as Error).message}`);
				}
			})
			.finally(callback);
	}

	private async onMessage(obj: ioBroker.Message): Promise<void> {
		if (typeof obj !== "object" || !obj.command || !obj.callback) {
			return;
		}

		if (obj.command === "testConnection") {
			await this.handleTestConnection(obj);
			return;
		}

		if (obj.command === "recreateObjects") {
			this.recreateObjectsOnNextPoll = true;
			this.sendTo(
				obj.from,
				obj.command,
				{ ok: true, message: "Object names will be refreshed after the next successful poll." },
				obj.callback,
			);
		}
	}

	private async handleTestConnection(obj: ioBroker.Message): Promise<void> {
		const config = this.configSnapshot ?? normalizeConfig(this.config);
		const validation = validateConfig(config);
		if (!validation.valid) {
			this.sendTo(obj.from, obj.command, { ok: false, message: validation.errors.join(" ") }, obj.callback);
			return;
		}

		const queue = this.requestQueue;
		if (!queue) {
			this.sendTo(obj.from, obj.command, { ok: false, message: "Request queue is not ready." }, obj.callback);
			return;
		}

		const waitSec = Math.ceil(queue.getWaitTimeMs() / 1_000);
		if (queue.isBusy || waitSec > 0) {
			this.sendTo(
				obj.from,
				obj.command,
				{
					ok: false,
					message: `Rate limiter active. Try again in about ${Math.max(waitSec, config.requestSpacingSec)} seconds.`,
				},
				obj.callback,
			);
			return;
		}

		const node = getEnabledNodes(config)[0];
		try {
			const parsed = await this.pollNode(config, node);
			const enabledNodeCount = getEnabledNodes(config).length;
			this.sendTo(
				obj.from,
				obj.command,
				{
					ok: parsed.statusCode === 0,
					statusCode: parsed.statusCode,
					statusText: parsed.statusText,
					node: node.node,
					message:
						parsed.statusCode === 0
							? `Connection successful for CAN node ${node.node}. Regular polling checks ${enabledNodeCount} enabled node(s).`
							: `CAN node ${node.node}: ${parsed.statusText}`,
				},
				obj.callback,
			);
		} catch (error) {
			this.sendTo(
				obj.from,
				obj.command,
				{
					ok: false,
					message: this.formatError(error),
				},
				obj.callback,
			);
		}
	}

	private async pollLoop(config: TaConfig): Promise<void> {
		await this.sleep(config.startupDelaySec * 1_000);

		while (!this.stopped) {
			const nodes = getEnabledNodes(config);
			for (const node of nodes) {
				if (this.stopped) {
					return;
				}

				try {
					await this.pollNode(config, node);
				} catch (error) {
					if (this.stopped || error instanceof QueueStoppedError || error instanceof CmiAbortError) {
						return;
					}
					await this.handleRequestError(error, config);
				}
			}
		}
	}

	private async pollNode(config: TaConfig, node: TaNodeConfig): Promise<ParsedCmiResponse> {
		if (!this.requestQueue || !this.objectFactory) {
			throw new Error("Adapter not initialized.");
		}

		const response = await this.requestQueue.execute(signal =>
			this.cmiClient.requestNode({
				protocol: config.protocol,
				host: config.host,
				port: config.port,
				username: config.username,
				password: config.password,
				timeoutMs: config.timeoutMs,
				rejectUnauthorized: config.rejectUnauthorized,
				node: node.node,
				jsonparam: node.jsonparam,
				useDesignation: node.useDesignation,
				signal,
			}),
		);

		const now = Date.now();
		const parsed = parseCmiResponse(response.body);
		await this.objectFactory.setInfoState("lastUpdate", now);
		await this.objectFactory.setInfoState("lastStatusCode", parsed.statusCode);
		await this.objectFactory.setInfoState("lastStatusText", parsed.statusText);

		if (parsed.unknownGroups.length > 0) {
			this.log.warn(`C.M.I. returned unknown group(s): ${parsed.unknownGroups.join(", ")}`);
		}

		if (parsed.statusCode !== 0) {
			await this.handleCmiStatus(parsed, config, node);
			return parsed;
		}

		await this.objectFactory.publishParsedNode(
			{
				node: node.node,
				name: node.name,
				useDesignation: node.useDesignation,
				forceNameRefresh: this.recreateObjectsOnNextPoll,
				createRawJson: node.createRawJson,
			},
			parsed,
			node.createRawJson ? response.rawBody : undefined,
		);

		this.consecutiveErrors = 0;
		this.recreateObjectsOnNextPoll = false;
		await this.objectFactory.setInfoState("connection", true);
		await this.objectFactory.setInfoState("lastSuccessfulUpdate", now);
		await this.objectFactory.setInfoState("lastError", "");
		return parsed;
	}

	private async handleCmiStatus(parsed: ParsedCmiResponse, config: TaConfig, node: TaNodeConfig): Promise<void> {
		if (!this.objectFactory || !this.requestQueue) {
			return;
		}

		const statusText = parsed.statusText || getCmiStatusText(parsed.statusCode);
		const nodeStatusText = `CAN node ${node.node}: ${statusText} (status code ${parsed.statusCode})`;
		await this.objectFactory.setInfoState("connection", false);
		await this.objectFactory.setInfoState("lastError", nodeStatusText);
		this.log.warn(nodeStatusText);

		if (parsed.statusCode === 4) {
			this.log.warn("C.M.I. reported TOO MANY REQUESTS. Increasing request spacing temporarily.");
			this.requestQueue.extendDelay(config.requestSpacingSec * 2_000);
			return;
		}

		if (parsed.statusCode === 7) {
			this.log.warn("C.M.I. reported CAN BUSY. Delaying the next request.");
			this.requestQueue.extendDelay(config.retryDelaySec * 1_000);
			return;
		}

		if (isBackoffStatus(parsed.statusCode)) {
			this.requestQueue.extendDelay(config.retryDelaySec * 1_000);
		}
	}

	private async handleRequestError(error: unknown, config: TaConfig): Promise<void> {
		if (!this.objectFactory) {
			return;
		}

		const message = this.formatError(error);
		this.consecutiveErrors += 1;
		await this.objectFactory.setInfoState("connection", false);
		await this.objectFactory.setInfoState("lastError", message);
		await this.objectFactory.setInfoState("lastStatusCode", error instanceof CmiHttpError ? error.statusCode : -1);
		await this.objectFactory.setInfoState("lastStatusText", message);

		if (this.consecutiveErrors >= config.maxConsecutiveErrors) {
			this.log.warn(`${this.consecutiveErrors} consecutive C.M.I. polling errors: ${message}`);
		} else {
			this.log.debug(`C.M.I. polling failed: ${message}`);
		}

		await this.sleep(config.retryDelaySec * 1_000);
	}

	private formatError(error: unknown): string {
		if (error instanceof CmiHttpError || error instanceof CmiTimeoutError || error instanceof CmiJsonError) {
			return error.message;
		}
		if (error instanceof Error) {
			return error.message;
		}
		return String(error);
	}

	private async sleep(ms: number): Promise<void> {
		if (ms <= 0 || this.stopped) {
			return;
		}

		await new Promise<void>(resolve => {
			this.sleepResolver = resolve;
			this.sleepTimer = setTimeout(() => {
				this.sleepTimer = undefined;
				this.sleepResolver = undefined;
				resolve();
			}, ms);
		});
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Ta(options);
} else {
	(() => new Ta())();
}
