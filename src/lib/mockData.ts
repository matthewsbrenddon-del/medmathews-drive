// ============================================================================
// Dados de demonstração (spec v2 + reorganização por grandes áreas)
//
// Mostrados apenas até o usuário importar sua primeira planilha de cursos
// (ver src/lib/contentStore.ts) — a partir daí, o conteúdo real importado
// substitui esses exemplos.
//
// Organização: as 5 grandes áreas do ENAMED (Clínica Médica, Cirurgia
// Geral, Ginecologia e Obstetrícia, Pediatria, Preventiva e MFC), cada uma
// subdividida em "frentes" (módulos: CLM1, CIR1, GIN1, OBS1, PED1, MFC1...).
// Os módulos marcados abaixo como REAIS refletem a base de conteúdos
// compartilhada pelo usuário; o restante é um esqueleto genérico dos temas
// mais cobrados no ENAMED para completar cada área a pelo menos 5 frentes,
// para ser substituído pela grade real assim que ela for organizada.
// Nada aqui constitui conteúdo médico oficial.
// ============================================================================

import { drivePreviewUrl, driveViewUrl } from "./driveLink";
import { KNOWN_SUBJECTS } from "./subjects";
import { seededHash } from "./utils";
import type { StudyContent } from "./types";

interface CourseModule {
  /** Código da frente (ex.: "CIR3") — vira o campo `modulo`. */
  code: string;
  subjectSlug: string;
  title: string;
  /** Tópicos de primeiro nível cobertos no módulo, usados como resumo/tema. */
  topics: string[];
}

