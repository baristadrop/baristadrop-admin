type Props = { className?: string };

const base = 'h-[18px] w-[18px]';

export function OverviewIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="3" width="8" height="5" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13" y="12" width="8" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function TrophyIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7 4h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 13v3M9 20h6M9.5 20c0-2 .5-3 2.5-4 2 1 2.5 2 2.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CupIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 8h11v6a5.5 5.5 0 0 1-5.5 5.5h0A5.5 5.5 0 0 1 5 14V8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 5.5c0-1 1-1 1-2M12 5.5c0-1 1-1 1-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BeanIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3c-5 1-8 5-8 9a8 8 0 0 0 16 0c0-4-3-8-8-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 19c0-5 1-8 6-12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function FlameIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3s5 4.5 5 9.5a5 5 0 0 1-10 0c0-1.3.5-2.3 1.2-3.2.3 1 1 1.3 1.5.9C9 8.8 8.5 6.5 10 4c.5 2 1.2 2.3 2 -1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StorefrontIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 8l1.5-4h13L20 8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 8v11h16V8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 19v-5h6v5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 8a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function TruckIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 7h10v9H3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13 10h4l3 3v3h-7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="7" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="18" r="1.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function BagIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 8h12l1 12H5L6 8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ReceiptIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21V3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function UsersIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15.5 6.5a3 3 0 0 1 0 5.8M20 19a4.8 4.8 0 0 0-4-4.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PulseIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 12h4l2-7 4 14 2-9 1.5 2H21"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BellIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 17.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function CoinIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7.5v9M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.7 2.5 1.8c0 2.4-5 1.4-5 3.8 0 1.1 1.1 1.9 2.5 1.9s2.5-.9 2.5-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CursorClickIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 4l3.5 14 2.2-4.8L16.5 15 18 13.5l-4.8-2.8L18 6 6 4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NetworkIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="5" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="19" cy="6" r="2.3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="18" r="2.3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 7.3 10.3 16M17 7.3 13.7 16M7.3 6h9.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function TargetIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function LinkIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M10 14a4 4 0 0 1 0-5.7l2.5-2.5a4 4 0 0 1 5.7 5.7L17 12.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14 10a4 4 0 0 1 0 5.7l-2.5 2.5a4 4 0 0 1-5.7-5.7L7 11.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function ScaleIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3v18M8 21h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 6 5 8l3.5 6.5L12 13l3.5 1.5L19 8l-7-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5 8a3 3 0 0 0 3.5 4.5M19 8a3 3 0 0 1-3.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function WalletIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function TagIcon({ className = base }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M11.5 3.5H5A1.5 1.5 0 0 0 3.5 5v6.5a1.5 1.5 0 0 0 .44 1.06l9 9a1.5 1.5 0 0 0 2.12 0l6.5-6.5a1.5 1.5 0 0 0 0-2.12l-9-9a1.5 1.5 0 0 0-1.06-.44Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}
