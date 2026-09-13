// Live, animated "XRPL Devnet" badge for the top-right corner. The morphing
// gradient + pulsing orb signal a live network; it links straight to the Devnet
// XRPL explorer.
const EXPLORER = "https://devnet.xrpl.org";

export default function DevnetBadge({ href = EXPLORER }) {
  return (
    <a
      className="devnet-badge"
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Open the XRPL Devnet explorer"
    >
      <span className="devnet-orb" />
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"
        style={{ flex: "none" }}>
        <path fill="currentColor"
          d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.5 3.6L12 11.5 5.5 7.9 12 4.3ZM5 9.5l6 3.3v6.6l-6-3.3V9.5Zm14 0v6.6l-6 3.3v-6.6l6-3.3Z" />
      </svg>
      <span>XRPL Devnet</span>
      <span aria-hidden="true" style={{ opacity: 0.85 }}>↗</span>
    </a>
  );
}
