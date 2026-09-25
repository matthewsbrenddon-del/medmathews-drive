// ============================================================================
// Exportação para Anki.
//
// Gera um arquivo de texto delimitado por tabulação (frente / verso / tags),
// o formato de importação em texto simples que o próprio Anki documenta e
// aceita nativamente (Arquivo > Importar, escolhendo "Campos separados por
// Tab" e marcando a coluna de tags) — funciona sem depender de nenhuma
// biblioteca para gerar o binário .apkg.
// ============================================================================

import type { Flashcard } from "./types";

function escapeField(text: string): string {
  // Tabs e quebras de linha quebrariam o parser de campos do Anki.
  return text.replace(/\t/g, "    ").replace(/\r?\n/g, "<br>");
}

export function buildAnkiExport(cards: Flashcard[]): string {
  const header = "#separator:tab\n#html:true\n#columns:Frente\tVerso\tTags\n";
  const rows = cards.map((c) => {
    const tags = c.tags.map((t) => t.replace(/\s+/g, "_")).join(" ");
    return [escapeField(c.front), escapeField(c.back), tags].join("\t");
  });
  return header + rows.join("\n");
}

export function downloadAnkiExport(cards: Flashcard[], fileName: string) {
  const content = buildAnkiExport(cards);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".txt") ? fileName : `${fileName}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
