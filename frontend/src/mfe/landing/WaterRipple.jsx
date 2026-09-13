// Cursor-driven water heightfield. Exposes drop(x,y,strength) for hero jumps.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const WaterRipple = forwardRef(function WaterRipple(_, ref) {
  const canvasRef = useRef(null);
  const dropRef = useRef(null);

  useImperativeHandle(ref, () => ({
    drop(x, y, strength = 1) {
      dropRef.current?.(x, y, strength);
    },
    getCanvas() {
      return canvasRef.current;
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let curr;
    let prev;
    let img;
    let offscreen;
    let offCtx;
    let pointerX = -1;
    let pointerY = -1;
    let lastDropX = -1;
    let lastDropY = -1;
    let smoothX = -1;
    let smoothY = -1;
    let lastTs = 0;

    const deep = [6, 16, 24];
    const mid = [14, 58, 74];
    const light = [56, 168, 186];
    const foam = [186, 230, 236];

    const CELL = 4;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      width = box.width || window.innerWidth;
      height = box.height || window.innerHeight;
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgb(${deep[0]},${deep[1]},${deep[2]})`;
      ctx.fillRect(0, 0, width, height);

      cols = Math.ceil(width / CELL) + 2;
      rows = Math.ceil(height / CELL) + 2;
      curr = new Float32Array(cols * rows);
      prev = new Float32Array(cols * rows);
      img = ctx.createImageData(cols, rows);
      offscreen = document.createElement("canvas");
      offscreen.width = cols;
      offscreen.height = rows;
      offCtx = offscreen.getContext("2d");
      for (let i = 0; i < cols * rows; i++) {
        const o = i * 4;
        img.data[o] = deep[0];
        img.data[o + 1] = deep[1];
        img.data[o + 2] = deep[2];
        img.data[o + 3] = 255;
      }
    }

    function drop(x, y, strength = 1) {
      if (!curr) return;
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      const radius = 3;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx <= 0 || ny <= 0 || nx >= cols - 1 || ny >= rows - 1) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius) continue;
          const falloff = (1 - dist / radius) ** 2;
          curr[ny * cols + nx] += strength * falloff * 2.8;
        }
      }
    }

    dropRef.current = drop;

    function step() {
      for (let y = 1; y < rows - 1; y++) {
        const row = y * cols;
        for (let x = 1; x < cols - 1; x++) {
          const i = row + x;
          const val =
            (curr[i - 1] + curr[i + 1] + curr[i - cols] + curr[i + cols]) / 2 -
            prev[i];
          prev[i] = val * 0.94;
        }
      }
      const swap = curr;
      curr = prev;
      prev = swap;
    }

    function render() {
      const data = img.data;
      const fadeSpan = Math.max(1, rows - 1);
      for (let y = 0; y < rows; y++) {
        const row = y * cols;
        const lift = (1 - y / fadeSpan) * 0.85;
        const baseR = deep[0] + (mid[0] - deep[0]) * lift;
        const baseG = deep[1] + (mid[1] - deep[1]) * lift;
        const baseB = deep[2] + (mid[2] - deep[2]) * lift;
        for (let x = 0; x < cols; x++) {
          const i = row + x;
          const o = i * 4;
          let r = baseR;
          let g = baseG;
          let b = baseB;

          if (x > 0 && y > 0 && x < cols - 1 && y < rows - 1) {
            const h = curr[i];
            const nx = curr[i - 1] - curr[i + 1];
            const ny = curr[i - cols] - curr[i + cols];
            const shade = Math.max(-1, Math.min(1, nx * 0.35 + ny * 0.2 + h * 0.08));

            const crest = Math.max(0, shade);
            r += (light[0] - r) * crest * 0.55;
            g += (light[1] - g) * crest * 0.55;
            b += (light[2] - b) * crest * 0.55;
            if (crest > 0.55) {
              const foamMix = (crest - 0.55) / 0.45;
              r += (foam[0] - r) * foamMix * 0.35;
              g += (foam[1] - g) * foamMix * 0.35;
              b += (foam[2] - b) * foamMix * 0.35;
            }
            const trough = Math.max(0, -shade);
            r -= trough * 18;
            g -= trough * 12;
            b -= trough * 8;
          }

          data[o] = r | 0;
          data[o + 1] = g | 0;
          data[o + 2] = b | 0;
          data[o + 3] = 255;
        }
      }

      offCtx.putImageData(img, 0, 0);
      ctx.fillStyle = `rgb(${deep[0]},${deep[1]},${deep[2]})`;
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(offscreen, 0, 0, width, height);
    }

    function frame(ts) {
      if (!running) return;
      const dt = Math.min(32, ts - lastTs || 16);
      lastTs = ts;

      if (pointerX >= 0) {
        if (smoothX < 0) {
          smoothX = pointerX;
          smoothY = pointerY;
        } else {
          const ease = 1 - Math.exp(-dt * 0.012);
          smoothX += (pointerX - smoothX) * ease;
          smoothY += (pointerY - smoothY) * ease;
        }
        const moved =
          Math.hypot(smoothX - lastDropX, smoothY - lastDropY) > 4 ||
          lastDropX < 0;
        if (moved) {
          const speed = Math.min(
            1.6,
            Math.hypot(smoothX - lastDropX, smoothY - lastDropY) / 28,
          );
          drop(smoothX, smoothY, 0.45 + speed);
          lastDropX = smoothX;
          lastDropY = smoothY;
        }
      }

      if (Math.random() < 0.02) {
        drop(Math.random() * width, Math.random() * height * 0.7, 0.35);
      }

      step();
      render();
      raf = requestAnimationFrame(frame);
    }

    function onMove(e) {
      pointerX = e.clientX;
      pointerY = e.clientY;
    }
    function onLeave() {
      pointerX = -1;
      pointerY = -1;
      lastDropX = -1;
      lastDropY = -1;
    }
    function onClick(e) {
      drop(e.clientX, e.clientY, 3.2);
    }
    function onTouch(e) {
      const t = e.touches[0];
      if (!t) return;
      pointerX = t.clientX;
      pointerY = t.clientY;
    }

    resize();
    drop(width * 0.35, height * 0.28, 4);
    drop(width * 0.62, height * 0.42, 2.2);
    raf = requestAnimationFrame(frame);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("click", onClick);
    window.addEventListener("touchmove", onTouch, { passive: true });

    return () => {
      running = false;
      dropRef.current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("click", onClick);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="landing-ripple"
      aria-hidden="true"
    />
  );
});

export default WaterRipple;
