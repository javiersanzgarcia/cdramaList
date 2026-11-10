import type { Series } from "../../series/types";
import { isSeries, normalizeSeries } from "../../series/model/series";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FILE_NAME = "cdramalist.json";

export type DriveErrorCode =
  | "auth"
  | "permission"
  | "network"
  | "format"
  | "notfound";

export class DriveError extends Error {
  code?: DriveErrorCode;

  constructor(message: string, code?: DriveErrorCode) {
    super(message);
    this.name = "DriveError";
    this.code = code;
  }
}

export interface DriveSnapshot {
  fileId: string;
  series: Series[];
  exportedAt?: string;
}

interface DriveFile {
  id: string;
  name?: string;
  modifiedTime?: string;
}

async function driveError(response: Response): Promise<DriveError> {
  let message = `Google Drive respondió con el código ${response.status}.`;

  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    if (body.error?.message) message = body.error.message;
  } catch {
    // La respuesta no era JSON; usamos el mensaje genérico.
  }

  if (response.status === 401) {
    return new DriveError(
      "La sesión de Google ha caducado. Vuelve a conectar con Google Drive.",
      "auth",
    );
  }

  if (response.status === 403) {
    return new DriveError(
      "Google Drive no ha autorizado el acceso. Comprueba que la API de Drive está activada y que concediste el permiso drive.appdata.",
      "permission",
    );
  }

  if (response.status === 404) {
    return new DriveError(
      "No se encontró el archivo de sincronización en Google Drive.",
      "notfound",
    );
  }

  return new DriveError(message);
}

async function driveFetch(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new DriveError(
      "No se pudo conectar con Google Drive. Revisa tu conexión.",
      "network",
    );
  }

  if (!response.ok) throw await driveError(response);
  return response;
}

async function findDriveFile(token: string): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    fields: "files(id,name,modifiedTime)",
    pageSize: "100",
  });

  const response = await driveFetch(
    `${DRIVE_API}/files?${params.toString()}`,
    token,
  );
  const data = (await response.json()) as { files?: DriveFile[] };

  return data.files?.find((file) => file.name === FILE_NAME) ?? null;
}

export function buildSnapshot(series: Series[]) {
  return {
    app: "cdramalist",
    version: 2,
    exportedAt: new Date().toISOString(),
    series,
  };
}

export function parseSnapshot(
  value: unknown,
): { series: Series[]; exportedAt?: string } | null {
  const raw = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        Array.isArray((value as { series?: unknown }).series)
      ? (value as { series: unknown[] }).series
      : null;

  if (!raw) return null;

  return {
    series: raw.filter(isSeries).map(normalizeSeries),
    exportedAt:
      value &&
      typeof value === "object" &&
      typeof (value as { exportedAt?: unknown }).exportedAt === "string"
        ? (value as { exportedAt: string }).exportedAt
        : undefined,
  };
}

export async function pullFromDrive(
  token: string,
): Promise<DriveSnapshot | null> {
  const file = await findDriveFile(token);
  if (!file) return null;

  let response: Response;

  try {
    response = await driveFetch(
      `${DRIVE_API}/files/${file.id}?alt=media`,
      token,
    );
  } catch (error) {
    if (error instanceof DriveError && error.code === "notfound") return null;
    throw error;
  }

  let raw: unknown;

  try {
    raw = await response.json();
  } catch {
    throw new DriveError(
      "El archivo de Google Drive no contiene JSON válido.",
      "format",
    );
  }

  const parsed = parseSnapshot(raw);

  if (!parsed) {
    throw new DriveError(
      "El archivo de Google Drive no tiene el formato de CdramaList.",
      "format",
    );
  }

  return {
    fileId: file.id,
    series: parsed.series,
    exportedAt: parsed.exportedAt,
  };
}

export async function pushToDrive(
  token: string,
  series: Series[],
  fileId?: string | null,
  retried = false,
): Promise<string> {
  let id = fileId ?? null;

  if (!id) {
    const existing = await findDriveFile(token);
    id = existing?.id ?? null;
  }

  if (!id) {
    const createResponse = await driveFetch(
      `${DRIVE_API}/files?fields=id`,
      token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: FILE_NAME, parents: ["appDataFolder"] }),
      },
    );

    const created = (await createResponse.json()) as { id?: string };

    if (!created.id) {
      throw new DriveError(
        "Google Drive no devolvió el identificador del archivo.",
        "format",
      );
    }

    id = created.id;
  }

  try {
    await driveFetch(`${UPLOAD_API}/files/${id}?uploadType=media`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSnapshot(series)),
    });
  } catch (error) {
    // El archivo pudo borrarse entre la lectura y la escritura: lo recreamos.
    if (error instanceof DriveError && error.code === "notfound" && !retried) {
      return pushToDrive(token, series, null, true);
    }
    throw error;
  }

  return id;
}

function canonicalSeries(series: Series) {
  return {
    id: series.id,
    title: series.title,
    channelId: series.channelId ?? null,
    channelTitle: series.channelTitle,
    channelUrl: series.channelUrl ?? null,
    thumbnail: series.thumbnail ?? null,
    favorite: series.favorite,
    createdAt: series.createdAt,
    updatedAt: series.updatedAt,
    watched: [...series.watched].sort(),
    parts: series.parts
      .map((part) => ({
        videoId: part.videoId,
        title: part.title,
        partNumber: part.partNumber ?? null,
        totalParts: part.totalParts ?? null,
        isFinal: Boolean(part.isFinal),
        durationSeconds: part.durationSeconds ?? null,
        publishedAt: part.publishedAt ?? null,
        thumbnail: part.thumbnail ?? null,
        addedAt: part.addedAt,
      }))
      .sort((a, b) => a.videoId.localeCompare(b.videoId)),
  };
}

/**
 * Firma estable del contenido sincronizable. Excluye `lastOpenedAt` para que
 * abrir una serie no dispare una subida automática.
 */
export function seriesSignature(series: Series[]): string {
  return JSON.stringify(
    series
      .map(canonicalSeries)
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}
