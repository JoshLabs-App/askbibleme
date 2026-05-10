/** Sacred atmosphere — fragment（雾 / 顶光 / 微尘；与 uniforms 契约同步维护） */
export const SACRED_ATMOSPHERE_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uRms, uLow, uMid, uHigh;
uniform float uStill;
uniform float uMaster;
uniform float uFogSpeedMul;
uniform float uGlowWeightMul;
uniform float uParticleDensityMul;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float n2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * n2(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  float mk = clamp(uMaster, 0.1, 130.0);
  float fs = clamp(uFogSpeedMul, 0.35, 2.0);
  float t = uTime * mix(0.022, 0.055, uMid) * (1.0 - uStill * 0.88) * fs;
  vec2 uv = vUv;
  vec2 drift = vec2(t * 0.62, t * 0.31);
  float mist = fbm(uv * 2.2 + drift) * (0.12 + uMid * 0.14);
  float mist2 = fbm(uv * 1.35 - drift * 0.8) * (0.08 + uRms * 0.08);
  float gw = clamp(uGlowWeightMul, 0.35, 1.85);
  float holy = smoothstep(1.15, 0.0, length(uv - vec2(0.5, -0.05))) * (0.1 + uLow * 0.22) * gw;
  vec3 base = vec3(0.06, 0.05, 0.14);
  vec3 fogCol = vec3(0.22, 0.18, 0.38);
  vec3 col = (base + fogCol * (mist + mist2 * 0.7)) * mk;
  vec3 light = vec3(0.92, 0.78, 0.52) * holy * mk;
  col += light;
  float hk = hash(uv * 420.0 + uTime * 0.35);
  float pd = clamp(uParticleDensityMul, 0.2, 1.6);
  float sparkTh = mix(0.99945, 0.985, (pd - 0.2) / 1.4);
  float spark = step(sparkTh, hk) * uHigh * 0.22 * mk;
  col += vec3(spark);
  float a = clamp((0.12 + uRms * 0.14 + mist * 0.35) * mk, 0.06, 0.995);
  gl_FragColor = vec4(col, a);
}
`;
