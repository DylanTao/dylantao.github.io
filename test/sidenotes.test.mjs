import test from "node:test";
import assert from "node:assert/strict";
import { placeNotes } from "../assets/js/sidenotes.mjs";
test("margin notes stay beside their references unless the preceding note needs room", () => {
  assert.deepEqual(
    placeNotes([
      { anchor: 60, height: 100 },
      { anchor: 80, height: 70 },
      { anchor: 400, height: 90 },
    ]),
    [60, 180, 400]
  );
  assert.deepEqual(placeNotes([]), []);
});
