export type Workspace = "campaigns" | "characters" | "player" | "library" | "settings";

export type NavItem = {
  id: Workspace;
  label: string;
  eyebrow: string;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "campaigns", label: "Campaigns", eyebrow: "Hub" },
  { id: "characters", label: "Characters", eyebrow: "Sheets" },
  { id: "player", label: "Player Portal", eyebrow: "Safe" },
  { id: "library", label: "Library", eyebrow: "Rules" },
  { id: "settings", label: "Settings", eyebrow: "Admin" },
];
