export type SleepFunction = (ms: number, signal?: AbortSignal) => Promise<void>;
export type NowFunction = () => number;

export class QueueStoppedError extends Error {
	public constructor() {
		super("Request queue stopped");
		this.name = "QueueStoppedError";
	}
}

export const defaultSleep: SleepFunction = (ms, signal) =>
	new Promise<void>((resolve, reject) => {
		if (ms <= 0) {
			resolve();
			return;
		}
		if (signal?.aborted) {
			reject(new QueueStoppedError());
			return;
		}

		const abortRef: { handler?: () => void } = {};
		const timeout = setTimeout(() => {
			if (abortRef.handler) {
				signal?.removeEventListener("abort", abortRef.handler);
			}
			resolve();
		}, ms);

		const abort = (): void => {
			clearTimeout(timeout);
			signal?.removeEventListener("abort", abort);
			reject(new QueueStoppedError());
		};
		abortRef.handler = abort;

		signal?.addEventListener("abort", abort, { once: true });
	});

export class CmiRequestQueue {
	private nextAllowedRequestAt = 0;
	private tail: Promise<void> = Promise.resolve();
	private stopped = false;
	private currentController?: AbortController;
	private running = false;

	public constructor(
		private readonly spacingMs: number,
		private readonly now: NowFunction = () => Date.now(),
		private readonly sleep: SleepFunction = defaultSleep,
	) {}

	public get isBusy(): boolean {
		return this.running;
	}

	public getWaitTimeMs(): number {
		return Math.max(0, this.nextAllowedRequestAt - this.now());
	}

	public extendDelay(delayMs: number): void {
		this.nextAllowedRequestAt = Math.max(this.nextAllowedRequestAt, this.now() + Math.max(0, delayMs));
	}

	public async execute<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T> {
		if (this.stopped) {
			throw new QueueStoppedError();
		}

		const run = async (): Promise<T> => {
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
				this.currentController = undefined;
				this.nextAllowedRequestAt = this.now() + this.spacingMs;
			}
		};

		const result = this.tail.then(run, run);
		this.tail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	public stop(): void {
		this.stopped = true;
		this.currentController?.abort();
	}
}
