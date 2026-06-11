import { useState, useEffect, useCallback, ReactNode } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type PermState = "checking" | "granted" | "denied" | "unavailable" | "prompt";

interface LocationGuardProps { children: ReactNode; }

export function LocationGuard({ children }: LocationGuardProps) {
  const [state, setState] = useState<PermState>("checking");
  const [retrying, setRetrying] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setState("unavailable"); return; }
    setRetrying(true);
    navigator.geolocation.getCurrentPosition(
      () => { setState("granted"); setRetrying(false); },
      (err) => {
        setRetrying(false);
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setState("denied");
        } else {
          setState("prompt");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Initial check
  useEffect(() => {
    if (!navigator.geolocation) { setState("unavailable"); return; }

    // Check Permissions API first if available
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          setState("granted");
        } else if (result.state === "denied") {
          setState("denied");
        } else {
          // prompt — request now
          requestLocation();
        }
        // Watch for changes (e.g. user toggled in settings while app is open)
        result.onchange = () => {
          if (result.state === "granted") setState("granted");
          else if (result.state === "denied") setState("denied");
          else requestLocation();
        };
      }).catch(() => requestLocation());
    } else {
      requestLocation();
    }
  }, [requestLocation]);

  // Re-check when user returns to the tab / app
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && state !== "granted") {
        requestLocation();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state, requestLocation]);

  if (state === "granted") return <>{children}</>;

  const isBlocked = state === "denied" || state === "unavailable";

  return (
    <>
      {children}
      {/* Blocking overlay */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 text-center"
        style={{ background: "rgba(10,10,15,0.97)", backdropFilter: "blur(8px)" }}
      >
        <div className="mb-6 w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center">
          <MapPin className="w-10 h-10 text-primary" />
        </div>

        <h2 className="text-2xl font-bold mb-2">Localização obrigatória</h2>

        {state === "checking" && (
          <>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Verificando permissão de localização...
            </p>
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </>
        )}

        {state === "prompt" && (
          <>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              O UPcar precisa da sua localização em tempo real para conectar motoristas e passageiros com precisão durante toda a corrida.
            </p>
            <Button onClick={requestLocation} disabled={retrying} className="w-full max-w-xs h-12 text-base font-bold">
              {retrying
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Aguardando...</>
                : <><MapPin className="w-4 h-4 mr-2" /> Ativar Localização</>}
            </Button>
          </>
        )}

        {state === "denied" && (
          <>
            <p className="text-muted-foreground text-sm mb-2 max-w-xs">
              A localização está <strong className="text-destructive">bloqueada</strong> nas configurações do seu navegador ou dispositivo.
            </p>
            <p className="text-muted-foreground text-xs mb-6 max-w-xs">
              Acesse as configurações do seu navegador → Permissões do site → Localização → Permitir para este site. Depois toque em "Tentar novamente".
            </p>
            <Button onClick={requestLocation} disabled={retrying} className="w-full max-w-xs h-12 text-base font-bold">
              {retrying
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
                : <><RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente</>}
            </Button>
          </>
        )}

        {state === "unavailable" && (
          <>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Seu dispositivo não suporta geolocalização. O UPcar requer um dispositivo com GPS para funcionar.
            </p>
          </>
        )}
      </div>
    </>
  );
}
