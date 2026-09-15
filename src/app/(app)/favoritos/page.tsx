"use client";

import { Star } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { MaterialCard } from "@/components/MaterialCard";
import { VideoCard } from "@/components/VideoCard";
import { useContent } from "@/lib/content";
import { useStudyStore } from "@/lib/store";

export default function FavoritosPage() {
  const content = useContent();
  const userStates = useStudyStore((s) => s.userStates);

  const favorites = content.filter((c) => userStates[c.fileId]?.favorite);
  const videos = favorites.filter((c) => c.kind === "videoaula");
  const apostilas = favorites.filter((c) => c.kind === "apostila");
  const outros = favorites.filter((c) => c.kind === "outro");

  return (
    <div className="flex flex-col gap-9">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Meus favoritos</h1>
        <p className="text-muted-foreground mt-1">Videoaulas e materiais que você marcou para acessar rapidamente.</p>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Você ainda não adicionou favoritos."
          description="Toque no ícone de estrela em qualquer aula ou material para encontrá-lo aqui depois."
        />
      ) : (
        <>
          {videos.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4">Videoaulas</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {videos.map((item) => (
                  <VideoCard key={item.fileId} content={item} state={userStates[item.fileId]} />
                ))}
              </div>
            </section>
          )}

          {apostilas.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4">Apostilas</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {apostilas.map((item) => (
                  <MaterialCard key={item.fileId} content={item} state={userStates[item.fileId]} />
                ))}
              </div>
            </section>
          )}

          {outros.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4">Outros</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {outros.map((item) => (
                  <MaterialCard key={item.fileId} content={item} state={userStates[item.fileId]} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
