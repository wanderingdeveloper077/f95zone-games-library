/**
 * Canonical enums and metadata lookup tables ported from _reference-repo/common/structs.py
 */

export const Category = {
  Games: 1,
  Animations: 2,
  Comics: 3,
  Misc: 4,
} as const;
export type CategoryId = (typeof Category)[keyof typeof Category];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  [Category.Games]: "Games",
  [Category.Animations]: "Animations",
  [Category.Comics]: "Comics",
  [Category.Misc]: "Misc",
};

export const Status = {
  Normal: 1,
  Completed: 2,
  OnHold: 3,
  Abandoned: 4,
  Unchecked: 5,
  Custom: 6,
  Unknown: 7,
} as const;
export type StatusId = (typeof Status)[keyof typeof Status];

export interface StatusMeta {
  id: StatusId;
  name: string;
  label: string;
  color: string;
}

export const STATUS_META: Record<StatusId, StatusMeta> = {
  [Status.Normal]: { id: Status.Normal, name: "Normal", label: "Ongoing", color: "#F2F2F2" },
  [Status.Completed]: { id: Status.Completed, name: "Completed", label: "Completed", color: "#00DD00" },
  [Status.OnHold]: { id: Status.OnHold, name: "OnHold", label: "On Hold", color: "#0080F2" },
  [Status.Abandoned]: { id: Status.Abandoned, name: "Abandoned", label: "Abandoned", color: "#DD3333" },
  [Status.Unchecked]: { id: Status.Unchecked, name: "Unchecked", label: "Unchecked", color: "#808080" },
  [Status.Custom]: { id: Status.Custom, name: "Custom", label: "Custom", color: "#F28000" },
  [Status.Unknown]: { id: Status.Unknown, name: "Unknown", label: "Unknown", color: "#808080" },
};

export const STATUS_LIST: readonly StatusMeta[] = Object.values(STATUS_META);

/** Ordered thread-prefix matching rules for Status */
export const STATUS_PREFIX_ORDER: ReadonlyArray<{ prefix: string; id: StatusId }> = [
  { prefix: "Completed", id: Status.Completed },
  { prefix: "Onhold", id: Status.OnHold },
  { prefix: "Abandoned", id: Status.Abandoned },
];

export const Type = {
  Misc: 1,
  ADRIFT: 2,
  CheatMod: 3,
  Flash: 4,
  HTML: 5,
  Java: 6,
  Mod: 8,
  Others: 9,
  QSP: 10,
  RAGS: 11,
  README: 12,
  RPGM: 13,
  RenPy: 14,
  Request: 15,
  Tads: 16,
  Tool: 17,
  Tutorial: 18,
  Unity: 19,
  UnrealEng: 20,
  WebGL: 21,
  WolfRPG: 22,
  Unchecked: 23,
  Comics: 24,
  GIF: 25,
  Manga: 26,
  Pinup: 27,
  Video: 29,
  CG: 30,
  Godot: 31,
  Unknown: 32,
} as const;
export type TypeId = (typeof Type)[keyof typeof Type];

export interface TypeMeta {
  id: TypeId;
  name: string;
  label: string;
  category: CategoryId;
  color: string;
}

