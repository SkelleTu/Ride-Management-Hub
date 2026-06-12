import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useRegister, RegisterInputRole } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UPcarLogo } from "@/components/ui/UPcarLogo";

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

export default function Register() {
  const [, setLocation] = useLocation();
  const { login, selectedRole } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const registerMutation = useRegister();

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoPreview) {
      toast({ title: "Foto obrigatória", description: "Adicione uma foto de perfil para continuar.", variant: "destructive" });
      return;
    }

    const role: RegisterInputRole = selectedRole === "driver" ? "driver" : "passenger";

    registerMutation.mutate(
      { data: { name, email, phone, password, role } },
      {
        onSuccess: async (data) => {
          // Upload avatar right after registration
          try {
            const token = data.token;
            await fetch("/api/users/me/avatar", {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ avatarUrl: photoPreview }),
            });
            // Merge avatarUrl into user object before login
            login(token, { ...data.user, avatarUrl: photoPreview });
          } catch {
            login(data.token, data.user);
          }
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
            description: (error as any)?.data?.error || "Verifique os dados informados.",
          });
        },
      }
    );
  };

  const roleColor = selectedRole === "driver" ? "text-accent" : "text-primary";
  const isLoading = registerMutation.isPending || compressing;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300 my-8">
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
              Cadastro {selectedRole && <span className={roleColor}>como {selectedRole === "driver" ? "Motorista" : "Passageiro"}</span>}
            </CardTitle>
            <CardDescription>Crie sua conta para começar a usar</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {/* Photo upload — required */}
              <div className="flex flex-col items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={handlePhoto}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-border hover:border-primary transition-colors bg-secondary/50 flex items-center justify-center"
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Foto de perfil" className="w-full h-full object-cover" />
                  ) : compressing ? (
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                  ) : (
                    <Camera className="w-8 h-8 text-muted-foreground" />
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 py-1 text-[10px] text-white text-center">
                    {photoPreview ? "Trocar" : "Adicionar"}
                  </div>
                </button>
                <p className="text-xs text-muted-foreground">
                  Foto de perfil <span className="text-destructive">*</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-secondary/50 border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Celular</Label>
                <Input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-secondary/50 border-border" placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-secondary/50 border-border" />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full h-12 text-lg font-medium" disabled={isLoading} variant="default">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cadastrar"}
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
