import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCreateDriverProfile } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

async function fetchMyDriverProfile() {
  const r = await fetch("/api/drivers/me", { credentials: "include" });
  if (r.status === 404) return null;
  if (!r.ok) return null;
  return r.json();
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, User, Car, FileText, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

const STEPS = ["Dados Pessoais", "CNH", "Veiculo", "Documentos"];

const STATUS_CONFIG = {
  pending: { label: "Em Analise", icon: Clock, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Aprovado", icon: CheckCircle, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  denied: { label: "Negado", icon: XCircle, color: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function DriverProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const createProfile = useCreateDriverProfile();

  // Check if profile exists
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
    const required = ["cpf", "birthDate", "address", "city", "state", "cnhNumber", "cnhCategory", "cnhExpiry", "vehicleMake", "vehicleModel", "vehicleYear", "vehicleColor", "vehiclePlate", "vehicleType"];
    const missing = required.filter(k => !formData[k]);
    if (missing.length > 0) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    createProfile.mutate({ data: { ...formData, vehicleYear: parseInt(formData.vehicleYear) } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetDriverProfileQueryKey(user?.id ?? 0) });
        toast({ title: "Documentação enviada! Aguarde a aprovação." });
      },
      onError: () => toast({ title: "Erro ao enviar documentação", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  // Show status if profile exists
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
            ["Veiculo", `${profile.vehicleMake} ${profile.vehicleModel} ${profile.vehicleYear}`],
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
          <Button onClick={() => queryClient.setQueryData(getGetDriverProfileQueryKey(user?.id ?? 0), null)} variant="outline" className="w-full">
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

      {/* Progress */}
      <div className="flex gap-1.5">
        {STEPS.map((_, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-secondary"}`} />
        ))}
      </div>

      {/* Step 0: Personal */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>CPF *</Label>
            <Input data-testid="input-cpf" placeholder="000.000.000-00" value={formData.cpf ?? ""} onChange={e => updateField("cpf", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Data de Nascimento *</Label>
            <Input data-testid="input-birthdate" type="date" value={formData.birthDate ?? ""} onChange={e => updateField("birthDate", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Endereco *</Label>
            <Input data-testid="input-address" placeholder="Rua, número, bairro" value={formData.address ?? ""} onChange={e => updateField("address", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cidade *</Label>
              <Input data-testid="input-city" placeholder="Cidade" value={formData.city ?? ""} onChange={e => updateField("city", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Estado *</Label>
              <Input data-testid="input-state" placeholder="SP" maxLength={2} value={formData.state ?? ""} onChange={e => updateField("state", e.target.value.toUpperCase())} className="bg-secondary border-border" />
            </div>
          </div>
        </div>
      )}

      {/* Step 1: CNH */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Número da CNH *</Label>
            <Input data-testid="input-cnh-number" placeholder="00000000000" value={formData.cnhNumber ?? ""} onChange={e => updateField("cnhNumber", e.target.value)} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria da CNH *</Label>
            <Select onValueChange={v => updateField("cnhCategory", v)} value={formData.cnhCategory ?? ""}>
              <SelectTrigger data-testid="select-cnh-category" className="bg-secondary border-border">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {["A", "B", "AB", "C", "D", "E"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Validade da CNH *</Label>
            <Input data-testid="input-cnh-expiry" type="date" value={formData.cnhExpiry ?? ""} onChange={e => updateField("cnhExpiry", e.target.value)} className="bg-secondary border-border" />
          </div>
        </div>
      )}

      {/* Step 2: Vehicle */}
      {step === 2 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Marca *</Label>
              <Input data-testid="input-vehicle-make" placeholder="Toyota" value={formData.vehicleMake ?? ""} onChange={e => updateField("vehicleMake", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo *</Label>
              <Input data-testid="input-vehicle-model" placeholder="Corolla" value={formData.vehicleModel ?? ""} onChange={e => updateField("vehicleModel", e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ano *</Label>
              <Input data-testid="input-vehicle-year" type="number" placeholder="2020" value={formData.vehicleYear ?? ""} onChange={e => updateField("vehicleYear", e.target.value)} className="bg-secondary border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Cor *</Label>
              <Input data-testid="input-vehicle-color" placeholder="Branco" value={formData.vehicleColor ?? ""} onChange={e => updateField("vehicleColor", e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Placa *</Label>
            <Input data-testid="input-vehicle-plate" placeholder="ABC-1234" value={formData.vehiclePlate ?? ""} onChange={e => updateField("vehiclePlate", e.target.value.toUpperCase())} className="bg-secondary border-border" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de Veiculo *</Label>
            <Select onValueChange={v => updateField("vehicleType", v)} value={formData.vehicleType ?? ""}>
              <SelectTrigger data-testid="select-vehicle-type" className="bg-secondary border-border">
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

      {/* Step 3: Docs */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-secondary/50 border border-border rounded-xl p-4 text-sm text-muted-foreground">
            Nesta versão, os documentos são enviados por URL. Em uma versão completa, você poderia enviar fotos diretamente.
          </div>
          {[
            ["photoUrl", "URL da sua Foto"],
            ["cnhPhotoUrl", "URL da Foto da CNH"],
            ["vehiclePhotoUrl", "URL da Foto do Veiculo"],
            ["criminalRecordUrl", "URL da Certidao de Antecedentes"],
          ].map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <Input data-testid={`input-${key}`} placeholder="https://..." value={formData[key] ?? ""} onChange={e => updateField(key, e.target.value)} className="bg-secondary border-border" />
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
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
