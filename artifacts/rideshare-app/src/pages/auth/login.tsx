import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Fingerprint } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UPcarLogo } from "@/components/ui/UPcarLogo";
import { PasswordInput } from "@/components/ui/PasswordInput";
import {
  getBiometricEmail,
  authenticateBiometric,
  deviceHasBiometric,
} from "@/lib/useBiometric";
import { WhatsAppActivation } from "@/components/auth/WhatsAppActivation";
import { BiometricSetup } from "@/components/auth/BiometricSetup";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, selectedRole } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bioLoading, setBioLoading] = useState(false);
  const [canUseBiometric, setCanUseBiometric] = useState(false);

  const [whatsappData, setWhatsappData] = useState<{
    name: string; phone: string; role: "passenger" | "driver"; token: string; userId: number;
  } | null>(null);

  const [biometricData, setBiometricData] = useState<{
    token: string; email: string; pendingRoute: string;
  } | null>(null);

  const loginMutation = useLogin();
  const biometricEmail = getBiometricEmail();

  useEffect(() => {
    if (!biometricEmail) return;
    deviceHasBiometric().then(setCanUseBiometric);
  }, [biometricEmail]);

  // After login succeeds, check if biometric is registered; if not, prompt setup
  const goToDashboard = (token: string, user: any, route: string) => {
    if (!getBiometricEmail()) {
      // Biometric not set up yet — show setup before going to dashboard
      setBiometricData({ token, email: user.email, pendingRoute: route });
    } else {
      setLocation(route);
    }
  };

  const resolveRoute = async (token: string, user: any): Promise<string> => {
    if (user.role === "admin") return "/admin";
    if (user.role === "driver") return "/driver";
    try {
      const r = await fetch("/api/rides", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const rides = await r.json();
        const active = rides.find((ride: any) =>
          ["open", "negotiating", "accepted", "in_progress"].includes(ride.status)
        );
        if (active) return `/passenger/ride/${active.id}`;
      }
    } catch {}
    return "/passenger";
  };

  const redirectAfterLogin = async (token: string, user: any) => {
    // WhatsApp not activated yet → show activation first
    if (user.whatsappActivated === false) {
      login(token, user);
      setWhatsappData({ name: user.name, phone: user.phone, role: user.role, token, userId: user.id });
      return;
    }
    login(token, user);
    const route = await resolveRoute(token, user);
    goToDashboard(token, user, route);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: async (data) => { await redirectAfterLogin(data.token, data.user); },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Erro ao fazer login",
            description: (error as any)?.data?.error || "Verifique suas credenciais.",
          });
        },
      }
    );
  };

  const handleBiometric = async () => {
    if (!biometricEmail) return;
    setBioLoading(true);
    try {
      const result = await authenticateBiometric(biometricEmail);
      if (result) {
        login(result.token, result.user);
        const route = await resolveRoute(result.token, result.user);
        // Use setTimeout to defer navigation away from React render cycle
        // This prevents insertBefore/removeChild conflicts with WebAuthn DOM cleanup
        setTimeout(() => setLocation(route), 50);
      } else {
        setBioLoading(false);
        toast({ title: "Biometria não reconhecida", variant: "destructive" });
      }
    } catch (err: any) {
      const msg: string = (err?.message ?? "").toLowerCase();
      // DOM errors from WebAuthn native UI cleanup — check if auth actually worked
      if (msg.includes("removechild") || msg.includes("insertbefore") || msg.includes("not a child")) {
        try {
          const storedToken = localStorage.getItem("token") ?? "";
          const r = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (r.ok) {
            const user = await r.json();
            const route = await resolveRoute(storedToken, user);
            setTimeout(() => setLocation(route), 50);
            return;
          }
        } catch {}
        setBioLoading(false);
        return;
      }
      setBioLoading(false);
      if (!msg.includes("cancelled") && !msg.includes("not allowed")) {
        toast({
          title: "Falha na autenticação biométrica",
          description: err?.message || "Tente novamente ou use sua senha.",
          variant: "destructive",
        });
      }
    }
  };

  const handleWhatsAppDone = () => {
    if (!whatsappData) return;
    const { role, token, name } = whatsappData;
    setWhatsappData(null);
    const route = role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/passenger";
    goToDashboard(token, { email: name }, route);
  };

  const handleBiometricDone = () => {
    if (!biometricData) return;
    const route = biometricData.pendingRoute;
    setBiometricData(null);
    setLocation(route);
  };

  const roleColor = selectedRole === "driver" ? "text-accent" : "text-primary";

  return (
    <>
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
                <UPcarLogo size={90} />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Login {selectedRole && <span className={roleColor}>como {selectedRole === "driver" ? "Motorista" : "Passageiro"}</span>}
              </CardTitle>
              <CardDescription>Insira suas credenciais para continuar</CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
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
                  <PasswordInput
                    id="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary/50 border-border"
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-medium"
                  disabled={loginMutation.isPending || bioLoading}
                  variant="default"
                >
                  {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar"}
                </Button>

                {canUseBiometric && (
                  <>
                    <div className="flex items-center gap-3 w-full">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">ou</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 gap-2 text-base font-medium"
                      onClick={handleBiometric}
                      disabled={loginMutation.isPending || bioLoading}
                    >
                      {bioLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Fingerprint className="w-5 h-5" />}
                      {bioLoading ? "Aguardando biometria..." : "Entrar com digital / Face ID"}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      Conta: <span className="font-medium text-foreground">{biometricEmail}</span>
                    </p>
                  </>
                )}

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

      {whatsappData && (
        <WhatsAppActivation
          name={whatsappData.name}
          phone={whatsappData.phone}
          role={whatsappData.role}
          token={whatsappData.token}
          userId={whatsappData.userId}
          onDone={handleWhatsAppDone}
        />
      )}

      {biometricData && (
        <BiometricSetup
          token={biometricData.token}
          email={biometricData.email}
          onDone={handleBiometricDone}
        />
      )}
    </>
  );
}
