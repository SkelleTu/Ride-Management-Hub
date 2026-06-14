import { Clock, MapPin, Navigation, Zap, Calendar } from "lucide-react";

interface Block {
  rideId: number;
  startsAt: string;
  endsAt: string;
  endsAtNoBuffer: string;
  durationMin: number;
  isScheduled: boolean;
  passengerName: string;
  originAddress: string;
  destinationAddress: string;
  agreedPrice: number | null;
}

interface Gap {
  startsAt: string;
  endsAt: string;
  durationMin: number;
  label: "large" | "medium" | "small" | "tiny";
}

interface Props {
  blocks: Block[];
  gaps: Gap[];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

const GAP_COLORS: Record<Gap["label"], { bg: string; text: string; dot: string; label: string }> = {
  large:  { bg: "bg-green-500/10 border-green-500/20",  text: "text-green-400",  dot: "bg-green-500",  label: "Janela livre" },
  medium: { bg: "bg-blue-500/10 border-blue-500/20",    text: "text-blue-400",   dot: "bg-blue-400",   label: "Disponível" },
  small:  { bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-400", dot: "bg-yellow-400", label: "Curta" },
  tiny:   { bg: "bg-muted/20 border-muted/30",           text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Apertada" },
};

export function ScheduleTimeline({ blocks, gaps }: Props) {
  if (blocks.length === 0 && gaps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <Zap className="w-7 h-7 text-green-400" />
        </div>
        <div className="font-medium text-green-400">Agenda completamente livre</div>
        <div className="text-sm text-muted-foreground">Você não tem corridas agendadas. Fique de olho nas solicitações!</div>
      </div>
    );
  }

  // Interleave blocks and gaps sorted by time
  type Item =
    | { kind: "block"; data: Block }
    | { kind: "gap"; data: Gap };

  const items: Item[] = [
    ...blocks.map(b => ({ kind: "block" as const, data: b })),
    ...gaps.slice(0, gaps.length - 1).map(g => ({ kind: "gap" as const, data: g })),
  ].sort((a, b) => {
    const ta = new Date(a.data.startsAt).getTime();
    const tb = new Date(b.data.startsAt).getTime();
    return ta - tb;
  });

  // Group by day
  const byDay: Record<string, Item[]> = {};
  for (const item of items) {
    const day = fmtDate(item.data.startsAt);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(item);
  }

  return (
    <div className="space-y-5">
      {Object.entries(byDay).map(([day, dayItems]) => (
        <div key={day}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{day}</span>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

            <div className="space-y-2">
              {dayItems.map((item, idx) => {
                if (item.kind === "block") {
                  const b = item.data;
                  return (
                    <div key={`block-${b.rideId}-${idx}`} className="flex items-start gap-3">
                      <div className="relative z-10 w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 bg-card border border-primary/20 rounded-xl p-3 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-primary">
                            {fmt(b.startsAt)} – {fmt(b.endsAtNoBuffer)}
                          </span>
                          {b.agreedPrice && (
                            <span className="text-xs font-bold text-green-400">R$ {b.agreedPrice.toFixed(2)}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          <span className="inline-block w-3 h-3 rounded-full bg-primary/60 mr-1 align-middle" />
                          {b.originAddress.split(",")[0]}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          <Navigation className="inline w-3 h-3 mr-1 text-accent align-middle" />
                          {b.destinationAddress.split(",")[0]}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                          <Clock className="w-3 h-3" />
                          {b.durationMin} min · {b.passengerName}
                          {b.isScheduled && (
                            <span className="ml-1 bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full text-[10px]">Agendada</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                const g = item.data;
                const c = GAP_COLORS[g.label];
                const gapMin = g.durationMin;
                const showGapHint = gapMin >= 20;

                return (
                  <div key={`gap-${g.startsAt}-${idx}`} className="flex items-start gap-3">
                    <div className="relative z-10 w-9 h-9 flex items-center justify-center shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    </div>
                    {showGapHint ? (
                      <div className={`flex-1 border rounded-lg px-3 py-2 ${c.bg}`}>
                        <div className={`text-xs font-medium ${c.text}`}>
                          {c.label} · {gapMin >= 60
                            ? `${Math.floor(gapMin / 60)}h ${gapMin % 60 > 0 ? `${gapMin % 60}min` : ""}`
                            : `${gapMin} min`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmt(g.startsAt)} – {fmt(g.endsAt)}
                        </div>
                        {g.label === "large" && (
                          <div className={`text-xs mt-0.5 ${c.text}`}>
                            Ótimo momento para aceitar corridas em tempo real
                          </div>
                        )}
                        {g.label === "medium" && (
                          <div className={`text-xs mt-0.5 ${c.text}`}>
                            Você pode encaixar uma corrida curta aqui
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 py-1">
                        <div className="text-xs text-muted-foreground">{gapMin} min livres</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
