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
var units_exports = {};
__export(units_exports, {
  getRoleForValue: () => getRoleForValue,
  getUnitMeta: () => getUnitMeta,
  getValueType: () => getValueType,
  isBooleanUnit: () => isBooleanUnit,
  normalizeValue: () => normalizeValue
});
module.exports = __toCommonJS(units_exports);
const UNIT_META = /* @__PURE__ */ new Map([
  [1, { unit: "\xB0C", role: "value.temperature" }],
  [2, { unit: "W/m\xB2", role: "value" }],
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
  [28, { unit: "m\xB3", role: "value" }],
  [36, { unit: "m/s", role: "value.speed" }],
  [38, { unit: "m\xB3/h", role: "value" }],
  [43, { role: "sensor.switch", boolean: true, states: { false: "OFF", true: "ON" } }],
  [44, { role: "sensor", boolean: true, states: { false: "NO", true: "YES" } }],
  [46, { unit: "\xB0C", role: "value.temperature" }],
  [54, { unit: "\xB0", role: "value" }],
  [56, { unit: "\xB0", role: "value" }],
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
  [78, { role: "sensor", boolean: true, states: { false: "CLOSED", true: "OPEN" } }]
]);
const TRUE_STRINGS = /* @__PURE__ */ new Set(["1", "true", "on", "yes", "open", "active"]);
const FALSE_STRINGS = /* @__PURE__ */ new Set(["0", "false", "off", "no", "closed", "inactive"]);
function getUnitMeta(unitId) {
  return unitId === void 0 ? void 0 : UNIT_META.get(unitId);
}
function isBooleanUnit(unitId) {
  var _a;
  return ((_a = getUnitMeta(unitId)) == null ? void 0 : _a.boolean) === true;
}
function getRoleForValue(value, unitId) {
  const unitMeta = getUnitMeta(unitId);
  if (unitMeta == null ? void 0 : unitMeta.role) {
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
function parseBoolean(value) {
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
  return void 0;
}
function parseNumber(value) {
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
  return void 0;
}
function normalizeValue(value, ad, unitId) {
  const booleanValue = parseBoolean(value);
  if (isBooleanUnit(unitId) || (ad == null ? void 0 : ad.toUpperCase()) === "D") {
    if (booleanValue !== void 0) {
      return booleanValue;
    }
  }
  const numericValue = parseNumber(value);
  if (numericValue !== void 0) {
    return numericValue;
  }
  if (booleanValue !== void 0) {
    return booleanValue;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === void 0) {
    return null;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
function getValueType(value) {
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return "number";
  }
  return "string";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getRoleForValue,
  getUnitMeta,
  getValueType,
  isBooleanUnit,
  normalizeValue
});
//# sourceMappingURL=units.js.map
