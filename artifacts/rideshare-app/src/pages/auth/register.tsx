import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useRegister, RegisterInputRole } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Camera, ImageIcon, ChevronRight, MapPin, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UPcarLogo } from "@/components/ui/UPcarLogo";
import { BiometricSetup } from "@/components/auth/BiometricSetup";
import { WhatsAppActivation } from "@/components/auth/WhatsAppActivation";

async function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 240;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function validatePhone(value: string): boolean {
  const d = value.replace(/\D/g, "");
  return d.length === 10 || d.length === 11;
}

function maskCPF(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function maskCEP(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
}

function validateCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r >= 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r >= 10) r = 0;
  return r === parseInt(d[10]);
}

export default function Register() {
  const [, setLocation] = useLocation();
  const { login, selectedRole } = useAuth();
  const { toast } = useToast();
  const isPassenger = selectedRole !== "driver";

  const STEPS = isPassenger ? ["Dados Básicos", "CPF e Endereço"] : ["Dados Básicos"];
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const [biometricData, setBiometricData] = useState<{ token: string; email: string } | null>(null);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [whatsappData, setWhatsappData] = useState<{ name: string; phone: string; role: "passenger" | "driver"; token: string; userId: number } | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const registerMutation = useRegister();

  const handlePhotoFile = async (file: File) => {
    setCompressing(true);
    try {
      const compressed = await compressPhoto(file);
      setPhotoPreview(compressed);
    } catch {
      toast({ title: "Erro ao processar foto", variant: "destructive" });
    } finally {
      setCompressing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handlePhotoFile(file);
    e.target.value = "";
  };

  const handleCpfChange = (v: string) => {
    const masked = maskCPF(v);
    setCpf(masked);
    if (masked.replace(/\D/g, "").length === 11) {
      setCpfError(validateCPF(masked) ? "" : "CPF inválido");
    } else {
      setCpfError("");
    }
  };

  const handleCepChange = async (v: string) => {
    const masked = maskCEP(v);
    setCep(masked);
    const digits = masked.replace(/\D/g, "");
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const r = await fetch(`/api/proxy/cep/${digits}`);
        if (r.ok) {
          const data = await r.json();
          setStreet(data.street ?? "");
          setNeighborhood(data.neighborhood ?? "");
          setCity(data.city ?? "");
          setState(data.state ?? "");
        } else {
          toast({ title: "CEP não encontrado", variant: "destructive" });
        }
      } catch {
        toast({ title: "Erro ao consultar CEP", variant: "destructive" });
      } finally {
        setCepLoading(false);
      }
    }
  };

  const handleNextStep = () => {
    if (step === 0) {
      if (!photoPreview) {
        toast({ title: "Foto obrigatória", description: "Adicione uma foto de perfil para continuar.", variant: "destructive" });
        return;
      }
      if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
        toast({ title: "Preencha todos os campos", variant: "destructive" });
        return;
      }
      if (!validatePhone(phone)) {
        toast({ title: "Celular inválido", description: "Informe o DDD + número com 10 ou 11 dígitos.", variant: "destructive" });
        return;
      }
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isPassenger) {
      if (!cpf || cpf.replace(/\D/g, "").length !== 11) {
        toast({ title: "CPF obrigatório", variant: "destructive" });
        return;
      }
      if (!validateCPF(cpf)) {
        toast({ title: "CPF inválido", variant: "destructive" });
        return;
      }
      if (!street || !city || !state) {
        toast({ title: "Endereço incompleto", description: "Preencha o CEP e os campos de endereço.", variant: "destructive" });
        return;
      }
    }

    const role: RegisterInputRole = selectedRole === "driver" ? "driver" : "passenger";
    const address = isPassenger
      ? [street, number, neighborhood, city, state].filter(Boolean).join(", ")
      : undefined;

    registerMutation.mutate(
      {
        data: {
          name,
          email,
          phone,
          password,
          role,
          ...(isPassenger ? { cpf: cpf.replace(/\D/g, ""), address } : {}),
        } as any,
      },
      {
        onSuccess: async (data) => {
          try {
            const token = data.token;
            await fetch("/api/users/me/avatar", {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ avatarUrl: photoPreview }),
            });
            login(token, { ...data.user, avatarUrl: photoPreview });
            const route = role === "driver" ? "/driver/profile" : "/passenger";
            setPendingRoute(route);
            setWhatsappData({ name, phone, role, token, userId: data.user.id });
          } catch {
            login(data.token, data.user);
            const route = role === "driver" ? "/driver/profile" : "/passenger";
            setPendingRoute(route);
            setWhatsappData({ name, phone, role, token: data.token, userId: data.user.id });
          }
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Erro ao cadastrar",
            description: (error as any)?.data?.error || "Verifique os dados informados.",
          });
        },
      }
    );
  };

  const handleWhatsAppDone = () => {
    setWhatsappData(null);
    if (whatsappData) {
      setBiometricData({ token: whatsappData.token, email });
    } else if (pendingRoute) {
      setLocation(pendingRoute);
    }
  };

  const handleBiometricDone = () => {
    setBiometricData(null);
    if (pendingRoute) setLocation(pendingRoute);
  };

  const roleColor = selectedRole === "driver" ? "text-accent" : "text-primary";
  const isLoading = registerMutation.isPending || compressing || cepLoading;
  const isLastStep = step === STEPS.length - 1;

  return (
    <>
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300 my-8">
          <Button
            variant="ghost"
            className="mb-4 gap-2 text-muted-foreground"
            onClick={() => step > 0 ? setStep(s => s - 1) : setLocation("/")}
          >
            <ArrowLeft className="w-4 h-4" />
            {step > 0 ? "Voltar" : "Início"}
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
                {STEPS.length > 1 ? `Passo ${step + 1} de ${STEPS.length}: ${STEPS[step]}` : "Crie sua conta para começar a usar"}
              </CardDescription>
              {STEPS.length > 1 && (
                <div className="flex gap-1.5 pt-1">
                  {STEPS.map((_, i) => (
                    <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? (selectedRole === "driver" ? "bg-accent" : "bg-primary") : "bg-secondary"}`} />
                  ))}
                </div>
              )}
            </CardHeader>

            <form onSubmit={isLastStep ? handleSubmit : (e) => { e.preventDefault(); handleNextStep(); }}>
              <CardContent className="space-y-4">

                {/* STEP 0 — Dados básicos */}
                {step === 0 && (
                  <>
                    <div className="flex flex-col items-center gap-3">
                      <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileChange} />
                      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-border bg-secondary/50 flex items-center justify-center">
                        {photoPreview ? (
                          <img src={photoPreview} alt="Foto de perfil" className="w-full h-full object-cover" />
                        ) : compressing ? (
                          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                        ) : (
                          <Camera className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => cameraRef.current?.click()} disabled={compressing}>
                          <Camera className="w-3.5 h-3.5" /> Câmera
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => galleryRef.current?.click()} disabled={compressing}>
                          <ImageIcon className="w-3.5 h-3.5" /> Galeria
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Foto de perfil <span className="text-destructive">*</span></p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome completo</Label>
                      <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50 border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary/50 border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Celular <span className="text-destructive">*</span></Label>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        required
                        value={phone}
                        onChange={(e) => setPhone(maskPhone(e.target.value))}
                        className={`bg-secondary/50 border-border ${phone && !validatePhone(phone) ? "border-destructive" : ""}`}
                        placeholder="(11) 99999-9999"
                      />
                      {phone && !validatePhone(phone) && (
                        <p className="text-xs text-destructive flex gap-1 items-center">
                          <AlertCircle className="w-3 h-3" /> Número inválido — DDD + número (10 ou 11 dígitos)
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary/50 border-border" />
                    </div>
                  </>
                )}

                {/* STEP 1 — CPF e Endereço (passageiro) */}
                {step === 1 && isPassenger && (
                  <>
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm text-muted-foreground flex gap-2">
                      <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>Seus dados são protegidos pela LGPD e usados exclusivamente para segurança das corridas.</span>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF <span className="text-destructive">*</span></Label>
                      <Input
                        id="cpf"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        className={`bg-secondary/50 border-border ${cpfError ? "border-destructive" : ""}`}
                      />
                      {cpfError && <p className="text-xs text-destructive flex gap-1 items-center"><AlertCircle className="w-3 h-3" /> {cpfError}</p>}
                    </div>

                    <div className="space-y-3 pt-1">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <MapPin className="w-4 h-4 text-primary" /> Endereço
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cep">CEP <span className="text-destructive">*</span></Label>
                        <div className="relative">
                          <Input
                            id="cep"
                            inputMode="numeric"
                            placeholder="00000-000"
                            value={cep}
                            onChange={(e) => handleCepChange(e.target.value)}
                            className="bg-secondary/50 border-border pr-8"
                          />
                          {cepLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-muted-foreground" />}
                        </div>
                        <p className="text-xs text-muted-foreground">Digite o CEP para preencher o endereço automaticamente</p>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 space-y-1.5">
                          <Label htmlFor="street">Rua / Avenida <span className="text-destructive">*</span></Label>
                          <Input id="street" placeholder="Rua das Flores" value={street} onChange={(e) => setStreet(e.target.value)} className="bg-secondary/50 border-border" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="number">Número</Label>
                          <Input id="number" placeholder="123" value={number} onChange={(e) => setNumber(e.target.value)} className="bg-secondary/50 border-border" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="neighborhood">Bairro</Label>
                        <Input id="neighborhood" placeholder="Centro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="bg-secondary/50 border-border" />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 space-y-1.5">
                          <Label htmlFor="city">Cidade <span className="text-destructive">*</span></Label>
                          <Input id="city" placeholder="São Paulo" value={city} onChange={(e) => setCity(e.target.value)} className="bg-secondary/50 border-border" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="state">UF <span className="text-destructive">*</span></Label>
                          <Input id="state" placeholder="SP" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className="bg-secondary/50 border-border" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-medium"
                  disabled={isLoading}
                  variant="default"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isLastStep ? (
                    "Cadastrar"
                  ) : (
                    <>Próximo <ChevronRight className="w-4 h-4 ml-1" /></>
                  )}
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
