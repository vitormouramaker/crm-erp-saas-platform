import { API_BASE } from "../config/api";
import { encrypt } from "../utils/cripto";

export type HublaIntegrationConfig = {
  id: number;
  empresa_id: number;
  webhook_public_id: string;
  webhook_url: string | null;
  ativo: boolean;
  hubla_token_configurado: boolean;
  sincronizar_vendas: boolean;
  sincronizar_carrinho_abandonado: boolean;
  sincronizar_assinaturas: boolean;
  sincronizar_reembolsos: boolean;
  vincular_clientes_existentes: boolean;
  criar_clientes_automaticamente: boolean;
  ultimo_evento_em: string | null;
  ultimo_evento_tipo: string | null;
  ultima_sincronizacao_em: string | null;
  updated_at: string | null;
};

export type HublaIntegrationSummary = {
  total_eventos: number;
  total_processados: number;
  total_clientes_vinculados: number;
  ultimo_evento_em: string | null;
  ultima_sincronizacao_em: string | null;
};

export type HublaRecentEvent = {
  id: number;
  cliente_id: number | null;
  tipo_evento: string;
  categoria_evento: string;
  status_compra: string;
  transacao_id: string;
  produto_nome: string;
  produto_codigo: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_telefone: string;
  cliente_telefone_normalizado: string;
  processado: boolean;
  mensagem_processamento: string;
  vinculado_por_telefone: boolean;
  criou_cliente: boolean;
  recebido_em: string | null;
};

export type HublaDetectedProduct = {
  hubla_product_key: string;
  hubla_product_id: string;
  hubla_offer_code: string;
  hubla_product_name: string;
  total_eventos: number;
  ultimo_recebimento_em: string | null;
  ultimo_tipo_evento: string;
  ultimo_status_compra: string;
  comercial_produto_id: number | null;
  comercial_produto_nome: string;
  comercial_produto_preco_base: number | null;
};

export type HublaSeller = {
  id: number;
  nome: string;
};

export type HublaUtmSellerRule = {
  id: number;
  vendedor_usuario_id: number;
  vendedor_nome: string;
  utm_campo: "source" | "medium" | "campaign" | "content" | "term";
  utm_valor: string;
  created_at: string | null;
};

export type HublaIntegrationOverview = {
  integracao: HublaIntegrationConfig;
  summary: HublaIntegrationSummary;
  eventos_recentes: HublaRecentEvent[];
  produtos_detectados: HublaDetectedProduct[];
  vendedores: HublaSeller[];
  utm_vendedor_regras: HublaUtmSellerRule[];
  official_header_name: string;
};

type HublaResponse = {
  success?: boolean;
  message?: string;
  data?: Partial<HublaIntegrationOverview> & {
    integracao?: Partial<HublaIntegrationConfig>;
    summary?: Partial<HublaIntegrationSummary>;
    eventos_recentes?: Partial<HublaRecentEvent>[];
    produtos_detectados?: Partial<HublaDetectedProduct>[];
    vendedores?: Partial<HublaSeller>[];
    utm_vendedor_regras?: Partial<HublaUtmSellerRule>[];
  };
};

function normalizeIntegration(
  raw: Partial<HublaIntegrationConfig> | undefined,
): HublaIntegrationConfig {
  return {
    id: Number(raw?.id || 0),
    empresa_id: Number(raw?.empresa_id || 0),
    webhook_public_id: String(raw?.webhook_public_id || ""),
    webhook_url: raw?.webhook_url ? String(raw.webhook_url) : null,
    ativo: Boolean(raw?.ativo),
    hubla_token_configurado: Boolean(raw?.hubla_token_configurado),
    sincronizar_vendas: raw?.sincronizar_vendas !== false,
    sincronizar_carrinho_abandonado: raw?.sincronizar_carrinho_abandonado !== false,
    sincronizar_assinaturas: Boolean(raw?.sincronizar_assinaturas),
    sincronizar_reembolsos: Boolean(raw?.sincronizar_reembolsos),
    vincular_clientes_existentes: raw?.vincular_clientes_existentes !== false,
    criar_clientes_automaticamente: raw?.criar_clientes_automaticamente !== false,
    ultimo_evento_em: raw?.ultimo_evento_em ? String(raw.ultimo_evento_em) : null,
    ultimo_evento_tipo: raw?.ultimo_evento_tipo ? String(raw.ultimo_evento_tipo) : null,
    ultima_sincronizacao_em: raw?.ultima_sincronizacao_em
      ? String(raw.ultima_sincronizacao_em)
      : null,
    updated_at: raw?.updated_at ? String(raw.updated_at) : null,
  };
}

