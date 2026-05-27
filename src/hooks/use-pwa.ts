import { useEffect, useState } from "react";
import { toast } from "sonner";

export function usePWA() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Registra o Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registrado:", registration.scope);

          // Detecta nova versão
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                  toast.info("Nova versão disponível! Recarregue para atualizar.", {
                    action: {
                      label: "Atualizar",
                      onClick: () => {
                        newWorker.postMessage("SKIP_WAITING");
                        window.location.reload();
                      },
                    },
                    duration: 10000,
                  });
                }
              });
            }
          });
        })
        .catch((err) => console.error("SW erro:", err));

      // Escuta mensagens do SW (chunk missing, etc.)
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "CHUNK_MISSING") {
          toast.error("Nova versão detectada. Recarregando...", {
            duration: 3000,
          });
          setTimeout(() => window.location.reload(), 2000);
        }
      });
    }

    // Detecta offline/online
    const onOffline = () => {
      setOffline(true);
      toast.warning("📵 Você está offline", { duration: 3000 });
    };
    const onOnline = () => {
      setOffline(false);
      toast.success("🌐 Conexão restaurada", { duration: 2000 });
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    // Verifica estado inicial
    if (!navigator.onLine) setOffline(true);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return { updateAvailable, offline };
}