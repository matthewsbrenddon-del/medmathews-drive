// ============================================================================
// Dados de demonstração (spec v2)
//
// Mostrados apenas até o usuário importar sua primeira planilha de cursos
// (ver src/lib/contentStore.ts) — a partir daí, o conteúdo real importado
// substitui esses exemplos. Os títulos são fictícios (exceto os módulos de
// Cirurgia/Clínica Médica/Ginecologia e Obstetrícia/Pediatria, que refletem
// a base de conteúdos real compartilhada pelo usuário) e não constituem
// conteúdo médico oficial.
// ============================================================================

import { drivePreviewUrl, driveViewUrl } from "./driveLink";
import { KNOWN_SUBJECTS } from "./subjects";
import { seededHash } from "./utils";
import type { StudyContent } from "./types";

interface SubjectSeed {
  slug: string;
  lessons: string[];
  materials: string[];
}

// Títulos realistas por disciplina — inspirados nos exemplos da especificação.
const SEEDS: SubjectSeed[] = [
  {
    slug: "anatomia",
    lessons: [
      "Introdução ao Sistema Musculoesquelético",
      "Ossos do Crânio e Face",
      "Coluna Vertebral e Curvaturas",
      "Membro Superior: Ombro e Braço",
      "Membro Inferior: Quadril e Coxa",
      "Sistema Articular",
      "Anatomia do Tórax",
      "Anatomia do Abdome",
    ],
    materials: [
      "Anatomia Geral — Apostila Completa",
      "Sistema Ósseo — Resumo Ilustrado",
      "Atlas de Anatomia Muscular",
      "Roteiro de Dissecção — Membros",
      "Lista de Exercícios — Osteologia",
    ],
  },
  {
    slug: "fisiologia",
    lessons: [
      "Homeostase e Meio Interno",
      "Membrana Celular e Transporte",
      "Potencial de Repouso",
      "Potencial de Ação",
      "Fisiologia da Contração Muscular",
      "Fisiologia Cardiovascular I",
      "Fisiologia Respiratória",
      "Fisiologia Renal — Filtração Glomerular",
    ],
    materials: [
      "Fisiologia Celular — Apostila",
      "Eletrofisiologia — Resumo",
      "Ciclo Cardíaco — Slides",
      "Fisiologia Respiratória — Guia de Estudo",
    ],
  },
  {
    slug: "bioquimica",
    lessons: [
      "Estrutura de Aminoácidos e Proteínas",
      "Enzimas e Cinética Enzimática",
      "Glicólise",
      "Ciclo de Krebs",
      "Cadeia Transportadora de Elétrons",
      "Metabolismo de Lipídeos",
      "Metabolismo de Proteínas e Ciclo da Ureia",
    ],
    materials: ["Bioquímica Estrutural — Apostila", "Vias Metabólicas — Mapa Resumo", "Bioenergética — Slides"],
  },
  {
    slug: "histologia",
    lessons: ["Tecido Epitelial", "Tecido Conjuntivo", "Tecido Muscular", "Tecido Nervoso"],
    materials: ["Atlas de Histologia Básica", "Tecidos Fundamentais — Resumo"],
  },
  {
    slug: "farmacologia",
    lessons: [
      "Princípios de Farmacodinâmica",
      "Farmacocinética",
      "Vias de Administração de Fármacos",
      "Anti-inflamatórios Não Esteroidais",
      "Antibióticos — Classes e Mecanismos",
    ],
    materials: ["Farmacologia Geral — Apostila", "Interações Medicamentosas — Resumo"],
  },
  {
    slug: "cardiologia",
    lessons: ["Eletrocardiograma — Interpretação Básica", "Síndromes Coronarianas Agudas", "Arritmias Cardíacas"],
    materials: ["ECG — Guia de Bolso"],
  },
];

interface RealModule {
  /** Código do módulo como aparece nos arquivos reais (ex.: "CIR3"). */
  code: string;
  subjectSlug: string;
  title: string;
  /** Tópicos de primeiro nível cobertos no módulo, usados como resumo/tema. */
  topics: string[];
}

