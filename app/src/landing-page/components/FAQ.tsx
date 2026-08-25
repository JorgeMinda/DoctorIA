import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../client/components/ui/accordion";

interface FAQ {
  id: number;
  question: string;
  answer: string;
  href?: string;
}

export function FAQ({ faqs }: { faqs: FAQ[] }) {
  return (
    <div className="mx-auto mt-16 max-w-4xl px-6 pb-16 md:mt-24 lg:px-8">
      <h2 className="text-foreground mb-4 text-center text-4xl font-bold tracking-tight">
        Preguntas frecuentes
      </h2>
      <p className="text-muted-foreground mb-12 text-center text-lg leading-8">
        Resolvemos las dudas más comunes sobre DoctorIA.
      </p>

      <Accordion type="single" collapsible className="w-full space-y-4">
        {faqs.map((faq) => (
          <AccordionItem
            key={faq.id}
            value={`faq-${faq.id}`}
            className="border-border/60 hover:border-primary/20 hover:bg-primary/5 rounded-xl border px-6 py-2 transition-all duration-200"
          >
            <AccordionTrigger className="text-foreground hover:text-primary text-left text-base font-semibold leading-7 transition-colors duration-200">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              <div className="flex flex-col items-start justify-between gap-4">
                <p className="text-muted-foreground flex-1 text-base leading-7">
                  {faq.answer}
                </p>
                {faq.href && (
                  <a
                    href={faq.href}
                    className="text-primary hover:text-primary/80 shrink-0 whitespace-nowrap text-base font-medium leading-7 transition-colors duration-200"
                  >
                    Saber más →
                  </a>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
