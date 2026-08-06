"use client";

import { useEffect } from "react";
import {
  createErrorReference,
  errorMessageFromUnknown,
  reportApplicationError,
} from "@/lib/observability";

function currentRoute() {
  return typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
}

export function ClientErrorReporter() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      void reportApplicationError({
        reference: createErrorReference(),
        route: currentRoute(),
        type: navigator.onLine ? "CLIENTE" : "REDE",
        message: event.message || errorMessageFromUnknown(event.error),
        context: {
          source: event.filename || null,
          line: event.lineno || null,
          column: event.colno || null,
          online: navigator.onLine,
        },
      });
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      void reportApplicationError({
        reference: createErrorReference(),
        route: currentRoute(),
        type: navigator.onLine ? "CLIENTE" : "REDE",
        message: errorMessageFromUnknown(event.reason),
        context: {
          source: "unhandledrejection",
          online: navigator.onLine,
        },
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
