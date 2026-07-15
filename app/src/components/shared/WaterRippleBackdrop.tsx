import { useEffect, useRef, useState } from "react";

import { AnimatedFeedBackdrop } from "@/components/shared/AnimatedFeedBackdrop";

/**
 * WaterRippleBackdrop
 *
 * Client-only ambient background for the login page. Renders a raw WebGL1
 * fragment shader that draws the whole backdrop (dark ground + soft warm/blue
 * orbs sampled from the AnimatedFeedBackdrop palette) and adds gentle liquid
 * ripples that follow the pointer, refracting the orb field and adding a subtle
 * specular sheen.
 *
 * Fallback chain — if any of these hold we skip WebGL entirely and render the
 * existing AnimatedFeedBackdrop so the page looks identical to today:
 *   - WebGL context / shader creation fails
 *   - prefers-reduced-motion: reduce
 *   - the primary pointer is coarse (touch) — matchMedia('(pointer: fine)') false
 */

const MAX_RIPPLES = 16;

const VERTEX_SHADER = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// gl_FragCoord is in drawing-buffer pixels; u_res matches. Ripple positions are
// supplied in the same drawing-buffer pixel space (Y already flipped to bottom-up).
const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec4 u_ripples[${MAX_RIPPLES}]; // xy = center px, z = startTime s, w = strength

const float RIPPLE_SPEED = 260.0;   // px / second
const float RIPPLE_SIGMA = 34.0;    // ring cross-section width (px)
const float RIPPLE_LIFE = 3.0;      // seconds
const float RIPPLE_DECAY = 1.6;

float rippleHeight(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = u_ripples[i];
    if (r.w <= 0.0) { continue; }
    float age = u_time - r.z;
    if (age < 0.0 || age > RIPPLE_LIFE) { continue; }
    float dist = distance(p, r.xy);
    float radius = age * RIPPLE_SPEED;
    float ring = dist - radius;
    float gauss = exp(-(ring * ring) / (2.0 * RIPPLE_SIGMA * RIPPLE_SIGMA));
    float phase = ring * 0.10;
    float decay = exp(-RIPPLE_DECAY * age);
    h += sin(phase) * gauss * decay * r.w;
  }
  return h;
}

// Soft gaussian blob in aspect-corrected uv space.
float glow(vec2 uv, vec2 c, float radius) {
  float d = distance(uv, c);
  return exp(-(d * d) / (2.0 * radius * radius));
}

