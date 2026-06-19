import type { CharacterDraft } from "../campaigns/characterForms";

export type ChoiceGuide = {
  name: string;
  summary: string;
  details: string;
  values?: Partial<CharacterDraft>;
};

export type ClassGuide = ChoiceGuide & {
  subclasses: ChoiceGuide[];
};

export const CLASS_GUIDES: ClassGuide[] = [
  {
    name: "Barbarian",
    summary: "Primal front-line force",
    details: "Best for direct pressure, physical resilience, and a character who solves danger by meeting it head-on.",
    values: { className: "Barbarian", hitPointMaximum: 14, currentHitPoints: 14, armorClass: 14, proficiencyBonus: 2 },
    subclasses: [
      { name: "Path of the Berserker", summary: "Ferocious offense", details: "Leans into relentless attacks and a simple, explosive combat identity." },
      { name: "Path of the Wild Heart", summary: "Primal adaptation", details: "Good for a warrior whose rage takes on animal, land, or spirit themes." },
      { name: "Path of the World Tree", summary: "Cosmic guardian", details: "Fits a protector tied to roots, branches, planar force, and battlefield control." },
      { name: "Path of the Zealot", summary: "Sacred fury", details: "A strong choice for divine wrath, prophecy, martyrdom, or unstoppable conviction." },
    ],
  },
  {
    name: "Bard",
    summary: "Inspiring skill caster",
    details: "A flexible social, support, and utility class built around talent, magic, and making allies better.",
    values: { className: "Bard", hitPointMaximum: 10, currentHitPoints: 10, armorClass: 14, proficiencyBonus: 2 },
    subclasses: [
      { name: "College of Dance", summary: "Graceful movement", details: "For kinetic performers who use rhythm, mobility, and presence in a fight." },
      { name: "College of Glamour", summary: "Fey magnetism", details: "Best for charm, spectacle, command, and social power with an otherworldly edge." },
      { name: "College of Lore", summary: "Knowledge expert", details: "Great for broad skills, secrets, scholarship, and magical versatility." },
      { name: "College of Valor", summary: "Battlefield performer", details: "A bard who stands closer to the front and turns courage into momentum." },
    ],
  },
  {
    name: "Cleric",
    summary: "Divine support and defense",
    details: "A strong fit for protection, healing, faith, and prepared spellcasting with a clear party role.",
    values: { className: "Cleric", hitPointMaximum: 10, currentHitPoints: 10, armorClass: 16, proficiencyBonus: 2 },
    subclasses: [
      { name: "Life Domain", summary: "Restoration and care", details: "For healers, temple champions, mercy-driven heroes, and protective faith." },
      { name: "Light Domain", summary: "Radiance and revelation", details: "Good for purging darkness, exposing lies, and wielding bright divine power." },
      { name: "Trickery Domain", summary: "Masks and misdirection", details: "Fits holy rogues, divine spies, playful saints, and agents of change." },
      { name: "War Domain", summary: "Sacred combat", details: "A cleric shaped by battle, command, duty, or the theology of conflict." },
    ],
  },
  {
    name: "Druid",
    summary: "Primal magic shaper",
    details: "For characters tied to nature, transformation, terrain, healing, and living forces beyond civilization.",
    values: { className: "Druid", hitPointMaximum: 10, currentHitPoints: 10, armorClass: 14, proficiencyBonus: 2 },
    subclasses: [
      { name: "Circle of the Land", summary: "Terrain spellcraft", details: "Best for a druid whose magic reflects a chosen landscape and its old power." },
      { name: "Circle of the Moon", summary: "Combat transformation", details: "For shapeshifters who want beast forms to carry major table impact." },
      { name: "Circle of the Sea", summary: "Storm and tide", details: "Fits coast, current, pressure, tempest, and ocean-haunted characters." },
      { name: "Circle of the Stars", summary: "Cosmic guidance", details: "Good for prophecy, constellations, fate, and a mystical support identity." },
    ],
  },
  {
    name: "Fighter",
    summary: "Durable weapon expert",
    details: "A direct martial choice with strong defenses, reliable attacks, and room to express any fighting style.",
    values: { className: "Fighter", hitPointMaximum: 12, currentHitPoints: 12, armorClass: 16, proficiencyBonus: 2 },
    subclasses: [
      { name: "Battle Master", summary: "Tactical maneuvers", details: "For martial control, command, precision, and a strong battlefield toolkit." },
      { name: "Champion", summary: "Athletic weapon focus", details: "A clean, durable fighter for heroic physical excellence and reliability." },
      { name: "Eldritch Knight", summary: "Weapon magic", details: "Combines martial training with arcane defense, tricks, and spell-powered attacks." },
      { name: "Psi Warrior", summary: "Psionic combat", details: "For telekinetic force, mental discipline, and a supernatural martial edge." },
    ],
  },
  {
    name: "Monk",
    summary: "Mobile disciplined striker",
    details: "Best for speed, pressure, precision, and a character whose body and spirit are their main tools.",
    values: { className: "Monk", hitPointMaximum: 10, currentHitPoints: 10, armorClass: 15, proficiencyBonus: 2 },
    subclasses: [
      { name: "Warrior of Mercy", summary: "Harm and healing", details: "For masked healers, pressure-point mystics, and disciplined life-and-death themes." },
      { name: "Warrior of Shadow", summary: "Stealth and darkness", details: "A sleek fit for silent movement, ambush, espionage, and supernatural shadow." },
      { name: "Warrior of the Elements", summary: "Elemental force", details: "For martial artists who channel air, earth, fire, water, and raw motion." },
      { name: "Warrior of the Open Hand", summary: "Pure martial control", details: "Good for clean technique, battlefield positioning, and classic monk fantasy." },
    ],
  },
  {
    name: "Paladin",
    summary: "Oath-bound defender",
    details: "A front-line divine class built around conviction, protection, heavy hits, and a visible code.",
    values: { className: "Paladin", hitPointMaximum: 12, currentHitPoints: 12, armorClass: 16, proficiencyBonus: 2 },
    subclasses: [
      { name: "Oath of Devotion", summary: "Honor and protection", details: "For classic knightly virtue, duty, truth, and steadfast defense." },
      { name: "Oath of Glory", summary: "Heroic excellence", details: "Fits mythic ambition, athletic heroism, and inspiring impossible deeds." },
      { name: "Oath of the Ancients", summary: "Old light and nature", details: "A paladin tied to beauty, hope, green places, and ancient guardianship." },
      { name: "Oath of Vengeance", summary: "Relentless justice", details: "Best for pursuit, hard choices, nemeses, and a focused promise to punish evil." },
    ],
  },
  {
    name: "Ranger",
    summary: "Explorer and striker",
    details: "Good for tracking, skirmishing, wilderness pressure, favored prey, and practical survival magic.",
    values: { className: "Ranger", hitPointMaximum: 12, currentHitPoints: 12, armorClass: 15, proficiencyBonus: 2 },
    subclasses: [
      { name: "Beast Master", summary: "Animal companion", details: "For characters whose bond with a primal companion is central to play." },
      { name: "Fey Wanderer", summary: "Fey-touched scout", details: "Blends charm, weird roads, bright menace, and social confidence." },
      { name: "Gloom Stalker", summary: "Ambush predator", details: "Best for darkness, first strikes, underworld threats, and hunter-horror flavor." },
      { name: "Hunter", summary: "Practical monster slayer", details: "A straightforward ranger for reading threats and adapting to the quarry." },
    ],
  },
  {
    name: "Rogue",
    summary: "Skillful striker",
    details: "Best for careful positioning, expertise, scouting, and a character who solves problems with precision.",
    values: { className: "Rogue", hitPointMaximum: 10, currentHitPoints: 10, armorClass: 14, proficiencyBonus: 2 },
    subclasses: [
      { name: "Arcane Trickster", summary: "Magic mischief", details: "For stealth, illusion, clever spells, and problem solving with arcane leverage." },
      { name: "Assassin", summary: "Lethal infiltration", details: "Fits disguise, decisive violence, spycraft, and dangerous preparation." },
      { name: "Soulknife", summary: "Psionic operative", details: "A clean choice for mental blades, silent strikes, and supernatural espionage." },
      { name: "Thief", summary: "Fast hands", details: "Great for classic burglary, item tricks, climbing, scouting, and practical cunning." },
    ],
  },
  {
    name: "Sorcerer",
    summary: "Innate arcane power",
    details: "For characters whose magic is personal, volatile, inherited, awakened, or impossible to fully explain.",
    values: { className: "Sorcerer", hitPointMaximum: 8, currentHitPoints: 8, armorClass: 12, proficiencyBonus: 2 },
    subclasses: [
      { name: "Aberrant Sorcery", summary: "Strange mind magic", details: "For psychic pressure, alien influence, whispers, and warped perception." },
      { name: "Clockwork Sorcery", summary: "Order and mechanism", details: "Fits fate, balance, precision, inevitability, and reality running like gears." },
      { name: "Draconic Sorcery", summary: "Dragon-blooded power", details: "A bold option for elemental force, presence, scales, and ancient lineage." },
      { name: "Wild Magic Sorcery", summary: "Unstable arcana", details: "Best for chaotic surges, raw talent, risk, and magic that refuses containment." },
    ],
  },
  {
    name: "Warlock",
    summary: "Pact-bound spellcaster",
    details: "A compact magical class with a patron relationship, strong flavor hooks, and focused spell output.",
    values: { className: "Warlock", hitPointMaximum: 10, currentHitPoints: 10, armorClass: 13, proficiencyBonus: 2 },
    subclasses: [
      { name: "Archfey Patron", summary: "Fey bargain", details: "For glamour, fear, charm, old courts, and promises made in strange places." },
      { name: "Celestial Patron", summary: "Radiant compact", details: "A pact shaped by healing light, judgment, omens, and uneasy holiness." },
      { name: "Fiend Patron", summary: "Infernal power", details: "Good for temptation, survival, fire, debt, and power with a visible cost." },
      { name: "Great Old One Patron", summary: "Eldritch contact", details: "Fits secrets from beyond thought, fractured dreams, and unsettling knowledge." },
    ],
  },
  {
    name: "Wizard",
    summary: "Arcane problem solver",
    details: "A flexible spellcaster with broad utility, lower durability, and a strong relationship to preparation.",
    values: { className: "Wizard", hitPointMaximum: 8, currentHitPoints: 8, armorClass: 12, proficiencyBonus: 2 },
    subclasses: [
      { name: "Abjurer", summary: "Protective magic", details: "Best for wards, countermeasures, shields, and keeping the party standing." },
      { name: "Diviner", summary: "Foresight and signs", details: "For omens, probabilities, careful planning, and knowledge before danger arrives." },
      { name: "Evoker", summary: "Battlefield blasting", details: "A direct arcane damage specialist with clear combat presence." },
      { name: "Illusionist", summary: "Deception magic", details: "Good for misdirection, creative solutions, false images, and reality tricks." },
    ],
  },
];

