import { FiInfo, FiSave, FiTrash2 } from "react-icons/fi";
import type { MetaTemplateItem } from "../../service/metaService";
import {
  TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS,
  createEmptyTemplateParameterInput,
  formatDispatchBodyHint,
  formatDispatchButtonsHint,
  formatDispatchHeaderHint,
  getBirthdayBodyParameterHelperText,
  getBirthdayButtonParameterHelperText,
  getBirthdayHeaderParameterHelperText,
  type AutoMessageDraft,
  type AutoMessageTypeId,
  type AutomationScheduleCardProps,
  type TemplateParameterKind,
  type TemplateParameterNameFormat,
  type TemplateParameterStandardField,
} from "./MetaApiManagement.helpers";

type AutomationScheduleCardRenderProps = AutomationScheduleCardProps & {
  autoMessageDrafts: Record<AutoMessageTypeId, AutoMessageDraft>;
  togglingType: AutoMessageTypeId | null;
  handleToggleAutoMessage: (tipoId: AutoMessageTypeId, enabled: boolean) => void | Promise<void>;
  templates: MetaTemplateItem[];
  isLoadingTemplates: boolean;
};
export function renderAutomationScheduleCard({
    title,
    toggleTypeId,
    description,
    loadingText,
    statusText,
    defaultDispatchStatusText,
    templateLabel,
    tipText,
    loading,
    saving,
    templateName,
    setTemplateName,
    templateLanguage,
    setTemplateLanguage,
    templateSchedule,
    setTemplateSchedule,
    delayDays,
    setDelayDays,
    delayLabel,
    delayHelperText,
    isDefaultDispatchNumber,
    setIsDefaultDispatchNumber,
    headerMediaUrl,
    setHeaderMediaUrl,
    headerFile,
    setHeaderFile,
    currentHeaderImageUrl,
    selectedTemplateHints,
    headerMediaType,
    headerParameterValues,
    onHeaderParameterChange,
    bodyParameterValues,
    onBodyParameterChange,
    buttonParameterValues,
    onButtonParameterChange,
    onSave,
    onClear,
    clearDisabled,
  autoMessageDrafts,
  togglingType,
  handleToggleAutoMessage,
  templates,
  isLoadingTemplates,
}: AutomationScheduleCardRenderProps) {
    const toggleDraft = autoMessageDrafts[toggleTypeId];

    return (
      <div className="meta-template-block meta-birthday-automation-card">
        <div className="meta-message-header">
          <strong className="meta-message-title">{title}</strong>
          <label className="meta-message-toggle">
            <input
              type="checkbox"
              aria-label={
                toggleDraft.habilitada
                  ? "Desativar agendamento"
                  : "Ativar agendamento"
              }
              checked={toggleDraft.habilitada}
              onChange={(event) =>
                void handleToggleAutoMessage(toggleTypeId, event.target.checked)
              }
              disabled={togglingType === toggleTypeId || loading}
            />
            <span className="meta-message-toggle__track">
              <span className="meta-message-toggle__thumb" />
            </span>
          </label>
        </div>
        <p className="meta-message-description">{description}</p>
        <p className="meta-message-status">{statusText}</p>
        <p className="meta-message-scope-status">
          {templateName
            ? `Configuracao salva: ${templateName}`
            : "Configuracao: nenhum template salvo para este numero"}
        </p>
        <p className="meta-message-scope-status">{defaultDispatchStatusText}</p>

        {loading ? (
          <p>{loadingText}</p>
        ) : (
          <>
            <div className="meta-field-grid meta-field-grid--template-base meta-template-ops-grid meta-birthday-template-grid">
              <label className="meta-template-ops-field meta-template-ops-field--full">
                {templateLabel}
                <select
                  className="meta-template-select"
                  value={templateName}
                  onChange={(event) => {
                    setTemplateName(event.target.value);
                    const selectedTemplateItem = templates.find(
                      (template) =>
                        String(template.name || "").trim() === event.target.value,
                    );
                    setTemplateLanguage(
                      String(selectedTemplateItem?.language || "pt_BR").trim() ||
                        "pt_BR",
                    );
                  }}
                >
                  <option value="">
                    {isLoadingTemplates
                      ? "Carregando templates..."
                      : "Selecione um template"}
                  </option>
                  {templates.map((template) => (
                    <option
                      key={`${template.name || "template"}-${template.language || "pt_BR"}`}
                      value={String(template.name || "")}
                    >
                      {`${template.name || "Template"} (${template.language || "pt_BR"})`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="meta-template-ops-field">
                Idioma do disparo
                <input
                  type="text"
                  value={templateLanguage}
                  onChange={(event) => setTemplateLanguage(event.target.value)}
                  placeholder="pt_BR"
                />
              </label>

              <label className="meta-template-ops-field">
                Horario do envio
                <input
                  type="time"
                  value={templateSchedule}
                  onChange={(event) => setTemplateSchedule(event.target.value)}
                />
              </label>

              {setDelayDays && delayLabel ? (
                <label className="meta-template-ops-field">
                  <span className="meta-template-ops-label-with-info">
                    {delayLabel}
                    {delayHelperText ? (
                      <span
                        className="meta-template-ops-info"
                        title={delayHelperText}
                        aria-label={delayHelperText}
                        role="img"
                      >
                        <FiInfo />
                      </span>
                    ) : null}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={delayDays || "0"}
                    onChange={(event) => setDelayDays(event.target.value)}
                    placeholder="0"
                  />
                </label>
              ) : null}

              <div className="meta-template-ops-field">
                <span className="meta-template-ops-label-with-info">
                  Numero padrao para clientes sem conversa
                  <span
                    className="meta-template-ops-info"
                    title="Marque apenas um numero da Meta como padrao. Ele sera usado somente quando o cliente ainda nao tiver ultima conversa registrada."
                    aria-label="Marque apenas um numero da Meta como padrao. Ele sera usado somente quando o cliente ainda nao tiver ultima conversa registrada."
                    role="img"
                  >
                    <FiInfo />
                  </span>
                </span>
                <label className="meta-message-toggle meta-message-toggle--inline">
                  <input
                    type="checkbox"
                    aria-label={
                      isDefaultDispatchNumber
                        ? "Nao usar este numero como padrao"
                        : "Usar este numero como padrao"
                    }
                    checked={isDefaultDispatchNumber}
                    onChange={(event) =>
                      setIsDefaultDispatchNumber(event.target.checked)
                    }
                  />
                  <span className="meta-message-toggle__track">
                    <span className="meta-message-toggle__thumb" />
                  </span>
                </label>
              </div>
            </div>

            {selectedTemplateHints ? (
              <div className="meta-template-ops-dynamic">
                <div className="meta-template-ops-parameter-group">
                  <h5>Resumo do template</h5>
                  <div className="meta-template-ops-parameter-list">
                    <label className="meta-template-ops-field">
                      <span>Header</span>
                      <input
                        type="text"
                        value={formatDispatchHeaderHint(selectedTemplateHints)}
                        readOnly
                      />
                    </label>
                    <label className="meta-template-ops-field">
                      <span>Body</span>
                      <input
                        type="text"
                        value={formatDispatchBodyHint(selectedTemplateHints)}
                        readOnly
                      />
                    </label>
                    <label className="meta-template-ops-field meta-template-ops-field--full">
                      <span>Botoes</span>
                      <input
                        type="text"
                        value={formatDispatchButtonsHint(selectedTemplateHints)}
                        readOnly
                      />
                    </label>
                  </div>
                </div>

                {selectedTemplateHints.headerParameterCount > 0 ? (
                  <div className="meta-template-ops-parameter-group">
                    <h5>Parametros do header</h5>
                    <div className="meta-template-ops-parameter-list">
                      {selectedTemplateHints.headerParameterIndexes.map(
                        (parameterIndex, index) => {
                          const currentParameter =
                            headerParameterValues[index] ||
                            createEmptyTemplateParameterInput();

                          return (
                            <label
                              key={`${toggleTypeId}-header-${parameterIndex}-${index}`}
                              className="meta-template-ops-field"
                            >
                              <span>{`Header {{${parameterIndex}}}`}</span>
                              <select
                                className="meta-template-select"
                                value={currentParameter.kind}
                                onChange={(event) => {
                                  const nextKind =
                                    event.target.value as TemplateParameterKind;
                                  onHeaderParameterChange(index, {
                                    kind: nextKind,
                                    standardField:
                                      nextKind === "contact_field"
                                        ? currentParameter.standardField ||
                                          "contact_name"
                                        : "",
                                  });
                                }}
                              >
                                <option value="manual">Valor manual</option>
                                <option value="contact_field">
                                  Campo padrao do cliente
                                </option>
                              </select>
                              {currentParameter.kind === "contact_field" ? (
                                <>
                                  <select
                                    className="meta-template-select"
                                    value={currentParameter.standardField}
                                    onChange={(event) =>
                                      onHeaderParameterChange(index, {
                                        standardField:
                                          event.target
                                            .value as TemplateParameterStandardField,
                                        nameFormat:
                                          event.target.value === "contact_name"
                                            ? currentParameter.nameFormat
                                            : "full_name",
                                      })
                                    }
                                  >
                                    {TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS.map(
                                      (option) => (
                                        <option
                                          key={`${toggleTypeId}-header-field-${option.value}`}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                  {currentParameter.standardField ===
                                  "contact_name" ? (
                                    <select
                                      className="meta-template-select"
                                      value={currentParameter.nameFormat}
                                      onChange={(event) =>
                                        onHeaderParameterChange(index, {
                                          nameFormat:
                                            event.target
                                              .value as TemplateParameterNameFormat,
                                        })
                                      }
                                    >
                                      <option value="first_name">
                                        Primeiro nome
                                      </option>
                                      <option value="full_name">
                                        Nome completo
                                      </option>
                                    </select>
                                  ) : null}
                                </>
                              ) : (
                                <input
                                  type="text"
                                  value={currentParameter.text}
                                  onChange={(event) =>
                                    onHeaderParameterChange(index, {
                                      text: event.target.value,
                                    })
                                  }
                                  placeholder={`Valor para {{${parameterIndex}}}`}
                                />
                              )}
                              <small className="meta-template-ops-helper">
                                {getBirthdayHeaderParameterHelperText(
                                  selectedTemplateHints,
                                  parameterIndex,
                                  currentParameter,
                                )}
                              </small>
                            </label>
                          );
                        },
                      )}
                    </div>
                  </div>
                ) : null}

                {selectedTemplateHints.headerRequiresMedia ? (
                  <div className="meta-template-ops-parameter-group">
                    <h5>Midia do header</h5>
                    <div className="meta-template-preview-layout">
                      <div className="meta-template-preview-layout__main">
                        <label className="meta-template-ops-field meta-template-ops-field--full">
                          <span>URL publica da midia</span>
                          <input
                            type="text"
                            value={headerMediaUrl}
                            onChange={(event) =>
                              setHeaderMediaUrl(event.target.value)
                            }
                            placeholder={
                              headerMediaType === "image"
                                ? "https://.../imagem.jpg"
                                : headerMediaType === "video"
                                  ? "https://.../video.mp4"
                                  : "https://.../arquivo.pdf"
                            }
                          />
                          <small className="meta-template-ops-helper">
                            Informe a URL publica da midia se quiser que o cron
                            use um link fixo. Se voce enviar um arquivo abaixo, o
                            upload salvo passa a ser reutilizado por esse
                            template.
                          </small>
                        </label>

                        <label className="meta-template-ops-upload">
                          <span>Arquivo para header de midia</span>
                          <input
                            className="meta-template-ops-file-input"
                            type="file"
                            onChange={(event) =>
                              setHeaderFile(event.target.files?.[0] || null)
                            }
                          />
                          <small className="meta-helper-text">
                            {headerFile
                              ? `Arquivo selecionado: ${headerFile.name}`
                              : headerMediaUrl.trim()
                                ? "URL de midia preenchida para este template."
                                : currentHeaderImageUrl
                                  ? "Imagem de header salva e pronta para reutilizar."
                                  : "Envie imagem, video ou documento quando o template exigir header de midia."}
                          </small>
                        </label>
                      </div>

                      {currentHeaderImageUrl ? (
                        <aside className="meta-template-preview-layout__side">
                          <div className="meta-template-saved-header-preview">
                            <span>Preview da imagem usada no header</span>
                            <img
                              src={currentHeaderImageUrl}
                              alt={`Header salvo do template ${templateName || "template"}`}
                              className="meta-template-preview-bubble-media-image"
                            />
                          </div>
                        </aside>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {selectedTemplateHints.bodyParameterCount > 0 ? (
                  <div className="meta-template-ops-parameter-group">
                    <h5>Parametros do body</h5>
                    <div className="meta-template-ops-parameter-list">
                      {selectedTemplateHints.bodyParameterIndexes.map(
                        (parameterIndex, index) => {
                          const currentParameter =
                            bodyParameterValues[index] ||
                            createEmptyTemplateParameterInput();

                          return (
                            <label
                              key={`${toggleTypeId}-body-${parameterIndex}-${index}`}
                              className="meta-template-ops-field"
                            >
                              <span>{`Body {{${parameterIndex}}}`}</span>
                              <select
                                className="meta-template-select"
                                value={currentParameter.kind}
                                onChange={(event) => {
                                  const nextKind =
                                    event.target.value as TemplateParameterKind;
                                  onBodyParameterChange(index, {
                                    kind: nextKind,
                                    standardField:
                                      nextKind === "contact_field"
                                        ? currentParameter.standardField ||
                                          "contact_name"
                                        : "",
                                  });
                                }}
                              >
                                <option value="manual">Valor manual</option>
                                <option value="contact_field">
                                  Campo padrao do cliente
                                </option>
                              </select>
                              {currentParameter.kind === "contact_field" ? (
                                <>
                                  <select
                                    className="meta-template-select"
                                    value={currentParameter.standardField}
                                    onChange={(event) =>
                                      onBodyParameterChange(index, {
                                        standardField:
                                          event.target
                                            .value as TemplateParameterStandardField,
                                        nameFormat:
                                          event.target.value === "contact_name"
                                            ? currentParameter.nameFormat
                                            : "full_name",
                                      })
                                    }
                                  >
                                    {TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS.map(
                                      (option) => (
                                        <option
                                          key={`${toggleTypeId}-body-field-${option.value}`}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                  {currentParameter.standardField ===
                                  "contact_name" ? (
                                    <select
                                      className="meta-template-select"
                                      value={currentParameter.nameFormat}
                                      onChange={(event) =>
                                        onBodyParameterChange(index, {
                                          nameFormat:
                                            event.target
                                              .value as TemplateParameterNameFormat,
                                        })
                                      }
                                    >
                                      <option value="first_name">
                                        Primeiro nome
                                      </option>
                                      <option value="full_name">
                                        Nome completo
                                      </option>
                                    </select>
                                  ) : null}
                                </>
                              ) : (
                                <input
                                  type="text"
                                  value={currentParameter.text}
                                  onChange={(event) =>
                                    onBodyParameterChange(index, {
                                      text: event.target.value,
                                    })
                                  }
                                  placeholder={`Valor para {{${parameterIndex}}}`}
                                />
                              )}
                              <small className="meta-template-ops-helper">
                                {getBirthdayBodyParameterHelperText(
                                  parameterIndex,
                                  currentParameter,
                                )}
                              </small>
                            </label>
                          );
                        },
                      )}
                    </div>
                  </div>
                ) : null}

                {selectedTemplateHints.buttons
                  .filter((button) => button.parameterCount > 0)
                  .map((button) => (
                    <div
                      key={`${toggleTypeId}-button-params-${button.index}`}
                      className="meta-template-ops-parameter-group"
                    >
                      <h5>
                        {`Botao ${button.index}${
                          button.text ? ` - ${button.text}` : ""
                        }`}
                      </h5>
                      <div className="meta-template-ops-parameter-list">
                        {button.parameterIndexes.map(
                          (parameterIndex, parameterIndexPosition) => {
                            const currentParameter =
                              buttonParameterValues[button.index]?.[
                                parameterIndexPosition
                              ] || createEmptyTemplateParameterInput();

                            return (
                              <label
                                key={`${toggleTypeId}-button-${button.index}-${parameterIndex}-${parameterIndexPosition}`}
                                className="meta-template-ops-field"
                              >
                                <span>{`Botao {{${parameterIndex}}}`}</span>
                                <select
                                  className="meta-template-select"
                                  value={currentParameter.kind}
                                  onChange={(event) => {
                                    const nextKind =
                                      event.target.value as TemplateParameterKind;
                                    onButtonParameterChange(
                                      button.index,
                                      parameterIndexPosition,
                                      {
                                        kind: nextKind,
                                        standardField:
                                          nextKind === "contact_field"
                                            ? currentParameter.standardField ||
                                              "contact_name"
                                            : "",
                                      },
                                    );
                                  }}
                                >
                                  <option value="manual">Valor manual</option>
                                  <option value="contact_field">
                                    Campo padrao do cliente
                                  </option>
                                </select>
                                {currentParameter.kind === "contact_field" ? (
                                  <>
                                    <select
                                      className="meta-template-select"
                                      value={currentParameter.standardField}
                                      onChange={(event) =>
                                        onButtonParameterChange(
                                          button.index,
                                          parameterIndexPosition,
                                          {
                                            standardField:
                                              event.target
                                                .value as TemplateParameterStandardField,
                                            nameFormat:
                                              event.target.value ===
                                              "contact_name"
                                                ? currentParameter.nameFormat
                                                : "full_name",
                                          },
                                        )
                                      }
                                    >
                                      {TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS.map(
                                        (option) => (
                                          <option
                                            key={`${toggleTypeId}-button-field-${button.index}-${option.value}`}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                    {currentParameter.standardField ===
                                    "contact_name" ? (
                                      <select
                                        className="meta-template-select"
                                        value={currentParameter.nameFormat}
                                        onChange={(event) =>
                                          onButtonParameterChange(
                                            button.index,
                                            parameterIndexPosition,
                                            {
                                              nameFormat:
                                                event.target
                                                  .value as TemplateParameterNameFormat,
                                            },
                                          )
                                        }
                                      >
                                        <option value="first_name">
                                          Primeiro nome
                                        </option>
                                        <option value="full_name">
                                          Nome completo
                                        </option>
                                      </select>
                                    ) : null}
                                  </>
                                ) : (
                                  <input
                                    type="text"
                                    value={currentParameter.text}
                                    onChange={(event) =>
                                      onButtonParameterChange(
                                        button.index,
                                        parameterIndexPosition,
                                        {
                                          text: event.target.value,
                                        },
                                      )
                                    }
                                    placeholder={`Valor para {{${parameterIndex}}}`}
                                  />
                                )}
                                <small className="meta-template-ops-helper">
                                  {getBirthdayButtonParameterHelperText(
                                    button,
                                    parameterIndex,
                                    currentParameter,
                                  )}
                                </small>
                              </label>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}

            <p className="meta-message-parameter-tip">{tipText}</p>

            <div className="meta-message-card-actions">
              <button
                type="button"
                title="Salvar automacao"
                onClick={() => void onSave()}
                disabled={saving}
              >
                <FiSave />
                <span>{saving ? "Salvando..." : "Salvar automacao"}</span>
              </button>
              <button
                type="button"
                title="Limpar configuracao"
                onClick={() => void onClear()}
                disabled={clearDisabled}
              >
                <FiTrash2 />
                <span>Limpar configuracao</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
}

