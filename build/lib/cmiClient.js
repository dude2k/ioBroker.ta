"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var cmiClient_exports = {};
__export(cmiClient_exports, {
  CmiAbortError: () => CmiAbortError,
  CmiClient: () => CmiClient,
  CmiHttpError: () => CmiHttpError,
  CmiJsonError: () => CmiJsonError,
  CmiTimeoutError: () => CmiTimeoutError,
  buildCmiApiUrl: () => buildCmiApiUrl,
  redactCredentials: () => redactCredentials
});
module.exports = __toCommonJS(cmiClient_exports);
var import_node_http = __toESM(require("node:http"));
var import_node_https = __toESM(require("node:https"));
var import_node_url = require("node:url");
class CmiHttpError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = "CmiHttpError";
  }
}
class CmiTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`C.M.I. request timed out after ${timeoutMs} ms`);
    this.name = "CmiTimeoutError";
  }
}
class CmiJsonError extends Error {
  constructor(message) {
    super(message);
    this.name = "CmiJsonError";
  }
}
class CmiAbortError extends Error {
  constructor() {
    super("C.M.I. request aborted");
    this.name = "CmiAbortError";
  }
}
function buildCmiApiUrl(request) {
  const url = new import_node_url.URL(`${request.protocol}://${request.host}:${request.port}/INCLUDE/api.cgi`);
  const jsonparam = encodeURIComponent(request.jsonparam).replace(/%2C/gi, ",");
  url.search = `?jsonnode=${encodeURIComponent(String(request.node))}&jsonparam=${jsonparam}`;
  if (request.useDesignation) {
    url.search += "&jsondesignation=1";
  }
  return url;
}
function redactCredentials(message) {
  return message.replace(/Basic\s+[A-Za-z0-9+/=]+/g, "Basic <redacted>").replace(/\/\/([^:/?#]+):([^@/?#]+)@/g, "//<redacted>@");
}
function createAuthHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}
class CmiClient {
  async requestNode(request) {
    const url = buildCmiApiUrl(request);
    const transport = request.protocol === "https" ? import_node_https.default : import_node_http.default;
    return new Promise((resolve, reject) => {
      var _a, _b;
      let settled = false;
      const req = transport.request(
        {
          method: "GET",
          hostname: url.hostname,
          port: url.port,
          path: `${url.pathname}${url.search}`,
          headers: {
            Accept: "application/json",
            Authorization: createAuthHeader(request.username, request.password)
          },
          rejectUnauthorized: request.protocol === "https" ? request.rejectUnauthorized : void 0
        },
        (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on("end", () => {
            var _a2;
            if (settled) {
              return;
            }
            settled = true;
            const statusCode = (_a2 = res.statusCode) != null ? _a2 : 0;
            const rawBody = Buffer.concat(chunks).toString("utf8");
            if (statusCode === 401 || statusCode === 403) {
              reject(
                new CmiHttpError(
                  "Authentication failed; C.M.I. expert credentials required",
                  statusCode
                )
              );
              return;
            }
            if (statusCode !== 200) {
              reject(new CmiHttpError(`HTTP ${statusCode} returned by C.M.I.`, statusCode));
              return;
            }
            try {
              resolve({
                url: url.toString(),
                statusCode,
                body: JSON.parse(rawBody),
                rawBody
              });
            } catch (error) {
              const snippet = rawBody.slice(0, 300);
              reject(
                new CmiJsonError(
                  `Failed to parse C.M.I. JSON response: ${redactCredentials(error.message)}; body starts with ${snippet}`
                )
              );
            }
          });
        }
      );
      req.setTimeout(request.timeoutMs, () => {
        if (!settled) {
          settled = true;
          const error = new CmiTimeoutError(request.timeoutMs);
          reject(error);
          req.destroy(error);
        }
      });
      req.on("error", (error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      });
      const abort = () => {
        if (!settled) {
          settled = true;
          const error = new CmiAbortError();
          reject(error);
          req.destroy(error);
        }
      };
      if ((_a = request.signal) == null ? void 0 : _a.aborted) {
        abort();
        return;
      }
      (_b = request.signal) == null ? void 0 : _b.addEventListener("abort", abort, { once: true });
      req.end();
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CmiAbortError,
  CmiClient,
  CmiHttpError,
  CmiJsonError,
  CmiTimeoutError,
  buildCmiApiUrl,
  redactCredentials
});
//# sourceMappingURL=cmiClient.js.map
