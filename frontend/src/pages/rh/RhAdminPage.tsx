import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Feriados } from "./Feriados";
import { Ferias } from "./Ferias";
import { Funcionarios } from "./Funcionarios";
import { HorariosTrabalho } from "./HorariosTrabalho";
import { Justificativa } from "./Justificativa";
import { RelatorioPonto } from "./RelatorioPonto";
import { ValidarDayOff } from "./ValidarDayOff";
import "./RhAdminPage.css";

type RhAdminTab =
  | "justificativas"
  | "day-off"
  | "funcionarios"
  | "horarios"
  | "feriados"
  | "ferias"
  | "relatorio";

const RH_ADMIN_TABS: Array<{ key: RhAdminTab; label: string }> = [
  { key: "justificativas", label: "Justificativas" },
  { key: "day-off", label: "Validar day-off" },
  { key: "funcionarios", label: "Funcionarios" },
  { key: "horarios", label: "Horarios" },
  { key: "feriados", label: "Feriados" },
  { key: "ferias", label: "Férias" },
  { key: "relatorio", label: "Relatório" },
];

/*
function RhAdminPlaceholder(props: {
  title: string;
  description: string;
  route?: string;
}) {
  const navigate = null;

  return (
    <section className="rh-admin-placeholder">
      <h2>{props.title}</h2>
      <p>{props.description}</p>
      {props.route && (
        <button
          className="rh-admin-placeholder__button"
          type="button"
          onClick={() => navigate(props.route!)}
        >
          Abrir página dedicada
        </button>
      )}
    </section>
  );
}
*/

export function RhAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") as RhAdminTab | null;
  const [activeTab, setActiveTab] = useState<RhAdminTab>(
    initialTab && RH_ADMIN_TABS.some((tab) => tab.key === initialTab)
      ? initialTab
      : "justificativas",
  );

  const currentTab = useMemo(
    () => RH_ADMIN_TABS.find((tab) => tab.key === activeTab) || RH_ADMIN_TABS[0],
    [activeTab],
  );

  useEffect(() => {
    const tab = searchParams.get("tab") as RhAdminTab | null;
    if (tab && RH_ADMIN_TABS.some((item) => item.key === tab) && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [activeTab, searchParams]);

  const handleChangeTab = (tab: RhAdminTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next);
  };

  return (
    <div className="rh-admin-page-layout">
      <MobileHeader title="Gestão de RH" />

      <header className="rh-admin-header">
        <div className="rh-admin-header__content">
          <h1>Gestão de RH</h1>
          <p>
            Centralize as rotas administrativas do módulo de ponto em uma navegação
            por abas.
          </p>
        </div>
      </header>

      <nav className="rh-admin-tabs">
        {RH_ADMIN_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleChangeTab(tab.key)}
            className={currentTab.key === tab.key ? "active" : ""}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="rh-admin-content">
        {activeTab === "justificativas" && <Justificativa embedded />}
        {activeTab === "day-off" && <ValidarDayOff />}
        {activeTab === "funcionarios" && <Funcionarios embedded />}
        {activeTab === "horarios" && <HorariosTrabalho embedded />}
        {activeTab === "feriados" && <Feriados embedded />}
        {activeTab === "ferias" && <Ferias embedded />}
        {activeTab === "relatorio" && <RelatorioPonto embedded />}
      </main>
    </div>
  );
}

