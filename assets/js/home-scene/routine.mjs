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
  let id = schedule[0][1];
  for (const [start, activity] of schedule) {
    if (minute >= start) id = activity;
  }
  if (preview?.activity && config.activities[preview.activity]) id = preview.activity;
  const activity = config.activities[id];
  const dayHash = [...clock.dateKey].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 0) >>> 0;
  const drink = ["whiskey", "cocktail", "beer", "coffee"][dayHash % 4];
  const palette = minute < 300 || minute >= 1200 ? "evening" : minute < 660 ? "morning" : minute < 900 ? "noon" : "afternoon";
  return {
    ...activity,
    ...clock,
    minute,
    id,
    clip: id === "lounge" && minute % 6 >= 2 ? "lounge" : activity.clip,
    prop: activity.prop === "evening" ? drink : activity.prop,
    palette,
    live: preview === null,
  };
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
