// This file extends the AdapterConfig type from "@iobroker/types".

declare global {
	namespace ioBroker {
		interface AdapterConfig {
			host: string;
			port: number;
			protocol: "http" | "https";
			username: string;
			password: string;
			timeoutMs: number;
			rejectUnauthorized: boolean;
			requestSpacingSec: number;
			startupDelaySec: number;
			retryDelaySec: number;
			maxConsecutiveErrors: number;
			nodes: {
				enabled?: boolean;
				node?: number;
				name?: string;
				jsonparam?: string;
				useDesignation?: boolean;
				createRawJson?: boolean;
			}[];
			cleanupMissingObjects: boolean;
		}
	}
}

export {};
