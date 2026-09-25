import { NextRequest, NextResponse } from "next/server";
import { AI_MODELS, AI_UNAVAILABLE_MESSAGE, getAnthropicClient } from "@/lib/ai/anthropicClient";

/**
 * Geração de flashcards com IA (spec v2, seção 6.1).
 *
 * A plataforma não tem acesso ao texto de aulas/apostilas do Drive (v2 só
 * guarda o ID do arquivo e o link — sem OAuth, sem extração de conteúdo).
 * Por isso, "material de origem" aqui é uma ou mais questões do banco
 * (enunciado + alternativas + gabarito já são texto estruturado que já
 * temos): a IA lê o caso clínico e escreve cartões de recuperação ativa a
 * partir dele, em vez do template determinístico de
 * src/lib/flashcardStore.ts#generateFromQuestions.
 */

const MAX_QUESTIONS_PER_CALL = 15;

interface RequestQuestion {
  id: string;
  subjectName: string;
  tema?: string;
  enunciado: string;
  alternatives: { letter: string; text: string }[];
  gabarito: string;
}

interface GeneratedCard {
  questionId: string;
  frente: string;
  verso: string;
  tema: string;
}

function buildPrompt(questions: RequestQuestion[], quantidade: number) {
  const materiais = questions
    .map((q, i) => {
      const alternativasTexto = q.alternatives.map((a) => `${a.letter}) ${a.text}`).join("\n");
      const correta = q.alternatives.find((a) => a.letter === q.gabarito);
      return `### Questão ${i + 1} (id: ${q.id})\nDisciplina: ${q.subjectName}${q.tema ? ` — Tema: ${q.tema}` : ""}\nEnunciado: ${q.enunciado}\nAlternativas:\n${alternativasTexto}\nGabarito: ${q.gabarito}) ${correta?.text ?? ""}`;
    })
    .join("\n\n");

  return `Você é um tutor de medicina especializado em técnicas de recuperação ativa (active recall) para preparação de residência médica/revalida.

A partir dos materiais abaixo, gere no total ${quantidade} flashcards de pergunta/resposta seguindo estes princípios:
- Um conceito atômico por cartão (evite cartões que testem múltiplos fatos de uma vez).
- Evite reconhecimento simples ("qual a resposta certa da questão X?") — reformule como uma pergunta direta sobre o conceito clínico central (diagnóstico, conduta, mecanismo fisiopatológico, critério diagnóstico etc.).
- Priorize os pontos centrais de cada caso, não detalhes periféricos.
- A resposta (verso) deve ser curta e objetiva (1-3 frases).
- Distribua os cartões entre as questões fornecidas de forma equilibrada.

Materiais de origem:

${materiais}

Responda APENAS com um array JSON válido (sem markdown, sem texto antes ou depois), no formato exato:
[{"questionId": "<id da questão de origem>", "frente": "<pergunta>", "verso": "<resposta>", "tema": "<tema/conceito do cartão>"}]`;
}

function parseCards(text: string): GeneratedCard[] {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("[") ? trimmed : (trimmed.match(/\[[\s\S]*\]/)?.[0] ?? trimmed);
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error("Resposta da IA não é uma lista.");
  return parsed
    .filter((c) => c && typeof c.frente === "string" && typeof c.verso === "string")
    .map((c) => ({
      questionId: String(c.questionId ?? ""),
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

  let body: { questions?: RequestQuestion[]; quantidade?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const questions = Array.isArray(body.questions) ? body.questions : [];
  if (questions.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos uma questão como material de origem." }, { status: 400 });
  }
  const limitedQuestions = questions.slice(0, MAX_QUESTIONS_PER_CALL);
  const quantidade = Math.min(40, Math.max(1, body.quantidade ?? Math.min(20, limitedQuestions.length * 2)));

  try {
    const response = await client.messages.create({
      model: AI_MODELS.flashcards,
      max_tokens: 4096,
      messages: [{ role: "user", content: buildPrompt(limitedQuestions, quantidade) }],
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
