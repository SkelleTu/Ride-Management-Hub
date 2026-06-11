import { motion } from "framer-motion";

interface UPcarLogoProps {
  size?: number;
  className?: string;
}

export function UPcarLogo({ size = 32, className }: UPcarLogoProps) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{
        duration: 4.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{ display: "inline-flex" }}
    >
      <img
        src="/upcar-logo.png"
        alt="UPcar Services"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: "contain" }}
      />
    </motion.div>
  );
}
