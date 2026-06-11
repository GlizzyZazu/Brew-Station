import type { Campaign } from "./types";

export const CAMPAIGNS: Campaign[] = [
  {
    id: "greyholt",
    name: "Greyholt",
    system: "D&D 2024",
    status: "Planning",
    nextSession: "Session 1: The Road Remembers",
    summary: "Dark fantasy horror in a rural borderland built over imperial ruins and old debts.",
    themes: ["Folk horror", "Gothic church-state", "Ancient empire ruins", "Inherited debt"],
    members: [
      { id: "cael", name: "Shad", role: "Player", characterName: "Cael Veyr" },
      { id: "bram", name: "Dustin", role: "Player", characterName: "Bram Hallow" },
      { id: "lucien", name: "Matt", role: "Player", characterName: "Lucien Vale" },
      { id: "oren", name: "Omar", role: "Player", characterName: "Oren Sol" },
    ],
    sessions: [
      {
        id: "road-remembers",
        title: "The Road Remembers",
        status: "Draft",
        summary: "The party converges at Greyholt during Tomas Vey's failed burial.",
      },
      {
        id: "sealed-well",
        title: "The Sealed Well",
        status: "Draft",
        summary: "The first descent toward the Underworks begins beneath a village lie.",
      },
    ],
  },
];
