import { API_BASE } from "../config/api";
import { decrypt, encrypt } from "../utils/cripto";

export type ApiEnvelope<T> = {
  boleano?: boolean;
  obj?: T;
  mensagem?: string;
  msg?: string;
};

export type AssinaturaAtual = {
  assinatura_id: number;
  plano_nome: string;
  validade?: string | null;
  billing_cycle?: "monthly" | "yearly" | null;
  stripe_status?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_current_period_end?: string | null;
  stripe_cancel_at_period_end?: boolean;
  request_unsubscribe?: boolean;
  additional_user?: number;
  additional_user_cycle?: "monthly" | "yearly" | null;
  additional_crm?: number;
  additional_crm_cycle?: "monthly" | "yearly" | null;
  additional_leads?: number;
  additional_leads_cycle?: "monthly" | "yearly" | null;
  ativo: boolean;
  // "gestao360" quando a empresa foi criada pela integracao com o Gestao 360.
  empresa_origem?: string | null;
};

async function decodeApiEnvelope<T>(respData: any): Promise<ApiEnvelope<T> | null> {
  if (!respData?.payload) return null;
  return (await decrypt(respData.payload)) as ApiEnvelope<T> | null;
}

export async function fetchCurrentSubscription(email: string): Promise<AssinaturaAtual | null> {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) return null;

  const payload = await encrypt({ email: normalizedEmail });
  const response = await fetch(`${API_BASE}/pagamento/get_assinatura`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });

  const responseData = await response.json();
  const data = await decodeApiEnvelope<{ assinatura: AssinaturaAtual | null }>(responseData);

  if (!data?.boleano) {
    throw new Error(data?.mensagem || data?.msg || "Nao foi possivel consultar a assinatura.");
  }

  return data.obj?.assinatura || null;
}
