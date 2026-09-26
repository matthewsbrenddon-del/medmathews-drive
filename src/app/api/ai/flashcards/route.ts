import { NextRequest, NextResponse } from "next/server";
import { AI_MODELS, AI_UNAVAILABLE_MESSAGE, getAnthropicClient } from "@/lib/ai/anthropicClient";

/**
 * Geração de flashcards com IA (spec v2, seção 6.1 + adendo Práticas).
 *
 * Duas fontes de material aceitas:
 * - Questões do banco selecionadas pelo usuário (modo original — a
 *   plataforma não extrai texto de PDFs/vídeos do Drive, então o texto
 *   estruturado que já temos é o enunciado/alternativas/gabarito).
 * - Um tema livre e/ou um texto de referência colado pelo usuário (modo
 *   Práticas) — a IA escreve os cartões diretamente a partir disso.
 */

const MAX_QUESTIONS_PER_CALL = 15;
const MAX_MATERIAL_CHARS = 12000;

interface RequestQuestion {
  id: string;
  subjectName: string;
  tema?: string;
  enunciado: string;
  alternatives: { letter: string; text: string }[];
  gabarito: string;
}

interface GeneratedCard {
  questionId?: string;
  frente: string;
  verso: string;
  tema: string;
}

const PRINCIPIOS = `- Um conceito atômico por cartão (evite cartões que testem múltiplos fatos de uma vez).
- Evite reconhecimento simples — reformule como uma pergunta direta sobre o conceito central (diagnóstico, conduta, mecanismo fisiopatológico, critério diagnóstico etc.).
- Priorize os pontos centrais do material, não detalhes periféricos.
- A resposta (verso) deve ser curta e objetiva (1-3 frases).`;

function buildPromptFromQuestions(questions: RequestQuestion[], quantidade: number) {
  const materiais = questions
    .map((q, i) => {
      const alternativasTexto = q.alternatives.map((a) => `${a.letter}) ${a.text}`).join("\n");
      const correta = q.alternatives.find((a) => a.letter === q.gabarito);
      return `### Questão ${i + 1} (id: ${q.id})\nDisciplina: ${q.subjectName}${q.tema ? ` — Tema: ${q.tema}` : ""}\nEnunciado: ${q.enunciado}\nAlternativas:\n${alternativasTexto}\nGabarito: ${q.gabarito}) ${correta?.text ?? ""}`;
    })
    .join("\n\n");

  return `Você é um tutor de medicina especializado em técnicas de recuperação ativa (active recall) para preparação de residência médica/revalida.

A partir dos materiais abaixo, gere no total ${quantidade} flashcards de pergunta/resposta seguindo estes princípios:
${PRINCIPIOS}
- Distribua os cartões entre as questões fornecidas de forma equilibrada.

Materiais de origem:

${materiais}

Responda APENAS com um array JSON válido (sem markdown, sem texto antes ou depois), no formato exato:
[{"questionId": "<id da questão de origem>", "frente": "<pergunta>", "verso": "<resposta>", "tema": "<tema/conceito do cartão>"}]`;
}

function buildPromptFromTopic(topic: string, materialText: string | undefined, quantidade: number) {
  const materialBlock = materialText
    ? `\n\nMaterial de referência fornecido pelo usuário (use como base factual):\n"""\n${materialText.slice(0, MAX_MATERIAL_CHARS)}\n"""`
    : "";

  return `Você é um tutor de medicina especializado em técnicas de recuperação ativa (active recall) para preparação de residência médica/revalida.

Tema: "${topic}"${materialBlock}

Gere ${quantidade} flashcards de pergunta/resposta sobre esse tema, seguindo estes princípios:
${PRINCIPIOS}

Responda APENAS com um array JSON válido (sem markdown, sem texto antes ou depois), no formato exato:
[{"frente": "<pergunta>", "verso": "<resposta>", "tema": "<tema/conceito do cartão>"}]`;
}

function parseCards(text: string): GeneratedCard[] {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("[") ? trimmed : (trimmed.match(/\[[\s\S]*\]/)?.[0] ?? trimmed);
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error("Resposta da IA não é uma lista.");
  return parsed
    .filter((c) => c && typeof c.frente === "string" && typeof c.verso === "string")
    .map((c) => ({
      questionId: c.questionId ? String(c.questionId) : undefined,
      frente: String(c.frente).trim(),
      verso: String(c.verso).trim(),
      tema: typeof c.tema === "string" ? c.tema.trim() : "",
    }));
}

export async function POST(req: NextRequest) {
  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 501 });
  }

  let body: { questions?: RequestQuestion[]; quantidade?: number; topic?: string; materialText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const questions = Array.isArray(body.questions) ? body.questions : [];
  const topic = body.topic?.trim();

  if (questions.length === 0 && !topic) {
    return NextResponse.json({ error: "Selecione questões como material de origem ou descreva um tema." }, { status: 400 });
  }

  let promptText: string;
  let quantidade: number;
  if (questions.length > 0) {
    const limitedQuestions = questions.slice(0, MAX_QUESTIONS_PER_CALL);
    quantidade = Math.min(40, Math.max(1, body.quantidade ?? Math.min(20, limitedQuestions.length * 2)));
    promptText = buildPromptFromQuestions(limitedQuestions, quantidade);
  } else {
    quantidade = Math.min(40, Math.max(1, body.quantidade ?? 15));
    promptText = buildPromptFromTopic(topic!, body.materialText?.trim(), quantidade);
  }

  try {
    const response = await client.messages.create({
      model: AI_MODELS.flashcards,
      max_tokens: 4096,
      messages: [{ role: "user", content: promptText }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "A IA não retornou texto." }, { status: 502 });
    }

    const cards = parseCards(textBlock.text);
    if (cards.length === 0) {
      return NextResponse.json({ error: "A IA não retornou nenhum cartão válido." }, { status: 502 });
    }

    return NextResponse.json({ cards });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao gerar flashcards com IA.";
    return NextResponse.json({ error: `Não foi possível gerar os flashcards agora (${message}). Tente novamente em instantes.` }, { status: 502 });
  }
}
