"use client";

import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Check, Download, Layers, Plus, RotateCw, Trash2, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { downloadAnkiExport } from "@/lib/ankiExport";
import { useFlashcardStore } from "@/lib/flashcardStore";
import { useFlashcardProgressStore, getDueCards } from "@/lib/flashcardProgressStore";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "revisar", label: "Revisar" },
  { id: "cartoes", label: "Cartões" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function DeckPage({ params }: { params: { deckId: string } }) {
  const router = useRouter();
  const decks = useFlashcardStore((s) => s.decks);
  const cards = useFlashcardStore((s) => s.cards);
  const addCard = useFlashcardStore((s) => s.addCard);
  const deleteCard = useFlashcardStore((s) => s.deleteCard);
  const deleteDeck = useFlashcardStore((s) => s.deleteDeck);
  const progressMap = useFlashcardProgressStore((s) => s.progress);
  const reviewCard = useFlashcardProgressStore((s) => s.reviewCard);

  const deck = decks.find((d) => d.id === params.deckId);
  if (!deck) notFound();

  const deckCards = cards.filter((c) => c.deckId === deck.id);
  const [tab, setTab] = useState<TabId>("revisar");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
            <Layers size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{deck.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-metric">{deckCards.length} cartões</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-outline btn-sm"
            disabled={deckCards.length === 0}
            onClick={() => downloadAnkiExport(deckCards, deck.name)}
          >
            <Download size={14} /> Exportar para Anki
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border/60" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "revisar" && <ReviewRunner deckCards={deckCards} progressMap={progressMap} onReview={reviewCard} />}

      {tab === "cartoes" && (
        <CardsManager
          deckId={deck.id}
          cards={deckCards}
          onAdd={addCard}
          onDelete={deleteCard}
          onDeleteDeck={() => {
            deleteDeck(deck.id);
            router.push("/flashcards");
          }}
        />
      )}

      <Link href="/flashcards" className="text-sm font-medium text-primary self-start">
        ← Voltar para Flashcards
      </Link>
    </div>
  );
}

function ReviewRunner({
  deckCards,
  progressMap,
  onReview,
}: {
  deckCards: ReturnType<typeof useFlashcardStore.getState>["cards"];
  progressMap: ReturnType<typeof useFlashcardProgressStore.getState>["progress"];
  onReview: (cardId: string, remembered: boolean) => void;
}) {
  const due = getDueCards(deckCards, progressMap);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(0);

  if (deckCards.length === 0) {
    return <EmptyState icon={Layers} title="Este deck ainda não tem cartões." description="Adicione cartões na aba Cartões." />;
  }

  if (due.length === 0 || index >= due.length) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
          <Check size={26} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          {sessionDone > 0 ? "Revisão concluída por hoje!" : "Nenhum cartão devido para revisão hoje."}
        </h2>
        {sessionDone > 0 && <p className="text-sm text-muted-foreground font-metric">{sessionDone} cartões revisados.</p>}
      </div>
    );
  }

  const card = due[index];

  function handleAnswer(remembered: boolean) {
    onReview(card.id, remembered);
    setSessionDone((n) => n + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-5">
      <p className="text-sm text-muted-foreground text-center font-metric">
        {index + 1} de {due.length}
      </p>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="card p-10 min-h-[220px] flex items-center justify-center text-center hover:bg-surface-hover transition-colors"
      >
        <p className="text-lg text-foreground whitespace-pre-line">{flipped ? card.back : card.front}</p>
      </button>

      {!flipped ? (
        <button type="button" className="btn-outline self-center" onClick={() => setFlipped(true)}>
          <RotateCw size={14} /> Virar cartão
        </button>
      ) : (
        <div className="flex justify-center gap-3">
          <button type="button" className="btn bg-danger text-white hover:opacity-90" onClick={() => handleAnswer(false)}>
            <X size={15} /> Não lembrei
          </button>
          <button type="button" className="btn bg-success text-success-foreground hover:opacity-90" onClick={() => handleAnswer(true)}>
            <Check size={15} /> Lembrei
          </button>
        </div>
      )}
    </div>
  );
}

function CardsManager({
  deckId,
  cards,
  onAdd,
  onDelete,
  onDeleteDeck,
}: {
  deckId: string;
  cards: ReturnType<typeof useFlashcardStore.getState>["cards"];
  onAdd: (deckId: string, front: string, back: string) => void;
  onDelete: (cardId: string) => void;
  onDeleteDeck: () => void;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  function handleAdd() {
    if (!front.trim() || !back.trim()) return;
    onAdd(deckId, front.trim(), back.trim());
    setFront("");
    setBack("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Adicionar cartão</h2>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          placeholder="Frente (pergunta)"
          rows={2}
          className="input"
        />
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Verso (resposta)"
          rows={2}
          className="input"
        />
        <button type="button" className="btn-primary self-start" onClick={handleAdd} disabled={!front.trim() || !back.trim()}>
          <Plus size={15} /> Adicionar
        </button>
      </div>

      {cards.length === 0 ? (
        <EmptyState icon={Layers} title="Nenhum cartão neste deck ainda." />
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map((card) => (
            <div key={card.id} className="card p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-2">{card.front}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{card.back}</p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(card.id)}
                aria-label="Excluir cartão"
                className="text-muted-foreground hover:text-danger shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={onDeleteDeck} className="btn-outline text-danger border-danger/30 hover:bg-danger/5 self-start">
        <Trash2 size={14} /> Excluir deck
      </button>
    </div>
  );
}
