import { describe, expect, it } from "vitest";
import {
  defaultCircadian,
  localParts,
  schedule,
} from "../packages/circadian/index";
import { validateSettings } from "../apps/web/lib/settings";
describe("circadian clock", () => {
  it("keeps dusk across midnight when sunset offsets cross the date boundary", () => {
    const result = schedule(new Date("2026-06-21T22:02:00Z"), {
      ...defaultCircadian,
      timezone: "Europe/Oslo",
      latitude: 59.91,
      longitude: 10.75,
      sleep: "03:00",
      wake: "04:00",
    });
    expect(result.solar).toBe(true);
    expect(result.scene).toBe("AMBIENT_DUSK");
  });
  const config = { ...defaultCircadian, timezone: "America/New_York" };
  it("sleeps across midnight and wakes in local civil time", () => {
    expect(schedule(new Date("2026-10-31T03:45:00Z"), config).scene).toBe(
      "SLEEP",
    );
    expect(schedule(new Date("2026-10-31T04:15:00Z"), config).scene).toBe(
      "SLEEP",
    );
    expect(schedule(new Date("2026-10-31T10:30:00Z"), config).scene).toBe(
      "AMBIENT_NIGHT",
    );
  });
  it("uses local time correctly over both DST transitions", () => {
    expect(
      localParts(new Date("2026-03-08T06:59:00Z"), config.timezone).minute,
    ).toBe(119);
    expect(
      localParts(new Date("2026-03-08T07:00:00Z"), config.timezone).minute,
    ).toBe(180);
    expect(
      localParts(new Date("2026-11-01T05:30:00Z"), config.timezone).minute,
    ).toBe(90);
    expect(
      localParts(new Date("2026-11-01T06:30:00Z"), config.timezone).minute,
    ).toBe(90);
  });
  it("applies and expires overrides; music wake does not claim panel control", () => {
    const now = new Date("2026-10-31T04:00:00Z");
    const override = {
      scene: "AMBIENT_DAY" as const,
      expiresAt: now.getTime() + 1000,
    };
    expect(schedule(now, config, override).scene).toBe("AMBIENT_DAY");
    expect(
      schedule(new Date(now.getTime() + 1001), config, override).scene,
    ).toBe("SLEEP");
    expect(schedule(now, config, null, true)).toMatchObject({
      scene: "SLEEP",
      musicAwake: true,
      intensity: 0.12,
    });
    expect(
      schedule(now, { ...config, musicWake: false }, null, true).intensity,
    ).toBe(0);
  });
  it("smoothly interpolates fallback intensity", () => {
    expect(schedule(new Date("2026-10-30T22:00:00Z"), config).intensity).toBe(
      0.65,
    );
    expect(
      schedule(new Date("2026-10-30T22:10:00Z"), config).intensity,
    ).toBeCloseTo(0.5);
    expect(schedule(new Date("2026-10-30T22:20:00Z"), config).intensity).toBe(
      0.35,
    );
  });
  it("uses solar events and falls back at polar latitudes", () => {
    expect(
      schedule(new Date("2026-10-30T16:00Z"), {
        ...config,
        latitude: 40.7,
        longitude: -74,
      }).solar,
    ).toBe(true);
    expect(
      schedule(new Date("2026-06-21T16:00Z"), {
        ...config,
        latitude: 90,
        longitude: 0,
      }).solar,
    ).toBe(false);
  });
  it("handles date boundaries in remote timezones", () => {
    const result = schedule(new Date("2026-10-30T22:00Z"), {
      ...config,
      timezone: "Pacific/Auckland",
      latitude: -36.85,
      longitude: 174.76,
    });
    expect(result.solar).toBe(true);
    expect(result.day).toBeGreaterThan(240);
    expect(result.day).toBeLessThan(600);
  });
  it("validates persisted settings before use", () => {
    expect(
      validateSettings({
        circadian: { timezone: "bad", latitude: NaN, sleep: "25:99" },
        calibrationMs: 99999,
        intensity: "bad",
      }),
    ).toMatchObject({
      intensity: "Flow",
      calibrationMs: 5000,
      circadian: {
        timezone: "America/New_York",
        latitude: null,
        sleep: "23:30",
      },
    });
  });
});
