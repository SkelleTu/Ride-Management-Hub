import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetDriverProfile, getGetDriverProfileQueryKey, useApproveDriver, useDenyDriver } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListDriversQueryKey, getGetAdminStatsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle, XCircle, User, Car, FileText, Clock, AlertTriangle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Aprovado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  denied: { label: "Negado", color: "bg-destructive/20 text-destructive border-destructive/30" },
};

const DENIAL_REASONS = [
  { id: "cnh_illegible", label: "Foto da CNH ilegível ou cortada" },
  { id: "cnh_expired", label: "CNH vencida ou próxima do vencimento" },
  { id: "cnh_category", label: "Categoria da CNH não habilita conduzir passageiros (B ou superior necessário)" },
  { id: "vehicle_photo_illegible", label: "Foto do veículo ilegível ou não mostra a placa" },
  { id: "plate_mismatch", label: "Placa do veículo não confere com os documentos" },
  { id: "vehicle_old", label: "Veículo com mais de 10 anos (não atende aos requisitos)" },
  { id: "criminal_record_missing", label: "Certidão de antecedentes criminais não enviada" },
  { id: "criminal_record_issue", label: "Antecedentes criminais apresentam restrições" },
  { id: "photo_missing", label: "Foto pessoal não enviada ou ilegível" },
  { id: "cpf_invalid", label: "CPF inválido ou não confere" },
  { id: "data_incomplete", label: "Dados cadastrais incompletos ou inconsistentes" },
  { id: "underage", label: "Motorista com menos de 21 anos (não atende aos requisitos)" },
];

function analyzeDriver(driver: any): string[] {
  const flags: string[] = [];
  if (!driver) return flags;

  // CNH expiry check
  if (driver.cnhExpiry) {
    const expiry = new Date(driver.cnhExpiry);
    const now = new Date();
    const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) flags.push("CNH vencida");
    else if (daysLeft < 30) flags.push(`CNH vence em ${daysLeft} dias`);
  }

  // CNH category — must be B or higher for passengers
  if (driver.cnhCategory && driver.cnhCategory === "A") {
    flags.push("Categoria A não habilita transporte de passageiros");
  }

  // Vehicle year check (older than 10 years)
  if (driver.vehicleYear) {
    const age = new Date().getFullYear() - driver.vehicleYear;
    if (age > 10) flags.push(`Veículo com ${age} anos (mais de 10 anos)`);
  }

  // Missing documents
  if (!driver.photoUrl) flags.push("Foto pessoal não enviada");
  if (!driver.cnhPhotoUrl) flags.push("Foto da CNH não enviada");
  if (!driver.vehiclePhotoUrl) flags.push("Foto do veículo não enviada");
  if (!driver.criminalRecordUrl) flags.push("Certidão de antecedentes não enviada");

  return flags;
}

