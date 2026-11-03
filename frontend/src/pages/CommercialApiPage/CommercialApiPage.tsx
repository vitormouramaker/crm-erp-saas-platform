import { useEffect, useState } from "react";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { memo, useMemo } from "react";
import { CommercialClosedDeals } from "../../components/commercial/ClosedDeals/CommercialClosedDeals";
import { CommercialConsolidatedSales } from "../../components/commercial/ConsolidatedSales/CommercialConsolidatedSales";
import { CommercialDashboard } from "../../components/commercial/Dashboard/CommercialDashboard";
import { CommercialPipeline } from "../../components/commercial/Pipeline/CommercialPipeline";
import { CommercialReports } from "../../components/commercial/Reports/CommercialReports";
import { CommercialScheduledDispatches } from "../../components/commercial/ScheduledDispatches/CommercialScheduledDispatches";
import CommercialSettings from "../../components/commercial/Settings/CommercialSettings";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { getCommercialCrms, type CommercialCrm } from "../../service/commercialService";
import "./CommercialApiPage.css";
import "../../components/commercial/Settings/CommercialSettings.css";

type Tab =
  | "pipeline"
  | "closed_deals"
  | "sales"
  | "scheduled_dispatches"
  | "dashboard"
  | "reports"
  | "settings";

const TAB_CONFIG: Array<{ key: Tab; label: string; permission: string }> = [
  { key: "pipeline", label: "Pipeline", permission: "commercial.pipeline" },
  { key: "closed_deals", label: "Fechadas", permission: "commercial.pipeline" },
  { key: "sales", label: "Vendas", permission: "commercial.pipeline" },
  {
    key: "scheduled_dispatches",
    label: "Agendar disparos",
    permission: "commercial.scheduled_dispatches",
  },
  { key: "dashboard", label: "Dashboard", permission: "commercial.dashbord" },
  { key: "reports", label: "Relatorios", permission: "commercial.report" },
  { key: "settings", label: "Configurações", permission: "commercial.view" },
];

const MemoCommercialPipeline = memo(CommercialPipeline);
const MemoCommercialClosedDeals = memo(CommercialClosedDeals);
const MemoCommercialConsolidatedSales = memo(CommercialConsolidatedSales);
const MemoCommercialScheduledDispatches = memo(CommercialScheduledDispatches);
const MemoCommercialDashboard = memo(CommercialDashboard);
const MemoCommercialReports = memo(CommercialReports);
const MemoCommercialSettings = memo(CommercialSettings);

export function CommercialApiPage() {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("pipeline");
  const [visitedTabs, setVisitedTabs] = useState<Record<Tab, boolean>>({
    pipeline: true,
    closed_deals: false,
    sales: false,
    scheduled_dispatches: false,
    dashboard: false,
    reports: false,
    settings: false,
  });
  const [crms, setCrms] = useState<CommercialCrm[]>([]);
  const [selectedCrmId, setSelectedCrmId] = useState<number | null>(null);
  const [loadingCrms, setLoadingCrms] = useState(true);
  const visibleTabs = useMemo(
    () => TAB_CONFIG.filter((tab) => hasPermission(tab.permission)),
    [hasPermission]
  );

  useEffect(() => {
    if (!visibleTabs.length) return;

    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      const fallbackTab = visibleTabs[0].key;
      setActiveTab(fallbackTab);
      setVisitedTabs((prev) => ({ ...prev, [fallbackTab]: true }));
    }
  }, [activeTab, visibleTabs]);

  const loadCrms = async () => {
    setLoadingCrms(true);
    try {
      const list = await getCommercialCrms();
      setCrms(list);

      if (!list.length) {
        setSelectedCrmId(null);
        if (hasPermission("commercial.view")) {
          setActiveTab("settings");
          setVisitedTabs((prev) => ({ ...prev, settings: true }));
        }
        return;
      }

      setSelectedCrmId((prev) => {
        if (prev && list.some((crm) => Number(crm.id) === Number(prev))) {
          return prev;
        }
        return Number(list.find((crm) => crm.ativo !== false)?.id || list[0].id);
      });
    } catch (error) {
      console.error("Erro ao carregar funis:", error);
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os funis.",
      });
    } finally {
      setLoadingCrms(false);
    }
  };

  useEffect(() => {
    void loadCrms();
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
  };

  return (
    <div className="commercial-module">
      <MobileHeader title="Comercial API" />

      <div className="commercial-toolbar">
        <div className="commercial-nav">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              className={`nav-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== "sales" ? <div className="crm-selector-wrap">
          <label htmlFor="crm-selector">Funil</label>
          <select
            id="crm-selector"
            value={selectedCrmId ?? ""}
            onChange={(e) => setSelectedCrmId(e.target.value ? Number(e.target.value) : null)}
            disabled={loadingCrms || !crms.length}
          >
            {!crms.length && <option value="">Sem funil</option>}
            {crms.map((crm) => (
              <option key={crm.id} value={crm.id}>
                {crm.nome}
              </option>
            ))}
          </select>
        </div> : null}
      </div>

      <main className="commercial-content">
        {hasPermission("commercial.pipeline") && activeTab === "pipeline" && (
          <section className="commercial-tab-panel active">
            <MemoCommercialPipeline crmId={selectedCrmId} />
          </section>
        )}
        {hasPermission("commercial.pipeline") && visitedTabs.closed_deals && (
          <section className={`commercial-tab-panel ${activeTab === "closed_deals" ? "active" : "hidden"}`}>
            <MemoCommercialClosedDeals crmId={selectedCrmId} />
          </section>
        )}
        {hasPermission("commercial.pipeline") && visitedTabs.sales && (
          <section className={`commercial-tab-panel ${activeTab === "sales" ? "active" : "hidden"}`}>
            <MemoCommercialConsolidatedSales />
          </section>
        )}
        {hasPermission("commercial.scheduled_dispatches") && visitedTabs.scheduled_dispatches && (
          <section
            className={`commercial-tab-panel ${
              activeTab === "scheduled_dispatches" ? "active" : "hidden"
            }`}
          >
            <MemoCommercialScheduledDispatches crms={crms} selectedCrmId={selectedCrmId} />
          </section>
        )}
        {hasPermission("commercial.dashbord") && visitedTabs.dashboard && (
          <section className={`commercial-tab-panel ${activeTab === "dashboard" ? "active" : "hidden"}`}>
            <MemoCommercialDashboard crmId={selectedCrmId} />
          </section>
        )}
        {hasPermission("commercial.report") && visitedTabs.reports && (
          <section className={`commercial-tab-panel ${activeTab === "reports" ? "active" : "hidden"}`}>
            <MemoCommercialReports crmId={selectedCrmId} />
          </section>
        )}
        {hasPermission("commercial.view") && visitedTabs.settings && (
          <section
            className={`commercial-tab-panel commercial-tab-panel-settings ${
              activeTab === "settings" ? "active" : "hidden"
            }`}
          >
            <MemoCommercialSettings
              crms={crms}
              selectedCrmId={selectedCrmId}
              onSelectCrm={setSelectedCrmId}
              onRefreshCrms={loadCrms}
            />
          </section>
        )}
      </main>
    </div>
  );
}
