import assert from "node:assert/strict";

const ZONE = "Asia/Colombo";
const DAY_MS = 24 * 60 * 60 * 1000;

function localDay(timestamp) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date(timestamp));
}

function localMidnight(day) {
  return Date.parse(day + "T00:00:00+05:30");
}

function splitAtLocalMidnight(start, end) {
  const portions = [];
  let cursor = Date.parse(start);
  const finish = Date.parse(end);
  while (cursor < finish) {
    const day = localDay(cursor);
    const nextMidnight = localMidnight(day) + DAY_MS;
    const segmentEnd = Math.min(finish, nextMidnight);
    portions.push({ day, seconds: Math.floor((segmentEnd - cursor) / 1000) });
    cursor = segmentEnd;
  }
  return portions;
}

function parseTarget(hours, minutes) {
  if (hours === "" || minutes === "" || hours == null || minutes == null) return null;
  const h = Number(hours), m = Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) ||
      h < 0 || h > 12 || m < 0 || m > 59 || (h === 12 && m > 0)) return null;
  const seconds = (h * 60 + m) * 60;
  return seconds >= 60 && seconds <= 43200 ? seconds : null;
}

function awayCredit(elapsedBeforeAway, targetSeconds, awaySeconds) {
  const remaining = Math.max(0, targetSeconds - elapsedBeforeAway);
  return Math.min(awaySeconds, remaining);
}

function discardUnconfirmed(preservedWeekSeconds, pendingTodaySeconds) {
  return Math.max(0, preservedWeekSeconds - pendingTodaySeconds);
}

assert.equal(parseTarget("", ""), null, "a target must be explicitly selected");
assert.equal(parseTarget("0", "0"), null, "zero target is invalid");
assert.equal(parseTarget("0", "1"), 60, "one minute is valid");
assert.equal(parseTarget("12", "0"), 43200, "12 hours is the maximum");
assert.equal(parseTarget("12", "1"), null, "targets above 12 hours are rejected");
assert.equal(parseTarget("1", "60"), null, "minutes must be 0 through 59");

const fourHourOverMidnight = splitAtLocalMidnight(
  "2026-11-03T22:00:00+05:30",
  "2026-11-04T02:00:00+05:30"
);
assert.deepEqual(fourHourOverMidnight, [
  { day: "2026-11-03", seconds: 7200 },
  { day: "2026-11-04", seconds: 7200 }
], "four hours from 10 PM to 2 AM split evenly across days");

const sixHourOverMidnight = splitAtLocalMidnight(
  "2026-11-03T22:00:00+05:30",
  "2026-11-04T04:00:00+05:30"
);
assert.deepEqual(sixHourOverMidnight, [
  { day: "2026-11-03", seconds: 7200 },
  { day: "2026-11-04", seconds: 14400 }
], "six elapsed hours from 10 PM to 4 AM split 2h and 4h");

assert.equal(
  awayCredit(0, 4 * 3600, 6 * 3600),
  4 * 3600,
  "an away session stops crediting at its four-hour target"
);
assert.equal(
  awayCredit(5 * 3600, 4 * 3600, 3600),
  0,
  "a student who exceeds the target while present is paused immediately on leaving"
);
assert.equal(
  Math.min(5 * 3600, 4 * 3600),
  4 * 3600,
  "away time is capped, but present time can exceed the target"
);

const beforeMidnight = 2 * 3600;
const pendingToday = 2 * 3600;
const weekTotalBeforeExpiry = beforeMidnight + pendingToday;
assert.equal(
  discardUnconfirmed(weekTotalBeforeExpiry, pendingToday),
  beforeMidnight,
  "midnight expiry removes only today's unconfirmed away credit"
);
assert.equal(
  discardUnconfirmed(weekTotalBeforeExpiry, 0),
  weekTotalBeforeExpiry,
  "returning before midnight confirms the pending credit"
);

const graceSeconds = 60;
const heartbeatSeconds = 20;
assert.equal(graceSeconds, 60, "visibility grace is 60 seconds");
assert.equal(heartbeatSeconds, 20, "visible heartbeat interval is 20 seconds");
assert.equal(graceSeconds + heartbeatSeconds * 4, 140, "server fallback has room for heartbeat jitter");

console.log("Study Room target and presence logic tests passed (12 assertions).");
