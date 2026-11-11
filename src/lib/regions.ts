/**
 * Russell Can Write (russellcanwrite.online): the campaigns on the world map.
 * Each region is a real time and place; its territories are the skills, its siege is a writing task.
 */

export type RegionId = "boot" | "rome" | "mongols" | "sail" | "fire" | "rivers" | "ww" | "cold";

export type Region = {
  id: RegionId;
  name: string;
  era: string;
  /** One line under the name on the map card. */
  blurb: string;
  /** Map position: longitude and latitude of the marker. */
  lon: number;
  lat: number;
  /** What the siege at the end of the region is called. */
  siegeName: string;
  /** Picked accent for the region card. */
  colour: string;
};

export const REGIONS: Region[] = [
  {
    id: "boot",
    name: "Boot Camp",
    era: "Your Greenpeace essay",
    blurb: "Train on sentences from your own essay. Clear this first.",
    lon: 100.5,
    lat: 13.7,
    siegeName: "Rematch: the Greenpeace essay",
    colour: "#7fb069",
  },
  {
    id: "rome",
    name: "Rome at War",
    era: "264 BC to AD 122",
    blurb: "Hannibal, Cannae, Alesia and the legions.",
    lon: 15,
    lat: 38,
    siegeName: "Siege of Alesia",
    colour: "#c44536",
  },
  {
    id: "mongols",
    name: "The Mongol Conquests",
    era: "1206 to 1281",
    blurb: "Genghis Khan, horse archers and the Silk Road.",
    lon: 103,
    lat: 46.8,
    siegeName: "Siege of Baghdad",
    colour: "#d4a373",
  },
  {
    id: "sail",
    name: "The Age of Sail",
    era: "1492 to 1805",
    blurb: "Explorers, the Armada and Trafalgar.",
    lon: -20,
    lat: 30,
    siegeName: "Battle of Trafalgar",
    colour: "#3a86ff",
  },
  {
    id: "fire",
    name: "The Ring of Fire",
    era: "Plates, volcanoes, tsunamis",
    blurb: "Vesuvius, Krakatoa and the restless Pacific.",
    lon: 140,
    lat: 36,
    siegeName: "Eruption of Krakatoa",
    colour: "#ff6b35",
  },
  {
    id: "rivers",
    name: "Great Rivers",
    era: "Nile, Mekong, Amazon",
    blurb: "Floods, deltas, dams and river wars.",
    lon: 36,
    lat: 15,
    siegeName: "The Aswan Dam debate",
    colour: "#2a9d8f",
  },
  {
    id: "ww",
    name: "The World Wars",
    era: "1914 to 1945",
    blurb: "Trenches, tanks, propaganda and D-Day.",
    lon: -12,
    lat: 57,
    siegeName: "D-Day: Operation Overlord",
    colour: "#8d99ae",
  },
  {
    id: "cold",
    name: "The Cold War",
    era: "1947 to 1991",
    blurb: "Spies, missiles, the Wall and the Moon.",
    lon: -80,
    lat: 23,
    siegeName: "The Cuban Missile Crisis",
    colour: "#9b5de5",
  },
];

export function regionById(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id);
}

/** The skills every region trains, in the order its territories unlock. */
export type SkillId = "splice" | "fixes" | "comma" | "twins" | "claim" | "peal" | "terms";

export type Skill = {
  id: SkillId;
  game: string;
  skill: string;
  how: string;
  track: "sentence" | "paragraph";
};

export const SKILLS: Skill[] = [
  {
    id: "splice",
    game: "Splice Slicer",
    skill: "Find where a sentence should end",
    how: "Tap every gap where one sentence ends and the next begins. Then press Fire.",
    track: "sentence",
  },
  {
    id: "fixes",
    game: "Four Fixes",
    skill: "Repair a run-on four ways",
    how: "Pick the version that is punctuated correctly. Watch out for 'however' and 'thus'.",
    track: "sentence",
  },
  {
    id: "comma",
    game: "Comma Drop",
    skill: "Commas in complex sentences",
    how: "Tap every gap that needs a comma, or press No comma if it needs none.",
    track: "sentence",
  },
  {
    id: "twins",
    game: "Word Twins",
    skill: "Words that sound alike",
    how: "Pick the word that fits. Their or there? Affect or effect?",
    track: "sentence",
  },
  {
    id: "claim",
    game: "Claim or Label",
    skill: "Topic sentences that make a claim",
    how: "Pick the topic sentence that argues something, not the one that only describes.",
    track: "paragraph",
  },
  {
    id: "peal",
    game: "PEAL Builder",
    skill: "Point, Evidence, Analysis, Link",
    how: "Tap the sentences in PEAL order: Point first, Link last.",
    track: "paragraph",
  },
  {
    id: "terms",
    game: "Term Check",
    skill: "Use the right term",
    how: "Pick the term that truly fits the example.",
    track: "paragraph",
  },
];

export function skillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id);
}

/** Military ranks for levels, lowest first. */
export const RANKS = [
  "Recruit",
  "Private",
  "Lance Corporal",
  "Corporal",
  "Sergeant",
  "Staff Sergeant",
  "Second Lieutenant",
  "Lieutenant",
  "Captain",
  "Major",
  "Lieutenant Colonel",
  "Colonel",
  "Brigadier",
  "Major General",
  "General",
  "Field Marshal",
];
