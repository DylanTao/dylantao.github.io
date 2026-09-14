// A small analytic 3D portrait. No Three.js, downloaded model, image, or
// full-page framebuffer is needed on the default 2D reading surface.
import { companionLights } from "./bridge.mjs";

const fragment = `precision highp float;
uniform vec2 resolution, gaze, antennas, arms;
uniform vec3 headPose, accent, lamp;
uniform float lift, lean, blink, dark;
float box(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float ball(vec3 p,vec3 r){return (length(p/r)-1.)*min(r.x,min(r.y,r.z));}
float rod(vec3 p,vec3 a,vec3 b,float r){vec3 ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.))-r;}
float ring(vec3 p,float r,float tube){return length(vec2(length(p.xy)-r,p.z))-tube;}
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 nearest(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec2 shape(vec3 p){
 p.y-=lift; p.xy=rot(lean)*p.xy;
 // A continuous pear-shaped shell, tapering toward the hover unit.
 vec3 torso=p-vec3(0.,-.21,0.);float taper=1.+clamp(torso.y,-.39,.34)*.43;
 vec2 d=vec2(ball(vec3(torso.x/taper,torso.y,torso.z/taper),vec3(.28,.38,.23)),1.);
 d=nearest(d,vec2(ball(p-vec3(0.,.158,0.),vec3(.09,.07,.085)),6.));
 d=nearest(d,vec2(ball(p-vec3(0.,-.558,0.),vec3(.095,.022,.079)),3.));
 d=nearest(d,vec2(ball(p-vec3(0.,-.573,.004),vec3(.067,.009,.055)),4.));
 d=nearest(d,vec2(ball(p-vec3(.087,-.05,.225),vec3(.022,.022,.008)),5.));
 vec3 h=p-vec3(0.,.432,0.);
 h.xy=rot(headPose.z)*h.xy;h.xz=rot(-headPose.y)*h.xz;h.yz=rot(headPose.x)*h.yz;
 d=nearest(d,vec2(box(h,vec3(.285,.087,.075),.178),1.));
 // A dark, recessed seam continues around the back of the shell.
 vec3 seam=h;seam.z+=.065;
 float seamD=box(seam,vec3(.282,.084,.001),.179);
 d=nearest(d,vec2(max(seamD,abs(seam.z)-.0035),3.));
 d=nearest(d,vec2(box(h-vec3(0.,.016,.275),vec3(.10,.012,.007),.008),3.));
 for(int i=0;i<2;i++){
   float side=i==0?-1.:1., r=i==0?.151:.126;
   vec3 eye=h-vec3(side*.201,.017,.279);
   d=nearest(d,vec2(ball(eye,vec3(r*1.1,r*1.1,.044)),3.));
   d=nearest(d,vec2(ring(eye-vec3(0.,0.,.035),r,.012),6.));
   d=nearest(d,vec2(ball(eye-vec3(0.,0.,.041),vec3(r*.94,r*.94,.043)),2.));
   vec3 iris=eye-vec3(gaze.x*.024,gaze.y*.019,.082);
   iris.y/=max(.085,1.-blink*.915);
   d=nearest(d,vec2(ring(iris,r*.46,.0075),4.));
   d=nearest(d,vec2(ball(iris,vec3(r*.405,r*.405,.009)),2.));
   // Two independently hinged antennae: a short collar, slender stalk, soft tip.
   vec3 a=h-vec3(side*.322,.239,-.055);
   a.xy=rot(i==0?antennas.x:antennas.y)*a.xy;
   vec3 end=vec3(side*.12,.34,0.);
   d=nearest(d,vec2(rod(a,vec3(0.),vec3(side*.015,.046,0.),.016),3.));
   d=nearest(d,vec2(rod(a,vec3(side*.012,.039,0.),end,.008),3.));
   d=nearest(d,vec2(length(a-end)-.016,i==0?1.:5.));
   vec3 arm=p-vec3(side*.344,-.13,0.);
   arm.xy=rot(side*.16+(i==0?arms.x:arms.y))*arm.xy;
   d=nearest(d,vec2(ball(arm-vec3(0.,-.04,0.),vec3(.062,.205,.09)),1.));
 }
 return d;
}
vec3 normalAt(vec3 p){vec2 e=vec2(.001,0.);return normalize(vec3(shape(p+e.xyy).x-shape(p-e.xyy).x,shape(p+e.yxy).x-shape(p-e.yxy).x,shape(p+e.yyx).x-shape(p-e.yyx).x));}
vec3 studio(vec3 r){
 vec3 c=mix(vec3(.13,.19,.23),vec3(.036,.055,.095),dark);
 c+=lamp*pow(max(0.,r.y*.5+.5),3.)*.45;
 // Broad softboxes make curved ceramic and optical glass read at icon size.
 float panel=smoothstep(.70,.79,r.y)*smoothstep(-.10,.02,r.x)*(1.-smoothstep(.42,.60,r.x));
 c+=lamp*panel*1.3;
 c+=vec3(.63,.82,.95)*pow(max(0.,dot(r,normalize(vec3(-1.2,.8,1.6)))),38.)*.95;
 c+=accent*pow(max(0.,dot(r,normalize(vec3(1.,.25,-.4)))),8.)*.6;
 return c;
}
void main(){
 vec2 uv=(gl_FragCoord.xy/resolution-.5)*vec2(resolution.x/resolution.y,1.)*2.17;
 vec3 ro=vec3(0.,.235,3.8),rd=normalize(vec3(uv.x,uv.y-.012,-3.35));
 float t=0.;vec2 hit=vec2(1.);
 for(int i=0;i<80;i++){hit=shape(ro+rd*t);if(hit.x<.001||t>5.5)break;t+=hit.x*.86;}
 vec3 color=vec3(0.);float alpha=0.;
 if(t<5.5&&hit.x<.003){
   vec3 p=ro+rd*t,n=normalAt(p),v=-rd;
   vec3 l=normalize(vec3(-.9,1.4,1.9)),rim=normalize(vec3(.95,.5,-.3));
   float diffuse=max(0.,dot(n,l));
   float ao=1.;
   for(int j=1;j<4;j++){float h=float(j)*.035;ao-=(h-shape(p+n*h).x)*(.65/float(j));}
   ao=clamp(ao,.45,1.);
   bool ceramic=hit.y<1.5,glass=hit.y>1.5&&hit.y<2.5,metal=hit.y>5.5;
   vec3 base=ceramic?vec3(.91,.94,.92):glass?vec3(.005,.014,.022):vec3(.035,.047,.052);
   float keyShadow=clamp(shape(p+l*.085).x/.065,.3,1.);
   color=base*(mix(vec3(.55,.57,.56),vec3(.32,.36,.46),dark)+lamp*diffuse*.82*keyShadow)*ao;
   vec3 ref=studio(reflect(-v,n));
   float fresnel=pow(1.-max(0.,dot(n,v)),5.);
   color+=ref*(ceramic?.07+fresnel*.20:glass?.17:metal?.38:.12)*ao;
   color+=lamp*pow(max(0.,dot(n,normalize(l+v))),ceramic?48.:110.)*(ceramic?.32:.62);
   color+=accent*pow(max(0.,dot(n,rim)),4.)*(ceramic?.14:.05);
   if(hit.y>3.5&&hit.y<4.5)color=accent*.9+lamp*.22+ref*.1;
   if(hit.y>4.5&&hit.y<5.5)color=vec3(.95,.34,.065)*(.6+diffuse*.45);
   if(metal)color+=vec3(.22,.26,.29)*diffuse;
   color=pow(color/(color*.26+1.),vec3(1./2.2));alpha=1.;
 }else{
   float ground=(-.82-ro.y)/rd.y;
   if(ground>0.){
     vec3 p=ro+rd*ground;vec2 s=p.xz*vec2(2.6,4.2)/(1.+lift*1.8);
     alpha=exp(-dot(s,s))*mix(.22,.58,dark)*(1.-lift*.6);
     color=mix(vec3(.17,.21,.23),vec3(.008,.018,.033),dark);
   }
 }
 gl_FragColor=vec4(color,alpha);
}`;

