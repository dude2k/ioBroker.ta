import { expect } from "chai";
import { getRoleForValue, getUnitMeta, normalizeValue } from "./units";

describe("units", () => {
	it("maps temperature unit IDs to unit and role", () => {
		expect(getUnitMeta(1)).to.include({ unit: "°C", role: "value.temperature" });
		expect(getUnitMeta(46)).to.include({ unit: "°C", role: "value.temperature" });
	});

	it("maps power and energy roles", () => {
		expect(getUnitMeta(69)).to.include({ unit: "W", role: "value.power" });
		expect(getUnitMeta(10)).to.include({ unit: "kW", role: "value.power" });
		expect(getUnitMeta(11)).to.include({ unit: "kWh", role: "value.energy" });
		expect(getUnitMeta(12)).to.include({ unit: "MWh", role: "value.energy" });
	});

	it("maps digital unit IDs to read-only sensor roles", () => {
		expect(getUnitMeta(43)).to.include({ role: "sensor.switch", boolean: true });
		expect(normalizeValue("ON", undefined, 43)).to.equal(true);
		expect(normalizeValue("NO", undefined, 44)).to.equal(false);
		expect(normalizeValue("OPEN", undefined, 78)).to.equal(true);
	});

	it("uses sensible fallback roles", () => {
		expect(getRoleForValue(true, undefined)).to.equal("sensor");
		expect(getRoleForValue(1, undefined)).to.equal("value");
		expect(getRoleForValue("text", undefined)).to.equal("text");
	});
});
