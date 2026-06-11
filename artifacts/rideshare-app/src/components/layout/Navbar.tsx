import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Car, User, LayoutDashboard, Map } from "lucide-react";
import { UPcarLogo } from "@/components/ui/UPcarLogo";
import { UserSideMenu } from "@/components/menu/UserSideMenu";

export function Navbar() {
  const { user, selectedRole, logout } = useAuth();

  const renderNavLinks = () => {
    if (!user) return null;

    if (user.role === "admin" && selectedRole === "admin") {
      return (
        <>
          <Link href="/admin/rides" className="text-sm font-medium hover:text-primary transition-colors">
            Corridas
          </Link>
          <Link href="/admin/drivers" className="text-sm font-medium hover:text-primary transition-colors">
            Motoristas
          </Link>
          <Link href="/admin/passengers" className="text-sm font-medium hover:text-primary transition-colors">
            Passageiros
          </Link>
          <Link href="/passenger" className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
            <Map className="w-3.5 h-3.5" />
            Mapa
          </Link>
        </>
      );
    }

    if (selectedRole === "driver") {
      return (
        <>
          <Link href="/driver" className="text-sm font-medium hover:text-primary transition-colors">
            Solicitações
          </Link>
          <Link href="/driver/history" className="text-sm font-medium hover:text-primary transition-colors">
            Histórico
          </Link>
          <Link href="/driver/profile" className="text-sm font-medium hover:text-primary transition-colors">
            Perfil
          </Link>
        </>
      );
    }

    if (selectedRole === "passenger") {
      return (
        <>
          <Link href="/passenger" className="text-sm font-medium hover:text-primary transition-colors">
            Solicitar
          </Link>
          <Link href="/passenger/history" className="text-sm font-medium hover:text-primary transition-colors">
            Histórico
          </Link>
        </>
      );
    }

    return null;
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <Link href={selectedRole ? `/${selectedRole}` : "/"} className="flex items-center gap-2">
          <UPcarLogo size={76} />
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {renderNavLinks()}
        </div>

        <div className="flex items-center gap-2">
          {user ? <UserSideMenu /> : null}
        </div>
      </div>
    </nav>
  );
}
