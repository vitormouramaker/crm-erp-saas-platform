import { useState } from "react";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { RegisterSaleForm } from "../../components/RegisterSaleForm/RegisterSaleForm";
import { SalesHistory } from "../../components/SalesHistory/SalesHistory"; // NOVO
import "./SalesPage.css";

type SalesTab = "register" | "history";

export function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>("register");

  return (
    <div className="sales-page-layout">
      <MobileHeader title="Vendas" />
      <header className="sales-header">
        <h1>Registro de Vendas</h1>
      </header>

      <nav className="sales-tabs">
        <button
          className={`tab-button ${activeTab === "register" ? "active" : ""}`}
          onClick={() => setActiveTab("register")}
        >
          Registrar Venda
        </button>
        <button
          className={`tab-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Histórico de Vendas
        </button>
      </nav>

      <main className="sales-content">
        {activeTab === "register" && <RegisterSaleForm />}
        {/* ATUALIZADO: Substituído o placeholder pelo novo componente */}
        {activeTab === "history" && <SalesHistory />}
      </main>
    </div>
  );
}
