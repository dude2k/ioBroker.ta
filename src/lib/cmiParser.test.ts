import { expect } from "chai";
import fixture from "../../test/fixtures/cmi-success.json";
import { getDeviceName, normalizeDeviceId, parseCmiResponse, resolveGroup, sanitizeIdPart } from "./cmiParser";

describe("cmiParser", () => {
	it("maps known device IDs", () => {
		expect(normalizeDeviceId("8b")).to.equal("8B");
		expect(getDeviceName("87")).to.equal("UVR16x2");
		expect(getDeviceName("8B")).to.equal("CAN-EZ2");
	});

	it("parses inputs, outputs and analog output state", () => {
		const parsed = parseCmiResponse(fixture);

		expect(parsed.statusCode).to.equal(0);
		expect(parsed.header).to.deep.include({
			apiVersion: "1.38",
			deviceId: "87",
			deviceName: "UVR16x2",
			timestamp: "2026-06-22 14:00:00",
		});
		expect(parsed.points).to.have.length(3);
		expect(parsed.points[0]).to.deep.include({
			groupId: "input",
			number: 1,
			ad: "A",
			designation: "Collector temperature",
			value: 42.4,
			unitId: 1,
		});
		expect(parsed.points[1]).to.deep.include({
			groupId: "output",
			number: 1,
			designation: "Solar pump",
			value: 55,
			unitId: 8,
			state: 1,
		});
	});

	it("parses designations and RAS values", () => {
		const parsed = parseCmiResponse(fixture);
		const loggingPoint = parsed.points.find(point => point.groupId === "logging_analog");

		expect(loggingPoint).to.deep.include({
			designation: "Log value",
			ras: 2,
		});
	});

	it("keeps unknown groups as sanitized stable IDs", () => {
		const parsed = parseCmiResponse({
			"Status code": 0,
			Data: {
				"Future Group": [{ Number: 3, Value: { Value: 7, Unit: 69 } }],
			},
		});

		expect(parsed.unknownGroups).to.deep.equal(["future_group"]);
		expect(parsed.points[0]).to.deep.include({ groupId: "future_group", number: 3, value: 7 });
	});

	it("does not expose points for non-OK C.M.I. status codes", () => {
		const parsed = parseCmiResponse({ "Status code": 4, Data: { Inputs: [{ Number: 1, Value: { Value: 1 } }] } });

		expect(parsed.statusCode).to.equal(4);
		expect(parsed.statusText).to.equal("TOO MANY REQUESTS");
		expect(parsed.points).to.deep.equal([]);
	});

	it("resolves and sanitizes object ID fragments", () => {
		expect(resolveGroup("Sg1")).to.deep.equal({ id: "system_general", name: "System general", known: true });
		expect(sanitizeIdPart("Future Group! 1")).to.equal("future_group_1");
	});

	it("maps plain C.M.I. system group names", () => {
		expect(resolveGroup("general")).to.deep.equal({ id: "system_general", name: "System general", known: true });
		expect(resolveGroup("date")).to.deep.equal({ id: "system_date", name: "System date", known: true });
		expect(resolveGroup("time")).to.deep.equal({ id: "system_time", name: "System time", known: true });
		expect(resolveGroup("sun")).to.deep.equal({ id: "system_sun", name: "System sun", known: true });
	});
});
