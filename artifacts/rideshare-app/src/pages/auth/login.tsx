import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UPcarLogo } from "@/components/ui/UPcarLogo";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, selectedRole } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: async (data) => {
          login(data.token, data.user);
          if (data.user.role === "admin") {
            setLocation("/admin");
          } else if (data.user.role === "driver") {
            setLocation("/driver");
          } else {
            // For passengers: check if there's an active ride to resume
            try {
              const r = await fetch("/api/rides", {
                headers: { Authorization: `Bearer ${data.token}` },
              });
              if (r.ok) {
                const rides = await r.json();
                const activeStatuses = ["open", "negotiating", "accepted", "in_progress"];
                const active = rides.find((ride: any) => activeStatuses.includes(ride.status));
                if (active) {
                  setLocation(`/passenger/ride/${active.id}`);
                  return;
                }
              }
            } catch {}
            setLocation("/passenger");
          }
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Erro ao fazer login",
            description: (error as any)?.error || "Verifique suas credenciais.",
          });
        },
      }
    );
  };

  const roleColor = selectedRole === "driver" ? "text-accent" : "text-primary";

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        <Button 
          variant="ghost" 
          className="mb-4 gap-2 text-muted-foreground"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        
        <Card className="border-border">
          <CardHeader className="space-y-2 text-center">
            <div className="flex justify-center mb-2">
              <UPcarLogo size={48} />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Login {selectedRole && <span className={roleColor}>como {selectedRole === "driver" ? "Motorista" : "Passageiro"}</span>}
            </CardTitle>
            <CardDescription>
              Insira suas credenciais para continuar
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-secondary/50 border-border"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-medium"
                disabled={loginMutation.isPending}
                variant="default"
              >
                {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar"}
              </Button>
              <div className="text-sm text-center text-muted-foreground">
                Não tem uma conta?{" "}
                <Link href="/auth/register" className={`font-semibold hover:underline ${roleColor}`}>
                  Cadastre-se
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
