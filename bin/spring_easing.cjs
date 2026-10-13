#!/usr/bin/env node
// Print a CSS linear() easing for a damped spring, the way SwiftUI and Apple's motion guidance
// describe springs: a damping ratio (zeta) and a period (seconds per oscillation when undamped).
//   zeta = 1    critically damped: fastest return with no overshoot
//   zeta < 1    underdamped: overshoots, more so as zeta falls (0.8 confident, 0.5 toy-like)
// The curve samples the step response x(t) = 1 - e^(-zeta w t) (cos(wd t) + (zeta w / wd) sin(wd t))
// until it settles within 0.1%, which also gives the transition's duration.
// Usage: node bin/spring_easing.cjs <zeta> <period-seconds> [samples]
const [zeta, period, samples = 36] = process.argv.slice(2).map(Number);
if (!(zeta > 0 && zeta < 1 && period > 0)) {
  console.error("Usage: node bin/spring_easing.cjs <zeta between 0 and 1> <period-seconds> [samples]");
  process.exit(1);
}
const w = (2 * Math.PI) / period,
  wd = w * Math.sqrt(1 - zeta * zeta),
  settle = -Math.log(0.001) / (zeta * w);
const points = [];
for (let i = 0; i <= samples; i += 1) {
  const t = (settle * i) / samples;
  points.push(1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t)));
}
points[points.length - 1] = 1;
const overshoot = (Math.max(...points) - 1) * 100;
console.log(`/* zeta ${zeta}, period ${period}s: settles in ${Math.round(settle * 1000)}ms, overshoot ${overshoot.toFixed(1)}% */`);
console.log(`linear(${points.map((p) => +p.toFixed(3)).join(", ")})`);
