// White polka-dot grid with a stadium-style Mexican wave.
import { useEffect, useRef } from "react";

const GAP = 26;
const DOT_R = 1.05;
const WAVE_WIDTH = 5.5;
const WAVE_SPEED = 14; // columns per second
const BASE_RGB = "255, 255, 255";
const PEAK_ALPHA = 0.92;
const SHOW_THRESHOLD = 0.04;

export default function PolkaWave() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      const ratio = dpr();
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      cols = Math.ceil(w / GAP) + 1;
      rows = Math.ceil(h / GAP) + 1;
    }

    function frame(now) {
      if (!running) return;
      const t = now / 1000;
      const front = (t * WAVE_SPEED) % (cols + WAVE_WIDTH * 3) - WAVE_WIDTH;

      ctx.clearRect(0, 0, w, h);

      for (let row = 0; row < rows; row += 1) {
        const rowLag = row * 0.18;
        const y = GAP / 2 + row * GAP;
        for (let col = 0; col < cols; col += 1) {
          const x = GAP / 2 + col * GAP;
          const dist = col - (front - rowLag);
          const rise = Math.max(0, 1 - Math.abs(dist) / WAVE_WIDTH);
          const lift = rise * rise * (3 - 2 * rise);
          if (lift < SHOW_THRESHOLD) continue;

          const alpha = lift * PEAK_ALPHA;
          const radius = DOT_R * (1 + lift * 1.35);

          ctx.beginPath();
          ctx.fillStyle = `rgba(${BASE_RGB},${alpha})`;
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="landing-polka" aria-hidden="true" />;
}
