import { useState } from "react";
import { useListUsers, getListUsersQueryKey, useDeleteUser } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Star, Trash2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function approveAccount(id: number) {
  const token = localStorage.getItem("token");
  const r = await fetch(`/api/users/${id}/approve-account`, {
    method: "PATCH",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!r.ok) throw new Error("Erro ao aprovar");
  return r.json();
}

async function denyAccount(id: number) {
  const token = localStorage.getItem("token");
  const r = await fetch(`/api/users/${id}/deny-account`, {
    method: "PATCH",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!r.ok) throw new Error("Erro ao negar");
  return r.json();
}

type Tab = "pending" | "approved" | "all";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending:  { label: "Aguardando",  className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border" },
  approved: { label: "Aprovado",    className: "bg-green-500/20 text-green-400 border-green-500/30 border" },
  denied:   { label: "Negado",      className: "bg-destructive/20 text-destructive border-destructive/30 border" },
};

export default function AdminPassengers() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("pending");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allPassengers = [], isLoading } = useListUsers(
    { role: "passenger", search: search || undefined },
    { query: { queryKey: getListUsersQueryKey({ role: "passenger", search: search || undefined }) } }
  );
  const deleteUser = useDeleteUser();

  const approve = useMutation({
    mutationFn: approveAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Conta aprovada!", description: "Passageiro liberado para usar o app." });
    },
  });

  const deny = useMutation({
    mutationFn: denyAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Conta negada.", variant: "destructive" });
    },
  });

  const passengers = allPassengers.filter(p => {
    if (tab === "pending")  return (p as any).accountStatus === "pending";
    if (tab === "approved") return (p as any).accountStatus === "approved";
    return true;
  });

  const pendingCount  = allPassengers.filter(p => (p as any).accountStatus === "pending").length;
  const approvedCount = allPassengers.filter(p => (p as any).accountStatus === "approved").length;

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Excluir ${name}?`)) return;
    deleteUser.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "Usuário excluído" });
      },
    });
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold">Passageiros</div>
        <div className="text-sm text-muted-foreground">{allPassengers.length} total</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { key: "pending" as Tab,  label: "Aguardando", count: pendingCount,              icon: Clock },
          { key: "approved" as Tab, label: "Aprovados",  count: approvedCount,             icon: CheckCircle2 },
          { key: "all" as Tab,      label: "Todos",      count: allPassengers.length,      icon: Users },
        ] as const).map(({ key, label, count, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              tab === key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab === key ? "bg-white/20" : "bg-muted"}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-search" placeholder="Buscar passageiros..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
      </div>

      {passengers.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div>{tab === "pending" ? "Nenhum cadastro aguardando aprovação" : "Nenhum passageiro encontrado"}</div>
        </div>
      )}

      {passengers.map(p => {
        const status = (p as any).accountStatus ?? "approved";
        const badge = STATUS_BADGE[status] ?? STATUS_BADGE.approved;
        const isPending = status === "pending";

        return (
          <Card key={p.id} data-testid={`card-passenger-${p.id}`} className={isPending ? "border-yellow-500/30" : ""}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={p.avatarUrl ?? undefined} alt={p.name} className="object-cover" />
                  <AvatarFallback className="bg-blue-500/20 text-blue-400 font-bold">{p.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{p.name}</span>
                    <Badge className={`text-xs ${badge.className}`}>{badge.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                  <div className="text-xs text-muted-foreground">{p.phone}</div>
                </div>
                <div className="text-right shrink-0">
                  {p.rating && (
                    <div className="flex items-center gap-1 text-xs text-yellow-400 justify-end">
                      <Star className="w-3 h-3 fill-yellow-400" />{p.rating.toFixed(1)}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">{p.totalRides} corridas</div>
                  <div className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</div>
                </div>
              </div>

              {/* Approve / Deny row — only for pending */}
              {isPending && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1"
                    onClick={() => approve.mutate(p.id)}
                    disabled={approve.isPending || deny.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 gap-1"
                    onClick={() => deny.mutate(p.id)}
                    disabled={approve.isPending || deny.isPending}
                  >
                    <XCircle className="w-4 h-4" /> Negar
                  </Button>
                  <Button
                    data-testid={`button-delete-${p.id}`}
                    variant="ghost"
                    size="icon"
                    className="text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(p.id, p.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {!isPending && (
                <div className="flex justify-end">
                  <Button
                    data-testid={`button-delete-${p.id}`}
                    variant="ghost"
                    size="icon"
                    className="text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(p.id, p.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
