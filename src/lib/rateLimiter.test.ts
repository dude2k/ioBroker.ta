import { expect } from "chai";
import { CmiRequestQueue } from "./rateLimiter";

describe("CmiRequestQueue", () => {
	it("runs requests sequentially and enforces the minimum spacing", async () => {
		let now = 0;
		const sleeps: number[] = [];
		const events: string[] = [];
		const queue = new CmiRequestQueue(
			100,
			() => now,
			ms => {
				sleeps.push(ms);
				now += ms;
				return Promise.resolve();
			},
		);

		const first = queue.execute(() => {
			events.push("first-start");
			now += 5;
			events.push("first-end");
			return Promise.resolve("first");
		});
		const second = queue.execute(() => {
			events.push("second-start");
			now += 5;
			events.push("second-end");
			return Promise.resolve("second");
		});

		expect(await Promise.all([first, second])).to.deep.equal(["first", "second"]);
		expect(events).to.deep.equal(["first-start", "first-end", "second-start", "second-end"]);
		expect(sleeps).to.deep.equal([100]);
	});

	it("can extend the next allowed request time", async () => {
		let now = 0;
		const sleeps: number[] = [];
		const queue = new CmiRequestQueue(
			100,
			() => now,
			ms => {
				sleeps.push(ms);
				now += ms;
				return Promise.resolve();
			},
		);

		await queue.execute(() => Promise.resolve(undefined));
		queue.extendDelay(250);
		await queue.execute(() => Promise.resolve(undefined));

		expect(sleeps).to.deep.equal([250]);
	});
});
