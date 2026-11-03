import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiClock, FiLayers, FiList, FiPauseCircle, FiSend } from "react-icons/fi";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { MetaTemplatePreview, type TemplatePreviewParameterInput } from "../../MetaTemplatePreview/MetaTemplatePreview";
import { fetchBroadcastLists, type BroadcastList } from "../../../service/contactsService";
import {
  cancelCommercialScheduledDispatch,
  createCommercialScheduledDispatch,
  getCommercialDomains,
  getCommercialScheduledDispatches,
  subscribeToCommercialDataChanged,
  type CommercialCrm,
  type CommercialScheduledDispatch,
  type CommercialStage,
} from "../../../service/commercialService";
import {
  MetaService,
  type MetaDispatchButtonParameter,
  type MetaIntegrationAccount,
  type MetaTemplateItem,
} from "../../../service/metaService";
import "./CommercialScheduledDispatches.css";

type CommercialScheduledDispatchesProps = {
  crms: CommercialCrm[];
  selectedCrmId?: number | null;
};

type TemplateParameterKind = "manual" | "contact_field";
type TemplateParameterStandardField = "contact_name" | "birthday" | "email";
type TemplateParameterNameFormat = "first_name" | "full_name";

type TemplateParameterInput = TemplatePreviewParameterInput & {
  kind: TemplateParameterKind;
  text: string;
  standardField: TemplateParameterStandardField | "";
  nameFormat: TemplateParameterNameFormat;
};

type DispatchHintSummary = {
  headerType: string;
  headerRequiresMedia: boolean;
  headerParameterIndexes: number[];
  headerParameterCount: number;
  bodyParameterIndexes: number[];
  bodyParameterCount: number;
  buttons: Array<{
    index: number;
    type: string;
    text: string;
    parameterIndexes: number[];
    parameterCount: number;
  }>;
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: `${String(hour).padStart(2, "0")}:00`,
}));

const TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS: Array<{
  value: TemplateParameterStandardField;
  label: string;
}> = [
  { value: "contact_name", label: "Nome do cliente" },
  { value: "birthday", label: "Data de aniversario" },
  { value: "email", label: "Email" },
];

function getTemplateOptionValue(template: MetaTemplateItem) {
  return `${String(template.name || "")}::${String(template.language || "pt_BR")}`;
}

function getTodayLocalIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyTemplateParameterInput(): TemplateParameterInput {
  return {
    kind: "manual",
    text: "",
    standardField: "",
    nameFormat: "full_name",
  };
}

function ensureTemplateParameterInputsLength(
  current: TemplateParameterInput[],
  length: number,
): TemplateParameterInput[] {
  const safeLength = Math.max(Number(length) || 0, 0);
  return Array.from({ length: safeLength }, (_, index) => {
    return current[index] || createEmptyTemplateParameterInput();
  });
}

function mapTemplateParameterInputToPayload(input: TemplateParameterInput): unknown | null {
  if (input.kind === "contact_field") {
    if (!input.standardField) {
      return null;
    }

    return {
      type: "text",
      parameter_source: "contact_field",
      field: input.standardField,
      name_format:
        input.standardField === "contact_name" ? input.nameFormat : undefined,
    };
  }

  const normalizedText = input.text.trim();
  return normalizedText ? normalizedText : null;
}

