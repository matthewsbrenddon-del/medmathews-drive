// ============================================================================
// Integração real com Google Drive (server-side apenas).
//
// >>> PONTO DE CONFIGURAÇÃO <<<
// Para ativar dados reais, defina em .env.local:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, DATABASE_URL
// (ver .env.example). Sem essas variáveis, `isDriveConfigured()` retorna
// false e toda a aplicação usa o modo demonstração (src/lib/mockData.ts).
//
// Este módulo NUNCA deve ser importado por um componente client ("use
// client") — ele usa googleapis e teria o token de acesso exposto ao
// navegador. Use-o apenas a partir de Route Handlers (src/app/api/**).
// ============================================================================

import { google } from "googleapis";
import type { DriveFileMeta } from "./types";

export function isDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function driveClientFor(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

/** Lista as subpastas de primeiro nível de uma pasta — usado pelo FolderPicker. */
export async function listSubfolders(accessToken: string, parentId = "root") {
  const drive = driveClientFor(accessToken);
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 100,
  });
  return res.data.files ?? [];
}

const VIDEO_MIME_PREFIX = "video/";
const RECOGNIZED_DOC_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/epub+zip",
]);

function extensionFromName(name: string): string {
  const match = name.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Percorre recursivamente uma pasta do Drive e retorna todos os arquivos
 * relevantes (vídeos e documentos), já com o caminho de pastas resolvido.
 *
 * Usa paginação incremental (pageSize) e evita baixar o conteúdo dos
 * arquivos — apenas metadados — conforme exigido pela seção 28 (performance)
 * e seção 17 (não baixar tudo para o servidor sem necessidade).
 */
export async function fetchRealDriveTree(accessToken: string, rootFolderId: string): Promise<DriveFileMeta[]> {
  const drive = driveClientFor(accessToken);
  const results: DriveFileMeta[] = [];

  async function walk(folderId: string, path: string[]): Promise<void> {
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields:
          "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink, videoMediaMetadata)",
        pageSize: 200,
        pageToken,
      });

      for (const file of res.data.files ?? []) {
        if (!file.id || !file.name) continue;

        if (file.mimeType === "application/vnd.google-apps.folder") {
          await walk(file.id, [...path, file.name]);
          continue;
        }

        const isVideo = (file.mimeType ?? "").startsWith(VIDEO_MIME_PREFIX);
        const isDoc = RECOGNIZED_DOC_MIME_TYPES.has(file.mimeType ?? "");
        if (!isVideo && !isDoc) continue;

        results.push({
          fileId: file.id,
          folderId,
          folderPath: path,
          name: file.name,
          mimeType: file.mimeType ?? "application/octet-stream",
          extension: extensionFromName(file.name),
          sizeBytes: Number(file.size ?? 0),
          modifiedAt: file.modifiedTime ?? new Date().toISOString(),
          webViewUrl: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
          embedUrl: `https://drive.google.com/file/d/${file.id}/preview`,
          thumbnailUrl: file.thumbnailLink ?? undefined,
          durationSeconds: file.videoMediaMetadata?.durationMillis
            ? Math.round(Number(file.videoMediaMetadata.durationMillis) / 1000)
            : undefined,
        });
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  await walk(rootFolderId, []);
  return results;
}
