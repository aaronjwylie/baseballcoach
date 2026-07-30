import { Chip } from "./Chip";

/**
 * The heading every landing section opens with: a chip, a large title, and an
 * optional line of prose.
 *
 * Alignment is a prop because the wireframe uses both — the argument sections
 * (method, coach, use case) run left, and the two that address the reader
 * directly (pricing, FAQ) sit centred.
 *
 * Colour is inherited, not set. The method section is white type on the dark
 * band and every other section is ink on paper; a `text-ink` here would have to
 * be overridden in one of the two.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "left",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <div className={`${centered ? "text-center" : ""} ${className}`}>
      {eyebrow ? <Chip className="mb-7">{eyebrow}</Chip> : null}
      <h2 className="text-[38px] font-medium leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]">
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`mt-6 text-lg leading-relaxed opacity-80 ${
            centered ? "mx-auto max-w-2xl" : "max-w-2xl"
          }`}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