export const TYPE_META: Record<TypeId, TypeMeta> = {
  [Type.ADRIFT]: { id: Type.ADRIFT, name: "ADRIFT", label: "ADRIFT", category: Category.Games, color: "#2196F3" },
  [Type.Flash]: { id: Type.Flash, name: "Flash", label: "Flash", category: Category.Games, color: "#616161" },
  [Type.Godot]: { id: Type.Godot, name: "Godot", label: "Godot", category: Category.Games, color: "#03A9F4" },
  [Type.HTML]: { id: Type.HTML, name: "HTML", label: "HTML", category: Category.Games, color: "#689F38" },
  [Type.Java]: { id: Type.Java, name: "Java", label: "Java", category: Category.Games, color: "#52A6B0" },
  [Type.Others]: { id: Type.Others, name: "Others", label: "Others", category: Category.Games, color: "#8BC34A" },
  [Type.QSP]: { id: Type.QSP, name: "QSP", label: "QSP", category: Category.Games, color: "#D32F2F" },
  [Type.RAGS]: { id: Type.RAGS, name: "RAGS", label: "RAGS", category: Category.Games, color: "#FF9800" },
  [Type.RenPy]: { id: Type.RenPy, name: "RenPy", label: "Ren'Py", category: Category.Games, color: "#B069E8" },
  [Type.RPGM]: { id: Type.RPGM, name: "RPGM", label: "RPGM", category: Category.Games, color: "#2196F3" },
  [Type.Tads]: { id: Type.Tads, name: "Tads", label: "Tads", category: Category.Games, color: "#2196F3" },
  [Type.Unity]: { id: Type.Unity, name: "Unity", label: "Unity", category: Category.Games, color: "#FE5901" },
  [Type.UnrealEng]: { id: Type.UnrealEng, name: "Unreal Eng", label: "Unreal Engine", category: Category.Games, color: "#0D47A1" },
  [Type.WebGL]: { id: Type.WebGL, name: "WebGL", label: "WebGL", category: Category.Games, color: "#FE5901" },
  [Type.WolfRPG]: { id: Type.WolfRPG, name: "Wolf RPG", label: "Wolf RPG", category: Category.Games, color: "#4CAF50" },
  [Type.GIF]: { id: Type.GIF, name: "GIF", label: "GIF", category: Category.Animations, color: "#03A9F4" },
  [Type.Video]: { id: Type.Video, name: "Video", label: "Video", category: Category.Animations, color: "#FF9800" },
  [Type.CG]: { id: Type.CG, name: "CG", label: "CG", category: Category.Comics, color: "#DFCB37" },
  [Type.Comics]: { id: Type.Comics, name: "Comics", label: "Comics", category: Category.Comics, color: "#FF9800" },
  [Type.Manga]: { id: Type.Manga, name: "Manga", label: "Manga", category: Category.Comics, color: "#0FB2FC" },
  [Type.Pinup]: { id: Type.Pinup, name: "Pinup", label: "Pinup", category: Category.Comics, color: "#2196F3" },
  [Type.CheatMod]: { id: Type.CheatMod, name: "Cheat Mod", label: "Cheat Mod", category: Category.Misc, color: "#D32F2F" },
  [Type.Mod]: { id: Type.Mod, name: "Mod", label: "Mod", category: Category.Misc, color: "#BA4545" },
  [Type.README]: { id: Type.README, name: "README", label: "READ ME", category: Category.Misc, color: "#DC143C" },
  [Type.Request]: { id: Type.Request, name: "Request", label: "Request", category: Category.Misc, color: "#D32F2F" },
  [Type.Tool]: { id: Type.Tool, name: "Tool", label: "Tool", category: Category.Misc, color: "#EC5555" },
  [Type.Tutorial]: { id: Type.Tutorial, name: "Tutorial", label: "Tutorial", category: Category.Misc, color: "#EC5555" },
  [Type.Misc]: { id: Type.Misc, name: "Misc", label: "Misc", category: Category.Misc, color: "#B8B00C" },
  [Type.Unchecked]: { id: Type.Unchecked, name: "Unchecked", label: "Unchecked", category: Category.Misc, color: "#393939" },
  [Type.Unknown]: { id: Type.Unknown, name: "Unknown", label: "Unknown", category: Category.Misc, color: "#393939" },
};

export const TYPE_LIST: readonly TypeMeta[] = Object.values(TYPE_META);

/**
 * Exact prefix evaluation order from _reference-repo/common/parser.py:275-334.
 * Note: "Cheat Mod" precedes "Mod", and "READ ME" maps to Type.README (id 12).
 */
