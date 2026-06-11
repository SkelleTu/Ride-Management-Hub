import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useGetRide, getGetRideQueryKey, useUpdateRideStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import MapView from "@/components/map/MapView";
import { ArrowLeft, Navigation, CheckSquare, ExternalLink, Play, Phone, MessageCircle, X, Send, Star, Car } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { openGpsApp } from "@/lib/gps";

const GPS_APPS = [
  { id: "googleMaps" as const, name: "Google Maps", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: "waze" as const, name: "Waze", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  { id: "browser" as const, name: "Maps (Browser)", color: "bg-secondary text-foreground border-border" },
];

const CANCEL_REASONS = [
  "Passageiro não apareceu",
  "Endereço incorreto ou inacessível",
  "Problema mecânico no veículo",
  "Emergência pessoal",
  "Passageiro solicitou cancelamento",
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

export default function DriverRide({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [gpsSheetOpen, setGpsSheetOpen] = useState(false);
  const [gpsTarget, setGpsTarget] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [autoOpenedForPickup, setAutoOpenedForPickup] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: ride, isLoading } = useGetRide(id, {
    query: { queryKey: getGetRideQueryKey(id), refetchInterval: 5000 }
  });
  const updateStatus = useUpdateRideStatus();

  // GPS broadcast — send position every 6s
  useEffect(() => {
    if (!navigator.geolocation) return;
    let active = true;

    const broadcast = () => {
      if (!active) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setDriverPos({ lat, lng });
          apiPatch(`/api/rides/${id}/location`, { lat, lng }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    };

    broadcast();
    const interval = setInterval(broadcast, 6000);
    return () => { active = false; clearInterval(interval); };
  }, [id]);

  // Poll messages every 3s when chat is open
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

  // Scroll to bottom when new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  // Auto-open GPS to pickup on first enter
  useEffect(() => {
    if (ride && ride.status === "accepted" && !autoOpenedForPickup) {
      setAutoOpenedForPickup(true);
      setGpsTarget({ lat: ride.originLat, lng: ride.originLng, label: "Embarque" });
      setGpsSheetOpen(true);
    }
  }, [ride, autoOpenedForPickup]);

  const handleStartTrip = () => {
    if (!ride) return;
    updateStatus.mutate({ id, data: { status: "in_progress" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRideQueryKey(id) });
        toast({ title: "Viagem iniciada!" });
        setGpsTarget({ lat: ride.destinationLat, lng: ride.destinationLng, label: "Destino" });
        setGpsSheetOpen(true);
      },
    });
  };

  const handleComplete = () => {
    updateStatus.mutate({ id, data: { status: "completed" } }, {
      onSuccess: () => {
        toast({ title: "Corrida finalizada!" });
        setLocation("/driver");
      },
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
      setLocation("/driver");
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

  const handleGpsOpen = (app: "googleMaps" | "waze" | "browser") => {
    if (!gpsTarget) return;
    openGpsApp(app, gpsTarget.lat, gpsTarget.lng);
    setGpsSheetOpen(false);
  };

  const unread = messages.filter(m => m.senderId !== user?.id).length;

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!ride) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Corrida não encontrada</div>;

  const isActive = ride.status === "accepted" || ride.status === "in_progress";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <button onClick={() => setLocation("/driver")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <Badge className={`text-xs ${ride.status === "in_progress" ? "bg-accent/20 text-accent border-accent/30" : "bg-primary/20 text-primary border-primary/30"} border`}>
          {ride.status === "in_progress" ? "Em Viagem" : "A Caminho"}
        </Badge>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(true)}
            className="relative p-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            {unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">{unread}</span>}
          </button>
          {ride.passenger?.phone && (
            <a href={`tel:${ride.passenger.phone}`} className="p-2 rounded-full bg-green-500/20 hover:bg-green-500/30 transition-colors">
              <Phone className="w-5 h-5 text-green-400" />
            </a>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="h-52 shrink-0">
        <MapView
          origin={{ lat: ride.originLat, lng: ride.originLng }}
          destination={ride.status === "in_progress" ? { lat: ride.destinationLat, lng: ride.destinationLng } : null}
          driverPosition={driverPos}
          className="h-full w-full"
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-4">
        {/* Passenger info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/20 text-primary font-bold">{ride.passenger?.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{ride.passenger?.name}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  {ride.passenger?.rating?.toFixed(1) ?? "Novo"} · {ride.passenger?.totalRides} corridas
                </div>
              </div>
              <div className="flex items-center gap-2">
                {ride.passenger?.phone && (
                  <a href={`tel:${ride.passenger.phone}`} className="flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg">
                    <Phone className="w-3 h-3" /> Ligar
                  </a>
                )}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Valor acordado</span>
              <span className="text-xl font-bold text-primary">R$ {(ride.agreedPrice ?? ride.offeredPrice).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Route */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">Embarque</div>
                <div className="text-sm font-medium truncate">{ride.originAddress.split(",")[0]}</div>
                {ride.originAddress.includes(",") && <div className="text-xs text-muted-foreground truncate">{ride.originAddress.split(",").slice(1).join(",").trim()}</div>}
              </div>
              <button onClick={() => { setGpsTarget({ lat: ride.originLat, lng: ride.originLng, label: "Embarque" }); setGpsSheetOpen(true); }}
                className="text-xs flex items-center gap-1 text-primary bg-primary/10 px-2 py-1.5 rounded-lg shrink-0">
                <Navigation className="w-3 h-3" /> Ir
              </button>
            </div>
            <div className="ml-1 border-l-2 border-dashed border-muted-foreground/30 h-3" />
            <div className="flex items-start gap-3">
              <Navigation className="w-3 h-3 text-accent mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">Destino</div>
                <div className="text-sm font-medium truncate">{ride.destinationAddress.split(",")[0]}</div>
                {ride.destinationAddress.includes(",") && <div className="text-xs text-muted-foreground truncate">{ride.destinationAddress.split(",").slice(1).join(",").trim()}</div>}
              </div>
              <button onClick={() => { setGpsTarget({ lat: ride.destinationLat, lng: ride.destinationLng, label: "Destino" }); setGpsSheetOpen(true); }}
                className="text-xs flex items-center gap-1 text-accent bg-accent/10 px-2 py-1.5 rounded-lg shrink-0">
                <Navigation className="w-3 h-3" /> Ir
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        {ride.status === "accepted" && (
          <Button onClick={handleStartTrip} disabled={updateStatus.isPending}
            className="w-full h-14 text-base font-bold bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl">
            <Play className="w-5 h-5 mr-2" />
            {updateStatus.isPending ? "Iniciando..." : "Passageiro a Bordo — Iniciar Viagem"}
          </Button>
        )}
        {ride.status === "in_progress" && (
          <Button onClick={handleComplete} disabled={updateStatus.isPending}
            className="w-full h-14 text-base font-bold bg-primary text-primary-foreground rounded-xl">
            <CheckSquare className="w-5 h-5 mr-2" />
            {updateStatus.isPending ? "Finalizando..." : "Finalizar Corrida"}
          </Button>
        )}

        {/* Cancel */}
        {isActive && (
          <Button variant="outline" onClick={() => setCancelOpen(true)}
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10">
            <X className="w-4 h-4 mr-2" /> Cancelar Corrida
          </Button>
        )}
      </div>

      {/* Chat Sheet */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="bottom" className="h-[75vh] flex flex-col rounded-t-2xl p-0">
          <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" /> Chat com {ride.passenger?.name}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8">Nenhuma mensagem ainda</div>
            )}
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
            <Input
              value={msgInput}
              onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMsg(); } }}
              placeholder="Digite uma mensagem..."
              className="flex-1"
            />
            <Button size="icon" onClick={handleSendMsg} disabled={sendingMsg || !msgInput.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* GPS App Selector */}
      <Sheet open={gpsSheetOpen} onOpenChange={setGpsSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-1">
            <SheetTitle>Navegar até {gpsTarget?.label ?? "endereço"}</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mb-4">Escolha o app:</p>
          <div className="space-y-3">
            {GPS_APPS.map(app => (
              <button key={app.id} onClick={() => handleGpsOpen(app.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${app.color} hover:opacity-80`}>
                <span className="font-semibold">{app.name}</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Cancelar corrida</DialogTitle>
          </DialogHeader>
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
              {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
