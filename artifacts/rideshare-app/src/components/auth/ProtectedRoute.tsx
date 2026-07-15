import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

export function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth/login");
    } else if (!isLoading && user && allowedRoles && !allowedRoles.includes(user.role)) {
      if (user.role === "admin") setLocation("/admin");
      else if (user.role === "driver") setLocation("/driver");
      else setLocation("/passenger");
    }
  }, [user, isLoading, allowedRoles, setLocation]);

  if (isLoading) {
    return <div className="min-h-[100dvh] flex items-center justify-center">Carregando...</div>;
  }

  if (!user) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
