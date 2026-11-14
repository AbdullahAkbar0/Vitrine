import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P): P => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  ...p,
})

export const HangerIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 7.6a2.1 2.1 0 1 1 2.1-2.1c0 .9-.6 1.4-1.3 1.9-.5.3-.8.7-.8 1.2v.4" />
    <path d="M12 9 3.4 15.6A1.4 1.4 0 0 0 4.3 18h15.4a1.4 1.4 0 0 0 .9-2.4L12 9Z" />
  </svg>
)

export const MannequinIcon = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="4.4" rx="2" ry="2.3" />
    <path d="M7.4 9.8c1.3-1.3 2.9-1.9 4.6-1.9s3.3.6 4.6 1.9l-.9 5.6c-.2 1.2-.1 2 .5 3.6H7.8c.6-1.6.7-2.4.5-3.6l-.9-5.6Z" />
    <path d="M12 19v2.6M9.5 21.6h5" />
  </svg>
)

export const PlusIcon = (p: P) => (
  <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const LooksIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="11" height="15" rx="2.5" />
    <path d="M17.5 7.2 19.6 8a1.6 1.6 0 0 1 1 2l-3.2 9.2" />
    <path d="M7 11.5c.6-1 1.6-1.5 2-1.5s1.4.5 2 1.5" />
  </svg>
)

export const GearIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
)

export const SearchIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
)

export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const ChevronLeftIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 5-7 7 7 7" />
  </svg>
)

export const ChevronRightIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
)

export const ShareIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
)

export const CheckIcon = (p: P) => (
  <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2.2}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export const AlertIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4 2.8 19.5h18.4L12 4Z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
)

export const ShieldIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3 5 6v5.5c0 4.3 3 7.8 7 9.5 4-1.7 7-5.2 7-9.5V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

export const CameraIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)

export const ImageIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="9.5" r="1.6" />
    <path d="m20.5 16-4.6-4.6L7 20" />
  </svg>
)

export const InfoIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
)

export const DownloadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  </svg>
)

export const DatabaseIcon = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="6" rx="7" ry="2.8" />
    <path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" />
  </svg>
)

export const TrashIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l1 12.5h9l1-12.5" />
  </svg>
)

export const SparkleIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.2l-1.8-5.5-5.7-1.9L10.2 9 12 3.5Z" />
    <path d="M18.5 3.5v3M17 5h3" />
  </svg>
)

export const RotateLeftIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 9.5A8 8 0 1 1 6 16.5" />
    <path d="M4 4.5v5h5" />
  </svg>
)

export const RotateRightIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M19.5 9.5A8 8 0 1 0 18 16.5" />
    <path d="M20 4.5v5h-5" />
  </svg>
)

export const BrushIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.5 4.5 19.5 9.5 11 18l-5 .5.5-5 8-9Z" />
    <path d="M12.5 6.5 17.5 11.5" />
  </svg>
)

export const PhoneIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </svg>
)

export const LockIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </svg>
)

export const PaletteIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.8-.9 1.5-1.8-.4-1.2.3-2.2 1.6-2.2h1.6a3.8 3.8 0 0 0 3.8-3.8c0-5-3.8-9.2-8.5-9.2Z" />
    <circle cx="7.8" cy="11" r="1.1" />
    <circle cx="10.5" cy="7.3" r="1.1" />
    <circle cx="15" cy="7.8" r="1.1" />
  </svg>
)
