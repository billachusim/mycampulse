import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  className?: string;
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

/**
 * Campulse brand mark — matches the favicon (navy tile, amber circle outline,
 * amber diamond), but rendered crisp at any size and optionally paired with
 * the wordmark for use as a full logo.
 */
export function BrandLogo({ size = 40, className, withWordmark = false, wordmarkClassName }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 192 192"
        role="img"
        aria-label="Campulse logo"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="campulse-tile" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1b2030" />
            <stop offset="100%" stopColor="#0f1320" />
          </linearGradient>
          <linearGradient id="campulse-amber" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f6c987" />
            <stop offset="100%" stopColor="#e8a44a" />
          </linearGradient>
        </defs>
        <rect width="192" height="192" rx="44" fill="url(#campulse-tile)" />
        <circle
          cx="96"
          cy="96"
          r="58"
          fill="none"
          stroke="url(#campulse-amber)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M96 42 L120 72 L96 102 L72 72 Z"
          fill="url(#campulse-amber)"
        />
      </svg>
      {withWordmark ? (
        <span className={cn("font-display tracking-tight", wordmarkClassName)}>campulse</span>
      ) : null}
    </span>
  );
}
