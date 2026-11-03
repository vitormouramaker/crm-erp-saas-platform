import type { DispatchCostMetricsResult, DispatchCostRow } from "../../service/metaService";
import {
  formatMetricNumber,
  formatUnixDateUtc,
  toSafeNumber,
} from "./MetaApiManagement.helpers";

type DispatchCostsSectionProps = {
  selectedMetaAccountLabel: string;
  dispatchCostStartDate: string;
  setDispatchCostStartDate: (value: string) => void;
  dispatchCostEndDate: string;
  setDispatchCostEndDate: (value: string) => void;
  handleLoadDispatchCosts: () => void | Promise<void>;
  isLoadingDispatchCostMetrics: boolean;
  dispatchCostError: string;
  dispatchCostMetrics: DispatchCostMetricsResult | null;
  dispatchCostRows: DispatchCostRow[];
};

export function DispatchCostsSection({
  selectedMetaAccountLabel,
  dispatchCostStartDate,
  setDispatchCostStartDate,
  dispatchCostEndDate,
  setDispatchCostEndDate,
  handleLoadDispatchCosts,
  isLoadingDispatchCostMetrics,
  dispatchCostError,
  dispatchCostMetrics,
  dispatchCostRows,
}: DispatchCostsSectionProps) {  return (
            <section className="meta-config-section">
              <div className="meta-template-list-section">
                <div className="meta-template-list-header">
                  <div>
                    <h3>Custos de disparo</h3>
                    <p>
                      Acompanhe o custo agregado dos envios para o periodo
                      selecionado.
                    </p>
                    <p>
                      Conta atual: <strong>{selectedMetaAccountLabel}</strong>
                    </p>
                  </div>
                  <div className="meta-template-actions">
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={() => void handleLoadDispatchCosts()}
                      disabled={isLoadingDispatchCostMetrics}
                    >
                      {isLoadingDispatchCostMetrics
                        ? "Consultando..."
                        : "Atualizar custos"}
                    </button>
                  </div>
                </div>

                <div className="meta-template-metrics-filters">
                  <label>
                    Data inicial
                    <input
                      type="date"
                      value={dispatchCostStartDate}
                      onChange={(event) =>
                        setDispatchCostStartDate(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Data final
                    <input
                      type="date"
                      value={dispatchCostEndDate}
                      onChange={(event) =>
                        setDispatchCostEndDate(event.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="add-button"
                    onClick={() => void handleLoadDispatchCosts()}
                    disabled={isLoadingDispatchCostMetrics}
                  >
                    {isLoadingDispatchCostMetrics
                      ? "Carregando..."
                      : "Aplicar periodo"}
                  </button>
                </div>

                {dispatchCostError ? (
                  <p className="meta-template-metrics-error">
                    {dispatchCostError}
                  </p>
                ) : null}

                {dispatchCostMetrics?.summary ? (
                  <div className="meta-template-metrics-summary">
                    <p>
                      <strong>Custo total:</strong>{" "}
                      {formatMetricNumber(
                        toSafeNumber(dispatchCostMetrics.summary.total_cost),
                      )}
                    </p>
                    <p>
                      <strong>Volume total:</strong>{" "}
                      {formatMetricNumber(
                        toSafeNumber(dispatchCostMetrics.summary.total_volume),
                      )}
                    </p>
                    <p>
                      <strong>Custo por mensagem:</strong>{" "}
                      {formatMetricNumber(
                        toSafeNumber(
                          dispatchCostMetrics.summary.cost_per_message,
                        ),
                      )}
                    </p>
                  </div>
                ) : null}

                {dispatchCostRows.length > 0 ? (
                  <div className="meta-template-metrics-list">
                    {dispatchCostRows.slice(0, 12).map((row, index) => (
                      <div
                        key={`${row.start || "cost"}-${index}`}
                        className="meta-template-metrics-row"
                      >
                        <div className="meta-template-metrics-row-details">
                          <p>
                            <strong>Periodo:</strong>{" "}
                            {formatUnixDateUtc(row.start || 0)} ate{" "}
                            {formatUnixDateUtc(row.end || 0)}
                          </p>
                          <p>
                            <strong>Custo:</strong>{" "}
                            {formatMetricNumber(toSafeNumber(row.cost))}{" "}
                            {row.currency || "USD"}
                          </p>
                          <p>
                            <strong>Volume:</strong>{" "}
                            {formatMetricNumber(toSafeNumber(row.volume))}
                          </p>
                          <p>
                            <strong>Custo/mensagem:</strong>{" "}
                            {formatMetricNumber(
                              toSafeNumber(row.cost_per_message),
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>  );
}

