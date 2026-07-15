import { useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { MapPin, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Retorna true quando o app está rodando dentro de um iframe (ex: preview do Replit). */
function isInsideIframe(): boolean {
  try { return window.self !== window.top; }
  catch { return true; } // cross-origin → definitivamente iframe
}

type PermState = "checking" | "granted" | "denied" | "unavailable" | "prompt";

interface LocationGuardProps { children: ReactNode; }

export function LocationGuard({ children }: LocationGuardProps) {
  const [state, setState] = useState<PermState>("checking");
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Dispara o prompt nativo de localização do navegador.
   *
   * REGRA IMPORTANTE: só PERMISSION_DENIED (code 1) significa que o usuário
   * bloqueou o acesso. POSITION_UNAVAILABLE (code 2) e TIMEOUT (code 3) são
   * problemas de sinal/GPS — a permissão pode estar concedida e eles ocorrem
   * normalmente em ambientes sem GPS dedicado (desktop, VM, rede celular fraca).
   * Nesses casos tratamos como "granted" para não bloquear o usuário
   * incorretamente.
   */
  const requestPermission = useCallback((onDone?: () => void) => {
    if (!navigator.geolocation) { setState("unavailable"); onDone?.(); return; }
    navigator.geolocation.getCurrentPosition(
      () => {
        setState("granted");
        setRetrying(false);
        onDone?.();
      },
      (err) => {
        setRetrying(false);
        onDone?.();
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setState("denied");
        } else {
          // POSITION_UNAVAILABLE ou TIMEOUT: sinal/GPS indisponível,
          // não significa bloqueio pelo usuário — deixa entrar.
          setState("granted");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  /**
   * Verifica o estado atual de permissão via Permissions API (quando disponível)
   * e reage de acordo. Fallback: dispara getCurrentPosition diretamente.
   */
  const checkPermission = useCallback(() => {
    if (!navigator.geolocation) { setState("unavailable"); return; }
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") setState("granted");
        else if (result.state === "denied") setState("denied");
        else requestPermission(); // "prompt" → abre dialog nativo
      }).catch(() => requestPermission());
    } else {
      requestPermission();
    }
  }, [requestPermission]);

  // ── Verificação inicial ────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setState("unavailable"); return; }

    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          setState("granted");
        } else if (result.state === "denied") {
          setState("denied");
        } else {
          // "prompt": ainda não decidiu — dispara dialog nativo
          requestPermission();
        }

        // Ouve mudanças feitas pelo usuário na barra do navegador
        result.onchange = () => {
          if (result.state === "granted") setState("granted");
          else if (result.state === "denied") setState("denied");
          else requestPermission();
        };
      }).catch(() => requestPermission());
    } else {
      requestPermission();
    }
  }, [requestPermission]);

  // ── Polling passivo — detecta revogação de permissão em sessão ────────────
  // Só altera o estado em PERMISSION_DENIED explícito; ignora erros de sinal.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        () => setState(prev => prev !== "granted" ? "granted" : prev),
        (err) => {
          // APENAS PERMISSION_DENIED indica revogação real
          if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
            setState("denied");
          }
          // POSITION_UNAVAILABLE / TIMEOUT: ignorar — pode ser sinal fraco
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 },
      );
    }, 5000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // ── Re-verifica quando o tab volta ao foco ────────────────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkPermission();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [checkPermission]);

  // ── Botão "Tentar novamente" ───────────────────────────────────────────────
  const handleRetry = () => {
    setRetrying(true);
    // Consulta Permissions API primeiro para não abrir dialog desnecessário
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((r) => {
        if (r.state === "granted") { setState("granted"); setRetrying(false); }
        else if (r.state === "denied") { setState("denied"); setRetrying(false); }
        else requestPermission();
      }).catch(() => requestPermission());
    } else {
      requestPermission();
    }
  };

  // Sempre renderiza o app — localização é usada quando disponível,
  // mas nunca bloqueia o acesso. O usuário pode digitar endereços manualmente.
  return <>{children}</>;
}
