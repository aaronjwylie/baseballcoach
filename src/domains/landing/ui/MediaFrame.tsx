/**
 * The grey block standing in for photography and video that hasn't been shot
 * yet — the hero image, the coach headshot, the example feedback clip.
 *
 * It renders the *slot*, not the wireframe's note to whoever sources the asset:
 * "Inspirational image kids playing… with fun badges, stickers, small animation
 * around" is a brief for Audrey, and would be nonsense to a parent reading the
 * live page. So the caption here is a plain label, and it disappears the moment
 * a real asset replaces this component.
 *
 * `aria-hidden` because it carries no information a screen reader needs; when
 * the real image lands it gets real alt text instead.
 */
export function MediaFrame({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center rounded-3xl bg-band p-8 text-center text-sm text-ink/70 ${className}`}
    >
      {label}
    </div>
  );
}
