// A small analytic 3D portrait. No Three.js, downloaded model, image, or
// full-page framebuffer is needed on the default 2D reading surface.
import { companionLights } from "./bridge.mjs";

const fragment = `precision highp float;
uniform vec2 resolution, gaze;
uniform float time, blink, mood, dark;
uniform vec3 accent, lamp;
float box(vec3 p,vec3 b,float r){return length(max(abs(p)-b,0.))+min(max(abs(p.x)-b.x,max(abs(p.y)-b.y,abs(p.z)-b.z)),0.)-r;}
float ball(vec3 p,vec3 r){return (length(p/r)-1.)*min(r.x,min(r.y,r.z));}
mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
vec2 closest(vec2 a,vec2 b){return a.x<b.x?a:b;}
vec2 shape(vec3 p){
 p.y-=sin(time*2.4)*.035; p.xy=rot(sin(time*1.3)*.025+mood*.08)*p.xy;
 vec2 d=vec2(ball(p-vec3(0.,-.16,0.),vec3(.255,.30,.21)),1.);
 d=closest(d,vec2(box(p-vec3(0.,.13,0.),vec3(.065,.09,.065),.03),3.));
 vec3 head=p-vec3(0.,.46,0.); head.xz=rot(gaze.x*.27)*head.xz; head.yz=rot(-gaze.y*.18)*head.yz;
 d=closest(d,vec2(box(head,vec3(.37,.20,.155),.145),1.));
 d=closest(d,vec2(box(head-vec3(0.,-.004,.276),vec3(.30,.126,.007),.106),2.));
 for(int i=0;i<2;i++){
   float side=i==0?-1.:1.;
   vec3 eye=head-vec3(side*.155+gaze.x*.032,gaze.y*.023,.391);
   d=closest(d,vec2(box(eye,vec3(.026,.05*(1.-blink),.004),.022),4.));
   vec3 ear=head-vec3(side*.507,0.,0.);
   d=closest(d,vec2(ball(ear,vec3(.034,.094,.10)),3.));
   vec3 arm=p-vec3(side*.33,-.19,.012); arm.xy=rot(side*(.26+sin(time*2.)*.09+mood*.6))*arm.xy;
   d=closest(d,vec2(box(arm,vec3(.014,.088,.043),.063),1.));
 }
 d=closest(d,vec2(box(head-vec3(0.,.393,-.03),vec3(.012,.05,.012),.015),3.));
 d=closest(d,vec2(length(head-vec3(0.,.461,-.03))-.038,5.));
 d=closest(d,vec2(ball(p-vec3(0.,-.444,0.),vec3(.12,.025,.10)),4.));
 return d;
}
vec3 normalAt(vec3 p){vec2 e=vec2(.001,0.);return normalize(vec3(shape(p+e.xyy).x-shape(p-e.xyy).x,shape(p+e.yxy).x-shape(p-e.yxy).x,shape(p+e.yyx).x-shape(p-e.yyx).x));}
void main(){
 vec2 uv=(gl_FragCoord.xy/resolution-.5)*vec2(resolution.x/resolution.y,1.)*2.05;
 vec3 ro=vec3(0.,.38,3.8), rd=normalize(vec3(uv.x,uv.y-.035,-3.2));
 float t=0.; vec2 hit;
 for(int i=0;i<58;i++){hit=shape(ro+rd*t);if(hit.x<.0014||t>5.5)break;t+=hit.x*.82;}
 vec3 color=vec3(0.);float alpha=0.;
 if(t<5.5&&hit.x<.004){
   vec3 p=ro+rd*t,n=normalAt(p),v=-rd;
   vec3 l=normalize(vec3(-.75,1.1,1.25)),rim=normalize(vec3(.9,.45,-.4));
   float diffuse=max(0.,dot(n,l));
   float ao=clamp(1.-(0.055-shape(p+n*.055).x)*3.5, .55,1.);
   vec3 base=hit.y<1.5?vec3(.91,.94,.93):hit.y<2.5?vec3(.012,.035,.043):vec3(.20,.26,.27);
   color=base*(mix(vec3(.33,.42,.46),vec3(.16,.20,.32),dark)+lamp*diffuse*.83)*ao;
   color+=accent*pow(max(0.,dot(n,rim)),3.)*.25;
   float rough=hit.y<1.5?54.:hit.y<2.5?100.:42.;
   color+=lamp*pow(max(0.,dot(n,normalize(l+v))),rough)*.7;
   color+=vec3(.72,.83,.88)*pow(1.-max(0.,dot(n,v)),4.)*.13;
   if(hit.y>3.5)color=(hit.y>4.5?vec3(1.,.47,.12):accent)*1.35;
   // A soft rectangular studio reflection on the glass visor.
   if(hit.y>1.5&&hit.y<2.5)color+=vec3(.4,.57,.67)*pow(max(0.,dot(reflect(-v,n),normalize(vec3(-.7,1.,2.)))),45.)*.55;
   color=pow(color/(color*.22+1.),vec3(1./2.2)); alpha=1.;
 }else{
   float ground=(-.88-ro.y)/rd.y;
   if(ground>0.){vec3 p=ro+rd*ground; float s=exp(-dot(p.xz*vec2(2.5,4.),p.xz*vec2(2.5,4.)));alpha=s*mix(.25,.65,dark);color=mix(vec3(.15,.20,.22),vec3(.0,.015,.025),dark);}
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
    ["resolution", "gaze", "time", "blink", "mood", "dark", "accent", "lamp"].map((k) => [k, gl.getUniformLocation(program, k)])
  );
  return {
    draw({ time = 0, gaze = [0, 0], blink = 0, mood = 0, theme = "noon" }) {
      const dpr = Math.min(2, Math.max(1.5, devicePixelRatio || 1)),
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
      gl.uniform2fv(u.gaze, gaze);
      for (const [key, value] of Object.entries({ time, blink, mood, dark: night ? 1 : 0 })) gl.uniform1f(u[key], value);
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