vec3 orbField(vec2 uv, float t) {
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 auv = vec2(uv.x * aspect, uv.y);

  vec3 col = vec3(0.0353, 0.0510, 0.0784); // #090d14 ground

  // Centers drift very slowly for ambient life (tiny amplitude).
  vec2 c1 = vec2(0.16 * aspect, 0.10) + vec2(sin(t * 0.09), cos(t * 0.07)) * 0.02;
  vec2 c2 = vec2(0.62 * aspect, 0.66) + vec2(cos(t * 0.06), sin(t * 0.08)) * 0.025;
  vec2 c3 = vec2(0.22 * aspect, 0.82) + vec2(sin(t * 0.05), cos(t * 0.05)) * 0.02;
  vec2 c4 = vec2(0.80 * aspect, 0.20) + vec2(cos(t * 0.08), sin(t * 0.06)) * 0.02;

  // Blue-family orbs (backdrop-orb-1 / -3 / -5) + one warm brand glow.
  col += vec3(0.251, 0.412, 0.706) * 0.12 * glow(auv, c1, 0.42);
  col += vec3(0.204, 0.306, 0.510) * 0.10 * glow(auv, c2, 0.46);
  col += vec3(0.290, 0.470, 0.784) * 0.08 * glow(auv, c3, 0.40);
  col += vec3(0.871, 0.251, 0.165) * 0.06 * glow(auv, c4, 0.34);

  // Faint top vignette (matches rgba(255,255,255,0.03) ellipse at top).
  float top = 1.0 - smoothstep(0.0, 0.55, distance(vec2(uv.x, uv.y), vec2(0.5, 0.08)));
  col += vec3(1.0) * 0.03 * top;

  return col;
}

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 uv = p / u_res;

  // Height + finite-difference gradient of the ripple field.
  float e = 2.0;
  float h = rippleHeight(p);
  float hx = rippleHeight(p + vec2(e, 0.0)) - rippleHeight(p - vec2(e, 0.0));
  float hy = rippleHeight(p + vec2(0.0, e)) - rippleHeight(p - vec2(0.0, e));
  vec2 grad = vec2(hx, hy); // difference over ~2e px

  // Refraction: shift the sampled orb-field position by the gradient.
  vec2 refr = grad * 0.16;
  vec3 col = orbField(uv + refr, u_time);

  // Subtle specular sheen — perturb the surface normal by the gradient.
  vec3 normal = normalize(vec3(-grad * 9.0, 1.0));
  vec3 lightDir = normalize(vec3(0.35, 0.55, 0.78));
  float spec = pow(max(dot(normal, lightDir), 0.0), 42.0) * 0.22;
  col += vec3(0.96, 0.97, 1.0) * spec;

  gl_FragColor = vec4(col, 1.0);
}
`;

type GLState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  posLoc: number;
  uRes: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uRipples: WebGLUniformLocation | null;
};

const compileShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createGLState = (canvas: HTMLCanvasElement): GLState | null => {
  const gl =
    (canvas.getContext("webgl", { alpha: false, antialias: false, depth: false }) as
      | WebGLRenderingContext
      | null) ??
    (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
  if (!gl) {
    return null;
  }

  const vert = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vert || !frag) {
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    return null;
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    return null;
  }
  // Full-screen triangle.
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );

  const posLoc = gl.getAttribLocation(program, "a_pos");

  return {
    gl,
    program,
    buffer,
    posLoc,
    uRes: gl.getUniformLocation(program, "u_res"),
    uTime: gl.getUniformLocation(program, "u_time"),
    uRipples: gl.getUniformLocation(program, "u_ripples"),
  };
};

export const WaterRippleBackdrop = ({ className = "" }: { className?: string }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const pointerFine = window.matchMedia("(pointer: fine)").matches;
    if (prefersReducedMotion || !pointerFine) {
      setUseFallback(true);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      setUseFallback(true);
      return;
    }

    // Create the canvas inside the effect: React StrictMode runs this effect
    // twice, and the cleanup's loseContext() permanently kills the context of
    // the element it ran on — a fresh canvas per effect run avoids re-using a
    // lost context on the second mount.
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "absolute inset-0 h-full w-full";
    container.appendChild(canvas);

    const state = createGLState(canvas);
    if (!state) {
      canvas.remove();
      setUseFallback(true);
      return;
    }

    const { gl, program, buffer, posLoc, uRes, uTime, uRipples } = state;

    // Ring buffer of ripple uniforms: [x, y, startTime, strength] * MAX_RIPPLES.
    const ripples = new Float32Array(MAX_RIPPLES * 4);
    let rippleCursor = 0;

    const resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
    let cssWidth = window.innerWidth;
    let cssHeight = window.innerHeight;

    const resize = () => {
      cssWidth = window.innerWidth;
      cssHeight = window.innerHeight;
      const width = Math.max(1, Math.floor(cssWidth * resolutionScale));
      const height = Math.max(1, Math.floor(cssHeight * resolutionScale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();

    const startTime = performance.now();
    const nowSeconds = () => (performance.now() - startTime) / 1000;

    let lastEmitTime = -1;
    let lastEmitX = 0;
    let lastEmitY = 0;

    const emitRipple = (clientX: number, clientY: number, strength: number) => {
      // Convert CSS px -> drawing-buffer px, flipping Y (gl_FragCoord is bottom-up).
      const x = (clientX / cssWidth) * canvas.width;
      const y = (1 - clientY / cssHeight) * canvas.height;
      const base = rippleCursor * 4;
      ripples[base] = x;
      ripples[base + 1] = y;
      ripples[base + 2] = nowSeconds();
      ripples[base + 3] = strength;
      rippleCursor = (rippleCursor + 1) % MAX_RIPPLES;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const t = nowSeconds();
      const dx = event.clientX - lastEmitX;
      const dy = event.clientY - lastEmitY;
      const movedFar = dx * dx + dy * dy > 40 * 40;
      const enoughTime = t - lastEmitTime > 0.09;
      if (lastEmitTime < 0 || movedFar || enoughTime) {
        emitRipple(event.clientX, event.clientY, 0.5);
        lastEmitTime = t;
        lastEmitX = event.clientX;
        lastEmitY = event.clientY;
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      emitRipple(event.clientX, event.clientY, 1.1);
      lastEmitTime = nowSeconds();
      lastEmitX = event.clientX;
      lastEmitY = event.clientY;
    };

    let rafId = 0;
    let running = true;

    const render = () => {
      if (!running) {
        return;
      }
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      if (uRes) {
        gl.uniform2f(uRes, canvas.width, canvas.height);
      }
      if (uTime) {
        gl.uniform1f(uTime, nowSeconds());
      }
      if (uRipples) {
        gl.uniform4fv(uRipples, ripples);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafId = window.requestAnimationFrame(render);
    };

    const start = () => {
      if (!running) {
        running = true;
        rafId = window.requestAnimationFrame(render);
      }
    };

    const stop = () => {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        start();
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);

    rafId = window.requestAnimationFrame(render);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("visibilitychange", handleVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      const loseContext = gl.getExtension("WEBGL_lose_context");
      loseContext?.loseContext();
      canvas.remove();
    };
  }, []);

  if (useFallback) {
    return <AnimatedFeedBackdrop className={`opacity-[0.85] ${className}`.trim()} />;
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 ${className}`.trim()}
      ref={containerRef}
    />
  );
};

export default WaterRippleBackdrop;
