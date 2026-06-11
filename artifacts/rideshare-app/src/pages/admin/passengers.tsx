import { useState } from "react";
import { useListUsers, getListUsersQueryKey, useDeleteUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Users, Star, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminPassengers() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: passengers = [], isLoading } = useListUsers(
    { role: "passenger", search: search || undefined },
    { query: { queryKey: getListUsersQueryKey({ role: "passenger", search: search || undefined }) } }
  );
  const deleteUser = useDeleteUser();

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
        <div className="text-sm text-muted-foreground">{passengers.length} total</div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-search" placeholder="Buscar passageiros..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
      </div>

      {passengers.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <div>Nenhum passageiro encontrado</div>
        </div>
      )}

      {passengers.map(p => (
        <Card key={p.id} data-testid={`card-passenger-${p.id}`}>
          <CardContent className="p-4 flex items-center gap-3">
            <Avatar>
              <AvatarImage src={p.avatarUrl ?? undefined} alt={p.name} className="object-cover" />
              <AvatarFallback className="bg-blue-500/20 text-blue-400 font-bold">{p.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.email}</div>
              <div className="text-xs text-muted-foreground">{p.phone}</div>
            </div>
            <div className="text-right mr-2">
              {p.rating && (
                <div className="flex items-center gap-1 text-xs text-yellow-400 justify-end">
                  <Star className="w-3 h-3 fill-yellow-400" />{p.rating.toFixed(1)}
                </div>
              )}
              <div className="text-xs text-muted-foreground">{p.totalRides} corridas</div>
              <div className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</div>
            </div>
            <Button data-testid={`button-delete-${p.id}`} variant="ghost" size="icon" className="text-destructive/50 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(p.id, p.name)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