const MODULES: CourseModule[] = [
  // --- Clínica Médica (reais) -----------------------------------------
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

  // --- Cirurgia Geral (CIR3 e CIR5 reais; CIR1/2/4 genéricos ENAMED) ---
  {
    code: "CIR1",
    subjectSlug: "cirurgia-geral",
    title: "Cuidados Perioperatórios",
    topics: [
      "Avaliação Pré-operatória e Risco Cirúrgico",
      "Cuidados Pós-operatórios Gerais",
      "Complicações Cirúrgicas Comuns",
      "Nutrição e Cicatrização",
      "Apêndices",
    ],
  },
  {
    code: "CIR2",
    subjectSlug: "cirurgia-geral",
    title: "Trauma e Abdome Agudo",
    topics: [
      "Atendimento Inicial ao Politraumatizado",
      "Trauma Abdominal",
      "Abdome Agudo Inflamatório",
      "Abdome Agudo Perfurativo e Obstrutivo",
      "Apêndices",
    ],
  },
  {
    code: "CIR3",
    subjectSlug: "cirurgia-geral",
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
    code: "CIR4",
    subjectSlug: "cirurgia-geral",
    title: "Vias Biliares e Pâncreas",
    topics: [
      "Colelitíase e Coledocolitíase",
      "Colecistite Aguda",
      "Pancreatite Aguda e Crônica",
      "Neoplasias Pancreáticas e Periampulares",
      "Apêndices",
    ],
  },
  {
    code: "CIR5",
    subjectSlug: "cirurgia-geral",
    title: "Obstrução Intestinal",
    topics: ["Síndrome de Obstrução Intestinal", "Causas de Obstrução Intestinal", "Hérnias da Parede Abdominal"],
  },

  // --- Ginecologia (GIN4 e GIN5 reais; GIN1/2/3 genéricos ENAMED) ------
  {
    code: "GIN1",
    subjectSlug: "ginecologia-obstetricia",
    title: "Propedêutica Ginecológica e Ciclo Menstrual",
    topics: [
      "Fisiologia do Ciclo Menstrual",
      "Exame Ginecológico e Rastreamento",
      "Doenças Sexualmente Transmissíveis",
      "Doença Inflamatória Pélvica",
      "Apêndices",
    ],
  },
  {
    code: "GIN2",
    subjectSlug: "ginecologia-obstetricia",
    title: "Patologia do Colo Uterino e Mama",
    topics: [
      "Rastreamento e Lesões Precursoras do Colo Uterino",
      "Câncer de Colo Uterino",
      "Doenças Benignas da Mama",
      "Câncer de Mama — Rastreamento e Diagnóstico",
      "Apêndices",
    ],
  },
  {
    code: "GIN3",
    subjectSlug: "ginecologia-obstetricia",
    title: "Climatério e Uroginecologia",
    topics: [
      "Síndrome Climatérica e Terapia Hormonal",
      "Incontinência Urinária Feminina",
      "Prolapsos Genitais",
      "Osteoporose Pós-menopausa",
      "Apêndices",
    ],
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

  // --- Obstetrícia (OBS3 real; OBS1/2/4/5 genéricos ENAMED) ------------
  {
    code: "OBS1",
    subjectSlug: "ginecologia-obstetricia",
    title: "Pré-natal e Assistência ao Parto Normal",
    topics: [
      "Diagnóstico de Gravidez e Idade Gestacional",
      "Roteiro do Pré-natal de Baixo Risco",
      "Mecanismo e Assistência ao Parto Normal",
      "Partograma",
      "Apêndices",
    ],
  },
  {
    code: "OBS2",
    subjectSlug: "ginecologia-obstetricia",
    title: "Síndromes Hipertensivas da Gestação",
    topics: [
      "Hipertensão Gestacional e Pré-eclâmpsia",
      "Eclâmpsia e Síndrome HELLP",
      "Diabetes Mellitus Gestacional",
      "Doença Hemolítica Perinatal",
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
    code: "OBS4",
    subjectSlug: "ginecologia-obstetricia",
    title: "Sangramentos na Gestação",
    topics: [
      "Sangramentos da Primeira Metade (Abortamento, Ectópica, Mola)",
      "Sangramentos da Segunda Metade (Placenta Prévia, DPP)",
      "Rotura Uterina",
      "Apêndices",
    ],
  },
  {
    code: "OBS5",
    subjectSlug: "ginecologia-obstetricia",
    title: "Trabalho de Parto Prematuro e Gestação de Alto Risco",
    topics: [
      "Trabalho de Parto Pré-termo",
      "Amniorrexe Prematura",
      "Gestação Múltipla",
      "Infecções Congênitas na Gestação",
      "Apêndices",
    ],
  },

  // --- Pediatria (PED1/4/5 reais; PED2/3 genéricos ENAMED) -------------
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
    code: "PED2",
    subjectSlug: "pediatria",
    title: "Aleitamento Materno e Nutrição Infantil",
    topics: [
      "Aleitamento Materno — Técnica e Benefícios",
      "Introdução Alimentar",
      "Desnutrição e Obesidade Infantil",
      "Distúrbios Nutricionais Carenciais",
      "Apêndices",
    ],
  },
  {
    code: "PED3",
    subjectSlug: "pediatria",
    title: "Doenças Respiratórias na Infância",
    topics: [
      "Infecções de Vias Aéreas Superiores",
      "Bronquiolite Viral Aguda",
      "Pneumonias na Infância",
      "Asma na Criança",
      "Apêndices",
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

  // --- Preventiva e MFC (todos genéricos ENAMED — área nova) -----------
  {
    code: "MFC1",
    subjectSlug: "preventiva-mfc",
    title: "Atenção Primária à Saúde e SUS",
    topics: [
      "Princípios e Diretrizes do SUS",
      "Estratégia Saúde da Família",
      "Níveis de Atenção e Redes de Atenção à Saúde",
      "Determinantes Sociais da Saúde",
      "Apêndices",
    ],
  },
  {
    code: "MFC2",
    subjectSlug: "preventiva-mfc",
    title: "Epidemiologia e Indicadores de Saúde",
    topics: [
      "Medidas de Frequência e Associação",
      "Estudos Epidemiológicos",
      "Indicadores de Saúde e Mortalidade",
      "Vigilância Epidemiológica",
      "Apêndices",
    ],
  },
  {
    code: "MFC3",
    subjectSlug: "preventiva-mfc",
    title: "Imunização e Vigilância em Saúde",
    topics: [
      "Calendário Nacional de Vacinação",
      "Doenças de Notificação Compulsória",
      "Vigilância Sanitária e Ambiental",
      "Investigação de Surtos",
      "Apêndices",
    ],
  },
  {
    code: "MFC4",
    subjectSlug: "preventiva-mfc",
    title: "Saúde da Criança, do Idoso e Saúde Mental na APS",
    topics: [
      "Puericultura na Atenção Primária",
      "Saúde do Idoso e Fragilidade",
      "Saúde Mental na Atenção Primária",
      "Rastreamentos na APS",
      "Apêndices",
    ],
  },
  {
    code: "MFC5",
    subjectSlug: "preventiva-mfc",
    title: "Bioética e Ética Médica",
    topics: ["Princípios da Bioética", "Relação Médico-Paciente", "Sigilo Médico e Prontuário", "Ética em Pesquisa"],
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

  for (const courseModule of MODULES) {
    const subjectName = subjectNameFor(courseModule.subjectSlug);
    const summary = courseModule.topics.join(" · ");

    const videoFile = demoFile(`${courseModule.code}-video`, "videoaula");
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

    const materialFile = demoFile(`${courseModule.code}-material`, "apostila");
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
