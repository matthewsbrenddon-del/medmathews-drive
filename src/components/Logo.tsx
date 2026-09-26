/**
 * Marca do MedStudy Hub: um livro aberto (estudo) com um traço de
 * eletrocardiograma cruzando as páginas (medicina) — um símbolo só,
 * reconhecível em tamanhos pequenos, desenhado no mesmo estilo (stroke,
 * cantos arredondados) dos ícones lucide usados no resto da interface.
 */
export function Logo({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="MedStudy Hub"
    >
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      <path d="M4.2 10h2.2l1.3-2.8 1.8 5.6 1.3-2.8h1l1.3 2.8 1.8-5.6 1.3 2.8h2.2" strokeWidth={1.4} />
    </svg>
  );
}
