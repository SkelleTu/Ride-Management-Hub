import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";

interface RatingModalProps {
  open: boolean;
  targetName: string;
  targetRole: "motorista" | "passageiro";
  rideId: number;
  onDone: () => void;
}

async function apiPost(path: string, body: object) {
  const token = localStorage.getItem("token");
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

export function RatingModal({ open, targetName, targetRole, rideId, onDone }: RatingModalProps) {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (stars === 0) return;
    setSubmitting(true);
    await apiPost(`/api/rides/${rideId}/feedback`, {
      stars,
      message: message.trim() || undefined,
    });
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => onDone(), 1200);
  };

  const handleSkip = () => onDone();

  const displayed = hovered || stars;

  const starLabels = ["", "Péssimo", "Ruim", "Regular", "Bom", "Excelente"];

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm mx-4">
        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="text-4xl">⭐</div>
            <div className="font-semibold text-lg">Avaliação enviada!</div>
            <div className="text-sm text-muted-foreground">Obrigado pelo seu feedback.</div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-center">
                Como foi a corrida?
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="text-center text-sm text-muted-foreground">
                Avalie o(a) {targetRole} <span className="font-semibold text-foreground">{targetName.split(" ")[0]}</span>
              </div>

              {/* Stars */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <button
                    key={i}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setStars(i)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-10 h-10 transition-colors ${i <= displayed ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>

              {displayed > 0 && (
                <div className="text-center text-sm font-medium text-yellow-400">
                  {starLabels[displayed]}
                </div>
              )}

              {/* Anonymous message */}
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground text-center">
                  Deixe um recado anônimo (opcional) — só o administrador verá
                </div>
                <Textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Algo a reportar sobre esta corrida?"
                  className="resize-none text-sm"
                  rows={3}
                  maxLength={400}
                />
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                onClick={handleSubmit}
                disabled={stars === 0 || submitting}
                className="w-full bg-primary text-primary-foreground"
              >
                {submitting ? "Enviando..." : "Enviar Avaliação"}
              </Button>
              <Button variant="ghost" onClick={handleSkip} className="w-full text-muted-foreground text-sm">
                Pular
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
