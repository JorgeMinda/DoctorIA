import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../utils";

interface MonthCalendarProps {
  selected?: string;
  onSelect: (date: string) => void;
  minDate?: string;
  className?: string;
}

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

export function MonthCalendar({
  selected,
  onSelect,
  minDate,
  className,
}: MonthCalendarProps) {
  const initial = selected ? parseKey(selected) : new Date();
  const [view, setView] = useState({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  });

  const firstDay = new Date(view.year, view.month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const todayKey = dateKey(new Date());

  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      dateKey(new Date(view.year, view.month, i + 1)),
    ),
  ];

  const canGoPrev =
    !minDate ||
    view.year > parseKey(minDate).getFullYear() ||
    (view.year === parseKey(minDate).getFullYear() &&
      view.month > parseKey(minDate).getMonth());

  const goPrev = () => {
    if (!canGoPrev) return;
    setView((v) =>
      v.month === 0
        ? { year: v.year - 1, month: 11 }
        : { year: v.year, month: v.month - 1 },
    );
  };

  const goNext = () => {
    setView((v) =>
      v.month === 11
        ? { year: v.year + 1, month: 0 }
        : { year: v.year, month: v.month + 1 },
    );
  };

  const monthLabel = firstDay.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className={cn(
        "rounded-xl border border-outline-variant bg-surface-container/40 p-3",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label="Mes anterior"
          className="inline-flex size-8 items-center justify-center rounded-lg border border-outline-variant text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold capitalize text-foreground">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={goNext}
          aria-label="Mes siguiente"
          className="inline-flex size-8 items-center justify-center rounded-lg border border-outline-variant text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className="py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </span>
        ))}
        {cells.map((key, i) => {
          if (!key) {
            return <span key={`empty-${i}`} className="size-9" />;
          }
          const isDisabled = Boolean(minDate) && key < (minDate as string);
          const isSelected = key === selected;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(key)}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-lg text-xs font-medium transition-all",
                isSelected &&
                  "bg-primary font-bold text-primary-foreground shadow-[0_0_12px_rgba(224,72,121,0.4)]",
                !isSelected &&
                  isToday &&
                  "border border-primary/60 text-primary",
                !isSelected &&
                  !isToday &&
                  !isDisabled &&
                  "text-foreground hover:bg-primary/10",
                isDisabled &&
                  "cursor-not-allowed text-muted-foreground/40 line-through",
              )}
            >
              {Number(key.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}