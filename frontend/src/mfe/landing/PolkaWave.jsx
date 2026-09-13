// White polka-dot grid with a stadium-style Mexican wave.
import { useEffect, useRef } from "react";

const GAP_DESKTOP = 26;
const GAP_MOBILE = 13; // 2× denser than desktop
const MOBILE_MQ = "(max-width: 720px)";
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
    let gap = GAP_DESKTOP;
    let waveSpeed = WAVE_SPEED;
    let waveWidth = WAVE_WIDTH;
    let intervalScale = 1;
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
    const mobileMq = window.matchMedia(MOBILE_MQ);

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      const mobile = mobileMq.matches;
      gap = mobile ? GAP_MOBILE : GAP_DESKTOP;
      // Denser mobile grid: 2× crest width in columns. Speed was WAVE_SPEED*2 for
      // visual parity; half that → WAVE_SPEED. Interval between waves is 2×.
      waveSpeed = WAVE_SPEED;
      waveWidth = mobile ? WAVE_WIDTH * 2 : WAVE_WIDTH;
      intervalScale = mobile ? 2 : 1;
      const ratio = dpr();
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      cols = Math.ceil(w / gap) + 1;
      rows = Math.ceil(h / gap) + 1;
    }

    function frame(now) {
      if (!running) return;
      const t = now / 1000;
      const cycle = (cols + waveWidth * 3) * intervalScale;
      const front = (t * waveSpeed) % cycle - waveWidth;

      ctx.clearRect(0, 0, w, h);

      for (let row = 0; row < rows; row += 1) {
        const rowLag = row * 0.18;
        const y = gap / 2 + row * gap;
        for (let col = 0; col < cols; col += 1) {
          const x = gap / 2 + col * gap;
          const dist = col - (front - rowLag);
          const rise = Math.max(0, 1 - Math.abs(dist) / waveWidth);
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
