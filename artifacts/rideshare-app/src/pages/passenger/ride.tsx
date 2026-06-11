import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetRide, getGetRideQueryKey, useListOffers, getListOffersQueryKey, useAcceptOffer, useRejectOffer, useCancelRide } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Navigation, Clock, Star, Car, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "Aguardando Motoristas", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  negotiating: { label: "Recebendo Ofertas", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  accepted: { label: "Motorista a Caminho", color: "bg-primary/20 text-primary border-primary/30" },
  in_progress: { label: "Em Viagem", color: "bg-accent/20 text-accent border-accent/30" },
  completed: { label: "Concluida", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  cancelled: { label: "Cancelada", color: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function PassengerRide({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ride, isLoading } = useGetRide(id, { query: { queryKey: getGetRideQueryKey(id), refetchInterval: 5000 } });
  const { data: offers = [] } = useListOffers(id, { query: { queryKey: getListOffersQueryKey(id), refetchInterval: 5000 } });
  const acceptOffer = useAcceptOffer();
  const rejectOffer = useRejectOffer();
  const cancelRide = useCancelRide();

  const handleAccept = (offerId: number) => {
    acceptOffer.mutate({ rideId: id, offerId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetRideQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListOffersQueryKey(id) });
        toast({ title: "Motorista aceito! Aguarde a chegada." });
      },
      onError: () => toast({ title: "Erro ao aceitar oferta", variant: "destructive" }),
    });
  };

  const handleReject = (offerId: number) => {
    rejectOffer.mutate({ rideId: id, offerId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOffersQueryKey(id) }),
    });
  };

  const handleCancel = () => {
    cancelRide.mutate({ id }, {
      onSuccess: () => { toast({ title: "Corrida cancelada" }); setLocation("/passenger"); },
    });
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!ride) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Corrida não encontrada</div>;

  const statusInfo = STATUS_LABELS[ride.status] ?? { label: ride.status, color: "" };
  const pendingOffers = offers.filter(o => o.status === "pending");

  return (
    <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-24">
      <button onClick={() => setLocation("/passenger")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      {/* Status */}
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

      {/* Price */}
      <Card>
        <CardContent className="p-4 flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Sua oferta</span>
          <span className="text-xl font-bold text-primary">R$ {ride.offeredPrice.toFixed(2)}</span>
        </CardContent>
      </Card>

      {/* Assigned Driver (accepted/in_progress) */}
      {ride.driver && (ride.status === "accepted" || ride.status === "in_progress") && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                {ride.driver.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-semibold">{ride.driver.name}</div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                {ride.driver.rating?.toFixed(1) ?? "Novo"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Valor acordado</div>
              <div className="font-bold text-primary">R$ {ride.agreedPrice?.toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Offers */}
      {pendingOffers.length > 0 && ride.status !== "accepted" && ride.status !== "in_progress" && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-muted-foreground">Ofertas recebidas ({pendingOffers.length})</div>
          {pendingOffers.map(offer => (
            <Card key={offer.id} data-testid={`card-offer-${offer.id}`} className="border-border">
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
                  <Button data-testid={`button-accept-offer-${offer.id}`} size="sm" className="flex-1 bg-primary text-primary-foreground" onClick={() => handleAccept(offer.id)}>
                    <CheckCircle className="w-3 h-3 mr-1" /> Aceitar
                  </Button>
                  <Button data-testid={`button-reject-offer-${offer.id}`} size="sm" variant="outline" className="flex-1" onClick={() => handleReject(offer.id)}>
                    <XCircle className="w-3 h-3 mr-1" /> Recusar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cancel */}
      {(ride.status === "open" || ride.status === "negotiating") && (
        <Button data-testid="button-cancel-ride" variant="outline" className="w-full border-destructive/50 text-destructive" onClick={handleCancel}>
          Cancelar Corrida
        </Button>
      )}
    </div>
  );
}
