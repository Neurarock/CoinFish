// Self-contained decorative QR. Deterministically derives a module grid from the
// payload string (no external lib / network). It's a stand-in for a real QR in
// the fiat top-up flow — scannable-looking, not actually decodable.
export default function QrCode({ payload = "", size = 132 }) {
  const n = 21;
  const cells = [];
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  const rand = () => ((state = Math.imul(state, 1103515245) + 12345) >>> 0) / 4294967296;

  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) cells.push(rand() > 0.5);

  const isFinder = (x, y) => {
    const inBox = (bx, by) => x >= bx && x < bx + 7 && y >= by && y < by + 7;
    return inBox(0, 0) || inBox(n - 7, 0) || inBox(0, n - 7);
  };
  const finderOn = (x, y) => {
    const local = (bx, by) => {
      const lx = x - bx, ly = y - by;
      const edge = lx === 0 || ly === 0 || lx === 6 || ly === 6;
      const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
      return edge || core;
    };
    if (x < 7 && y < 7) return local(0, 0);
    if (x >= n - 7 && y < 7) return local(n - 7, 0);
    if (x < 7 && y >= n - 7) return local(0, n - 7);
    return false;
  };

  const m = size / n;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 10, background: "#fff" }}>
      {cells.map((on, i) => {
        const x = i % n, y = Math.floor(i / n);
        const dark = isFinder(x, y) ? finderOn(x, y) : on;
        return dark ? <rect key={i} x={x * m} y={y * m} width={m} height={m} fill="#06324a" /> : null;
      })}
    </svg>
  );
}
