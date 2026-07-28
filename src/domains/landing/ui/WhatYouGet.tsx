import { Container } from "@/shared/ui";
import { included } from "../model/copy";
import { SectionHeading } from "./SectionHeading";
import { CheckIcon } from "./icons";

export function WhatYouGet() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="What you get"
          title="A real coaching session, delivered async"
          subtitle="Everything that comes with a single video review."
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {included.map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-2xl border border-line bg-paper p-6"
            >
              <CheckIcon />
              <div>
                <h3 className="font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
