import { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import type { CommercialAppointment, CommercialDomainOption, Deal } from "../../../service/commercialService";
import {
  getCommercialCalendarAppointments,
  registerCommercialInteraction,
} from "../../../service/commercialService";
import { useToast } from "../../../contexts/ToastContext";
import "react-calendar/dist/Calendar.css";
import "./ScheduleCalendarModal.css";

type ScheduleCalendarModalProps = {
  isOpen: boolean;
  onClose: () => void;
  crmId: number;
  interactionTypes: CommercialDomainOption[];
  deal?: Pick<Deal, "id" | "contactName" | "companyName" | "title"> | null;
};

function formatDayKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function toLocalDateTimeInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoIfValid(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function getMonthRange(reference: Date) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function buildDateTimeForSelectedDay(day: Date, hourOffset = 0) {
  const next = new Date(day);
  next.setHours(9 + hourOffset, 0, 0, 0);
  return toLocalDateTimeInputValue(next);
}

export function ScheduleCalendarModal({
  isOpen,
  onClose,
  crmId,
  interactionTypes,
  deal = null,
}: ScheduleCalendarModalProps) {
  const { addToast } = useToast();
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [visibleMonth, setVisibleMonth] = useState<Date>(today);
  const [appointments, setAppointments] = useState<CommercialAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [appointmentType, setAppointmentType] = useState("");
  const [appointmentDescription, setAppointmentDescription] = useState("");
  const [appointmentStart, setAppointmentStart] = useState(
    buildDateTimeForSelectedDay(today)
  );
  const [appointmentEnd, setAppointmentEnd] = useState(
    buildDateTimeForSelectedDay(today, 1)
  );

  const appointmentTypes = useMemo(
    () =>
      interactionTypes.filter(
        (item) =>
          item.ativo !== false &&
          (item.categoria || "interacao") === "agendamento"
      ),
    [interactionTypes]
  );

  useEffect(() => {
    if (!isOpen) return;

    const now = new Date();
    setSelectedDate(now);
    setVisibleMonth(now);
    setAppointmentType(appointmentTypes[0]?.codigo || "");
    setAppointmentDescription("");
    setAppointmentStart(buildDateTimeForSelectedDay(now));
    setAppointmentEnd(buildDateTimeForSelectedDay(now, 1));
  }, [appointmentTypes, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setAppointmentStart(buildDateTimeForSelectedDay(selectedDate));
    setAppointmentEnd(buildDateTimeForSelectedDay(selectedDate, 1));
  }, [isOpen, selectedDate]);

  useEffect(() => {
    if (!isOpen || !crmId) return;

    const loadAppointments = async () => {
      setLoadingAppointments(true);
      try {
        const range = getMonthRange(visibleMonth);
        const response = await getCommercialCalendarAppointments({
          crmId,
          dateStart: range.start,
          dateEnd: range.end,
        });
        setAppointments(response);
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar os agendamentos.",
        });
      } finally {
        setLoadingAppointments(false);
      }
    };

    void loadAppointments();
  }, [addToast, crmId, isOpen, visibleMonth]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, CommercialAppointment[]>();
    appointments.forEach((appointment) => {
      if (!appointment.startDate) return;
      const key = formatDayKey(new Date(appointment.startDate));
      const current = map.get(key) || [];
      current.push(appointment);
      map.set(key, current);
    });

    map.forEach((items, key) => {
      map.set(
        key,
        [...items].sort((a, b) => {
          const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
          return aTime - bTime;
        })
      );
    });

    return map;
  }, [appointments]);

  const selectedAppointments = useMemo(
    () => appointmentsByDay.get(formatDayKey(selectedDate)) || [],
    [appointmentsByDay, selectedDate]
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content crm-schedule-calendar-modal">
        <div className="modal-header">
          <h3>Agenda de agendamentos</h3>
          <button className="close-btn" onClick={onClose} disabled={savingAppointment}>
            &times;
          </button>
        </div>

        <div className="crm-schedule-calendar-scroll">
        <div className="crm-schedule-calendar-body">
          <div className="crm-schedule-calendar-layout">
            <section className="crm-schedule-calendar-panel">
            <div className="crm-schedule-calendar-panel__header">
              <div>
                <strong>Calendario do funil</strong>
                <p>Veja os compromissos agendados e selecione um dia para detalhes.</p>
              </div>
              {loadingAppointments ? <span>Carregando...</span> : null}
            </div>

            <Calendar
              locale="pt-BR"
              value={selectedDate}
              onChange={(value) => {
                if (value instanceof Date) setSelectedDate(value);
              }}
              onActiveStartDateChange={({ activeStartDate }) => {
                if (activeStartDate instanceof Date) {
                  setVisibleMonth(activeStartDate);
                }
              }}
              tileClassName={({ date, view }) => {
                if (view !== "month") return undefined;
                const count = appointmentsByDay.get(formatDayKey(date))?.length || 0;
                return count > 0 ? "crm-calendar__tile--scheduled" : undefined;
              }}
              tileContent={({ date, view }) => {
                if (view !== "month") return null;
                const count = appointmentsByDay.get(formatDayKey(date))?.length || 0;
                return count > 0 ? (
                  <span className="crm-calendar__badge">{count}</span>
                ) : null;
              }}
            />
            </section>

            <section className="crm-schedule-calendar-panel crm-schedule-calendar-panel--details">
            <div className="crm-schedule-calendar-panel__header">
              <div>
                <strong>
                  {selectedDate.toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}
                </strong>
                <p>Agendamentos cadastrados para o dia selecionado.</p>
              </div>
              <span>{selectedAppointments.length} item(ns)</span>
            </div>

            <div className="crm-schedule-calendar-events">
              {selectedAppointments.length ? (
                selectedAppointments.map((appointment) => (
                  <article className="crm-schedule-calendar-event" key={appointment.id}>
                    <div className="crm-schedule-calendar-event__time">
                      <strong>
                        {appointment.startDate
                          ? new Date(appointment.startDate).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--:--"}
                      </strong>
                      <span>
                        {appointment.endDate
                          ? new Date(appointment.endDate).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Sem fim"}
                      </span>
                    </div>
                    <div className="crm-schedule-calendar-event__content">
                      <strong>{appointment.typeName || "Agendamento"}</strong>
                      <span>
                        {appointment.customerName || "Cliente"}{" "}
                        {appointment.dealTitle ? `• ${appointment.dealTitle}` : ""}
                      </span>
                      <p>{appointment.description || "Sem descricao."}</p>
                      <small>Responsavel: {appointment.ownerName || "Sistema"}</small>
                    </div>
                  </article>
                ))
              ) : (
                <p className="crm-schedule-calendar-empty">
                  Nenhum agendamento para este dia.
                </p>
              )}
            </div>
            </section>
          </div>
        </div>

        {deal ? (
          <form
            className="crm-schedule-calendar-create"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!appointmentType || !appointmentDescription.trim()) return;

              setSavingAppointment(true);
              try {
                await registerCommercialInteraction({
                  dealId: deal.id,
                  type: appointmentType,
                  category: "agendamento",
                  description: appointmentDescription.trim(),
                  date: toIsoIfValid(appointmentStart),
                  endDate: toIsoIfValid(appointmentEnd),
                  isCurrent: false,
                });

                const range = getMonthRange(visibleMonth);
                const response = await getCommercialCalendarAppointments({
                  crmId,
                  dateStart: range.start,
                  dateEnd: range.end,
                });
                setAppointments(response);
                setAppointmentDescription("");
                addToast({
                  type: "success",
                  title: "Sucesso",
                  description: "Agendamento salvo na agenda do funil.",
                });
              } catch (error) {
                addToast({
                  type: "error",
                  title: "Erro",
                  description:
                    error instanceof Error
                      ? error.message
                      : "Nao foi possivel salvar o agendamento.",
                });
              } finally {
                setSavingAppointment(false);
              }
            }}
          >
            <div className="crm-schedule-calendar-create__header">
              <div>
                <strong>Agendar para {deal.contactName}</strong>
                <p>
                  {deal.companyName}
                  {deal.title ? ` • ${deal.title}` : ""}
                </p>
              </div>
            </div>

            {appointmentTypes.length ? (
              <div className="crm-schedule-calendar-create__grid">
                <label>
                  Tipo do agendamento
                  <select
                    value={appointmentType}
                    onChange={(event) => setAppointmentType(event.target.value)}
                    disabled={savingAppointment}
                  >
                    <option value="">Selecione...</option>
                    {appointmentTypes.map((item) => (
                      <option key={item.id} value={item.codigo}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Inicio
                  <input
                    type="datetime-local"
                    value={appointmentStart}
                    onChange={(event) => setAppointmentStart(event.target.value)}
                    disabled={savingAppointment}
                  />
                </label>

                <label>
                  Fim
                  <input
                    type="datetime-local"
                    value={appointmentEnd}
                    onChange={(event) => setAppointmentEnd(event.target.value)}
                    disabled={savingAppointment}
                  />
                </label>

                <label className="crm-schedule-calendar-create__description">
                  Descricao
                  <textarea
                    value={appointmentDescription}
                    onChange={(event) => setAppointmentDescription(event.target.value)}
                    placeholder="Descreva a reuniao, encontro presencial ou compromisso."
                    disabled={savingAppointment}
                  />
                </label>
              </div>
            ) : (
              <p className="crm-schedule-calendar-empty">
                Nenhum tipo de agendamento foi configurado no funil.
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={savingAppointment}
              >
                Fechar
              </button>
              <button
                type="submit"
                className="btn-confirm"
                disabled={savingAppointment || !appointmentTypes.length}
              >
                {savingAppointment ? "Salvando..." : "Salvar agendamento"}
              </button>
            </div>
          </form>
        ) : null}
        </div>
      </div>
    </div>
  );
}

export default ScheduleCalendarModal;
