import { useState } from "react";
import { useLocation } from "wouter";
import { useGetDriverProfile, getGetDriverProfileQueryKey, useApproveDriver, useDenyDriver } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListDriversQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, XCircle, User, Car, FileText, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "Aprovado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  denied: { label: "Negado", color: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function AdminDriverDetail({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [approveDialog, setApproveDialog] = useState(false);
  const [denyDialog, setDenyDialog] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  const { data: driver, isLoading } = useGetDriverProfile(id, { query: { queryKey: getGetDriverProfileQueryKey(id) } });
  const approveDriver = useApproveDriver();
  const denyDriver = useDenyDriver();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDriverProfileQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListDriversQueryKey() });
  };

  const handleApprove = () => {
    approveDriver.mutate({ id, data: { adminNote: adminNote || null } }, {
      onSuccess: () => { toast({ title: "Motorista aprovado!" }); invalidate(); setApproveDialog(false); },
      onError: () => toast({ title: "Erro ao aprovar", variant: "destructive" }),
    });
  };

  const handleDeny = () => {
    denyDriver.mutate({ id, data: { adminNote: adminNote || null } }, {
      onSuccess: () => { toast({ title: "Motorista negado" }); invalidate(); setDenyDialog(false); },
      onError: () => toast({ title: "Erro ao negar", variant: "destructive" }),
    });
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

      {/* Personal */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Nome", driver.user?.name],
            ["Telefone", driver.user?.phone],
            ["CPF", driver.cpf],
            ["Nascimento", driver.birthDate],
            ["Endereco", driver.address],
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
            ["Numero CNH", driver.cnhNumber],
            ["Categoria", driver.cnhCategory],
            ["Validade", driver.cnhExpiry],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="font-medium">{value ?? "—"}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Vehicle */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Car className="w-4 h-4" /> Veiculo</CardTitle></CardHeader>
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
              <div className="font-medium">{value ?? "—"}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Documents */}
      {(driver.photoUrl || driver.cnhPhotoUrl || driver.vehiclePhotoUrl || driver.criminalRecordUrl) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Documentos</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Foto Pessoal", driver.photoUrl],
              ["Foto CNH", driver.cnhPhotoUrl],
              ["Foto Veiculo", driver.vehiclePhotoUrl],
              ["Antecedentes", driver.criminalRecordUrl],
            ].filter(([, v]) => v).map(([label, url]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-muted-foreground">{label}</span>
                <a href={url ?? "#"} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline">Ver documento</a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {driver.adminNote && (
        <div className="bg-secondary rounded-xl p-4">
          <div className="text-xs text-muted-foreground mb-1">Nota do administrador</div>
          <div className="text-sm">{driver.adminNote}</div>
        </div>
      )}

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
          <DialogHeader><DialogTitle>Aprovar Motorista</DialogTitle></DialogHeader>
          <Textarea placeholder="Nota opcional..." value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={3} className="bg-secondary border-border" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)}>Cancelar</Button>
            <Button onClick={handleApprove} disabled={approveDriver.isPending} className="bg-primary text-primary-foreground">
              {approveDriver.isPending ? "Aprovando..." : "Confirmar Aprovacao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog open={denyDialog} onOpenChange={setDenyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Negar Motorista</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo da recusa (opcional)..." value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={3} className="bg-secondary border-border" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyDialog(false)}>Cancelar</Button>
            <Button onClick={handleDeny} disabled={denyDriver.isPending} variant="destructive">
              {denyDriver.isPending ? "Negando..." : "Confirmar Recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
