"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var objectFactory_exports = {};
__export(objectFactory_exports, {
  ObjectFactory: () => ObjectFactory,
  buildNodeId: () => buildNodeId,
  buildPointChannelId: () => buildPointChannelId
});
module.exports = __toCommonJS(objectFactory_exports);
var import_cmiParser = require("./cmiParser");
var import_units = require("./units");
function buildNodeId(node) {
  return `node_${(0, import_cmiParser.formatNumber)(node)}`;
}
function buildPointChannelId(point) {
  return `${point.groupId}_${(0, import_cmiParser.formatNumber)(point.number)}`;
}
function readableName(parts) {
  return parts.filter((part) => !!part && part.trim().length > 0).join(" ");
}
function stateDefinitionForValue(point) {
  const value = (0, import_units.normalizeValue)(point.value, point.ad, point.unitId);
  const unitMeta = (0, import_units.getUnitMeta)(point.unitId);
  return {
    value,
    definition: {
      name: point.designation || readableName([point.groupName, String(point.number), "value"]),
      type: (0, import_units.getValueType)(value),
      role: (0, import_units.getRoleForValue)(value, point.unitId),
      unit: unitMeta == null ? void 0 : unitMeta.unit,
      states: unitMeta == null ? void 0 : unitMeta.states
    }
  };
}
function stateObject(definition) {
  return {
    type: "state",
    common: {
      name: definition.name,
      type: definition.type,
      role: definition.role,
      read: true,
      write: false,
      ...definition.unit ? { unit: definition.unit } : {},
      ...definition.states ? { states: definition.states } : {}
    },
    native: {}
  };
}
class ObjectFactory {
  constructor(adapter) {
    this.adapter = adapter;
  }
  async ensureInfoObjects() {
    await this.ensureChannel("info", "Information");
    await this.ensureState("info.connection", {
      name: "C.M.I. connected",
      type: "boolean",
      role: "indicator.connected"
    });
    await this.ensureState("info.lastUpdate", {
      name: "Last update attempt",
      type: "number",
      role: "value.time"
    });
    await this.ensureState("info.lastSuccessfulUpdate", {
      name: "Last successful update",
      type: "number",
      role: "value.time"
    });
    await this.ensureState("info.lastError", {
      name: "Last error",
      type: "string",
      role: "text"
    });
    await this.ensureState("info.lastStatusCode", {
      name: "Last C.M.I. status code",
      type: "number",
      role: "value"
    });
    await this.ensureState("info.lastStatusText", {
      name: "Last C.M.I. status text",
      type: "string",
      role: "text"
    });
    await this.ensureState("info.effectiveNodeIntervalSec", {
      name: "Effective update interval per node",
      type: "number",
      role: "value.interval",
      unit: "s"
    });
  }
  async setInfoState(id, value) {
    await this.adapter.setStateAsync(`info.${id}`, { val: value, ack: true });
  }
  async publishEffectiveNodeInterval(seconds) {
    await this.setInfoState("effectiveNodeIntervalSec", seconds);
  }
  async publishParsedNode(options, parsed, rawBody) {
    const nodeId = buildNodeId(options.node);
    await this.ensureDevice(nodeId, options.name || `Node ${(0, import_cmiParser.formatNumber)(options.node)}`, options.forceNameRefresh);
    await this.ensureChannel(`${nodeId}.info`, "Information");
    if (parsed.header) {
      await this.ensureAndSet(
        `${nodeId}.info.apiVersion`,
        {
          name: "API version",
          type: "string",
          role: "text"
        },
        parsed.header.apiVersion
      );
      await this.ensureAndSet(
        `${nodeId}.info.deviceId`,
        {
          name: "Device ID",
          type: "string",
          role: "text"
        },
        parsed.header.deviceId
      );
      await this.ensureAndSet(
        `${nodeId}.info.deviceName`,
        {
          name: "Device name",
          type: "string",
          role: "text"
        },
        parsed.header.deviceName
      );
      await this.ensureAndSet(
        `${nodeId}.info.timestamp`,
        {
          name: "C.M.I. timestamp",
          type: "string",
          role: "text"
        },
        parsed.header.timestamp
      );
    }
    if (options.createRawJson && rawBody !== void 0) {
      await this.ensureAndSet(
        `${nodeId}.info.rawJson`,
        {
          name: "Raw C.M.I. JSON",
          type: "string",
          role: "json"
        },
        rawBody
      );
    }
    for (const point of parsed.points) {
      await this.publishPoint(nodeId, point, options.useDesignation, options.forceNameRefresh);
    }
  }
  async publishPoint(nodeId, point, useDesignation, forceNameRefresh) {
    const channelId = `${nodeId}.${buildPointChannelId(point)}`;
    const channelName = useDesignation && point.designation ? point.designation : readableName([point.groupName, (0, import_cmiParser.formatNumber)(point.number)]);
    await this.ensureChannel(channelId, channelName, useDesignation || forceNameRefresh);
    const value = stateDefinitionForValue(point);
    await this.ensureAndSet(
      `${channelId}.value`,
      value.definition,
      value.value,
      useDesignation || forceNameRefresh
    );
    if (point.unitId !== void 0) {
      await this.ensureAndSet(
        `${channelId}.unitId`,
        {
          name: "Unit ID",
          type: "number",
          role: "value"
        },
        point.unitId
      );
    }
    if (point.ad) {
      await this.ensureAndSet(
        `${channelId}.ad`,
        {
          name: "Analog/digital type",
          type: "string",
          role: "text"
        },
        point.ad
      );
    }
    if (point.designation) {
      await this.ensureAndSet(
        `${channelId}.designation`,
        {
          name: "Designation",
          type: "string",
          role: "text"
        },
        point.designation,
        useDesignation || forceNameRefresh
      );
    }
    if (point.state !== void 0) {
      const stateValue = (0, import_units.normalizeValue)(point.state, "D", void 0);
      await this.ensureAndSet(
        `${channelId}.state`,
        {
          name: "Output state",
          type: (0, import_units.getValueType)(stateValue),
          role: typeof stateValue === "boolean" ? "sensor" : "value"
        },
        stateValue
      );
    }
    if (point.ras !== void 0) {
      const rasValue = (0, import_units.normalizeValue)(point.ras, void 0, void 0);
      await this.ensureAndSet(
        `${channelId}.ras`,
        {
          name: "RAS",
          type: (0, import_units.getValueType)(rasValue),
          role: (0, import_units.getRoleForValue)(rasValue, void 0)
        },
        rasValue
      );
    }
  }
  async ensureAndSet(id, definition, value, updateName = false) {
    await this.ensureState(id, definition, updateName);
    await this.adapter.setStateAsync(id, { val: value, ack: true });
  }
  async ensureState(id, definition, updateExisting = false) {
    const object = stateObject(definition);
    await this.adapter.setObjectNotExistsAsync(id, object);
    if (updateExisting) {
      await this.adapter.extendObjectAsync(id, { common: object.common });
    }
  }
  async ensureChannel(id, name, updateExisting = false) {
    const object = {
      type: "channel",
      common: { name },
      native: {}
    };
    await this.adapter.setObjectNotExistsAsync(id, object);
    if (updateExisting) {
      await this.adapter.extendObjectAsync(id, { common: object.common });
    }
  }
  async ensureDevice(id, name, updateExisting = false) {
    const object = {
      type: "device",
      common: { name },
      native: {}
    };
    await this.adapter.setObjectNotExistsAsync(id, object);
    if (updateExisting) {
      await this.adapter.extendObjectAsync(id, { common: object.common });
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ObjectFactory,
  buildNodeId,
  buildPointChannelId
});
//# sourceMappingURL=objectFactory.js.map
