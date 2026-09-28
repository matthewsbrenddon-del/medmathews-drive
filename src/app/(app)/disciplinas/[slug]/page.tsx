import { redirect } from "next/navigation";

// Disciplinas é uma biblioteca só (duas visões sobre o acervo real) — a antiga
// página por disciplina, que mostrava o conteúdo de exemplo, agora abre a
// mesma árvore já posicionada na grande área.
export default function DisciplinaSlugRedirect({ params }: { params: { slug: string } }) {
  redirect(`/disciplinas?area=${encodeURIComponent(params.slug)}`);
}
