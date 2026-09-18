// ============================================================================
// Importação do banco de questões (spec v2, seção 3)
//
// Colunas esperadas: Disciplina, Tema/Assunto, Banca, Ano, Enunciado,
// Alternativa A–E (E opcional), Gabarito, Comentário, Dificuldade, Tags,
// Observações.
// ============================================================================

import { resolveSubject } from "./subjects";
import type { ImportRowError, ImportSummary, Question, QuestionAlternative } from "./types";
import { cellToNumber, cellToString, getHeaderCells, loadWorkbook, mapHeaders } from "./xlsxUtil";
import { normalizeText, seededHash } from "./utils";

const COLUMNS = {
  disciplina: ["disciplina"],
  tema: ["tema"],
  banca: ["banca"],
  ano: ["ano"],
  enunciado: ["enunciado"],
  gabarito: ["gabarito"],
  comentario: ["comentario"],
  dificuldade: ["dificuldade"],
  tags: ["tags"],
  observacoes: ["observ"],
};

/** As colunas de alternativa ("Alternativa A", "Resposta B"...) não podem
 * ser localizadas com um simples "contém a letra" (a palavra "alternativa"
 * já contém a letra "a") — em vez disso, exigimos que a letra apareça como
 * o último caractere do cabeçalho. */
function findAlternativeColumns(headerRow: Parameters<typeof getHeaderCells>[0]): Record<string, number> {
  const headerCells = getHeaderCells(headerRow);
  const map: Record<string, number> = {};
  for (const letter of ["a", "b", "c", "d", "e"]) {
    const found = headerCells.find((h) => {
      const trimmed = h.text.trim();
      return /(alternativa|resposta|opcao)/.test(trimmed) && trimmed.endsWith(letter) && trimmed.length <= 20;
    });
    if (found) map[`alt${letter.toUpperCase()}`] = found.index;
  }
  return map;
}

export interface QuestionImportResult {
  items: Question[];
  errors: ImportRowError[];
  summary: ImportSummary;
}

export async function parseQuestionsWorkbook(buffer: ArrayBuffer, fileName: string): Promise<QuestionImportResult> {
  const worksheet = await loadWorkbook(buffer);
  const headerRow = worksheet.getRow(1);
  const cols = { ...mapHeaders(headerRow, COLUMNS), ...findAlternativeColumns(headerRow) };

  if (!cols.disciplina || !cols.enunciado || !cols.gabarito) {
    throw new Error(
      "Não encontrei as colunas obrigatórias \"Disciplina\", \"Enunciado\" e \"Gabarito\" no cabeçalho da planilha."
    );
  }

  const items: Question[] = [];
  const errors: ImportRowError[] = [];
  let totalRows = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (field: string) => (cols[field] ? cellToString(row.getCell(cols[field]).value) : "");

    const isBlankRow = !get("disciplina") && !get("enunciado");
    if (isBlankRow) return;

    totalRows += 1;

    const disciplina = get("disciplina");
    const enunciado = get("enunciado");
    if (!disciplina) {
      errors.push({ row: rowNumber, message: "Disciplina em branco." });
      return;
    }
    if (!enunciado) {
      errors.push({ row: rowNumber, message: "Enunciado em branco." });
      return;
    }

    const alternatives: QuestionAlternative[] = [];
    for (const [letter, field] of [
      ["A", "altA"],
      ["B", "altB"],
      ["C", "altC"],
      ["D", "altD"],
      ["E", "altE"],
    ] as const) {
      const text = get(field);
      if (text) alternatives.push({ letter, text });
    }
    if (alternatives.length < 2) {
      errors.push({ row: rowNumber, message: "É preciso preencher pelo menos as alternativas A e B." });
      return;
    }

    const gabaritoRaw = get("gabarito");
    const gabarito = normalizeText(gabaritoRaw).toUpperCase().trim();
    if (!alternatives.some((a) => a.letter === gabarito)) {
      errors.push({
        row: rowNumber,
        message: `Gabarito "${gabaritoRaw}" não corresponde a nenhuma alternativa preenchida.`,
      });
      return;
    }

    const subject = resolveSubject(disciplina);
    const tagsRaw = get("tags");
    const tags = tagsRaw
      ? tagsRaw.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
      : [];
    const dificuldadeRaw = cellToNumber(cols.dificuldade ? row.getCell(cols.dificuldade).value : undefined);
    const observacoes = get("observacoes");

    items.push({
      id: `q-${seededHash(`${disciplina}-${enunciado}-${rowNumber}`)}`,
      subjectSlug: subject.slug,
      subjectName: subject.name,
      tema: get("tema") || undefined,
      banca: get("banca") || undefined,
      ano: cellToNumber(cols.ano ? row.getCell(cols.ano).value : undefined),
      enunciado,
      alternatives,
      gabarito,
      comentario: get("comentario") || undefined,
      dificuldade: dificuldadeRaw ? Math.min(5, Math.max(1, Math.round(dificuldadeRaw))) : 3,
      tags,
      observacoes: observacoes || undefined,
      hasImage: /imagem|figura|imagem associada/i.test(observacoes),
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
      skipped: errors.length,
    },
  };
}
