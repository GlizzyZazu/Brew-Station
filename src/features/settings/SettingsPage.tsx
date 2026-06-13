import { useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { isProdBuild, supabase } from "../../lib/supabase";
import { runSupabaseSchemaDiagnostics } from "../../lib/supabaseDiagnostics.mjs";
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

type SchemaDiagnosticResult = {
  id: string;
  label: string;
  table: string;
  status: "ok" | "error";
  message: string;
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
  const [schemaMessage, setSchemaMessage] = useState("");
  const [schemaResults, setSchemaResults] = useState<SchemaDiagnosticResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSchema, setIsCheckingSchema] = useState(false);

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

  async function handleSchemaDiagnostic() {
    if (!supabase) {
      setSchemaMessage("Supabase is not configured for this build.");
      setSchemaResults([]);
      return;
    }

    setIsCheckingSchema(true);
    setSchemaMessage("");
    try {
      const results = (await runSupabaseSchemaDiagnostics(supabase)) as SchemaDiagnosticResult[];
      setSchemaResults(results);
      const failures = results.filter((result) => result.status === "error");
      setSchemaMessage(
        failures.length === 0
          ? "Schema check passed. Required V2 tables and columns are reachable."
          : `Schema check found ${failures.length} issue${failures.length === 1 ? "" : "s"}.`
      );
    } catch (error) {
      console.warn("schema diagnostic failed", error);
      setSchemaMessage(error instanceof Error ? error.message : "Schema diagnostic failed.");
      setSchemaResults([]);
    } finally {
      setIsCheckingSchema(false);
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

      <div className="settingsAuth">
        <h3>Supabase Schema</h3>
        <p className="emptyText">
          Checks required V2 tables and columns with read-only queries. Permission errors still mean Supabase responded,
          but the reported table or policy needs review before cloud testing.
        </p>
        <div className="formActions">
          <Button variant="secondary" onClick={handleSchemaDiagnostic} disabled={!supabase || isCheckingSchema}>
            {isCheckingSchema ? "Checking..." : "Check Schema"}
          </Button>
        </div>
        {schemaMessage ? <p className="emptyText">{schemaMessage}</p> : null}
        {schemaResults.length > 0 ? (
          <div className="schemaDiagnosticList">
            {schemaResults.map((result) => (
              <article className={`schemaDiagnosticItem is-${result.status}`} key={result.id}>
                <div>
                  <h4>{result.label}</h4>
                  <p>{result.table}</p>
                </div>
                <p>{result.message}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