export default function AdminDriverDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [approveDialog, setApproveDialog] = useState(false);
  const [denyDialog, setDenyDialog] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState("");

  const { data: driver, isLoading } = useGetDriverProfile(id, { query: { queryKey: getGetDriverProfileQueryKey(id) } });
  const approveDriver = useApproveDriver();
  const denyDriver = useDenyDriver();

  const autoFlags = useMemo(() => analyzeDriver(driver), [driver]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDriverProfileQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
  };

  const toggleReason = (id: string) => {
    setSelectedReasons(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const buildAdminNote = () => {
    const lines: string[] = [];
    selectedReasons.forEach(reasonId => {
      const found = DENIAL_REASONS.find(r => r.id === reasonId);
      if (found) lines.push(found.label);
    });
    if (customNote.trim()) lines.push(customNote.trim());
    return lines.join("\n") || null;
  };

  const handleApprove = () => {
    approveDriver.mutate({ id, data: { adminNote: null } }, {
      onSuccess: () => { toast({ title: "Motorista aprovado!" }); invalidate(); setApproveDialog(false); },
      onError: () => toast({ title: "Erro ao aprovar", variant: "destructive" }),
    });
  };

  const handleDeny = () => {
    const note = buildAdminNote();
    denyDriver.mutate({ id, data: { adminNote: note } }, {
      onSuccess: () => { toast({ title: "Motorista negado" }); invalidate(); setDenyDialog(false); setSelectedReasons([]); setCustomNote(""); },
      onError: () => toast({ title: "Erro ao negar", variant: "destructive" }),
    });
  };

  const handleAutoFillReasons = () => {
    const matches: string[] = [];
    if (autoFlags.some(f => f.toLowerCase().includes("cnh vencida"))) matches.push("cnh_expired");
    if (autoFlags.some(f => f.toLowerCase().includes("categoria a"))) matches.push("cnh_category");
    if (autoFlags.some(f => f.toLowerCase().includes("10 anos"))) matches.push("vehicle_old");
    if (autoFlags.some(f => f.toLowerCase().includes("foto pessoal"))) matches.push("photo_missing");
    if (autoFlags.some(f => f.toLowerCase().includes("certidão"))) matches.push("criminal_record_missing");
    setSelectedReasons(matches);
    if (matches.length === 0) toast({ title: "Nenhum problema automático detectado", variant: "destructive" });
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!driver) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Motorista não encontrado</div>;

  const cfg = STATUS_CONFIG[driver.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-24">
      <button onClick={() => setLocation("/admin/drivers")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-bold">{driver.user?.name ?? "—"}</div>
          <div className="text-sm text-muted-foreground">{driver.user?.email}</div>
        </div>
        <Badge className={`border ${cfg.color}`}>{cfg.label}</Badge>
      </div>

      {/* Auto-analysis flags */}
      {autoFlags.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 font-semibold text-sm">
            <Zap className="w-4 h-4" />
            Análise automática detectou {autoFlags.length} problema{autoFlags.length > 1 ? "s" : ""}
          </div>
          <ul className="space-y-1">
            {autoFlags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-yellow-300/80">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Admin note if already decided */}
      {driver.adminNote && (
        <div className={`rounded-xl p-4 ${driver.status === "denied" ? "bg-destructive/10 border border-destructive/30" : "bg-secondary"}`}>
          <div className="text-xs text-muted-foreground mb-2 font-medium">Motivos informados ao motorista:</div>
          <ul className="space-y-1">
            {driver.adminNote.split("\n").filter(Boolean).map((line, i) => (
              <li key={i} className="text-sm flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5">•</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Personal */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Nome", driver.user?.name],
            ["Telefone", driver.user?.phone],
            ["CPF", driver.cpf],
            ["Nascimento", driver.birthDate],
            ["Endereço", driver.address],
            ["Cidade/Estado", `${driver.city ?? "—"}/${driver.state ?? "—"}`],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="font-medium truncate">{value ?? "—"}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CNH */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> CNH</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Número CNH", driver.cnhNumber],
            ["Categoria", driver.cnhCategory],
            ["Validade", driver.cnhExpiry ? new Date(driver.cnhExpiry).toLocaleDateString("pt-BR") : "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={`font-medium ${label === "Validade" && driver.cnhExpiry && new Date(driver.cnhExpiry) < new Date() ? "text-destructive" : ""}`}>{value ?? "—"}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Vehicle */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Car className="w-4 h-4" /> Veículo</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Marca", driver.vehicleMake],
            ["Modelo", driver.vehicleModel],
            ["Ano", driver.vehicleYear],
            ["Cor", driver.vehicleColor],
            ["Placa", driver.vehiclePlate],
            ["Tipo", driver.vehicleType],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={`font-medium ${label === "Ano" && driver.vehicleYear && (new Date().getFullYear() - driver.vehicleYear) > 10 ? "text-destructive" : ""}`}>{value ?? "—"}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Documentos</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ["Foto Pessoal", driver.photoUrl],
            ["Foto CNH", driver.cnhPhotoUrl],
            ["Foto Veículo", driver.vehiclePhotoUrl],
            ["Antecedentes", driver.criminalRecordUrl],
          ].map(([label, url]) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${url ? "bg-green-400" : "bg-destructive"}`} />
                <span className="text-muted-foreground">{label}</span>
              </div>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline">Ver documento</a>
              ) : (
                <span className="text-xs text-destructive">Não enviado</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      {driver.status === "pending" && (
        <div className="flex gap-3 pt-2">
          <Button data-testid="button-deny-driver" variant="outline" className="flex-1 border-destructive/50 text-destructive" onClick={() => setDenyDialog(true)}>
            <XCircle className="w-4 h-4 mr-2" /> Negar
          </Button>
          <Button data-testid="button-approve-driver" className="flex-1 bg-primary text-primary-foreground" onClick={() => setApproveDialog(true)}>
            <CheckCircle className="w-4 h-4 mr-2" /> Aprovar
          </Button>
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-400" /> Aprovar Motorista</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ao aprovar, <strong>{driver.user?.name}</strong> poderá imediatamente começar a aceitar corridas na plataforma.
          </p>
          {autoFlags.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-400 space-y-1">
              <div className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Atenção: análise automática detectou problemas</div>
              {autoFlags.map((f, i) => <div key={i}>• {f}</div>)}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)}>Cancelar</Button>
            <Button onClick={handleApprove} disabled={approveDriver.isPending} className="bg-primary text-primary-foreground">
              {approveDriver.isPending ? "Aprovando..." : "Confirmar Aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog open={denyDialog} onOpenChange={setDenyDialog}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><XCircle className="w-5 h-5 text-destructive" /> Motivos da Recusa</DialogTitle></DialogHeader>

          <p className="text-sm text-muted-foreground">Selecione os motivos. O motorista verá essa lista e saberá exatamente o que corrigir.</p>

          {autoFlags.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleAutoFillReasons} className="border-yellow-500/40 text-yellow-400 gap-2">
              <Zap className="w-3.5 h-3.5" />
              Usar análise automática ({autoFlags.length} problema{autoFlags.length > 1 ? "s" : ""} detectado{autoFlags.length > 1 ? "s" : ""})
            </Button>
          )}

          <div className="space-y-2 mt-1">
            {DENIAL_REASONS.map(reason => (
              <div key={reason.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary cursor-pointer" onClick={() => toggleReason(reason.id)}>
                <Checkbox
                  checked={selectedReasons.includes(reason.id)}
                  onCheckedChange={() => toggleReason(reason.id)}
                  className="mt-0.5"
                />
                <Label className="text-sm leading-tight cursor-pointer">{reason.label}</Label>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Observação adicional (opcional)</Label>
            <Textarea
              placeholder="Alguma informação específica que o motorista precisa saber..."
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              rows={3}
              className="bg-secondary border-border resize-none text-sm"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDenyDialog(false); setSelectedReasons([]); setCustomNote(""); }}>Cancelar</Button>
            <Button
              onClick={handleDeny}
              disabled={denyDriver.isPending || (selectedReasons.length === 0 && !customNote.trim())}
              variant="destructive"
            >
              {denyDriver.isPending ? "Negando..." : `Negar (${selectedReasons.length + (customNote.trim() ? 1 : 0)} motivo${selectedReasons.length + (customNote.trim() ? 1 : 0) !== 1 ? "s" : ""})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
