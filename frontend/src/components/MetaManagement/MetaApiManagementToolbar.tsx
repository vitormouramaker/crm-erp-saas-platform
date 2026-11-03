import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import type { MetaIntegrationAccount } from "../../service/metaService";
import {
  getMetaAccountPrimaryLabel,
  getMetaAccountSecondaryLabel,
  type MetaViewTab,
} from "./MetaApiManagement.helpers";

type MetaApiManagementToolbarProps = {
  activeMetaViewTab: MetaViewTab;
  setActiveMetaViewTab: (tab: MetaViewTab) => void;
  isIntegrationActive: boolean;
  linkedMetaAccounts: MetaIntegrationAccount[];
  isAccountPanelExpanded: boolean;
  setIsAccountPanelExpanded: (updater: (current: boolean) => boolean) => void;
  selectedMetaAccountLabel: string;
  selectedMetaAccountOfficialLabel: string;
  selectedMetaAccountTechnicalLabel: string;
  selectedMetaParamId: string;
  setSelectedMetaParamId: (value: string) => void;
};

export function MetaApiManagementToolbar({
  activeMetaViewTab,
  setActiveMetaViewTab,
  isIntegrationActive,
  linkedMetaAccounts,
  isAccountPanelExpanded,
  setIsAccountPanelExpanded,
  selectedMetaAccountLabel,
  selectedMetaAccountOfficialLabel,
  selectedMetaAccountTechnicalLabel,
  selectedMetaParamId,
  setSelectedMetaParamId,
}: MetaApiManagementToolbarProps) {  return (
    <div className="meta-management-toolbar">
            <div
              className="meta-ads-campaigns-actions meta-ig-insights-media-tabs meta-management-view-tabs"
              role="tablist"
              aria-label="Selecione a visualizacao da Meta"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeMetaViewTab === "whatsapp_profile"}
                className={
                  activeMetaViewTab === "whatsapp_profile"
                    ? "meta-secondary-button meta-ig-insights-media-tab meta-ig-insights-media-tab--active"
                    : "meta-secondary-button meta-ig-insights-media-tab"
                }
                onClick={() => setActiveMetaViewTab("whatsapp_profile")}
              >
                Perfil do WhatsApp
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeMetaViewTab === "templates"}
                className={
                  activeMetaViewTab === "templates"
                    ? "meta-secondary-button meta-ig-insights-media-tab meta-ig-insights-media-tab--active"
                    : "meta-secondary-button meta-ig-insights-media-tab"
                }
                onClick={() => setActiveMetaViewTab("templates")}
              >
                Templates da Meta
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeMetaViewTab === "dispatch_costs"}
                className={
                  activeMetaViewTab === "dispatch_costs"
                    ? "meta-secondary-button meta-ig-insights-media-tab meta-ig-insights-media-tab--active"
                    : "meta-secondary-button meta-ig-insights-media-tab"
                }
                onClick={() => setActiveMetaViewTab("dispatch_costs")}
              >
                Custos de disparo
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeMetaViewTab === "auto_messages"}
                className={
                  activeMetaViewTab === "auto_messages"
                    ? "meta-secondary-button meta-ig-insights-media-tab meta-ig-insights-media-tab--active"
                    : "meta-secondary-button meta-ig-insights-media-tab"
                }
                onClick={() => setActiveMetaViewTab("auto_messages")}
              >
                Mensagens automaticas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeMetaViewTab === "automation_schedule"}
                className={
                  activeMetaViewTab === "automation_schedule"
                    ? "meta-secondary-button meta-ig-insights-media-tab meta-ig-insights-media-tab--active"
                    : "meta-secondary-button meta-ig-insights-media-tab"
                }
                onClick={() => setActiveMetaViewTab("automation_schedule")}
              >
                Agendamento de automação
              </button>
            </div>

            {isIntegrationActive && linkedMetaAccounts.length > 0 ? (
              <section
                className={`meta-management-account-panel ${
                  isAccountPanelExpanded ? "is-expanded" : ""
                }`}
              >
                <div className="meta-management-account-panel__top">
                  <div className="meta-management-account-panel__title-group">
                    <h3>Conta ativa</h3>
                    <button
                      type="button"
                      className="meta-management-account-panel__toggle"
                      onClick={() => setIsAccountPanelExpanded((current) => !current)}
                      aria-expanded={isAccountPanelExpanded}
                      aria-label={
                        isAccountPanelExpanded
                          ? "Ver menos detalhes da conta"
                          : "Ver mais detalhes da conta"
                      }
                    >
                      <span>
                        {isAccountPanelExpanded ? "Ver menos" : "Ver mais"}
                      </span>
                      <span
                        className="meta-management-account-panel__toggle-icon"
                        aria-hidden="true"
                      >
                        {isAccountPanelExpanded ? <FiChevronUp /> : <FiChevronDown />}
                      </span>
                    </button>
                  </div>
                  <label className="meta-template-ops-field meta-management-account-panel__select">
                    <select
                      className="meta-template-select meta-management-account-panel__select-control"
                      value={selectedMetaParamId}
                      onChange={(event) => setSelectedMetaParamId(event.target.value)}
                      disabled={linkedMetaAccounts.length <= 1}
                    >
                      {linkedMetaAccounts.map((account, index) => {
                        const accountId = String(account.id || "");
                        const primaryLabel = getMetaAccountPrimaryLabel(account, index);
                        const secondaryLabel = getMetaAccountSecondaryLabel(account);

                        return (
                          <option key={accountId || primaryLabel} value={accountId}>
                            {primaryLabel} - {secondaryLabel}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>

                <div className="meta-management-account-panel__details">
                  <div className="meta-management-account-panel__header">
                    <p>
                      Escolha aqui qual numero da Meta sera usado para templates,
                      metricas e custos.
                    </p>
                  </div>

                  <div className="meta-management-account-panel__summary">
                    <div className="meta-summary-field meta-management-account-panel__summary-field meta-management-account-panel__summary-field--primary">
                      <span>Numero em uso</span>
                      <strong>{selectedMetaAccountLabel}</strong>
                    </div>
                    <div className="meta-summary-field meta-management-account-panel__summary-field">
                      <span>Conta oficial</span>
                      <strong>{selectedMetaAccountOfficialLabel}</strong>
                    </div>
                    <div className="meta-summary-field meta-management-account-panel__summary-field">
                      <span>ID tecnico</span>
                      <strong>{selectedMetaAccountTechnicalLabel}</strong>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
    </div>
  );
}


