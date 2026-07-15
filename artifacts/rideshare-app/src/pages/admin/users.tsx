import { useState } from "react";
import { useListUsers, getListUsersQueryKey, useDeleteUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Trash2, Shield, Car, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLE_CONFIG = {
  passenger: { label: "Passageiro", color: "bg-blue-500/20 text-blue-400", icon: User },
  driver: { label: "Motorista", color: "bg-accent/20 text-accent", icon: Car },
  admin: { label: "Admin", color: "bg-primary/20 text-primary", icon: Shield },
};

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useListUsers(
    { search: search || undefined },
    { query: { queryKey: getListUsersQueryKey({ search: search || undefined }) } }
  );
  const deleteUser = useDeleteUser();

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Excluir usuário ${name}?`)) return;
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
        <div className="text-xl font-bold">Todos os Usuarios</div>
        <div className="text-sm text-muted-foreground">{users.length} total</div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-search" placeholder="Buscar usuarios..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
      </div>

      {users.map(u => {
        const role = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG];
        const Icon = role?.icon ?? User;
        return (
          <Card key={u.id} data-testid={`card-user-${u.id}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <Avatar>
                <AvatarImage src={u.avatarUrl ?? undefined} alt={u.name} className="object-cover" />
                <AvatarFallback className={`font-bold ${role?.color ?? ""}`}>{u.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{u.name}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
                <div className="text-xs text-muted-foreground">{u.phone}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className={`text-xs ${role?.color ?? ""}`}>
                  <Icon className="w-3 h-3 mr-1" />
                  {role?.label ?? u.role}
                </Badge>
                <div className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString("pt-BR")}</div>
              </div>
              {u.role !== "admin" && (
                <Button data-testid={`button-delete-${u.id}`} variant="ghost" size="icon" className="text-destructive/50 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(u.id, u.name)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
