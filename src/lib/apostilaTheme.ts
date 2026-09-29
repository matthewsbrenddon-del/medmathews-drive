// Constantes/cores da apostila — separadas do gerador para que a interface
// não precise carregar o jsPDF até o aluno clicar em "Gerar PDF".

/** Máximo de questões por arquivo — acima disso a apostila é dividida em partes. */
export const PDF_EXPORT_MAX = 500;

export type RGB = [number, number, number];

export const APOSTILA_AMBER: RGB = [217, 119, 6];
export const APOSTILA_PURPLE: RGB = [124, 58, 237];

/** "210 80% 55%" (token HSL do tema) → RGB. */
export function hslTokenToRgb(token: string): RGB {
  const [h, s, l] = token.replace(/%/g, "").split(/\s+/).map(Number);
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Divide uma seleção grande em partes de até PDF_EXPORT_MAX questões. */
export function splitIntoParts(total: number): { index: number; start: number; end: number }[] {
  const parts: { index: number; start: number; end: number }[] = [];
  for (let start = 0, index = 1; start < total; start += PDF_EXPORT_MAX, index++) {
    parts.push({ index, start, end: Math.min(total, start + PDF_EXPORT_MAX) });
  }
  return parts;
}
