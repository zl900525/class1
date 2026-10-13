// 線條圖示（docs/design.md：線寬 2.5、圓角端點，不用 emoji 當圖示）

import type { ReactNode, SVGProps } from 'react';

function Icon({ size = 20, children, ...rest }: SVGProps<SVGSVGElement> & { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const UsersIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21c0-4 3-6 7-6s7 2 7 6" />
    <path d="M16 4a4 4 0 0 1 0 8" />
    <path d="M22 21c0-3-2-5-4-5.5" />
  </Icon>
);

export const LeaveIcon = (p: P) => (
  <Icon {...p}>
    <path d="M15 4h4v16h-4" />
    <path d="M10 17l5-5-5-5" />
    <path d="M15 12H3" />
  </Icon>
);

export const WifiOffIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2 2l20 20" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0" />
    <path d="M5 12.5a10 10 0 0 1 5-2.8" />
    <path d="M19 12.5a10 10 0 0 0-2.3-1.6" />
    <path d="M12 20h.01" />
  </Icon>
);

export const ReplyIcon = (p: P) => (
  <Icon {...p}>
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h11a5 5 0 0 1 5 5v2" />
  </Icon>
);

export const SmileIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <path d="M9 9.5h.01" />
    <path d="M15 9.5h.01" />
  </Icon>
);

export const RecallIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3 7v6h6" />
    <path d="M3 13a9 9 0 1 0 3-7.7L3 7" />
  </Icon>
);

export const CloseIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const AlertIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 3L2 21h20z" />
    <path d="M12 10v5" />
    <path d="M12 18h.01" />
  </Icon>
);

export const ArrowDownIcon = (p: P) => (
  <Icon {...p} strokeWidth={3}>
    <path d="M12 5v14" />
    <path d="M5 12l7 7 7-7" />
  </Icon>
);

export const ClipIcon = (p: P) => (
  <Icon {...p}>
    <path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" />
  </Icon>
);

export const SendIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 12l16-8-6 16-3-7z" />
  </Icon>
);

export const ImageIcon = (p: P) => (
  <Icon {...p} strokeWidth={2.2}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 17l-5-5-9 8" />
  </Icon>
);

export const ChatIcon = (p: P) => (
  <Icon {...p} strokeWidth={2.2}>
    <path d="M4 5h16v11H9l-5 4z" />
    <path d="M9 10h.01" />
    <path d="M15 10h.01" />
  </Icon>
);
