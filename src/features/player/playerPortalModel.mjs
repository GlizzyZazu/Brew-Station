export function createPlayerSafeCampaign(campaign, currentUserId = null) {
  return {
    id: campaign.id,
    name: campaign.name,
    system: campaign.system,
    status: campaign.status,
    tone: campaign.tone,
    nextSession: campaign.nextSession,
    summary: campaign.summary,
    description: campaign.description,
    themes: campaign.themes,
    members: campaign.members.map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      characterName: member.characterName,
    })),
    sessions: campaign.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      status: session.status,
      summary: session.summary,
      notes: {
        prep: "",
        recap: session.notes.recap,
        scenes: "",
        clues: "",
        loot: session.notes.loot,
        unresolvedThreads: "",
      },
    })),
    characters: campaign.characters.map((character) => {
      const member = campaign.members.find((candidate) => candidate.id === character.campaignMemberId);
      const playerOwned = Boolean(currentUserId && member?.userId === currentUserId);
      return {
        ...character,
        playerOwned,
        resourceState: character.resourceState ?? {},
        notes: playerOwned ? character.notes : "",
      };
    }),
    secrets: campaign.secrets.filter((secret) => secret.status === "Revealed"),
    npcs: (campaign.npcs ?? [])
      .filter((npc) => npc.knownToPlayers)
      .map((npc) => ({
        id: npc.id,
        name: npc.name,
        role: npc.role,
        location: npc.location,
        attitude: npc.attitude,
        publicNotes: npc.publicNotes,
        dmNotes: "",
        knownToPlayers: true,
      })),
    encounters: [],
  };
}

export function createPlayerSafeCampaigns(campaigns, currentUserId = null, options = {}) {
  const allowLocalPreview = options.allowLocalPreview ?? false;

  return campaigns
    .filter((campaign) => {
      if (allowLocalPreview) return true;
      return campaign.members.some((member) => member.userId === currentUserId);
    })
    .map((campaign) => createPlayerSafeCampaign(campaign, currentUserId));
}
