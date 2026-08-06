"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type NetworkStatus = "online" | "offline" | "restored";

const RESTORED_MESSAGE_DURATION = 3_500;

export function NetworkStatusBanner() {
  const [status, setStatus] = useState<NetworkStatus>("online");
  const wasOffline = useRef(false);

  useEffect(() => {
    let restoredTimeout: ReturnType<typeof setTimeout> | undefined;

    function clearRestoredTimeout() {
      if (restoredTimeout) clearTimeout(restoredTimeout);
    }

    function handleOffline() {
      clearRestoredTimeout();
      wasOffline.current = true;
      setStatus("offline");
    }

    function handleOnline() {
      clearRestoredTimeout();
      if (!wasOffline.current) {
        setStatus("online");
        return;
      }

      setStatus("restored");
      restoredTimeout = setTimeout(() => {
        wasOffline.current = false;
        setStatus("online");
      }, RESTORED_MESSAGE_DURATION);
    }

    if (!navigator.onLine) handleOffline();
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      clearRestoredTimeout();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (status === "online") return null;

  const restored = status === "restored";
  const Icon = restored ? Wifi : WifiOff;

  return (
    <div
      role="status"
      aria-live="polite"
      className="network-status-banner"
      data-status={status}
      data-print-hidden="true"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <strong>{restored ? "Conexão restabelecida" : "Você está sem conexão"}</strong>
        <span>
          {restored
            ? "Os dados voltarão a ser atualizados normalmente."
            : "Evite fechar a página. Alterações pendentes podem não ser salvas até a internet voltar."}
        </span>
      </div>
    </div>
  );
}
