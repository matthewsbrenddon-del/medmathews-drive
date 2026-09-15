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
  {
    slug: "clinica-medica",
    lessons: [
      "Abordagem da Dor Torácica",
      "Hipertensão Arterial Sistêmica",
      "Diabetes Mellitus — Diagnóstico e Manejo",
      "Doença Pulmonar Obstrutiva Crônica",
      "Insuficiência Renal Crônica",
    ],
    materials: ["Clínica Médica — Apostila de Condutas", "Fluxogramas de Emergência — Resumo"],
  },
  {
    slug: "cirurgia",
    lessons: [
      "Princípios de Assepsia e Antissepsia",
      "Cicatrização de Feridas",
      "Abdome Agudo Cirúrgico",
      "Pré e Pós-operatório",
    ],
    materials: ["Técnica Cirúrgica Básica — Apostila", "Suturas — Guia Ilustrado"],
  },
  {
    slug: "pediatria",
    lessons: [
      "Crescimento e Desenvolvimento Infantil",
      "Calendário Vacinal",
      "Aleitamento Materno",
      "Doenças Exantemáticas na Infância",
    ],
    materials: ["Pediatria Ambulatorial — Apostila", "Curvas de Crescimento — Material de Apoio"],
  },
  {
    slug: "ginecologia-obstetricia",
    lessons: [
      "Ciclo Menstrual e Eixo Hipotálamo-Hipófise-Ovário",
      "Pré-natal de Baixo Risco",
      "Métodos Contraceptivos",
      "Trabalho de Parto — Fases Clínicas",
    ],
    materials: ["Ginecologia Básica — Apostila", "Obstetrícia — Resumo de Pré-natal"],
  },
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
