import { Container } from "@/shared/ui";
import { site } from "@/shared/config/site";

export function TrustStrip() {
  const items = [
    { stat: site.turnaroundDays, label: "Typical turnaround" },
    { stat: "NPB", label: "Coaches from Japan's top league" },
    { stat: "100%", label: "Reviewed by a real coach" },
    { stat: "Ages 10+", label: "Youth, high school & adult" },
  ];
  return (
    <section className="border-b border-line bg-white">
      <Container className="grid grid-cols-2 gap-y-8 py-10 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-2xl font-bold text-ink">{item.stat}</div>
            <div className="mt-1 text-sm text-ink-muted">{item.label}</div>
          </div>
        ))}
      </Container>
    </section>
  );
}
