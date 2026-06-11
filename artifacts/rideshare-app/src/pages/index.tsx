import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import {
  Car, User, ArrowRight, MapPin, Navigation, Clock,
  Star, Shield, Zap, Route, Smartphone, CreditCard, UserPlus, MessageCircle,
} from "lucide-react";
import { UPcarLogo } from "@/components/ui/UPcarLogo";
import { motion } from "framer-motion";

const WHATSAPP_NUMBER = "5519997238298";

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

export default function RoleSelection() {
  const [, setLocation] = useLocation();
  const { setSelectedRole } = useAuth();

  const handleSelectRole = (role: "passenger" | "driver") => {
    setSelectedRole(role);
    setLocation("/auth/login");
  };

  const handleRegister = (role: "passenger" | "driver") => {
    setSelectedRole(role);
    setLocation("/auth/register");
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}`, "_blank");
  };

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background overflow-hidden">

      {/* Animated background gradient blobs */}
      <div className="absolute inset-0 pointer-events-none">
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
      </div>

      {/* Floating icons */}
      <div className="absolute inset-0 pointer-events-none">
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

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6 drop-shadow-[0_0_28px_rgba(107,113,245,0.5)]">
            <UPcarLogo size={140} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo ao UPcar</h1>
          <p className="text-muted-foreground">Como você deseja usar o app hoje?</p>
        </div>

        <div className="grid gap-4">
          <Card
            className="group cursor-pointer hover:border-primary/50 transition-colors bg-card hover-elevate overflow-hidden relative"
            onClick={() => handleSelectRole("passenger")}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-foreground group-hover:text-primary transition-colors">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Sou passageiro</h3>
                  <p className="text-sm text-muted-foreground">Solicitar viagens</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer hover:border-accent/50 transition-colors bg-card hover-elevate overflow-hidden relative"
            onClick={() => handleSelectRole("driver")}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-foreground group-hover:text-accent transition-colors">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Sou motorista</h3>
                  <p className="text-sm text-muted-foreground">Oferecer viagens</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors transform group-hover:translate-x-1" />
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer hover:border-primary/50 transition-colors bg-card hover-elevate overflow-hidden relative"
            onClick={() => handleRegister("passenger")}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-foreground group-hover:text-primary transition-colors">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Cadastrar como Passageiro</h3>
                  <p className="text-sm text-muted-foreground">Criar conta para solicitar corridas</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer hover:border-accent/50 transition-colors bg-card hover-elevate overflow-hidden relative"
            onClick={() => handleRegister("driver")}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-foreground group-hover:text-accent transition-colors">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Cadastrar como Motorista</h3>
                  <p className="text-sm text-muted-foreground">Criar conta para oferecer corridas</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors transform group-hover:translate-x-1" />
            </CardContent>
          </Card>

          <Card
            className="group cursor-pointer hover:border-green-400/50 transition-colors bg-card hover-elevate overflow-hidden relative"
            onClick={handleWhatsApp}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-foreground group-hover:text-green-400 transition-colors">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Falar no WhatsApp</h3>
                  <p className="text-sm text-muted-foreground">Entrar em contato</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-green-400 transition-colors transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
