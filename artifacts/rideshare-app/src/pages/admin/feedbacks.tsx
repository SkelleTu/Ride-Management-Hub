import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Star, MessageSquare, Ban, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Feedback {
  id: number;
  rideId: number;
  reviewerName: string;
  reviewerRole: string;
  revieweeName: string;
  stars: number;
  message: string | null;
  createdAt: string;
  revieweeId: number;
  revieweeSuspended: boolean;
}

async function apiGet(path: string) {
  const token = localStorage.getItem("token");
  return fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

async function apiPatch(path: string, body: object) {
  const token = localStorage.getItem("token");
  return fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

function StarDisplay({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= Math.round(stars) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{stars.toFixed(1)}</span>
    </div>
  );
}

export default function AdminFeedbacks() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "reports">("all");
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<Feedback | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [acting, setActing] = useState(false);

  const load = async () => {
    const r = await apiGet("/api/admin/feedbacks");
    if (r.ok) setFeedbacks(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const displayed = filter === "reports"
    ? feedbacks.filter(f => f.message && f.message.trim())
    : feedbacks;

  const handleSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    setActing(true);
    const r = await apiPatch(`/api/admin/users/${suspendTarget.revieweeId}/suspend`, {
      suspended: true,
      reason: suspendReason.trim(),
    });
    setActing(false);
    if (r.ok) {
      toast({ title: `${suspendTarget.revieweeName} suspenso(a)` });
      setSuspendOpen(false);
      setSuspendReason("");
      load();
    } else {
      toast({ title: "Erro ao suspender", variant: "destructive" });
    }
  };

  const handleUnsuspend = async (feedback: Feedback) => {
    const r = await apiPatch(`/api/admin/users/${feedback.revieweeId}/suspend`, { suspended: false });
    if (r.ok) {
      toast({ title: `${feedback.revieweeName} reativado(a)` });
      load();
    } else {
      toast({ title: "Erro ao reativar", variant: "destructive" });
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-24">
      <button onClick={() => setLocation("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div>
        <div className="text-xl font-bold">Feedbacks e Denúncias</div>
        <div className="text-sm text-muted-foreground">Avaliações anônimas deixadas após corridas</div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${filter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
        >
          Todos ({feedbacks.length})
        </button>
        <button
          onClick={() => setFilter("reports")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${filter === "reports" ? "bg-destructive text-destructive-foreground border-destructive" : "border-border text-muted-foreground hover:border-muted-foreground"}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
          Com Mensagem ({feedbacks.filter(f => f.message?.trim()).length})
        </button>
      </div>

      {displayed.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div className="text-sm">Nenhum feedback encontrado</div>
        </div>
      )}

      <div className="space-y-3">
        {displayed.map(fb => (
          <Card key={fb.id} className={`border ${fb.message ? "border-yellow-500/30 bg-yellow-500/5" : "border-border"}`}>
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    <Badge variant="outline" className={`text-[10px] mr-1.5 ${fb.reviewerRole === "passenger" ? "border-blue-500/40 text-blue-400" : "border-accent/40 text-accent"}`}>
                      {fb.reviewerRole === "passenger" ? "Passageiro" : "Motorista"}
                    </Badge>
                    avaliou corrida #{fb.rideId}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{fb.revieweeName}</span>
                    <span className="text-muted-foreground"> foi avaliado(a)</span>
                  </div>
                  <StarDisplay stars={fb.stars} />
                </div>
                <div className="text-xs text-muted-foreground shrink-0 text-right">
                  {new Date(fb.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  {fb.revieweeSuspended && (
                    <div className="mt-1">
                      <Badge className="text-[10px] bg-destructive/20 text-destructive border-destructive/30 border">Suspenso</Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Anonymous message */}
              {fb.message && (
                <div className="bg-secondary/60 rounded-xl p-3 border border-border">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Mensagem anônima:
                  </div>
                  <div className="text-sm italic">"{fb.message}"</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {fb.revieweeSuspended ? (
                  <Button size="sm" variant="outline" className="text-green-400 border-green-500/40 hover:bg-green-500/10"
                    onClick={() => handleUnsuspend(fb)}>
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Reativar {fb.revieweeName.split(" ")[0]}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => { setSuspendTarget(fb); setSuspendOpen(true); }}>
                    <Ban className="w-3.5 h-3.5 mr-1" /> Suspender {fb.revieweeName.split(" ")[0]}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Suspend Dialog */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="w-4 h-4" /> Suspender {suspendTarget?.revieweeName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              O usuário será bloqueado de usar a plataforma. Informe o motivo:
            </p>
            <Input
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              placeholder="Motivo da suspensão..."
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={acting || !suspendReason.trim()}>
              {acting ? "Suspendendo..." : "Confirmar Suspensão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
