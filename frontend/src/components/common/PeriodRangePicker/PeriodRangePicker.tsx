import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import "./PeriodRangePicker.css";

export type PeriodRangeValue = {
  dateStart: string;
  dateEnd: string;
};

type PeriodRangePickerProps = {
  value: PeriodRangeValue;
  onApply: (value: PeriodRangeValue) => void;
  onCancel: () => void;
  showActivePreset?: boolean;
  presetVariant?: "calendar" | "rolling";
};

type PresetKey =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "all_time"
  | "last_7_days"
  | "last_15_days"
  | "last_30_days"
  | "last_60_days"
  | "last_90_days"
  | "custom";

type Preset = {
  key: PresetKey;
  label: string;
  getRange: () => PeriodRangeValue;
};

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function getMonday(date: Date) {
  const current = startOfDay(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(current, diff);
}

function getCalendarPresets(today: Date): Preset[] {
  const currentDay = startOfDay(today);
  const thisWeekStart = getMonday(currentDay);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const thisMonthStart = new Date(currentDay.getFullYear(), currentDay.getMonth(), 1);
  const lastMonthStart = new Date(currentDay.getFullYear(), currentDay.getMonth() - 1, 1);
  const thisYearStart = new Date(currentDay.getFullYear(), 0, 1);
  const lastYearStart = new Date(currentDay.getFullYear() - 1, 0, 1);

  return [
    {
      key: "this_week",
      label: "Esta semana",
      getRange: () => ({ dateStart: formatInputDate(thisWeekStart), dateEnd: formatInputDate(currentDay) }),
    },
    {
      key: "last_week",
      label: "Semana passada",
      getRange: () => ({
        dateStart: formatInputDate(lastWeekStart),
        dateEnd: formatInputDate(addDays(thisWeekStart, -1)),
      }),
    },
    {
      key: "this_month",
      label: "Este mes",
      getRange: () => ({ dateStart: formatInputDate(thisMonthStart), dateEnd: formatInputDate(currentDay) }),
    },
    {
      key: "last_month",
      label: "Mes passado",
      getRange: () => ({
        dateStart: formatInputDate(lastMonthStart),
        dateEnd: formatInputDate(addDays(thisMonthStart, -1)),
      }),
    },
    {
      key: "this_year",
      label: "Este ano",
      getRange: () => ({ dateStart: formatInputDate(thisYearStart), dateEnd: formatInputDate(currentDay) }),
    },
    {
      key: "last_year",
      label: "Ano passado",
      getRange: () => ({
        dateStart: formatInputDate(lastYearStart),
        dateEnd: formatInputDate(new Date(currentDay.getFullYear() - 1, 11, 31)),
      }),
    },
    {
      key: "all_time",
      label: "Todo periodo",
      getRange: () => ({ dateStart: "", dateEnd: "" }),
    },
  ];
}

function getRollingPresets(today: Date): Preset[] {
  const currentDay = startOfDay(today);
  const buildRollingRange = (days: number) => ({
    dateStart: formatInputDate(addDays(currentDay, -(days - 1))),
    dateEnd: formatInputDate(currentDay),
  });

  return [
    {
      key: "last_7_days",
      label: "Ultimos 7 dias",
      getRange: () => buildRollingRange(7),
    },
    {
      key: "last_15_days",
      label: "Ultimos 15 dias",
      getRange: () => buildRollingRange(15),
    },
    {
      key: "last_30_days",
      label: "Ultimos 30 dias",
      getRange: () => buildRollingRange(30),
    },
    {
      key: "last_60_days",
      label: "Ultimos 60 dias",
      getRange: () => buildRollingRange(60),
    },
    {
      key: "last_90_days",
      label: "Ultimos 90 dias",
      getRange: () => buildRollingRange(90),
    },
  ];
}

function rangesMatch(left: PeriodRangeValue, right: PeriodRangeValue) {
  return left.dateStart === right.dateStart && left.dateEnd === right.dateEnd;
}

function getMonthDays(monthDate: Date) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const gridStart = getMonday(monthStart);

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function isSameDay(left: Date | null, right: Date | null) {
  return Boolean(
    left &&
      right &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
  );
}

function isBetween(date: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  const time = date.getTime();
  return time > start.getTime() && time < end.getTime();
}

export function PeriodRangePicker({
  value,
  onApply,
  onCancel,
  showActivePreset = true,
  presetVariant = "calendar",
}: PeriodRangePickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const updatePosition = () => {
      const anchor = dialog.parentElement?.getBoundingClientRect();
      if (!anchor) return;
      const gutter = 16;
      const width = Math.min(anchor.width, 920, window.innerWidth - gutter * 2);
      dialog.style.width = `${width}px`;
      dialog.style.left = `${Math.max(gutter, Math.min(anchor.left, window.innerWidth - width - gutter))}px`;
      dialog.style.top = `${Math.max(gutter, Math.min(anchor.top, window.innerHeight - dialog.offsetHeight - gutter))}px`;
    };

    dialog.showModal();
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      dialog.close();
    };
  }, []);

  const today = useMemo(() => startOfDay(new Date()), []);
  const presets = useMemo(
    () => (presetVariant === "rolling" ? getRollingPresets(today) : getCalendarPresets(today)),
    [presetVariant, today]
  );
  const initialStart = parseInputDate(value.dateStart);
  const initialEnd = parseInputDate(value.dateEnd);
  const [draft, setDraft] = useState<PeriodRangeValue>(value);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const baseDate = initialStart || initialEnd || today;
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  });

  const draftStart = parseInputDate(draft.dateStart);
  const draftEnd = parseInputDate(draft.dateEnd);
  const matchedPreset = presets.find((preset) => rangesMatch(draft, preset.getRange()))?.key;
  const activePreset: PresetKey | "" = showActivePreset ? matchedPreset || "custom" : "";
  const visibleMonths = [visibleMonth, addMonths(visibleMonth, 1)];

  const setPreset = (preset: Preset) => {
    const nextRange = preset.getRange();
    setDraft(nextRange);
    const nextStart = parseInputDate(nextRange.dateStart);
    const nextEnd = parseInputDate(nextRange.dateEnd);
    const baseDate = nextStart || nextEnd || today;
    setVisibleMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
  };

  const handleDayClick = (date: Date) => {
    const nextDate = formatInputDate(date);

    if (!draftStart || (draftStart && draftEnd)) {
      setDraft({ dateStart: nextDate, dateEnd: "" });
      return;
    }

    if (date.getTime() < draftStart.getTime()) {
      setDraft({ dateStart: nextDate, dateEnd: "" });
      return;
    }

    setDraft({ dateStart: draft.dateStart, dateEnd: nextDate });
  };

  const handleDateInputChange = (field: keyof PeriodRangeValue, nextValue: string) => {
    setDraft((current) => ({ ...current, [field]: nextValue }));
    const parsed = parseInputDate(nextValue);
    if (parsed) {
      setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="period-range-picker-dialog"
      aria-label="Selecionar período"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom
        ) onCancel();
      }}
    >
    <div className="period-range-picker">
      <aside className="period-range-picker__presets">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={`period-range-picker__preset ${activePreset === preset.key ? "is-active" : ""}`}
            onClick={() => setPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={`period-range-picker__preset period-range-picker__preset--custom ${
            activePreset === "custom" ? "is-active" : ""
          }`}
          onClick={() => undefined}
        >
          Personalizado
        </button>
      </aside>

      <div className="period-range-picker__main">
        <div className="period-range-picker__calendars">
          {visibleMonths.map((monthDate, monthIndex) => (
            <section className="period-range-picker__month" key={formatInputDate(monthDate)}>
              <header className="period-range-picker__month-header">
                <button
                  type="button"
                  className="period-range-picker__nav"
                  onClick={() => setVisibleMonth((current) => addMonths(current, -1))}
                  aria-label="Mes anterior"
                >
                  <FiChevronLeft />
                </button>
                <strong>
                  {MONTH_LABELS[monthDate.getMonth()]} {monthDate.getFullYear()}
                </strong>
                <button
                  type="button"
                  className="period-range-picker__nav"
                  onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                  aria-label="Proximo mes"
                >
                  <FiChevronRight />
                </button>
              </header>

              <div className="period-range-picker__weekdays">
                {WEEKDAY_LABELS.map((label) => (
                  <span key={`${monthIndex}-${label}`}>{label}</span>
                ))}
              </div>

              <div className="period-range-picker__days">
                {getMonthDays(monthDate).map((date) => {
                  const isOutsideMonth = date.getMonth() !== monthDate.getMonth();
                  const isStart = isSameDay(date, draftStart);
                  const isEnd = isSameDay(date, draftEnd);
                  const isRange = isBetween(date, draftStart, draftEnd);
                  const isToday = isSameDay(date, today);

                  return (
                    <button
                      key={formatInputDate(date)}
                      type="button"
                      className={[
                        "period-range-picker__day",
                        isOutsideMonth ? "is-muted" : "",
                        isStart || isEnd ? "is-selected" : "",
                        isRange ? "is-in-range" : "",
                        isToday ? "is-today" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => handleDayClick(date)}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className="period-range-picker__footer">
          <div className="period-range-picker__inputs">
            <input
              type="date"
              value={draft.dateStart}
              onChange={(event) => handleDateInputChange("dateStart", event.target.value)}
            />
            <span>-</span>
            <input
              type="date"
              value={draft.dateEnd}
              onChange={(event) => handleDateInputChange("dateEnd", event.target.value)}
            />
          </div>
          <div className="period-range-picker__actions">
            <button type="button" className="period-range-picker__button" onClick={onCancel}>
              Cancelar
            </button>
            <button
              type="button"
              className="period-range-picker__button period-range-picker__button--primary"
              onClick={() => onApply(draft)}
            >
              Aplicar
            </button>
          </div>
        </footer>
      </div>
    </div>
    </dialog>
  );
}
