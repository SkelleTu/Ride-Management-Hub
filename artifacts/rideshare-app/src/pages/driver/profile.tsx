import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useCreateDriverProfile } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const DRIVER_PROFILE_ME_KEY = (userId?: number) => ["driver-profile-me", userId];

async function fetchMyDriverProfile() {
  const token = localStorage.getItem("token");
  const r = await fetch("/api/drivers/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (r.status === 404) return null;
  if (!r.ok) return null;
  return r.json();
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, XCircle, ChevronRight, Upload, FileCheck, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STEPS = ["Dados Pessoais", "CNH", "Veículo", "Documentos"];

const STATUS_CONFIG = {
  pending: { label: "Em Análise", icon: Clock, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Aprovado", icon: CheckCircle, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  denied: { label: "Negado", icon: XCircle, color: "bg-destructive/20 text-destructive border-destructive/30" },
};

function maskCPF(value: string) {
  return value.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

async function fileToDataUrl(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

interface DocUploadProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}

function DocUpload({ label, required, value, onChange, hint }: DocUploadProps) {
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const url = await fileToDataUrl(file);
      onChange(url);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={loading}
        className={`w-full h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors text-sm
          ${value ? "border-green-500/40 bg-green-500/5 text-green-400" : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"}`}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : value ? (
          <>
            <FileCheck className="w-5 h-5" />
            <span className="text-xs">Enviado — clique para trocar</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            <span>Selecionar arquivo</span>
          </>
        )}
      </button>
      {value && (
        <div className="rounded-lg overflow-hidden border border-border">
          <img src={value} alt={label} className="w-full h-32 object-cover" />
        </div>
      )}
    </div>
  );
}

export default function DriverProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const createProfile = useCreateDriverProfile();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["driver-profile-me", user?.id],
    queryFn: fetchMyDriverProfile,
    enabled: !!user?.id,
  });

  const updateField = (key: string, value: any) => setFormData(p => ({ ...p, [key]: value }));

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const handleSubmit = () => {
    const required = [
      "cpf", "birthDate", "address", "city", "state",
      "cnhNumber", "cnhCategory", "cnhExpiry",
      "vehicleMake", "vehicleModel", "vehicleYear", "vehicleColor", "vehiclePlate", "vehicleType",
      "photoUrl", "cnhPhotoUrl", "vehiclePhotoUrl", "criminalRecordUrl",
    ];
    const missing = required.filter(k => !formData[k]);
    if (missing.length > 0) {
      const hasCriminal = missing.includes("criminalRecordUrl");
      toast({
        title: hasCriminal ? "Certidão de Antecedentes obrigatória" : "Preencha todos os campos obrigatórios",
        description: hasCriminal ? "Todos os motoristas devem enviar a Certidão de Antecedentes Criminais." : undefined,
        variant: "destructive",
      });
      if (hasCriminal) setStep(3);
      return;
    }
    createProfile.mutate({ data: { ...formData, vehicleYear: parseInt(formData.vehicleYear) } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: DRIVER_PROFILE_ME_KEY(user?.id) });
        toast({ title: "Documentação enviada! Aguarde a aprovação." });
      },
      onError: () => toast({ title: "Erro ao enviar documentação", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  if (profile) {
    const cfg = STATUS_CONFIG[profile.status as keyof typeof STATUS_CONFIG];
    const Icon = cfg.icon;
    return (
      <div className="flex-1 p-4 space-y-5">
        <div className="text-xl font-bold">Meu Cadastro</div>
        <Card className={`border ${cfg.color}`}>
          <CardContent className="p-5 flex items-center gap-4">
            <Icon className="w-10 h-10" />
            <div>
              <div className="font-bold text-lg">{cfg.label}</div>
              <div className="text-sm text-muted-foreground">
                {profile.status === "pending" && "Seus documentos estão sendo analisados"}
                {profile.status === "approved" && "Você está habilitado a fazer corridas"}
                {profile.status === "denied" && (profile.adminNote ?? "Cadastro negado. Entre em contato.")}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Nome", user?.name],
            ["CPF", profile.cpf],
            ["Placa", profile.vehiclePlate],
            ["Veículo", `${profile.vehicleMake} ${profile.vehicleModel} ${profile.vehicleYear}`],
            ["Cor", profile.vehicleColor],
            ["Tipo", profile.vehicleType],
          ].map(([label, value]) => (
            <div key={label} className="bg-secondary rounded-xl p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="font-medium truncate">{value ?? "—"}</div>
            </div>
          ))}
        </div>

        {profile.status === "denied" && (
          <Button onClick={() => queryClient.setQueryData(DRIVER_PROFILE_ME_KEY(user?.id), null)} variant="outline" className="w-full">
            Reenviar Documentação
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 space-y-5 overflow-y-auto pb-8">
      <div>
        <div className="text-xl font-bold">Cadastro de Motorista</div>
        <div className="text-sm text-muted-foreground mt-1">Passo {step + 1} de {STEPS.length}: {STEPS[step]}</div>
      </div>

      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? "bg-accent" : "bg-secondary"}`} />
        ))}
      </div>

      {/* Step 0: Dados Pessoais */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>CPF *</Label>
            <Input
              placeholder="000.000.000-00"
              inputMode="numeric"
              value={formData.cpf ?? ""}
              onChange={e => updateField("cpf", maskCPF(e.target.value))}
              className="bg-secondary border-border"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data de Nascimento *</Label>
            <Input type="date" value={formData.birthDate ?? ""} onChange={e => updateField("birthDate", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Endereço *</Label>
            <Input placeholder="Rua, número, bairro" value={formData.address ?? ""} onChange={e => updateField("address", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cidade *</Label>
              <Input placeholder="Cidade" value={formData.city ?? ""} onChange={e => updateField("city", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>UF *</Label>
              <Input placeholder="SP" maxLength={2} value={formData.state ?? ""} onChange={e => updateField("state", e.target.value.toUpperCase())} className="bg-secondary border-border" />
            </div>
          </div>
        </div>
      )}

      {/* Step 1: CNH */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Número da CNH *</Label>
            <Input placeholder="00000000000" value={formData.cnhNumber ?? ""} onChange={e => updateField("cnhNumber", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria da CNH *</Label>
            <Select onValueChange={v => updateField("cnhCategory", v)} value={formData.cnhCategory ?? ""}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {["A", "B", "AB", "C", "D", "E"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Validade da CNH *</Label>
            <Input type="date" value={formData.cnhExpiry ?? ""} onChange={e => updateField("cnhExpiry", e.target.value)} className="bg-secondary border-border" />
          </div>
        </div>
      )}

      {/* Step 2: Veículo */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Marca *</Label>
              <Input placeholder="Toyota" value={formData.vehicleMake ?? ""} onChange={e => updateField("vehicleMake", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo *</Label>
              <Input placeholder="Corolla" value={formData.vehicleModel ?? ""} onChange={e => updateField("vehicleModel", e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ano *</Label>
              <Input type="number" placeholder="2020" value={formData.vehicleYear ?? ""} onChange={e => updateField("vehicleYear", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Cor *</Label>
              <Input placeholder="Branco" value={formData.vehicleColor ?? ""} onChange={e => updateField("vehicleColor", e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Placa *</Label>
            <Input placeholder="ABC-1234" value={formData.vehiclePlate ?? ""} onChange={e => updateField("vehiclePlate", e.target.value.toUpperCase())} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de Veículo *</Label>
            <Select onValueChange={v => updateField("vehicleType", v)} value={formData.vehicleType ?? ""}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {[["sedan","Sedan"],["suv","SUV"],["hatch","Hatch"],["pickup","Pickup"],["moto","Moto"],["van","Van"]].map(([v,l]) =>
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Step 3: Documentos */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-2 text-sm text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Todos os documentos são obrigatórios. A Certidão de Antecedentes Criminais é exigida por lei para motoristas de aplicativo.</span>
          </div>

          <DocUpload
            label="Foto Pessoal"
            required
            value={formData.photoUrl ?? ""}
            onChange={v => updateField("photoUrl", v)}
            hint="Selfie clara com rosto visível"
          />
          <DocUpload
            label="Foto da CNH"
            required
            value={formData.cnhPhotoUrl ?? ""}
            onChange={v => updateField("cnhPhotoUrl", v)}
            hint="Frente e verso legíveis"
          />
          <DocUpload
            label="Foto do Veículo"
            required
            value={formData.vehiclePhotoUrl ?? ""}
            onChange={v => updateField("vehiclePhotoUrl", v)}
            hint="Foto frontal mostrando a placa"
          />
          <DocUpload
            label="Certidão de Antecedentes Criminais"
            required
            value={formData.criminalRecordUrl ?? ""}
            onChange={v => updateField("criminalRecordUrl", v)}
            hint="Emitida gratuitamente em antecedentes.dpf.gov.br (Polícia Federal) ou na SSP do seu estado"
          />
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">Voltar</Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} className="flex-1">Próximo <ChevronRight className="ml-1 w-4 h-4" /></Button>
        ) : (
          <Button onClick={handleSubmit} disabled={createProfile.isPending} className="flex-1">
            {createProfile.isPending ? "Enviando..." : "Enviar Cadastro"}
          </Button>
        )}
      </div>
    </div>
  );
}