export const SPECIES_GUIDES: ChoiceGuide[] = [
  { name: "Aasimar", summary: "Celestial-touched", details: "Use this for radiant ancestry, divine pressure, omens, guardianship, or a complicated sacred legacy." },
  { name: "Dragonborn", summary: "Draconic ancestry", details: "Good for elemental identity, clan pride, imposing presence, and visible supernatural heritage." },
  { name: "Dwarf", summary: "Resolute and grounded", details: "A good origin for endurance, craft, tradition, stone, metal, and hard-won loyalties." },
  { name: "Elf", summary: "Perceptive and long-lived", details: "Good for characters tied to memory, magic, precision, nature, or a long view of history." },
  { name: "Gnome", summary: "Clever and uncanny", details: "Fits sharp curiosity, small-scale craft, hidden magic, jokes with teeth, and bright invention." },
  { name: "Goliath", summary: "Giant-blooded endurance", details: "Best for towering presence, environmental grit, clan tests, and strength shaped by harsh places." },
  { name: "Halfling", summary: "Brave and warm", details: "A strong pick for grounded heroes, quiet courage, community bonds, and luck under pressure." },
  { name: "Human", summary: "Flexible and ambitious", details: "Use this for a broadly adaptable character whose defining edge comes from training, culture, or drive." },
  { name: "Orc", summary: "Powerful and relentless", details: "Good for characters built around grit, momentum, survival, and direct action." },
  { name: "Tiefling", summary: "Lower-planar legacy", details: "Fits infernal, abyssal, or chthonic marks, social tension, ambition, and inherited power." },
];

