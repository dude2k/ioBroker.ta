import { expect } from "chai";
import { buildNodeId, buildPointChannelId } from "./objectFactory";

describe("objectFactory", () => {
	it("builds stable node and datapoint IDs", () => {
		expect(buildNodeId(1)).to.equal("node_001");
		expect(buildNodeId(12)).to.equal("node_012");
		expect(
			buildPointChannelId({
				groupName: "Input",
				groupId: "input",
				number: 1,
				value: 42,
			}),
		).to.equal("input_001");
	});
});
