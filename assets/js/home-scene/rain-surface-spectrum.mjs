// Sparse normal detail for representative rain impacts. Gravity/capillary dispersion follows
// omega^2=g*k+sigma*k^3/rho (Waterloo AMATH463 surface-gravity notes). This is an authored wave-packet
// approximation, not a water-volume solver or a calibrated rainfall rate. The large sea shape stays
// with its existing spectrum; unresolved packet slopes become roughness rather than temporal sparkle.
export const RAIN_RIPPLES = Object.freeze({
  lifetime: 1.4,
  gravity: 9.80665,
  density: 1000,
  tension: 0.0728,
  referenceArea: 0.005,
  coupling: 0.08,
  maximumAmplitude: 0.0005,
});
const hash = (value) => {
  const v = Math.sin(value * 127.1 + 31.7) * 43758.5453123;
  return v - Math.floor(v);
};

export function rainPacket(event) {
  if (!event || typeof event !== "object") return null;
  const { position, seconds, relativeSpeed, index = 0, diameter = 0.001 } = event;
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 1024 ||
    position?.length !== 3 ||
    !position.every(Number.isFinite) ||
    !Number.isFinite(seconds) ||
    seconds < 0 ||
    !Number.isFinite(relativeSpeed) ||
    relativeSpeed <= 0 ||
    relativeSpeed > 30 ||
    !Number.isFinite(diameter) ||
    diameter < 0.0005 ||
    diameter > 0.002
  )
    return null;
  const wavelength = 0.027 + 0.032 * hash(index),
    k = (2 * Math.PI) / wavelength;
  const omega = Math.sqrt(RAIN_RIPPLES.gravity * k + (RAIN_RIPPLES.tension * k ** 3) / RAIN_RIPPLES.density);
  const group = (RAIN_RIPPLES.gravity + (3 * RAIN_RIPPLES.tension * k * k) / RAIN_RIPPLES.density) / (2 * omega);
  const mass = (RAIN_RIPPLES.density * Math.PI * diameter ** 3) / 6,
    incomingEnergy = (mass * relativeSpeed * relativeSpeed) / 2;
  // A reference annulus sets the small visual amplitude. This is not a proof that an approximate
  // packet conserves its energy at every age or that overlapping packets have independent energy.
  const amplitude = Math.min(
    RAIN_RIPPLES.maximumAmplitude,
    Math.sqrt(
      (incomingEnergy * RAIN_RIPPLES.coupling) /
        ((RAIN_RIPPLES.density * RAIN_RIPPLES.gravity + RAIN_RIPPLES.tension * k * k) * RAIN_RIPPLES.referenceArea)
    )
  );
  return { x: position[0], y: position[1], z: position[2], born: seconds, amplitude, k, omega, group, incomingEnergy, wavelength };
}

export function sampleRainPacket(packet, x, z, seconds, footprint = 0) {
  const age = seconds - packet.born;
  if (age <= 0 || age >= RAIN_RIPPLES.lifetime || !Number.isFinite(age)) return [0, 0, 0];
  const dx = x - packet.x,
    dz = z - packet.z,
    r = Math.hypot(dx, dz);
  const width = 0.014 + 0.02 * age,
    sigma2 = width * width + footprint * footprint;
  const q = r - packet.group * age,
    envelope = (Math.exp((-0.5 * q * q) / sigma2) * width) / Math.sqrt(sigma2);
  const ramp = 1 - Math.exp(-age / 0.008),
    fade = Math.exp(-2.5 * age) * ramp * Math.max(0, 1 - age / RAIN_RIPPLES.lifetime);
  const filter = Math.exp(-0.5 * packet.k * packet.k * footprint * footprint),
    phase = packet.k * r - packet.omega * age;
  const center = 1 - Math.exp((-r * r) / 0.000036),
    centerDerivative = ((2 * r) / 0.000036) * Math.exp((-r * r) / 0.000036);
  const scale = packet.amplitude * fade;
  const radial =
    scale * filter * envelope * ((packet.k * Math.cos(phase) - (q / sigma2) * Math.sin(phase)) * center + Math.sin(phase) * centerDerivative);
  const variance = 0.5 * scale * scale * packet.k * packet.k * envelope * Math.max(0, 1 - filter * filter);
  return [(radial * dx) / Math.max(r, 0.000001), (radial * dz) / Math.max(r, 0.000001), variance];
}

