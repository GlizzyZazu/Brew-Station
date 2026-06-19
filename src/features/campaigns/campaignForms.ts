import type { Campaign, CampaignDraft } from "./types";

export const EMPTY_CAMPAIGN_DRAFT: CampaignDraft = {
  name: "",
  system: "D&D 2024",
  status: "Planning",
  partySize: 4,
  tone: "",
  nextSession: "",
  summary: "",
  description: "",
  themes: [],
};

export function campaignToDraft(campaign: Campaign): CampaignDraft {
  return {
    name: campaign.name,
    system: campaign.system,
    status: campaign.status,
    partySize: campaign.partySize,
    tone: campaign.tone,
    nextSession: campaign.nextSession,
    summary: campaign.summary,
    description: campaign.description,
    themes: campaign.themes,
  };
}

export function createCampaignFromDraft(draft: CampaignDraft, existingCampaigns: Campaign[]): Campaign {
  const campaignId = getUniqueCampaignId(draft.name, existingCampaigns);

  return {
    ...draft,
    id: campaignId,
    members: [],
    characters: [],
    secrets: [],
    encounters: [],
    sessions: draft.nextSession
      ? [
          {
            id: `${campaignId}-first-session`,
            title: draft.nextSession,
            status: "Draft",
            summary: "First session planning notes.",
            notes: {
              prep: "",
              recap: "",
              scenes: "",
              clues: "",
              loot: "",
              unresolvedThreads: "",
            },
          },
        ]
      : [],
  };
}

export function updateCampaignFromDraft(campaign: Campaign, draft: CampaignDraft): Campaign {
  return {
    ...campaign,
    ...draft,
  };
}

function getUniqueCampaignId(name: string, existingCampaigns: Campaign[]) {
  const baseId = slugify(name) || "campaign";
  const existingIds = new Set(existingCampaigns.map((campaign) => campaign.id));

  if (!existingIds.has(baseId)) return baseId;

  let index = 2;
  while (existingIds.has(`${baseId}-${index}`)) {
    index += 1;
  }

  return `${baseId}-${index}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
