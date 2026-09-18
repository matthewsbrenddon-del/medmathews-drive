// ============================================================================
// Google Drive por link público — sem OAuth (spec v2, seção 1).
//
// Cada aula/material é identificado pelo ID do arquivo do Google Drive,
// extraído do link de compartilhamento. O arquivo precisa estar configurado
// como "Qualquer pessoa com o link pode visualizar" no Drive — não lemos
// nada além do ID e do link fornecidos na planilha, sem tokens ou
// credenciais.
// ============================================================================

const DRIVE_ID_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]{10,})/, // .../file/d/{id}/view
  /\/d\/([a-zA-Z0-9_-]{10,})/, // .../d/{id}
  /[?&]id=([a-zA-Z0-9_-]{10,})/, // ...?id={id}
  /\/folders\/([a-zA-Z0-9_-]{10,})/, // .../folders/{id}
];

/** Extrai o ID de um arquivo a partir de um link do Google Drive. */
export function extractDriveFileId(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) return null;

  for (const pattern of DRIVE_ID_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  // Se o valor já parece ser só o ID puro (sem barras/pontos), aceita direto.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;

  return null;
}

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

/** URL de preview embutido — funciona tanto para vídeos quanto para PDFs. */
export function drivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
