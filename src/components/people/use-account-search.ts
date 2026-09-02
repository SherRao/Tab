"use client";

import { useEffect, useState } from "react";

export interface AccountMatch {
  id: number;
  username: string;
  displayName: string;
  email: string;
}

export function useAccountSearch(query: string, enabled: boolean) {
  const [matches, setMatches] = useState<AccountMatch[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!enabled || query.trim().length < 2) {
        setMatches([]);
        return;
      }
      try {
        const res = await fetch(`/api/accounts/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { accounts: AccountMatch[] };
        setMatches(data.accounts);
      } catch {
        /* aborted or offline */
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled]);
  return matches;
}
