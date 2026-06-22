import { formatNumber, type ParsedCmiResponse, type ParsedDataPoint } from "./cmiParser";
import { getRoleForValue, getUnitMeta, getValueType, normalizeValue, type StateValue } from "./units";

interface AdapterLike {
	extendObjectAsync(
		id: string,
		objPart: ioBroker.PartialObject,
		options?: ioBroker.ExtendObjectOptions,
	): ioBroker.SetObjectPromise;
	setObjectNotExistsAsync(id: string, obj: ioBroker.SettableObject, options?: unknown): ioBroker.SetObjectPromise;
	setStateAsync(
		id: string,
		state: ioBroker.State | ioBroker.StateValue | ioBroker.SettableState,
		ack?: boolean,
	): ioBroker.SetStatePromise;
	log: ioBroker.Logger;
}

export interface NodeObjectOptions {
	node: number;
	name?: string;
	useDesignation: boolean;
	forceNameRefresh: boolean;
	createRawJson: boolean;
}

interface StateDefinition {
	name: string;
	type: "boolean" | "number" | "string";
	role: string;
	unit?: string;
	states?: Record<string, string>;
}

export function buildNodeId(node: number): string {
	return `node_${formatNumber(node)}`;
}

export function buildPointChannelId(point: ParsedDataPoint): string {
	return `${point.groupId}_${formatNumber(point.number)}`;
}

function readableName(parts: (string | undefined)[]): string {
	return parts.filter((part): part is string => !!part && part.trim().length > 0).join(" ");
}

function stateDefinitionForValue(point: ParsedDataPoint): { definition: StateDefinition; value: StateValue } {
	const value = normalizeValue(point.value, point.ad, point.unitId);
	const unitMeta = getUnitMeta(point.unitId);

	return {
		value,
		definition: {
			name: point.designation || readableName([point.groupName, String(point.number), "value"]),
			type: getValueType(value),
			role: getRoleForValue(value, point.unitId),
			unit: unitMeta?.unit,
			states: unitMeta?.states,
		},
	};
}

function stateObject(definition: StateDefinition): ioBroker.SettableStateObject {
	return {
		type: "state",
		common: {
			name: definition.name,
			type: definition.type,
			role: definition.role,
			read: true,
			write: false,
			...(definition.unit ? { unit: definition.unit } : {}),
			...(definition.states ? { states: definition.states } : {}),
		},
		native: {},
	};
}

export class ObjectFactory {
	public constructor(private readonly adapter: AdapterLike) {}

	public async ensureInfoObjects(): Promise<void> {
		await this.ensureChannel("info", "Information");
		await this.ensureState("info.connection", {
			name: "C.M.I. connected",
			type: "boolean",
			role: "indicator.connected",
		});
		await this.ensureState("info.lastUpdate", {
			name: "Last update attempt",
			type: "number",
			role: "value.time",
		});
		await this.ensureState("info.lastSuccessfulUpdate", {
			name: "Last successful update",
			type: "number",
			role: "value.time",
		});
		await this.ensureState("info.lastError", {
			name: "Last error",
			type: "string",
			role: "text",
		});
		await this.ensureState("info.lastStatusCode", {
			name: "Last C.M.I. status code",
			type: "number",
			role: "value",
		});
		await this.ensureState("info.lastStatusText", {
			name: "Last C.M.I. status text",
			type: "string",
			role: "text",
		});
		await this.ensureState("info.effectiveNodeIntervalSec", {
			name: "Effective update interval per node",
			type: "number",
			role: "value.interval",
			unit: "s",
		});
	}

	public async setInfoState(id: string, value: StateValue): Promise<void> {
		await this.adapter.setStateAsync(`info.${id}`, { val: value, ack: true });
	}

	public async publishEffectiveNodeInterval(seconds: number): Promise<void> {
		await this.setInfoState("effectiveNodeIntervalSec", seconds);
	}

