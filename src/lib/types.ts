// ============================================================================
// Tipos centrais do MedStudy Hub
//
// Separação deliberada (ver spec seção 16):
//  - "Drive*" -> espelha o que vem do Google Drive (imutável do ponto de vista
//    do usuário; atualizado apenas por uma sincronização).
//  - "UserFileState" -> estado do usuário sobre um arquivo (assistido,
//    favorito, progresso...). Persistido separadamente, nunca perdido em uma
//    nova sincronização.
// ============================================================================

export type ContentKind = "videoaula" | "apostila" | "outro";

export type WatchStatus = "nao_iniciada" | "em_andamento" | "assistida";
export type ReadStatus = "nao_acessado" | "acessado" | "estudado";

/** Formatos reconhecidos como videoaula. */
export const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "avi", "mkv"] as const;
/** Formatos reconhecidos como apostila/material principal de leitura. */
export const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "epub"] as const;

export interface DriveFileMeta {
  /** Google Drive file ID — identificador primário, nunca o nome do arquivo. */
  fileId: string;
  /** ID da pasta imediata no Drive. */
  folderId: string;
  /** Caminho completo de pastas, ex: "MEDICINA/Anatomia/Videoaulas". */
  folderPath: string[];
  name: string;
  mimeType: string;
  /** Extensão normalizada em minúsculas, sem ponto. */
  extension: string;
  sizeBytes: number;
  modifiedAt: string; // ISO date
  /** URL para abrir o item diretamente no Google Drive. */
  webViewUrl: string;
  /** URL de preview embutido (iframe), quando aplicável. */
  embedUrl?: string;
  thumbnailUrl?: string;
  /** Duração em segundos, quando disponível (apenas vídeos). */
  durationSeconds?: number;
}

export interface StudyContent extends DriveFileMeta {
  kind: ContentKind;
  /** Disciplina inferida ou confirmada pelo usuário. */
  subjectSlug: string;
  /** Número da aula, quando identificado no nome do arquivo. */
  lessonNumber?: number;
  /** Tema/assunto inferido do nome do arquivo. */
  topic: string;
  /** Título de exibição, já limpo/formatado. */
  displayTitle: string;
  description?: string;
  /** true quando a heurística de classificação teve baixa confiança. */
  needsReview?: boolean;
}

export interface Subject {
  slug: string;
  name: string;
  /** Cor de destaque (token HSL) usada em ícones/barras da disciplina. */
  colorToken: string;
  icon: string;
}

/** Estado do usuário para um item — a parte "nunca perdida" numa nova sync. */
export interface UserFileState {
  fileId: string;
  watchStatus?: WatchStatus;
  readStatus?: ReadStatus;
  /** 0–100 */
  progressPercent: number;
  /** Posição de reprodução em segundos, para "continuar de onde parou". */
  playbackPositionSeconds?: number;
  favorite: boolean;
  lastViewedAt?: string; // ISO date
  completedAt?: string; // ISO date
}

export interface SyncSummary {
  connectedFolderName: string;
  totalVideos: number;
  totalMaterials: number;
  totalSubjects: number;
  lastSyncedAt: string;
}
