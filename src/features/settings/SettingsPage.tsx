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
  onPasswordSignIn: (email: string, password: string) => Promise<void>;
  onPasswordSignUp: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function SettingsPage({
  authReady,
  session,
  supabaseState,
  onSignIn,
  onPasswordSignIn,
  onPasswordSignUp,
  onSignOut,
}: SettingsPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleMagicLink(event: FormEvent<HTMLFormElement>) {
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

  async function handlePasswordSignIn() {
    if (!email.trim() || !password) return;

    setIsSubmitting(true);
    setAuthMessage("");
    try {
      await onPasswordSignIn(email.trim(), password);
      setAuthMessage("Signed in.");
    } catch (error) {
      console.warn("password sign in failed", error);
      const message = error instanceof Error ? error.message : "Check your email and password.";
      setAuthMessage(`Password sign-in failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordSignUp() {
    if (!email.trim() || password.length < 6) return;

    setIsSubmitting(true);
    setAuthMessage("");
    try {
      await onPasswordSignUp(email.trim(), password);
      setAuthMessage("Account created. If email confirmation is enabled, check your email before signing in.");
    } catch (error) {
      console.warn("password sign up failed", error);
      const message = error instanceof Error ? error.message : "Check your Supabase auth settings.";
      setAuthMessage(`Account creation failed: ${message}`);
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
          <form className="campaignForm" onSubmit={handleMagicLink}>
            <label>
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div className="formActions">
              <Button
                type="button"
                variant="secondary"
                onClick={handlePasswordSignIn}
                disabled={isSubmitting || !email.trim() || !password}
              >
                Sign In
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handlePasswordSignUp}
                disabled={isSubmitting || !email.trim() || password.length < 6}
              >
                Create Account
              </Button>
              <Button variant="ghost" disabled={isSubmitting || !email.trim()}>
                Send Magic Link
              </Button>
            </div>
          </form>
        )}
        {authMessage ? <p className="emptyText">{authMessage}</p> : null}
      </div>
    </section>
  );
}