	public async publishParsedNode(
		options: NodeObjectOptions,
		parsed: ParsedCmiResponse,
		rawBody?: string,
	): Promise<void> {
		const nodeId = buildNodeId(options.node);
		await this.ensureDevice(nodeId, options.name || `Node ${formatNumber(options.node)}`, options.forceNameRefresh);
		await this.ensureChannel(`${nodeId}.info`, "Information");

		if (parsed.header) {
			await this.ensureAndSet(
				`${nodeId}.info.apiVersion`,
				{
					name: "API version",
					type: "string",
					role: "text",
				},
				parsed.header.apiVersion,
			);
			await this.ensureAndSet(
				`${nodeId}.info.deviceId`,
				{
					name: "Device ID",
					type: "string",
					role: "text",
				},
				parsed.header.deviceId,
			);
			await this.ensureAndSet(
				`${nodeId}.info.deviceName`,
				{
					name: "Device name",
					type: "string",
					role: "text",
				},
				parsed.header.deviceName,
			);
			await this.ensureAndSet(
				`${nodeId}.info.timestamp`,
				{
					name: "C.M.I. timestamp",
					type: "string",
					role: "text",
				},
				parsed.header.timestamp,
			);
		}

		if (options.createRawJson && rawBody !== undefined) {
			await this.ensureAndSet(
				`${nodeId}.info.rawJson`,
				{
					name: "Raw C.M.I. JSON",
					type: "string",
					role: "json",
				},
				rawBody,
			);
		}

		for (const point of parsed.points) {
			await this.publishPoint(nodeId, point, options.useDesignation, options.forceNameRefresh);
		}
	}

	private async publishPoint(
		nodeId: string,
		point: ParsedDataPoint,
		useDesignation: boolean,
		forceNameRefresh: boolean,
	): Promise<void> {
		const channelId = `${nodeId}.${buildPointChannelId(point)}`;
		const channelName =
			useDesignation && point.designation
				? point.designation
				: readableName([point.groupName, formatNumber(point.number)]);
		await this.ensureChannel(channelId, channelName, useDesignation || forceNameRefresh);

		const value = stateDefinitionForValue(point);
		await this.ensureAndSet(
			`${channelId}.value`,
			value.definition,
			value.value,
			useDesignation || forceNameRefresh,
		);

		if (point.unitId !== undefined) {
			await this.ensureAndSet(
				`${channelId}.unitId`,
				{
					name: "Unit ID",
					type: "number",
					role: "value",
				},
				point.unitId,
			);
		}

		if (point.ad) {
			await this.ensureAndSet(
				`${channelId}.ad`,
				{
					name: "Analog/digital type",
					type: "string",
					role: "text",
				},
				point.ad,
			);
		}

		if (point.designation) {
			await this.ensureAndSet(
				`${channelId}.designation`,
				{
					name: "Designation",
					type: "string",
					role: "text",
				},
				point.designation,
				useDesignation || forceNameRefresh,
			);
		}

		if (point.state !== undefined) {
			const stateValue = normalizeValue(point.state, "D", undefined);
			await this.ensureAndSet(
				`${channelId}.state`,
				{
					name: "Output state",
					type: getValueType(stateValue),
					role: typeof stateValue === "boolean" ? "sensor" : "value",
				},
				stateValue,
			);
		}

		if (point.ras !== undefined) {
			const rasValue = normalizeValue(point.ras, undefined, undefined);
			await this.ensureAndSet(
				`${channelId}.ras`,
				{
					name: "RAS",
					type: getValueType(rasValue),
					role: getRoleForValue(rasValue, undefined),
				},
				rasValue,
			);
		}
	}

	private async ensureAndSet(
		id: string,
		definition: StateDefinition,
		value: StateValue,
		updateName = false,
	): Promise<void> {
		await this.ensureState(id, definition, updateName);
		await this.adapter.setStateAsync(id, { val: value, ack: true });
	}

	private async ensureState(id: string, definition: StateDefinition, updateExisting = false): Promise<void> {
		const object = stateObject(definition);
		await this.adapter.setObjectNotExistsAsync(id, object);
		if (updateExisting) {
			await this.adapter.extendObjectAsync(id, { common: object.common });
		}
	}

	private async ensureChannel(id: string, name: string, updateExisting = false): Promise<void> {
		const object: ioBroker.SettableChannelObject = {
			type: "channel",
			common: { name },
			native: {},
		};
		await this.adapter.setObjectNotExistsAsync(id, object);
		if (updateExisting) {
			await this.adapter.extendObjectAsync(id, { common: object.common });
		}
	}

	private async ensureDevice(id: string, name: string, updateExisting = false): Promise<void> {
		const object: ioBroker.SettableDeviceObject = {
			type: "device",
			common: { name },
			native: {},
		};
		await this.adapter.setObjectNotExistsAsync(id, object);
		if (updateExisting) {
			await this.adapter.extendObjectAsync(id, { common: object.common });
		}
	}
}
