export type StateValue = boolean | number | string | null;

export interface UnitMeta {
	unit?: string;
	role: string;
	boolean?: boolean;
	states?: Record<string, string>;
}

const UNIT_META = new Map<number, UnitMeta>([
	[1, { unit: "°C", role: "value.temperature" }],
	[2, { unit: "W/m²", role: "value" }],
	[3, { unit: "l/h", role: "value" }],
	[4, { unit: "sec", role: "value" }],
	[5, { unit: "min", role: "value" }],
	[7, { unit: "K", role: "value" }],
	[8, { unit: "%", role: "value" }],
	[10, { unit: "kW", role: "value.power" }],
	[11, { unit: "kWh", role: "value.energy" }],
	[12, { unit: "MWh", role: "value.energy" }],
	[13, { unit: "V", role: "value.voltage" }],
	[14, { unit: "mA", role: "value.current" }],
	[15, { unit: "h", role: "value" }],
	[16, { unit: "Days", role: "value" }],
	[19, { unit: "l", role: "value" }],
	[20, { unit: "km/h", role: "value.speed" }],
	[21, { unit: "Hz", role: "value.frequency" }],
	[22, { unit: "l/min", role: "value" }],
	[23, { unit: "bar", role: "value.pressure" }],
	[25, { unit: "km", role: "value" }],
	[26, { unit: "m", role: "value" }],
	[27, { unit: "mm", role: "value" }],
	[28, { unit: "m³", role: "value" }],
	[36, { unit: "m/s", role: "value.speed" }],
	[38, { unit: "m³/h", role: "value" }],
	[43, { role: "sensor.switch", boolean: true, states: { false: "OFF", true: "ON" } }],
	[44, { role: "sensor", boolean: true, states: { false: "NO", true: "YES" } }],
	[46, { unit: "°C", role: "value.temperature" }],
	[54, { unit: "°", role: "value" }],
	[56, { unit: "°", role: "value" }],
	[57, { unit: "sec", role: "value" }],
	[59, { unit: "%", role: "value" }],
	[63, { unit: "A", role: "value.current" }],
	[65, { unit: "mbar", role: "value.pressure" }],
	[66, { unit: "Pa", role: "value.pressure" }],
	[67, { unit: "ppm", role: "value.co2" }],
	[69, { unit: "W", role: "value.power" }],
	[70, { unit: "t", role: "value" }],
	[71, { unit: "kg", role: "value" }],
	[72, { unit: "g", role: "value" }],
	[73, { unit: "cm", role: "value" }],
	[74, { unit: "K", role: "value" }],
	[75, { unit: "lx", role: "value.brightness" }],
	[77, { unit: "ct/kWh", role: "value" }],
	[78, { role: "sensor", boolean: true, states: { false: "CLOSED", true: "OPEN" } }],
]);

const TRUE_STRINGS = new Set(["1", "true", "on", "yes", "open", "active"]);
const FALSE_STRINGS = new Set(["0", "false", "off", "no", "closed", "inactive"]);

export function getUnitMeta(unitId: number | undefined): UnitMeta | undefined {
	return unitId === undefined ? undefined : UNIT_META.get(unitId);
}

export function isBooleanUnit(unitId: number | undefined): boolean {
	return getUnitMeta(unitId)?.boolean === true;
}

export function getRoleForValue(value: StateValue, unitId: number | undefined): string {
	const unitMeta = getUnitMeta(unitId);
	if (unitMeta?.role) {
		return unitMeta.role;
	}
	if (typeof value === "boolean") {
		return "sensor";
	}
	if (typeof value === "string") {
		return "text";
	}
	return "value";
}

function parseBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return value !== 0;
	}
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (TRUE_STRINGS.has(normalized)) {
			return true;
		}
		if (FALSE_STRINGS.has(normalized)) {
			return false;
		}
	}
	return undefined;
}

function parseNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim() !== "") {
		const normalized = value.trim().replace(",", ".");
		const parsed = Number(normalized);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return undefined;
}

export function normalizeValue(value: unknown, ad: string | undefined, unitId: number | undefined): StateValue {
	const booleanValue = parseBoolean(value);
	if (isBooleanUnit(unitId) || ad?.toUpperCase() === "D") {
		if (booleanValue !== undefined) {
			return booleanValue;
		}
	}

	const numericValue = parseNumber(value);
	if (numericValue !== undefined) {
		return numericValue;
	}

	if (booleanValue !== undefined) {
		return booleanValue;
	}

	if (typeof value === "string") {
		return value;
	}

	if (value === null || value === undefined) {
		return null;
	}

	try {
		return JSON.stringify(value);
	} catch {
		return Object.prototype.toString.call(value);
	}
}

export function getValueType(value: StateValue): "boolean" | "number" | "string" {
	if (typeof value === "boolean") {
		return "boolean";
	}
	if (typeof value === "number") {
		return "number";
	}
	return "string";
}
