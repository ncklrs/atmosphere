import SunCalc from "suncalc";
export type AmbientScene =
  | "AMBIENT_DAY"
  | "AMBIENT_DUSK"
  | "AMBIENT_NIGHT"
  | "SLEEP";
export interface CircadianConfig {
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  sunriseOffsetMin: number;
  duskOffsetMin: number;
  nightOffsetMin: number;
  sleep: string;
  wake: string;
  musicWake: boolean;
  transitionMin: number;
}
export interface SceneOverride {
  scene: AmbientScene;
  expiresAt: number;
}
export const defaultCircadian: CircadianConfig = {
  latitude: null,
  longitude: null,
  timezone: "America/New_York",
  sunriseOffsetMin: 30,
  duskOffsetMin: -45,
  nightOffsetMin: 90,
  sleep: "23:30",
  wake: "06:30",
  musicWake: true,
  transitionMin: 20,
};
export function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (key: string) =>
    Number(parts.find((p) => p.type === key)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    minute: part("hour") * 60 + part("minute"),
  };
}
export const validTime = (value: string) =>
  /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const minute = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const targets: Record<AmbientScene, number> = {
  AMBIENT_DAY: 0.65,
  AMBIENT_DUSK: 0.35,
  AMBIENT_NIGHT: 0.12,
  SLEEP: 0,
};
interface Transition {
  at: number;
  scene: AmbientScene;
  from: number;
  to: number;
}
function zonedNoon(
  civil: { year: number; month: number; day: number },
  timezone: string,
) {
  let noon = new Date(Date.UTC(civil.year, civil.month - 1, civil.day, 12));
  for (let i = 0; i < 3; i++) {
    const observed = localParts(noon, timezone);
    const dateDelta =
      (Date.UTC(civil.year, civil.month - 1, civil.day) -
        Date.UTC(observed.year, observed.month - 1, observed.day)) /
      60000;
    noon = new Date(
      noon.getTime() + (720 - observed.minute + dateDelta) * 60000,
    );
  }
  return noon;
}
export function schedule(
  now: Date,
  config: CircadianConfig,
  override?: SceneOverride | null,
  playing = false,
) {
  const local = localParts(now, config.timezone);
  const m = local.minute;
  let day = 480,
    dusk = 1080,
    night = 1260,
    solar = false;
  let axis = m;
  let transitions: Transition[] = [
    { at: day, scene: "AMBIENT_DAY", from: 0.12, to: 0.65 },
    { at: dusk, scene: "AMBIENT_DUSK", from: 0.65, to: 0.35 },
    { at: night, scene: "AMBIENT_NIGHT", from: 0.35, to: 0.12 },
  ];
  let transitionLength = config.transitionMin;
  if (
    config.latitude !== null &&
    config.longitude !== null &&
    Math.abs(config.latitude) <= 90 &&
    Math.abs(config.longitude) <= 180
  ) {
    const noon = zonedNoon(local, config.timezone);
    const times = SunCalc.getTimes(noon, config.latitude, config.longitude);
    if (
      Number.isFinite(times.sunrise.getTime()) &&
      Number.isFinite(times.sunset.getTime())
    ) {
      solar = true;
      day =
        localParts(times.sunrise, config.timezone).minute +
        config.sunriseOffsetMin;
      dusk =
        localParts(times.sunset, config.timezone).minute + config.duskOffsetMin;
      night =
        localParts(times.sunset, config.timezone).minute +
        config.nightOffsetMin;
      // Use absolute solar instants across adjacent civil dates so offsets may cross midnight.
      transitions = [];
      for (const offset of [-1, 0, 1]) {
        const civil = new Date(
          Date.UTC(local.year, local.month - 1, local.day + offset),
        );
        const solarDay = SunCalc.getTimes(
          zonedNoon(
            {
              year: civil.getUTCFullYear(),
              month: civil.getUTCMonth() + 1,
              day: civil.getUTCDate(),
            },
            config.timezone,
          ),
          config.latitude,
          config.longitude,
        );
        if (
          !Number.isFinite(solarDay.sunrise.getTime()) ||
          !Number.isFinite(solarDay.sunset.getTime())
        )
          continue;
        transitions.push(
          {
            at: solarDay.sunrise.getTime() + config.sunriseOffsetMin * 60000,
            scene: "AMBIENT_DAY",
            from: 0.12,
            to: 0.65,
          },
          {
            at: solarDay.sunset.getTime() + config.duskOffsetMin * 60000,
            scene: "AMBIENT_DUSK",
            from: 0.65,
            to: 0.35,
          },
          {
            at: solarDay.sunset.getTime() + config.nightOffsetMin * 60000,
            scene: "AMBIENT_NIGHT",
            from: 0.35,
            to: 0.12,
          },
        );
      }
      axis = now.getTime();
      transitionLength *= 60000;
    }
  }
  transitions.sort((a, b) => a.at - b.at);
  const selected = transitions.filter((event) => event.at <= axis).at(-1);
  const sleep = minute(config.sleep),
    wake = minute(config.wake);
  const asleep = sleep > wake ? m >= sleep || m < wake : m >= sleep && m < wake;
  const overridden = !!override && override.expiresAt > now.getTime();
  const scene: AmbientScene = overridden
    ? override.scene
    : asleep
      ? "SLEEP"
      : (selected?.scene ?? "AMBIENT_NIGHT");
  let intensity = targets[scene];
  if (
    !overridden &&
    !asleep &&
    selected &&
    axis < selected.at + transitionLength
  ) {
    const f = Math.max(0, Math.min(1, (axis - selected.at) / transitionLength));
    intensity =
      selected.from + (selected.to - selected.from) * (f * f * (3 - 2 * f));
  }
  if (playing && config.musicWake && scene === "SLEEP") intensity = 0.12;
  return {
    scene,
    intensity,
    solar,
    musicAwake: playing && config.musicWake,
    day,
    dusk,
    night,
  };
}
