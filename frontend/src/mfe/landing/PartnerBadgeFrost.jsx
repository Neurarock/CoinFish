// Mobile Partner Portal frost — lives inside the CTA so the pill scrolls
// with the label. Samples the fixed water/polka canvases; CSS filter does
// the blur (Canvas 2D filter is ignored on iOS Brave).
import { useEffect, useRef } from "react";

const MOBILE_MQ = "(max-width: 720px)";
const FROST_PAD = 24;

export default function PartnerBadgeFrost({ hostRef, rippleRef, polkaCanvasRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const dest = canvasRef.current;
    if (!dest) return undefined;
    const destCtx = dest.getContext("2d", { alpha: true });
    if (!destCtx) return undefined;

    const mobileMq = window.matchMedia(MOBILE_MQ);
    let raf = 0;
    let running = true;

    function sources() {
      const water = rippleRef?.current?.getCanvas?.()
        ?? document.querySelector(".landing-ripple");
      const polka = polkaCanvasRef?.current
        ?? document.querySelector(".landing-polka");
      return [water, polka];
    }

    function paint() {
      if (!running || !mobileMq.matches) return;
      const host = hostRef?.current;
      if (!host) return;

      const r = host.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
        destCtx.clearRect(0, 0, dest.width, dest.height);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = r.width + FROST_PAD * 2;
      const cssH = r.height + FROST_PAD * 2;
      const bw = Math.max(1, Math.ceil(cssW * dpr));
      const bh = Math.max(1, Math.ceil(cssH * dpr));
      if (dest.width !== bw || dest.height !== bh) {
        dest.width = bw;
        dest.height = bh;
      }

      destCtx.setTransform(1, 0, 0, 1, 0, 0);
      destCtx.clearRect(0, 0, bw, bh);

      const sx = r.left - FROST_PAD;
      const sy = r.top - FROST_PAD;

      for (const src of sources()) {
        if (!src || src.width < 2 || src.height < 2) continue;
        const ratioX = src.width / (src.clientWidth || window.innerWidth);
        const ratioY = src.height / (src.clientHeight || window.innerHeight);
        destCtx.drawImage(
          src,
          sx * ratioX,
          sy * ratioY,
          cssW * ratioX,
          cssH * ratioY,
          0,
          0,
          bw,
          bh,
        );
      }
    }

    function loop() {
      if (!running) return;
      paint();
      raf = requestAnimationFrame(loop);
    }

    function onMq() {
      if (!mobileMq.matches) destCtx.clearRect(0, 0, dest.width, dest.height);
    }

    raf = requestAnimationFrame(loop);
    window.addEventListener("scroll", paint, { passive: true, capture: true });
    window.addEventListener("resize", paint, { passive: true });
    window.addEventListener("touchmove", paint, { passive: true });
    mobileMq.addEventListener("change", onMq);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", paint, { capture: true });
      window.removeEventListener("resize", paint);
      window.removeEventListener("touchmove", paint);
      mobileMq.removeEventListener("change", onMq);
    };
  }, [hostRef, rippleRef, polkaCanvasRef]);

  return (
    <span className="landing-cta-partner-frost" aria-hidden="true">
      <span className="landing-cta-partner-frost-blur">
        <canvas ref={canvasRef} />
      </span>
    </span>
  );
}
