/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      keyframes: {
        // wobbly pool-surface wave used by the PoolWater component
        wave: {
          "0%": { transform: "translateX(0) translateZ(0)" },
          "100%": { transform: "translateX(-50%) translateZ(0)" },
        },
        bob: {
          "0%,100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-6px) rotate(3deg)" },
        },
        swim: {
          "0%": { transform: "translateX(-10%)" },
          "100%": { transform: "translateX(110%)" },
        },
        ripple: {
          "0%": { transform: "scale(0.6)", opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
      },
      animation: {
        wave: "wave 7s linear infinite",
        "wave-slow": "wave 11s linear infinite",
        bob: "bob 4s ease-in-out infinite",
        swim: "swim 14s linear infinite",
        ripple: "ripple 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
