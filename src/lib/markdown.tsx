import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { CornerDownLeft } from "lucide-react";

// ============================================================================
// Markdown leve para o Caderno — renderizado direto para elementos React
// (nunca innerHTML), então nada que o usuário digite vira HTML/script.
// Suporta: # títulos, **negrito**, *itálico*, ==grifo==, `código`, listas
// (-, 1.), checklists (- [ ] / - [x]), citações (>), separador (---) e links.
// Links `origem:<tipo>:<id>` viram um badge clicável de volta ao contexto.
// ============================================================================

export function originHref(tipo: string, id: string): string | null {
  if (tipo === "questao") return `/questoes/estudo?start=${encodeURIComponent(id)}`;
  if (tipo === "aula" || tipo === "material") return `/disciplinas?abrir=${encodeURIComponent(id)}`;
  return null;
}

const INLINE = /(\*\*[^*]+\*\*|==[^=]+==|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("**")) {
      out.push(<strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith("==")) {
      out.push(
        <mark key={key} className="rounded px-0.5 bg-[#fde047] text-[#1c1917]">
          {token.slice(2, -2)}
        </mark>
      );
    } else if (token.startsWith("`")) {
      out.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const m = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const label = m?.[1] ?? token;
      const href = m?.[2] ?? "";
      if (href.startsWith("origem:")) {
        const [, tipo, ...rest] = href.split(":");
        const target = originHref(tipo, rest.join(":"));
        const badge = (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent text-[11px] font-medium px-2 py-0.5 align-middle">
            <CornerDownLeft size={10} /> {label}
          </span>
        );
        out.push(
          target ? (
            <Link key={key} href={target} className="hover:opacity-80 no-underline">
              {badge}
            </Link>
          ) : (
            <Fragment key={key}>{badge}</Fragment>
          )
        );
      } else if (/^https?:\/\//.test(href)) {
        out.push(
          <a key={key} href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
            {label}
          </a>
        );
      } else {
        out.push(label);
      }
    } else {
      out.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: { text: string; check?: boolean }[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "hr" };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    const lastBlock = blocks[blocks.length - 1];
    if (!line.trim()) {
      blocks.push({ type: "p", lines: [] });
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      continue;
    }
    const check = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (check || bullet) {
      const item = check ? { text: check[2], check: check[1].toLowerCase() === "x" } : { text: bullet![1] };
      if (lastBlock?.type === "ul") lastBlock.items.push(item);
      else blocks.push({ type: "ul", items: [item] });
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ordered) {
      if (lastBlock?.type === "ol") lastBlock.items.push(ordered[1]);
      else blocks.push({ type: "ol", items: [ordered[1]] });
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      if (lastBlock?.type === "quote") lastBlock.lines.push(quote[1]);
      else blocks.push({ type: "quote", lines: [quote[1]] });
      continue;
    }
    if (lastBlock?.type === "p" && lastBlock.lines.length > 0) lastBlock.lines.push(line);
    else blocks.push({ type: "p", lines: [line] });
  }
  return blocks.filter((b) => b.type !== "p" || b.lines.length > 0);
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className={className ?? "flex flex-col gap-2.5 text-sm leading-relaxed text-foreground"}>
      {blocks.map((block, bi) => {
        const k = `b${bi}`;
        switch (block.type) {
          case "h": {
            const cls =
              block.level === 1 ? "text-xl font-semibold mt-2" : block.level === 2 ? "text-lg font-semibold mt-1.5" : "text-base font-semibold";
            return (
              <p key={k} className={cls} role="heading" aria-level={block.level}>
                {renderInline(block.text, k)}
              </p>
            );
          }
          case "hr":
            return <hr key={k} className="border-border my-1" />;
          case "ul":
            return (
              <ul key={k} className="flex flex-col gap-1 pl-1">
                {block.items.map((item, ii) => (
                  <li key={ii} className="flex items-start gap-2">
                    <span className="shrink-0 mt-[0.1rem] text-muted-foreground">
                      {item.check === undefined ? "•" : item.check ? "☑" : "☐"}
                    </span>
                    <span className={item.check ? "line-through text-muted-foreground" : ""}>{renderInline(item.text, `${k}-${ii}`)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={k} className="flex flex-col gap-1 pl-1">
                {block.items.map((item, ii) => (
                  <li key={ii} className="flex items-start gap-2">
                    <span className="shrink-0 font-metric text-muted-foreground">{ii + 1}.</span>
                    <span>{renderInline(item, `${k}-${ii}`)}</span>
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={k} className="border-l-2 border-primary/60 pl-3 text-muted-foreground">
                {block.lines.map((l, li) => (
                  <p key={li}>{renderInline(l, `${k}-${li}`)}</p>
                ))}
              </blockquote>
            );
          case "p":
            return (
              <p key={k}>
                {block.lines.map((l, li) => (
                  <Fragment key={li}>
                    {li > 0 && <br />}
                    {renderInline(l, `${k}-${li}`)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

/** Texto puro (sem marcação) — para busca e prévias nas listas. */
export function markdownToPlain(source: string): string {
  return source
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_=`>]/g, "")
    .replace(/-\s\[[ xX]\]\s/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