function getDispatchHintSummary(template: MetaTemplateItem): DispatchHintSummary {
  const fallback: DispatchHintSummary = {
    headerType: "TEXT",
    headerRequiresMedia: false,
    headerParameterIndexes: [],
    headerParameterCount: 0,
    bodyParameterIndexes: [],
    bodyParameterCount: 0,
    buttons: [],
  };

  const components = template.components as
    | {
        header?: {
          type?: string;
          parameter_indexes?: unknown[];
        } | null;
        body?: {
          parameter_indexes?: unknown[];
        } | null;
        buttons?: Array<{
          index?: number | string;
          type?: string;
          text?: string;
          parameter_indexes?: unknown[];
        }> | null;
      }
    | undefined;

  if (!components || typeof components !== "object" || Array.isArray(components)) {
    return fallback;
  }

  return {
    headerType: String(components.header?.type || "TEXT").toUpperCase(),
    headerRequiresMedia: ["IMAGE", "DOCUMENT", "VIDEO"].includes(
      String(components.header?.type || "TEXT").toUpperCase(),
    ),
    headerParameterIndexes: Array.isArray(components.header?.parameter_indexes)
      ? components.header.parameter_indexes.map((item) => Number(item))
      : [],
    headerParameterCount: Array.isArray(components.header?.parameter_indexes)
      ? components.header.parameter_indexes.length
      : 0,
    bodyParameterIndexes: Array.isArray(components.body?.parameter_indexes)
      ? components.body.parameter_indexes.map((item) => Number(item))
      : [],
    bodyParameterCount: Array.isArray(components.body?.parameter_indexes)
      ? components.body.parameter_indexes.length
      : 0,
    buttons: Array.isArray(components.buttons)
      ? components.buttons.map((button, index) => ({
          index: Number(button?.index ?? index + 1),
          type: String(button?.type || "BUTTON"),
          text: String(button?.text || "").trim(),
          parameterIndexes: Array.isArray(button?.parameter_indexes)
            ? button.parameter_indexes.map((item) => Number(item))
            : [],
          parameterCount: Array.isArray(button?.parameter_indexes)
            ? button.parameter_indexes.length
            : 0,
        }))
      : [],
  };
}

function getContactFieldHelperText(parameterLabel: string, input: TemplateParameterInput): string {
  if (!input.standardField) {
    return `Selecione qual campo do contato deve preencher ${parameterLabel}.`;
  }

  if (input.standardField === "contact_name") {
    return input.nameFormat === "first_name"
      ? `Usa apenas o primeiro nome do cliente em ${parameterLabel}.`
      : `Usa o nome completo do cliente em ${parameterLabel}.`;
  }

  if (input.standardField === "birthday") {
    return `Usa a data de aniversario do contato em ${parameterLabel}.`;
  }

  return `Usa o email do contato em ${parameterLabel}.`;
}

function getParameterHelperText(
  scopeLabel: string,
  input: TemplateParameterInput,
  options?: { mediaType?: string; isUrlButton?: boolean },
): string {
  if (input.kind !== "contact_field") {
    if (options?.mediaType) {
      return `Informe manualmente a URL publica da ${options.mediaType.toLowerCase()} usada em ${scopeLabel}.`;
    }
    if (options?.isUrlButton) {
      return `Informe manualmente o valor dinamico que completa o link usado em ${scopeLabel}.`;
    }
    return `Informe manualmente o valor que sera enviado em ${scopeLabel}.`;
  }

  return getContactFieldHelperText(scopeLabel, input);
}

function getStatusLabel(status: CommercialScheduledDispatch["status"]) {
  switch (status) {
    case "pending":
      return "Pendente";
    case "processing":
      return "Processando";
    case "completed":
      return "Concluido";
    case "completed_with_errors":
      return "Concluido com erros";
    case "failed":
      return "Falhou";
    case "canceled":
      return "Cancelado";
    default:
      return status;
  }
}

function getAudienceLabel(schedule: CommercialScheduledDispatch) {
  if (schedule.audience_type === "crm") {
    return schedule.crm_nome && schedule.etapa_nome
      ? `${schedule.crm_nome} / ${schedule.etapa_nome}`
      : "Funil";
  }
  return schedule.lista_nome || "Lista de transmissao";
}

function buildButtonPayload(
  hints: DispatchHintSummary,
  buttonParameterValues: Record<number, TemplateParameterInput[]>,
): MetaDispatchButtonParameter[] {
  return hints.buttons
    .filter((button) => button.parameterCount > 0)
    .map((button) => ({
      index: button.index - 1,
      parameters: ensureTemplateParameterInputsLength(
        buttonParameterValues[button.index] || [],
        button.parameterCount,
      ).map(mapTemplateParameterInputToPayload),
    }));
}

