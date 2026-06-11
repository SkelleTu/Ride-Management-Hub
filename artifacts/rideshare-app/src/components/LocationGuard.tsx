import { useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type PermState = "checking" | "granted" | "denied" | "unavailable" | "prompt";

interface LocationGuardProps { children: ReactNode; }

export function LocationGuard({ children }: LocationGuardProps) {
  const [state, setState] = useState<PermState>("checking");
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tryGetLocation = useCallback((onSuccess?: () => void) => {
    if (!navigator.geolocation) { setState("unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      () => {
        setState("granted");
        setRetrying(false);
        onSuccess?.();
      },
      (err) => {
        setRetrying(false);
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setState("denied");
        } else if (err.code === GeolocationPositionError.POSITION_UNAVAILABLE) {
          // POSITION_UNAVAILABLE can also mean permission was just revoked on some browsers
          setState("denied");
        } else {
          // Timeout or other — just retry state
          setState(prev => prev === "granted" ? "denied" : "prompt");
        }
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  }, []);

  // Initial check + Permissions API listener
  useEffect(() => {
    if (!navigator.geolocation) { setState("unavailable"); return; }

    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          setState("granted");
        } else if (result.state === "denied") {
          setState("denied");
        } else {
          tryGetLocation();
        }

        // Native listener — fires in Chrome when user changes location in browser bar
        result.onchange = () => {
          if (result.state === "granted") {
            tryGetLocation();
          } else if (result.state === "denied") {
            setState("denied");
          } else {
            tryGetLocation();
          }
        };
      }).catch(() => tryGetLocation());
    } else {
      tryGetLocation();
    }
  }, [tryGetLocation]);

  // Active polling — detects mid-session revocation in all browsers
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        () => {
          setState(prev => prev !== "granted" ? "granted" : prev);
        },
        (err) => {
          if (
            err.code === GeolocationPositionError.PERMISSION_DENIED ||
            err.code === GeolocationPositionError.POSITION_UNAVAILABLE
          ) {
            setState("denied");
          }
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
      );
    }, 5000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Re-check when tab becomes visible again
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") tryGetLocation();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [tryGetLocation]);

  const handleRetry = () => {
    setRetrying(true);
    tryGetLocation();
  };

  // During first check: render app normally so the native browser popup
  // appears on a clean screen (not covered by our overlay)
  if (state === "checking" || state === "granted") return <>{children}</>;

  return (
    <>
      {children}
      {/* Full-screen blocking overlay — only shown after explicit denial */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 text-center"
        style={{ background: "rgba(10,10,15,0.97)", backdropFilter: "blur(8px)" }}
      >
        <div className="mb-6 w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center">
          <MapPin className="w-10 h-10 text-primary" />
        </div>

        <h2 className="text-2xl font-bold mb-3">Localização obrigatória</h2>

        {state === "prompt" && (
          <>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              O UPcar precisa da sua localização em tempo real. Toque em <strong className="text-foreground">"Ativar Localização"</strong> e depois em <strong className="text-foreground">"Permitir"</strong> na janela do navegador.
            </p>
            <Button onClick={handleRetry} disabled={retrying} className="w-full max-w-xs h-12 text-base font-bold">
              {retrying
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Aguardando permissão...</>
                : <><MapPin className="w-4 h-4 mr-2" /> Ativar Localização</>}
            </Button>
          </>
        )}

        {state === "denied" && (
          <>
            <p className="text-muted-foreground text-sm mb-2 max-w-xs">
              A localização está <strong className="text-destructive">bloqueada</strong> nas permissões do navegador.
            </p>

            {/* Step-by-step visual guide */}
            <div className="w-full max-w-xs text-left space-y-2 mb-6 mt-2">
              <div className="flex items-start gap-3 bg-secondary/60 rounded-xl p-3">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span className="text-xs text-muted-foreground">Toque no ícone 🔒 ou <strong className="text-foreground">ⓘ</strong> na barra de endereços do navegador</span>
              </div>
              <div className="flex items-start gap-3 bg-secondary/60 rounded-xl p-3">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span className="text-xs text-muted-foreground">Toque em <strong className="text-foreground">Permissões do site</strong> → <strong className="text-foreground">Localização</strong></span>
              </div>
              <div className="flex items-start gap-3 bg-secondary/60 rounded-xl p-3">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span className="text-xs text-muted-foreground">Selecione <strong className="text-foreground">Permitir</strong> e volte ao app</span>
              </div>
            </div>

            <Button onClick={handleRetry} disabled={retrying} className="w-full max-w-xs h-12 text-base font-bold">
              {retrying
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
                : <><RefreshCw className="w-4 h-4 mr-2" /> Já ativei — Tentar novamente</>}
            </Button>
          </>
        )}

        {state === "unavailable" && (
          <p className="text-muted-foreground text-sm max-w-xs mt-2">
            Seu dispositivo não suporta geolocalização. O UPcar requer um dispositivo com GPS.
          </p>
        )}
      </div>
    </>
  );
}
