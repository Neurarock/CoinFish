// CoinFish brand mark. logo.png ships with a transparent background, so it sits
// cleanly on every themed surface (white lender, black borrower, pink vault).
// A soft morphing aura behind it keeps the "expensive" feel without tinting the
// artwork itself.
import { Link } from "react-router-dom";
import logo from "../logo.png";

export default function Logo({ size = 30, aura = true, className = "", to }) {
  const mark = (
    <span className={`inline-grid place-items-center ${aura ? "morph-aura" : ""} ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size / 3) }}>
      <img src={logo} alt="CoinFish" width={size} height={size}
        style={{ width: size, height: size, objectFit: "contain", display: "block" }} />
    </span>
  );
  if (!to) return mark;
  return <Link to={to} aria-label="CoinFish home" className="inline-flex">{mark}</Link>;
}
