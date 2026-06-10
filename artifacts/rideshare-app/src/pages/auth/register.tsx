import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useRegister, RegisterInputRole } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UPcarLogo } from "@/components/ui/UPcarLogo";

export default function Register() {
  const [, setLocation] = useLocation();
  const { login, selectedRole } = useAuth();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const registerMutation = useRegister();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Default to passenger if not selected
    const role: RegisterInputRole = selectedRole === "driver" ? "driver" : "passenger";

    registerMutation.mutate(
      { data: { name, email, phone, password, role } },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
          if (role === "driver") {
            setLocation("/driver/profile");
          } else {
            setLocation("/passenger");
          }
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Erro ao cadastrar",
            description: (error as any)?.error || "Verifique os dados informados.",
          });
        },
      }
    );
  };

  const roleColor = selectedRole === "driver" ? "text-accent" : "text-primary";

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300 my-8">
        <Button 
          variant="ghost" 
          className="mb-4 gap-2 text-muted-foreground"
          onClick={() => setLocation("/auth/login")}
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
              Cadastro {selectedRole && <span className={roleColor}>como {selectedRole === "driver" ? "Motorista" : "Passageiro"}</span>}
            </CardTitle>
            <CardDescription>
              Crie sua conta para começar a usar
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input 
                  id="name" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-secondary/50 border-border"
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required
                  minLength={6}
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
                disabled={registerMutation.isPending}
                variant="default"
              >
                {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cadastrar"}
              </Button>
              <div className="text-sm text-center text-muted-foreground">
                Já tem uma conta?{" "}
                <Link href="/auth/login" className={`font-semibold hover:underline ${roleColor}`}>
                  Fazer login
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
