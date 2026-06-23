export type Workspace = "campaigns" | "dm" | "characters" | "library" | "settings";

export type NavItem = {
  id: Workspace;
  label: string;
  eyebrow: string;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "campaigns", label: "Campaigns", eyebrow: "Play" },
  { id: "dm", label: "DM", eyebrow: "Manage" },
  { id: "characters", label: "Characters", eyebrow: "Sheets" },
  { id: "library", label: "Library", eyebrow: "Rules" },
];
