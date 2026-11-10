import type { Part } from "../types";

const PART_KEYWORD =
  /\b(?:parte|part|episodio|episode|temporada|season|volume|vol|temp|cap[ií]tulo|chapter|cap|ep|pt|p|e)\s*[#.:-]?\s*(\d{1,3})(?!\d)(?:\s*(?:de|\/)\s*(\d{1,3}))?/i;
const PART_KEYWORD_GLOBAL = new RegExp(PART_KEYWORD.source, "gi");
const PART_WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};
const PART_WORD_PATTERN = `\\b(?:part|pt)\\.?\\s+(${Object.keys(PART_WORD_NUMBERS).join("|")})\\b`;
const PART_WORD = new RegExp(PART_WORD_PATTERN, "i");
const PART_WORD_GLOBAL = new RegExp(PART_WORD_PATTERN, "gi");
const CHINESE_PART = /第([0-9零〇一二两三四五六七八九十百千]+)集/u;
const CHINESE_PART_GLOBAL = new RegExp(CHINESE_PART.source, "gu");
const KOREAN_PART = /(?:^|[^\p{L}\p{N}])(\d{1,3})화(?![\p{L}\p{N}])/u;
const KOREAN_PART_GLOBAL = /(?:^|[^\p{L}\p{N}])\d{1,3}화(?![\p{L}\p{N}])/gu;
const FRACTION_GLOBAL = /\b(\d{1,3})\s*\/\s*(\d{1,3})\b/g;
const OF_GLOBAL = /\b(\d{1,3})\s*(?:de|of)\s*(\d{1,3})\b/gi;
const PAREN_GLOBAL = /\(\s*(\d{1,3})\s*\)/g;
const HASH_GLOBAL = /#\s*(\d{1,3})\b/g;

const FINAL_WORD =
  /(?:^|[^\p{L}\p{N}])(?:final|fin|ending|the\s+end|last|[uú]lt[ií]ma\s+parte)(?:$|[^\p{L}\p{N}])|完结|结局/iu;
const FRACTION = /\b(\d{1,3})\s*\/\s*(\d{1,3})\b/;
const OF = /\b(\d{1,3})\s*(?:de|of)\s*(\d{1,3})\b/i;
const PAREN = /\(\s*(\d{1,3})\s*\)/;
const HASH = /#\s*(\d{1,3})\b/;

const STOPWORDS = new Set([
  "a",
  "al",
  "algo",
  "algun",
  "alguna",
  "algunas",
  "algunos",
  "ante",
  "antes",
  "como",
  "con",
  "contra",
  "cual",
  "cuando",
  "de",
  "del",
  "desde",
  "donde",
  "durante",
  "e",
  "el",
  "ella",
  "ellas",
  "ellos",
  "en",
  "entre",
  "era",
  "es",
  "esa",
  "ese",
  "eso",
  "esta",
  "este",
  "esto",
  "estos",
  "fue",
  "ha",
  "hasta",
  "hay",
  "la",
  "las",
  "le",
  "les",
  "lo",
  "los",
  "mas",
  "me",
  "mi",
  "mis",
  "mucho",
  "muy",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "pero",
  "por",
  "porque",
  "que",
  "se",
  "sin",
  "sobre",
  "su",
  "sus",
  "te",
  "tiene",
  "todo",
  "tu",
  "tus",
  "un",
  "una",
  "uno",
  "unos",
  "unas",
  "y",
  "ya",
  "the",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "without",
  "that",
  "this",
  "is",
  "are",
  "was",
  "were",
  "as",
  "at",
  "by",
  "from",
  "it",
  "its",
  "his",
  "her",
  "their",
  "our",
  "your",
  "my",
  "be",
  "been",
  "has",
  "have",
  "had",
  "will",
  "would",
  "can",
  "could",
  "not",
  "full",
  "part",
  "parte",
  "video",
  "youtube",
  "canal",
  "hd",
  "4k",
  "espanol",
  "latino",
  "castellano",
  "subtitulado",
  "sub",
  "audio",
  "nuevo",
  "nueva",
  "version",
  "completo",
  "completa",
  "final",
]);

export interface PartInfo {
  partNumber?: number;
  totalParts?: number;
  isFinal: boolean;
}

function parseChineseNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value);

  const digits: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let current = 0;

  for (const character of value) {
    if (character in digits) {
      current = digits[character];
    } else if (character in units) {
      total += (current || 1) * units[character];
      current = 0;
    }
  }

  return total + current;
}

export function detectPart(title: string): PartInfo {
  const isFinal = FINAL_WORD.test(title);
  const keyword = PART_KEYWORD.exec(title);
  if (keyword) {
    return {
      partNumber: Number(keyword[1]),
      totalParts: keyword[2] ? Number(keyword[2]) : undefined,
      isFinal,
    };
  }

  const wordNumber = PART_WORD.exec(title);
  if (wordNumber) {
    return {
      partNumber: PART_WORD_NUMBERS[wordNumber[1].toLowerCase()],
      isFinal,
    };
  }

  const chinesePart = CHINESE_PART.exec(title);
  if (chinesePart) {
    return { partNumber: parseChineseNumber(chinesePart[1]), isFinal };
  }

  const koreanPart = KOREAN_PART.exec(title);
  if (koreanPart) {
    return { partNumber: Number(koreanPart[1]), isFinal };
  }

  const fraction = FRACTION.exec(title);
  if (fraction) {
    return {
      partNumber: Number(fraction[1]),
      totalParts: Number(fraction[2]),
      isFinal,
    };
  }

  const of = OF.exec(title);
  if (of) {
    return {
      partNumber: Number(of[1]),
      totalParts: Number(of[2]),
      isFinal,
    };
  }

  const paren = PAREN.exec(title);
  if (paren) {
    return { partNumber: Number(paren[1]), isFinal };
  }

  const hash = HASH.exec(title);
  if (hash) {
    return { partNumber: Number(hash[1]), isFinal };
  }

  return { isFinal };
}

const DESCRIPTION_RELATION =
  "(?:d(?:e(?:l)?|[ao]s?)\\s+(?:(?:el|la|los|las|o|a)\\s+)?)";

const DESCRIPTION_TITLE_LABEL = new RegExp(
  `(?:t[ií]tulo\\s+(?:original|${DESCRIPTION_RELATION}(?:drama|serie|s[eé]rie|novela|v[ií]deo))|t[ií]tulos?|original\\s+title|title|nome(?:\\s+${DESCRIPTION_RELATION}(?:drama|s[eé]rie|novela))?|nombre(?:\\s+${DESCRIPTION_RELATION}(?:drama|serie|novela))?|drama|serie|series|novela|剧名|标题|片名|名称)`,
  "iu",
);

const DESCRIPTION_TITLE_HEADING = new RegExp(
  `^(?:${DESCRIPTION_TITLE_LABEL.source})$`,
  "iu",
);

const DESCRIPTION_TITLE_INLINE = new RegExp(
  `^[^\\p{L}\\p{N}]*${DESCRIPTION_TITLE_LABEL.source}\\s*(?:[:：]|】|\\]|\\))\\s*(.+)$`,
  "iu",
);

const DESCRIPTION_NOISE =
  /^(?:introdu[cç][aã]o|introducci[oó]n|sinopsis|sinopse|descripci[oó]n|descri[cç][aã]o|resumen|resumo|elenco|reparto|g[eé]nero|genero|tags?|hashtags?|cap[ií]tulos?|epis[oó]dios?|assista|mira|watch)\b/iu;

const DESCRIPTION_GENERIC = new Set([
  "titulo",
  "titulos",
  "titulo original",
  "original title",
  "title",
  "nome",
  "nome do drama",
  "nombre",
  "nombre del drama",
  "nombre de la serie",
  "drama",
  "serie",
  "series",
  "novela",
  "introduccion",
  "introducao",
  "sinopsis",
  "sinopse",
  "descripcion",
  "descricao",
  "resumen",
  "resumo",
]);

function cleanDescriptionLine(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, " ")
    .replace(/[【】[\]「」『』]/g, " ")
    .replace(/^\s*(?:[-–—•·*]+|\d+[.)])\s*/u, "")
    .replace(/^[\s:：,;|]+|[\s:：,;|]+$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDescriptionTitle(value: string): string | undefined {
  const cleaned = cleanDescriptionLine(value);
  if (!cleaned) return undefined;

  const normalized = normalizeText(cleaned)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length < 2) return undefined;
  if (DESCRIPTION_GENERIC.has(normalized)) return undefined;
  if (DESCRIPTION_NOISE.test(normalized)) return undefined;
  if (/^\d+$/.test(normalized)) return undefined;

  return cleaned.slice(0, 120).trim();
}

