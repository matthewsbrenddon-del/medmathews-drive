// ============================================================================
// Dados de demonstração (spec seção 30)
//
// Usados sempre que a aplicação está em MODO DEMONSTRAÇÃO (sem credenciais
// reais do Google Drive configuradas — ver src/lib/driveClient.ts). Os
// títulos são fictícios e não constituem conteúdo médico oficial.
//
// A forma dos dados é EXATAMENTE a mesma que viria de uma sincronização real
// do Drive (DriveFileMeta -> classifyContent -> StudyContent), então trocar
// esta fonte por `fetchRealDriveTree()` não exige nenhuma mudança na UI.
// ============================================================================

import { classifyContent, KNOWN_SUBJECTS } from "./classify";
import type { StudyContent, DriveFileMeta, Subject } from "./types";

export const DEMO_FOLDER_NAME = "MEDICINA";

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
    materials: [
      "Bioquímica Estrutural — Apostila",
      "Vias Metabólicas — Mapa Resumo",
      "Bioenergética — Slides",
      "Lista de Exercícios — Metabolismo",
    ],
  },
  {
    slug: "histologia",
    lessons: [
      "Tecido Epitelial",
      "Tecido Conjuntivo",
      "Tecido Muscular",
      "Tecido Nervoso",
      "Histologia do Sistema Cardiovascular",
      "Histologia do Sistema Digestório",
    ],
    materials: [
      "Atlas de Histologia Básica",
      "Tecidos Fundamentais — Resumo",
      "Roteiro de Aula Prática — Microscopia",
    ],
  },
  {
    slug: "embriologia",
    lessons: [
      "Gametogênese",
      "Fecundação e Primeira Semana",
      "Gastrulação",
      "Formação dos Folhetos Embrionários",
      "Desenvolvimento do Sistema Nervoso",
    ],
    materials: ["Embriologia Humana — Apostila Introdutória", "Períodos do Desenvolvimento — Resumo"],
  },
  {
    slug: "genetica",
    lessons: [
      "Estrutura do DNA e Replicação",
      "Transcrição e Tradução",
      "Padrões de Herança Mendeliana",
      "Genética de Populações",
      "Aconselhamento Genético",
    ],
    materials: ["Genética Médica — Apostila", "Heranças Não Mendelianas — Slides"],
  },
  {
    slug: "imunologia",
    lessons: [
      "Imunidade Inata",
      "Imunidade Adaptativa",
      "Células Apresentadoras de Antígeno",
      "Resposta Humoral e Anticorpos",
      "Hipersensibilidade",
    ],
    materials: ["Imunologia Básica — Apostila", "Mapa das Células Imunes — Resumo"],
  },
  {
    slug: "microbiologia",
    lessons: [
      "Estrutura Bacteriana",
      "Mecanismos de Patogenicidade",
      "Principais Famílias de Vírus",
      "Fungos de Importância Médica",
      "Antibioticoterapia — Fundamentos",
    ],
    materials: ["Microbiologia Médica — Apostila", "Gram-positivos e Gram-negativos — Resumo"],
  },
  {
    slug: "patologia",
    lessons: [
      "Lesão e Adaptação Celular",
      "Inflamação Aguda",
      "Inflamação Crônica",
      "Distúrbios Hemodinâmicos",
      "Neoplasias — Conceitos Gerais",
      "Patologia do Sistema Cardiovascular",
    ],
    materials: ["Patologia Geral — Apostila", "Processo Inflamatório — Slides", "Neoplasias — Resumo Esquemático"],
  },
  {
    slug: "farmacologia",
    lessons: [
      "Princípios de Farmacodinâmica",
      "Farmacocinética",
      "Vias de Administração de Fármacos",
      "Farmacologia do Sistema Nervoso Autônomo",
      "Anti-inflamatórios Não Esteroidais",
      "Antibióticos — Classes e Mecanismos",
    ],
    materials: ["Farmacologia Geral — Apostila", "Interações Medicamentosas — Resumo", "Tabela de Doses — Guia Rápido"],
  },
  {
    slug: "semiologia",
    lessons: [
      "Anamnese — Estrutura e Técnica",
      "Exame Físico Geral",
      "Semiologia Cardiovascular",
      "Semiologia Respiratória",
      "Semiologia Abdominal",
    ],
    materials: ["Roteiro de Anamnese — Apostila", "Exame Físico — Checklist Impresso"],
  },
  // clinica-medica, cirurgia, pediatria e ginecologia-obstetricia usam os
  // módulos reais do usuário (REAL_MODULES, abaixo) em vez de títulos
  // fictícios — refletem a base de conteúdos real informada por ele.
  {
    slug: "cardiologia",
    lessons: [
      "Eletrocardiograma — Interpretação Básica",
      "Síndromes Coronarianas Agudas",
      "Insuficiência Cardíaca",
      "Arritmias Cardíacas",
    ],
    materials: ["Insuficiência Cardíaca — Apostila", "ECG — Guia de Bolso"],
  },
];

interface RealModule {
  /** Código do módulo como aparece nos arquivos reais (ex.: "CIR3"). */
  code: string;
  subjectSlug: string;
  title: string;
  /** Tópicos de primeiro nível cobertos no módulo, usados como resumo/descrição. */
  topics: string[];
}

// Base de conteúdos real informada pelo usuário (curso preparatório de
// Medicina) — cada módulo vira uma videoaula + uma apostila companheira,
// com o resumo do conteúdo coberto como descrição.
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

function seededHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function buildFile(seedKey: string, opts: Partial<DriveFileMeta> & { name: string; folderPath: string[]; extension: string; mimeType: string }): DriveFileMeta {
  const hash = seededHash(seedKey);
  return {
    fileId: `demo-${hash}`,
    folderId: `demo-folder-${seededHash(opts.folderPath.join("/"))}`,
    modifiedAt: daysAgoIso(hash % 180),
    sizeBytes: opts.mimeType.startsWith("video/") ? 80_000_000 + (hash % 900) * 1_000_000 : 500_000 + (hash % 40) * 100_000,
    webViewUrl: `https://drive.google.com/file/d/demo-${hash}/view`,
    embedUrl: `https://drive.google.com/file/d/demo-${hash}/preview`,
    thumbnailUrl: opts.mimeType.startsWith("video/")
      ? `https://picsum.photos/seed/${hash}/480/270`
      : undefined,
    durationSeconds: opts.mimeType.startsWith("video/") ? 420 + (hash % 40) * 30 : undefined,
    ...opts,
  };
}

function generateDemoContent(): StudyContent[] {
  const items: StudyContent[] = [];

  for (const seed of SEEDS) {
    const subjectName = KNOWN_SUBJECTS.find((s) => s.slug === seed.slug)?.name ?? seed.slug;

    seed.lessons.forEach((topic, idx) => {
      const lessonNumber = idx + 1;
      const fileName = `${subjectName} - Aula ${String(lessonNumber).padStart(2, "0")} - ${topic}.mp4`;
      const folderPath = ["MEDICINA", subjectName, "Videoaulas"];
      const file = buildFile(`${seed.slug}-video-${lessonNumber}`, {
        name: fileName,
        folderPath,
        extension: "mp4",
        mimeType: "video/mp4",
      });
      const classified = classifyContent(file);
      items.push({ ...file, ...classified, subjectSlug: seed.slug, needsReview: false });
    });

    seed.materials.forEach((title, idx) => {
      const isSlide = idx % 4 === 1;
      const ext = isSlide ? "pptx" : "pdf";
      const mime = isSlide
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : "application/pdf";
      const fileName = `${title}.${ext}`;
      const folderPath = ["MEDICINA", subjectName, "Apostilas"];
      const file = buildFile(`${seed.slug}-material-${idx}`, {
        name: fileName,
        folderPath,
        extension: ext,
        mimeType: mime,
      });
      const classified = classifyContent(file);
      items.push({ ...file, ...classified, subjectSlug: seed.slug, needsReview: false });
    });
  }

  for (const courseModule of REAL_MODULES) {
    const subjectName = KNOWN_SUBJECTS.find((s) => s.slug === courseModule.subjectSlug)?.name ?? courseModule.subjectSlug;
    const summary = courseModule.topics.join(" · ");

    const videoName = `MED - ${courseModule.code} - ${courseModule.title}.mp4`;
    const videoFile = buildFile(`real-${courseModule.code}-video`, {
      name: videoName,
      folderPath: ["MEDICINA", subjectName, "Videoaulas"],
      extension: "mp4",
      mimeType: "video/mp4",
    });
    items.push({
      ...videoFile,
      kind: "videoaula",
      subjectSlug: courseModule.subjectSlug,
      topic: courseModule.title,
      displayTitle: courseModule.title,
      description: summary,
      needsReview: false,
    });

    const materialName = `MED - ${courseModule.code} - ${courseModule.title} (Resumo).pdf`;
    const materialFile = buildFile(`real-${courseModule.code}-material`, {
      name: materialName,
      folderPath: ["MEDICINA", subjectName, "Apostilas"],
      extension: "pdf",
      mimeType: "application/pdf",
    });
    items.push({
      ...materialFile,
      kind: "apostila",
      subjectSlug: courseModule.subjectSlug,
      topic: courseModule.title,
      displayTitle: `${courseModule.title} — Resumo`,
      description: summary,
      needsReview: false,
    });
  }

  // Alguns arquivos "desorganizados" de propósito, para exercitar a
  // heurística de classificação e o fluxo de revisão manual (seção 14).
  const messyFiles: DriveFileMeta[] = [
    buildFile("messy-1", {
      name: "aula extra revisão P1.mp4",
      folderPath: ["MEDICINA", "Diversos"],
      extension: "mp4",
      mimeType: "video/mp4",
    }),
    buildFile("messy-2", {
      name: "resumo final semestre.pdf",
      folderPath: ["MEDICINA", "Diversos"],
      extension: "pdf",
      mimeType: "application/pdf",
    }),
  ];
  for (const file of messyFiles) {
    const classified = classifyContent(file);
    items.push({ ...file, ...classified });
  }

  return items;
}

export const DEMO_CONTENT: StudyContent[] = generateDemoContent();

export function getDemoSubjects(): Subject[] {
  const used = new Set(DEMO_CONTENT.map((c) => c.subjectSlug));
  return KNOWN_SUBJECTS.filter((s) => used.has(s.slug));
}

/**
 * Simula o resultado de uma varredura do Drive, no formato que a camada real
 * (`fetchRealDriveTree`) também retornaria.
 */
export function getDemoSyncSummary() {
  const videos = DEMO_CONTENT.filter((c) => c.kind === "videoaula").length;
  const materials = DEMO_CONTENT.filter((c) => c.kind === "apostila" || c.kind === "outro").length;
  return {
    connectedFolderName: DEMO_FOLDER_NAME,
    totalVideos: videos,
    totalMaterials: materials,
    totalSubjects: getDemoSubjects().length,
    lastSyncedAt: new Date().toISOString(),
  };
}