export const TYPE_PREFIX_ORDER: ReadonlyArray<{ prefix: string; id: TypeId }> = [
  { prefix: "Cheat Mod", id: Type.CheatMod },
  { prefix: "Mod", id: Type.Mod },
  { prefix: "Tool", id: Type.Tool },
  { prefix: "READ ME", id: Type.README },
  { prefix: "Request", id: Type.Request },
  { prefix: "Tutorial", id: Type.Tutorial },
  { prefix: "Video", id: Type.Video },
  { prefix: "GIF", id: Type.GIF },
  { prefix: "CG", id: Type.CG },
  { prefix: "Manga", id: Type.Manga },
  { prefix: "Comics", id: Type.Comics },
  { prefix: "Pinup", id: Type.Pinup },
  { prefix: "ADRIFT", id: Type.ADRIFT },
  { prefix: "Flash", id: Type.Flash },
  { prefix: "Godot", id: Type.Godot },
  { prefix: "HTML", id: Type.HTML },
  { prefix: "Java", id: Type.Java },
  { prefix: "Others", id: Type.Others },
  { prefix: "QSP", id: Type.QSP },
  { prefix: "RAGS", id: Type.RAGS },
  { prefix: "RPGM", id: Type.RPGM },
  { prefix: "Ren'Py", id: Type.RenPy },
  { prefix: "Tads", id: Type.Tads },
  { prefix: "Unity", id: Type.Unity },
  { prefix: "Unreal Engine", id: Type.UnrealEng },
  { prefix: "WebGL", id: Type.WebGL },
  { prefix: "Wolf RPG", id: Type.WolfRPG },
];

export interface TagMeta {
  id: number;
  slug: string;
  text: string;
}

export const TAG_UNKNOWN_ID = 154;

