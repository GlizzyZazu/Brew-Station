import { useEffect, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

export function useAuthSession(supabaseClient: SupabaseClient | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(() => !supabaseClient);

  useEffect(() => {
    if (!supabaseClient) return;
    const sb = supabaseClient;

    let active = true;

    async function init() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          await sb.auth.exchangeCodeForSession(code);
          url.searchParams.delete("code");
          window.history.replaceState({}, document.title, url.toString());
        }
      } catch {
        // ignore malformed URL
      }

      const { data, error } = await sb.auth.getSession();
      if (!active) return;
      if (error) console.warn("supabase getSession error", error);
      setSession(data.session ?? null);
      setAuthReady(true);
    }

    void init();

    const { data: sub } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabaseClient]);

  return { session, authReady };
}
