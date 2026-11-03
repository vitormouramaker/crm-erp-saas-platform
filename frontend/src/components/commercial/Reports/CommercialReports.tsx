import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiBriefcase, FiDownload, FiFilter, FiLayers, FiPaperclip, FiSearch, FiUser } from "react-icons/fi";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  getCommercialCompanyConversationsExport,
  getCommercialDomains,
  getCommercialReports,
  subscribeToCommercialDataChanged,
  type CommercialDomains,
  type CommercialReportResult,
  type Deal,
} from "../../../service/commercialService";
import { exportCommercialCompanyConversationsWorkbook } from "../../../utils/commercialConversationExport";
import { KPICard } from "../Dashboard/KPICard";
import { TopProductsChart } from "./TopProductsChart";
import { TopSellersChart } from "./TopSellersChart";
import "./CommercialReports.css";

const initialReport: CommercialReportResult = {
  metrics: {
    totalSales: 0,
    count: 0,
    avgTicket: 0,
    activeSellers: 0,
    generatedQuotesCount: 0,
    customerDocumentsCount: 0,
  },
  topSellers: [],
  topQuotedProducts: [],
  topProducts: [],
  lossRadar: {
    totalLostRevenue: 0,
    fullLostRevenue: 0,
    partialLostRevenue: 0,
    lostDealsCount: 0,
    partialLossDealsCount: 0,
    topReasons: [],
    topProducts: [],
    topSellers: [],
  },
  documentsByAttendant: [],
  quotes: [],
  deals: [],
};

type CommercialReportsProps = {
  crmId?: number | null;
};