export const TAGS: readonly TagMeta[] = [
  { id: 1, slug: "2d-game", text: "2d game" },
  { id: 2, slug: "2dcg", text: "2dcg" },
  { id: 3, slug: "3d-game", text: "3d game" },
  { id: 4, slug: "3dcg", text: "3dcg" },
  { id: 5, slug: "adventure", text: "adventure" },
  { id: 6, slug: "ahegao", text: "ahegao" },
  { id: 140, slug: "ai-cg", text: "ai cg" },
  { id: 7, slug: "anal-sex", text: "anal sex" },
  { id: 8, slug: "animated", text: "animated" },
  { id: 9, slug: "asset-addon", text: "asset-addon" },
  { id: 10, slug: "asset-ai-shoujo", text: "asset-ai-shoujo" },
  { id: 11, slug: "asset-animal", text: "asset-animal" },
  { id: 12, slug: "asset-animation", text: "asset-animation" },
  { id: 13, slug: "asset-audio", text: "asset-audio" },
  { id: 14, slug: "asset-bundle", text: "asset-bundle" },
  { id: 15, slug: "asset-character", text: "asset-character" },
  { id: 16, slug: "asset-clothing", text: "asset-clothing" },
  { id: 151, slug: "asset-daz-gen1", text: "asset-daz-gen1" },
  { id: 141, slug: "asset-daz-gen2", text: "asset-daz-gen2" },
  { id: 142, slug: "asset-daz-gen3", text: "asset-daz-gen3" },
  { id: 143, slug: "asset-daz-gen8", text: "asset-daz-gen8" },
  { id: 144, slug: "asset-daz-gen81", text: "asset-daz-gen81" },
  { id: 145, slug: "asset-daz-gen9", text: "asset-daz-gen9" },
  { id: 152, slug: "asset-daz-m4", text: "asset-daz-m4" },
  { id: 153, slug: "asset-daz-v4", text: "asset-daz-v4" },
  { id: 17, slug: "asset-environment", text: "asset-environment" },
  { id: 18, slug: "asset-expression", text: "asset-expression" },
  { id: 146, slug: "asset-female", text: "asset-female" },
  { id: 19, slug: "asset-hair", text: "asset-hair" },
  { id: 20, slug: "asset-hdri", text: "asset-hdri" },
  { id: 21, slug: "asset-honey-select", text: "asset-honey-select" },
  { id: 22, slug: "asset-honey-select2", text: "asset-honey-select2" },
  { id: 23, slug: "asset-koikatu", text: "asset-koikatu" },
  { id: 24, slug: "asset-light", text: "asset-light" },
  { id: 147, slug: "asset-male", text: "asset-male" },
  { id: 25, slug: "asset-morph", text: "asset-morph" },
  { id: 148, slug: "asset-nonbinary", text: "asset-nonbinary" },
  { id: 150, slug: "asset-playhome", text: "asset-playhome" },
  { id: 26, slug: "asset-plugin", text: "asset-plugin" },
  { id: 27, slug: "asset-pose", text: "asset-pose" },
  { id: 28, slug: "asset-prop", text: "asset-prop" },
  { id: 149, slug: "asset-scene", text: "asset-scene" },
  { id: 29, slug: "asset-script", text: "asset-script" },
  { id: 30, slug: "asset-shader", text: "asset-shader" },
  { id: 31, slug: "asset-texture", text: "asset-texture" },
  { id: 32, slug: "asset-utility", text: "asset-utility" },
  { id: 33, slug: "asset-vehicle", text: "asset-vehicle" },
  { id: 34, slug: "bdsm", text: "bdsm" },
  { id: 35, slug: "bestiality", text: "bestiality" },
  { id: 36, slug: "big-ass", text: "big ass" },
  { id: 37, slug: "big-tits", text: "big tits" },
  { id: 38, slug: "blackmail", text: "blackmail" },
  { id: 39, slug: "bukkake", text: "bukkake" },
  { id: 40, slug: "censored", text: "censored" },
  { id: 41, slug: "character-creation", text: "character creation" },
  { id: 42, slug: "cheating", text: "cheating" },
  { id: 43, slug: "combat", text: "combat" },
  { id: 44, slug: "corruption", text: "corruption" },
  { id: 45, slug: "cosplay", text: "cosplay" },
  { id: 46, slug: "creampie", text: "creampie" },
  { id: 47, slug: "dating-sim", text: "dating sim" },
  { id: 48, slug: "dilf", text: "dilf" },
  { id: 49, slug: "drugs", text: "drugs" },
  { id: 50, slug: "dystopian-setting", text: "dystopian setting" },
  { id: 51, slug: "exhibitionism", text: "exhibitionism" },
  { id: 52, slug: "fantasy", text: "fantasy" },
  { id: 54, slug: "female-protagonist", text: "female protagonist" },
  { id: 53, slug: "femaledomination", text: "female domination" },
  { id: 55, slug: "footjob", text: "footjob" },
  { id: 56, slug: "furry", text: "furry" },
  { id: 57, slug: "futa-trans", text: "futa/trans" },
  { id: 58, slug: "futa-trans-protagonist", text: "futa/trans protagonist" },
  { id: 59, slug: "gay", text: "gay" },
  { id: 60, slug: "graphic-violence", text: "graphic violence" },
  { id: 61, slug: "groping", text: "groping" },
  { id: 62, slug: "group-sex", text: "group sex" },
  { id: 63, slug: "handjob", text: "handjob" },
  { id: 64, slug: "harem", text: "harem" },
  { id: 65, slug: "horror", text: "horror" },
  { id: 66, slug: "humiliation", text: "humiliation" },
  { id: 67, slug: "humor", text: "humor" },
  { id: 68, slug: "incest", text: "incest" },
  { id: 69, slug: "internal-view", text: "internal view" },
  { id: 70, slug: "interracial", text: "interracial" },
  { id: 71, slug: "japanese-game", text: "japanese game" },
  { id: 72, slug: "kinetic-novel", text: "kinetic novel" },
  { id: 73, slug: "lactation", text: "lactation" },
  { id: 74, slug: "lesbian", text: "lesbian" },
  { id: 75, slug: "loli", text: "loli" },
  { id: 77, slug: "male-protagonist", text: "male protagonist" },
  { id: 76, slug: "maledomination", text: "male domination" },
  { id: 78, slug: "management", text: "management" },
  { id: 79, slug: "masturbation", text: "masturbation" },
  { id: 80, slug: "milf", text: "milf" },
  { id: 81, slug: "mind-control", text: "mind control" },
  { id: 82, slug: "mobile-game", text: "mobile game" },
  { id: 83, slug: "monster", text: "monster" },
  { id: 84, slug: "monster-girl", text: "monster girl" },
  { id: 85, slug: "multiple-endings", text: "multiple endings" },
  { id: 86, slug: "multiple-penetration", text: "multiple penetration" },
  { id: 87, slug: "multiple-protagonist", text: "multiple protagonist" },
  { id: 88, slug: "necrophilia", text: "necrophilia" },
  { id: 89, slug: "no-sexual-content", text: "no sexual content" },
  { id: 90, slug: "ntr", text: "netorare" },
  { id: 91, slug: "oral-sex", text: "oral sex" },
  { id: 92, slug: "paranormal", text: "paranormal" },
  { id: 93, slug: "parody", text: "parody" },
  { id: 94, slug: "platformer", text: "platformer" },
  { id: 95, slug: "point-click", text: "point & click" },
  { id: 96, slug: "possession", text: "possession" },
  { id: 97, slug: "pov", text: "pov" },
  { id: 98, slug: "pregnancy", text: "pregnancy" },
  { id: 99, slug: "prostitution", text: "prostitution" },
  { id: 100, slug: "puzzle", text: "puzzle" },
  { id: 101, slug: "rape", text: "rape" },
  { id: 102, slug: "real-porn", text: "real porn" },
  { id: 103, slug: "religion", text: "religion" },
  { id: 104, slug: "romance", text: "romance" },
  { id: 105, slug: "rpg", text: "rpg" },
  { id: 106, slug: "sandbox", text: "sandbox" },
  { id: 107, slug: "scat", text: "scat" },
  { id: 108, slug: "school-setting", text: "school setting" },
  { id: 109, slug: "sci-fi", text: "sci-fi" },
  { id: 110, slug: "sex-toys", text: "sex toys" },
  { id: 111, slug: "sexual-harassment", text: "sexual harassment" },
  { id: 112, slug: "shooter", text: "shooter" },
  { id: 113, slug: "shota", text: "shota" },
  { id: 114, slug: "side-scroller", text: "side-scroller" },
  { id: 115, slug: "simulator", text: "simulator" },
  { id: 116, slug: "sissification", text: "sissification" },
  { id: 117, slug: "slave", text: "slave" },
  { id: 118, slug: "sleep-sex", text: "sleep sex" },
  { id: 119, slug: "spanking", text: "spanking" },
  { id: 120, slug: "strategy", text: "strategy" },
  { id: 121, slug: "stripping", text: "stripping" },
  { id: 122, slug: "superpowers", text: "superpowers" },
  { id: 123, slug: "swinging", text: "swinging" },
  { id: 124, slug: "teasing", text: "teasing" },
  { id: 125, slug: "tentacles", text: "tentacles" },
  { id: 126, slug: "text-based", text: "text based" },
  { id: 127, slug: "titfuck", text: "titfuck" },
  { id: 128, slug: "trainer", text: "trainer" },
  { id: 129, slug: "transformation", text: "transformation" },
  { id: 130, slug: "trap", text: "trap" },
  { id: 131, slug: "turn-based-combat", text: "turn based combat" },
  { id: 132, slug: "twins", text: "twins" },
  { id: 133, slug: "urination", text: "urination" },
  { id: 134, slug: "vaginal-sex", text: "vaginal sex" },
  { id: 135, slug: "virgin", text: "virgin" },
  { id: 136, slug: "virtual-reality", text: "virtual reality" },
  { id: 137, slug: "voiced", text: "voiced" },
  { id: 138, slug: "vore", text: "vore" },
  { id: 139, slug: "voyeurism", text: "voyeurism" },
  { id: 154, slug: "unknown", text: "unknown" },
] as const;

export const TAG_BY_ID: ReadonlyMap<number, TagMeta> = new Map(TAGS.map((t) => [t.id, t]));
export const TAG_BY_SLUG: ReadonlyMap<string, TagMeta> = new Map(TAGS.map((t) => [t.slug, t]));
export const TAG_BY_TEXT: ReadonlyMap<string, TagMeta> = new Map(TAGS.map((t) => [t.text, t]));

export const TagHighlight = {
  Positive: 1,
  Negative: 2,
  Critical: 3,
} as const;
export type TagHighlightId = (typeof TagHighlight)[keyof typeof TagHighlight];

export const DEFAULT_SERVER_PORT = 57095;
