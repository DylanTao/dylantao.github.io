import assert from "node:assert/strict";
import test from "node:test";
import { SHIPPED_LOOK, readLook } from "../assets/js/home-scene/look.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test("no flags keep the shipped look and store nothing", () => {
  const storage = memoryStorage();
  assert.deepEqual(readLook("", storage), { ...SHIPPED_LOOK });
  assert.deepEqual(SHIPPED_LOOK, { tone: "aces", bloom: true, sheen: true });
  assert.equal(storage.values.size, 0);
});

test("URL flags select a preview that persists for the session", () => {
  const storage = memoryStorage();
  assert.deepEqual(readLook("?tone=agx&bloom=1&sheen", storage), { tone: "agx", bloom: true, sheen: true });
  assert.deepEqual(readLook("", storage), { tone: "agx", bloom: true, sheen: true });
  assert.deepEqual(readLook("?bloom=0", storage), { tone: "agx", bloom: false, sheen: true });
  assert.deepEqual(readLook("?look=reset&sheen=0", storage), { tone: "aces", bloom: true, sheen: false });
});

test("reset and unknown values return to the shipped look", () => {
  const storage = memoryStorage();
  readLook("?tone=neutral&sheen=1", storage);
  assert.deepEqual(readLook("?look=reset", storage), { ...SHIPPED_LOOK });
  assert.equal(storage.values.size, 0);
  assert.equal(readLook("?tone=filmic", storage).tone, "aces");
});

test("blocked or corrupt storage still honours the URL", () => {
  const throwing = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  assert.deepEqual(readLook("?tone=neutral", throwing), { tone: "neutral", bloom: true, sheen: true });
  const corrupt = memoryStorage();
  corrupt.setItem("scene-look", "{not json");
  assert.deepEqual(readLook("", corrupt), { ...SHIPPED_LOOK });
  assert.deepEqual(readLook("?bloom=0", null), { tone: "aces", bloom: false, sheen: true });
});
