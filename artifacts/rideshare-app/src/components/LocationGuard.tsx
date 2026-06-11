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

  if (state === "granted") return <>{children}</>;

  const isChecking = state === "checking";

  return (
    <>
      {children}
      {/* Full-screen blocking overlay */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 text-center"
        style={{ background: "rgba(10,10,15,0.97)", backdropFilter: "blur(8px)" }}
      >
        <div className={`mb-6 w-20 h-20 rounded-3xl flex items-center justify-center ${isChecking ? "bg-secondary" : "bg-primary/20"}`}>
          <MapPin className={`w-10 h-10 ${isChecking ? "text-muted-foreground" : "text-primary"}`} />
        </div>

        <h2 className="text-2xl font-bold mb-2">
          {isChecking ? "Verificando localização..." : "Localização obrigatória"}
        </h2>

        {isChecking && (
          <div className="mt-4 animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        )}

        {state === "prompt" && (
          <>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              O UPcar precisa da sua localização em tempo real para conectar motoristas e passageiros com precisão durante toda a corrida.
            </p>
            <Button onClick={handleRetry} disabled={retrying} className="w-full max-w-xs h-12 text-base font-bold">
              {retrying
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Aguardando...</>
                : <><MapPin className="w-4 h-4 mr-2" /> Ativar Localização</>}
            </Button>
          </>
        )}

        {state === "denied" && (
          <>
            <p className="text-muted-foreground text-sm mb-2 max-w-xs">
              A localização está <strong className="text-destructive">bloqueada</strong>. O app não pode funcionar sem ela.
            </p>
            <p className="text-muted-foreground text-xs mb-6 max-w-xs leading-relaxed">
              Toque no ícone de cadeado ou localização na barra do navegador → Permissões → Localização → Permitir. Depois toque em "Tentar novamente".
            </p>
            <Button onClick={handleRetry} disabled={retrying} className="w-full max-w-xs h-12 text-base font-bold">
              {retrying
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
                : <><RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente</>}
            </Button>
          </>
        )}

        {state === "unavailable" && (
          <p className="text-muted-foreground text-sm max-w-xs mt-2">
            Seu dispositivo não suporta geolocalização. O UPcar requer um dispositivo com GPS para funcionar.
          </p>
        )}
      </div>
    </>
  );
}