export function createPortrait(canvas) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) return null;
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(result));
    return result;
  }
  const vertex = shader(gl.VERTEX_SHADER, "attribute vec2 point;void main(){gl_Position=vec4(point,0.,1.);}");
  const pixel = shader(gl.FRAGMENT_SHADER, fragment),
    program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, pixel);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const point = gl.getAttribLocation(program, "point");
  gl.enableVertexAttribArray(point);
  gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(
    ["resolution", "gaze", "headPose", "antennas", "arms", "lift", "lean", "blink", "dark", "accent", "lamp"].map((k) => [
      k,
      gl.getUniformLocation(program, k),
    ])
  );
  return {
    draw({ pose = {}, theme = "noon" } = {}) {
      const dpr = Math.min(canvas.clientWidth > 180 ? 1.25 : 2, Math.max(1.5, devicePixelRatio || 1)),
        w = Math.round(canvas.clientWidth * dpr),
        h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      const night = theme === "evening",
        light = companionLights[theme] || companionLights.noon;
      gl.useProgram(program);
      gl.uniform2f(u.resolution, w, h);
      gl.uniform2fv(u.gaze, pose.gaze || [0, 0]);
      gl.uniform3fv(u.headPose, pose.head || [0, 0, 0]);
      gl.uniform2fv(u.antennas, pose.antennas || [0, 0]);
      gl.uniform2fv(u.arms, pose.arms || [0, 0]);
      for (const [key, value] of Object.entries({ lift: pose.lift || 0, lean: pose.lean || 0, blink: pose.blink || 0, dark: night ? 1 : 0 }))
        gl.uniform1f(u[key], value);
      gl.uniform3fv(u.accent, light.accent);
      gl.uniform3fv(u.lamp, light.lamp);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(pixel);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
