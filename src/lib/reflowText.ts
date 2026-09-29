// ============================================================================
// Enunciados importados de PDF chegam com quebras de linha fixas no meio das
// frases ("surgimento de broto\nmamário"). Aqui juntamos as linhas quebradas,
// mantendo quebras "de verdade": fim de frase, linhas de tabela curtas
// (ex.: sinais vitais) e listas. As substituições preservam o comprimento
// sempre que possível ("\n" → " "), para não deslocar grifos já salvos.
// ============================================================================

const SENTENCE_END = /[.:!?;)]$/;
const LIST_START = /^([-•*]|\d+[.)]|[a-eA-E]\))\s/;

export function reflowText(text: string): string {
  if (!text || !text.includes("\n")) return text;
  const normalized = text
    .replace(/\r\n/g, "\n")
    // "36,5 o\nC" (símbolo de grau perdido na extração) → "36,5 °C"
    .replace(/(\d)\s?o\s*\nC\b/g, "$1 °C");

  const lines = normalized.split("\n");
  let out = lines[0] ?? "";
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1].trimEnd();
    const line = lines[i];
    const next = line.trimStart();
    if (!next) {
      out += "\n" + line;
      continue;
    }
    const startsLower = /^[a-zà-ú(]/.test(next);
    const startsPunct = /^[.,;:)%]/.test(next);
    const startsDigit = /^\d/.test(next) && !LIST_START.test(next);
    const prevLooksWrapped = prev.length >= 42;
    let join = false;
    if (prev.length > 0 && !LIST_START.test(next)) {
      if (startsPunct) join = true;
      else if (/[.!?)]$/.test(prev)) join = false;
      else if (SENTENCE_END.test(prev) || prev.endsWith(",")) join = startsLower;
      else join = startsLower || startsDigit || prevLooksWrapped;
    }
    if (join) out += (startsPunct ? "" : " ") + line;
    else out += "\n" + line;
  }
  return out;
}
