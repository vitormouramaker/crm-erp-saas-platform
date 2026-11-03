import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiExternalLink } from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { decrypt, encrypt } from "../../utils/cripto";
import "./PaymentHistoryPage.css";

type ApiEnvelope<T> = {
  boleano?: boolean;
  obj?: T;
  mensagem?: string;
  msg?: string;
};

type PaymentHistoryItem = {
  id: number;
  plano_nome?: string | null;
  status?: string | null;
  valor_total?: number | string | null;
  moeda?: string | null;
  paid?: boolean | null;
  paid_at?: string | null;
  due_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  descricao?: string | null;
  created_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function formatAmount(value?: number | string | null, currency?: string | null) {
  const numeric = Number(value || 0);
  const code = String(currency || "BRL").toUpperCase();
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `R$ ${numeric.toFixed(2)}`;
  }
}

function normalizeStatus(status?: string | null, paid?: boolean | null) {
  const value = String(status || "").toLowerCase();
  if (paid || value === "paid" || value === "invoice.paid") {
    return { label: "Pago", tone: "success" as const };
  }
  if (value.includes("failed") || value.includes("unpaid")) {
    return { label: "Falhou", tone: "danger" as const };
  }
  if (value.includes("open") || value.includes("pending")) {
    return { label: "Pendente", tone: "warning" as const };
  }
  return { label: status || "Desconhecido", tone: "default" as const };
}

export function PaymentHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.email) return;
      setLoading(true);
      setError(null);
      try {
        const payload = await encrypt({ email: user.email, limit: 100 });
        const response = await fetch(`${API_BASE}/pagamento/historico_pagamentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const respData = await response.json();
        const data = (await decrypt(respData?.payload)) as ApiEnvelope<
          PaymentHistoryItem[]
        > | null;
        if (!data?.boleano) {
          throw new Error(data?.mensagem || data?.msg || "Falha ao carregar histórico.");
        }
        setItems(Array.isArray(data.obj) ? data.obj : []);
      } catch (err: any) {
        setError(err?.message || "Erro ao carregar histórico de pagamentos.");
      } finally {
        setLoading(false);
      }
    };

    void fetchHistory();
  }, [user?.email]);

  const totalPaid = useMemo(() => {
    return items.reduce((acc, item) => {
      if (!item.paid && String(item.status || "").toLowerCase() !== "paid") return acc;
      return acc + Number(item.valor_total || 0);
    }, 0);
  }, [items]);

  return (
    <div className="payment-history-page">
      <MobileHeader title="Histórico de Pagamentos" />

      <div className="payment-history-header">
        <button
          className="payment-history-back"
          type="button"
          onClick={() => navigate("/assinatura")}
        >
          <FiArrowLeft size={16} /> Voltar para Assinatura
        </button>
        <div className="payment-history-summary">
          <strong>{items.length}</strong>
          <span>faturas registradas</span>
        </div>
        <div className="payment-history-summary">
          <strong>{formatAmount(totalPaid, "BRL")}</strong>
          <span>total pago</span>
        </div>
      </div>

      {loading && <div className="payment-history-state">Carregando histórico...</div>}
      {!loading && error && <div className="payment-history-state error">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="payment-history-state">Nenhum pagamento encontrado.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="payment-history-list">
          {items.map((item) => {
            const status = normalizeStatus(item.status, item.paid);
            return (
              <article className="payment-history-card" key={item.id}>
                <div className="payment-history-card-top">
                  <div>
                    <h3>{item.plano_nome || "Plano"}</h3>
                    <p>
                      Período: {formatDate(item.period_start)} até {formatDate(item.period_end)}
                    </p>
                  </div>
                  <span className={`status-badge ${status.tone}`}>{status.label}</span>
                </div>

                <div className="payment-history-grid">
                  <div>
                    <span>Valor</span>
                    <strong>{formatAmount(item.valor_total, item.moeda)}</strong>
                  </div>
                  <div>
                    <span>Vencimento</span>
                    <strong>{formatDate(item.due_date)}</strong>
                  </div>
                  <div>
                    <span>Pago em</span>
                    <strong>{formatDate(item.paid_at)}</strong>
                  </div>
                  <div>
                    <span>Lançado em</span>
                    <strong>{formatDate(item.created_at)}</strong>
                  </div>
                </div>

                <div className="payment-history-links">
                  {item.hosted_invoice_url && (
                    <a href={item.hosted_invoice_url} target="_blank" rel="noreferrer">
                      Ver fatura <FiExternalLink size={14} />
                    </a>
                  )}
                  {item.invoice_pdf && (
                    <a href={item.invoice_pdf} target="_blank" rel="noreferrer">
                      PDF <FiExternalLink size={14} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

