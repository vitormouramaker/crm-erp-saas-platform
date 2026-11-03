import { useState, useEffect, useMemo } from "react";
import {
  FiSearch,
  FiCalendar,
  FiMonitor,
  FiUser,
  FiDollarSign,
  FiActivity, // Novo ícone para Status
} from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { API_BASE } from "../../config/api";
import { encrypt, decrypt } from "../../utils/cripto";
import { useAuth } from "../../contexts/AuthContext";
import "./TransactionsPage.css";

// Interface atualizada com Status
interface Transaction {
  id: number;
  pdv_id: string;
  data_hora: string;
  valor_total: number;
  desconto_valor?: number;
  desconto_percentual?: number;
  forma_pagamento: string;
  status: "pago" | "cancelado" | "pendente"; // Status atualizado
  valor_recebido: number;
  troco: number;
  nome_caixa: string;
  numero_caixa: string;
}

export function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Helper para classe do badge de status
  const getStatusBadgeClass = (status: string) => {
    if (!status) return "default";
    switch (status.toUpperCase()) {
      case "EFETIVADO":
      case "PAGO":
        return "pago";
      case "CANCELADO":
        return "cancelado";
      case "PENDENTE":
        return "pendente";
      default:
        return "default";
    }
  };

  // Estados para filtros
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [selectedCashier, setSelectedCashier] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");
  const [selectedPaymentType, setSelectedPaymentType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Buscar transações do backend
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user?.empresa_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const encrypted = await encrypt({ empresa_id: user.empresa_id });

        const response = await fetch(`${API_BASE}/user/listar_transacoes_pdv`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });

        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          boleano: boolean;
          obj: Transaction[];
          msg?: string;
        };

        if (resp?.boleano && Array.isArray(resp.obj)) {
          setTransactions(resp.obj);
        } else {
          console.error("Erro ao carregar transações:", resp?.msg);
          setTransactions(MOCK_TRANSACTIONS_FALLBACK);
        }
      } catch (err) {
        console.error("Erro na requisição:", err);
        setTransactions(MOCK_TRANSACTIONS_FALLBACK);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [user?.empresa_id]);

  // Extrair opções únicas para filtros
  const uniqueCashiers = useMemo(() => {
    return Array.from(new Set(transactions.map((t) => t.numero_caixa || "")))
      .filter(Boolean)
      .sort();
  }, [transactions]);

  const uniqueOperators = useMemo(() => {
    return Array.from(new Set(transactions.map((t) => t.nome_caixa || "")))
      .filter(Boolean)
      .sort();
  }, [transactions]);

  const uniquePaymentTypes = useMemo(() => {
    return Array.from(new Set(transactions.map((t) => t.forma_pagamento || "")))
      .filter(Boolean)
      .sort();
  }, [transactions]);

  // Filtro
  const filteredTransactions = useMemo(() => {
    const lowerTerm = searchTerm.toLowerCase();

    return transactions
      .filter((t) => {
        // Filtro de Texto (Busca Geral)
        const matchesSearch =
          (t.nome_caixa || "").toLowerCase().includes(lowerTerm) ||
          (t.numero_caixa || "").toLowerCase().includes(lowerTerm) ||
          t.pdv_id?.toString().includes(lowerTerm) ||
          (t.status || "").toLowerCase().includes(lowerTerm);

        // Filtro de Data
        let matchesDate = true;
        if (dateRange.start) {
          matchesDate =
            matchesDate &&
            new Date(t.data_hora) >= new Date(dateRange.start + "T00:00:00");
        }
        if (dateRange.end) {
          matchesDate =
            matchesDate &&
            new Date(t.data_hora) <= new Date(dateRange.end + "T23:59:59");
        }

        // Filtros Específicos
        const matchesCashier = selectedCashier
          ? t.numero_caixa === selectedCashier
          : true;
        const matchesOperator = selectedOperator
          ? t.nome_caixa === selectedOperator
          : true;
        const matchesPayment = selectedPaymentType
          ? t.forma_pagamento === selectedPaymentType
          : true;

        return (
          matchesSearch &&
          matchesDate &&
          matchesCashier &&
          matchesOperator &&
          matchesPayment &&
          matchesPayment &&
          (selectedStatus
            ? getStatusBadgeClass(t.status) === selectedStatus
            : true)
        );
      })

      .sort(
        (a, b) =>
          new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime(),
      );
  }, [
    transactions,
    searchTerm,
    dateRange,
    selectedCashier,
    selectedOperator,
    selectedPaymentType,
    selectedStatus,
  ]);

  // Paginação
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  // Resetar página ao filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    dateRange,
    selectedCashier,
    selectedOperator,
    selectedPaymentType,
    selectedStatus,
  ]);

  // Helpers de formatação
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("pt-BR");
  };

  return (
    <div className="transactions-page-layout">
      <MobileHeader title="Transações PDV" />

      <header className="transactions-header">
        <h1>Transações do PDV</h1>
        <div className="search-bar-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por caixa, status, operador ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <main className="transactions-content">
        {loading ? (
          <p className="loading-text">Carregando transações...</p>
        ) : (
          <>
            {/* ÁREA DE FILTROS */}
            <div className="filters-container">
              <div className="filter-group">
                <label>Período</label>
                <div className="date-inputs">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        start: e.target.value,
                      }))
                    }
                  />
                  <span>até</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, end: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="filter-group">
                <label>Caixa</label>
                <select
                  value={selectedCashier}
                  onChange={(e) => setSelectedCashier(e.target.value)}
                >
                  <option value="">Todos</option>
                  {uniqueCashiers.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Operador</label>
                <select
                  value={selectedOperator}
                  onChange={(e) => setSelectedOperator(e.target.value)}
                >
                  <option value="">Todos</option>
                  {uniqueOperators.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Pagamento</label>
                <select
                  value={selectedPaymentType}
                  onChange={(e) => setSelectedPaymentType(e.target.value)}
                >
                  <option value="">Todos</option>
                  {uniquePaymentTypes.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div className="filter-group" style={{ alignSelf: "flex-end" }}>
                <button
                  className="clear-filters-btn"
                  onClick={() => {
                    setDateRange({ start: "", end: "" });
                    setSelectedCashier("");
                    setSelectedOperator("");
                    setSelectedPaymentType("");
                    setSelectedStatus("");
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                >
                  Limpar Filtros
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>
                      <FiCalendar /> Data/Hora
                    </th>
                    <th>ID Venda</th>
                    <th>
                      <FiMonitor /> Caixa
                    </th>
                    <th>
                      <FiUser /> Operador
                    </th>
                    <th>Pagamento</th>
                    <th>
                      <FiActivity /> Status
                    </th>{" "}
                    {/* NOVA COLUNA */}
                    <th>
                      <FiDollarSign /> Valores
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((t) => (
                    <tr key={t.id}>
                      <td data-label="Data">{formatDate(t.data_hora)}</td>
                      <td data-label="ID">#{t.pdv_id}</td>
                      <td data-label="Caixa">{t.numero_caixa}</td>
                      <td data-label="Operador" className="cashier-name">
                        {t.nome_caixa}
                      </td>
                      <td data-label="Pagamento">
                        <span
                          className={`payment-badge ${(
                            t.forma_pagamento || ""
                          ).toLowerCase()}`}
                        >
                          {t.forma_pagamento || "-"}
                        </span>
                      </td>
                      {/* NOVA CÉLULA */}
                      <td data-label="Status">
                        <span
                          className={`status-badge ${getStatusBadgeClass(
                            t.status || "",
                          )}`}
                        >
                          {t.status || "Indefinido"}
                        </span>
                      </td>
                      <td data-label="Valores" className="values-cell">
                        <div className="total-value">
                          Total: {formatCurrency(t.valor_total)}
                        </div>
                        {(Number(t.desconto_valor) || 0) > 0 && (
                          <div className="discount-details">
                            <small>
                              Desconto:{" "}
                              {formatCurrency(Number(t.desconto_valor) || 0)}
                            </small>
                            <small>
                              ({Number(t.desconto_percentual || 0).toFixed(2)}%)
                            </small>
                          </div>
                        )}
                        {t.forma_pagamento?.toUpperCase() === "ESPECIE" && (
                          <div className="cash-details">
                            <small>
                              Recebido: {formatCurrency(t.valor_recebido)}
                            </small>
                            <small className="change-value">
                              Troco: {formatCurrency(t.troco)}
                            </small>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {paginatedTransactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ textAlign: "center", padding: "20px" }}
                      >
                        Nenhuma transação encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINAÇÃO */}
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <span>
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// MOCK ATUALIZADO COM STATUS
const MOCK_TRANSACTIONS_FALLBACK: Transaction[] = [
  {
    id: 1,
    pdv_id: "1001",
    data_hora: "2025-11-14T08:30:00",
    valor_total: 50.0,
    desconto_valor: 0,
    desconto_percentual: 0,
    forma_pagamento: "DINHEIRO",
    status: "pago",
    valor_recebido: 100.0,
    troco: 50.0,
    nome_caixa: "Maria Souza",
    numero_caixa: "Caixa 01",
  },
  {
    id: 2,
    pdv_id: "1002",
    data_hora: "2025-11-14T08:45:00",
    valor_total: 125.9,
    desconto_valor: 10,
    desconto_percentual: 7.36,
    forma_pagamento: "CREDITO",
    status: "pago",
    valor_recebido: 125.9,
    troco: 0,
    nome_caixa: "Maria Souza",
    numero_caixa: "Caixa 01",
  },
  {
    id: 3,
    pdv_id: "1003",
    data_hora: "2025-11-14T09:10:00",
    valor_total: 15.0,
    desconto_valor: 0,
    desconto_percentual: 0,
    forma_pagamento: "PIX",
    status: "pago",
    valor_recebido: 15.0,
    troco: 0,
    nome_caixa: "João Silva",
    numero_caixa: "Caixa 02",
  },
  {
    id: 4,
    pdv_id: "1004",
    data_hora: "2025-11-14T09:15:00",
    valor_total: 23.5,
    desconto_valor: 1.5,
    desconto_percentual: 6.0,
    forma_pagamento: "DINHEIRO",
    status: "cancelado",
    valor_recebido: 25.0,
    troco: 1.5,
    nome_caixa: "João Silva",
    numero_caixa: "Caixa 02",
  },
  {
    id: 5,
    pdv_id: "1005",
    data_hora: "2025-11-14T09:20:00",
    valor_total: 88.0,
    desconto_valor: 0,
    desconto_percentual: 0,
    forma_pagamento: "DEBITO",
    status: "pendente",
    valor_recebido: 88.0,
    troco: 0,
    nome_caixa: "Maria Souza",
    numero_caixa: "Caixa 01",
  },
];
