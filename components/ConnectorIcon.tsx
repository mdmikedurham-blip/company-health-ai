import type { ConnectorId } from "@/lib/domain";

const iconClass = "h-6 w-6";

export function ConnectorIcon({
  id,
  className = iconClass,
}: {
  id: ConnectorId;
  className?: string;
}) {
  switch (id) {
    case "google_drive":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M7.71 3.5L1.15 15l3.43 5.5h6.84l6.56-10.5H7.71z" opacity="0.9" />
          <path d="M12.99 20.5h6.84L23.27 15l-3.43-5.5h-6.84L12.99 20.5z" opacity="0.7" />
          <path d="M1.15 15l3.43 5.5h6.84l3.43-5.5L11.15 9.5H4.58L1.15 15z" opacity="0.5" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2zm0 4h5v2H8v-2z" />
        </svg>
      );
    case "quickbooks":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "carta":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <path d="M4 18V6l8-3 8 3v12l-8 3-8-3zm2-1.24l6 2.25 6-2.25V7.01l-6 2.25-6-2.25v9.75z" />
        </svg>
      );
    case "hubspot":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor">
          <circle cx="12" cy="12" r="3" />
          <circle cx="5" cy="8" r="2" />
          <circle cx="19" cy="8" r="2" />
          <circle cx="5" cy="16" r="2" />
          <circle cx="19" cy="16" r="2" />
          <path
            d="M7 9l3 2M17 9l-3 2M7 15l3-2M17 15l-3-2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      );
  }
}