function isDescriptionTitleHeading(value: string): boolean {
  return DESCRIPTION_TITLE_HEADING.test(cleanDescriptionLine(value));
}

function isSectionHeading(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^[【[][^】\]]+[】\]]$/u.test(trimmed)) return true;
  return DESCRIPTION_NOISE.test(cleanDescriptionLine(trimmed));
}

function nextDescriptionTitleLine(
  lines: string[],
  start: number,
): string | undefined {
  for (let index = start + 1; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw) continue;
    if (isDescriptionTitleHeading(raw)) continue;
    if (isSectionHeading(raw)) return undefined;
    return raw;
  }

  return undefined;
}

/**
 * Extrae el título real del drama de la descripción del vídeo. Muchos canales
 * usan el título del vídeo como resumen y escriben el nombre de la historia en
 * la descripción, por ejemplo:
 *
 *   【Títulos】
 *   Apocalipsis de la Lluvia Negra
 *
 * También admite formatos como «Título: …» o «Nombre del drama: …».
 */
export function extractDescriptionTitle(
  description?: string,
): string | undefined {
  if (!description) return undefined;

  const lines = description.replace(/\r\n?/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw) continue;

    const inline = DESCRIPTION_TITLE_INLINE.exec(raw);
    if (inline) {
      const title = normalizeDescriptionTitle(inline[1]);
      if (title) return title;
    }

    if (isDescriptionTitleHeading(raw)) {
      const next = nextDescriptionTitleLine(lines, index);
      const title = next ? normalizeDescriptionTitle(next) : undefined;
      if (title) return title;
    }
  }

  return undefined;
}

export function stripPartMarkers(title: string): string {
  const cleaned = title
    .replace(
      /\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\uFE0F|\u200D|\u20E3/gu,
      " ",
    )
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(PART_KEYWORD_GLOBAL, " ")
    .replace(PART_WORD_GLOBAL, " ")
    .replace(CHINESE_PART_GLOBAL, " ")
    .replace(KOREAN_PART_GLOBAL, " ")
    .replace(FRACTION_GLOBAL, " ")
    .replace(OF_GLOBAL, " ")
    .replace(PAREN_GLOBAL, " ")
    .replace(HASH_GLOBAL, " ")
    .replace(/#[\p{L}\p{M}\p{N}_]+/gu, " ")
    .replace(/[|•·]+/gu, " ")
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, " ")
    .replace(/[-–—]{2,}/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—]+|[\s\-–—]+$/gu, "")
    .trim();

  return cleaned || title.trim();
}

