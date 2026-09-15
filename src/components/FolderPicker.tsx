"use client";

import { Check, Folder, FolderOpen } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MockFolder {
  id: string;
  name: string;
  itemCount: string;
}

const DEMO_FOLDERS: MockFolder[] = [
  { id: "medicina", name: "MEDICINA", itemCount: "16 subpastas" },
  { id: "pessoal", name: "Documentos Pessoais", itemCount: "8 itens" },
  { id: "residencia", name: "Prep. Residência", itemCount: "42 itens" },
  { id: "artigos", name: "Artigos Científicos", itemCount: "23 itens" },
];

export function FolderPicker({
  onSelect,
}: {
  onSelect: (folder: { id: string; name: string }) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="w-full">
      <div className="space-y-2">
        {DEMO_FOLDERS.map((folder) => {
          const selected = selectedId === folder.id;
          return (
            <button
              type="button"
              key={folder.id}
              onClick={() => setSelectedId(folder.id)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors",
                selected ? "border-primary bg-primary-light" : "border-border bg-surface hover:bg-surface-hover"
              )}
            >
              {selected ? (
                <FolderOpen size={20} className="text-primary shrink-0" />
              ) : (
                <Folder size={20} className="text-muted-foreground shrink-0" />
              )}
              <span className="flex-1 min-w-0">
                <span className={cn("block font-medium text-sm", selected ? "text-primary" : "text-foreground")}>
                  {folder.name}
                </span>
                <span className="block text-xs text-muted-foreground">{folder.itemCount}</span>
              </span>
              {selected && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0">
                  <Check size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!selectedId}
        onClick={() => {
          const folder = DEMO_FOLDERS.find((f) => f.id === selectedId);
          if (folder) onSelect(folder);
        }}
        className="btn-primary w-full mt-5"
      >
        Confirmar pasta selecionada
      </button>
    </div>
  );
}
