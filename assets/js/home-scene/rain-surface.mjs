import { rainPacket, RAIN_RIPPLES, createRainForcing, rainForcingGLSL } from "./rain-surface-spectrum.mjs";
export { rainPacket, RAIN_RIPPLES };

// Bounded representative-drop history, independent of animal wakes and the precipitation estimate.
// Twelve local references avoid scanning every event at each sea pixel. Three8-bit event IDs fit
// exactly in one Float32 integer; zero is a sentinel, so the largest history has255 entries.
export function createRainSurface({ compact = false } = {}) {
  const maximum = compact ? 63 : 255,
    size = compact ? 32 : 64,
    cell = 64 / size,
    slots = 12,
    pad = 0.2;
  const events = new Float32Array(256 * 2 * 4),
    bins = new Float32Array(size * size * 4),
    counts = new Uint8Array(size * size),
    grid = new Float32Array([0, 0, 1 / cell, size]);
  const forcing = createRainForcing();
  const uniforms = {
    ...forcing.uniforms,
    rainPacketCount: { value: 0 },
    rainEventMap: { value: null },
    rainBins: { value: null },
    rainGrid: { value: grid },
    rainBinSlots: { value: slots },
    rainCoarseVariance: { value: 0 },
  };
  const packets = [];
  let total = 0,
    evicted = 0,
    seconds = 0,
    last = null,
    largestBin = 0,
    overflow = 0,
    dirty = true,
    uploads = 0,
    active = 0,
    lastOrigin = [NaN, NaN];
  return {
    events,
    bins,
    size,
    uniforms,
    impact(event) {
      const p = rainPacket(event);
      if (!p) return false;
      if (packets.length === maximum) {
        packets.shift();
        evicted++;
      }
      packets.push(p);
      total++;
      last = { ...p };
      dirty = true;
      return true;
    },
    update(t, eye = [0, 0, 0], rain = 0) {
      if (!Number.isFinite(t) || t < 0 || eye?.length !== 3 || !eye.every(Number.isFinite))
        throw new RangeError("Finite rain-surface time and eye required");
      forcing.update(t, rain);
      if (t < seconds) {
        packets.length = 0;
        dirty = true;
      }
      const ox = Math.floor((eye[0] - 32) / cell) * cell,
        oz = Math.floor((eye[2] - 32) / cell) * cell;
      if (!dirty && t === seconds && ox === lastOrigin[0] && oz === lastOrigin[1]) return false;
      if (!dirty && !packets.length && active === 0) {
        seconds = t;
        lastOrigin[0] = grid[0] = ox;
        lastOrigin[1] = grid[1] = oz;
        return false;
      }
      seconds = t;
      dirty = false;
      lastOrigin[0] = ox;
      lastOrigin[1] = oz;
      grid[0] = ox;
      grid[1] = oz;
      while (packets.length && t - packets[0].born >= 1.4) packets.shift();
      events.fill(0);
      bins.fill(0);
      counts.fill(0);
      active = 0;
      largestBin = 0;
      let coarse = 0,
        frameOverflow = 0;
      for (const p of packets) {
        const age = t - p.born;
        if (age < 0 || age >= 1.4) continue;
        const id = ++active,
          at = id * 4;
        events[at] = p.x;
        events[at + 1] = p.z;
        events[at + 2] = age;
        events[at + 3] = p.amplitude;
        const bt = at + 256 * 4;
        events[bt] = p.k;
        events[bt + 1] = p.omega;
        events[bt + 2] = p.group;
        events[bt + 3] = p.y;
        const width = 0.014 + 0.02 * age,
          scale = p.amplitude * Math.exp(-2.5 * age) * (1 - Math.exp(-age / 0.008)) * Math.max(0, 1 - age / 1.4);
        // A phase-averaged sparse-packet estimate, not calibrated rainfall or exact fluid energy.
        coarse +=
          (0.5 * scale * scale * (p.k * p.k + 1 / (2 * width * width)) * 2 * Math.PI * Math.max(p.group * age, width) * width * Math.sqrt(Math.PI)) /
          900;
        const reach = p.group * age + 4 * width + pad;
        const x0 = Math.max(0, Math.floor((p.x - reach - ox) / cell)),
          x1 = Math.min(size - 1, Math.floor((p.x + reach - ox) / cell));
        const z0 = Math.max(0, Math.floor((p.z - reach - oz) / cell)),
          z1 = Math.min(size - 1, Math.floor((p.z + reach - oz) / cell));
        for (let z = z0; z <= z1; z++)
          for (let x = x0; x <= x1; x++) {
            const c = z * size + x,
              n = counts[c];
            if (n === slots) {
              frameOverflow++;
              continue;
            }
            bins[c * 4 + Math.floor(n / 3)] += id * 2 ** ((n % 3) * 8);
            counts[c]++;
            largestBin = Math.max(largestBin, n + 1);
          }
      }
      overflow += frameOverflow;
      uniforms.rainPacketCount.value = active;
      uniforms.rainCoarseVariance.value = coarse;
      uploads++;
      return true;
    },
    candidates(x, z) {
      const i = Math.floor((x - grid[0]) / cell),
        j = Math.floor((z - grid[1]) / cell);
      if (i < 0 || j < 0 || i >= size || j >= size) return [];
      const out = [],
        at = (j * size + i) * 4;
      for (let n = 0; n < 12; n++) {
        const code = Math.trunc(bins[at + Math.floor(n / 3)]),
          id = (code >>> ((n % 3) * 8)) & 255;
        if (!id) break;
        out.push(id);
      }
      return out;
    },
    evidence: () => ({
      method: "spatially binned first-contact rain packets; projected-pixel filtering and coarse sparse-packet slope variance",
      maximum,
      active,
      total,
      evicted,
      seconds,
      last,
      gridSize: size,
      gridCell: cell,
      largestBin,
      binOverflow: overflow,
      uploads,
      textureBytes: events.byteLength + bins.byteLength,
      coarseVariance: uniforms.rainCoarseVariance.value,
      extraPasses: 0,
      vertexDisplacement: false,
      animalWakeSlotsUsed: 0,
      statistical: forcing.evidence(),
    }),
  };
}

