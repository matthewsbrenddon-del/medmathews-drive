// ============================================================================
// Importação da planilha de taxonomia (classificação em lote da Biblioteca)
// — ex.: seed-data/MedStudyHub_Taxonomia_Curso_Drive.xlsx.
//
// Colunas esperadas (nomes tolerantes a maiúsculas/acentos):
//   ID do Arquivo (Drive), Curso, Conteúdo, Grande Área, Disciplina, Subtema
//
// Cada linha classifica UM item do acervo (public/seed-data/library-
// mapeamento.json) numa das 5 grandes áreas do ENAMED. O casamento é feito
// preferencialmente pelo ID do arquivo do Drive (chave estável); quando a
// coluna vier vazia, cai para "Curso" + "Conteúdo" batendo exatamente com o
// caminho original do item. Linhas que não casam com nenhum item do acervo,
// ou cuja Grande Área não é reconhecida, são reportadas linha a linha — sem
// travar a importação inteira.
// ============================================================================

import { readFile } from "fs/promises";
import path from "path";
import { matchKnownSubject } from "./subjects";
import type { ImportRowError } from "./types";
import { cellToString, loadWorkbook, mapHeaders } from "./xlsxUtil";

const COLUMNS = {
  fileId: ["id", "arquivo"],
  curso: ["curso"],
  conteudo: ["conteudo"],
  grandeArea: ["area"],
  disciplina: ["disciplina"],
  subtema: ["subtema"],
};

export interface TaxonomyEntry {
  fileId: string;
  subjectSlug: string;
  disciplina?: string;
  subtema?: string;
}

export interface TaxonomyImportResult {
  entries: TaxonomyEntry[];
  errors: ImportRowError[];
  summary: { fileName: string; totalRows: number; imported: number; skipped: number };
}

async function loadLibraryLookup(): Promise<Map<string, string>> {
  const filePath = path.join(process.cwd(), "public", "seed-data", "library-mapeamento.json");
  const raw = await readFile(filePath, "utf-8");
  const files: { id: string; curso: string; conteudo: string }[] = JSON.parse(raw);
  const map = new Map<string, string>();
  for (const f of files) map.set(`${f.curso}␟${f.conteudo}`, f.id);
  return map;
}

export async function parseTaxonomyWorkbook(buffer: ArrayBuffer, fileName: string): Promise<TaxonomyImportResult> {
  const worksheet = await loadWorkbook(buffer);
  const headerRow = worksheet.getRow(1);
  const cols = mapHeaders(headerRow, COLUMNS);

  if (!cols.grandeArea) {
    throw new Error('Não encontrei a coluna obrigatória "Grande Área" no cabeçalho da planilha.');
  }
  if (!cols.fileId && !(cols.curso && cols.conteudo)) {
    throw new Error('Preencha "ID do Arquivo (Drive)" ou as colunas "Curso" + "Conteúdo" para identificar cada item.');
  }

  const libraryLookup = cols.fileId ? null : await loadLibraryLookup();

  const entries: TaxonomyEntry[] = [];
  const errors: ImportRowError[] = [];
  let totalRows = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (field: keyof typeof COLUMNS) => (cols[field] ? cellToString(row.getCell(cols[field]).value) : "");

    const isBlankRow = row.cellCount === 0 || (!get("fileId") && !get("curso") && !get("conteudo"));
    if (isBlankRow) return;

    totalRows += 1;

    const grandeAreaRaw = get("grandeArea");
    const subject = grandeAreaRaw ? matchKnownSubject(grandeAreaRaw) : undefined;
    if (!subject) {
      errors.push({ row: rowNumber, message: `Grande área "${grandeAreaRaw}" não reconhecida.` });
      return;
    }

    let fileId = get("fileId");
    if (!fileId && libraryLookup) {
      const curso = get("curso");
      const conteudo = get("conteudo");
      fileId = libraryLookup.get(`${curso}␟${conteudo}`) ?? "";
    }
    if (!fileId) {
      errors.push({ row: rowNumber, message: "Não encontrei um item do acervo com esse ID/Curso/Conteúdo." });
      return;
    }

    entries.push({
      fileId,
      subjectSlug: subject.slug,
      disciplina: get("disciplina") || undefined,
      subtema: get("subtema") || undefined,
    });
  });

  return {
    entries,
    errors,
    summary: {
      fileName,
      totalRows,
      imported: entries.length,
      skipped: errors.length,
    },
  };
}
