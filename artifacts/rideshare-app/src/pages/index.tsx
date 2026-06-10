import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Car, User, ArrowRight } from "lucide-react";
import { UPcarLogo } from "@/components/ui/UPcarLogo";

export default function RoleSelection() {
  const [, setLocation] = useLocation();
  const { setSelectedRole } = useAuth();

  const handleSelectRole = (role: "passenger" | "driver") => {
    setSelectedRole(role);
    setLocation("/auth/login");
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6 drop-shadow-[0_0_20px_rgba(34,197,94,0.4)]">
            <UPcarLogo size={64} />
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
                  <h3 className="font-semibold text-lg">Passageiro</h3>
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
                  <h3 className="font-semibold text-lg">Motorista</h3>
                  <p className="text-sm text-muted-foreground">Oferecer viagens</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
