import { motion } from "framer-motion";
import { Car, MapPin, Navigation, Clock, Star, Shield, Zap, Route, Smartphone, CreditCard } from "lucide-react";

const FLOATING_ICONS = [
  { Icon: Car,         x: "8%",   y: "12%",  size: 36, opacity: 0.38, duration: 6.2, delay: 0,    rotate: -15 },
  { Icon: MapPin,      x: "88%",  y: "8%",   size: 28, opacity: 0.30, duration: 7.5, delay: 1.2,  rotate: 10  },
  { Icon: Navigation,  x: "75%",  y: "72%",  size: 32, opacity: 0.34, duration: 5.8, delay: 0.5,  rotate: 20  },
  { Icon: Clock,       x: "5%",   y: "65%",  size: 26, opacity: 0.28, duration: 8.1, delay: 2.1,  rotate: -8  },
  { Icon: Star,        x: "92%",  y: "42%",  size: 22, opacity: 0.30, duration: 6.7, delay: 1.8,  rotate: 15  },
  { Icon: Shield,      x: "18%",  y: "80%",  size: 30, opacity: 0.26, duration: 7.2, delay: 0.8,  rotate: -20 },
  { Icon: Zap,         x: "82%",  y: "25%",  size: 24, opacity: 0.35, duration: 5.4, delay: 3.0,  rotate: 8   },
  { Icon: Route,       x: "3%",   y: "35%",  size: 28, opacity: 0.28, duration: 8.8, delay: 1.5,  rotate: 12  },
  { Icon: Smartphone,  x: "65%",  y: "88%",  size: 26, opacity: 0.28, duration: 6.5, delay: 2.5,  rotate: -10 },
  { Icon: CreditCard,  x: "25%",  y: "6%",   size: 24, opacity: 0.26, duration: 7.9, delay: 0.3,  rotate: -5  },
  { Icon: Car,         x: "55%",  y: "15%",  size: 20, opacity: 0.22, duration: 9.0, delay: 4.0,  rotate: 25  },
  { Icon: MapPin,      x: "40%",  y: "90%",  size: 22, opacity: 0.24, duration: 6.3, delay: 3.5,  rotate: -18 },
  { Icon: Navigation,  x: "12%",  y: "48%",  size: 20, opacity: 0.22, duration: 7.6, delay: 2.8,  rotate: 30  },
  { Icon: Star,        x: "70%",  y: "55%",  size: 18, opacity: 0.22, duration: 8.4, delay: 1.0,  rotate: -12 },
];

export function FloatingBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Gradient blobs */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(107,113,245,0.07) 0%, transparent 70%)",
          top: "-10%", left: "-10%",
        }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(140,120,255,0.06) 0%, transparent 70%)",
          bottom: "-5%", right: "-5%",
        }}
        animate={{ x: [0, -25, 0], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating icons */}
      {FLOATING_ICONS.map(({ Icon, x, y, size, opacity, duration, delay, rotate }, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: x, top: y }}
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: [opacity * 0.4, opacity, opacity * 0.4],
            y: [0, -18, 0],
            rotate: [rotate - 4, rotate + 4, rotate - 4],
          }}
          transition={{
            duration,
            delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Icon
            style={{ width: size, height: size, color: "hsl(234 82% 67%)" }}
            strokeWidth={1.3}
          />
        </motion.div>
      ))}
    </div>
  );
}
