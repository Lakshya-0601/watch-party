import type { ServiceId } from "@/lib/types";

/**
 * Lightweight, stylised brand marks for each streaming service, drawn as
 * inline SVG so there are no external image requests. Swap for official
 * logo assets (per each brand's usage guidelines) before shipping.
 */
export function BrandMark({ id, className }: { id: ServiceId; className?: string }) {
  const common = { className, "aria-hidden": true, viewBox: "0 0 120 48" } as const;

  switch (id) {
    case "netflix":
      return (
        <svg {...common}>
          {/* Ribbon "N": two posts and a diagonal sash */}
          <g transform="translate(46 4)">
            <rect x="0" y="0" width="9" height="40" fill="#b1060f" />
            <rect x="19" y="0" width="9" height="40" fill="#b1060f" />
            <polygon points="0,0 9,0 28,40 19,40" fill="#e50914" />
          </g>
        </svg>
      );
    case "disney":
      return (
        <svg {...common}>
          <text
            x="60"
            y="33"
            textAnchor="middle"
            fill="#fff"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontStyle="italic"
            fontWeight="700"
            fontSize="26"
          >
            Disney
          </text>
          <text x="104" y="27" fill="#5fb4ff" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="22">
            +
          </text>
          <path d="M20 38 Q60 14 104 22" stroke="#5fb4ff" strokeWidth="1.5" fill="none" opacity="0.8" />
        </svg>
      );
    case "prime":
      return (
        <svg {...common}>
          <text
            x="60"
            y="27"
            textAnchor="middle"
            fill="#fff"
            fontFamily="Arial, Helvetica, sans-serif"
            fontWeight="700"
            fontSize="22"
          >
            prime
          </text>
          <text x="60" y="42" textAnchor="middle" fill="#8fd3ff" fontFamily="Arial, sans-serif" fontSize="10" letterSpacing="2">
            VIDEO
          </text>
          <path d="M34 31 Q60 40 84 30" stroke="#1fa8ff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M80 27 l5 3 -5 2.5" stroke="#1fa8ff" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      );
    case "appletv":
      return (
        <svg {...common}>
          <text
            x="60"
            y="33"
            textAnchor="middle"
            fill="#fff"
            fontFamily="-apple-system, 'SF Pro Display', Arial, sans-serif"
            fontWeight="600"
            fontSize="26"
            letterSpacing="-0.5"
          >
            tv+
          </text>
        </svg>
      );
    case "max":
      return (
        <svg {...common}>
          <text
            x="60"
            y="35"
            textAnchor="middle"
            fill="#fff"
            fontFamily="Arial Black, Arial, sans-serif"
            fontWeight="900"
            fontSize="30"
            letterSpacing="-1"
          >
            max
          </text>
        </svg>
      );
    case "hulu":
      return (
        <svg {...common}>
          <text
            x="60"
            y="35"
            textAnchor="middle"
            fill="#1ce783"
            fontFamily="Arial Black, Arial, sans-serif"
            fontWeight="900"
            fontSize="30"
          >
            hulu
          </text>
        </svg>
      );
    case "crunchyroll":
      return (
        <svg {...common}>
          {/* Orange disc with an offset cut-out */}
          <circle cx="60" cy="24" r="18" fill="#f47521" />
          <circle cx="66" cy="20" r="10" fill="#fff" />
          <circle cx="69" cy="18" r="4" fill="#f47521" />
        </svg>
      );
  }
}