function normalizeSummary(
  raw: Partial<HublaIntegrationSummary> | undefined,
): HublaIntegrationSummary {
  return {
    total_eventos: Number(raw?.total_eventos || 0),
    total_processados: Number(raw?.total_processados || 0),
    total_clientes_vinculados: Number(raw?.total_clientes_vinculados || 0),
    ultimo_evento_em: raw?.ultimo_evento_em ? String(raw.ultimo_evento_em) : null,
    ultima_sincronizacao_em: raw?.ultima_sincronizacao_em
      ? String(raw.ultima_sincronizacao_em)
      : null,
  };
}

function normalizeRecentEvent(raw: Partial<HublaRecentEvent>): HublaRecentEvent {
  return {
    id: Number(raw?.id || 0),
    cliente_id:
      raw?.cliente_id === null || raw?.cliente_id === undefined
        ? null
        : Number(raw.cliente_id),
    tipo_evento: String(raw?.tipo_evento || ""),
    categoria_evento: String(raw?.categoria_evento || ""),
    status_compra: String(raw?.status_compra || ""),
    transacao_id: String(raw?.transacao_id || ""),
    produto_nome: String(raw?.produto_nome || ""),
    produto_codigo: String(raw?.produto_codigo || ""),
    cliente_nome: String(raw?.cliente_nome || ""),
    cliente_email: String(raw?.cliente_email || ""),
    cliente_telefone: String(raw?.cliente_telefone || ""),
    cliente_telefone_normalizado: String(raw?.cliente_telefone_normalizado || ""),
    processado: Boolean(raw?.processado),
    mensagem_processamento: String(raw?.mensagem_processamento || ""),
    vinculado_por_telefone: Boolean(raw?.vinculado_por_telefone),
    criou_cliente: Boolean(raw?.criou_cliente),
    recebido_em: raw?.recebido_em ? String(raw.recebido_em) : null,
  };
}

function normalizeDetectedProduct(
  raw: Partial<HublaDetectedProduct>,
): HublaDetectedProduct {
  return {
    hubla_product_key: String(raw?.hubla_product_key || ""),
    hubla_product_id: String(raw?.hubla_product_id || ""),
    hubla_offer_code: String(raw?.hubla_offer_code || ""),
    hubla_product_name: String(raw?.hubla_product_name || ""),
    total_eventos: Number(raw?.total_eventos || 0),
    ultimo_recebimento_em: raw?.ultimo_recebimento_em
      ? String(raw.ultimo_recebimento_em)
      : null,
    ultimo_tipo_evento: String(raw?.ultimo_tipo_evento || ""),
    ultimo_status_compra: String(raw?.ultimo_status_compra || ""),
    comercial_produto_id:
      raw?.comercial_produto_id === null || raw?.comercial_produto_id === undefined
        ? null
        : Number(raw.comercial_produto_id),
    comercial_produto_nome: String(raw?.comercial_produto_nome || ""),
    comercial_produto_preco_base:
      raw?.comercial_produto_preco_base === null ||
      raw?.comercial_produto_preco_base === undefined
        ? null
        : Number(raw.comercial_produto_preco_base),
  };
}

function normalizeResponse(body: HublaResponse, empresaId: number): HublaIntegrationOverview {
  return {
    integracao: normalizeIntegration({
      empresa_id: empresaId,
      ...(body.data?.integracao || {}),
    }),
    summary: normalizeSummary(body.data?.summary),
    eventos_recentes: Array.isArray(body.data?.eventos_recentes)
      ? body.data!.eventos_recentes!.map((item) => normalizeRecentEvent(item))
      : [],
    produtos_detectados: Array.isArray(body.data?.produtos_detectados)
      ? body.data!.produtos_detectados!.map((item) =>
          normalizeDetectedProduct(item),
        )
      : [],
    vendedores: Array.isArray(body.data?.vendedores)
      ? body.data.vendedores.map((item) => ({
          id: Number(item.id || 0),
          nome: String(item.nome || ""),
        }))
      : [],
    utm_vendedor_regras: Array.isArray(body.data?.utm_vendedor_regras)
      ? body.data.utm_vendedor_regras.map((item) => ({
          id: Number(item.id || 0),
          vendedor_usuario_id: Number(item.vendedor_usuario_id || 0),
          vendedor_nome: String(item.vendedor_nome || ""),
          utm_campo: String(item.utm_campo || "source") as HublaUtmSellerRule["utm_campo"],
          utm_valor: String(item.utm_valor || ""),
          created_at: item.created_at ? String(item.created_at) : null,
        }))
      : [],
    official_header_name: String(body.data?.official_header_name || "X-Hubla-Token"),
  };
}

