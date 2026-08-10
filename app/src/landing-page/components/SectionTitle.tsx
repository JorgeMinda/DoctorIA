export function SectionTitle({
  title,
  description,
}: {
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  titleComponent?: React.ReactNode;
}) {
  const titleElement =
    typeof title === "string" ? (
      <h3 className="text-foreground mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
        {title}
      </h3>
    ) : (
      title
    );
  const descriptionElement =
    typeof description === "string" ? (
      <p className="text-muted-foreground mt-4 text-lg leading-8">
        {description}
      </p>
    ) : (
      description
    );

  return (
    <div className="mx-auto mb-8 max-w-2xl text-center">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/5 px-3 py-1">
        <span className="ambient-pulse-dot size-1.5 rounded-full bg-cyan-400" />
        <span className="text-cyan-300/80 text-[11px] font-semibold tracking-[0.2em] uppercase">
          DoctorIA
        </span>
      </div>
      {titleElement}
      {descriptionElement}
    </div>
  );
}
