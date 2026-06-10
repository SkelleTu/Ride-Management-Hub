import { useState } from "react";
import { useLocation } from "wouter";
import { useGetRide, getGetRideQueryKey, useCreateOffer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetActiveRidesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, MapPin, Navigation, DollarSign, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DriverOffer({ params }: { params: { rideId: string } }) {
  const rideId = parseInt(params.rideId);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");

  const { data: ride, isLoading } = useGetRide(rideId, {
    query: { queryKey: getGetRideQueryKey(rideId) }
  });
  const createOffer = useCreateOffer();

  const handleSubmit = () => {
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) {
      toast({ title: "Informe um valor válido", variant: "destructive" });
      return;
    }
    createOffer.mutate({ rideId, data: { price: p, message: message || null } }, {
      onSuccess: (offer) => {
        queryClient.invalidateQueries({ queryKey: getGetActiveRidesQueryKey() });
        toast({ title: "Oferta enviada! Aguarde a resposta do passageiro." });
        setLocation("/driver");
      },
      onError: (e: any) => toast({ title: e?.data?.error ?? "Erro ao enviar oferta", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!ride) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Corrida não encontrada</div>;

  return (
    <div className="flex-1 p-4 space-y-5 overflow-y-auto">
      <button onClick={() => setLocation("/driver")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div>
        <div className="text-xl font-bold">Fazer Oferta</div>
        <div className="text-sm text-muted-foreground">Corrida #{ride.id} · {ride.passenger?.name}</div>
      </div>

      {/* Route */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Embarque</div>
              <div className="text-sm font-medium">{ride.originAddress.split(",").slice(0, 2).join(",")}</div>
            </div>
          </div>
          <div className="ml-1 border-l-2 border-dashed border-muted h-4" />
          <div className="flex items-start gap-3">
            <Navigation className="w-3 h-3 text-accent mt-1 shrink-0" />
            <div>
              <div className="text-xs text-muted-foreground">Destino</div>
              <div className="text-sm font-medium">{ride.destinationAddress.split(",").slice(0, 2).join(",")}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Passenger offer */}
      <div className="flex items-center justify-between bg-secondary rounded-xl p-4">
        <span className="text-sm text-muted-foreground">Oferta do passageiro</span>
        <span className="text-xl font-bold text-accent">R$ {ride.offeredPrice.toFixed(2)}</span>
      </div>

      {/* Your price */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Sua proposta de valor</label>
        <div className="flex items-center gap-2 bg-secondary rounded-xl px-4 py-3 border border-border focus-within:border-primary transition-colors">
          <span className="text-primary font-bold">R$</span>
          <Input
            data-testid="input-offer-price"
            type="number"
            placeholder="0,00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border-none bg-transparent p-0 h-auto text-xl font-bold focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Mensagem (opcional)</label>
        <Textarea
          data-testid="input-offer-message"
          placeholder="Ex: Carro limpo, ar condicionado, chego em 5 min..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="bg-secondary border-border resize-none"
          rows={3}
        />
      </div>

      <Button
        data-testid="button-send-offer"
        onClick={handleSubmit}
        disabled={!price || createOffer.isPending}
        className="w-full h-12 text-base font-semibold rounded-xl"
      >
        <Send className="w-4 h-4 mr-2" />
        {createOffer.isPending ? "Enviando..." : "Enviar Oferta"}
      </Button>
    </div>
  );
}
