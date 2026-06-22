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
var rateLimiter_exports = {};
__export(rateLimiter_exports, {
  CmiRequestQueue: () => CmiRequestQueue,
  QueueStoppedError: () => QueueStoppedError,
  defaultSleep: () => defaultSleep
});
module.exports = __toCommonJS(rateLimiter_exports);
class QueueStoppedError extends Error {
  constructor() {
    super("Request queue stopped");
    this.name = "QueueStoppedError";
  }
}
const defaultSleep = (ms, signal) => new Promise((resolve, reject) => {
  if (ms <= 0) {
    resolve();
    return;
  }
  if (signal == null ? void 0 : signal.aborted) {
    reject(new QueueStoppedError());
    return;
  }
  const abortRef = {};
  const timeout = setTimeout(() => {
    if (abortRef.handler) {
      signal == null ? void 0 : signal.removeEventListener("abort", abortRef.handler);
    }
    resolve();
  }, ms);
  const abort = () => {
    clearTimeout(timeout);
    signal == null ? void 0 : signal.removeEventListener("abort", abort);
    reject(new QueueStoppedError());
  };
  abortRef.handler = abort;
  signal == null ? void 0 : signal.addEventListener("abort", abort, { once: true });
});
class CmiRequestQueue {
  constructor(spacingMs, now = () => Date.now(), sleep = defaultSleep) {
    this.spacingMs = spacingMs;
    this.now = now;
    this.sleep = sleep;
  }
  nextAllowedRequestAt = 0;
  tail = Promise.resolve();
  stopped = false;
  currentController;
  running = false;
  get isBusy() {
    return this.running;
  }
  getWaitTimeMs() {
    return Math.max(0, this.nextAllowedRequestAt - this.now());
  }
  extendDelay(delayMs) {
    this.nextAllowedRequestAt = Math.max(this.nextAllowedRequestAt, this.now() + Math.max(0, delayMs));
  }
  async execute(task) {
    if (this.stopped) {
      throw new QueueStoppedError();
    }
    const run = async () => {
      if (this.stopped) {
        throw new QueueStoppedError();
      }
      const waitMs = this.getWaitTimeMs();
      const controller = new AbortController();
      this.currentController = controller;
      if (waitMs > 0) {
        await this.sleep(waitMs, controller.signal);
      }
      if (this.stopped) {
        throw new QueueStoppedError();
      }
      this.running = true;
      try {
        return await task(controller.signal);
      } finally {
        this.running = false;
        this.currentController = void 0;
        this.nextAllowedRequestAt = this.now() + this.spacingMs;
      }
    };
    const result = this.tail.then(run, run);
    this.tail = result.then(
      () => void 0,
      () => void 0
    );
    return result;
  }
  stop() {
    var _a;
    this.stopped = true;
    (_a = this.currentController) == null ? void 0 : _a.abort();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CmiRequestQueue,
  QueueStoppedError,
  defaultSleep
});
//# sourceMappingURL=rateLimiter.js.map
