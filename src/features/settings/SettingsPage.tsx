import { useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { isProdBuild } from "../../lib/supabase";
import { Button } from "../../components/ui/Button";

type SettingsPageProps = {
  authReady: boolean;
  session: Session | null;
  supabaseState: string;
  onSignIn: (email: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function SettingsPage({ authReady, session, supabaseState, onSignIn, onSignOut }: SettingsPageProps) {
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setAuthMessage("");
    try {
      await onSignIn(email.trim());
      setAuthMessage("Check your email for a sign-in link.");
    } catch (error) {
      console.warn("sign in failed", error);
      const message = error instanceof Error ? error.message : "Check your Supabase auth settings and email.";
      setAuthMessage(`Sign-in failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    setAuthMessage("");
    try {
      await onSignOut();
      setAuthMessage("Signed out.");
    } catch (error) {
      console.warn("sign out failed", error);
      setAuthMessage("Sign-out failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="settingsPanel">
      <p className="kicker">Environment</p>
      <h2>Project health</h2>
      <dl>
        <div>
          <dt>Supabase</dt>
          <dd>{supabaseState}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{isProdBuild ? "Production" : "Development"}</dd>
        </div>
        <div>
          <dt>Auth</dt>
          <dd>{!authReady ? "Checking" : session ? session.user.email ?? session.user.id : "Signed out"}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>rewrite/v2</dd>
        </div>
      </dl>

      <div className="settingsAuth">
        <h3>Supabase Auth</h3>
        {session ? (
          <div className="formActions">
            <Button variant="secondary" onClick={handleSignOut} disabled={isSubmitting}>
              Sign Out
            </Button>
          </div>
        ) : (
          <form className="campaignForm" onSubmit={handleSignIn}>
            <label>
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <Button variant="secondary" disabled={isSubmitting || !email.trim()}>
              Send Sign-In Link
            </Button>
          </form>
        )}
        {authMessage ? <p className="emptyText">{authMessage}</p> : null}
      </div>
    </section>
  );
}
