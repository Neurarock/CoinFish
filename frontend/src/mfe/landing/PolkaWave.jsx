// White polka-dot grid with a stadium-style Mexican wave.
// Optional frostElRef: mobile Partner badge — canvas blur locked to the label
// each frame (CSS backdrop-filter cannot sample this layer on WebKit).
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
const FROST_BLUR = 10;
const FROST_TINT = "rgba(255, 255, 255, 0.14)";
const FROST_BORDER = "rgba(255, 255, 255, 0.28)";

function pathRoundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export default function PolkaWave({ frostElRef = null }) {
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
    let ratio = 1;
    const offscreen = document.createElement("canvas");
    const offCtx = offscreen.getContext("2d");
    const mobileMq = window.matchMedia(MOBILE_MQ);

    function dpr() {
      return Math.min(window.devicePixelRatio || 1, 2);
    }

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
      ratio = dpr();
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      cols = Math.ceil(w / gap) + 1;
      rows = Math.ceil(h / gap) + 1;
    }

    function readFrostRect() {
      if (!mobileMq.matches) return null;
      const el = frostElRef?.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      // Off-screen — skip
      if (r.bottom < 0 || r.top > h || r.right < 0 || r.left > w) return null;
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }

    function drawFrost(rect) {
      if (!offCtx || !rect) return;
      const { left: x, top: y, width: rw, height: rh } = rect;
      if (rw < 2 || rh < 2) return;

      const pad = FROST_BLUR * 2;
      const sx = Math.max(0, x - pad);
      const sy = Math.max(0, y - pad);
      const sw = Math.min(w - sx, rw + pad * 2);
      const sh = Math.min(h - sy, rh + pad * 2);
      if (sw < 2 || sh < 2) return;

      const ow = Math.max(1, Math.ceil(sw * ratio));
      const oh = Math.max(1, Math.ceil(sh * ratio));
      if (offscreen.width !== ow || offscreen.height !== oh) {
        offscreen.width = ow;
        offscreen.height = oh;
      }

      offCtx.setTransform(1, 0, 0, 1, 0, 0);
      offCtx.clearRect(0, 0, ow, oh);
      offCtx.filter = `blur(${FROST_BLUR * ratio}px)`;
      offCtx.drawImage(
        canvas,
        sx * ratio,
        sy * ratio,
        sw * ratio,
        sh * ratio,
        0,
        0,
        ow,
        oh,
      );
      offCtx.filter = "none";

      const rad = rh / 2;
      ctx.save();
      pathRoundRect(ctx, x, y, rw, rh, rad);
      ctx.clip();
      // Clear sharp dots under the pill, then draw the blurred sample (no black fill).
      ctx.clearRect(x, y, rw, rh);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(offscreen, sx * ratio, sy * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = FROST_TINT;
      pathRoundRect(ctx, x, y, rw, rh, rad);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = FROST_BORDER;
      ctx.lineWidth = 1;
      pathRoundRect(ctx, x, y, rw, rh, rad);
      ctx.stroke();
      ctx.restore();
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

      const frost = readFrostRect();
      if (frost) drawFrost(frost);

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
  }, [frostElRef]);

  return <canvas ref={canvasRef} className="landing-polka" aria-hidden="true" />;
}
