import type { SemanticFingerprint } from "../types";

export interface FingerprintInput {
  id: string;
  text: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

interface GeminiFetchResult {
  response: Response;
  body: GeminiResponse;
}

const GEMINI_TIMEOUT_MS = 30_000;

function retryDelay(response: Response): number {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter >= 0
    ? Math.min(retryAfter * 1000, 5000)
    : 1000;
}

async function fetchGeminiResponse(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<GeminiFetchResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => ({}))) as GeminiResponse;
    return { response, body };
  } catch (cause) {
    if (timedOut) {
      throw new Error(
        "Gemini agotó el tiempo máximo de respuesta de 30 segundos.",
      );
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

const FINGERPRINT_CATEGORIES: Array<keyof SemanticFingerprint> = [
  "genres",
  "tropes",
  "roles",
  "settings",
  "plotElements",
];

const fingerprintProperties = Object.fromEntries(
  FINGERPRINT_CATEGORIES.map((key) => [
    key,
    { type: "ARRAY", items: { type: "STRING" } },
  ]),
);

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) =>
          tag
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 40),
        )
        .filter((tag) => tag.length >= 2),
    ),
  ].slice(0, 12);
}

export function normalizeSemanticFingerprint(
  value: unknown,
): SemanticFingerprint | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const fingerprint = Object.fromEntries(
    FINGERPRINT_CATEGORIES.map((category) => [
      category,
      normalizeTags(record[category]),
    ]),
  ) as unknown as SemanticFingerprint;

  const valid = FINGERPRINT_CATEGORIES.some((category) =>
    Array.isArray(record[category]),
  );

  return valid ? fingerprint : undefined;
}

export async function generateSemanticFingerprints(
  apiKey: string,
  entries: FingerprintInput[],
  model: string,
): Promise<Map<string, SemanticFingerprint>> {
  if (!apiKey || entries.length === 0) return new Map();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const options: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: [
                "Create a semantic fingerprint for each short drama-series description.",
                "Return concise, reusable English snake_case tags grouped into genres, tropes, roles, settings, and plotElements. These are open categories: add relevant concepts not shown in the examples instead of omitting them.",
                "Recognize Chinese-drama concepts across languages. Examples include: roles engineer, scientist, inventor, doctor, ceo, billionaire, secretary, poor_heroine, orphan, heiress, farmer, soldier; tropes transmigration, rebirth, reincarnation, time_travel, modern_person_in_past, body_swap, revenge, contract_marriage, arranged_marriage, hidden_identity, system, raising_children; settings ancient_china, historical_china, republican_era, 1980s_china, modern_city, rural_village, workplace; plotElements twins, secret_child, family_feud, inheritance, cultivation; genres romance, fantasy, historical, comedy, mystery, crime.",
                "Only include concepts stated or strongly implied by the text. Do not invent plot details. Return at most 12 tags per category.",
                "Return one result for every input id, unchanged, and no extra text.",
                JSON.stringify(
                  entries.map((entry) => ({
                    id: entry.id,
                    text: entry.text.slice(0, 1200),
                  })),
                ),
              ].join("\n"),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  fingerprint: {
                    type: "OBJECT",
                    properties: fingerprintProperties,
                    required: FINGERPRINT_CATEGORIES,
                  },
                },
                required: ["id", "fingerprint"],
              },
            },
          },
          required: ["items"],
        },
      },
    }),
  };

  const deadline = Date.now() + GEMINI_TIMEOUT_MS;
  const request = () =>
    fetchGeminiResponse(url, options, Math.max(1, deadline - Date.now()));

  let result = await request();
  if (result.response.status === 429 || result.response.status === 503) {
    const waitMs = Math.min(
      retryDelay(result.response),
      Math.max(0, deadline - Date.now()),
    );
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    if (Date.now() >= deadline) {
      throw new Error(
        "Gemini agotó el tiempo máximo de respuesta de 30 segundos.",
      );
    }
    result = await request();
  }

  const { response, body } = result;
  if (!response.ok) {
    throw new Error(
      body.error?.message ?? `Gemini respondió con código ${response.status}.`,
    );
  }

  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini no devolvió fingerprints semánticos.");

  const parsed = JSON.parse(text) as { items?: unknown };
  if (!Array.isArray(parsed.items)) {
    throw new Error("Gemini devolvió un formato de fingerprint no válido.");
  }

  const results = new Map<string, SemanticFingerprint>();
  for (const item of parsed.items) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string") continue;

    const fingerprint = normalizeSemanticFingerprint(record.fingerprint);
    if (fingerprint) results.set(record.id, fingerprint);
  }

  return results;
}

export function semanticSimilarity(
  first?: SemanticFingerprint,
  second?: SemanticFingerprint,
): number {
  if (!first || !second) return 0;

  let shared = 0;
  let union = 0;

  for (const category of FINGERPRINT_CATEGORIES) {
    const firstTags = new Set(first[category]);
    const secondTags = new Set(second[category]);

    for (const tag of firstTags) {
      if (secondTags.has(tag)) shared += 1;
      union += 1;
    }
    for (const tag of secondTags) {
      if (!firstTags.has(tag)) union += 1;
    }
  }

  return shared >= 2 && union > 0 ? shared / union : 0;
}
