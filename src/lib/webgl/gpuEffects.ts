/**
 * GPU effect set - fragment shaders that REPLICATE the CPU math exactly, so a
 * GPU render is byte-equivalent (within ±tolerance for float->8-bit rounding)
 * to the CPU path. Each entry is verified against its CPU counterpart in the
 * headless-Chrome harness (/devtest/gpu) before being trusted; anything not in
 * this map falls back to CPU.
 *
 * `params` are the Konva params returned by applyEffect (already scaled), e.g.
 * brightness => { brightness: value/100 }, contrast => { contrast: -100..100 }.
 */
import { WebGL2Renderer, type GpuPass } from './WebGL2Renderer';

type UniformSetter = (
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  params: Record<string, number>
) => void;

interface GpuEffectDef {
  frag: string;
  setUniforms?: UniformSetter;
}

const f = WebGL2Renderer.colorFrag;

function setFloat(gl: WebGL2RenderingContext, prog: WebGLProgram, name: string, v: number): void {
  const loc = gl.getUniformLocation(prog, name);
  if (loc) gl.uniform1f(loc, v);
}

export const GPU_EFFECTS: Record<string, GpuEffectDef> = {
  // 255 - x
  invert: { frag: f(`return 1.0 - c;`) },

  // Konva Grayscale: 0.34 r + 0.5 g + 0.16 b
  grayscale: { frag: f(`return vec3(dot(c, vec3(0.34, 0.5, 0.16)));`) },

  // Konva Sepia matrix (min to 1.0 handled by colorFrag's clamp)
  sepia: {
    frag: f(`return vec3(
      dot(c, vec3(0.393, 0.769, 0.189)),
      dot(c, vec3(0.349, 0.686, 0.168)),
      dot(c, vec3(0.272, 0.534, 0.131)));`),
  },

  // Konva Brighten: data += brightness*255  ->  in 0..1: c + brightness
  brightness: {
    frag: f(`return c + u_amount;`, `uniform float u_amount;`),
    setUniforms: (gl, prog, p) => setFloat(gl, prog, 'u_amount', p.brightness ?? 0),
  },

  // Konva Contrast: adjust = ((contrast+100)/100)^2 ; (c-0.5)*adjust + 0.5
  contrast: {
    frag: f(`return (c - 0.5) * u_adjust + 0.5;`, `uniform float u_adjust;`),
    setUniforms: (gl, prog, p) =>
      setFloat(gl, prog, 'u_adjust', Math.pow(((p.contrast ?? 0) + 100) / 100, 2)),
  },

  // Konva HSL: a YIQ-style rotation matrix from saturation/hue/luminance.
  // Matrix built JS-side (matches Konva exactly), applied in 0..1 (linear) plus
  // the luminance offset l/255. Both `saturation` and `hue` dispatch here.
  saturation: { frag: hslFrag(), setUniforms: hslUniforms },
  hue: { frag: hslFrag(), setUniforms: hslUniforms },
};

function hslFrag(): string {
  return f(`return u_m * c + vec3(u_l / 255.0);`, `uniform mat3 u_m;\nuniform float u_l;`);
}

function hslUniforms(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  p: Record<string, number>
): void {
  const s = Math.pow(2, p.saturation ?? 0);
  const h = Math.abs((p.hue ?? 0) + 360) % 360;
  const l = (p.luminance ?? 0) * 127;
  const vsu = s * Math.cos((h * Math.PI) / 180);
  const vsw = s * Math.sin((h * Math.PI) / 180);
  const rr = 0.299 + 0.701 * vsu + 0.167 * vsw;
  const rg = 0.587 - 0.587 * vsu + 0.33 * vsw;
  const rb = 0.114 - 0.114 * vsu - 0.497 * vsw;
  const gr = 0.299 - 0.299 * vsu - 0.328 * vsw;
  const gg = 0.587 + 0.413 * vsu + 0.035 * vsw;
  const gb = 0.114 - 0.114 * vsu + 0.293 * vsw;
  const br = 0.299 - 0.3 * vsu + 1.25 * vsw;
  const bg = 0.587 - 0.586 * vsu - 1.05 * vsw;
  const bb = 0.114 + 0.886 * vsu - 0.2 * vsw;
  const mloc = gl.getUniformLocation(prog, 'u_m');
  // column-major: column j = [row0_colj, row1_colj, row2_colj]
  if (mloc) gl.uniformMatrix3fv(mloc, false, [rr, gr, br, rg, gg, bg, rb, gb, bb]);
  setFloat(gl, prog, 'u_l', l);
}

export function isGpuSupportedEffect(effectId: string): boolean {
  return Object.prototype.hasOwnProperty.call(GPU_EFFECTS, effectId);
}

export function buildGpuPass(effectId: string, params: Record<string, number>): GpuPass | null {
  const def = GPU_EFFECTS[effectId];
  if (!def) return null;
  return {
    frag: def.frag,
    setUniforms: def.setUniforms ? (gl, prog) => def.setUniforms!(gl, prog, params) : undefined,
  };
}

/** Effect ids that have a verified GPU shader. */
export function gpuEffectIds(): string[] {
  return Object.keys(GPU_EFFECTS);
}
