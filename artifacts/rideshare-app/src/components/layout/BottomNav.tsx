import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Home, Calendar, Clock, User, LayoutDashboard, Car, Shield, Radio } from "lucide-react";

export function BottomNav() {
  const { user, selectedRole } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const isActive = (path: string) =>
    location === path || location.startsWith(path + "/");

  const linkClass = (path: string) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs font-medium transition-colors ${
      isActive(path)
        ? "text-primary"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const iconClass = (path: string) =>
    `w-5 h-5 ${isActive(path) ? "text-primary" : "text-muted-foreground"}`;

  if (selectedRole === "passenger") {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border flex items-center safe-area-pb">
        <Link href="/passenger" className={linkClass("/passenger")}>
          <Home className={iconClass("/passenger")} />
          Solicitar
        </Link>
        <Link href="/passenger/scheduled" className={linkClass("/passenger/scheduled")}>
          <Calendar className={iconClass("/passenger/scheduled")} />
          Agenda
        </Link>
        <Link href="/live-board" className={linkClass("/live-board")}>
          <Radio className={iconClass("/live-board")} />
          Ao Vivo
        </Link>
        <Link href="/passenger/history" className={linkClass("/passenger/history")}>
          <Clock className={iconClass("/passenger/history")} />
          Histórico
        </Link>
      </nav>
    );
  }

  if (selectedRole === "driver") {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border flex items-center safe-area-pb">
        <Link href="/driver" className={linkClass("/driver")}>
          <Car className={iconClass("/driver")} />
          Corridas
        </Link>
        <Link href="/driver/scheduled" className={linkClass("/driver/scheduled")}>
          <Calendar className={iconClass("/driver/scheduled")} />
          Agenda
        </Link>
        <Link href="/live-board" className={linkClass("/live-board")}>
          <Radio className={iconClass("/live-board")} />
          Ao Vivo
        </Link>
        <Link href="/driver/history" className={linkClass("/driver/history")}>
          <Clock className={iconClass("/driver/history")} />
          Histórico
        </Link>
        <Link href="/driver/profile" className={linkClass("/driver/profile")}>
          <User className={iconClass("/driver/profile")} />
          Perfil
        </Link>
      </nav>
    );
  }

  if (user.role === "admin" && selectedRole === "admin") {
    return (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border flex items-center safe-area-pb">
        <Link href="/admin" className={linkClass("/admin")}>
          <LayoutDashboard className={iconClass("/admin")} />
          Dashboard
        </Link>
        <Link href="/admin/scheduled" className={linkClass("/admin/scheduled")}>
          <Calendar className={iconClass("/admin/scheduled")} />
          Agenda
        </Link>
        <Link href="/live-board" className={linkClass("/live-board")}>
          <Radio className={iconClass("/live-board")} />
          Ao Vivo
        </Link>
        <Link href="/admin/rides" className={linkClass("/admin/rides")}>
          <Car className={iconClass("/admin/rides")} />
          Corridas
        </Link>
        <Link href="/admin/drivers" className={linkClass("/admin/drivers")}>
          <Shield className={iconClass("/admin/drivers")} />
          Motoristas
        </Link>
      </nav>
    );
  }

  return null;
}
