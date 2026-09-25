// ============================================================================
// Tipos centrais do MedStudy Hub v2
//
// Sem integração OAuth com o Drive (ver README): todo conteúdo vem de uma
// planilha .xlsx importada pelo usuário (src/lib/importCourses.ts) e todo
// item é identificado pelo `fileId` do Google Drive — nunca pelo título,
// nunca pelo nome do arquivo. Reimportar a planilha faz upsert por
// `fileId` e nunca perde o progresso do usuário (`ItemProgress`, guardado
// à parte, indexado por `fileId`/`questionId`).
// ============================================================================

export type ContentKind = "videoaula" | "apostila" | "outro";

// ---------------------------------------------------------------------------
// Biblioteca completa (acervo mapeado pelo usuário — cursos/bancos de
// questões inteiros, fora da grade curada de Disciplinas/Cronograma)
// ---------------------------------------------------------------------------

/** Uma linha do mapeamento completo de materiais (curso → área → arquivo). */
export interface LibraryFile {
  /** ID do arquivo no Google Drive — chave primária. */
  id: string;
  curso: string;
  area: string;
  /** Caminho bruto de pastas até o arquivo, separado por " › " — o último segmento é o nome do arquivo. */
  conteudo: string;
}

export type WatchStatus = "nao_iniciada" | "em_andamento" | "assistida";
export type ReadStatus = "nao_acessado" | "acessado" | "estudado";
export type QuestionStatus = "nao_respondida" | "acertada" | "errada";

/** Um item de conteúdo (aula ou material), vindo da planilha de cursos. */
export interface StudyContent {
  /** ID do arquivo no Google Drive — chave primária, nunca o título. */
  fileId: string;
  /** Link original compartilhado (ou reconstruído a partir do ID). */
  webViewUrl: string;
  /** URL de preview embutido (`/preview`) — funciona para vídeo e PDF. */
  embedUrl: string;
  kind: ContentKind;
  /** Slug da disciplina (derivado do nome informado na planilha). */
  subjectSlug: string;
  /** Nome da disciplina exatamente como veio na planilha. */
  subjectName: string;
  modulo?: string;
  lessonNumber?: number;
  displayTitle: string;
  /** Tema/assunto do item. */
  topic: string;
  /** Extensão/formato aproximado, usado só para escolher o ícone (mp4, pdf, pptx...). */
  extension: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  /** Posição relativa dentro do módulo/disciplina, para ordenar a exibição e o cronograma. */
  ordem: number;
  /** 1 (baixa) a 5 (alta) — usada pelo cronograma adaptativo. */
  priority: number;
  observacoes?: string;
  /** true quando a linha da planilha tinha algo ambíguo (ex.: disciplina não reconhecida). */
  needsReview?: boolean;
}

export interface Subject {
  slug: string;
  name: string;
  /** Cor de destaque (token HSL) usada em ícones/barras da disciplina. */
  colorToken: string;
  icon: string;
}

/** Estado do usuário para um item de conteúdo — nunca perdido numa reimportação. */
export interface ContentProgress {
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

// ---------------------------------------------------------------------------
// Banco de questões (spec v2, seção 3)
// ---------------------------------------------------------------------------

export interface QuestionAlternative {
  letter: "A" | "B" | "C" | "D" | "E";
  text: string;
}

export interface Question {
  id: string;
  subjectSlug: string;
  subjectName: string;
  tema?: string;
  subtema?: string;
  banca?: string;
  ano?: number;
  enunciado: string;
  alternatives: QuestionAlternative[];
  /** Letra da alternativa correta. */
  gabarito: string;
  comentario?: string;
  /** 1 (fácil) a 5 (difícil). */
  dificuldade: number;
  tags: string[];
  observacoes?: string;
  hasImage?: boolean;
  /** true quando a questão foi oficialmente anulada pela banca (sem gabarito único) —
   * `gabarito` fica vazio nesse caso. Continua visível para leitura, mas não é
   * pontuada em Modo Estudo/Prova nem entra nas estatísticas de desempenho. */
  anulada?: boolean;
}

/** Estado do usuário para uma questão — histórico usado na revisão espaçada simples. */
export interface QuestionProgress {
  questionId: string;
  status: QuestionStatus;
  /** Acertos seguidos mais recentes — sai da fila de revisão ao chegar em 2. */
  correctStreak: number;
  favorite: boolean;
  lastAnsweredAt?: string;
  history: { answeredAt: string; selected: string; correct: boolean }[];
}

// ---------------------------------------------------------------------------
// Flashcards (decks + repetição espaçada simples estilo Leitner)
// ---------------------------------------------------------------------------

export interface FlashcardDeck {
  id: string;
  name: string;
  subjectSlug?: string;
  description?: string;
  createdAt: string;
}

export interface Flashcard {
  id: string;
  deckId: string;
  subjectSlug?: string;
  subjectName?: string;
  front: string;
  back: string;
  tags: string[];
  /** Preenchido quando o card foi gerado automaticamente a partir de uma questão do banco. */
  sourceQuestionId?: string;
  /** "ia" quando o cartão veio da geração automática (spec v2, seção 6.1) — ausente/"manual" nos demais casos. */
  createdBy?: "manual" | "ia";
  createdAt: string;
}

/** Caixa de Leitner (1 = recém-visto/errado, 5 = dominado) — determina o
 * intervalo até a próxima revisão. */
export interface FlashcardProgress {
  cardId: string;
  box: number;
  dueDate: string; // ISO date (yyyy-mm-dd)
  lastReviewedAt?: string;
  reviewCount: number;
}

export interface ImportSummary {
  fileName: string;
  importedAt: string;
  totalRows: number;
  imported: number;
  skipped: number;
}

export interface ImportRowError {
  row: number;
  message: string;
}
