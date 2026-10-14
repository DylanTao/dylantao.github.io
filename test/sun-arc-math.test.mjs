import assert from "node:assert/strict";
import test from "node:test";
import { MODE_MINUTE, formatMinute, isNight, minuteToPoint, modeForMinute, pointToMinute, skyColor, wrapMinute } from "../assets/js/sun-arc-math.mjs";

test("theme modes keep theme.js's boundaries (5, 11, 15, 20 o'clock)", () => {
  assert.equal(modeForMinute(299), "evening");
  assert.equal(modeForMinute(300), "morning");
  assert.equal(modeForMinute(659), "morning");
  assert.equal(modeForMinute(660), "noon");
  assert.equal(modeForMinute(899), "noon");
  assert.equal(modeForMinute(900), "afternoon");
  assert.equal(modeForMinute(1199), "afternoon");
  assert.equal(modeForMinute(1200), "evening");
  for (const [mode, minute] of Object.entries(MODE_MINUTE)) assert.equal(modeForMinute(minute), mode);
});

test("every minute maps to the arc and back", () => {
  for (let minute = 0; minute < 1440; minute += 7) {
    const { x, y } = minuteToPoint(minute);
    assert.equal(pointToMinute(x, y), minute, `minute ${minute}`);
    if (minute === 300 || minute === 1200) continue;
    assert.equal(y > 82, isNight(minute), `minute ${minute} sits on the ${isNight(minute) ? "night" : "day"} arc`);
  }
});

test("day rides above the horizon, night below, noon at the top", () => {
  assert.ok(minuteToPoint(750).y < minuteToPoint(480).y);
  assert.ok(minuteToPoint(720).y < 82 && minuteToPoint(60).y > 82);
  assert.ok(minuteToPoint(480).x < 120 && minuteToPoint(1020).x > 120);
});

test("labels, wrapping and sky colors stay in range", () => {
  assert.equal(formatMinute(0), "12:00 am");
  assert.equal(formatMinute(750), "12:30 pm");
  assert.equal(formatMinute(1439), "11:59 pm");
  assert.equal(wrapMinute(-15), 1425);
  assert.equal(wrapMinute(1445), 5);
  for (let minute = 0; minute < 1440; minute += 30) for (const channel of skyColor(minute)) assert.ok(channel >= 0 && channel <= 255);
  assert.notDeepEqual(skyColor(750), skyColor(1320));
});
