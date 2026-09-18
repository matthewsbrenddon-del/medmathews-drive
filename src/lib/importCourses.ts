// ============================================================================
// Importação da planilha de cursos/cronograma (spec v2, seção 2)
//
// Colunas esperadas (nomes tolerantes a maiúsculas/acentos):
//   Disciplina, Módulo, Nº da Aula, Título da Aula/Material, Tema, Tipo,
//   Link do Drive, ID do Arquivo (Drive), Duração (min), Ordem,
//   Prioridade (1-5), Observações
//
// A chave estável de cada item é o ID do arquivo do Drive — nunca o título.
// Se a coluna de ID vier vazia, extraímos automaticamente a partir do link
// (src/lib/driveLink.ts). Erros de formato são reportados linha a linha; uma
// linha inválida não derruba a importação inteira.
// ============================================================================

import { drivePreviewUrl, driveViewUrl, extractDriveFileId } from "./driveLink";
import { resolveSubject } from "./subjects";
import type { ContentKind, ImportRowError, ImportSummary, StudyContent } from "./types";
import { cellToNumber, cellToString, loadWorkbook, mapHeaders } from "./xlsxUtil";
import { normalizeText } from "./utils";

const COLUMNS = {
  disciplina: ["disciplina"],
  modulo: ["modulo"],
  lessonNumber: ["aula"],
  titulo: ["titulo"],
  tema: ["tema"],
  tipo: ["tipo"],
  link: ["link"],
  driveId: ["id"],
  duracao: ["duracao"],
  ordem: ["ordem"],
  prioridade: ["prioridade"],
  observacoes: ["observ"],
};

function inferKind(tipoRaw: string, hasDuration: boolean): { kind: ContentKind; ambiguous: boolean } {
  const t = normalizeText(tipoRaw);
  if (!t) return { kind: hasDuration ? "videoaula" : "apostila", ambiguous: true };
  if (/(video|aula|filme|mp4)/.test(t)) return { kind: "videoaula", ambiguous: false };
  if (/(pdf|apostila|material|slide|documento|doc|pptx?|resumo)/.test(t)) return { kind: "apostila", ambiguous: false };
  return { kind: "outro", ambiguous: false };
}

function extensionFor(kind: ContentKind): string {
  if (kind === "videoaula") return "mp4";
  if (kind === "apostila") return "pdf";
  return "arquivo";
}

export interface CourseImportResult {
  items: StudyContent[];
  errors: ImportRowError[];
  summary: ImportSummary;
}

export async function parseCoursesWorkbook(buffer: ArrayBuffer, fileName: string): Promise<CourseImportResult> {
  const worksheet = await loadWorkbook(buffer);
  const headerRow = worksheet.getRow(1);
  const cols = mapHeaders(headerRow, COLUMNS);

  if (!cols.disciplina || !cols.titulo) {
    throw new Error(
      "Não encontrei as colunas obrigatórias \"Disciplina\" e \"Título da Aula/Material\" no cabeçalho da planilha."
    );
  }

  const items: StudyContent[] = [];
  const errors: ImportRowError[] = [];
  const seenIds = new Set<string>();
  let totalRows = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // cabeçalho
    const get = (field: keyof typeof COLUMNS) => (cols[field] ? cellToString(row.getCell(cols[field]).value) : "");

    const isBlankRow = row.cellCount === 0 || !get("disciplina") && !get("titulo") && !get("link") && !get("driveId");
    if (isBlankRow) return;

    totalRows += 1;

    const disciplina = get("disciplina");
    const titulo = get("titulo");
    if (!disciplina) {
      errors.push({ row: rowNumber, message: "Disciplina em branco." });
      return;
    }
    if (!titulo) {
      errors.push({ row: rowNumber, message: "Título da aula/material em branco." });
      return;
    }

    const link = get("link");
    const idColumn = get("driveId");
    const fileId = idColumn || (link ? extractDriveFileId(link) : null);
    if (!fileId) {
      errors.push({
        row: rowNumber,
        message: "Não foi possível identificar o ID do arquivo — preencha \"ID do Arquivo (Drive)\" ou um \"Link do Drive\" válido.",
      });
      return;
    }
    if (seenIds.has(fileId)) {
      errors.push({ row: rowNumber, message: `ID de arquivo duplicado nesta planilha ("${fileId}") — apenas a última ocorrência foi mantida.` });
    }
    seenIds.add(fileId);

    const durationMin = cellToNumber(cols.duracao ? row.getCell(cols.duracao).value : undefined);
    const { kind, ambiguous } = inferKind(get("tipo"), Boolean(durationMin));

    const subject = resolveSubject(disciplina);
    const lessonNumber = cellToNumber(cols.lessonNumber ? row.getCell(cols.lessonNumber).value : undefined);
    const ordem = cellToNumber(cols.ordem ? row.getCell(cols.ordem).value : undefined) ?? rowNumber;
    const prioridadeRaw = cellToNumber(cols.prioridade ? row.getCell(cols.prioridade).value : undefined);
    const priority = prioridadeRaw ? Math.min(5, Math.max(1, Math.round(prioridadeRaw))) : 3;
    const tema = get("tema");
    const modulo = get("modulo");
    const observacoes = get("observacoes");

    items.push({
      fileId,
      webViewUrl: link || driveViewUrl(fileId),
      embedUrl: drivePreviewUrl(fileId),
      kind,
      subjectSlug: subject.slug,
      subjectName: subject.name,
      modulo: modulo || undefined,
      lessonNumber,
      displayTitle: lessonNumber ? `Aula ${String(lessonNumber).padStart(2, "0")} — ${titulo}` : titulo,
      topic: tema || titulo,
      extension: extensionFor(kind),
      durationSeconds: durationMin ? Math.round(durationMin * 60) : undefined,
      ordem,
      priority,
      observacoes: observacoes || undefined,
      needsReview: ambiguous,
    });
  });

  return {
    items,
    errors,
    summary: {
      fileName,
      importedAt: new Date().toISOString(),
      totalRows,
      imported: items.length,
      skipped: errors.filter((e) => !e.message.includes("duplicado")).length,
    },
  };
}
