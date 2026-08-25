"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CddiLoadingState } from "@/components/cddi-loading-state";
import { CddiPlatformFrame } from "@/components/cddi-platform-frame";
import { readCddiBatchQueue } from "@/lib/cddi-batch-queue";
import LeaderEvaluationPage from "./tela-cddi-avaliar-chefia";

export default function LeaderEvaluationRoute() {
  const router = useRouter();
  const params = useParams<{ personId: string }>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const personId = params.personId;
    const queue = readCddiBatchQueue();
    if (queue && queue.personIds.length > 1 && queue.personIds.includes(personId)) {
      const cycleFromQuery = new URLSearchParams(window.location.search).get("ciclo")?.trim();
      const cycleCode = cycleFromQuery || queue.cycleCode;
      router.replace(`/cddi/chefia/lote${cycleCode ? `?ciclo=${encodeURIComponent(cycleCode)}` : ""}`);
      return;
    }
    setReady(true);
  }, [params.personId, router]);

  if (!ready) {
    return (
      <CddiPlatformFrame title="Avaliação da chefia">
        <CddiLoadingState />
      </CddiPlatformFrame>
    );
  }

  return <LeaderEvaluationPage />;
}
