/**
 * The heading every landing section opens with.
 *
 * The eyebrow the previous design carried is gone — the reference wireframe
 * leads with the title alone, and three stacked lines of centered text before
 * any content was one too many.
 */
export function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-xl text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-ink-soft">{subtitle}</p>
      ) : null}
    </div>
  );
}
