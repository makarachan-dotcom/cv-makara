"use client";

import { useEffect, useRef, useState } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useDebouncedAutoSave<T>(data: T, endpoint = "/api/auth/save-draft", delayMs = 700) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const acRef = useRef<AbortController | null>(null);
  const firstRun = useRef<boolean>(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(async () => {
      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;
      setStatus("saving");
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`Save failed [${res.status}]`);
        setStatus("saved");
        setLastSavedAt(Date.now());
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        console.error(e);
        setStatus("error");
      }
    }, delayMs);

    return () => clearTimeout(t);
  }, [data, endpoint, delayMs]);

  return { status, lastSavedAt };
}
