import { useEffect, useMemo, useState } from "react";
import { MetaManagementSettings } from "../../components/MetaManagement/MetaApiManagement";
import { MetaAdsManagementSettings } from "../../components/MetaManagement/MetaAdsManagement";
import { MetaIgManagementSettings } from "../../components/MetaManagement/MetaInstagramManagement";
import { MetaDispatchHistoryReport } from "../../components/MetaManagement/MetaDispatchHistoryReport";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { useAuth } from "../../contexts/AuthContext";
import "./MetaManagementPage.css";

type MetaManagementTab =
  | "api-meta"
  | "meta-ads"
  | "meta-instagram"
  | "meta-dispatch-report";

export function MetaManagementPage() {
  const { hasPermission } = useAuth();
  const canViewMeta = hasPermission("meta.view");
  const canViewMetaAds = hasPermission("meta_ads.view");
  const allowedTabs = useMemo<MetaManagementTab[]>(() => {
    const tabs: MetaManagementTab[] = [];

    if (canViewMeta) {
      tabs.push("api-meta", "meta-dispatch-report", "meta-instagram");
    }

    if (canViewMetaAds) {
      tabs.push("meta-ads");
    }

    return tabs;
  }, [canViewMeta, canViewMetaAds]);
  const [activeTab, setActiveTab] = useState<MetaManagementTab>(
    canViewMeta ? "api-meta" : "meta-ads"
  );
  const [isTabLoading, setIsTabLoading] = useState(true);

  useEffect(() => {
    if (!allowedTabs.length) return;

    if (!allowedTabs.includes(activeTab)) {
      setIsTabLoading(true);
      setActiveTab(allowedTabs[0]);
    }
  }, [activeTab, allowedTabs]);

  const handleTabChange = (tab: MetaManagementTab) => {
    if (tab === activeTab) return;
    setIsTabLoading(true);
    setActiveTab(tab);
  };

  return (
    <div className="meta-management-page-layout">
      <MobileHeader title="Gestão da Meta" />

      <header className="meta-management-header">
        <h1>Gestão da Meta</h1>
      </header>
      <nav className="meta-management-tabs">
        {canViewMeta && (
          <button
            type="button"
            className={activeTab === "api-meta" ? "active" : ""}
            onClick={() => handleTabChange("api-meta")}
          >
            API Meta
          </button>
        )}
        {canViewMetaAds && (
          <button
            type="button"
            className={activeTab === "meta-ads" ? "active" : ""}
            onClick={() => handleTabChange("meta-ads")}
          >
            Meta Ads
          </button>
        )}
        {canViewMeta && (
          <button
            type="button"
            className={activeTab === "meta-dispatch-report" ? "active" : ""}
            onClick={() => handleTabChange("meta-dispatch-report")}
          >
            Relatorio de envios
          </button>
        )}
        {canViewMeta && (
          <button
            type="button"
            className={activeTab === "meta-instagram" ? "active" : ""}
            onClick={() => handleTabChange("meta-instagram")}
          >
            Instagram
          </button>
        )}
      </nav>

      <main className="meta-management-content">
        <section className="meta-management-tab-content">
          {isTabLoading ? (
            <div className="meta-management-tab-loading" aria-live="polite">
              <div
                className="meta-management-tab-loading__spinner"
                aria-hidden="true"
              />
              <div className="meta-management-tab-loading__text">
                <strong>Carregando...</strong>
                <span>
                  Aguarde enquanto a Meta termina de preparar os dados.
                </span>
              </div>
            </div>
          ) : null}

          <div
            className={`meta-management-tab-panel ${
              isTabLoading ? "is-loading" : ""
            }`}
          >
            {activeTab === "api-meta" && (
              <MetaManagementSettings onInitialLoadChange={setIsTabLoading} />
            )}
            {activeTab === "meta-ads" && (
              <MetaAdsManagementSettings onInitialLoadChange={setIsTabLoading} />
            )}
            {activeTab === "meta-instagram" && (
              <MetaIgManagementSettings onInitialLoadChange={setIsTabLoading} />
            )}
            {activeTab === "meta-dispatch-report" && (
              <MetaDispatchHistoryReport onInitialLoadChange={setIsTabLoading} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