// Authored approximation: a bounded equilibrium short-wave energy estimate complements the few
// representative visible drops. Their displayed density is not the physical precipitation flux.
// Parameters below are authored, not a calibrated La Jolla rain observation. No wind-wave damping,
// droplet crown, water volume or full wave-wave interaction is solved by this approximation.
export const RAIN_FORCING = Object.freeze({
  maximumMMPerHour: 6,
  speed: 4.6,
  coupling: 0.08,
  residence: 0.15,
  density: 1000,
  tension: 0.0728,
  gravity: 9.80665,
});
const wavelengths = [0.027, 0.031, 0.037, 0.043, 0.051, 0.059];
export const rainBands = wavelengths.map((wavelength, i) => {
  const k = (2 * Math.PI) / wavelength,
    angle = i * 2.399963229728653;
  return {
    k,
    direction: [Math.cos(angle), Math.sin(angle)],
    omega: Math.sqrt(RAIN_FORCING.gravity * k + (RAIN_FORCING.tension / RAIN_FORCING.density) * k ** 3),
    phase: i * 1.713,
  };
});
export function equilibriumRainVariance(rain) {
  if (!Number.isFinite(rain)) return 0;
  const rate = (RAIN_FORCING.maximumMMPerHour * Math.max(0, Math.min(1, rain)) ** 1.5) / 3_600_000;
  const flux = 0.5 * RAIN_FORCING.density * rate * RAIN_FORCING.speed ** 2;
  const energy = flux * RAIN_FORCING.coupling * RAIN_FORCING.residence;
  // Linear-wave mean energy per unit area divided between six authored directional bands.
  return (
    (energy * rainBands.reduce((sum, { k }) => sum + (k * k) / (RAIN_FORCING.density * RAIN_FORCING.gravity + RAIN_FORCING.tension * k * k), 0)) /
    rainBands.length
  );
}
export function createRainForcing() {
  const uniforms = { rainForcingVariance: { value: 0 } };
  let previous = null,
    intensity = 0;
  return {
    uniforms,
    update(seconds, rain) {
      if (!Number.isFinite(seconds) || seconds < 0) return;
      const target = equilibriumRainVariance(rain);
      if (previous === null || seconds < previous) uniforms.rainForcingVariance.value = target;
      else if (seconds > previous)
        uniforms.rainForcingVariance.value +=
          (target - uniforms.rainForcingVariance.value) * -Math.expm1(-(seconds - previous) / RAIN_FORCING.residence);
      previous = seconds;
      intensity = Number.isFinite(rain) ? Math.max(0, Math.min(1, rain)) : 0;
    },
    evidence: () => ({
      authoredMaximumMMPerHour: RAIN_FORCING.maximumMMPerHour,
      intensity,
      slopeVariance: uniforms.rainForcingVariance.value,
      parameters: RAIN_FORCING,
      waves: rainBands.length,
      extraPasses: 0,
      calibrated: false,
    }),
  };
}
const f = (n) => n.toFixed(9);
export const rainForcingGLSL = `
uniform float rainForcingVariance;
vec3 rainForcing(vec2 p,vec2 fx,vec2 fy,float seconds) {
  if(rainForcingVariance<=1e-10)return vec3(0.);
  float xx=(fx.x*fx.x+fy.x*fy.x)/12.,zz=(fx.y*fx.y+fy.y*fy.y)/12.;
  float xz=(fx.x*fx.y+fy.x*fy.y)/12.;
  float smallest=.5*(xx+zz-length(vec2(xx-zz,2.*xz)));
  // Only skip every band when even the narrower pixel direction cannot resolve it.
  // A large trace alone is insufficient for the long narrow footprints near the horizon.
  if(smallest>=.003333333333)return vec3(0.,0.,rainForcingVariance);
  vec3 answer=vec3(0.);
  float componentVariance=rainForcingVariance/6.;
  float slope=sqrt(2.*componentVariance);
  ${rainBands
    .map(
      ({ k, direction, omega, phase }) => `{
    vec2 direction=vec2(${f(direction[0])},${f(direction[1])});
    float u=dot(fx,direction),v=dot(fy,direction);
    float weight=exp(-.5*${f(k * k)}*(u*u+v*v)/12.);
    answer.xy+=direction*slope*weight*cos(${f(k)}*dot(p,direction)-${f(omega)}*seconds+${f(phase)});
    answer.z+=componentVariance*(1.-weight*weight);
  }`
    )
    .join("\n")}
  return answer;
}`;
