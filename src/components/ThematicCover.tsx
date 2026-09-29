"use client";

import { useState } from "react";
import { SubjectIcon } from "./SubjectIcon";
import { fileKind, fileName, fileThumbnailUrl, fileTitle } from "@/lib/library";
import { resolveSubject } from "@/lib/subjects";
import type { LibraryFile } from "@/lib/types";
import type { ClassifiedFile } from "@/lib/classification";
import { cn, seededHash } from "@/lib/utils";

/** Motivo gráfico de fundo por grande área (traços finos, só decorativos). */
function Motif({ slug, color }: { slug?: string; color: string }) {
  const stroke = `hsl(${color} / 0.55)`;
  if (slug === "clinica-medica")
    return (
      <polyline
        points="0,62 60,62 72,62 80,40 88,84 98,20 108,90 116,62 170,62 182,62 190,48 198,72 206,62 320,62"
        fill="none"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    );
  if (slug === "cirurgia-geral")
    return (
      <g stroke={stroke} strokeWidth="2" fill="none">
        <path d="M20 80 C 80 20, 160 20, 300 70" />
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={i} x1={40 + i * 30} y1={52 + Math.abs(4 - i) * 3} x2={50 + i * 30} y2={70 + Math.abs(4 - i) * 3} />
        ))}
      </g>
    );
  if (slug === "ginecologia-obstetricia")
    return (
      <g stroke={stroke} strokeWidth="2" fill="none">
        <circle cx="120" cy="60" r="34" />
        <circle cx="120" cy="60" r="18" />
        <path d="M0 100 Q 80 70 160 100 T 320 100" />
      </g>
    );
  if (slug === "pediatria")
    return (
      <g stroke={stroke} strokeWidth="2" fill="none">
        <rect x="40" y="50" width="34" height="34" rx="6" />
        <rect x="80" y="36" width="34" height="48" rx="6" />
        <circle cx="160" cy="62" r="22" />
        <path d="M200 84 l 20 -40 l 20 40 z" />
      </g>
    );
  if (slug === "preventiva-mfc")
    return (
      <g stroke={stroke} strokeWidth="2" fill="none">
        {Array.from({ length: 6 }).map((_, i) => (
          <circle key={i} cx={40 + i * 44} cy={60 + (i % 2 ? -14 : 14)} r="9" />
        ))}
        <polyline points="40,74 84,46 128,74 172,46 216,74 260,46" />
      </g>
    );
  return (
    <g stroke={stroke} strokeWidth="1.5" fill="none">
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={i} x1={i * 50} y1="0" x2={i * 50 - 60} y2="120" />
      ))}
    </g>
  );
}

/**
 * Capa temática de uma aula: gradiente e motivo da grande área, ícone, número
 * da aula e — quando o Drive fornece — a miniatura real por cima.
 */
export function ThematicCover({
  file,
  className,
  showThumbnail = true,
  large = false,
}: {
  file: LibraryFile | ClassifiedFile;
  className?: string;
  showThumbnail?: boolean;
  large?: boolean;
}) {
  const [thumbOk, setThumbOk] = useState<boolean | null>(null);
  const classified = file as ClassifiedFile;
  const subject = classified.subjectSlug ? resolveSubject(classified.subjectSlug) : undefined;
  const color = subject?.colorToken ?? `${seededHash(file.curso) % 360} 55% 50%`;
  const name = fileName(file).replace(/\.[a-z0-9]+$/i, "");
  const number = name.match(/^(\d{1,3})\b/)?.[1] ?? name.match(/\bA(\d{1,2})\b/)?.[1];
  const isVideo = fileKind(file) === "video";

  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 90% at 85% 10%, hsl(${color} / 0.55), transparent 60%), linear-gradient(135deg, hsl(${color} / 0.35), hsl(220 20% 8%) 75%)`,
      }}
    >
      <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <Motif slug={subject?.slug} color={color} />
      </svg>
      <div className="absolute -right-4 -bottom-6 opacity-20" style={{ color: `hsl(${color})` }} aria-hidden>
        <SubjectIcon name={subject?.icon ?? "BookOpen"} size={large ? 180 : 96} />
      </div>
      <div className={cn("absolute inset-0 flex flex-col justify-between", large ? "p-6" : "p-3")}>
        <span
          className={cn(
            "self-start rounded-full bg-black/35 text-white/90 font-medium backdrop-blur-sm truncate max-w-full",
            large ? "text-xs px-3 py-1" : "text-[10px] px-2 py-0.5"
          )}
        >
          {subject?.name ?? file.curso}
          {classified.disciplina ? ` · ${classified.disciplina}` : ""}
        </span>
        <div className="flex items-end gap-3 min-w-0">
          {number && (
            <span className={cn("font-metric font-bold text-white/90 leading-none drop-shadow", large ? "text-6xl" : "text-3xl")}>
              {number.padStart(2, "0")}
            </span>
          )}
          {large && name !== number && (
            <span className="text-white font-semibold text-lg leading-snug line-clamp-2 drop-shadow">{fileTitle(file)}</span>
          )}
        </div>
      </div>
      {showThumbnail && isVideo && thumbOk !== false && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileThumbnailUrl(file, large ? 1000 : 400)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setThumbOk(true)}
          onError={() => setThumbOk(false)}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity", thumbOk ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}