export const rainSurfaceGLSL = `
${rainForcingGLSL}

uniform sampler2D rainEventMap;
uniform sampler2D rainBins;
uniform vec4 rainGrid;
uniform int rainBinSlots;
uniform int rainPacketCount;
uniform float rainCoarseVariance;
vec3 rainRipples(vec3 worldPoint,vec2 fx,vec2 fy) {
 vec2 p=worldPoint.xz;
 float totalVariance=(dot(fx,fx)+dot(fy,fy))/12.;
 float coarse=smoothstep(.000208333333,.003333333333,totalVariance);
 if(rainPacketCount==0||coarse>=1.)return vec3(0.,0.,rainCoarseVariance);
 ivec2 cell=ivec2(floor((p-rainGrid.xy)*rainGrid.z));
 if(any(lessThan(cell,ivec2(0)))||any(greaterThanEqual(cell,ivec2(int(rainGrid.w)))))return vec3(0.,0.,rainCoarseVariance);
 vec4 packed=texelFetch(rainBins,cell,0);vec3 result=vec3(0.);
 for(int j=0;j<12;j++) {
  if(j>=rainBinSlots)break;
  int code=int(packed[j/3]),id=(code>>((j%3)*8))&255;
  if(id==0)break;
  vec4 a=texelFetch(rainEventMap,ivec2(id,0),0),b=texelFetch(rainEventMap,ivec2(id,1),0);float age=a.z;
  if(age<=0.||age>=1.4)continue;
  vec2 rel=p-a.xy;float width=.014+.02*age,reach=b.z*age+4.*(width+sqrt(totalVariance));
  if(dot(rel,rel)>reach*reach)continue;
  float r=length(rel);vec2 radialDirection=rel/max(r,.000001),tangentDirection=vec2(-radialDirection.y,radialDirection.x);
  float px=dot(fx,radialDirection),py=dot(fy,radialDirection),tx=dot(fx,tangentDirection),ty=dot(fy,tangentDirection);
  float radialVariance=(px*px+py*py)/12.,tangentVariance=(tx*tx+ty*ty)/12.,curveRadius=max(r,.006);
  // Radial distance is1-Lipschitz. Keep the curvature approximation within the full pixel's
  // variance and Jensen bound, so the fixed .2m bin pad still bounds this near-field kernel.
  float variance=min(totalVariance,radialVariance+tangentVariance*tangentVariance/(2.*curveRadius*curveRadius));
  float meanR=min(r+tangentVariance/(2.*curveRadius),sqrt(r*r+totalVariance));
  float sigma2=width*width+variance,q=meanR-b.z*age;
  float envelope=exp(-.5*q*q/sigma2)*width/sqrt(sigma2);
  float scale=a.w*exp(-2.5*age)*(1.-exp(-age/.008))*max(0.,1.-age/1.4);
  float bandWeight=exp(-.5*b.x*b.x*variance),phase=b.x*meanR-b.y*age;
  float c=exp(-r*r/.000036),center=1.-c,centerDerivative=2.*r/.000036*c;
  float radial=scale*bandWeight*envelope*((b.x*cos(phase)-q/sigma2*sin(phase))*center+sin(phase)*centerDerivative);
  result.xy+=radial*radialDirection;
  result.z+=.5*scale*scale*b.x*b.x*envelope*max(0.,1.-bandWeight*bandWeight);
 }
 return mix(result,vec3(0.,0.,rainCoarseVariance),coarse);
}
vec3 rainResponse(vec3 point,vec2 fx,vec2 fy,float seconds) {
 return rainRipples(point,fx,fy)+rainForcing(point.xz,fx,fy,seconds);
}`;
