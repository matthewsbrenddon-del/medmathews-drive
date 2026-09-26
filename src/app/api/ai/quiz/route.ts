import { NextRequest, NextResponse } from "next/server";
import { AI_MODELS, AI_UNAVAILABLE_MESSAGE, getAnthropicClient } from "@/lib/ai/anthropicClient";

/**
 * Quizzes (spec adendo): geração de questões de múltipla escolha em tempo
 * real, a partir de um prompt livre e, opcionalmente, um texto de material
 * de referência colado pelo usuário (a plataforma não extrai texto de
 * PDFs/vídeos do Drive — ver a mesma limitação em /api/ai/flashcards).
 */

const MAX_QUESTIONS_PER_CALL = 20;
const MAX_MATERIAL_CHARS = 12000;

interface GeneratedQuestion {
  enunciado: string;
  alternatives: { letter: string; text: string }[];
  gabarito: string;
  comentario: string;
  tema: string;
}

function buildPrompt(params: { prompt: string; materialText?: string; quantidade: number }) {
  const { prompt, materialText, quantidade } = params;

  const materialBlock = materialText
    ? `\n\nMaterial de referência fornecido pelo usuário (use como base factual — não invente informações que o contradigam):\n"""\n${materialText.slice(0, MAX_MATERIAL_CHARS)}\n"""`
    : "";

  return `Você é um elaborador de questões de residência médica/revalida, no estilo de provas brasileiras (casos clínicos objetivos, uma alternativa correta).

Tema/instrução do usuário: "${prompt}"${materialBlock}

Gere ${quantidade} questões de múltipla escolha originais sobre esse tema, seguindo estas regras:
- Enunciado em formato de caso clínico quando fizer sentido clinicamente (idade, sexo, história, exame físico, exames complementares), objetivo e sem ambiguidade.
- Exatamente 4 ou 5 alternativas (letras A, B, C, D e opcionalmente E), plausíveis e mutuamente exclusivas — apenas uma correta.
- "gabarito" é a letra da alternativa correta.
- "comentario" explica de forma didática por que a alternativa correta está certa e por que as principais distratoras estão erradas (2-4 frases).
- "tema" é um rótulo curto do assunto específico da questão (ex.: "Insuficiência Cardíaca Descompensada").
- Não repita o mesmo caso clínico em questões diferentes.

Responda APENAS com um array JSON válido (sem markdown, sem texto antes ou depois), no formato exato:
[{"enunciado": "...", "alternatives": [{"letter": "A", "text": "..."}, ...], "gabarito": "B", "comentario": "...", "tema": "..."}]`;
}

function parseQuestions(text: string): GeneratedQuestion[] {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("[") ? trimmed : (trimmed.match(/\[[\s\S]*\]/)?.[0] ?? trimmed);
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error("Resposta da IA não é uma lista.");

  const questions: GeneratedQuestion[] = [];
  for (const item of parsed) {
    if (!item || typeof item.enunciado !== "string" || !Array.isArray(item.alternatives)) continue;
    const alternatives = item.alternatives
      .filter((a: unknown): a is { letter: string; text: string } => Boolean(a) && typeof a === "object" && typeof (a as { text?: unknown }).text === "string")
      .map((a: { letter: string; text: string }) => ({ letter: String(a.letter).trim().toUpperCase(), text: String(a.text).trim() }));
    const gabarito = typeof item.gabarito === "string" ? item.gabarito.trim().toUpperCase() : "";
    if (alternatives.length < 2 || !gabarito || !alternatives.some((a: { letter: string }) => a.letter === gabarito)) continue;
    questions.push({
      enunciado: item.enunciado.trim(),
      alternatives,
      gabarito,
      comentario: typeof item.comentario === "string" ? item.comentario.trim() : "",
      tema: typeof item.tema === "string" ? item.tema.trim() : "",
    });
  }
  return questions;
}

export async function POST(req: NextRequest) {
  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 501 });
  }

  let body: { prompt?: string; materialText?: string; quantidade?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Descreva o tema/instrução para gerar as questões." }, { status: 400 });
  }
  const quantidade = Math.min(MAX_QUESTIONS_PER_CALL, Math.max(1, body.quantidade ?? 5));

  try {
    const response = await client.messages.create({
      model: AI_MODELS.quiz,
      max_tokens: 8192,
      messages: [{ role: "user", content: buildPrompt({ prompt, materialText: body.materialText, quantidade }) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "A IA não retornou texto." }, { status: 502 });
    }

    const questions = parseQuestions(textBlock.text);
    if (questions.length === 0) {
      return NextResponse.json({ error: "A IA não retornou nenhuma questão válida. Tente reformular o tema." }, { status: 502 });
    }

    return NextResponse.json({ questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao gerar questões com IA.";
    return NextResponse.json({ error: `Não foi possível gerar as questões agora (${message}). Tente novamente em instantes.` }, { status: 502 });
  }
}
