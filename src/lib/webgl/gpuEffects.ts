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
import { buildExposureLUT } from '../effects/pro/exposure';
import { makeExposureLUT } from '../effects/color-space';

type UniformSetter = (
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  params: Record<string, number>
) => void;

interface GpuEffectDef {
  frag: string;
  setUniforms?: UniformSetter;
  /** Build a 256-entry per-channel byte→byte LUT from the layer's settings. When
   *  present, the pass samples it (u_lut) for a BYTE-IDENTICAL result — used for
   *  closure-baked tone effects (exposure, curves) that return empty params. */
  buildLut?: (settings: Record<string, number>) => Uint8ClampedArray;
}

const f = WebGL2Renderer.colorFrag;

/** Per-channel byte→byte LUT sampler: reads the exact CPU LUT entry (NEAREST). */
function lutFrag(): string {
  return f(
    `return vec3(
      texture(u_lut, vec2((c.r * 255.0 + 0.5) / 256.0, 0.5)).r,
      texture(u_lut, vec2((c.g * 255.0 + 0.5) / 256.0, 0.5)).r,
      texture(u_lut, vec2((c.b * 255.0 + 0.5) / 256.0, 0.5)).r);`,
    `uniform sampler2D u_lut;`
  );
}

function setFloat(gl: WebGL2RenderingContext, prog: WebGLProgram, name: string, v: number): void {
  const loc = gl.getUniformLocation(prog, name);
  if (loc) gl.uniform1f(loc, v);
}

// IMPORTANT: only effects whose applyEffect() dispatches to a KONVA built-in (or a
// byte-exact LUT) belong here. grayscale/brightness/saturation were removed —
// applyEffect routes them to CUSTOM linear-light implementations (Rec.709 luminance,
// etc.), NOT Konva's gamma-space math, so the old gamma-space shaders diverged from
// the CPU by up to ~74/255 whenever the GPU fast-path was active. They now fall to
// the (correct) CPU path. Re-add only with a shader verified ±1 at /devtest/gpu.
export const GPU_EFFECTS: Record<string, GpuEffectDef> = {
  // 255 - x  (applyEffect → Konva.Filters.Invert)
  invert: { frag: f(`return 1.0 - c;`) },

  // Konva Sepia matrix (applyEffect → Konva.Filters.Sepia)
  sepia: {
    frag: f(`return vec3(
      dot(c, vec3(0.393, 0.769, 0.189)),
      dot(c, vec3(0.349, 0.686, 0.168)),
      dot(c, vec3(0.272, 0.534, 0.131)));`),
  },

  // Konva Contrast (applyEffect → Konva.Filters.Contrast):
  // adjust = ((contrast+100)/100)^2 ; (c-0.5)*adjust + 0.5
  contrast: {
    frag: f(`return (c - 0.5) * u_adjust + 0.5;`, `uniform float u_adjust;`),
    setUniforms: (gl, prog, p) =>
      setFloat(gl, prog, 'u_adjust', Math.pow(((p.contrast ?? 0) + 100) / 100, 2)),
  },

  // Konva HSL (applyEffect 'hue' → Konva.Filters.HSL): a YIQ-style rotation matrix
  // from hue/luminance, built JS-side to match Konva exactly.
  hue: { frag: hslFrag(), setUniforms: hslUniforms },

  // Exposure (levels → exposure(linear) → gamma) is one composed 256-byte LUT.
  // The GPU samples the SAME buildExposureLUT table the CPU applies → byte-exact.
  exposure: { frag: lutFrag(), buildLut: s => buildExposureLUT(s) },

  // Brightness is a per-channel linear-light LUT (createBrightnessEffect uses
  // makeExposureLUT(value/100) applied independently per channel) → byte-exact
  // via the same table. (Unlike grayscale/saturation, which couple channels and
  // stay on CPU.)
  brightness: {
    frag: lutFrag(),
    buildLut: s => makeExposureLUT(Math.max(-100, Math.min(100, s.value ?? 0)) / 100),
  },
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

export function buildGpuPass(
  effectId: string,
  params: Record<string, number>,
  settings?: Record<string, number>
): GpuPass | null {
  const def = GPU_EFFECTS[effectId];
  if (!def) return null;
  return {
    frag: def.frag,
    setUniforms: def.setUniforms ? (gl, prog) => def.setUniforms!(gl, prog, params) : undefined,
    lut: def.buildLut ? def.buildLut(settings ?? {}) : undefined,
  };
}

/** Effect ids that have a verified GPU shader. */
export function gpuEffectIds(): string[] {
  return Object.keys(GPU_EFFECTS);
}
