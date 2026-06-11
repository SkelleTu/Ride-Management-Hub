interface UPcarLogoProps {
  size?: number;
  className?: string;
}

export function UPcarLogo({ size = 32, className }: UPcarLogoProps) {
  return (
    <img
      src="/upcar-logo.png"
      alt="UPcar Services"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
