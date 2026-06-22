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
var config_exports = {};
__export(config_exports, {
  DEFAULT_JSON_PARAM: () => DEFAULT_JSON_PARAM,
  MIN_REQUEST_SPACING_SEC: () => MIN_REQUEST_SPACING_SEC,
  getEnabledNodes: () => getEnabledNodes,
  normalizeConfig: () => normalizeConfig,
  validateConfig: () => validateConfig
});
module.exports = __toCommonJS(config_exports);
const DEFAULT_JSON_PARAM = "I,O,Sg,Sd,St,Ss";
const MIN_REQUEST_SPACING_SEC = 61;
const ALLOWED_JSON_PARAM_CODES = ["I", "O", "D", "Sg", "Sd", "St", "Ss", "Sp", "Na", "Nd", "M", "AM", "AK", "La", "Ld"];
const JSON_PARAM_PATTERN = new RegExp(`^(?:${ALLOWED_JSON_PARAM_CODES.join("|")})\\d*$`);
function asNumber(value, fallback) {
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
function asString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
function asBoolean(value, fallback) {
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
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function normalizeJsonParam(value) {
  const raw = asString(value, DEFAULT_JSON_PARAM);
  const parts = raw.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
  const validParts = parts.filter((part) => JSON_PARAM_PATTERN.test(part));
  return validParts.length > 0 ? validParts.join(",") : DEFAULT_JSON_PARAM;
}
function normalizeConfig(native) {
  const nodes = Array.isArray(native.nodes) ? native.nodes : [];
  return {
    host: asString(native.host),
    port: clamp(Math.trunc(asNumber(native.port, 80)), 1, 65535),
    protocol: native.protocol === "https" ? "https" : "http",
    username: asString(native.username),
    password: typeof native.password === "string" ? native.password : "",
    timeoutMs: clamp(Math.trunc(asNumber(native.timeoutMs, 1e4)), 1e3, 6e4),
    rejectUnauthorized: asBoolean(native.rejectUnauthorized, true),
    requestSpacingSec: Math.max(MIN_REQUEST_SPACING_SEC, Math.trunc(asNumber(native.requestSpacingSec, 65))),
    startupDelaySec: Math.max(0, Math.trunc(asNumber(native.startupDelaySec, 5))),
    retryDelaySec: Math.max(1, Math.trunc(asNumber(native.retryDelaySec, 120))),
    maxConsecutiveErrors: Math.max(1, Math.trunc(asNumber(native.maxConsecutiveErrors, 3))),
    nodes: nodes.map((nodeConfig, index) => {
      const rawNodeConfig = nodeConfig != null ? nodeConfig : {};
      return {
        enabled: asBoolean(rawNodeConfig.enabled, true),
        node: clamp(Math.trunc(asNumber(rawNodeConfig.node, index + 1)), 1, 255),
        name: asString(rawNodeConfig.name),
        jsonparam: normalizeJsonParam(rawNodeConfig.jsonparam),
        useDesignation: asBoolean(rawNodeConfig.useDesignation, true),
        createRawJson: asBoolean(rawNodeConfig.createRawJson, false)
      };
    }),
    cleanupMissingObjects: asBoolean(native.cleanupMissingObjects, false)
  };
}
function getEnabledNodes(config) {
  return config.nodes.filter((nodeConfig) => nodeConfig.enabled);
}
function validateConfig(config) {
  const errors = [];
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
    errors
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_JSON_PARAM,
  MIN_REQUEST_SPACING_SEC,
  getEnabledNodes,
  normalizeConfig,
  validateConfig
});
//# sourceMappingURL=config.js.map