export function buildSearchQuery(title: string): string {
  const base = stripPartMarkers(title);
  const cleaned = base
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[|•·].*$/u, " ")
    .replace(/[[\]{}()«»"“”'’]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter(Boolean);
  const meaningful = words.filter(
    (word) => !STOPWORDS.has(normalizeText(word)),
  );

  return (meaningful.length > 0 ? meaningful : words)
    .slice(0, 10)
    .join(" ")
    .slice(0, 100);
}

/**
 * Consulta para la búsqueda global. Si al quitar las palabras vacías solo
 * queda un término (por ejemplo, «Mi drama» → «drama»), conserva el título
 * completo para no perder precisión.
 */
export function buildGlobalSearchQuery(title: string): string {
  const meaningful = buildSearchQuery(title);
  if (meaningful.split(/\s+/).filter(Boolean).length >= 2) return meaningful;

  const cleaned = stripPartMarkers(title)
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[|•·].*$/u, " ")
    .replace(/[[\]{}()«»"“”'’]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || meaningful).slice(0, 100);
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isStopword(value: string): boolean {
  return STOPWORDS.has(normalizeText(value));
}

function tokenize(value: string): string[] {
  return normalizeText(stripPartMarkers(value))
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(
      (token) =>
        token.length > 0 && !STOPWORDS.has(token) && !/^\d{4}$/.test(token),
    );
}

export function extractKeywords(value: string): string[] {
  return [...new Set(tokenize(value).map(normalizeKeyword))];
}

export function keywordConfidenceBonus(
  titles: string[],
  confidence?: Record<string, number>,
): number {
  if (!confidence) return 0;

  const keywords = new Set(titles.flatMap(extractKeywords));
  let total = 0;

  for (const keyword of keywords) {
    const score = Object.hasOwn(confidence, keyword) ? confidence[keyword] : 0;
    total += Math.min(3, Math.max(0, score));
  }

  return Math.min(12, total * 2);
}

export function tokenCount(value: string): number {
  return new Set(tokenize(value).map(normalizeKeyword)).size;
}

export type TokenAliases = ReadonlyMap<string, string>;

/**
 * Sustituye cada palabra por su forma canónica. Así «catástrofe» y
 * «apocalipsis» cuentan como la misma palabra cuando la RAE las relaciona.
 */
function applyTokenAliases(
  tokens: Set<string>,
  aliases?: TokenAliases,
): Set<string> {
  const result = new Set<string>();
  for (const token of tokens) {
    result.add(normalizeKeyword(aliases?.get(token) ?? token));
  }
  return result;
}

function normalizeKeyword(value: string): string {
  let keyword = value;

  if (keyword.length > 6 && keyword.endsWith("s")) {
    keyword = keyword.slice(0, -1);
  }

  if (keyword.length > 7 && /(?:ad[oa]|id[oa]|ando|iendo)$/.test(keyword)) {
    return keyword.replace(/(?:ad[oa]|id[oa]|ando|iendo)$/, "");
  }

  if (keyword.length > 6 && /[ao]$/.test(keyword)) {
    keyword = keyword.slice(0, -1);
  }

  return keyword;
}

export function sharedTokenCount(
  a: string,
  b: string,
  aliases?: TokenAliases,
): number {
  const first = applyTokenAliases(new Set(tokenize(a)), aliases);
  const second = applyTokenAliases(new Set(tokenize(b)), aliases);
  let shared = 0;

  for (const token of first) {
    if (second.has(token)) shared += 1;
  }

  return shared;
}

/**
 * Clave del título sin marcas de parte ni puntuación. Sirve para decidir si
 * dos vídeos son exactamente la misma historia (por ejemplo, «Mi serie» y
 * «Mi serie - Parte 2»).
 */
export function normalizedBaseTitle(value: string): string {
  return normalizeText(stripPartMarkers(value))
    .replace(/\b(?:final|fin|ending|last)\b/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleSimilarity(
  a: string,
  b: string,
  aliases?: TokenAliases,
): number {
  const first = applyTokenAliases(new Set(tokenize(a)), aliases);
  const second = applyTokenAliases(new Set(tokenize(b)), aliases);

  if (first.size === 0 || second.size === 0) return 0;

  let shared = 0;
  for (const token of first) {
    if (second.has(token)) shared += 1;
  }

  return shared / Math.min(first.size, second.size);
}

/**
 * Similitud de Jaccard entre las palabras significativas de dos títulos.
 * A diferencia de `titleSimilarity`, penaliza las palabras de más, así que
 * sirve para distinguir historias distintas del mismo canal.
 */
export function titleJaccard(
  a: string,
  b: string,
  aliases?: TokenAliases,
): number {
  const first = applyTokenAliases(new Set(tokenize(a)), aliases);
  const second = applyTokenAliases(new Set(tokenize(b)), aliases);

  if (first.size === 0 || second.size === 0) return 0;

  let shared = 0;
  for (const token of first) {
    if (second.has(token)) shared += 1;
  }

  return shared / (first.size + second.size - shared);
}

export function sortParts(parts: Part[]): Part[] {
  return [...parts].sort((a, b) => {
    const first = a.partNumber;
    const second = b.partNumber;

    if (first != null && second != null && first !== second)
      return first - second;
    if (first != null && second == null) return -1;
    if (first == null && second != null) return 1;

    if (a.isFinal && !b.isFinal) return 1;
    if (!a.isFinal && b.isFinal) return -1;

    const firstDate = a.publishedAt ?? "";
    const secondDate = b.publishedAt ?? "";
    if (firstDate !== secondDate) return firstDate.localeCompare(secondDate);

    return a.addedAt - b.addedAt;
  });
}

export function partLabel(part: Part, index: number): string {
  if (part.isFinal) return "Final";
  if (part.partNumber != null) return `Parte ${part.partNumber}`;
  return `Parte ${index + 1}`;
}
