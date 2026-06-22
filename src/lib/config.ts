export const DEFAULT_JSON_PARAM = "I,O,Sg,Sd,St,Ss";
export const MIN_REQUEST_SPACING_SEC = 61;

const ALLOWED_JSON_PARAM_CODES = ["I", "O", "D", "Sg", "Sd", "St", "Ss", "Sp", "Na", "Nd", "M", "AM", "AK", "La", "Ld"];
const JSON_PARAM_PATTERN = new RegExp(`^(?:${ALLOWED_JSON_PARAM_CODES.join("|")})\\d*$`);

export interface TaNodeConfig {
	enabled: boolean;
	node: number;
	name: string;
	jsonparam: string;
	useDesignation: boolean;
	createRawJson: boolean;
}

export interface TaConfig {
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
	nodes: TaNodeConfig[];
	cleanupMissingObjects: boolean;
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

function asNumber(value: unknown, fallback: number): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return fallback;
}

function asString(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value.trim() : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "string") {
		if (value.toLowerCase() === "true") {
			return true;
		}
		if (value.toLowerCase() === "false") {
			return false;
		}
	}
	return fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function normalizeJsonParam(value: unknown): string {
	const raw = asString(value, DEFAULT_JSON_PARAM);
	const parts = raw
		.split(",")
		.map(part => part.trim())
		.filter(part => part.length > 0);

	const validParts = parts.filter(part => JSON_PARAM_PATTERN.test(part));
	return validParts.length > 0 ? validParts.join(",") : DEFAULT_JSON_PARAM;
}

export function normalizeConfig(native: Partial<ioBroker.AdapterConfig>): TaConfig {
	const nodes = Array.isArray(native.nodes) ? native.nodes : [];

	return {
		host: asString(native.host),
		port: clamp(Math.trunc(asNumber(native.port, 80)), 1, 65535),
		protocol: native.protocol === "https" ? "https" : "http",
		username: asString(native.username),
		password: typeof native.password === "string" ? native.password : "",
		timeoutMs: clamp(Math.trunc(asNumber(native.timeoutMs, 10_000)), 1_000, 60_000),
		rejectUnauthorized: asBoolean(native.rejectUnauthorized, true),
		requestSpacingSec: Math.max(MIN_REQUEST_SPACING_SEC, Math.trunc(asNumber(native.requestSpacingSec, 65))),
		startupDelaySec: Math.max(0, Math.trunc(asNumber(native.startupDelaySec, 5))),
		retryDelaySec: Math.max(1, Math.trunc(asNumber(native.retryDelaySec, 120))),
		maxConsecutiveErrors: Math.max(1, Math.trunc(asNumber(native.maxConsecutiveErrors, 3))),
		nodes: nodes.map((nodeConfig, index) => {
			const rawNodeConfig = nodeConfig ?? {};
			return {
				enabled: asBoolean(rawNodeConfig.enabled, true),
				node: clamp(Math.trunc(asNumber(rawNodeConfig.node, index + 1)), 1, 255),
				name: asString(rawNodeConfig.name),
				jsonparam: normalizeJsonParam(rawNodeConfig.jsonparam),
				useDesignation: asBoolean(rawNodeConfig.useDesignation, true),
				createRawJson: asBoolean(rawNodeConfig.createRawJson, false),
			};
		}),
		cleanupMissingObjects: asBoolean(native.cleanupMissingObjects, false),
	};
}

export function getEnabledNodes(config: TaConfig): TaNodeConfig[] {
	return config.nodes.filter(nodeConfig => nodeConfig.enabled);
}

export function validateConfig(config: TaConfig): ValidationResult {
	const errors: string[] = [];

	if (!config.host) {
		errors.push("Host is required.");
	}
	if (!config.username) {
		errors.push("C.M.I. expert username is required.");
	}
	if (!config.password) {
		errors.push("C.M.I. expert password is required.");
	}
	if (getEnabledNodes(config).length === 0) {
		errors.push("At least one enabled CAN node is required.");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
