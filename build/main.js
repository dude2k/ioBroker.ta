"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var utils = __toESM(require("@iobroker/adapter-core"));
var import_cmiClient = require("./lib/cmiClient");
var import_cmiStatus = require("./lib/cmiStatus");
var import_config = require("./lib/config");
var import_objectFactory = require("./lib/objectFactory");
var import_cmiParser = require("./lib/cmiParser");
var import_rateLimiter = require("./lib/rateLimiter");
class Ta extends utils.Adapter {
  cmiClient = new import_cmiClient.CmiClient();
  objectFactory;
  requestQueue;
  configSnapshot;
  stopped = false;
  consecutiveErrors = 0;
  lastSuccessfulPollAt = 0;
  pollPromise;
  sleepTimer;
  sleepResolver;
  recreateObjectsOnNextPoll = false;
  constructor(options = {}) {
    super({
      ...options,
      name: "ta"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    this.stopped = false;
    this.objectFactory = new import_objectFactory.ObjectFactory(this);
    await this.objectFactory.ensureInfoObjects();
    await this.objectFactory.setInfoState("connection", false);
    await this.objectFactory.setInfoState("lastError", "");
    await this.objectFactory.setInfoState("lastStatusCode", 0);
    await this.objectFactory.setInfoState("lastStatusText", (0, import_cmiStatus.getCmiStatusText)(0));
    const config = (0, import_config.normalizeConfig)(this.config);
    this.configSnapshot = config;
    this.requestQueue = new import_rateLimiter.CmiRequestQueue(config.requestSpacingSec * 1e3);
    const enabledNodes = (0, import_config.getEnabledNodes)(config);
    await this.objectFactory.publishEffectiveNodeInterval(enabledNodes.length * config.requestSpacingSec);
    const validation = (0, import_config.validateConfig)(config);
    if (!validation.valid) {
      const message = validation.errors.join(" ");
      this.log.warn(`Adapter configuration incomplete: ${message}`);
      await this.objectFactory.setInfoState("lastError", message);
      return;
    }
    this.log.info(
      `Polling ${enabledNodes.length} C.M.I. node(s) with ${config.requestSpacingSec}s request spacing; effective interval per node is ${enabledNodes.length * config.requestSpacingSec}s.`
    );
    this.pollPromise = this.pollLoop(config);
  }
  onUnload(callback) {
    var _a, _b;
    this.stopped = true;
    (_a = this.requestQueue) == null ? void 0 : _a.stop();
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = void 0;
    }
    (_b = this.sleepResolver) == null ? void 0 : _b.call(this);
    this.sleepResolver = void 0;
    void Promise.resolve(this.pollPromise).catch((error) => {
      if (!(error instanceof import_rateLimiter.QueueStoppedError) && !(error instanceof import_cmiClient.CmiAbortError)) {
        this.log.debug(`Poll loop stopped with error: ${error.message}`);
      }
    }).finally(callback);
  }
  async onMessage(obj) {
    if (typeof obj !== "object" || !obj.command || !obj.callback) {
      return;
    }
    if (obj.command === "testConnection") {
      await this.handleTestConnection(obj);
      return;
    }
    if (obj.command === "recreateObjects") {
      this.recreateObjectsOnNextPoll = true;
      this.sendTo(
        obj.from,
        obj.command,
        { ok: true, message: "Object names will be refreshed after the next successful poll." },
        obj.callback
      );
    }
  }
  async handleTestConnection(obj) {
    var _a;
    const config = (_a = this.configSnapshot) != null ? _a : (0, import_config.normalizeConfig)(this.config);
    const validation = (0, import_config.validateConfig)(config);
    if (!validation.valid) {
      this.sendTo(obj.from, obj.command, { ok: false, message: validation.errors.join(" ") }, obj.callback);
      return;
    }
    const queue = this.requestQueue;
    if (!queue) {
      this.sendTo(obj.from, obj.command, { ok: false, message: "Request queue is not ready." }, obj.callback);
      return;
    }
    const waitSec = Math.ceil(queue.getWaitTimeMs() / 1e3);
    if (queue.isBusy || waitSec > 0) {
      this.sendTo(
        obj.from,
        obj.command,
        {
          ok: false,
          message: `Rate limiter active. Try again in about ${Math.max(waitSec, config.requestSpacingSec)} seconds.`
        },
        obj.callback
      );
      return;
    }
    const node = (0, import_config.getEnabledNodes)(config)[0];
    try {
      const parsed = await this.pollNode(config, node);
      const enabledNodeCount = (0, import_config.getEnabledNodes)(config).length;
      this.sendTo(
        obj.from,
        obj.command,
        {
          ok: parsed.statusCode === 0,
          statusCode: parsed.statusCode,
          statusText: parsed.statusText,
          node: node.node,
          message: parsed.statusCode === 0 ? `Connection successful for CAN node ${node.node}. Regular polling checks ${enabledNodeCount} enabled node(s).` : `CAN node ${node.node}: ${parsed.statusText}`
        },
        obj.callback
      );
    } catch (error) {
      this.sendTo(
        obj.from,
        obj.command,
        {
          ok: false,
          message: this.formatError(error)
        },
        obj.callback
      );
    }
  }
  async pollLoop(config) {
    await this.sleep(config.startupDelaySec * 1e3);
    while (!this.stopped) {
      const nodes = (0, import_config.getEnabledNodes)(config);
      for (const node of nodes) {
        if (this.stopped) {
          return;
        }
        try {
          await this.pollNode(config, node);
        } catch (error) {
          if (this.stopped || error instanceof import_rateLimiter.QueueStoppedError || error instanceof import_cmiClient.CmiAbortError) {
            return;
          }
          await this.handleRequestError(error, config);
        }
      }
    }
  }
  async pollNode(config, node) {
    if (!this.requestQueue || !this.objectFactory) {
      throw new Error("Adapter not initialized.");
    }
    const response = await this.requestQueue.execute(
      (signal) => this.cmiClient.requestNode({
        protocol: config.protocol,
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        timeoutMs: config.timeoutMs,
        rejectUnauthorized: config.rejectUnauthorized,
        node: node.node,
        jsonparam: node.jsonparam,
        useDesignation: node.useDesignation,
        signal
      })
    );
    const now = Date.now();
    const parsed = (0, import_cmiParser.parseCmiResponse)(response.body);
    await this.objectFactory.setInfoState("lastUpdate", now);
    await this.objectFactory.setInfoState("lastStatusCode", parsed.statusCode);
    await this.objectFactory.setInfoState("lastStatusText", parsed.statusText);
    if (parsed.unknownGroups.length > 0) {
      this.log.warn(`C.M.I. returned unknown group(s): ${parsed.unknownGroups.join(", ")}`);
    }
    if (parsed.statusCode !== 0) {
      await this.handleCmiStatus(parsed, config, node);
      return parsed;
    }
    await this.objectFactory.publishParsedNode(
      {
        node: node.node,
        name: node.name,
        useDesignation: node.useDesignation,
        forceNameRefresh: this.recreateObjectsOnNextPoll,
        createRawJson: node.createRawJson
      },
      parsed,
      node.createRawJson ? response.rawBody : void 0
    );
    this.consecutiveErrors = 0;
    this.lastSuccessfulPollAt = now;
    this.recreateObjectsOnNextPoll = false;
    await this.objectFactory.setInfoState("connection", true);
    await this.objectFactory.setInfoState("lastSuccessfulUpdate", now);
    await this.objectFactory.setInfoState("lastError", "");
    return parsed;
  }
  async handleCmiStatus(parsed, config, node) {
    if (!this.objectFactory || !this.requestQueue) {
      return;
    }
    const statusText = parsed.statusText || (0, import_cmiStatus.getCmiStatusText)(parsed.statusCode);
    const nodeStatusText = `CAN node ${node.node}: ${statusText} (status code ${parsed.statusCode})`;
    if (this.lastSuccessfulPollAt === 0) {
      await this.objectFactory.setInfoState("connection", false);
    }
    await this.objectFactory.setInfoState("lastError", nodeStatusText);
    this.log.warn(nodeStatusText);
    if (parsed.statusCode === 4) {
      this.log.warn("C.M.I. reported TOO MANY REQUESTS. Increasing request spacing temporarily.");
      this.requestQueue.extendDelay(config.requestSpacingSec * 2e3);
      return;
    }
    if (parsed.statusCode === 7) {
      this.log.warn("C.M.I. reported CAN BUSY. Delaying the next request.");
      this.requestQueue.extendDelay(config.retryDelaySec * 1e3);
      return;
    }
    if ((0, import_cmiStatus.isBackoffStatus)(parsed.statusCode)) {
      this.requestQueue.extendDelay(config.retryDelaySec * 1e3);
    }
  }
  async handleRequestError(error, config) {
    if (!this.objectFactory) {
      return;
    }
    const message = this.formatError(error);
    this.consecutiveErrors += 1;
    await this.objectFactory.setInfoState("connection", false);
    await this.objectFactory.setInfoState("lastError", message);
    await this.objectFactory.setInfoState("lastStatusCode", error instanceof import_cmiClient.CmiHttpError ? error.statusCode : -1);
    await this.objectFactory.setInfoState("lastStatusText", message);
    if (this.consecutiveErrors >= config.maxConsecutiveErrors) {
      this.log.warn(`${this.consecutiveErrors} consecutive C.M.I. polling errors: ${message}`);
    } else {
      this.log.debug(`C.M.I. polling failed: ${message}`);
    }
    await this.sleep(config.retryDelaySec * 1e3);
  }
  formatError(error) {
    if (error instanceof import_cmiClient.CmiHttpError || error instanceof import_cmiClient.CmiTimeoutError || error instanceof import_cmiClient.CmiJsonError) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
  async sleep(ms) {
    if (ms <= 0 || this.stopped) {
      return;
    }
    await new Promise((resolve) => {
      this.sleepResolver = resolve;
      this.sleepTimer = setTimeout(() => {
        this.sleepTimer = void 0;
        this.sleepResolver = void 0;
        resolve();
      }, ms);
    });
  }
}
if (require.main !== module) {
  module.exports = (options) => new Ta(options);
} else {
  (() => new Ta())();
}
//# sourceMappingURL=main.js.map