export async function saveHublaUtmSellerRule(params: {
  empresaId: number;
  sellerId: number;
  utmField: HublaUtmSellerRule["utm_campo"];
  utmValue: string;
}): Promise<{ overview: HublaIntegrationOverview; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    vendedor_usuario_id: params.sellerId,
    utm_campo: params.utmField,
    utm_valor: params.utmValue,
  });
  const response = await fetch(`${API_BASE}/hubla/vincular_utm_vendedor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  const body = (await response.json()) as HublaResponse;
  if (!response.ok || !body?.success || !body.data?.integracao) {
    throw new Error(body?.message || "Nao foi possivel salvar a regra UTM.");
  }
  return {
    overview: normalizeResponse(body, params.empresaId),
    message: body.message || "Regra UTM salva com sucesso.",
  };
}

export async function removeHublaUtmSellerRule(params: {
  empresaId: number;
  ruleId: number;
}): Promise<{ overview: HublaIntegrationOverview; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    regra_id: params.ruleId,
  });
  const response = await fetch(`${API_BASE}/hubla/desvincular_utm_vendedor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  const body = (await response.json()) as HublaResponse;
  if (!response.ok || !body?.success || !body.data?.integracao) {
    throw new Error(body?.message || "Nao foi possivel remover a regra UTM.");
  }
  return {
    overview: normalizeResponse(body, params.empresaId),
    message: body.message || "Regra UTM removida.",
  };
}

export async function getHublaIntegrationOverview(
  empresaId: number,
): Promise<HublaIntegrationOverview> {
  const payload = await encrypt({ empresa_id: empresaId });
  const response = await fetch(`${API_BASE}/hubla/configuracao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  if (!response.ok) {
    throw new Error("Falha ao carregar configuracao da Hubla.");
  }

  const body = (await response.json()) as HublaResponse;
  if (!body?.success || !body.data?.integracao) {
    throw new Error(body?.message || "Nao foi possivel carregar a integracao da Hubla.");
  }

  return normalizeResponse(body, empresaId);
}

export async function saveHublaIntegration(params: {
  empresaId: number;
  hublaToken: string;
  ativo: boolean;
  sincronizar_vendas: boolean;
  sincronizar_carrinho_abandonado: boolean;
  sincronizar_assinaturas: boolean;
  sincronizar_reembolsos: boolean;
  vincular_clientes_existentes: boolean;
  criar_clientes_automaticamente: boolean;
}): Promise<{ overview: HublaIntegrationOverview; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    hublaToken: params.hublaToken,
    ativo: params.ativo,
    sincronizar_vendas: params.sincronizar_vendas,
    sincronizar_carrinho_abandonado: params.sincronizar_carrinho_abandonado,
    sincronizar_assinaturas: params.sincronizar_assinaturas,
    sincronizar_reembolsos: params.sincronizar_reembolsos,
    vincular_clientes_existentes: params.vincular_clientes_existentes,
    criar_clientes_automaticamente: params.criar_clientes_automaticamente,
  });

  const response = await fetch(`${API_BASE}/hubla/salvar_integracao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const body = (await response.json()) as HublaResponse;
  if (!response.ok || !body?.success || !body.data?.integracao) {
    throw new Error(body?.message || "Nao foi possivel salvar a integracao da Hubla.");
  }

  return {
    overview: normalizeResponse(body, params.empresaId),
    message: body.message || "Integracao salva com sucesso.",
  };
}

export async function saveHublaProductMapping(params: {
  empresaId: number;
  hublaProductKey: string;
  hublaProductId?: string;
  hublaOfferCode?: string;
  hublaProductName: string;
  comercialProdutoId: number;
}): Promise<{ overview: HublaIntegrationOverview; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    hubla_product_key: params.hublaProductKey,
    hubla_product_id: params.hublaProductId,
    hubla_offer_code: params.hublaOfferCode,
    hubla_product_name: params.hublaProductName,
    comercial_produto_id: params.comercialProdutoId,
  });

  const response = await fetch(`${API_BASE}/hubla/vincular_produto`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const body = (await response.json()) as HublaResponse;
  if (!response.ok || !body?.success || !body.data?.integracao) {
    throw new Error(body?.message || "Nao foi possivel vincular o produto Hubla.");
  }

  return {
    overview: normalizeResponse(body, params.empresaId),
    message: body.message || "Produto Hubla vinculado com sucesso.",
  };
}

export async function removeHublaProductMapping(params: {
  empresaId: number;
  hublaProductKey: string;
}): Promise<{ overview: HublaIntegrationOverview; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    hubla_product_key: params.hublaProductKey,
  });

  const response = await fetch(`${API_BASE}/hubla/desvincular_produto`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const body = (await response.json()) as HublaResponse;
  if (!response.ok || !body?.success || !body.data?.integracao) {
    throw new Error(body?.message || "Nao foi possivel desvincular o produto Hubla.");
  }

  return {
    overview: normalizeResponse(body, params.empresaId),
    message: body.message || "Produto Hubla desvinculado com sucesso.",
  };
}
