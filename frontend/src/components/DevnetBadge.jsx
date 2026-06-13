// Live, animated "XRPL Devnet" badge for the top-right corner. The morphing
// gradient + pulsing orb signal a live network; it links straight to the Devnet
// XRPL explorer. When Devnet setup is incomplete it falls back to a muted chip.
const EXPLORER = "https://devnet.xrpl.org";

export default function DevnetBadge({ status, href = EXPLORER }) {
  const ready = status ? status.devnet_ready : true;
  const label = status && !ready ? "Devnet setup" : "XRPL Devnet";
  const title = status?.warnings?.length ? status.warnings.join("\n") : "Open the XRPL Devnet explorer";
  return (
    <a
      className={`devnet-badge ${ready ? "" : "muted"}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
    >
      <span className="devnet-orb" />
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"
        style={{ flex: "none" }}>
        <path fill="currentColor"
          d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.5 3.6L12 11.5 5.5 7.9 12 4.3ZM5 9.5l6 3.3v6.6l-6-3.3V9.5Zm14 0v6.6l-6 3.3v-6.6l6-3.3Z" />
      </svg>
      <span>{label}</span>
      <span aria-hidden="true" style={{ opacity: 0.85 }}>↗</span>
    </a>
  );
}
