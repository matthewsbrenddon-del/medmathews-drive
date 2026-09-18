// ============================================================================
// Helpers compartilhados para leitura de planilhas .xlsx (cursos e questões).
// ============================================================================

import ExcelJS from "exceljs";
import { normalizeText } from "./utils";

/** Converte o valor de uma célula do ExcelJS (texto simples, rich text,
 * fórmula ou hyperlink) para uma string simples. */
export function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if (typeof v.text === "string") return v.text.trim();
    if (typeof v.result === "string" || typeof v.result === "number") return String(v.result).trim();
    if (Array.isArray(v.richText)) {
      return v.richText.map((r: { text?: string }) => r.text ?? "").join("").trim();
    }
    if (typeof v.hyperlink === "string") return v.hyperlink.trim();
  }
  return String(value).trim();
}

export function cellToNumber(value: ExcelJS.CellValue): number | undefined {
  const text = cellToString(value).replace(",", ".");
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

export interface HeaderCell {
  index: number;
  text: string;
}

export function getHeaderCells(headerRow: ExcelJS.Row): HeaderCell[] {
  const headerCells: HeaderCell[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headerCells.push({ index: colNumber, text: normalizeText(cellToString(cell.value)) });
  });
  return headerCells;
}

/** Encontra, para cada coluna esperada, o índice (1-based) da coluna na
 * planilha cujo cabeçalho contém todas as palavras-chave informadas —
 * tolerante a acentos, maiúsculas/minúsculas e pequenas variações de nome. */
export function mapHeaders(headerRow: ExcelJS.Row, columns: Record<string, string[]>): Record<string, number> {
  const map: Record<string, number> = {};
  const headerCells = getHeaderCells(headerRow);

  for (const [field, keywords] of Object.entries(columns)) {
    const found = headerCells.find((h) => keywords.every((k) => h.text.includes(k)));
    if (found) map[field] = found.index;
  }
  return map;
}

export async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("A planilha não contém nenhuma aba.");
  return worksheet;
}