export const BACKGROUND_GUIDES: ChoiceGuide[] = [
  { name: "Acolyte", summary: "Faith, temples, doctrine", details: "A clean fit for divine ties, sacred duties, religious education, or tension with a church." },
  { name: "Artisan", summary: "Craft, trade, technique", details: "Use this for hands-on skill, guild pressure, commissions, tools, and pride in made things." },
  { name: "Charlatan", summary: "Masks, scams, reinvention", details: "Good for false names, old cons, social reading, and a past that keeps catching up." },
  { name: "Criminal", summary: "Underworld, leverage, risk", details: "Use this for contacts, debts, old crews, secrets, or a character who knows how systems break." },
  { name: "Entertainer", summary: "Stage, charm, reputation", details: "Best for performers, spectacle, public identity, applause, rivals, and dramatic entrances." },
  { name: "Farmer", summary: "Land, labor, family", details: "A grounded origin for rural stakes, endurance, practical wisdom, and protecting what matters." },
  { name: "Guard", summary: "Watch, duty, procedure", details: "Fits city watch, caravan security, gates, patrols, authority, and knowing when rules fail." },
  { name: "Guide", summary: "Trails, survival, routes", details: "Good for scouts, pathfinders, wild roads, maps, weather sense, and getting others home." },
  { name: "Hermit", summary: "Isolation, insight, omen", details: "Use this for revelation, self-exile, forbidden study, spiritual retreat, or strange discovery." },
  { name: "Merchant", summary: "Trade, value, networks", details: "A strong pick for negotiation, ledgers, market sense, contacts, and debts owed." },
  { name: "Noble", summary: "Rank, privilege, obligation", details: "Fits inherited pressure, court manners, family names, rivals, estates, and status as a tool." },
  { name: "Sage", summary: "Study, lore, discovery", details: "Best for research-driven characters, lost knowledge, mentors, archives, and dangerous questions." },
  { name: "Sailor", summary: "Ships, crews, horizons", details: "Good for sea roads, port contacts, storms, superstition, and life under a hard captain." },
  { name: "Scribe", summary: "Records, law, archives", details: "Use this for documents, bureaucracy, careful memory, contracts, and secrets hidden in text." },
  { name: "Soldier", summary: "War, command, discipline", details: "A strong fit for duty, scars, old units, tactical instincts, and battlefield reputation." },
  { name: "Wayfarer", summary: "Streets, travel, survival", details: "Fits hard roads, urban edges, found family, improvisation, and a life between safe places." },
];

export function getSubclassesForClass(className: string) {
  return CLASS_GUIDES.find((classGuide) => classGuide.name === className)?.subclasses ?? [];
}
