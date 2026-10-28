// Pinned r164 clears WebGLProgram.program on destruction, while its isReady
// closure still holds the deleted GL handle. Never poll that retired handle.
export function programAlive(program) {
  return program?.program !== undefined;
}

// Removing a model from the scene need not delete its still-linking programs.
// Let the driver finish those handles, including variants other than the current
// one, before material disposal releases them. Component teardown/context loss
// ends the wait; callers retain resource ownership until onDispose fires.
export function retireCompiledMaterials(renderer, materials, { isDisposed = () => false, onDispose = () => {} } = {}) {
  const owned = new Set(materials),
    programs = new Set();
  for (const material of owned) for (const program of renderer?.properties.get(material).programs?.values() || []) programs.add(program);
  return new Promise((resolve, reject) => {
    const poll = () => {
      try {
        if (!isDisposed() && renderer && !renderer.getContext().isContextLost()) {
          for (const program of programs) if (!programAlive(program) || program.isReady()) programs.delete(program);
          if (programs.size) {
            if (globalThis.scheduler?.postTask) globalThis.scheduler.postTask(poll, { delay: 10 }).catch(reject);
            else setTimeout(poll, 10);
            return;
          }
        }
        for (const material of owned) {
          material.dispose();
          onDispose(material);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    poll();
  });
}

export function compileOwnedPrograms(renderer, object, camera, scene, shouldContinue = () => true) {
  const materials = renderer.compile(object, camera, scene);
  const programs = new Set();
  let missing = false;
  for (const material of materials) {
    const program = renderer.properties.get(material).currentProgram;
    if (program) programs.add(program);
    else missing = true;
  }
  return new Promise((resolve, reject) => {
    let retired = false;
    const poll = () => {
      try {
        if (!shouldContinue() || renderer.getContext().isContextLost()) return resolve(false);
        for (const program of programs) {
          if (!programAlive(program)) {
            programs.delete(program);
            retired = true;
          } else if (program.isReady()) programs.delete(program);
        }
        if (!programs.size) return resolve(!retired && !missing);
        // Driver completion uses wall-clock work even when an inspection/test
        // clock holds page timers. Match the main warmup queue's scheduler.
        if (globalThis.scheduler?.postTask) globalThis.scheduler.postTask(poll, { delay: 10 }).catch(reject);
        else setTimeout(poll, 10);
      } catch (error) {
        reject(error);
      }
    };
    poll();
  });
}
