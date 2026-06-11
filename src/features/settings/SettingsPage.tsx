import { isProdBuild } from "../../lib/supabase";

type SettingsPageProps = {
  supabaseState: string;
};

export function SettingsPage({ supabaseState }: SettingsPageProps) {
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
          <dt>Branch</dt>
          <dd>rewrite/v2</dd>
        </div>
      </dl>
    </section>
  );
}
