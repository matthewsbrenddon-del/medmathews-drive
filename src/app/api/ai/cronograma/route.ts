import { NextRequest, NextResponse } from "next/server";
import { AI_MODELS, AI_UNAVAILABLE_MESSAGE, getAnthropicClient } from "@/lib/ai/anthropicClient";

/**
 * Cronograma adaptativo com IA (spec v2, seção 6.2) — chamado explicitamente
 * pelo botão "Recalcular com IA", nunca automático. O algoritmo
 * determinístico de src/lib/studyPlan.ts continua sendo o padrão e o
 * fallback; esta rota só reordena/redistribui os MESMOS itens pendentes que
 * o cliente já calculou, acrescentando uma justificativa curta para os
 * itens de alta prioridade.
 */

interface PendingItem {
  key: string;
  title: string;
  subjectName: string;
  estimatedMinutes: number;
  priority: number;
}

interface TemaDesempenho {
  tema: string;
  subjectName: string;
  accuracyPercent: number;
}

interface PlannedItem {
  key: string;
  titulo: string;
  duracaoMin: number;
  justificativa?: string;
}

interface PlannedDay {
  data: string;
  itens: PlannedItem[];
}

function buildPrompt(params: {
  itensPendentes: PendingItem[];
  desempenhoPorTema: TemaDesempenho[];
  dataAlvo: string;
  disponibilidadeDiaria: number;
  itensConcluidos: number;
  hoje: string;
}) {
  const { itensPendentes, desempenhoPorTema, dataAlvo, disponibilidadeDiaria, itensConcluidos, hoje } = params;

  const itensTexto = itensPendentes
    .map((i) => `- key: "${i.key}" | ${i.title} | disciplina: ${i.subjectName} | ${i.estimatedMinutes} min | prioridade ${i.priority}/5`)
    .join("\n");

  const desempenhoTexto =
    desempenhoPorTema.length > 0
      ? desempenhoPorTema.map((d) => `- ${d.tema} (${d.subjectName}): ${d.accuracyPercent}% de acerto`).join("\n")
      : "(sem histórico de questões respondidas ainda)";

  return `Você é um planejador de estudos para residência médica/revalida. Distribua os itens pendentes abaixo entre os dias disponíveis (de ${hoje} até ${dataAlvo}), respeitando um limite diário de ${disponibilidadeDiaria} minutos por dia.

Itens já concluídos (não incluir no plano): ${itensConcluidos}

Itens pendentes:
${itensTexto}

Desempenho do usuário no banco de questões, por tema:
${desempenhoTexto}

Regras:
- Priorize itens de prioridade mais alta e temas com pior desempenho (% de acerto mais baixo).
- Não exceda ${disponibilidadeDiaria} minutos por dia.
- Cada item pendente deve aparecer em exatamente um dia (ou ficar de fora se não houver espaço até a data-alvo).
- Para itens de alta prioridade (4 ou 5) ou ligados a um tema com desempenho abaixo de 60%, inclua uma "justificativa" curta (uma frase, ex.: "Priorizado — desempenho em Farmacologia está em 42%, abaixo da média").
- Use exatamente as "key" fornecidas para identificar cada item — não invente novas.

Responda APENAS com um array JSON válido (sem markdown, sem texto antes ou depois), no formato exato:
[{"data": "AAAA-MM-DD", "itens": [{"key": "<key do item>", "titulo": "<título>", "duracaoMin": <número>, "justificativa": "<opcional>"}]}]`;
}

function parsePlan(text: string): PlannedDay[] {
  const trimmed = text.trim();
  const jsonText = trimmed.startsWith("[") ? trimmed : (trimmed.match(/\[[\s\S]*\]/)?.[0] ?? trimmed);
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error("Resposta da IA não é uma lista.");
  return parsed
    .filter((d) => d && typeof d.data === "string" && Array.isArray(d.itens))
    .map((d) => ({
      data: d.data,
      itens: d.itens
        .filter((i: unknown): i is Record<string, unknown> => Boolean(i) && typeof i === "object")
        .map((i: Record<string, unknown>) => ({
          key: String(i.key ?? ""),
          titulo: String(i.titulo ?? ""),
          duracaoMin: Number(i.duracaoMin) || 0,
          justificativa: typeof i.justificativa === "string" ? i.justificativa : undefined,
        })),
    }));
}

export async function POST(req: NextRequest) {
  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 501 });
  }

  let body: {
    itensPendentes?: PendingItem[];
    desempenhoPorTema?: TemaDesempenho[];
    dataAlvo?: string;
    disponibilidadeDiaria?: number;
    itensConcluidos?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const itensPendentes = Array.isArray(body.itensPendentes) ? body.itensPendentes : [];
  const dataAlvo = body.dataAlvo;
  const disponibilidadeDiaria = body.disponibilidadeDiaria;
  if (itensPendentes.length === 0 || !dataAlvo || !disponibilidadeDiaria) {
    return NextResponse.json({ error: "Dados insuficientes para recalcular o cronograma com IA." }, { status: 400 });
  }

  const hoje = new Date().toISOString().slice(0, 10);

  try {
    const response = await client.messages.create({
      model: AI_MODELS.cronograma,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: buildPrompt({
            itensPendentes: itensPendentes.slice(0, 200),
            desempenhoPorTema: Array.isArray(body.desempenhoPorTema) ? body.desempenhoPorTema : [],
            dataAlvo,
            disponibilidadeDiaria,
            itensConcluidos: body.itensConcluidos ?? 0,
            hoje,
          }),
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "A IA não retornou texto." }, { status: 502 });
    }

    const dias = parsePlan(textBlock.text);
    if (dias.length === 0) {
      return NextResponse.json({ error: "A IA não retornou um plano válido." }, { status: 502 });
    }

    return NextResponse.json({ dias });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao recalcular o cronograma com IA.";
    return NextResponse.json({ error: `Não foi possível recalcular com IA agora (${message}). O cronograma padrão continua disponível.` }, { status: 502 });
  }
}
