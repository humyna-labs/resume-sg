import type { ReactNode } from "react";

function Svg({ size, sw = 2, children }: { size: number; sw?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const FreeIcon = () => (
  <Svg size={22}>
    <path d="M20 12v9H4v-9" />
    <path d="M2 7h20v5H2z" />
    <path d="M12 21V7" />
    <path d="M12 7c-2-4-6-3-6-1s3 1 6 1c3 0 6 1 6-1s-4-3-6 1z" />
  </Svg>
);
export const LockIcon = () => (
  <Svg size={22}>
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
);
export const CheckIcon = () => (
  <Svg size={22} sw={2.2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.6 2.6L16 9.5" />
  </Svg>
);
export const TickIcon = () => (
  <Svg size={11} sw={3.5}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const MenuIcon = ({ open }: { open: boolean }) => (
  <Svg size={20}>{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</Svg>
);
