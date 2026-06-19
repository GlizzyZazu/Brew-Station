import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { CampaignDraft, CampaignStatus } from "./types";

type CampaignFormProps = {
  initialDraft: CampaignDraft;
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (draft: CampaignDraft) => void;
};

const STATUS_OPTIONS: CampaignStatus[] = ["Planning", "Active", "Paused"];

export function CampaignForm({ initialDraft, mode, onCancel, onSubmit }: CampaignFormProps) {
  const [draft, setDraft] = useState<CampaignDraft>(initialDraft);
  const [themesInput, setThemesInput] = useState(initialDraft.themes.join(", "));

  const canSubmit = useMemo(() => draft.name.trim().length > 0 && draft.summary.trim().length > 0, [draft]);

  function updateDraft<Key extends keyof CampaignDraft>(key: Key, value: CampaignDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    onSubmit({
      ...draft,
      name: draft.name.trim(),
      system: draft.system.trim() || "D&D 2024",
      tone: draft.tone.trim(),
      nextSession: draft.nextSession.trim(),
      summary: draft.summary.trim(),
      description: draft.description.trim(),
      themes: themesInput
        .split(",")
        .map((theme) => theme.trim())
        .filter(Boolean),
    });
  }

  return (
    <Card className="formPanel">
      <div className="panelHeader">
        <div>
          <p className="kicker">{mode === "create" ? "New campaign" : "Edit campaign"}</p>
          <h3>{mode === "create" ? "Start a campaign draft" : `Tune ${initialDraft.name}`}</h3>
        </div>
      </div>

      <form className="campaignForm" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
        </label>

        <div className="formGrid">
          <label>
            <span>System</span>
            <input value={draft.system} onChange={(event) => updateDraft("system", event.target.value)} />
          </label>
          <label>
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(event) => updateDraft("status", event.target.value as CampaignStatus)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Party Size</span>
            <input
              min={1}
              max={12}
              type="number"
              value={draft.partySize}
              onChange={(event) => updateDraft("partySize", Number(event.target.value))}
            />
          </label>
        </div>

        <label>
          <span>Tone</span>
          <input value={draft.tone} onChange={(event) => updateDraft("tone", event.target.value)} />
        </label>

        <label>
          <span>Short Summary</span>
          <input value={draft.summary} onChange={(event) => updateDraft("summary", event.target.value)} />
        </label>

        <label>
          <span>Description</span>
          <textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
        </label>

        <div className="formGrid two">
          <label>
            <span>Next Session</span>
            <input value={draft.nextSession} onChange={(event) => updateDraft("nextSession", event.target.value)} />
          </label>
          <label>
            <span>Themes</span>
            <input value={themesInput} onChange={(event) => setThemesInput(event.target.value)} />
          </label>
        </div>

        <div className="formActions">
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {mode === "create" ? "Create Campaign" : "Save Changes"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
