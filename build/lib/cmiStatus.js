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
var cmiStatus_exports = {};
__export(cmiStatus_exports, {
  getCmiStatusText: () => getCmiStatusText,
  isBackoffStatus: () => isBackoffStatus
});
module.exports = __toCommonJS(cmiStatus_exports);
const STATUS_TEXTS = /* @__PURE__ */ new Map([
  [0, "OK"],
  [1, "NODE ERROR"],
  [2, "FAIL"],
  [3, "SYNTAX ERROR"],
  [4, "TOO MANY REQUESTS"],
  [5, "DEVICE NOT SUPPORTED"],
  [6, "TOO FEW ARGUMENTS"],
  [7, "CAN BUSY"]
]);
function getCmiStatusText(statusCode) {
  var _a;
  return (_a = STATUS_TEXTS.get(statusCode)) != null ? _a : "ERROR";
}
function isBackoffStatus(statusCode) {
  return statusCode === 4 || statusCode === 7;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getCmiStatusText,
  isBackoffStatus
});
//# sourceMappingURL=cmiStatus.js.map
