// ============================================================================
// Banco de questões de demonstração — exemplos didáticos simples, não
// constituem conteúdo médico oficial nem substituem bancas reais.
// ============================================================================

import { seededHash } from "./utils";
import { resolveSubject } from "./subjects";
import type { Question, QuestionAlternative } from "./types";

interface QuestionSeed {
  subjectSlug: string;
  tema: string;
  banca?: string;
  ano?: number;
  enunciado: string;
  alternatives: string[]; // na ordem A, B, C, D, E...
  gabaritoIndex: number; // 0-based
  comentario: string;
  dificuldade: number;
  tags: string[];
}

const SEEDS: QuestionSeed[] = [
  {
    subjectSlug: "cardiologia",
    tema: "Insuficiência Cardíaca",
    banca: "Exemplo",
    ano: 2023,
    enunciado:
      "Paciente com dispneia aos esforços, edema de membros inferiores e fração de ejeção reduzida ao ecocardiograma. Qual classe de fármacos reduz mortalidade nesse quadro?",
    alternatives: [
      "Inibidores da ECA",
      "Anti-inflamatórios não esteroidais",
      "Bloqueadores de canal de cálcio di-hidropiridínicos",
      "Antibióticos de amplo espectro",
    ],
    gabaritoIndex: 0,
    comentario:
      "Inibidores da ECA (e outros bloqueadores do SRAA) reduzem mortalidade na insuficiência cardíaca com fração de ejeção reduzida — parte da base do tratamento junto a betabloqueadores e antagonistas de mineralocorticoide.",
    dificuldade: 2,
    tags: ["IC", "farmacologia cardiovascular"],
  },
  {
    subjectSlug: "clinica-medica",
    tema: "Síndrome Ictérica",
    banca: "Exemplo",
    ano: 2022,
    enunciado:
      "Icterícia com predomínio de bilirrubina indireta, sem colúria, em paciente jovem hígido, que piora com jejum prolongado. Qual a hipótese mais provável?",
    alternatives: ["Síndrome de Gilbert", "Coledocolitíase", "Hepatite A aguda", "Colangite esclerosante primária"],
    gabaritoIndex: 0,
    comentario:
      "A Síndrome de Gilbert é uma condição benigna por deficiência parcial da glicuroniltransferase, cursando com hiperbilirrubinemia indireta leve que piora em jejum, estresse ou infecções, sem repercussão clínica significativa.",
    dificuldade: 2,
    tags: ["hepatologia"],
  },
  {
    subjectSlug: "cirurgia",
    tema: "Hemorragia Digestiva",
    banca: "Exemplo",
    ano: 2023,
    enunciado:
      "Paciente cirrótico dá entrada com hematêmese volumosa. Qual a principal causa a ser investigada de hemorragia digestiva alta nesse contexto?",
    alternatives: [
      "Varizes esofagogástricas por hipertensão porta",
      "Fissura anal",
      "Doença diverticular",
      "Angiodisplasia de cólon",
    ],
    gabaritoIndex: 0,
    comentario:
      "Em pacientes cirróticos, a hipertensão porta favorece a formação de varizes esofagogástricas, principal causa de hemorragia digestiva alta grave nesse grupo — a endoscopia digestiva alta é o exame inicial.",
    dificuldade: 2,
    tags: ["HDA", "hipertensão porta"],
  },
  {
    subjectSlug: "pediatria",
    tema: "Síndromes Exantemáticas",
    banca: "Exemplo",
    ano: 2021,
    enunciado:
      "Criança com febre alta por 3 dias que cessa abruptamente, seguida do surgimento de exantema maculopapular no tronco. Qual o diagnóstico mais provável?",
    alternatives: ["Exantema súbito (roséola)", "Sarampo", "Escarlatina", "Doença de Kawasaki"],
    gabaritoIndex: 0,
    comentario:
      "O exantema súbito (roséola infantum), causado pelo herpesvírus humano 6, é classicamente marcado por febre alta que cede abruptamente, seguida do exantema — diferente do sarampo, em que o exantema surge ainda com febre.",
    dificuldade: 2,
    tags: ["exantemáticas"],
  },
  {
    subjectSlug: "ginecologia-obstetricia",
    tema: "Amenorreia, SOP e Infertilidade",
    banca: "Exemplo",
    ano: 2022,
    enunciado:
      "Mulher com irregularidade menstrual, hirsutismo e resistência insulínica. Quais critérios (de pelo menos 2 de 3) confirmam Síndrome dos Ovários Policísticos pelos critérios de Rotterdam?",
    alternatives: [
      "Oligo/anovulação, hiperandrogenismo clínico/laboratorial e morfologia policística ao ultrassom",
      "Amenorreia primária isolada",
      "FSH elevado isolado",
      "Prolactina elevada isolada",
    ],
    gabaritoIndex: 0,
    comentario:
      "Os critérios de Rotterdam exigem pelo menos 2 de 3: oligo/anovulação, hiperandrogenismo (clínico ou laboratorial) e ovários policísticos ao ultrassom, após exclusão de outras causas.",
    dificuldade: 3,
    tags: ["SOP"],
  },
  {
    subjectSlug: "farmacologia",
    tema: "Farmacocinética",
    banca: "Exemplo",
    ano: 2023,
    enunciado: "O que representa a meia-vida de eliminação de um fármaco?",
    alternatives: [
      "O tempo necessário para a concentração plasmática do fármaco cair pela metade",
      "O tempo até o início do efeito terapêutico",
      "A fração do fármaco que chega inalterada à circulação sistêmica",
      "O volume de distribuição do fármaco no organismo",
    ],
    gabaritoIndex: 0,
    comentario:
      "Meia-vida de eliminação é o tempo necessário para a concentração plasmática cair à metade, parâmetro usado para estimar o intervalo entre doses e o tempo até o estado de equilíbrio (steady-state).",
    dificuldade: 1,
    tags: ["farmacocinética"],
  },
  {
    subjectSlug: "clinica-medica",
    tema: "Dispneia",
    banca: "Exemplo",
    ano: 2022,
    enunciado:
      "Paciente tabagista de longa data com dispneia progressiva, tosse produtiva crônica e VEF1/CVF reduzido na espirometria, sem resposta significativa ao broncodilatador. Diagnóstico mais provável?",
    alternatives: ["DPOC", "Asma brônquica", "Fibrose pulmonar idiopática", "Tromboembolismo pulmonar"],
    gabaritoIndex: 0,
    comentario:
      "A DPOC é definida por obstrução ao fluxo aéreo pouco reversível (relação VEF1/CVF reduzida pós-broncodilatador), em geral associada a tabagismo, com tosse produtiva crônica — diferente da asma, que tem maior reversibilidade.",
    dificuldade: 2,
    tags: ["pneumologia"],
  },
  {
    subjectSlug: "pediatria",
    tema: "Neonatologia",
    banca: "Exemplo",
    ano: 2021,
    enunciado:
      "Recém-nascido pré-termo desenvolve desconforto respiratório logo após o nascimento, com radiografia de tórax mostrando padrão reticulogranular difuso ('vidro moído'). Qual a hipótese mais provável?",
    alternatives: [
      "Síndrome do desconforto respiratório (doença da membrana hialina)",
      "Taquipneia transitória do recém-nascido",
      "Síndrome de aspiração meconial",
      "Pneumonia neonatal tardia",
    ],
    gabaritoIndex: 0,
    comentario:
      "A doença da membrana hialina decorre da deficiência de surfactante, típica de prematuros, com padrão radiológico reticulogranular difuso ('vidro moído') — o uso de corticoide antenatal reduz sua incidência.",
    dificuldade: 3,
    tags: ["neonatologia"],
  },
];

function buildAlternatives(texts: string[]): QuestionAlternative[] {
  const letters = ["A", "B", "C", "D", "E"] as const;
  return texts.map((text, idx) => ({ letter: letters[idx], text }));
}

export const DEMO_QUESTIONS: Question[] = SEEDS.map((seed, idx) => {
  const subject = resolveSubject(seed.subjectSlug);
  const alternatives = buildAlternatives(seed.alternatives);
  return {
    id: `demo-q-${seededHash(`${seed.subjectSlug}-${idx}`)}`,
    subjectSlug: subject.slug,
    subjectName: subject.name,
    tema: seed.tema,
    banca: seed.banca,
    ano: seed.ano,
    enunciado: seed.enunciado,
    alternatives,
    gabarito: alternatives[seed.gabaritoIndex].letter,
    comentario: seed.comentario,
    dificuldade: seed.dificuldade,
    tags: seed.tags,
    hasImage: false,
  };
});
