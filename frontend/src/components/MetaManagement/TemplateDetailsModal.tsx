import type { TemplateMetricDataPoint, TemplateMetricsResult } from "../../service/metaService";
import {
  formatMetricNumber,
  formatUnixDate,
  formatUnixDateUtc,
  getMetricValues,
  mapMetricTypedValues,
  toSafeNumber,
} from "./MetaApiManagement.helpers";

type MetricAggregate = {
  label: string;
  total: number;
};

type TemplateDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedTemplateName: string;
  metricsStartDate: string;
  setMetricsStartDate: (value: string) => void;
  metricsEndDate: string;
  setMetricsEndDate: (value: string) => void;
  handleApplyMetricsPeriod: () => void | Promise<void>;
  isLoadingTemplateMetrics: boolean;
  isApplyingMetricsPeriod: boolean;
  selectedTemplateId: string | null;
  templateMetricsError: string;
  currentTemplateMetrics: TemplateMetricsResult | null | undefined;
  currentMetricTotals: {
    sent: number;
    delivered: number;
    read: number;
    replied: number;
  };
  currentMetricCostTotals: MetricAggregate[];
  currentMetricClickTotals: MetricAggregate[];
  visibleMetricPoints: TemplateMetricDataPoint[];
};

export function TemplateDetailsModal({
  isOpen,
  onClose,
  selectedTemplateName,
  metricsStartDate,
  setMetricsStartDate,
  metricsEndDate,
  setMetricsEndDate,
  handleApplyMetricsPeriod,
  isLoadingTemplateMetrics,
  isApplyingMetricsPeriod,
  selectedTemplateId,
  templateMetricsError,
  currentTemplateMetrics,
  currentMetricTotals,
  currentMetricCostTotals,
  currentMetricClickTotals,
  visibleMetricPoints,
}: TemplateDetailsModalProps) {  if (!isOpen) return null;

  return (
              <div
                className="meta-template-metrics-modal-backdrop"
                onClick={onClose}
              >
                <article
                  className="meta-template-metrics-modal meta-template-metrics-modal--details"
                  onClick={(event) => event.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="template-details-title"
                >
                  <header className="meta-template-metrics-modal-header">
                    <h4 id="template-details-title">
                      Detalhes do template: {selectedTemplateName}
                    </h4>
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={onClose}
                    >
                      Fechar
                    </button>
                  </header>

                  <div className="meta-template-metrics-modal-content">
                    <div className="meta-template-metrics-filters">
                      <label>
                        Data inicial
                        <input
                          type="date"
                          value={metricsStartDate}
                          onChange={(event) => setMetricsStartDate(event.target.value)}
                        />
                      </label>
                      <label>
                        Data final
                        <input
                          type="date"
                          value={metricsEndDate}
                          onChange={(event) => setMetricsEndDate(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="add-button"
                        onClick={() => void handleApplyMetricsPeriod()}
                        disabled={
                          isLoadingTemplateMetrics ||
                          isApplyingMetricsPeriod ||
                          !selectedTemplateId
                        }
                      >
                        {isApplyingMetricsPeriod ? "Aplicando..." : "Aplicar período"}
                      </button>
                    </div>

                    {isLoadingTemplateMetrics && <p>Carregando métricas...</p>}

                    {!isLoadingTemplateMetrics &&
                      templateMetricsError &&
                      !currentTemplateMetrics && (
                        <p className="meta-template-metrics-error">
                          {templateMetricsError}
                        </p>
                      )}

                    {!isLoadingTemplateMetrics && currentTemplateMetrics && (
                      <>
                        <div className="meta-template-metrics-summary">
                          <p>
                            <strong>Template ID:</strong>{" "}
                            {currentTemplateMetrics.filters?.template_id || "-"}
                          </p>
                          <p>
                            <strong>Período:</strong>{" "}
                            {formatUnixDate(currentTemplateMetrics.filters?.start)} até{" "}
                            {formatUnixDate(currentTemplateMetrics.filters?.end)}
                          </p>
                          <p>
                            <strong>Resumo:</strong> Enviadas {currentMetricTotals.sent} |
                            Entregues {currentMetricTotals.delivered} | Lidas{" "}
                            {currentMetricTotals.read} | Respondidas{" "}
                            {currentMetricTotals.replied}
                          </p>
                          <p>
                            <strong>Custos US$ (Dólar) (total por tipo):</strong>{" "}
                            {currentMetricCostTotals.length
                              ? currentMetricCostTotals
                                  .map(
                                    (item) =>
                                      `${item.label}: ${formatMetricNumber(item.total)}`,
                                  )
                                  .join(" | ")
                              : "-"}
                          </p>
                          <p>
                            <strong>Cliques (total por tipo/botão):</strong>{" "}
                            {currentMetricClickTotals.length
                              ? currentMetricClickTotals
                                  .map(
                                    (item) =>
                                      `${item.label}: ${formatMetricNumber(item.total)}`,
                                  )
                                  .join(" | ")
                              : "-"}
                          </p>
                        </div>

                        <div className="meta-template-metrics-list">
                          {visibleMetricPoints.length === 0 ? (
                            <p>Nenhum ponto com envio retornado para o período.</p>
                          ) : (
                            visibleMetricPoints.map((point, pointIndex) => (
                              <div
                                key={`${selectedTemplateId || "template"}-${point.start || pointIndex}`}
                                className="meta-template-metrics-row"
                              >
                                {(() => {
                                  const costValues = getMetricValues(point, "cost");
                                  const clickedValues = getMetricValues(point, "clicked");
                                  const mappedCostValues = mapMetricTypedValues(costValues, "value");
                                  const mappedClickedValues = mapMetricTypedValues(
                                    clickedValues,
                                    "count",
                                  );
                                  return (
                                    <div className="meta-template-metrics-row-details">
                                      <p>
                                        <strong>Data:</strong>{" "}
                                        {formatUnixDateUtc(point.start)} até{" "}
                                        {formatUnixDateUtc(point.end)}
                                      </p>
                                      <p>
                                        <strong>Enviadas:</strong> {toSafeNumber(point.sent)} |{" "}
                                        <strong>Entregues:</strong>{" "}
                                        {toSafeNumber(point.delivered)} |{" "}
                                        <strong>Lidas:</strong> {toSafeNumber(point.read)} |{" "}
                                        <strong>Respondidas:</strong> {toSafeNumber(point.replied)}
                                      </p>
                                      <p>
                                        <strong>Custo US$ (Dólar):</strong>
                                      </p>
                                      {mappedCostValues.length > 0 ? (
                                        <ul className="meta-template-metrics-bullets">
                                          {mappedCostValues.map((item) => (
                                            <li key={item}>{item}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p>-</p>
                                      )}
                                      <p>
                                        <strong>Cliques:</strong>
                                      </p>
                                      {mappedClickedValues.length > 0 ? (
                                        <ul className="meta-template-metrics-bullets">
                                          {mappedClickedValues.map((item) => (
                                            <li key={item}>{item}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p>-</p>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </article>
              </div>  );
}


