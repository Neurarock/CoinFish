// Soft triangle that arcs across the hero ripple surface every ~5s.
// Only active while the hero is in view; splash-in / splash-out use WaterRipple drops.
import { useEffect, useRef, useState } from "react";

const JUMPS = [
  // from/to as viewport fractions; size is relative to base (1 = current)
  { from: [0.12, 0.62], to: [0.42, 0.48], peak: 0.22, dur: 1400, size: 1 },
  { from: [0.78, 0.58], to: [0.48, 0.40], peak: 0.26, dur: 1500, size: 0.62 },
  { from: [0.28, 0.72], to: [0.68, 0.55], peak: 0.30, dur: 1600, size: 1 },
  { from: [0.55, 0.68], to: [0.22, 0.52], peak: 0.24, dur: 1450, size: 0.48 },
  { from: [0.18, 0.45], to: [0.72, 0.62], peak: 0.28, dur: 1550, size: 0.75 },
];

const FILL = "#ffffff";
const BASE_W = 36;
const BASE_H = 31;

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function sampleArc(from, to, peakY, t) {
  const e = easeInOut(t);
  const x = from[0] + (to[0] - from[0]) * e;
  const baseY = from[1] + (to[1] - from[1]) * e;
  const arc = 4 * peakY * e * (1 - e);
  const y = baseY - arc;
  const dt = 0.002;
  const t2 = Math.min(1, t + dt);
  const e2 = easeInOut(t2);
  const x2 = from[0] + (to[0] - from[0]) * e2;
  const baseY2 = from[1] + (to[1] - from[1]) * e2;
  const arc2 = 4 * peakY * e2 * (1 - e2);
  const y2 = baseY2 - arc2;
  const angle = Math.atan2(y2 - y, x2 - x);
  return { x, y, angle };
}

export default function TriangleJump({ rippleRef, active = true }) {
  const [frame, setFrame] = useState(null);
  const jumpIdx = useRef(0);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const activeRef = useRef(active);
  const splashTimers = useRef([]);

  useEffect(() => {
    activeRef.current = active;
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(timerRef.current);
      splashTimers.current.forEach((id) => window.clearTimeout(id));
      splashTimers.current = [];
      setFrame(null);
    }
  }, [active]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let cancelled = false;

    function splash(x, y, strength) {
      if (!activeRef.current) return;
      rippleRef?.current?.drop(x, y, strength);
    }

    function scheduleSplash(fn, delay) {
      const id = window.setTimeout(fn, delay);
      splashTimers.current.push(id);
    }

    function runJump() {
      if (cancelled || !activeRef.current) return;
      const spec = JUMPS[jumpIdx.current % JUMPS.length];
      jumpIdx.current += 1;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const from = [spec.from[0] * w, spec.from[1] * h];
      const to = [spec.to[0] * w, spec.to[1] * h];
      const peak = spec.peak * h;
      const size = spec.size ?? 1;

      splash(from[0], from[1], 3.6);
      scheduleSplash(() => splash(from[0], from[1], 1.4), 80);

      const start = performance.now();

      function tick(now) {
        if (cancelled || !activeRef.current) {
          setFrame(null);
          return;
        }
        const t = Math.min(1, (now - start) / spec.dur);
        const pose = sampleArc(from, to, peak, t);
        const opacity = t < 0.06 || t > 0.94 ? Math.min(t, 1 - t) / 0.06 : 1;

        setFrame({
          x: pose.x,
          y: pose.y,
          angle: pose.angle,
          opacity,
          size,
        });

        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          splash(to[0], to[1], 4.2);
          scheduleSplash(() => splash(to[0], to[1], 2.0), 70);
          scheduleSplash(() => splash(to[0] + 18, to[1] - 6, 1.1), 140);
          setFrame(null);
          if (activeRef.current) {
            timerRef.current = window.setTimeout(runJump, 5000);
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    if (active) {
      timerRef.current = window.setTimeout(runJump, 2200);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(timerRef.current);
      splashTimers.current.forEach((id) => window.clearTimeout(id));
      splashTimers.current = [];
    };
  }, [rippleRef, active]);

  if (!active || !frame) return null;

  const { x, y, angle, opacity, size } = frame;
  const deg = (angle * 180) / Math.PI;
  const w = Math.round(BASE_W * size);
  const h = Math.round(BASE_H * size);

  return (
    <div
      className="landing-triangle"
      aria-hidden="true"
      style={{
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${deg}deg)`,
        opacity,
      }}
    >
      <svg width={w} height={h} viewBox="0 0 56 48" className="landing-triangle-svg">
        <polygon points="28,4 52,44 4,44" fill={FILL} />
      </svg>
    </div>
  );
}
