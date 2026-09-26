import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================================
// Cliente Anthropic — exclusivamente server-side (rotas /api/ai/*).
//
// ANTHROPIC_API_KEY é opcional: sem ela, os recursos de IA (seção 6 do spec)
// ficam indisponíveis e a interface degrada com uma mensagem clara — o
// cronograma determinístico (src/lib/studyPlan.ts) e a geração de flashcards
// a partir do banco de questões continuam funcionando normalmente, sem IA.
// ============================================================================

export const AI_MODELS = {
  /** Geração de flashcards — operação repetida, custo baixo por chamada. */
  flashcards: "claude-haiku-4-5-20251001",
  /** Cronograma adaptativo — chamada pouco frequente, raciocínio mais robusto. */
  cronograma: "claude-sonnet-5",
  /** Quizzes (questões de múltipla escolha geradas em tempo real) — precisa de
   * raciocínio clínico consistente para gabarito/comentário corretos. */
  quiz: "claude-sonnet-5",
} as const;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Retorna `null` (em vez de lançar) quando a chave não está configurada, para que as rotas degradem com uma resposta 501 clara em vez de derrubar o build/deploy. */
export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

export const AI_UNAVAILABLE_MESSAGE =
  "Recursos de IA indisponíveis: configure a variável de ambiente ANTHROPIC_API_KEY na Vercel para habilitar os Quizzes com IA, a geração de flashcards e o cronograma adaptativo com IA. O restante da plataforma funciona normalmente sem ela.";
