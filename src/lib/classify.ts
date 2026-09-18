// ============================================================================
// Organização inteligente (spec seção 6 e 14)
//
// Recebe metadados brutos do Google Drive (nome do arquivo + caminho de
// pastas) e infere: tipo de conteúdo, disciplina, número da aula e tema.
// Quando a confiança é baixa, marca `needsReview: true` para que a UI
// pergunte ao usuário ("Encontramos alguns arquivos que precisam de
// organização").
// ============================================================================

import type { ContentKind, DriveFileMeta, StudyContent, Subject } from "./types";
import { DOCUMENT_EXTENSIONS, VIDEO_EXTENSIONS } from "./types";

export const KNOWN_SUBJECTS: Subject[] = [
  { slug: "anatomia", name: "Anatomia", colorToken: "220 70% 50%", icon: "Bone" },
  { slug: "fisiologia", name: "Fisiologia", colorToken: "199 89% 45%", icon: "Activity" },
  { slug: "bioquimica", name: "Bioquímica", colorToken: "262 60% 55%", icon: "FlaskConical" },
  { slug: "histologia", name: "Histologia", colorToken: "280 55% 52%", icon: "Microscope" },
  { slug: "embriologia", name: "Embriologia", colorToken: "330 60% 52%", icon: "Shapes" },
  { slug: "genetica", name: "Genética", colorToken: "255 55% 55%", icon: "Dna" },
  { slug: "imunologia", name: "Imunologia", colorToken: "35 85% 48%", icon: "ShieldCheck" },
  { slug: "microbiologia", name: "Microbiologia", colorToken: "155 55% 38%", icon: "Bug" },
  { slug: "patologia", name: "Patologia", colorToken: "0 65% 50%", icon: "AlertTriangle" },
  { slug: "farmacologia", name: "Farmacologia", colorToken: "270 55% 50%", icon: "Pill" },
  { slug: "semiologia", name: "Semiologia", colorToken: "195 70% 42%", icon: "Stethoscope" },
  { slug: "clinica-medica", name: "Clínica Médica", colorToken: "210 75% 45%", icon: "HeartPulse" },
  { slug: "cirurgia", name: "Cirurgia", colorToken: "5 70% 48%", icon: "Scissors" },
  { slug: "pediatria", name: "Pediatria", colorToken: "45 85% 45%", icon: "Baby" },
  { slug: "ginecologia-obstetricia", name: "Ginecologia e Obstetrícia", colorToken: "320 60% 50%", icon: "Heart" },
  { slug: "cardiologia", name: "Cardiologia", colorToken: "0 72% 48%", icon: "HeartPulse" },
];

const SUBJECT_ALIASES: Record<string, string> = {
  anatomia: "anatomia",
  anat: "anatomia",
  fisiologia: "fisiologia",
  fisio: "fisiologia",
  bioquimica: "bioquimica",
  "bioquímica": "bioquimica",
  bioq: "bioquimica",
  histologia: "histologia",
  histo: "histologia",
  embriologia: "embriologia",
  embrio: "embriologia",
  genetica: "genetica",
  "genética": "genetica",
  imunologia: "imunologia",
  imuno: "imunologia",
  microbiologia: "microbiologia",
  micro: "microbiologia",
  patologia: "patologia",
  patho: "patologia",
  farmacologia: "farmacologia",
  farmaco: "farmacologia",
  semiologia: "semiologia",
  semio: "semiologia",
  "clinica medica": "clinica-medica",
  "clínica médica": "clinica-medica",
  clinica: "clinica-medica",
  cirurgia: "cirurgia",
  pediatria: "pediatria",
  pedia: "pediatria",
  ginecologia: "ginecologia-obstetricia",
  obstetricia: "ginecologia-obstetricia",
  "obstetrícia": "ginecologia-obstetricia",
  go: "ginecologia-obstetricia",
  cardio: "cardiologia",
  cardiologia: "cardiologia",
  // Abreviações usadas em cursos preparatórios (ex.: "MED - CIR3 - Hemorragia
  // Digestiva.mp4", "MED - CLM22 - Síndrome Edemigênica.pdf").
  cir: "cirurgia",
  clm: "clinica-medica",
  gin: "ginecologia-obstetricia",
  obs: "ginecologia-obstetricia",
  ped: "pediatria",
};

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function guessSubjectFromText(text: string): string | undefined {
  const norm = normalize(text);
  for (const [alias, slug] of Object.entries(SUBJECT_ALIASES)) {
    const aliasNorm = normalize(alias);
    const pattern = new RegExp(`(^|[^a-z])${aliasNorm}([^a-z]|$)`);
    if (pattern.test(norm)) return slug;
  }
  return undefined;
}

