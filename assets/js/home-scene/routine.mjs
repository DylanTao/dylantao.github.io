import { poolActivityRoom } from "./pool-activity.mjs";
import { trainingAt } from "./training.mjs";

// Pure clock/state functions. The scene follows an authored routine, never telemetry.
export function pacificClock(date, timeZone = "America/Los_Angeles") {
  const fields = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value])
  );
  return {
    minute: Number(fields.hour) * 60 + Number(fields.minute),
    weekend: fields.weekday === "Sat" || fields.weekday === "Sun",
    dateKey: `${fields.year}-${fields.month}-${fields.day}`,
  };
}

export function resolveRoutine(config, date = new Date(), preview = null) {
  const clock = pacificClock(date, config.timeZone);
  const minute = preview?.minute == null ? clock.minute : Math.max(0, Math.min(1439, Number(preview.minute) || 0));
  const schedule = clock.weekend ? config.weekend : config.weekday;
  let id = schedule[0][1],
    slot = 0;
  schedule.forEach(([start, activity], index) => {
    if (minute >= start) {
      id = activity;
      slot = index;
    }
  });
  // The gym slot follows the training program: a rest day (Sundays, and the days the body asked
  // for) becomes downtime, and the session ends when its last set and note are done, so the next
  // activity starts early instead of an hour of standing around.
  const asked = Boolean(preview?.activity && config.activities[preview.activity]);
  let training = null;
  if (config.training && (asked ? preview.activity === "workout" : id === "workout")) {
    training = trainingAt(config.training, clock.dateKey, minute, 0, { force: asked });
    if (!asked) {
      if (!training.plan) id = config.training.restActivity;
      else if (minute >= training.endMinute) id = schedule[Math.min(slot + 1, schedule.length - 1)][1];
      if (id !== "workout") training = null;
    }
  }
  if (asked) id = preview.activity;
  const activity = config.activities[id];
  const dayHash = [...clock.dateKey].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 0) >>> 0;
  const drink = ["whiskey", "cocktail", "beer", "coffee"][dayHash % 4];
  const station = id === "lounge" && drink === "whiskey" && config.furniture?.find((a) => a.id === activity.whiskeyStation);
  const palette = minute < 300 || minute >= 1200 ? "evening" : minute < 660 ? "morning" : minute < 900 ? "noon" : "afternoon";
  return {
    ...activity,
    ...(station ? { room: station.room, station: station.id } : {}),
    ...clock,
    minute,
    id,
    clip: station || (id === "lounge" && minute % 6 >= 2) ? "lounge" : activity.clip,
    prop: activity.prop === "evening" ? drink : activity.prop,
    palette,
    live: preview === null,
    training,
  };
}

// A routine may occupy a furniture station without moving the room's public visit spot.
export function routineRoom(config, routine) {
  if (routine?.sequence === "pool") return poolActivityRoom(config, routine.room);
  const room = config?.rooms?.find((r) => r.id === routine?.room);
  const station = routine?.station && config?.furniture?.find((a) => a.id === routine.station && a.room === room?.id);
  return station ? { ...room, actor: [...station.position], facing: station.yaw || 0, walkActor: undefined, bedTransfer: undefined } : room;
}

export function formatMinute(minute) {
  const hour = Math.floor(minute / 60);
  return `${hour % 12 || 12}:${String(minute % 60).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

export function createExplorationState() {
  let preview = null;
  let following = true;
  return {
    get preview() {
      return preview;
    },
    get following() {
      return following;
    },
    explore() {
      following = false;
    },
    setTime(minute) {
      preview = { minute };
      following = false;
    },
    setActivity(activity, minute) {
      preview = { activity, minute };
      following = false;
    },
    now() {
      preview = null;
      following = true;
    },
  };
}
// A new arrival on refresh; changing view or material keeps this same person.
export function chooseArrivalAvatar(ids, previous, random = Math.random) {
  const choices = ids.filter((id) => id !== previous);
  const pool = choices.length ? choices : ids;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
