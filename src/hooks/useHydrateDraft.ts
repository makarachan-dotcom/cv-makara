"use client";

import { useEffect, useState } from "react";

export function useHydrateDraft<T>(endpoint = "/api/auth/load-draft") {
  const [data, setData] = useState<T null |>(null);
  const [ready, setReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(endpoint, { credentials: "include", signal: ac.signal });
        if (!res.ok) throw new Error(`Hydrate failed [${res.status}]`);
        const json = (await res.json()) as { draft: T | null };
        setData(json.draft);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
      } finally {
        setReady(true);
      }
    })();
    return () => ac.abort();
  }, [endpoint]);

  return { data, ready, error };
}
