// ============================================================================
// Ilustrações planas para espaços vazios/estados de destaque — inspiradas na
// forma como o QConcursos usa desenhos simples em vez de só um ícone solto.
// Desenhadas à mão em SVG, geométricas (sem personagens), usando os mesmos
// tokens de cor do design system (funcionam em claro e escuro).
// ============================================================================

function Dot({ cx, cy, r, color, opacity = 1 }: { cx: number; cy: number; r: number; color: string; opacity?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={`hsl(var(${color}))`} opacity={opacity} />;
}

/** Uma pilha de material de estudo (livro/apostila) com um "play" — usada em
 * espaços de "comece por aqui"/"nada assistido ainda". */
export function StudyIllustration({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <Dot cx={94} cy={26} r={5} color="--accent" opacity={0.5} />
      <Dot cx={20} cy={90} r={4} color="--primary" opacity={0.4} />
      <rect x="24" y="30" width="72" height="58" rx="10" fill={`hsl(var(--muted))`} />
      <rect x="24" y="30" width="72" height="14" rx="7" fill={`hsl(var(--border))`} />
      <circle cx="60" cy="65" r="17" fill={`hsl(var(--primary) / 0.15)`} />
      <path d="M55 57 L71 65 L55 73 Z" fill={`hsl(var(--primary))`} />
      <path d="M16 96 C 16 84, 26 78, 32 88" stroke={`hsl(var(--success))`} strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="96" r="3.5" fill={`hsl(var(--success))`} />
    </svg>
  );
}

/** Um crachá com check + confetes — usada em conclusões/"tudo em dia". */
export function AllDoneIllustration({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <Dot cx={22} cy={30} r={4} color="--accent" opacity={0.5} />
      <Dot cx={100} cy={38} r={3} color="--primary" opacity={0.6} />
      <Dot cx={92} cy={90} r={5} color="--success" opacity={0.4} />
      <rect x="30" y="26" width="60" height="72" rx="10" fill={`hsl(var(--muted))`} />
      <rect x="40" y="40" width="40" height="5" rx="2.5" fill={`hsl(var(--border))`} />
      <rect x="40" y="52" width="28" height="5" rx="2.5" fill={`hsl(var(--border))`} />
      <circle cx="60" cy="78" r="19" fill={`hsl(var(--success) / 0.15)`} />
      <path d="M51 78 L57 84 L70 70" stroke={`hsl(var(--success))`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Lupa sobre cartões — usada em buscas/filtros sem resultado. */
export function EmptySearchIllustration({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <Dot cx={96} cy={26} r={4} color="--primary" opacity={0.5} />
      <rect x="26" y="34" width="50" height="62" rx="8" fill={`hsl(var(--border))`} opacity="0.5" />
      <rect x="34" y="26" width="50" height="62" rx="8" fill={`hsl(var(--muted))`} />
      <rect x="44" y="40" width="30" height="5" rx="2.5" fill={`hsl(var(--border))`} />
      <rect x="44" y="52" width="20" height="5" rx="2.5" fill={`hsl(var(--border))`} />
      <circle cx="78" cy="72" r="15" fill={`hsl(var(--surface))`} stroke={`hsl(var(--accent))`} strokeWidth="4" />
      <line x1="89" y1="83" x2="100" y2="94" stroke={`hsl(var(--accent))`} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Caixa de entrada vazia com um cursor piscando — "nada por aqui ainda", classificação/organização. */
export function EmptyBoxIllustration({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <Dot cx={26} cy={30} r={4} color="--accent" opacity={0.4} />
      <path d="M24 54 L60 40 L96 54 L96 88 C96 91 94 93 91 93 L29 93 C26 93 24 91 24 88 Z" fill={`hsl(var(--muted))`} />
      <path d="M24 54 L60 68 L96 54" stroke={`hsl(var(--border))`} strokeWidth="3" fill="none" strokeLinejoin="round" />
      <path d="M60 40 L60 68" stroke={`hsl(var(--border))`} strokeWidth="3" />
      <circle cx="60" cy="68" r="6" fill={`hsl(var(--primary))`} opacity="0.85" />
    </svg>
  );
}