// Base de conteúdos real informada pelo usuário (curso preparatório de
// Medicina) — cada módulo vira uma videoaula + uma apostila companheira.
const REAL_MODULES: RealModule[] = [
  {
    code: "CIR3",
    subjectSlug: "cirurgia",
    title: "Hemorragia Digestiva",
    topics: [
      "Abordagem Inicial da Hemorragia Digestiva Aguda",
      "Hemorragia Digestiva Alta",
      "Hemorragia Digestiva Baixa",
      "Doenças Anorretais",
      "Apêndices",
    ],
  },
  {
    code: "CIR5",
    subjectSlug: "cirurgia",
    title: "Obstrução Intestinal",
    topics: ["Síndrome de Obstrução Intestinal", "Causas de Obstrução Intestinal", "Hérnias da Parede Abdominal"],
  },
  {
    code: "CLM1",
    subjectSlug: "clinica-medica",
    title: "Síndrome Ictérica",
    topics: [
      "Distúrbios Primários do Metabolismo da Bilirrubina",
      "Lesão Hepatocelular",
      "Colestase e Doenças Biliares",
      "Apêndices",
    ],
  },
  {
    code: "CLM4",
    subjectSlug: "clinica-medica",
    title: "Síndrome Metabólica 2",
    topics: ["Diabetes Mellitus", "Crises Hiperglicêmicas", "Complicações Crônicas do Diabetes", "Apêndices"],
  },
  {
    code: "CLM10",
    subjectSlug: "clinica-medica",
    title: "Tosse Crônica",
    topics: ["Síndrome da Tosse Crônica", "Tuberculose", "Apêndices"],
  },
  {
    code: "CLM11",
    subjectSlug: "clinica-medica",
    title: "Dispneia",
    topics: ["Doenças Pulmonares Obstrutivas e Intersticiais", "Neoplasias e Infecções Pulmonares", "Apêndices"],
  },
  {
    code: "CLM14",
    subjectSlug: "clinica-medica",
    title: "Síndrome Álgica 2 - Cefaleias",
    topics: ["Introdução e Sinais de Alarme", "Cefaleias Primárias", "Cefaleias Secundárias", "Apêndices"],
  },
  {
    code: "CLM22",
    subjectSlug: "clinica-medica",
    title: "Síndrome Edemigênica",
    topics: ["A Síndrome Edemigênica", "Insuficiência Cardíaca", "Outras Causas de Edema", "Apêndices"],
  },
  {
    code: "GIN4",
    subjectSlug: "ginecologia-obstetricia",
    title: "Amenorreia, SOP e Infertilidade",
    topics: ["Amenorreia", "Síndrome dos Ovários Policísticos (SOP)", "Infertilidade", "Apêndices"],
  },
  {
    code: "GIN5",
    subjectSlug: "ginecologia-obstetricia",
    title: "Sangramentos Ginecológicos, Endometriose e Anticoncepção",
    topics: [
      "Sangramento Uterino Anormal (SUA)",
      "Leiomiomas Uterinos",
      "Pólipos Uterinos",
      "Adenomiose",
      "Endometriose",
      "Anticoncepção",
      "Apêndices",
    ],
  },
  {
    code: "OBS3",
    subjectSlug: "ginecologia-obstetricia",
    title: "Sofrimento Fetal, Puerpério, Fórcipe",
    topics: [
      "Sofrimento Fetal Agudo",
      "Sofrimento Fetal Crônico",
      "Fórcipe Obstétrico",
      "Puerpério Fisiológico",
      "Puerpério Patológico",
      "Apêndices",
    ],
  },
  {
    code: "PED1",
    subjectSlug: "pediatria",
    title: "Síndromes Exantemáticas",
    topics: [
      "A História Natural das Doenças Exantemáticas",
      "Doenças Exantemáticas Virais",
      "Doenças Exantemáticas Bacterianas",
      "Doenças Exantemáticas Reumatológicas",
      "Apêndice",
    ],
  },
  {
    code: "PED4",
    subjectSlug: "pediatria",
    title: "Neonatologia",
    topics: [
      "Atendimento Inicial e Reanimação",
      "Infecções Congênitas e Neonatais",
      "Distúrbios Respiratórios do RN",
      "Icterícia Neonatal",
      "Apêndices",
    ],
  },
  {
    code: "PED5",
    subjectSlug: "pediatria",
    title: "Síndromes Ponderoestaturais, Puberais e do Desenvolvimento",
    topics: ["Crescimento", "Distúrbios do Crescimento", "Puberdade e Seus Distúrbios", "Apêndices"],
  },
];

function subjectNameFor(slug: string): string {
  return KNOWN_SUBJECTS.find((s) => s.slug === slug)?.name ?? slug;
}

function demoFile(seedKey: string, kind: "videoaula" | "apostila") {
  const hash = seededHash(seedKey);
  const fileId = `demo-${hash}`;
  return {
    fileId,
    webViewUrl: driveViewUrl(fileId),
    embedUrl: drivePreviewUrl(fileId),
    thumbnailUrl: kind === "videoaula" ? `https://picsum.photos/seed/${hash}/480/270` : undefined,
    durationSeconds: kind === "videoaula" ? 420 + (hash % 40) * 30 : undefined,
    priority: (hash % 5) + 1,
    extension: kind === "videoaula" ? "mp4" : "pdf",
  };
}

function generateDemoContent(): StudyContent[] {
  const items: StudyContent[] = [];
  let ordem = 0;

  for (const seed of SEEDS) {
    const subjectName = subjectNameFor(seed.slug);

    seed.lessons.forEach((topic, idx) => {
      const lessonNumber = idx + 1;
      const file = demoFile(`${seed.slug}-video-${lessonNumber}`, "videoaula");
      items.push({
        ...file,
        kind: "videoaula",
        subjectSlug: seed.slug,
        subjectName,
        lessonNumber,
        displayTitle: `Aula ${String(lessonNumber).padStart(2, "0")} — ${topic}`,
        topic,
        ordem: ordem++,
        needsReview: false,
      });
    });

    seed.materials.forEach((title, idx) => {
      const file = demoFile(`${seed.slug}-material-${idx}`, "apostila");
      items.push({
        ...file,
        kind: "apostila",
        subjectSlug: seed.slug,
        subjectName,
        displayTitle: title,
        topic: title,
        ordem: ordem++,
        needsReview: false,
      });
    });
  }

  for (const courseModule of REAL_MODULES) {
    const subjectName = subjectNameFor(courseModule.subjectSlug);
    const summary = courseModule.topics.join(" · ");

    const videoFile = demoFile(`real-${courseModule.code}-video`, "videoaula");
    items.push({
      ...videoFile,
      kind: "videoaula",
      subjectSlug: courseModule.subjectSlug,
      subjectName,
      modulo: courseModule.code,
      displayTitle: courseModule.title,
      topic: summary,
      ordem: ordem++,
      needsReview: false,
    });

    const materialFile = demoFile(`real-${courseModule.code}-material`, "apostila");
    items.push({
      ...materialFile,
      kind: "apostila",
      subjectSlug: courseModule.subjectSlug,
      subjectName,
      modulo: courseModule.code,
      displayTitle: `${courseModule.title} — Resumo`,
      topic: summary,
      ordem: ordem++,
      needsReview: false,
    });
  }

  return items;
}

export const DEMO_CONTENT: StudyContent[] = generateDemoContent();
