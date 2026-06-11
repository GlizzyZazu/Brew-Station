export type Workspace = "campaigns" | "player" | "dm" | "library" | "settings";

export type NavItem = {
  id: Workspace;
  label: string;
  eyebrow: string;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "campaigns", label: "Campaigns", eyebrow: "Hub" },
  { id: "player", label: "Player", eyebrow: "Sheets" },
  { id: "dm", label: "DM", eyebrow: "Tools" },
  { id: "library", label: "Library", eyebrow: "Rules" },
  { id: "settings", label: "Settings", eyebrow: "Admin" },
];
