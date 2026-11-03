// @ts-nocheck
import { FiX } from "react-icons/fi";
import { MetaTemplatePreview } from "../MetaTemplatePreview/MetaTemplatePreview";
import {
  TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS,
  createEmptyTemplateParameterInput,
  formatDateTime,
  formatDispatchBodyHint,
  formatDispatchButtonsHint,
  formatDispatchCurrency,
  formatDispatchHeaderHint,
  formatDurationMs,
  formatMetricNumber,
  getBatchResultErrorMessage,
  getBatchResultPhoneLabel,
  getBatchResultTitle,
  toSafeNumber,
  type TemplateParameterKind,
  type TemplateParameterNameFormat,
  type TemplateParameterStandardField,
} from "./MetaApiManagement.helpers";

type TemplateOperationModalProps = Record<string, any>;

export function TemplateOperationModal(props: TemplateOperationModalProps) {
  const {
    isMetricsModalOpen,
    handleCloseTemplateMetricsModal,
    isDispatchingTemplateBatch,
    selectedTemplateName,
    activeBatchProcessedItems,
    activeBatchTotalItems,
    activeBatchProgressPercent,
    activeBatchSuccessCount,
    activeBatchErrorCount,
    activeBatchProgress,
    handleOpenTemplateDetailsModal,
    selectedTemplateId,
    templateOperationTab,
    setTemplateOperationTab,
    selectedMetaAccountLabel,
    selectedTemplateDispatchHints,
    templateOperationLanguage,
    setTemplateOperationLanguage,
    templateHeaderParameterValues,
    handleHeaderParameterChange,
    templateBodyParameterValues,
    handleBodyParameterChange,
    templateButtonParameterValues,
    handleButtonParameterChange,
    selectedTemplate,
    selectedTemplateSavedHeaderImageUrl,
    templateHeaderFile,
    setTemplateHeaderFile,
    currentTemplateHeaderImageUrl,
    templateDispatchMode,
    setTemplateDispatchMode,
    templateDispatchCustomerSearch,
    setTemplateDispatchCustomerSearch,
    setTemplateDispatchCustomerSuggestions,
    isSearchingTemplateDispatchCustomer,
    templateDispatchCustomerSuggestions,
    selectedTemplateDispatchCustomer,
    setSelectedTemplateDispatchCustomer,
    isDispatchingTemplate,
    templateDispatchResult,
    templateOperationError,
    handleDispatchTemplate,
    broadcastLists,
    selectedBroadcastListId,
    setSelectedBroadcastListId,
    isLoadingBroadcastLists,
    selectedBroadcastList,
    selectedBroadcastListContactCount,
    templateBatchLeadStartedMessagesGenerateAutoMessage,
    setTemplateBatchLeadStartedMessagesGenerateAutoMessage,
    templateBatchStopOnError,
    setTemplateBatchStopOnError,
    handleDispatchTemplateBatch,
    templateBatchResult,
    handleExportBatchReport,
    batchCostSummary,
    batchCostRows,
    batchFailureItems,
    batchSuccessItems,
  } = props;
  if (!isMetricsModalOpen) return null;

  return (
              <div
                className="meta-template-metrics-modal-backdrop"
                onClick={handleCloseTemplateMetricsModal}
              >
                <article
                  className={`meta-template-metrics-modal ${
                    isDispatchingTemplateBatch ? "meta-template-metrics-modal--busy" : ""
                  }`}
                  onClick={(event) => event.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="template-metrics-title"
                >
                  <header className="meta-template-metrics-modal-header">
                    <h4 id="template-metrics-title">
                      Template: {selectedTemplateName}
                    </h4>
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={handleCloseTemplateMetricsModal}
                      disabled={isDispatchingTemplateBatch}
                    >
                      {isDispatchingTemplateBatch ? "Processando lote..." : "Fechar"}
                    </button>
                  </header>

                  <div className="meta-template-metrics-modal-content">
                    {isDispatchingTemplateBatch ? (
                      <div className="meta-template-batch-lock" role="alert" aria-live="assertive">
                        <div className="meta-template-batch-lock__spinner" aria-hidden="true" />
                        <div className="meta-template-batch-lock__content">
                          <strong>Disparo em lote em andamento</strong>
                          <p>
                            A navegacao e o fechamento desta tela foram bloqueados ate o
                            processamento terminar. O relatorio final sera mostrado aqui.
                          </p>
                          <div className="meta-batch-progress">
                            <div className="meta-batch-progress__header">
                              <span>
                                {activeBatchProcessedItems} de {activeBatchTotalItems} processados
                              </span>
                              <strong>{activeBatchProgressPercent.toFixed(0)}%</strong>
                            </div>
                            <div
                              className="meta-batch-progress__bar"
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={activeBatchProgressPercent}
                              aria-valuetext={`${activeBatchProgressPercent.toFixed(0)}%`}
                            >
                              <span
                                className="meta-batch-progress__fill"
                                style={{ width: `${activeBatchProgressPercent}%` }}
                              />
                            </div>
                            <div className="meta-batch-progress__stats">
                              <span>Enviados: {activeBatchSuccessCount}</span>
                              <span>Falhas: {activeBatchErrorCount}</span>
                              <span>
                                Duracao: {formatDurationMs(activeBatchProgress?.duration_ms)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="meta-template-modal-toolbar">
                      <button
                        type="button"
                        className="meta-secondary-button"
                        onClick={handleOpenTemplateDetailsModal}
                        disabled={!selectedTemplateId}
                      >
                        Ver detalhes
                      </button>
                    </div>
                    <div className="meta-template-operation-progress" aria-label="Etapas da operacao do template">
                          <div className="meta-template-operation-progress__bar" aria-hidden="true">
                            <span
                              className="meta-template-operation-progress__fill"
                              style={{
                                width: templateOperationTab === "dispatch" ? "100%" : "50%",
                              }}
                            />
                          </div>
                          <div className="meta-template-operation-progress__steps">
                            <button
                              type="button"
                              className={`meta-template-operation-progress__step ${
                                templateOperationTab === "preview"
                                  ? "meta-template-operation-progress__step--active"
                                  : ""
                              }`}
                              onClick={() => setTemplateOperationTab("preview")}
                            >
                              <span className="meta-template-operation-progress__index">
                                1
                              </span>
                              <span className="meta-template-operation-progress__content">
                                <strong>Preview</strong>
                                <small>Configure e valide o template</small>
                              </span>
                            </button>
                            <button
                              type="button"
                              className={`meta-template-operation-progress__step ${
                                templateOperationTab === "dispatch"
                                  ? "meta-template-operation-progress__step--active"
                                  : ""
                              }`}
                              onClick={() => setTemplateOperationTab("dispatch")}
                            >
                              <span className="meta-template-operation-progress__index">
                                2
                              </span>
                              <span className="meta-template-operation-progress__content">
                                <strong>Disparo</strong>
                                <small>Escolha entre individual ou lote</small>
                              </span>
                            </button>
                          </div>
                    </div>

                    <div className="meta-template-metrics-summary meta-template-dispatch-shell">
                          {templateOperationTab === "preview" ? (
                            <>
                              <div className="meta-template-preview-layout">
                                <div className="meta-template-preview-layout__main">
                                  <div className="meta-template-dispatch-shell__header">
                                    <div>
                                      <h4>Operação do template</h4>
                                      <p>
                                        Configure os parametros do template, valide o preview
                                        e depois escolha o tipo de disparo.
                                      </p>
                                      <p>
                                        Conta atual: <strong>{selectedMetaAccountLabel}</strong>
                                      </p>
                                    </div>
                                  </div>

                                  <div className="meta-template-preview-summary-row">
                                    {selectedTemplateDispatchHints && (
                                      <div className="meta-template-metrics-summary meta-template-ops-summary">
                                        <p>
                                          <strong>Header:</strong>{" "}
                                          {formatDispatchHeaderHint(selectedTemplateDispatchHints)}
                                        </p>
                                        <p>
                                          <strong>Body:</strong>{" "}
                                          {formatDispatchBodyHint(selectedTemplateDispatchHints)}
                                        </p>
                                        <p>
                                          <strong>Botoes:</strong>{" "}
                                          {formatDispatchButtonsHint(selectedTemplateDispatchHints)}
                                        </p>
                                      </div>
                                    )}

                                    <div className="meta-field-grid meta-field-grid--template-base meta-template-ops-grid meta-template-preview-language">
                                      <label className="meta-template-ops-field">
                                        Idioma do disparo
                                        <input
                                          type="text"
                                          value={templateOperationLanguage}
                                          onChange={(event) =>
                                            setTemplateOperationLanguage(event.target.value)
                                          }
                                          placeholder="pt_BR"
                                        />
                                      </label>
                                    </div>
                                  </div>

                                  {selectedTemplateDispatchHints &&
                                    (selectedTemplateDispatchHints.headerParameterCount > 0 ||
                                      selectedTemplateDispatchHints.bodyParameterCount > 0 ||
                                      selectedTemplateDispatchHints.buttons.some(
                                        (button) => button.parameterCount > 0,
                                      )) && (
                                      <div className="meta-template-ops-dynamic">
                                        {selectedTemplateDispatchHints.headerParameterCount > 0 && (
                                          <div className="meta-template-ops-parameter-group">
                                            <h5>Parametros do header</h5>
                                            <div className="meta-template-ops-parameter-list">
                                              {selectedTemplateDispatchHints.headerParameterIndexes.map(
                                                (parameterIndex, index) => {
                                                  const currentParameter =
                                                    templateHeaderParameterValues[index] ||
                                                    createEmptyTemplateParameterInput();

                                                  return (
                                                    <label
                                                      key={`header-${parameterIndex}-${index}`}
                                                      className="meta-template-ops-field"
                                                    >
                                                      <span>{`Header {{${parameterIndex}}}`}</span>
                                                      <select
                                                        className="meta-template-select"
                                                        value={currentParameter.kind}
                                                        onChange={(event) => {
                                                          const nextKind =
                                                            event.target.value as TemplateParameterKind;
                                                          handleHeaderParameterChange(index, {
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
                                                              handleHeaderParameterChange(index, {
                                                                standardField:
                                                                  event.target
                                                                    .value as TemplateParameterStandardField,
                                                                nameFormat:
                                                                  event.target.value ===
                                                                  "contact_name"
                                                                    ? currentParameter.nameFormat
                                                                    : "full_name",
                                                              })
                                                            }
                                                          >
                                                            {TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS.map(
                                                              (option) => (
                                                                <option
                                                                  key={`header-field-${option.value}`}
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
                                                                handleHeaderParameterChange(index, {
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

                                                          <small className="meta-helper-text">
                                                            Valor preenchido automaticamente no
                                                            disparo.
                                                          </small>
                                                        </>
                                                      ) : (
                                                        <input
                                                          type="text"
                                                          value={currentParameter.text}
                                                          onChange={(event) =>
                                                            handleHeaderParameterChange(index, {
                                                              text: event.target.value,
                                                            })
                                                          }
                                                          placeholder={`Valor para {{${parameterIndex}}}`}
                                                        />
                                                      )}
                                                    </label>
                                                  );
                                                },
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {selectedTemplateDispatchHints.bodyParameterCount > 0 && (
                                          <div className="meta-template-ops-parameter-group">
                                            <h5>Parametros do body</h5>
                                            <div className="meta-template-ops-parameter-list">
                                              {selectedTemplateDispatchHints.bodyParameterIndexes.map(
                                                (parameterIndex, index) => {
                                                  const currentParameter =
                                                    templateBodyParameterValues[index] ||
                                                    createEmptyTemplateParameterInput();

                                                  return (
                                                    <label
                                                      key={`body-${parameterIndex}-${index}`}
                                                      className="meta-template-ops-field"
                                                    >
                                                      <span>{`Body {{${parameterIndex}}}`}</span>
                                                      <select
                                                        className="meta-template-select"
                                                        value={currentParameter.kind}
                                                        onChange={(event) => {
                                                          const nextKind =
                                                            event.target.value as TemplateParameterKind;
                                                          handleBodyParameterChange(index, {
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
                                                              handleBodyParameterChange(index, {
                                                                standardField:
                                                                  event.target
                                                                    .value as TemplateParameterStandardField,
                                                                nameFormat:
                                                                  event.target.value ===
                                                                  "contact_name"
                                                                    ? currentParameter.nameFormat
                                                                    : "full_name",
                                                              })
                                                            }
                                                          >
                                                            {TEMPLATE_PARAMETER_STANDARD_FIELD_OPTIONS.map(
                                                              (option) => (
                                                                <option
                                                                  key={`body-field-${option.value}`}
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
                                                                handleBodyParameterChange(index, {
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

                                                          <small className="meta-helper-text">
                                                            Valor preenchido automaticamente no
                                                            disparo.
                                                          </small>
                                                        </>
                                                      ) : (
                                                        <input
                                                          type="text"
                                                          value={currentParameter.text}
                                                          onChange={(event) =>
                                                            handleBodyParameterChange(index, {
                                                              text: event.target.value,
                                                            })
                                                          }
                                                          placeholder={`Valor para {{${parameterIndex}}}`}
                                                        />
                                                      )}
                                                    </label>
                                                  );
                                                },
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {selectedTemplateDispatchHints.buttons
                                          .filter((button) => button.parameterCount > 0)
                                          .map((button) => (
                                            <div
                                              key={`button-params-${button.index}`}
                                              className="meta-template-ops-parameter-group"
                                            >
                                              <h5>
                                                {`Botao ${button.index} ${
                                                  button.text ? `- ${button.text}` : ""
                                                }`}
                                              </h5>
                                              <div className="meta-template-ops-parameter-list">
                                                {button.parameterIndexes.map(
                                                  (parameterIndex, parameterOffset) => {
                                                    const currentParameter =
                                                      templateButtonParameterValues[
                                                        button.index
                                                      ]?.[parameterOffset] ||
                                                      createEmptyTemplateParameterInput();

                                                    return (
                                                      <label
                                                        key={`button-${button.index}-${parameterIndex}-${parameterOffset}`}
                                                        className="meta-template-ops-field"
                                                      >
                                                        <span>{`Parametro {{${parameterIndex}}}`}</span>
                                                        <select
                                                          className="meta-template-select"
                                                          value={currentParameter.kind}
                                                          onChange={(event) => {
                                                            const nextKind =
                                                              event.target
                                                                .value as TemplateParameterKind;
                                                            handleButtonParameterChange(
                                                              button.index,
                                                              parameterOffset,
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
                                                          <option value="manual">
                                                            Valor manual
                                                          </option>
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
                                                                handleButtonParameterChange(
                                                                  button.index,
                                                                  parameterOffset,
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
                                                                    key={`button-field-${button.index}-${option.value}`}
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
                                                                  handleButtonParameterChange(
                                                                    button.index,
                                                                    parameterOffset,
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

                                                            <small className="meta-helper-text">
                                                              Valor preenchido automaticamente no
                                                              disparo.
                                                            </small>
                                                          </>
                                                        ) : (
                                                          <input
                                                            type="text"
                                                            value={currentParameter.text}
                                                            onChange={(event) =>
                                                              handleButtonParameterChange(
                                                                button.index,
                                                                parameterOffset,
                                                                {
                                                                  text: event.target.value,
                                                                },
                                                              )
                                                            }
                                                            placeholder={`Valor para {{${parameterIndex}}}`}
                                                          />
                                                        )}
                                                      </label>
                                                    );
                                                  },
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    )}

                                  <label className="meta-template-ops-upload">
                                    <span>Arquivo para header de midia</span>
                                    <input
                                      className="meta-template-ops-file-input"
                                      type="file"
                                      onChange={(event) =>
                                        setTemplateHeaderFile(event.target.files?.[0] || null)
                                      }
                                    />
                                    <small className="meta-helper-text">
                                      {templateHeaderFile
                                        ? `Arquivo selecionado: ${templateHeaderFile.name}`
                                        : currentTemplateHeaderImageUrl
                                          ? "Imagem de header salva e pronta para reutilizar."
                                          : "Envie imagem, video ou documento quando o template exigir header de midia."}
                                    </small>
                                  </label>
                                </div>

                                {currentTemplateHeaderImageUrl ? (
                                  <aside className="meta-template-preview-layout__side">
                                    <div className="meta-template-saved-header-preview">
                                      <span>Preview da imagem salva</span>
                                      <img
                                        src={currentTemplateHeaderImageUrl}
                                        alt={`Header salvo do template ${selectedTemplateName || "template"}`}
                                        className="meta-template-preview-bubble-media-image"
                                      />
                                    </div>
                                  </aside>
                                ) : null}
                              </div>

                              <div className="meta-template-actions meta-template-ops-actions meta-template-ops-actions--end">
                                <button
                                  type="button"
                                  className="add-button"
                                  onClick={() => setTemplateOperationTab("dispatch")}
                                >
                                  Proximo
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div
                                className="meta-template-dispatch-mode-switch"
                                role="tablist"
                                aria-label="Modos de disparo"
                              >
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={templateDispatchMode === "single"}
                                  className={`meta-template-dispatch-mode-button ${
                                    templateDispatchMode === "single"
                                      ? "meta-template-dispatch-mode-button--active"
                                      : ""
                                  }`}
                                  onClick={() => setTemplateDispatchMode("single")}
                                >
                                  Disparo unitario
                                </button>
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={templateDispatchMode === "batch"}
                                  className={`meta-template-dispatch-mode-button ${
                                    templateDispatchMode === "batch"
                                      ? "meta-template-dispatch-mode-button--active"
                                      : ""
                                  }`}
                                  onClick={() => setTemplateDispatchMode("batch")}
                                >
                                  Disparo em lote
                                </button>
                              </div>

                              <MetaTemplatePreview
                                template={selectedTemplate}
                                language={templateOperationLanguage}
                                title="Preview do disparo"
                                className="meta-template-ops-preview"
                                headerParameters={templateHeaderParameterValues}
                                bodyParameters={templateBodyParameterValues}
                                buttonParameters={templateButtonParameterValues}
                                headerImageUrl={currentTemplateHeaderImageUrl}
                                headerFileName={templateHeaderFile?.name || ""}
                              />

                              {templateDispatchMode === "single" ? (
                            <div className="meta-template-block meta-template-ops-card">
                              <div className="meta-section-header">
                                <div>
                                  <h4>Disparo unitario</h4>
                                  <p>
                                    Selecione um cliente cadastrado e o sistema usa o
                                    telefone salvo nesse cadastro.
                                  </p>
                                </div>
                              </div>

                              <div className="meta-field-grid meta-field-grid--template-base meta-template-ops-grid">
                                <div className="meta-template-ops-field meta-template-ops-field--full">
                                  <span>Cliente destino</span>
                                  <input
                                    type="text"
                                    value={templateDispatchCustomerSearch}
                                    onChange={(event) => {
                                      setTemplateDispatchCustomerSearch(event.target.value);
                                      if (selectedTemplateDispatchCustomer) {
                                        setSelectedTemplateDispatchCustomer(null);
                                      }
                                    }}
                                    placeholder="Busque por nome, telefone ou email"
                                  />
                                  {isSearchingTemplateDispatchCustomer ? (
                                    <div className="meta-template-customer-search-status">
                                      Buscando clientes...
                                    </div>
                                  ) : null}
                                  {!selectedTemplateDispatchCustomer &&
                                  templateDispatchCustomerSuggestions.length > 0 ? (
                                    <div className="meta-template-customer-suggestions">
                                      {templateDispatchCustomerSuggestions.map((customer) => (
                                        <button
                                          key={`${customer.id}-${customer.telefone || customer.email || customer.nome}`}
                                          type="button"
                                          className="meta-template-customer-suggestion"
                                          onClick={() => {
                                            setSelectedTemplateDispatchCustomer(customer);
                                            setTemplateDispatchCustomerSearch(
                                              String(customer.nome || "").trim(),
                                            );
                                            setTemplateDispatchCustomerSuggestions([]);
                                          }}
                                        >
                                          <strong>{customer.nome || "Cliente sem nome"}</strong>
                                          <span>
                                            {customer.telefone ||
                                              customer.email ||
                                              "Sem contato"}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                  {selectedTemplateDispatchCustomer ? (
                                    <div className="meta-template-selected-customer">
                                      <div>
                                        <strong>
                                          {selectedTemplateDispatchCustomer.nome ||
                                            "Cliente selecionado"}
                                        </strong>
                                        <span>
                                          {selectedTemplateDispatchCustomer.telefone ||
                                            "Sem telefone"}
                                          {selectedTemplateDispatchCustomer.email
                                            ? ` | ${selectedTemplateDispatchCustomer.email}`
                                            : ""}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        className="meta-template-selected-customer__clear"
                                        onClick={() => {
                                          setSelectedTemplateDispatchCustomer(null);
                                          setTemplateDispatchCustomerSearch("");
                                          setTemplateDispatchCustomerSuggestions([]);
                                        }}
                                        title="Remover cliente selecionado"
                                      >
                                        <FiX size={16} />
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="meta-template-actions meta-template-ops-actions">
                                <button
                                  type="button"
                                  className="add-button"
                                  onClick={() => void handleDispatchTemplate()}
                                  disabled={isDispatchingTemplate}
                                >
                                  {isDispatchingTemplate
                                    ? "Disparando..."
                                    : "Disparar template"}
                                </button>
                              </div>

                              {templateOperationError ? (
                                <p className="meta-template-metrics-error">
                                  {templateOperationError}
                                </p>
                              ) : null}

                              {templateDispatchResult ? (
                                <details open className="meta-template-ops-result">
                                  <summary>Resultado do disparo unitario</summary>
                                  <pre>
                                    {JSON.stringify(templateDispatchResult, null, 2)}
                                  </pre>
                                </details>
                              ) : null}
                            </div>
                              ) : (
                                <div className="meta-template-block meta-template-ops-card">
                                  <div className="meta-section-header">
                                    <div>
                                      <h4>Disparo em lote</h4>
                                      <p>
                                        Selecione uma lista de transmissão para montar
                                        automaticamente os destinatarios do disparo em massa.
                                      </p>
                                    </div>
                                  </div>

                                  <label className="meta-template-ops-field meta-template-ops-field--full">
                                    Lista de transmissao
                                    <select
                                      className="meta-template-select"
                                      value={selectedBroadcastListId}
                                      onChange={(event) =>
                                        setSelectedBroadcastListId(event.target.value)
                                      }
                                      disabled={
                                        isLoadingBroadcastLists || isDispatchingTemplateBatch
                                      }
                                    >
                                      <option value="">
                                        {isLoadingBroadcastLists
                                          ? "Carregando listas..."
                                          : "Selecione uma lista"}
                                      </option>
                                      {broadcastLists.map((list) => (
                                        <option key={list.id} value={String(list.id)}>
                                          {`${list.nome} (${list.total_contatos} contato(s))${
                                            list.meta_display_phone_number
                                              ? ` - ${list.meta_display_phone_number}`
                                              : ""
                                          }`}
                                        </option>
                                      ))}
                                    </select>
                                    {selectedBroadcastList ? (
                                      <small className="meta-helper-text">
                                        Lista selecionada: {selectedBroadcastList.total_contatos || 0} contato(s).
                                      </small>
                                    ) : selectedBroadcastListContactCount !== null ? (
                                      <small className="meta-helper-text">
                                        Ultimo lote: {selectedBroadcastListContactCount} contato(s)
                                        carregado(s) da lista.
                                      </small>
                                    ) : null}
                                  </label>

                                  <label className="meta-template-checkbox">
                                    <input
                                      type="checkbox"
                                      checked={templateBatchLeadStartedMessagesGenerateAutoMessage}
                                      onChange={(event) =>
                                        setTemplateBatchLeadStartedMessagesGenerateAutoMessage(
                                          event.target.checked,
                                        )
                                      }
                                      disabled={isDispatchingTemplateBatch}
                                    />
                                    <span>Mensagens iniciadas pelo lead geram mensagens automaticas?</span>
                                  </label>

                                  <label className="meta-template-checkbox">
                                    <input
                                      type="checkbox"
                                      checked={templateBatchStopOnError}
                                      onChange={(event) =>
                                        setTemplateBatchStopOnError(event.target.checked)
                                      }
                                      disabled={isDispatchingTemplateBatch}
                                    />
                                    <span>Parar no primeiro erro</span>
                                  </label>

                                  <div className="meta-template-actions meta-template-ops-actions">
                                    <button
                                      type="button"
                                      className="add-button"
                                      onClick={() => void handleDispatchTemplateBatch()}
                                      disabled={isDispatchingTemplateBatch}
                                    >
                                      {isDispatchingTemplateBatch
                                        ? "Processando..."
                                        : "Processar lote"}
                                    </button>
                                  </div>

                              {templateOperationError ? (
                                <p className="meta-template-metrics-error">
                                  {templateOperationError}
                                </p>
                              ) : null}

                              {activeBatchProgress &&
                              (isDispatchingTemplateBatch || activeBatchTotalItems > 0) ? (
                                <div className="meta-batch-progress meta-batch-progress--card">
                                  <div className="meta-batch-progress__header">
                                    <span>
                                      Progresso do lote{" "}
                                      {activeBatchProgress.template_name ? (
                                        <strong>{activeBatchProgress.template_name}</strong>
                                      ) : null}
                                    </span>
                                    <strong>{activeBatchProgressPercent.toFixed(0)}%</strong>
                                  </div>
                                  <div
                                    className="meta-batch-progress__bar"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={activeBatchProgressPercent}
                                    aria-valuetext={`${activeBatchProgressPercent.toFixed(0)}%`}
                                  >
                                    <span
                                      className="meta-batch-progress__fill"
                                      style={{ width: `${activeBatchProgressPercent}%` }}
                                    />
                                  </div>
                                  <div className="meta-batch-progress__stats">
                                    <span>
                                      Processados: {activeBatchProcessedItems}/
                                      {activeBatchTotalItems}
                                    </span>
                                    <span>Enviados: {activeBatchSuccessCount}</span>
                                    <span>Falhas: {activeBatchErrorCount}</span>
                                    <span>
                                      Status:{" "}
                                      {String(activeBatchProgress.status || "processing")}
                                    </span>
                                  </div>
                                </div>
                              ) : null}

                                  {templateBatchResult ? (
                                    <div className="meta-batch-report">
                                  <div className="meta-batch-report__header">
                                    <div>
                                      <h5>Relatorio do disparo</h5>
                                      <p>
                                        Template{" "}
                                        <strong>
                                          {templateBatchResult.template_name ||
                                            selectedTemplateName}
                                        </strong>{" "}
                                        processado na conta atual.
                                      </p>
                                      <p>
                                        ID do disparo:{" "}
                                        <strong>
                                          {templateBatchResult.dispatch_history_id || "-"}
                                        </strong>{" "}
                                        | Template ID:{" "}
                                        <strong>
                                          {templateBatchResult.template_id || "-"}
                                        </strong>
                                      </p>
                                    </div>
                                    <div className="meta-batch-report__header-actions">
                                      {templateBatchResult.stopped_on_error ? (
                                        <span className="meta-batch-report__pill meta-batch-report__pill--warning">
                                          Interrompido no primeiro erro
                                        </span>
                                      ) : (
                                        <span className="meta-batch-report__pill meta-batch-report__pill--success">
                                          Lote finalizado
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        className="meta-secondary-button"
                                        onClick={handleExportBatchReport}
                                      >
                                        Baixar relatorio XLSX
                                      </button>
                                    </div>
                                  </div>

                                  <div className="meta-batch-report__summary">
                                    <article className="meta-batch-report__stat">
                                      <span>Total alvo</span>
                                      <strong>{templateBatchResult.total_items || 0}</strong>
                                    </article>
                                    <article className="meta-batch-report__stat">
                                      <span>Processados</span>
                                      <strong>
                                        {templateBatchResult.processed_items || 0}
                                      </strong>
                                    </article>
                                    <article className="meta-batch-report__stat">
                                      <span>Enviados</span>
                                      <strong>{templateBatchResult.success_count || 0}</strong>
                                    </article>
                                    <article className="meta-batch-report__stat">
                                      <span>Falhas</span>
                                      <strong>{templateBatchResult.error_count || 0}</strong>
                                    </article>
                                    <article className="meta-batch-report__stat">
                                      <span>Duracao</span>
                                      <strong>
                                        {formatDurationMs(templateBatchResult.duration_ms)}
                                      </strong>
                                    </article>
                                    <article className="meta-batch-report__stat">
                                      <span>Encerrado em</span>
                                      <strong>
                                        {formatDateTime(templateBatchResult.finished_at)}
                                      </strong>
                                    </article>
                                  </div>

                                  {batchCostSummary ? (
                                    <section className="meta-batch-report__section">
                                      <div className="meta-batch-report__section-header">
                                        <div>
                                          <h6>Custo calculado do disparo</h6>
                                          <p>
                                            Valor calculado pela regra interna definida no
                                            `.env`, usando o tipo do template e a quantidade
                                            de envios aceitos.
                                          </p>
                                        </div>
                                      </div>
                                      {batchCostSummary.message ? (
                                        <p className="meta-helper-text">
                                          {batchCostSummary.message}
                                        </p>
                                      ) : null}
                                      {batchCostSummary.summary ? (
                                        <div className="meta-batch-report__cost-grid">
                                          <article className="meta-batch-report__cost-card">
                                            <span>Categoria faturada</span>
                                            <strong>
                                              {String(
                                                batchCostSummary.category ||
                                                  templateBatchResult.template_category ||
                                                  "-",
                                              )}
                                            </strong>
                                          </article>
                                          <article className="meta-batch-report__cost-card">
                                            <span>Custo total</span>
                                            <strong>
                                              {formatDispatchCurrency(
                                                toSafeNumber(
                                                  batchCostSummary.summary.total_cost,
                                                ),
                                                String(batchCostRows[0]?.currency || "USD"),
                                              )}
                                            </strong>
                                          </article>
                                          <article className="meta-batch-report__cost-card">
                                            <span>Volume cobrado</span>
                                            <strong>
                                              {formatMetricNumber(
                                                toSafeNumber(
                                                  batchCostSummary.summary.total_volume,
                                                ),
                                              )}
                                            </strong>
                                          </article>
                                          <article className="meta-batch-report__cost-card">
                                            <span>Custo unitario</span>
                                            <strong>
                                              {formatDispatchCurrency(
                                                toSafeNumber(
                                                  batchCostSummary.summary.unit_cost ??
                                                    batchCostSummary.summary
                                                      .cost_per_message,
                                                ),
                                                String(batchCostRows[0]?.currency || "USD"),
                                              )}
                                            </strong>
                                          </article>
                                        </div>
                                      ) : null}
                                    </section>
                                  ) : null}

                                  <section className="meta-batch-report__section">
                                    <div className="meta-batch-report__section-header">
                                      <div>
                                        <h6>Falhas no lote</h6>
                                        <p>
                                          Destinatarios que nao foram enviados ou falharam
                                          durante o processamento.
                                        </p>
                                      </div>
                                      <strong>{batchFailureItems.length}</strong>
                                    </div>
                                    {batchFailureItems.length ? (
                                      <div className="meta-batch-report__list">
                                        {batchFailureItems.map((item, index) => (
                                          <article
                                            key={`batch-failure-${item.index ?? index}`}
                                            className="meta-batch-report__item meta-batch-report__item--error"
                                          >
                                            <div className="meta-batch-report__item-main">
                                              <strong>{getBatchResultTitle(item)}</strong>
                                              <span>{getBatchResultPhoneLabel(item)}</span>
                                            </div>
                                            <p>{getBatchResultErrorMessage(item)}</p>
                                            {item.error_code || item.error_subcode ? (
                                              <small className="meta-helper-text">
                                                Codigo: {String(item.error_code || "-")}
                                                {item.error_subcode
                                                  ? ` | Subcodigo: ${String(item.error_subcode)}`
                                                  : ""}
                                              </small>
                                            ) : null}
                                          </article>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="meta-batch-report__empty">
                                        Nenhuma falha registrada neste lote.
                                      </div>
                                    )}
                                  </section>

                                  <section className="meta-batch-report__section">
                                    <div className="meta-batch-report__section-header">
                                      <div>
                                        <h6>Envios concluidos</h6>
                                        <p>
                                          Destinatarios aceitos pela Meta para processamento.
                                        </p>
                                      </div>
                                      <strong>{batchSuccessItems.length}</strong>
                                    </div>
                                    {batchSuccessItems.length ? (
                                      <div className="meta-batch-report__list">
                                        {batchSuccessItems.map((item, index) => (
                                          <article
                                            key={`batch-success-${item.index ?? index}`}
                                            className="meta-batch-report__item meta-batch-report__item--success"
                                          >
                                            <div className="meta-batch-report__item-main">
                                              <strong>{getBatchResultTitle(item)}</strong>
                                              <span>{getBatchResultPhoneLabel(item)}</span>
                                            </div>
                                            <p>
                                              Message ID:{" "}
                                              <strong>{item.message_id || "-"}</strong>
                                            </p>
                                            <small className="meta-helper-text">
                                              Status inicial:{" "}
                                              {String(item.message_status || "accepted")}
                                            </small>
                                            <small className="meta-helper-text">
                                              Enviado em: {formatDateTime(item.enviado_em)}
                                              {item.recebido_em
                                                ? ` | Recebido em: ${formatDateTime(item.recebido_em)}`
                                                : ""}
                                            </small>
                                          </article>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="meta-batch-report__empty">
                                        Nenhum envio concluido neste lote.
                                      </div>
                                    )}
                                  </section>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </>
                          )}
                    </div>
                  </div>
                </article>
              </div>  );
}