export function CommercialReports({ crmId }: CommercialReportsProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [domains, setDomains] = useState<CommercialDomains | null>(null);
  const [report, setReport] = useState<CommercialReportResult>(initialReport);
  const [loading, setLoading] = useState(true);
  const [exportingCompanyConversations, setExportingCompanyConversations] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sellerFilter, setSellerFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [companyConversationAttendantFilter, setCompanyConversationAttendantFilter] =
    useState("all");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const hasLoadedRef = useRef(false);

  const loadReports = useCallback(async () => {
    if (!crmId) {
      setDomains(null);
      setReport(initialReport);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let nextDomains = domains;
      if (!nextDomains || Number(nextDomains.crm_id) !== Number(crmId || nextDomains.crm_id)) {
        nextDomains = await getCommercialDomains(crmId);
        setDomains(nextDomains);
      }
      if (!nextDomains) throw new Error("Funil nao encontrado.");

      const nextReport = await getCommercialReports({
        crmId: nextDomains.crm_id,
        ownerId: sellerFilter !== "all" ? sellerFilter : undefined,
        stage: statusFilter !== "all" ? statusFilter : undefined,
        search: searchTerm || undefined,
        dateStart: dateRange.start,
        dateEnd: dateRange.end,
        product: productFilter !== "all" ? productFilter : undefined,
        filialId:
          branchFilter !== "all" && branchFilter !== "none"
            ? Number(branchFilter)
            : undefined,
        withoutFilial: branchFilter === "none",
      });
      setReport(nextReport);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description: error instanceof Error ? error.message : "Nao foi possivel carregar os relatorios.",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, branchFilter, crmId, dateRange.end, dateRange.start, domains, productFilter, searchTerm, sellerFilter, statusFilter]);

  useEffect(() => {
    setDomains(null);
    setBranchFilter("all");
    hasLoadedRef.current = false;
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crmId]);

  useEffect(() => subscribeToCommercialDataChanged(() => void loadReports()), [loadReports]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(
      () => {
        void loadReports();
      },
      searchTerm ? 300 : 0
    );

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, sellerFilter, productFilter, branchFilter, dateRange.start, dateRange.end]);

  const uniqueProducts = useMemo(() => {
    const set = new Set<string>();
    (report.quotes || report.deals).forEach((deal) => {
      (deal.products || []).forEach((product) => set.add(product.name));
    });
    return Array.from(set).sort();
  }, [report.deals, report.quotes]);

  const filteredDeals = useMemo(() => report.quotes || report.deals, [report.deals, report.quotes]);
  const lossReasonNameMap = useMemo(
    () =>
      new Map(
        (domains?.motivos_perda || []).map((reason) => [String(reason.codigo || ""), reason.nome])
      ),
    [domains?.motivos_perda]
  );

  const metrics = useMemo(() => {
    const closedWon = filteredDeals.filter((deal) => deal.stage === "closed-won");
    const totalSales = closedWon.reduce((acc, deal) => acc + deal.amount, 0);
    const count = closedWon.length;
    const avgTicket = count > 0 ? totalSales / count : 0;
    const activeSellers = new Set(filteredDeals.map((deal) => deal.ownerId).filter(Boolean)).size;
    return {
      totalQuoteSales: report.metrics.totalQuoteSales ?? totalSales,
      quoteCount: report.metrics.quoteCount ?? count,
      generatedQuotesCount: report.metrics.generatedQuotesCount ?? 0,
      avgQuoteTicket: report.metrics.avgQuoteTicket ?? avgTicket,
      totalSales,
      count,
      avgTicket,
      activeSellers,
      totalLostRevenue: report.metrics.totalLostRevenue ?? report.lossRadar.totalLostRevenue,
      fullLostRevenue: report.metrics.fullLostRevenue ?? report.lossRadar.fullLostRevenue,
      partialLostRevenue:
        report.metrics.partialLostRevenue ?? report.lossRadar.partialLostRevenue,
      lostQuotesCount: report.metrics.lostQuotesCount ?? report.lossRadar.lostDealsCount,
      partialLossDealsCount:
        report.metrics.partialLossDealsCount ?? report.lossRadar.partialLossDealsCount,
      customerDocumentsCount: report.metrics.customerDocumentsCount ?? 0,
    };
  }, [filteredDeals, report.lossRadar, report.metrics]);

  const documentsByAttendant = useMemo(() => {
    return report.documentsByAttendant || [];
  }, [report.documentsByAttendant]);

  const topSellersData = useMemo(() => {
    return report.topSellers;
  }, [report.topSellers]);

  const topProductsData = useMemo(() => {
    return report.topQuotedProducts || report.topProducts;
  }, [report.topProducts, report.topQuotedProducts]);

  const getLossReasonLabel = (code?: string, fallback?: string) => {
    if (!code) return fallback || "Sem motivo informado";
    if (code === "venda-parcial") return "Itens não vendidos";
    if (code === "sem-motivo") return "Sem motivo informado";
    return lossReasonNameMap.get(code) || fallback || code;
  };

  const handleExportCSV = (type: "table" | "sellers" | "products") => {
    let content = "";
    let filename = "";

    if (type === "table") {
      const header = [
        "ID",
        "Titulo",
        "Empresa",
        "Telefone",
        "Valor",
        "Status",
        "Responsavel",
        "Data",
      ];
      content = [
        header.join(","),
        ...filteredDeals.map((deal) =>
          [
            deal.id,
            `"${deal.title}"`,
            `"${deal.companyName}"`,
            `"${deal.customerPhone || ""}"`,
            deal.amount,
            deal.stage,
            `"${deal.ownerName || deal.ownerId}"`,
            deal.createdAt || "",
          ].join(",")
        ),
      ].join("\n");
      filename = "relatorio_comercial.csv";
    }

    if (type === "sellers") {
      content = ["Vendedor,Total Vendido\n"]
        .concat(topSellersData.map((item) => `"${item.name}",${item.value}`).join("\n"))
        .join("");
      filename = "top_vendedores.csv";
    }

    if (type === "products") {
      content = ["Produto,Quantidade,Valor Total\n"]
        .concat(topProductsData.map((item) => `"${item.name}",${item.quantity},${item.value}`).join("\n"))
        .join("");
      filename = "top_produtos_orcamento.csv";
    }

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusLabel = (stage: string) => {
    const map: Record<string, string> = {
      waiting: "Aguardando",
      prospect: "Prospecção",
      qualificacao: "Qualificação",
      proposal: "Proposta",
      negotiation: "Negociação",
      "closed-won": "Ganho",
      "closed-lost": "Perdido",
    };
    return map[stage] || stage;
  };

  const getStatusEmblemClass = (stage: string) => {
    if (stage === "closed-won") return "status-won";
    if (stage === "closed-lost") return "status-lost";
    return "status-active";
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSellerFilter("all");
    setProductFilter("all");
    setBranchFilter("all");
    setCompanyConversationAttendantFilter("all");
    const nextRange = {
      start: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
      end: new Date().toISOString().split("T")[0],
    };
    setDateRange(nextRange);
    void (async () => {
      setLoading(true);
      try {
        let nextDomains = domains;
        if (!nextDomains || Number(nextDomains.crm_id) !== Number(crmId || nextDomains.crm_id)) {
          nextDomains = await getCommercialDomains(crmId);
          setDomains(nextDomains);
        }
        if (!nextDomains) throw new Error("Funil nao encontrado.");
        const nextReport = await getCommercialReports({
          crmId: nextDomains.crm_id,
          dateStart: nextRange.start,
          dateEnd: nextRange.end,
          withoutFilial: false,
        });
        setReport(nextReport);
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro",
          description: error instanceof Error ? error.message : "Nao foi possivel limpar os filtros.",
        });
      } finally {
        setLoading(false);
      }
    })();
  };

  const handleExportCompanyConversations = useCallback(async () => {
    if (!user?.is_master || exportingCompanyConversations) return;

    setExportingCompanyConversations(true);
    try {
      const rows = await getCommercialCompanyConversationsExport({
        attendantId:
          companyConversationAttendantFilter !== "all"
            ? companyConversationAttendantFilter
            : undefined,
        dateStart: dateRange.start || undefined,
        dateEnd: dateRange.end || undefined,
      });
      if (!rows.length) {
        addToast({
          type: "info",
          title: "Sem conversas",
          description: "Nenhuma conversa foi encontrada para exportacao.",
        });
        return;
      }

      exportCommercialCompanyConversationsWorkbook(rows);
      addToast({
        type: "success",
        title: "Exportacao concluida",
        description: "O arquivo XLSX com as conversas da empresa foi gerado.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao exportar",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel exportar as conversas da empresa.",
      });
    } finally {
      setExportingCompanyConversations(false);
    }
  }, [
    addToast,
    companyConversationAttendantFilter,
    dateRange.end,
    dateRange.start,
    exportingCompanyConversations,
    user?.is_master,
  ]);

  if (!crmId) {
    return <div className="reports-loading">Crie um funil na aba Configurações para visualizar relatórios.</div>;
  }

  if (loading) {
    return <div className="reports-loading">Carregando relatórios...</div>;
  }

  return (
    <div className="reports-page">
      <div className="reports-header-row">
        <h2>Relatórios Comerciais</h2>
        {user?.is_master ? (
          <div className="reports-header-actions">
            <div className="select-wrapper reports-export-select">
              <FiUser />
              <select
                value={companyConversationAttendantFilter}
                onChange={(e) => setCompanyConversationAttendantFilter(e.target.value)}
              >
                <option value="all">Atendente: Todos</option>
                {(domains?.responsaveis || []).map((attendant) => (
                  <option key={attendant.id} value={String(attendant.id)}>
                    {attendant.nome}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn-export-sm reports-header-export"
              onClick={() => void handleExportCompanyConversations()}
              disabled={exportingCompanyConversations}
            >
              <FiDownload />{" "}
              {exportingCompanyConversations ? "Exportando conversas..." : "Baixar conversas da empresa"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Período</label>
          <div className="date-inputs">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
            />
            <span>até</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>

        <div className="filter-group">
          <label>Vendedor</label>
          <div className="select-wrapper">
            <FiUser />
            <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}>
              <option value="all">Todos</option>
              {(domains?.responsaveis || []).map((seller) => (
                <option key={seller.id} value={String(seller.id)}>
                  {seller.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-group">
          <label>Produto do orçamento</label>
          <div className="select-wrapper">
            <FiBriefcase />
            <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
              <option value="all">Todos</option>
              {uniqueProducts.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-group">
          <label>Filial</label>
          <div className="select-wrapper">
            <FiLayers />
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="all">Todas</option>
              <option value="none">Sem filial vinculada</option>
              {(domains?.filiais || []).map((branch) => (
                <option key={branch.id} value={String(branch.id)}>
                  {branch.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-group search-flex">
          <label>Busca</label>
          <div className="search-wrapper">
            <FiSearch />
            <input
              type="text"
              placeholder="Orçamento ou Empresa"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <button className="btn-clear-filters" onClick={clearFilters} disabled={loading}>
          Limpar
        </button>
      </div>

      <div className="reports-kpi-grid">
        <KPICard
          title="Faturamento de Orçamentos"
          value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metrics.totalQuoteSales || metrics.totalSales)}
          icon={<FiDownload />}
          color="green"
        />
        <KPICard title="Orçamentos Ganhos" value={metrics.quoteCount || metrics.count} icon={<FiFilter />} color="blue" />
        <KPICard
          title="Orçamentos Gerados"
          value={metrics.generatedQuotesCount}
          icon={<FiBriefcase />}
          color="orange"
        />
        <KPICard
          title="Ticket Médio do Orçamento"
          value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metrics.avgQuoteTicket || metrics.avgTicket)}
          icon={<FiSearch />}
          color="purple"
        />
        <KPICard title="Vendedores Ativos" value={metrics.activeSellers} icon={<FiUser />} color="orange" />
        <KPICard
          title="Receita Perdida"
          value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metrics.totalLostRevenue || 0)}
          icon={<FiBriefcase />}
          color="red"
        />
        <KPICard
          title="Perdas Parciais"
          value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(metrics.partialLostRevenue || 0)}
          icon={<FiFilter />}
          color="orange"
        />
        <KPICard
          title="Documentos do Cliente"
          value={metrics.customerDocumentsCount || 0}
          icon={<FiPaperclip />}
          color="purple"
        />
      </div>

      <div className="charts-row">
        <div className="chart-container">
          <div className="chart-header">
            <h3>Top 10 Vendedores</h3>
            <button onClick={() => handleExportCSV("sellers")}>
              <FiDownload /> CSV
            </button>
          </div>
          <TopSellersChart data={topSellersData} />
        </div>
        <div className="chart-container">
          <div className="chart-header">
            <h3>Top 10 Produtos em Orçamentos</h3>
            <button onClick={() => handleExportCSV("products")}>
              <FiDownload /> CSV
            </button>
          </div>
          <TopProductsChart data={topProductsData} />
        </div>

        <div className="chart-container">
          <div className="chart-header">
            <h3>Atendente x Documentos anexados</h3>
          </div>
          <div className="loss-ranking">
            {documentsByAttendant.length ? (
              documentsByAttendant.map((item, index) => (
                <div
                  key={`${item.usuario_id ?? "sem-usuario"}-${index}`}
                  className="loss-ranking__row"
                >
                  <div>
                    <strong>{item.usuario_nome || "Sem atendente vinculado"}</strong>
                    <span>{item.total_clientes || 0} cliente(s) com anexo</span>
                  </div>
                  <strong>{item.total_documentos || 0}</strong>
                </div>
              ))
            ) : (
              <p className="loss-ranking__empty">
                Nenhum documento anexado aos clientes deste funil no período.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="loss-report-section">
        <div className="table-header-row">
          <h3>Radar de perda de receita</h3>
        </div>

        <div className="loss-report-summary">
          <div className="loss-report-summary__card">
            <span>Receita perdida total</span>
            <strong>
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                report.lossRadar.totalLostRevenue || 0
              )}
            </strong>
          </div>
          <div className="loss-report-summary__card">
            <span>Orçamentos perdidos</span>
            <strong>{report.lossRadar.lostDealsCount || 0}</strong>
          </div>
          <div className="loss-report-summary__card">
            <span>Perda por recusa</span>
            <strong>
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                report.lossRadar.fullLostRevenue || 0
              )}
            </strong>
          </div>
          <div className="loss-report-summary__card">
            <span>Perda em vendas parciais</span>
            <strong>
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                report.lossRadar.partialLostRevenue || 0
              )}
            </strong>
          </div>
        </div>

        <div className="loss-report-grid">
          <div className="chart-container">
            <div className="chart-header">
              <h3>Motivos com maior impacto</h3>
            </div>
            <div className="loss-ranking">
              {report.lossRadar.topReasons.length ? (
                report.lossRadar.topReasons.map((reason, index) => (
                  <div
                    key={reason.code || reason.label || `${index}`}
                    className="loss-ranking__row"
                  >
                    <div>
                      <strong>{getLossReasonLabel(reason.code, reason.label)}</strong>
                      <span>{reason.count || 0} ocorrência(s)</span>
                    </div>
                    <strong>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(reason.value || 0)}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="loss-ranking__empty">Nenhuma perda no período selecionado.</p>
              )}
            </div>
          </div>

          <div className="chart-container">
            <div className="chart-header">
              <h3>Produtos que mais geram perda</h3>
            </div>
            <div className="loss-ranking">
              {report.lossRadar.topProducts.length ? (
                report.lossRadar.topProducts.map((product, index) => (
                  <div
                    key={product.name || `${index}`}
                    className="loss-ranking__row"
                  >
                    <div>
                      <strong>{product.name || "Produto sem nome"}</strong>
                      <span>{product.quantity || 0} unidade(s) perdidas</span>
                    </div>
                    <strong>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(product.value || 0)}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="loss-ranking__empty">Nenhum produto com perda no período.</p>
              )}
            </div>
          </div>

          <div className="chart-container">
            <div className="chart-header">
              <h3>Responsáveis com maior perda</h3>
            </div>
            <div className="loss-ranking">
              {report.lossRadar.topSellers.length ? (
                report.lossRadar.topSellers.map((seller, index) => (
                  <div
                    key={seller.name || `${index}`}
                    className="loss-ranking__row"
                  >
                    <div>
                      <strong>{seller.name || "Sem responsável"}</strong>
                      <span>{seller.count || 0} negócio(s) impactados</span>
                    </div>
                    <strong>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(seller.value || 0)}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="loss-ranking__empty">Nenhum responsável com perda no período.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="table-section">
        <div className="table-header-row">
          <h3>Detalhamento dos Orçamentos</h3>
          <div className="table-actions">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="status-select"
            >
              <option value="all">Status: Todos</option>
              <option value="closed-won">Ganhos</option>
              <option value="closed-lost">Perdidos</option>
              <option value="negotiation">Em Negociação</option>
            </select>
            <button className="btn-export-sm" onClick={() => handleExportCSV("table")}>
              <FiDownload /> Exportar Tabela
            </button>
          </div>
        </div>

        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Orçamento</th>
                <th>Telefone</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Data</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((deal: Deal) => (
                <tr key={deal.id}>
                  <td>{deal.companyName}</td>
                  <td>{deal.title}</td>
                  <td>{deal.customerPhone || "-"}</td>
                  <td>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deal.amount)}
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusEmblemClass(deal.stage)}`}>
                      {getStatusLabel(deal.stage)}
                    </span>
                  </td>
                  <td>{deal.createdAt ? new Date(deal.createdAt).toLocaleDateString("pt-BR") : "-"}</td>
                  <td>{deal.ownerName || deal.ownerId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
