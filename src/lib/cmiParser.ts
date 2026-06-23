import { getCmiStatusText } from "./cmiStatus";

export interface ParsedHeader {
	apiVersion: string;
	deviceId: string;
	deviceName: string;
	timestamp: string;
}

export interface ParsedDataPoint {
	groupName: string;
	groupId: string;
	number: number;
	ad?: string;
	designation?: string;
	value: unknown;
	unitId?: number;
	state?: unknown;
	ras?: unknown;
}

export interface ParsedCmiResponse {
	statusCode: number;
	statusText: string;
	header?: ParsedHeader;
	points: ParsedDataPoint[];
	unknownGroups: string[];
}

interface GroupDefinition {
	id: string;
	name: string;
	patterns: RegExp[];
}

const DEVICE_NAMES = new Map<string, string>([
	["80", "UVR1611"],
	["87", "UVR16x2"],
	["88", "RSM610"],
	["89", "CAN-I/O45"],
	["8B", "CAN-EZ2"],
	["8C", "CAN-MTx2"],
	["8D", "CAN-BC2"],
	["8E", "UVR65"],
	["8F", "CAN-EZ3"],
	["91", "UVR610"],
	["92", "UVR67"],
]);

const GROUP_DEFINITIONS: GroupDefinition[] = [
	{ id: "input", name: "Input", patterns: [/^i(?:nputs?)?$/i, /^input/i] },
	{ id: "output", name: "Output", patterns: [/^o(?:utputs?)?$/i, /^output/i] },
	{ id: "dl_input", name: "DL input", patterns: [/^d$/i, /^dl(?:_| |-)input/i] },
	{ id: "system_general", name: "System general", patterns: [/^sg\d*$/i, /^general$/i, /^system(?:_| |-)general/i] },
	{ id: "system_date", name: "System date", patterns: [/^sd\d*$/i, /^date$/i, /^system(?:_| |-)date/i] },
	{ id: "system_time", name: "System time", patterns: [/^st\d*$/i, /^time$/i, /^system(?:_| |-)time/i] },
	{ id: "system_sun", name: "System sun", patterns: [/^ss\d*$/i, /^sun$/i, /^system(?:_| |-)sun/i] },
	{ id: "electrical_power", name: "Electrical power", patterns: [/^sp\d*$/i, /^electrical(?:_| |-)power/i] },
	{ id: "network_analog", name: "Network analog", patterns: [/^na\d*$/i, /^network(?:_| |-)analog/i] },
	{ id: "network_digital", name: "Network digital", patterns: [/^nd\d*$/i, /^network(?:_| |-)digital/i] },
	{ id: "mbus", name: "M-Bus", patterns: [/^m\d*$/i, /^m(?:_| |-|\.)?bus/i] },
	{ id: "modbus", name: "Modbus", patterns: [/^am\d*$/i, /^modbus/i] },
	{ id: "knx", name: "KNX", patterns: [/^ak\d*$/i, /^knx/i] },
	{ id: "logging_analog", name: "Logging analog", patterns: [/^la\d*$/i, /^logging(?:_| |-)analog/i] },
	{ id: "logging_digital", name: "Logging digital", patterns: [/^ld\d*$/i, /^logging(?:_| |-)digital/i] },
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProperty(record: Record<string, unknown>, names: string[]): unknown {
	for (const name of names) {
		if (Object.prototype.hasOwnProperty.call(record, name)) {
			return record[name];
		}
	}
	return undefined;
}

function asString(value: unknown): string | undefined {
	if (typeof value === "string") {
		return value.trim();
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return undefined;
}

function asNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value.trim().replace(",", "."));
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return undefined;
}

export function normalizeDeviceId(value: unknown): string {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value > 99 ? Math.trunc(value).toString(16).toUpperCase() : String(Math.trunc(value)).padStart(2, "0");
	}

	const raw = asString(value) ?? "";
	return raw.replace(/^0x/i, "").trim().toUpperCase().padStart(2, "0");
}

export function getDeviceName(deviceId: string): string {
	return DEVICE_NAMES.get(deviceId.toUpperCase()) ?? `Unknown device ${deviceId}`;
}

export function sanitizeIdPart(value: string): string {
	const sanitized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.replace(/_{2,}/g, "_");
	return sanitized || "unknown";
}

export function formatNumber(value: number, width = 3): string {
	return Math.max(0, Math.trunc(value)).toString().padStart(width, "0");
}

