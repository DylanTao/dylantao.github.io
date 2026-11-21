import test from "node:test";
import assert from "node:assert/strict";
import { decodeStaticLightArrays } from "../assets/js/home-scene/static-light-cache-codec.mjs";
import { packStaticLightSnapshot } from "../bin/coastal_static_light_pack.mjs";

const values = {
  version: 1,
  loungeSolarGeometry: "f".repeat(64),
  transport: [0, 0, 0, -0, 0, -0, Number.MIN_VALUE, -1234.567890123, Math.PI, 0, 0, 0, -0.25, 0.125, -3],
  moments: [0.25, -0, 6, 1, -0, 2 ** -149, -1.5, 0],
};
const unpack = (record) => decodeStaticLightArrays(record, values.transport.length, values.moments.length);

test("v3 writes both probe fields bit-for-bit after serialization, including negative zero", () => {
  const packed = JSON.parse(JSON.stringify(packStaticLightSnapshot(values)));
  const restored = unpack(packed);
  assert.equal(packed.loungeSolarGeometry, values.loungeSolarGeometry);
  assert.equal(packed.version, 3);
  assert.deepEqual(Array.from(restored.transport), values.transport);
  assert.deepEqual(Array.from(restored.moments), values.moments);
  assert.equal(Buffer.from(packed.transport, "base64")[0], 0b10110);
  const onlyZero = packStaticLightSnapshot({ ...values, transport: values.transport.map(() => 0) });
  assert.equal(Buffer.from(onlyZero.transport, "base64").length, 1);
  assert(unpack(onlyZero).transport.every((v) => Object.is(v, 0)));
  assert.throws(() => packStaticLightSnapshot({ ...values, moments: values.moments.map(() => 0.1) }), /changed a lighting value/);
});

test("v3 probing rejects missing words, bad padding, and non-finite shuffled floats", () => {
  const packed = packStaticLightSnapshot(values);
  const mutate = (key, edit) => {
    const b = Buffer.from(packed[key], "base64");
    edit(b);
    return unpack({ ...packed, [key]: b.toString("base64") });
  };
  assert.equal(unpack({ ...packed, transport: packed.transport.slice(4) }), null);
  assert.equal(unpack({ ...packed, moments: packed.moments.slice(0, -4) }), null);
  assert.equal(unpack({ ...packed, transport: "!" + packed.transport.slice(1) }), null);
  assert.equal(
    mutate("transport", (b) => (b[0] |= 0x80)),
    null
  );
  assert.equal(
    mutate("transport", (b) => (b[0] ^= 0b00010)),
    null
  );
  assert.equal(
    mutate("transport", (b) => {
      // Set the high bytes of the first Float64 literal to a quiet NaN.
      b[1 + 6 * 9] = 0xf8;
      b[1 + 7 * 9] = 0x7f;
    }),
    null
  );
  assert.equal(
    mutate("moments", (b) => {
      // The first moment lane contains two values. Turn its first value into +infinity.
      b[4] = 0x80;
      b[6] = 0x7f;
    }),
    null
  );
  assert.equal(unpack({ ...packed, version: 4 }), null);
});
