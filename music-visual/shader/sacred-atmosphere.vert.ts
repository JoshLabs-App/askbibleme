/** Sacred atmosphere 全屏 quad — vertex（勿内联进 JSX） */
export const SACRED_ATMOSPHERE_VERTEX = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
