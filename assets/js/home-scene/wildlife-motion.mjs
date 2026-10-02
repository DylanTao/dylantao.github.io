// Authored animal acting, sampled from active scene time. No frame integration
// means a pause, slow renderer, or reduced-motion still cannot accumulate drift.
const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => {
  const u = clamp(x);
  return u * u * (3 - 2 * u);
};
const pulse = (x) => {
  const u = clamp(x);
  return Math.sin(Math.PI * u) ** 2;
};
const wrap = (x, period) => ((x % period) + period) % period;

export function rabbitActing(time, seed = 1) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0) + seed * 7;
  const cycle = wrap(t, 34),
    lap = Math.floor(t / 34);
  const moving = cycle < 6;
  const step = Math.floor(cycle),
    phase = cycle - step;
  const airborne = moving && phase > 0.18 + 1e-10 && phase < 0.76 - 1e-10;
  const flight = clamp((phase - 0.18) / 0.58);
  // Translation is held at takeoff/landing contacts; each hop advances only
  // while airborne. Quintic travel removes velocity/acceleration jumps.
  const travel = flight ** 3 * (10 + flight * (-15 + 6 * flight));
  const progress = (lap + (moving ? (step + travel) / 6 : 1)) * 0.22 + seed * 0.2;
  const compression = moving ? (phase <= 0.18 ? pulse(phase / 0.18) : phase >= 0.76 ? pulse((phase - 0.76) / 0.24) * 0.6 : 0) : 0;
  const look = smooth((cycle - 6) / 0.7) * (1 - smooth((cycle - 12.2) / 0.8));
  const groom = smooth((cycle - 13) / 0.6) * (1 - smooth((cycle - 17.3) / 0.7));
  // A short unilateral ear answer follows the head; no continuous metronome.
  const listen = pulse((cycle - (9.5 + seed * 0.4)) / 1.1);
  return {
    cycle,
    progress,
    phase: moving ? phase : 0,
    state: moving ? "hop" : cycle < 13 ? "look" : cycle < 18 ? "groom" : "rest",
    airborne,
    contact: !airborne,
    lift: airborne ? Math.sin(Math.PI * flight) ** 2 * 0.12 : 0,
    compression,
    tuck: airborne ? Math.sin(Math.PI * flight) : 0,
    bodyPitch: airborne ? Math.sin(Math.PI * flight * 2) * 0.09 : 0,
    headYaw: look * Math.sin((cycle - 6) * 0.55) * 0.26,
    headPitch: groom * (0.17 + Math.sin((cycle - 13) * 2.5) * 0.055),
    earLeft: listen * 0.24,
    earRight: pulse((cycle - (10 + seed * 0.4)) / 1.3) * -0.16,
  };
}

export function pinnipedActing(time, index, lion) {
  const period = lion ? 47 : 53;
  const activeTime = Math.max(0, Number.isFinite(time) ? time : 0);
  const cycle = wrap(activeTime + index * 11.7 + (lion ? 3 : 8), period);
  const look = smooth((cycle - 25) / 1.8) * (1 - smooth((cycle - 35) / 2));
  const settle = smooth((cycle - 39) / 1.5) * (1 - smooth((cycle - 44) / 2));
  const blinkPhase = wrap(activeTime + index * 2.3, 8.9 + index * 0.7);
  const blink = pulse(blinkPhase / 0.22);
  return {
    state: look > 0.01 ? "look" : settle > 0.01 ? "groom" : "rest",
    headYaw: look * Math.sin((cycle - 25) * 0.24) * (lion ? 0.31 : 0.2),
    headPitch: look * (lion ? -0.04 : -0.075) + settle * Math.sin((cycle - 39) * 0.8) * 0.075,
    neckFollow: look * Math.sin((cycle - 25 - 0.45) * 0.24) * 0.045,
    breath: Math.sin((activeTime + index) * (lion ? 1.25 : 1.08)) * 0.0028,
    flipper: settle * pulse((cycle - 39) / 7) * 0.035,
    blink,
  };
}