export function CommercialScheduledDispatches({
  crms,
  selectedCrmId,
}: CommercialScheduledDispatchesProps) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingSchedules, setIsRefreshingSchedules] = useState(false);
  const [cancelingScheduleId, setCancelingScheduleId] = useState<number | null>(null);

  const [metaNumbers, setMetaNumbers] = useState<MetaIntegrationAccount[]>([]);
  const [templates, setTemplates] = useState<MetaTemplateItem[]>([]);
  const [lists, setLists] = useState<BroadcastList[]>([]);
  const [stages, setStages] = useState<CommercialStage[]>([]);
  const [schedules, setSchedules] = useState<CommercialScheduledDispatch[]>([]);

  const [selectedMetaParamId, setSelectedMetaParamId] = useState<number | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [selectedTemplateLanguage, setSelectedTemplateLanguage] = useState("pt_BR");
  const [audienceType, setAudienceType] = useState<"lista_transmissao" | "crm">("lista_transmissao");
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(selectedCrmId || null);
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState(getTodayLocalIso());
  const [scheduledHour, setScheduledHour] = useState<number>(9);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [headerParameterValues, setHeaderParameterValues] = useState<TemplateParameterInput[]>([]);
  const [bodyParameterValues, setBodyParameterValues] = useState<TemplateParameterInput[]>([]);
  const [buttonParameterValues, setButtonParameterValues] = useState<Record<number, TemplateParameterInput[]>>({});

  const empresaId = Number(user?.empresa_id || 0);
  const usuarioId = Number(user?.id || 0);

  const selectedTemplate = useMemo(
    () => templates.find((template) => getTemplateOptionValue(template) === selectedTemplateKey) || null,
    [selectedTemplateKey, templates],
  );

  const selectedTemplateHints = useMemo(
    () => (selectedTemplate ? getDispatchHintSummary(selectedTemplate) : null),
    [selectedTemplate],
  );

  const selectedNumber = useMemo(
    () => metaNumbers.find((item) => Number(item.id || 0) === Number(selectedMetaParamId || 0)) || null,
    [metaNumbers, selectedMetaParamId],
  );

  const canSubmit = Boolean(
    selectedMetaParamId &&
      selectedTemplate &&
      scheduledDate &&
      (audienceType === "lista_transmissao" ? selectedListId : selectedPipelineId && selectedStageId),
  );

  const loadSchedules = async (showSpinner = false) => {
    if (!empresaId || !usuarioId) return;
    if (showSpinner) {
      setIsRefreshingSchedules(true);
    }
    try {
      const nextSchedules = await getCommercialScheduledDispatches();
      setSchedules(nextSchedules);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os agendamentos de disparo.",
      });
    } finally {
      if (showSpinner) {
        setIsRefreshingSchedules(false);
      }
    }
  };

  useEffect(() => {
    if (!selectedCrmId) return;
    setSelectedPipelineId((current) => current || selectedCrmId);
  }, [selectedCrmId]);

  useEffect(() => {
    if (!empresaId || !usuarioId) return;

    let cancelled = false;
    setLoadingInitialData(true);

    void (async () => {
      try {
        const [numbers, currentSchedules] = await Promise.all([
          MetaService.getIntegrationNumbers(empresaId, usuarioId),
          getCommercialScheduledDispatches(),
        ]);

        if (cancelled) return;

        setMetaNumbers(numbers);
        setSchedules(currentSchedules);

        if (numbers.length) {
          setSelectedMetaParamId((current) => {
            if (current && numbers.some((item) => Number(item.id) === Number(current))) {
              return current;
            }
            return Number(numbers[0].id || 0) || null;
          });
        } else {
          setSelectedMetaParamId(null);
        }
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar a configuracao de disparos agendados.",
        });
      } finally {
        if (!cancelled) {
          setLoadingInitialData(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addToast, empresaId, usuarioId]);

  useEffect(() => {
    if (!empresaId || !selectedMetaParamId) {
      setTemplates([]);
      setLists([]);
      setSelectedTemplateKey("");
      setSelectedListId(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [nextTemplates, nextLists] = await Promise.all([
          MetaService.getTemplates(empresaId, { metaParamId: selectedMetaParamId }),
          fetchBroadcastLists(empresaId, usuarioId, selectedMetaParamId),
        ]);

        if (cancelled) return;

        setTemplates(nextTemplates);
        setLists(nextLists);
        setSelectedTemplateKey((current) =>
          nextTemplates.some((template) => getTemplateOptionValue(template) === current)
            ? current
            : nextTemplates[0]
              ? getTemplateOptionValue(nextTemplates[0])
              : "",
        );
        setSelectedListId((current) =>
          current && nextLists.some((item) => Number(item.id) === Number(current))
            ? current
            : Number(nextLists[0]?.id || 0) || null,
        );
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar templates e listas do numero selecionado.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addToast, empresaId, selectedMetaParamId, usuarioId]);

  useEffect(() => {
    if (!empresaId || !selectedPipelineId) {
      setStages([]);
      setSelectedStageId(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const domains = await getCommercialDomains(selectedPipelineId);
        if (cancelled) return;
        const nextStages = Array.isArray(domains?.etapas) ? domains.etapas : [];
        setStages(nextStages);
        setSelectedStageId((current) =>
          current && nextStages.some((stage) => Number(stage.id) === Number(current))
            ? current
            : Number(nextStages[0]?.id || 0) || null,
        );
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel carregar as colunas do pipeline selecionado.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addToast, empresaId, selectedPipelineId]);

  useEffect(() => {
    if (!selectedTemplateHints) {
      setHeaderParameterValues([]);
      setBodyParameterValues([]);
      setButtonParameterValues({});
      setHeaderMediaUrl("");
      return;
    }

    setSelectedTemplateLanguage(selectedTemplate?.language ? String(selectedTemplate.language) : "pt_BR");
    setHeaderParameterValues((current) =>
      ensureTemplateParameterInputsLength(current, selectedTemplateHints.headerParameterCount),
    );
    setBodyParameterValues((current) =>
      ensureTemplateParameterInputsLength(current, selectedTemplateHints.bodyParameterCount),
    );
    setButtonParameterValues((current) => {
      const next: Record<number, TemplateParameterInput[]> = {};
      selectedTemplateHints.buttons.forEach((button) => {
        next[button.index] = ensureTemplateParameterInputsLength(
          current[button.index] || [],
          button.parameterCount,
        );
      });
      return next;
    });
  }, [selectedTemplate, selectedTemplateHints]);

  useEffect(
    () =>
      subscribeToCommercialDataChanged(() => {
        void loadSchedules(false);
      }),
    [empresaId, usuarioId],
  );

  const handleCreateSchedule = async () => {
    if (!selectedMetaParamId || !selectedTemplate) {
      return;
    }

    setIsSubmitting(true);
    try {
      const headerParameters = ensureTemplateParameterInputsLength(
        headerParameterValues,
        selectedTemplateHints?.headerParameterCount || 0,
      ).map(mapTemplateParameterInputToPayload);
      const bodyParameters = ensureTemplateParameterInputsLength(
        bodyParameterValues,
        selectedTemplateHints?.bodyParameterCount || 0,
      ).map(mapTemplateParameterInputToPayload);
      const buttonParameters = selectedTemplateHints
        ? buildButtonPayload(selectedTemplateHints, buttonParameterValues)
        : [];

      const created = await createCommercialScheduledDispatch({
        metaParamId: selectedMetaParamId,
        templateName: String(selectedTemplate.name || ""),
        templateLanguage: selectedTemplateLanguage || String(selectedTemplate.language || "pt_BR"),
        audienceType,
        listaTransmissaoId: audienceType === "lista_transmissao" ? selectedListId : null,
        crmId: audienceType === "crm" ? selectedPipelineId : null,
        etapaId: audienceType === "crm" ? selectedStageId : null,
        scheduledDate,
        scheduledHour,
        headerMediaType: selectedTemplateHints?.headerRequiresMedia
          ? selectedTemplateHints.headerType
          : null,
        headerMediaUrl: headerMediaUrl || null,
        headerParameters,
        bodyParameters,
        buttonParameters,
      });

      setSchedules((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      addToast({
        type: "success",
        title: "Agendamento criado",
        description: "O cron vai processar o disparo no dia e hora informados.",
      });
      void loadSchedules(false);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao agendar",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar o agendamento de disparo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSchedule = async (scheduleId: number) => {
    setCancelingScheduleId(scheduleId);
    try {
      const canceled = await cancelCommercialScheduledDispatch(scheduleId);
      setSchedules((current) => current.map((item) => (item.id === scheduleId ? canceled : item)));
      addToast({
        type: "success",
        title: "Agendamento cancelado",
        description: "O disparo pendente foi cancelado.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao cancelar",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel cancelar o agendamento.",
      });
    } finally {
      setCancelingScheduleId(null);
    }
  };

  const renderParameterInput = (
    value: TemplateParameterInput,
    onChange: (next: TemplateParameterInput) => void,
    helperText: string,
    label: string,
  ) => {
    return (
      <div className="commercial-scheduled-dispatches__parameter-card">
        <div className="commercial-scheduled-dispatches__parameter-head">
          <strong>{label}</strong>
          <select
            value={value.kind}
            onChange={(event) =>
              onChange({
                ...value,
                kind: event.target.value as TemplateParameterKind,
                text: event.target.value === "manual" ? value.text : "",
                standardField: event.target.value === "contact_field" ? value.standardField : "",
              })
            }
          >
            <option value="manual">Valor manual</option>
            <option value="contact_field">Campo do contato</option>
          </select>
        </div>

        {value.kind === "manual" ? (
          <input
            type="text"
            value={value.text}
            onChange={(event) => onChange({ ...value, text: event.target.value })}
            placeholder="Valor enviado no template"
          />
        ) : (
          <div className="commercial-scheduled-dispatches__parameter-grid">
            <select
              value={value.standardField}
              onChange={(event) =>
                onChange({
                  ...value,
                  standardField: event.target.value as TemplateParameterStandardField | "",
                })
              }
            >
              <option value="">Selecione campo</option>
              {TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {value.standardField === "contact_name" ? (
              <select
                value={value.nameFormat}
                onChange={(event) =>
                  onChange({
                    ...value,
                    nameFormat: event.target.value as TemplateParameterNameFormat,
                  })
                }
              >
                <option value="full_name">Nome completo</option>
                <option value="first_name">Primeiro nome</option>
              </select>
            ) : null}
          </div>
        )}

        <small>{helperText}</small>
      </div>
    );
  };

  if (loadingInitialData) {
    return (
      <div className="commercial-scheduled-dispatches">
        <div className="commercial-scheduled-dispatches__empty">Carregando configuracao de disparos...</div>
      </div>
    );
  }

  if (!metaNumbers.length) {
    return (
      <div className="commercial-scheduled-dispatches">
        <div className="commercial-scheduled-dispatches__empty">
          Vincule ao menos um numero Meta ativo para liberar os agendamentos de disparo.
        </div>
      </div>
    );
  }

  return (
    <div className="commercial-scheduled-dispatches">
      <div className="commercial-scheduled-dispatches__composer">
        <section className="commercial-scheduled-dispatches__panel commercial-scheduled-dispatches__panel--form">
          <div className="commercial-scheduled-dispatches__panel-head">
            <div>
              <h3>Agendar disparos</h3>
              <p>
                Escolha numero, template, publico, data e hora. O cron processa os envios no horario de Sao Paulo.
              </p>
            </div>
            <button
              type="button"
              className="commercial-scheduled-dispatches__refresh-button"
              onClick={() => void loadSchedules(true)}
              disabled={isRefreshingSchedules}
            >
              {isRefreshingSchedules ? "Atualizando..." : "Atualizar lista"}
            </button>
          </div>

          <div className="commercial-scheduled-dispatches__form-grid">
            <label>
              <span>Numero Meta</span>
              <select
                value={selectedMetaParamId ?? ""}
                onChange={(event) => setSelectedMetaParamId(event.target.value ? Number(event.target.value) : null)}
              >
                {metaNumbers.map((number) => (
                  <option key={number.id} value={number.id ?? ""}>
                    {number.display_phone_number || number.verified_name || `Numero ${number.id}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Template</span>
              <select
                value={selectedTemplateKey}
                onChange={(event) => setSelectedTemplateKey(event.target.value)}
                disabled={!templates.length}
              >
                {!templates.length && <option value="">Sem templates</option>}
                {templates.map((template) => (
                  <option key={`${template.name}-${template.language}`} value={getTemplateOptionValue(template)}>
                    {template.name} ({template.language || "pt_BR"})
                  </option>
                ))}
              </select>
            </label>

          <label>
            <span>Publico</span>
            <select
              value={audienceType}
              onChange={(event) => setAudienceType(event.target.value as "lista_transmissao" | "crm")}
            >
              <option value="lista_transmissao">Lista de transmissao</option>
              <option value="crm">Funil / coluna</option>
            </select>
          </label>

          {audienceType === "lista_transmissao" ? (
            <label>
              <span>Lista</span>
              <select
                value={selectedListId ?? ""}
                onChange={(event) => setSelectedListId(event.target.value ? Number(event.target.value) : null)}
                disabled={!lists.length}
              >
                {!lists.length && <option value="">Sem listas</option>}
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.nome} ({list.total_contatos} contatos)
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                <span>Pipeline</span>
                <select
                  value={selectedPipelineId ?? ""}
                  onChange={(event) =>
                    setSelectedPipelineId(event.target.value ? Number(event.target.value) : null)
                  }
                >
                  {!crms.length && <option value="">Sem pipelines</option>}
                  {crms.map((crm) => (
                    <option key={crm.id} value={crm.id}>
                      {crm.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Coluna</span>
                <select
                  value={selectedStageId ?? ""}
                  onChange={(event) => setSelectedStageId(event.target.value ? Number(event.target.value) : null)}
                  disabled={!stages.length}
                >
                  {!stages.length && <option value="">Sem colunas</option>}
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.nome}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label>
            <span>Data</span>
            <input
              type="date"
              value={scheduledDate}
              min={getTodayLocalIso()}
              onChange={(event) => setScheduledDate(event.target.value)}
            />
          </label>

          <label>
            <span>Hora</span>
            <select
              value={scheduledHour}
              onChange={(event) => setScheduledHour(Number(event.target.value))}
            >
              {HOUR_OPTIONS.map((hour) => (
                <option key={hour.value} value={hour.value}>
                  {hour.label}
                </option>
              ))}
            </select>
          </label>
          </div>

        {selectedNumber ? (
          <div className="commercial-scheduled-dispatches__number-chip">
            <FiSend aria-hidden="true" />
            <span>
              {selectedNumber.display_phone_number || "Numero sem mascara"}
              {selectedNumber.verified_name ? ` • ${selectedNumber.verified_name}` : ""}
            </span>
          </div>
        ) : null}

        {selectedTemplateHints?.headerRequiresMedia ? (
          <div className="commercial-scheduled-dispatches__media-box">
            <strong>Header com midia obrigatoria</strong>
            <label>
              <span>URL publica da {selectedTemplateHints.headerType.toLowerCase()}</span>
              <input
                type="url"
                value={headerMediaUrl}
                onChange={(event) => setHeaderMediaUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>
          </div>
        ) : null}

        {selectedTemplateHints?.headerParameterCount ? (
          <div className="commercial-scheduled-dispatches__parameter-section">
            <h4>Parametros do header</h4>
            <div className="commercial-scheduled-dispatches__parameter-list">
              {selectedTemplateHints.headerParameterIndexes.map((parameterIndex, index) => {
                const value = headerParameterValues[index] || createEmptyTemplateParameterInput();
                return renderParameterInput(
                  value,
                  (next) =>
                    setHeaderParameterValues((current) => {
                      const updated = ensureTemplateParameterInputsLength(
                        current,
                        selectedTemplateHints.headerParameterCount,
                      );
                      updated[index] = next;
                      return updated;
                    }),
                  getParameterHelperText(`Header {{${parameterIndex}}}`, value, {
                    mediaType: selectedTemplateHints.headerRequiresMedia
                      ? selectedTemplateHints.headerType
                      : undefined,
                  }),
                  `Header {{${parameterIndex}}}`,
                );
              })}
            </div>
          </div>
        ) : null}

        {selectedTemplateHints?.bodyParameterCount ? (
          <div className="commercial-scheduled-dispatches__parameter-section">
            <h4>Parametros do body</h4>
            <div className="commercial-scheduled-dispatches__parameter-list">
              {selectedTemplateHints.bodyParameterIndexes.map((parameterIndex, index) => {
                const value = bodyParameterValues[index] || createEmptyTemplateParameterInput();
                return renderParameterInput(
                  value,
                  (next) =>
                    setBodyParameterValues((current) => {
                      const updated = ensureTemplateParameterInputsLength(
                        current,
                        selectedTemplateHints.bodyParameterCount,
                      );
                      updated[index] = next;
                      return updated;
                    }),
                  getParameterHelperText(`Body {{${parameterIndex}}}`, value),
                  `Body {{${parameterIndex}}}`,
                );
              })}
            </div>
          </div>
        ) : null}

        {selectedTemplateHints?.buttons.some((button) => button.parameterCount > 0) ? (
          <div className="commercial-scheduled-dispatches__parameter-section">
            <h4>Parametros dos botoes</h4>
            <div className="commercial-scheduled-dispatches__button-sections">
              {selectedTemplateHints.buttons
                .filter((button) => button.parameterCount > 0)
                .map((button) => (
                  <div key={button.index} className="commercial-scheduled-dispatches__button-card">
                    <strong>
                      Botao #{button.index} {button.text ? `• ${button.text}` : ""}
                    </strong>
                    <div className="commercial-scheduled-dispatches__parameter-list">
                      {button.parameterIndexes.map((parameterIndex, index) => {
                        const value =
                          buttonParameterValues[button.index]?.[index] ||
                          createEmptyTemplateParameterInput();
                        return renderParameterInput(
                          value,
                          (next) =>
                            setButtonParameterValues((current) => {
                              const nextValues = {
                                ...current,
                                [button.index]: ensureTemplateParameterInputsLength(
                                  current[button.index] || [],
                                  button.parameterCount,
                                ),
                              };
                              nextValues[button.index][index] = next;
                              return nextValues;
                            }),
                          getParameterHelperText(`Botao {{${parameterIndex}}}`, value, {
                            isUrlButton: String(button.type || "").toUpperCase() === "URL",
                          }),
                          `Botao {{${parameterIndex}}}`,
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

          <div className="commercial-scheduled-dispatches__actions">
            <button
              type="button"
              className="commercial-scheduled-dispatches__submit-button"
              onClick={() => void handleCreateSchedule()}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Agendando..." : "Agendar disparo"}
            </button>
            <small>
              Limite ativo: a empresa nao pode ter dois agendamentos na mesma data e hora.
            </small>
          </div>
        </section>

        {selectedTemplate ? (
          <MetaTemplatePreview
            template={selectedTemplate}
            language={selectedTemplateLanguage}
            title="Preview do template agendado"
            className="commercial-scheduled-dispatches__preview"
            headerParameters={headerParameterValues}
            bodyParameters={bodyParameterValues}
            buttonParameters={buttonParameterValues}
            headerImageUrl={
              selectedTemplateHints?.headerType === "IMAGE" ? headerMediaUrl : ""
            }
          />
        ) : null}
      </div>

      <section className="commercial-scheduled-dispatches__panel">
        <div className="commercial-scheduled-dispatches__panel-head">
          <div>
            <h3>Fila de agendamentos</h3>
            <p>Historico dos disparos criados pela empresa nesta tela.</p>
          </div>
        </div>

        {!schedules.length ? (
          <div className="commercial-scheduled-dispatches__empty">
            Nenhum disparo agendado encontrado ate agora.
          </div>
        ) : (
          <div className="commercial-scheduled-dispatches__schedule-list">
            {schedules.map((schedule) => (
              <article key={schedule.id} className="commercial-scheduled-dispatches__schedule-card">
                <div className="commercial-scheduled-dispatches__schedule-main">
                  <div className="commercial-scheduled-dispatches__schedule-title-row">
                    <h4>{schedule.template_name}</h4>
                    <span className={`commercial-scheduled-dispatches__status commercial-scheduled-dispatches__status--${schedule.status}`}>
                      {getStatusLabel(schedule.status)}
                    </span>
                  </div>

                  <div className="commercial-scheduled-dispatches__schedule-meta">
                    <span><FiClock aria-hidden="true" /> {schedule.scheduled_date} as {schedule.scheduled_time}</span>
                    <span><FiSend aria-hidden="true" /> {schedule.display_phone_number || "Numero Meta"}</span>
                    <span>
                      {schedule.audience_type === "crm" ? <FiLayers aria-hidden="true" /> : <FiList aria-hidden="true" />}
                      {getAudienceLabel(schedule)}
                    </span>
                    <span><FiCalendar aria-hidden="true" /> {schedule.template_language}</span>
                  </div>

                  <div className="commercial-scheduled-dispatches__schedule-counts">
                    <span>Total: {schedule.total_recipients}</span>
                    <span>Processados: {schedule.processed_recipients}</span>
                    <span>Enviados: {schedule.sent_recipients}</span>
                    <span>Erros: {schedule.error_recipients}</span>
                  </div>

                  {schedule.last_error_message ? (
                    <p className="commercial-scheduled-dispatches__schedule-error">
                      {schedule.last_error_message}
                    </p>
                  ) : null}
                </div>

                {schedule.status === "pending" ? (
                  <button
                    type="button"
                    className="commercial-scheduled-dispatches__cancel-button"
                    onClick={() => void handleCancelSchedule(schedule.id)}
                    disabled={cancelingScheduleId === schedule.id}
                  >
                    <FiPauseCircle aria-hidden="true" />
                    {cancelingScheduleId === schedule.id ? "Cancelando..." : "Cancelar"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
