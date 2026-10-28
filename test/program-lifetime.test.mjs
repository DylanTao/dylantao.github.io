import test from "node:test";
import assert from "node:assert/strict";
import { compileOwnedPrograms, retireCompiledMaterials } from "../assets/js/home-scene/program-lifetime.mjs";

function fixture(program) {
  const material = {};
  return {
    compile: () => new Set([material]),
    properties: { get: () => ({ currentProgram: program }) },
    getContext: () => ({ isContextLost: () => false }),
  };
}

test("an avatar's retired shader handle is never queried after material disposal", async () => {
  let polls = 0;
  const program = {
    program: {},
    isReady() {
      assert.ok(this.program, "a deleted WebGL program must not be polled");
      polls++;
      return false;
    },
  };
  const pending = compileOwnedPrograms(fixture(program), {}, {}, {});
  program.program = undefined;
  assert.equal(await pending, false);
  assert.equal(polls, 1);
});

test("live programs finish and an interrupted avatar prepare stops polling", async () => {
  let ready = false,
    current = true,
    polls = 0;
  const program = { program: {}, isReady: () => (polls++, ready) };
  const pending = compileOwnedPrograms(fixture(program), {}, {}, {});
  ready = true;
  assert.equal(await pending, true);
  const canceled = compileOwnedPrograms(fixture(program), {}, {}, {}, () => current);
  assert.equal(await canceled, true);
  ready = false;
  const interrupted = compileOwnedPrograms(fixture(program), {}, {}, {}, () => current);
  const before = polls;
  current = false;
  assert.equal(await interrupted, false);
  assert.equal(polls, before);
});

test("driver readiness can progress through the browser scheduler while page timers are held", async () => {
  const previous = globalThis.scheduler,
    tasks = [];
  let ready = false;
  globalThis.scheduler = { postTask: (callback) => (tasks.push(callback), Promise.resolve()) };
  try {
    const program = { program: {}, isReady: () => ready },
      pending = compileOwnedPrograms(fixture(program), {}, {}, {});
    assert.equal(tasks.length, 1);
    ready = true;
    tasks.shift()();
    assert.equal(await pending, true);
  } finally {
    if (previous === undefined) delete globalThis.scheduler;
    else globalThis.scheduler = previous;
  }
});

test("retired materials retain every linking variant until the driver finishes, then dispose once", async () => {
  let ready = false,
    disposals = 0,
    removed = 0;
  const current = { program: {}, isReady: () => true },
    variant = { program: {}, isReady: () => ready },
    material = { dispose: () => disposals++ },
    renderer = {
      properties: {
        get: () => ({
          programs: new Map([
            [0, current],
            [1, variant],
          ]),
        }),
      },
      getContext: () => ({ isContextLost: () => false }),
    };
  const pending = retireCompiledMaterials(renderer, [material, material], { onDispose: () => removed++ });
  assert.equal(disposals, 0, "removing a body must not delete its still-linking variant");
  ready = true;
  await pending;
  assert.equal(disposals, 1);
  assert.equal(removed, 1);
});

test("component teardown ends material retirement without polling a lost or retired program", async () => {
  let disposed = false,
    disposals = 0,
    polls = 0;
  const program = { program: {}, isReady: () => (polls++, false) },
    material = { dispose: () => disposals++ },
    renderer = { properties: { get: () => ({ programs: new Map([[0, program]]) }) }, getContext: () => ({ isContextLost: () => false }) };
  const pending = retireCompiledMaterials(renderer, [material], { isDisposed: () => disposed });
  const before = polls;
  disposed = true;
  await pending;
  assert.equal(polls, before);
  assert.equal(disposals, 1);
});
