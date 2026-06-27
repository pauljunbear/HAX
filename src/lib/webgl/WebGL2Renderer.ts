/**
 * WebGL2Renderer - GPU effect chain via fragment shaders.
 *
 * Uploads an ImageData to a texture, runs a chain of fragment-shader passes
 * with ping-pong framebuffers, and reads the result back to an ImageData. One
 * upload + one readback for the whole chain, so a stack of GPU effects avoids
 * the per-effect main-thread pixel loops.
 *
 * Safe by construction: every entry point returns null on any failure (no GL2,
 * shader compile error, lost context), and the caller falls back to the CPU
 * pipeline. Position-independent colour effects are verified byte-for-byte
 * against their CPU counterparts in the headless-Chrome harness before they are
 * allowed into the GPU set.
 */

export interface GpuPass {
  /** Fragment shader source (GLSL ES 3.00). Must define `out vec4 outColor`. */
  frag: string;
  /** Set uniforms for this pass (program is already in use). */
  setUniforms?: (gl: WebGL2RenderingContext, program: WebGLProgram) => void;
}

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 outColor;
`;

export class WebGL2Renderer {
  private gl: WebGL2RenderingContext | null = null;
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private quad: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private programs = new Map<string, WebGLProgram>();
  private failed = false;

  private ensureContext(): WebGL2RenderingContext | null {
    if (this.gl) return this.gl;
    if (this.failed) return null;
    try {
      const canvas: HTMLCanvasElement | OffscreenCanvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(1, 1)
          : document.createElement('canvas');
      const gl = canvas.getContext('webgl2', {
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        antialias: false,
      }) as WebGL2RenderingContext | null;
      if (!gl) {
        this.failed = true;
        return null;
      }
      this.canvas = canvas;
      this.gl = gl;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);

      this.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.vao = gl.createVertexArray();
      return gl;
    } catch {
      this.failed = true;
      return null;
    }
  }

  isSupported(): boolean {
    return this.ensureContext() !== null;
  }

  private compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      // eslint-disable-next-line no-console
      console.warn('GPU shader compile failed:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  private program(gl: WebGL2RenderingContext, frag: string): WebGLProgram | null {
    const cached = this.programs.get(frag);
    if (cached) return cached;
    const vs = this.compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = this.compile(gl, gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    if (!prog) return null;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      // eslint-disable-next-line no-console
      console.warn('GPU program link failed:', gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    this.programs.set(frag, prog);
    return prog;
  }

  private makeTexture(
    gl: WebGL2RenderingContext,
    w: number,
    h: number,
    src: ImageData | null
  ): WebGLTexture | null {
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    if (src) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    return tex;
  }

  /**
   * Run the pass chain over `source`. Returns a NEW ImageData, or null if GPU
   * is unavailable / anything fails (caller falls back to CPU). The caller may
   * copy result.data back into the source.
   */
  render(source: ImageData, passes: GpuPass[]): ImageData | null {
    if (passes.length === 0) return null;
    const gl = this.ensureContext();
    if (!gl) return null;
    const w = source.width;
    const h = source.height;

    let texA: WebGLTexture | null = null;
    let texB: WebGLTexture | null = null;
    let fbo: WebGLFramebuffer | null = null;
    try {
      texA = this.makeTexture(gl, w, h, source);
      texB = this.makeTexture(gl, w, h, null);
      fbo = gl.createFramebuffer();
      if (!texA || !texB || !fbo) return null;

      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.viewport(0, 0, w, h);

      let src = texA;
      let dst = texB;
      for (const pass of passes) {
        const prog = this.program(gl, pass.frag);
        if (!prog) return null;
        gl.useProgram(prog);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dst, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src);
        const uTex = gl.getUniformLocation(prog, 'u_tex');
        if (uTex) gl.uniform1i(uTex, 0);
        const uRes = gl.getUniformLocation(prog, 'u_resolution');
        if (uRes) gl.uniform2f(uRes, w, h);
        if (pass.setUniforms) pass.setUniforms(gl, prog);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const t = src;
        src = dst;
        dst = t;
      }

      // src now holds the final result; read it back.
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, src, 0);
      const out = new Uint8ClampedArray(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);
      return new ImageData(out, w, h);
    } catch {
      return null;
    } finally {
      if (texA) gl.deleteTexture(texA);
      if (texB) gl.deleteTexture(texB);
      if (fbo) gl.deleteFramebuffer(fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  }

  /** Build a complete fragment shader from a body that computes `vec3 effect(vec3 c)`. */
  static colorFrag(body: string, uniforms = ''): string {
    return `${FRAG_HEADER}${uniforms}
vec3 effect(vec3 c) {
${body}
}
void main() {
  vec4 src = texture(u_tex, v_uv);
  outColor = vec4(clamp(effect(src.rgb), 0.0, 1.0), src.a);
}`;
  }
}

let singleton: WebGL2Renderer | null = null;
export function getWebGL2Renderer(): WebGL2Renderer {
  if (!singleton) singleton = new WebGL2Renderer();
  return singleton;
}
