import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useGetRide, getGetRideQueryKey, useListOffers, getListOffersQueryKey, useAcceptOffer, useRejectOffer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import MapView from "@/components/map/MapView";
import { MapPin, Navigation, Star, CheckCircle, XCircle, ArrowLeft, Phone, MessageCircle, X, Send, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "Aguardando Motoristas", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  negotiating: { label: "Recebendo Propostas", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  accepted: { label: "Motorista a Caminho", color: "bg-primary/20 text-primary border-primary/30" },
  in_progress: { label: "Em Viagem", color: "bg-accent/20 text-accent border-accent/30" },
  completed: { label: "Concluída", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  cancelled: { label: "Cancelada", color: "bg-destructive/20 text-destructive border-destructive/30" },
};

const CANCEL_REASONS = [
  "Esperei muito tempo",
  "Mudança de planos",
  "Veículo diferente do cadastrado",
  "Motorista não encontrou o local",
  "Emergência pessoal",
  "Outro motivo",
];

interface Message { id: number; senderId: number; senderName: string; content: string; createdAt: string; }

async function apiPost(path: string, body: object) {
  const token = localStorage.getItem("token");
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

async function apiPatch(path: string, body: object) {
  const token = localStorage.getItem("token");
  return fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

async function apiGet(path: string) {
  const token = localStorage.getItem("token");
  return fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

export default function PassengerRide({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: ride, isLoading } = useGetRide(id, { query: { queryKey: getGetRideQueryKey(id), refetchInterval: 5000 } });
  const { data: offers = [] } = useListOffers(id, { query: { queryKey: getListOffersQueryKey(id), refetchInterval: 5000 } });
  const acceptOffer = useAcceptOffer();
  const rejectOffer = useRejectOffer();

  const isConnected = ride?.status === "accepted" || ride?.status === "in_progress";

  // Passenger broadcasts GPS every 6s when ride is active
  useEffect(() => {
    if (!isConnected || !navigator.geolocation) return;
    let active = true;
    const broadcast = () => {
      if (!active) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!active) return;
          const { latitude: lat, longitude: lng } = pos.coords;
          const token = localStorage.getItem("token");
          fetch(`/api/rides/${id}/passenger-location`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ lat, lng }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    };
    broadcast();
    const interval = setInterval(broadcast, 6000);
    return () => { active = false; clearInterval(interval); };
  }, [id, isConnected]);

  // Poll messages every 3s when chat open
  useEffect(() => {
    const load = async () => {
      const r = await apiGet(`/api/rides/${id}/messages`);
      if (r.ok) setMessages(await r.json());
    };
    load();
    if (!chatOpen) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [id, chatOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  const handleAccept = (offerId: number) => {
    acceptOffer.mutate({ rideId: id, offerId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRideQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListOffersQueryKey(id) });
        toast({ title: "Motorista aceito! Aguarde a chegada." });
      },
      onError: () => toast({ title: "Erro ao aceitar proposta", variant: "destructive" }),
    });
  };

  const handleReject = (offerId: number) => {
    rejectOffer.mutate({ rideId: id, offerId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOffersQueryKey(id) }),
    });
  };

  const handleCancel = async () => {
    const reason = cancelReason === "Outro motivo" ? customReason : cancelReason;
    if (!reason) { toast({ title: "Selecione um motivo", variant: "destructive" }); return; }
    setCancelling(true);
    const r = await apiPatch(`/api/rides/${id}/cancel`, { reason });
    setCancelling(false);
    if (r.ok) {
      toast({ title: "Corrida cancelada" });
      queryClient.invalidateQueries({ queryKey: getGetRideQueryKey(id) });
      setLocation("/passenger");
    } else {
      toast({ title: "Erro ao cancelar", variant: "destructive" });
    }
  };

  const handleSendMsg = async () => {
    if (!msgInput.trim()) return;
    setSendingMsg(true);
    const r = await apiPost(`/api/rides/${id}/messages`, { content: msgInput.trim() });
    if (r.ok) {
      const msg = await r.json();
      setMessages(prev => [...prev, msg]);
      setMsgInput("");
    }
    setSendingMsg(false);
  };

  const unread = messages.filter(m => m.senderId !== user?.id).length;

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!ride) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Corrida não encontrada</div>;

  const statusInfo = STATUS_LABELS[ride.status] ?? { label: ride.status, color: "" };
  const pendingOffers = offers.filter(o => o.status === "pending");
  const driverPos = ride.driverLat && ride.driverLng ? { lat: ride.driverLat, lng: ride.driverLng } : null;

  // ── CONNECTED VIEW (accepted or in_progress) ──
  if (isConnected) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <button onClick={() => setLocation("/passenger")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <Badge className={`text-xs border ${statusInfo.color}`}>{statusInfo.label}</Badge>
          <div className="flex items-center gap-2">
            <button onClick={() => setChatOpen(true)} className="relative p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
              <MessageCircle className="w-5 h-5" />
              {unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">{unread}</span>}
            </button>
            {ride.driver?.phone && (
              <a href={`tel:${ride.driver.phone}`} className="p-2 rounded-full bg-green-500/20 hover:bg-green-500/30 transition-colors">
                <Phone className="w-5 h-5 text-green-400" />
              </a>
            )}
          </div>
        </div>

        {/* Map with driver position */}
        <div className="h-52 shrink-0">
          <MapView
            origin={{ lat: ride.originLat, lng: ride.originLng }}
            destination={ride.status === "in_progress" ? { lat: ride.destinationLat, lng: ride.destinationLng } : null}
            driverPosition={driverPos}
            passengerPhotoUrl={user?.avatarUrl ?? null}
            driverPhotoUrl={(ride.driver as any)?.avatarUrl ?? null}
            className="h-full w-full"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Driver info */}
          {ride.driver && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    {(ride.driver as any).avatarUrl && <img src={(ride.driver as any).avatarUrl} alt={ride.driver.name} className="w-full h-full object-cover rounded-full" />}
                    {!(ride.driver as any).avatarUrl && <AvatarFallback className="bg-primary text-primary-foreground font-bold">{ride.driver.name.charAt(0)}</AvatarFallback>}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{ride.driver.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      {ride.driver.rating?.toFixed(1) ?? "Novo"} · {ride.driver.totalRides} corridas
                    </div>
                  </div>
                  {ride.driver.phone && (
                    <a href={`tel:${ride.driver.phone}`} className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg shrink-0">
                      <Phone className="w-3 h-3" /> Ligar
                    </a>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-border flex justify-between">
                  <span className="text-xs text-muted-foreground">Valor acordado</span>
                  <span className="text-xl font-bold text-primary">R$ {ride.agreedPrice?.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Route */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Embarque</div>
                  <div className="text-sm font-medium truncate">{ride.originAddress.split(",").slice(0, 2).join(",")}</div>
                </div>
              </div>
              <div className="ml-1 border-l-2 border-dashed border-muted h-4" />
              <div className="flex items-start gap-3">
                <Navigation className="w-3 h-3 text-accent mt-1 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Destino</div>
                  <div className="text-sm font-medium truncate">{ride.destinationAddress.split(",").slice(0, 2).join(",")}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Driver location indicator */}
          {driverPos ? (
            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Localização do motorista atualizada em tempo real
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-xl p-3">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              Aguardando localização do motorista...
            </div>
          )}

          {/* Cancel */}
          <Button variant="outline" onClick={() => setCancelOpen(true)}
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10">
            <X className="w-4 h-4 mr-2" /> Cancelar Corrida
          </Button>
        </div>

        {/* Chat Sheet */}
        <Sheet open={chatOpen} onOpenChange={setChatOpen}>
          <SheetContent side="bottom" className="h-[75vh] flex flex-col rounded-t-2xl p-0">
            <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
              <SheetTitle className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Chat com {ride.driver?.name}
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 && <div className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem ainda</div>}
              {messages.map(msg => (
                <div key={msg.id} className={`mb-3 flex ${msg.senderId === user?.id ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${msg.senderId === user?.id ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                    {msg.senderId !== user?.id && <div className="text-xs font-semibold mb-1 opacity-70">{msg.senderName}</div>}
                    <div>{msg.content}</div>
                    <div className="text-[10px] opacity-60 mt-1 text-right">{new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </ScrollArea>
            <div className="p-4 border-t border-border flex gap-2 shrink-0">
              <Input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMsg(); } }}
                placeholder="Digite uma mensagem..." className="flex-1" />
              <Button size="icon" onClick={handleSendMsg} disabled={sendingMsg || !msgInput.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Cancel Dialog */}
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent className="max-w-sm mx-4">
            <DialogHeader><DialogTitle>Cancelar corrida</DialogTitle></DialogHeader>
            <div className="space-y-2 py-2">
              <p className="text-sm text-muted-foreground mb-3">Selecione o motivo:</p>
              {CANCEL_REASONS.map(r => (
                <button key={r} onClick={() => setCancelReason(r)}
                  className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${cancelReason === r ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"}`}>
                  {r}
                </button>
              ))}
              {cancelReason === "Outro motivo" && (
                <Input value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="Descreva o motivo..." className="mt-2" />
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={cancelling || !cancelReason}>
                {cancelling ? "Cancelando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── WAITING VIEW (open / negotiating / completed / cancelled) ──
  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-24">
      <button onClick={() => setLocation("/passenger")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="text-center">
        <Badge className={`text-sm px-4 py-1.5 border ${statusInfo.color}`}>{statusInfo.label}</Badge>
      </div>

      {/* Route */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Origem</div>
              <div className="text-sm font-medium leading-tight">{ride.originAddress.split(",").slice(0, 2).join(",")}</div>
            </div>
          </div>
          <div className="ml-1 border-l-2 border-dashed border-muted h-4" />
          <div className="flex items-start gap-3">
            <Navigation className="w-3 h-3 text-accent mt-1 shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Destino</div>
              <div className="text-sm font-medium leading-tight">{ride.destinationAddress.split(",").slice(0, 2).join(",")}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Sua oferta</span>
          <span className="text-xl font-bold text-primary">R$ {ride.offeredPrice.toFixed(2)}</span>
        </CardContent>
      </Card>

      {/* Proposals */}
      {pendingOffers.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-muted-foreground">Propostas recebidas ({pendingOffers.length})</div>
          {pendingOffers.map(offer => (
            <Card key={offer.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs bg-secondary">{offer.driver?.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{offer.driver?.name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                      {offer.driver?.rating?.toFixed(1) ?? "Novo"} · {offer.driver?.totalRides} corridas
                    </div>
                  </div>
                  <div className="text-lg font-bold text-accent">R$ {offer.price.toFixed(2)}</div>
                </div>
                {offer.message && <div className="text-xs text-muted-foreground mb-3 italic">"{offer.message}"</div>}
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-primary text-primary-foreground" onClick={() => handleAccept(offer.id)}>
                    <CheckCircle className="w-3 h-3 mr-1" /> Aceitar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleReject(offer.id)}>
                    <XCircle className="w-3 h-3 mr-1" /> Recusar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(ride.status === "open" || ride.status === "negotiating") && (
        <Button variant="outline" onClick={() => setCancelOpen(true)}
          className="w-full border-destructive/50 text-destructive">
          <X className="w-4 h-4 mr-2" /> Cancelar Corrida
        </Button>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader><DialogTitle>Cancelar corrida</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground mb-3">Selecione o motivo:</p>
            {CANCEL_REASONS.map(r => (
              <button key={r} onClick={() => setCancelReason(r)}
                className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${cancelReason === r ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground"}`}>
                {r}
              </button>
            ))}
            {cancelReason === "Outro motivo" && (
              <Input value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="Descreva o motivo..." className="mt-2" />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling || !cancelReason}>
              {cancelling ? "Cancelando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
