import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { pinArrivalAvatar } = require("../bin/coastal_probe_avatar.cjs");

test("probe conditioning pins a real arrival independently of random draws and parameter mangling", () => {
  for (const source of [
    "function chooseArrivalAvatar(ids, previous, random = Math.random) { return ids[Math.floor(random()*ids.length)]; }",
    "function chooseArrivalAvatar(a,b,c=Math.random){return a[c()*a.length|0]}",
  ]) {
    const select = new Function(`${pinArrivalAvatar(source, "lizard")}; return chooseArrivalAvatar;`)();
    assert.equal(
      select(["simpsons", "lizard"], null, () => 0),
      "lizard"
    );
    assert.equal(
      select(["simpsons", "lizard"], "lizard", () => 0.9),
      "lizard"
    );
    assert.throws(() => select(["simpsons"]), /unavailable/);
  }
});

test("probe conditioning fails closed when a selector or identity cannot be verified", () => {
  assert.throws(() => pinArrivalAvatar("function renamed() {}", "lizard"), /Expected one/);
  assert.throws(() => pinArrivalAvatar("function chooseArrivalAvatar(){} function chooseArrivalAvatar(){}", "lizard"), /found 2/);
  assert.throws(() => pinArrivalAvatar("function chooseArrivalAvatar(){}", 'lizard";'), /Invalid/);
});
