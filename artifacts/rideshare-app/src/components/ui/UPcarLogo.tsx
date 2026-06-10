interface UPcarLogoProps {
  size?: number;
  className?: string;
}

export function UPcarLogo({ size = 32, className }: UPcarLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="upcar-bg" x1="0" y1="0" x2="180" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22c55e" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <rect width="180" height="180" rx="38" fill="url(#upcar-bg)" />
      <path d="M90 16 L60 54 L74 54 L74 70 L106 70 L106 54 L120 54 Z" fill="white" />
      <path d="M48 102 L62 78 L118 78 L132 102 Z" fill="white" />
      <rect x="28" y="102" width="124" height="26" rx="7" fill="white" />
      <circle cx="56" cy="130" r="17" fill="white" />
      <circle cx="56" cy="130" r="10" fill="url(#upcar-bg)" />
      <circle cx="56" cy="130" r="4.5" fill="white" />
      <circle cx="124" cy="130" r="17" fill="white" />
      <circle cx="124" cy="130" r="10" fill="url(#upcar-bg)" />
      <circle cx="124" cy="130" r="4.5" fill="white" />
      <path d="M65 80 L57 100 L105 100 L105 80 Z" fill="url(#upcar-bg)" opacity="0.45" />
      <path d="M105 80 L105 100 L123 100 L115 80 Z" fill="url(#upcar-bg)" opacity="0.45" />
    </svg>
  );
}
