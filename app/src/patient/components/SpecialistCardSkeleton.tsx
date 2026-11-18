import { Card, CardContent, CardHeader } from "../../client/components/ui/card";

export function SpecialistCardSkeleton() {
  return (
    <Card className="border-outline-variant bg-surface/50 animate-pulse flex flex-col justify-between">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start gap-3">
          {/* Avatar Skeleton */}
          <div className="size-12 rounded-full bg-muted/60 shrink-0" />
          <div className="space-y-2 flex-1">
            {/* Nombre */}
            <div className="h-4 w-3/4 rounded bg-muted/70" />
            {/* Especialidad Badge */}
            <div className="h-5 w-1/2 rounded-full bg-muted/50" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4">
        {/* Sede y Horario */}
        <div className="space-y-1.5 pt-2 border-t border-outline-variant/40">
          <div className="h-3 w-4/5 rounded bg-muted/50" />
          <div className="h-3 w-3/5 rounded bg-muted/40" />
        </div>

        {/* Botón Skeleton */}
        <div className="h-9 w-full rounded-md bg-muted/60" />
      </CardContent>
    </Card>
  );
}

export function SpecialistGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      aria-label="Cargando especialistas"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SpecialistCardSkeleton key={i} />
      ))}
    </div>
  );
}
