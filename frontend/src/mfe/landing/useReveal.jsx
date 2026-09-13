// Scroll-triggered reveal for marketing boxes — IntersectionObserver + CSS.
import { useEffect, useRef } from "react";

export function useReveal(options = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      el.querySelectorAll("[data-reveal-child]").forEach((child) => {
        child.classList.add("is-in");
      });
      return;
    }

    const kids = () => [...el.querySelectorAll("[data-reveal-child]")];

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          kids().forEach((child, i) => {
            child.style.setProperty("--reveal-delay", `${i * 90}ms`);
            // Stagger via rAF so paint sees the base state first.
            requestAnimationFrame(() => {
              requestAnimationFrame(() => child.classList.add("is-in"));
            });
          });
          io.unobserve(entry.target);
        });
      },
      {
        threshold: options.threshold ?? 0.18,
        rootMargin: options.rootMargin ?? "0px 0px -8% 0px",
      },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [options.threshold, options.rootMargin]);

  return ref;
}

export function Reveal({ as: Tag = "div", className = "", children, ...rest }) {
  const ref = useReveal();
  return (
    <Tag ref={ref} className={`reveal ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