export function resolveGroup(rawGroupName: string): {
	id: string;
	name: string;
	known: boolean;
} {
	const normalized = rawGroupName.trim();
	const match = GROUP_DEFINITIONS.find(group => group.patterns.some(pattern => pattern.test(normalized)));

	if (match) {
		return { id: match.id, name: match.name, known: true };
	}

	return {
		id: sanitizeIdPart(normalized),
		name: normalized || "Unknown",
		known: false,
	};
}

function parseHeader(rawHeader: unknown): ParsedHeader | undefined {
	if (!isRecord(rawHeader)) {
		return undefined;
	}

	const apiVersion = asString(getProperty(rawHeader, ["Version", "version", "ApiVersion", "API version"])) ?? "";
	const deviceId = normalizeDeviceId(getProperty(rawHeader, ["Device", "device", "Device ID", "DeviceId"]));
	const timestamp = asString(getProperty(rawHeader, ["Timestamp", "timestamp", "TimeStamp"])) ?? "";

	return {
		apiVersion,
		deviceId,
		deviceName: getDeviceName(deviceId),
		timestamp,
	};
}

function extractElements(value: unknown): Record<string, unknown>[] {
	if (Array.isArray(value)) {
		return value.filter(isRecord);
	}

	if (!isRecord(value)) {
		return [];
	}

	for (const propertyName of ["Values", "values", "Data", "data", "Items", "items"]) {
		const nested = value[propertyName];
		if (Array.isArray(nested)) {
			return nested.filter(isRecord);
		}
	}

	if (Object.values(value).every(isRecord)) {
		return Object.values(value).filter(isRecord);
	}

	return [value];
}

function parseDataPoint(
	rawGroupName: string,
	rawElement: Record<string, unknown>,
	fallbackNumber: number,
): ParsedDataPoint | undefined {
	const number = asNumber(getProperty(rawElement, ["Number", "number", "No", "Index", "index"])) ?? fallbackNumber;
	if (!Number.isFinite(number) || number <= 0) {
		return undefined;
	}

	const valueObject = getProperty(rawElement, ["Value", "value"]);
	const valueRecord = isRecord(valueObject) ? valueObject : undefined;
	const rawValue = valueRecord ? getProperty(valueRecord, ["Value", "value", "Raw", "raw"]) : valueObject;
	const group = resolveGroup(rawGroupName);

	return {
		groupName: group.name,
		groupId: group.id,
		number: Math.trunc(number),
		ad: asString(getProperty(rawElement, ["AD", "ad"]))?.toUpperCase(),
		designation: asString(getProperty(rawElement, ["Designation", "designation", "Name", "name"])),
		value: rawValue,
		unitId: asNumber(
			valueRecord
				? getProperty(valueRecord, ["Unit", "unit", "UnitId", "unitId"])
				: getProperty(rawElement, ["Unit", "unit"]),
		),
		state: valueRecord ? getProperty(valueRecord, ["State", "state"]) : getProperty(rawElement, ["State", "state"]),
		ras: valueRecord ? getProperty(valueRecord, ["RAS", "ras"]) : getProperty(rawElement, ["RAS", "ras"]),
	};
}

export function parseCmiResponse(rawResponse: unknown): ParsedCmiResponse {
	const response = isRecord(rawResponse) ? rawResponse : {};
	const statusCode =
		asNumber(getProperty(response, ["Status code", "StatusCode", "statusCode", "Code", "code"])) ?? 0;
	const statusText =
		asString(getProperty(response, ["Status", "Status text", "StatusText", "statusText"])) ??
		getCmiStatusText(statusCode);
	const header = parseHeader(getProperty(response, ["Header", "header"]));

	if (statusCode !== 0) {
		return {
			statusCode,
			statusText: getCmiStatusText(statusCode),
			header,
			points: [],
			unknownGroups: [],
		};
	}

	const rawData = getProperty(response, ["Data", "data"]);
	const data = isRecord(rawData) ? rawData : {};
	const points: ParsedDataPoint[] = [];
	const unknownGroups = new Set<string>();

	for (const [rawGroupName, rawGroupValue] of Object.entries(data)) {
		const group = resolveGroup(rawGroupName);
		if (!group.known) {
			unknownGroups.add(group.id);
		}

		extractElements(rawGroupValue).forEach((element, index) => {
			const point = parseDataPoint(rawGroupName, element, index + 1);
			if (point) {
				points.push(point);
			}
		});
	}

	return {
		statusCode,
		statusText,
		header,
		points,
		unknownGroups: [...unknownGroups],
	};
}
