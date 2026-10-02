// Opt-in lab telemetry only. Result retrieval never waits for the GPU.
export function createGpuTimer(gl, enabled = false) {
  const extension = enabled ? gl.getExtension("EXT_disjoint_timer_query_webgl2") : null;
  const pending = [],
    samples = [];
  let active = null,
    frames = 0;
  const discard = () => {
    pending.splice(0).forEach((query) => gl.deleteQuery(query));
    samples.length = 0;
  };
  return {
    begin() {
      if (!extension) return;
      if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
        discard();
        return;
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        const query = pending[i];
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
        const milliseconds = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
        if (Number.isFinite(milliseconds) && milliseconds >= 0) samples.push(milliseconds);
        gl.deleteQuery(query);
        pending.splice(i, 1);
      }
      if (samples.length > 64) samples.splice(0, samples.length - 64);
      // Bound queries and skip a target already timed by another profiler.
      if (++frames % 8 || pending.length >= 4 || gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return;
      active = gl.createQuery();
      if (active) gl.beginQuery(extension.TIME_ELAPSED_EXT, active);
    },
    end() {
      if (!active) return;
      gl.endQuery(extension.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
    },
    get evidence() {
      const sorted = [...samples].sort((a, b) => a - b);
      return {
        available: Boolean(extension),
        samples: sorted.length,
        medianMs: sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : null,
        p95Ms: sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : null,
      };
    },
    dispose() {
      if (active) {
        gl.endQuery(extension.TIME_ELAPSED_EXT);
        gl.deleteQuery(active);
        active = null;
      }
      discard();
    },
  };
}
