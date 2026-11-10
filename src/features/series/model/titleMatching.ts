import { normalizeText, stripPartMarkers } from "./parts";
import { STOPWORDS } from "./stopwords";

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
 * Consulta global que conserva el título completo si al quitar palabras vacías
 * solo queda un término.
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

/** Similitud de Jaccard, penaliza palabras adicionales para distinguir historias. */
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
