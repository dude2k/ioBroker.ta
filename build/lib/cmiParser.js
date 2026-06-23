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
var cmiParser_exports = {};
__export(cmiParser_exports, {
  formatNumber: () => formatNumber,
  getDeviceName: () => getDeviceName,
  normalizeDeviceId: () => normalizeDeviceId,
  parseCmiResponse: () => parseCmiResponse,
  resolveGroup: () => resolveGroup,
  sanitizeIdPart: () => sanitizeIdPart
});
module.exports = __toCommonJS(cmiParser_exports);
var import_cmiStatus = require("./cmiStatus");
const DEVICE_NAMES = /* @__PURE__ */ new Map([
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
  ["92", "UVR67"]
]);
const GROUP_DEFINITIONS = [
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
  { id: "logging_digital", name: "Logging digital", patterns: [/^ld\d*$/i, /^logging(?:_| |-)digital/i] }
];
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function getProperty(record, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(record, name)) {
      return record[name];
    }
  }
  return void 0;
}
function asString(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return void 0;
}
function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim().replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return void 0;
}
function normalizeDeviceId(value) {
  var _a;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 99 ? Math.trunc(value).toString(16).toUpperCase() : String(Math.trunc(value)).padStart(2, "0");
  }
  const raw = (_a = asString(value)) != null ? _a : "";
  return raw.replace(/^0x/i, "").trim().toUpperCase().padStart(2, "0");
}
function getDeviceName(deviceId) {
  var _a;
  return (_a = DEVICE_NAMES.get(deviceId.toUpperCase())) != null ? _a : `Unknown device ${deviceId}`;
}
function sanitizeIdPart(value) {
  const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/_{2,}/g, "_");
  return sanitized || "unknown";
}
function formatNumber(value, width = 3) {
  return Math.max(0, Math.trunc(value)).toString().padStart(width, "0");
}
function resolveGroup(rawGroupName) {
  const normalized = rawGroupName.trim();
  const match = GROUP_DEFINITIONS.find((group) => group.patterns.some((pattern) => pattern.test(normalized)));
  if (match) {
    return { id: match.id, name: match.name, known: true };
  }
  return {
    id: sanitizeIdPart(normalized),
    name: normalized || "Unknown",
    known: false
  };
}
function parseHeader(rawHeader) {
  var _a, _b;
  if (!isRecord(rawHeader)) {
    return void 0;
  }
  const apiVersion = (_a = asString(getProperty(rawHeader, ["Version", "version", "ApiVersion", "API version"]))) != null ? _a : "";
  const deviceId = normalizeDeviceId(getProperty(rawHeader, ["Device", "device", "Device ID", "DeviceId"]));
  const timestamp = (_b = asString(getProperty(rawHeader, ["Timestamp", "timestamp", "TimeStamp"]))) != null ? _b : "";
  return {
    apiVersion,
    deviceId,
    deviceName: getDeviceName(deviceId),
    timestamp
  };
}
function extractElements(value) {
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
function parseDataPoint(rawGroupName, rawElement, fallbackNumber) {
  var _a, _b;
  const number = (_a = asNumber(getProperty(rawElement, ["Number", "number", "No", "Index", "index"]))) != null ? _a : fallbackNumber;
  if (!Number.isFinite(number) || number <= 0) {
    return void 0;
  }
  const valueObject = getProperty(rawElement, ["Value", "value"]);
  const valueRecord = isRecord(valueObject) ? valueObject : void 0;
  const rawValue = valueRecord ? getProperty(valueRecord, ["Value", "value", "Raw", "raw"]) : valueObject;
  const group = resolveGroup(rawGroupName);
  return {
    groupName: group.name,
    groupId: group.id,
    number: Math.trunc(number),
    ad: (_b = asString(getProperty(rawElement, ["AD", "ad"]))) == null ? void 0 : _b.toUpperCase(),
    designation: asString(getProperty(rawElement, ["Designation", "designation", "Name", "name"])),
    value: rawValue,
    unitId: asNumber(
      valueRecord ? getProperty(valueRecord, ["Unit", "unit", "UnitId", "unitId"]) : getProperty(rawElement, ["Unit", "unit"])
    ),
    state: valueRecord ? getProperty(valueRecord, ["State", "state"]) : getProperty(rawElement, ["State", "state"]),
    ras: valueRecord ? getProperty(valueRecord, ["RAS", "ras"]) : getProperty(rawElement, ["RAS", "ras"])
  };
}
function parseCmiResponse(rawResponse) {
  var _a, _b;
  const response = isRecord(rawResponse) ? rawResponse : {};
  const statusCode = (_a = asNumber(getProperty(response, ["Status code", "StatusCode", "statusCode", "Code", "code"]))) != null ? _a : 0;
  const statusText = (_b = asString(getProperty(response, ["Status", "Status text", "StatusText", "statusText"]))) != null ? _b : (0, import_cmiStatus.getCmiStatusText)(statusCode);
  const header = parseHeader(getProperty(response, ["Header", "header"]));
  if (statusCode !== 0) {
    return {
      statusCode,
      statusText: (0, import_cmiStatus.getCmiStatusText)(statusCode),
      header,
      points: [],
      unknownGroups: []
    };
  }
  const rawData = getProperty(response, ["Data", "data"]);
  const data = isRecord(rawData) ? rawData : {};
  const points = [];
  const unknownGroups = /* @__PURE__ */ new Set();
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
    unknownGroups: [...unknownGroups]
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  formatNumber,
  getDeviceName,
  normalizeDeviceId,
  parseCmiResponse,
  resolveGroup,
  sanitizeIdPart
});
//# sourceMappingURL=cmiParser.js.map