export function classifyKind(file: Pick<DriveFileMeta, "extension" | "mimeType" | "folderPath">): ContentKind {
  const ext = file.extension.toLowerCase();
  if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext) || file.mimeType.startsWith("video/")) {
    return "videoaula";
  }
  if ((DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    return "apostila";
  }
  const pathNorm = normalize(file.folderPath.join("/"));
  if (pathNorm.includes("videoaula") || pathNorm.includes("video")) return "videoaula";
  if (pathNorm.includes("apostila") || pathNorm.includes("material")) return "apostila";
  return "outro";
}

const LESSON_PATTERN = /aula\s*(\d{1,3})/i;

function stripExtension(name: string): string {
  return name.replace(/\.[a-zA-Z0-9]+$/, "");
}

/**
 * Extrai (disciplina, número da aula, tema, título de exibição) a partir do
 * nome do arquivo e do caminho de pastas.
 *
 * Exemplos suportados:
 *   "Cardio - Aula 03 - Insuficiência Cardíaca.mp4"
 *   "Apostila - Insuficiência Cardíaca.pdf"
 *   "Anatomia/Videoaulas/Aula 01 - Introdução.mp4" (disciplina vem da pasta)
 */
export function classifyContent(
  file: DriveFileMeta,
  knownSubjects: Subject[] = KNOWN_SUBJECTS
): Omit<StudyContent, keyof DriveFileMeta> {
  const kind = classifyKind(file);
  const baseName = stripExtension(file.name);
  const segments = baseName
    .split(/[-–—:]/)
    .map((s) => s.trim())
    .filter(Boolean);

  let subjectSlug: string | undefined;
  for (const folder of file.folderPath) {
    subjectSlug = guessSubjectFromText(folder);
    if (subjectSlug) break;
  }
  if (!subjectSlug) {
    subjectSlug = guessSubjectFromText(baseName);
  }

  const lessonMatch = baseName.match(LESSON_PATTERN);
  const lessonNumber = lessonMatch ? parseInt(lessonMatch[1], 10) : undefined;

  let topic = "";
  const nonLabelSegments = segments.filter((seg) => {
    const norm = normalize(seg);
    if (guessSubjectFromText(seg)) return false;
    if (LESSON_PATTERN.test(seg)) return false;
    if (norm === "apostila" || norm === "material" || norm === "slide" || norm === "slides") return false;
    return true;
  });
  topic = nonLabelSegments.length > 0 ? nonLabelSegments[nonLabelSegments.length - 1] : baseName;

  const subjectName = knownSubjects.find((s) => s.slug === subjectSlug)?.name;
  const titleParts: string[] = [];
  if (lessonNumber) titleParts.push(`Aula ${String(lessonNumber).padStart(2, "0")}`);
  titleParts.push(topic || baseName);
  const displayTitle = titleParts.join(" — ");

  const needsReview = !subjectSlug;

  return {
    kind,
    subjectSlug: subjectSlug ?? "outras",
    lessonNumber,
    topic: topic || baseName,
    displayTitle,
    description: subjectName ? `${subjectName}${lessonNumber ? ` — Aula ${lessonNumber}` : ""}` : undefined,
    needsReview,
  };
}
