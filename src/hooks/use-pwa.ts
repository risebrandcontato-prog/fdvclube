import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

interface PWAState {
  isStandalone: boolean;
  needRefresh: boolean;
  offlineReady: boolean;
}

export function usePWA(): PWAState & { updateServiceWorker: () => void } {
  const [isStandalone, setIsStandalone] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  const updateServiceWorker = useCallback(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.waiting?.postMessage("SKIP_WAITING");
        registration.update().then(() => {
          window.location.reload();
        });
      });
    }
  }, []);

  useEffect(() => {
    // Detecta se está rodando como app instalado (standalone)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    // Detecta quando um novo SW assume (reload automático suave)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // Listener para mensagens do SW (chunk missing / erro de code splitting)
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "CHUNK_MISSING") {
        toast.error("App desatualizado", {
          description: "Recarregando para atualizar...",
          duration: 2000,
        });
        // Força reload após 2 segundos para pegar novos chunks
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    });

    // Registra o SW
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[PWA] SW registrado:", registration.scope);

        // Notifica quando o SW está pronto pro offline
        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.onstatechange = () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Novo SW instalado mas esperando (tem versão nova)
              setNeedRefresh(true);
              toast.info("Nova versão disponível", {
                description: "Clique para atualizar o app.",
                action: {
                  label: "Atualizar",
                  onClick: updateServiceWorker,
                },
                duration: 0,
              });
            } else if (newWorker.state === "activated") {
              setOfflineReady(true);
            }
          };
        };
      })
      .catch((err) => {
        console.error("[PWA] Falha ao registrar SW:", err);
      });
  }, [updateServiceWorker]);

  return { isStandalone, needRefresh, offlineReady, updateServiceWorker };
}