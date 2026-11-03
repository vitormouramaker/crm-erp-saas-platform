import { API_BASE } from "../config/api";
import { encrypt } from "../utils/cripto";

export type HotmartIntegrationConfig = {
  id: number;
  empresa_id: number;
  webhook_public_id: string;
  webhook_url: string | null;
  ativo: boolean;
  hottok_configurado: boolean;
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

export type HotmartIntegrationSummary = {
  total_eventos: number;
  total_processados: number;
  total_clientes_vinculados: number;
  ultimo_evento_em: string | null;
  ultima_sincronizacao_em: string | null;
};

export type HotmartRecentEvent = {
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

export type HotmartDetectedProduct = {
  hotmart_product_key: string;
  hotmart_product_id: string;
  hotmart_offer_code: string;
  hotmart_product_name: string;
  total_eventos: number;
  ultimo_recebimento_em: string | null;
  ultimo_tipo_evento: string;
  ultimo_status_compra: string;
  comercial_produto_id: number | null;
  comercial_produto_nome: string;
  comercial_produto_preco_base: number | null;
};

export type HotmartIntegrationOverview = {
  integracao: HotmartIntegrationConfig;
  summary: HotmartIntegrationSummary;
  eventos_recentes: HotmartRecentEvent[];
  produtos_detectados: HotmartDetectedProduct[];
  official_header_name: string;
};

type HotmartResponse = {
  success?: boolean;
  message?: string;
  data?: Partial<HotmartIntegrationOverview> & {
    integracao?: Partial<HotmartIntegrationConfig>;
    summary?: Partial<HotmartIntegrationSummary>;
    eventos_recentes?: Partial<HotmartRecentEvent>[];
    produtos_detectados?: Partial<HotmartDetectedProduct>[];
  };
};

function normalizeIntegration(
  raw: Partial<HotmartIntegrationConfig> | undefined,
): HotmartIntegrationConfig {
  return {
    id: Number(raw?.id || 0),
    empresa_id: Number(raw?.empresa_id || 0),
    webhook_public_id: String(raw?.webhook_public_id || ""),
    webhook_url: raw?.webhook_url ? String(raw.webhook_url) : null,
    ativo: Boolean(raw?.ativo),
    hottok_configurado: Boolean(raw?.hottok_configurado),
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
  raw: Partial<HotmartIntegrationSummary> | undefined,
): HotmartIntegrationSummary {
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

function normalizeRecentEvent(raw: Partial<HotmartRecentEvent>): HotmartRecentEvent {
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
  raw: Partial<HotmartDetectedProduct>,
): HotmartDetectedProduct {
  return {
    hotmart_product_key: String(raw?.hotmart_product_key || ""),
    hotmart_product_id: String(raw?.hotmart_product_id || ""),
    hotmart_offer_code: String(raw?.hotmart_offer_code || ""),
    hotmart_product_name: String(raw?.hotmart_product_name || ""),
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

function normalizeResponse(body: HotmartResponse, empresaId: number): HotmartIntegrationOverview {
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
    official_header_name: String(body.data?.official_header_name || "X-HOTMART-HOTTOK"),
  };
}

export async function getHotmartIntegrationOverview(
  empresaId: number,
): Promise<HotmartIntegrationOverview> {
  const payload = await encrypt({ empresa_id: empresaId });
  const response = await fetch(`${API_BASE}/hotmart/configuracao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  if (!response.ok) {
    throw new Error("Falha ao carregar configuracao da Hotmart.");
  }

  const body = (await response.json()) as HotmartResponse;
  if (!body?.success || !body.data?.integracao) {
    throw new Error(body?.message || "Nao foi possivel carregar a integracao da Hotmart.");
  }

  return normalizeResponse(body, empresaId);
}

export async function saveHotmartIntegration(params: {
  empresaId: number;
  hottok: string;
  ativo: boolean;
  sincronizar_vendas: boolean;
  sincronizar_carrinho_abandonado: boolean;
  sincronizar_assinaturas: boolean;
  sincronizar_reembolsos: boolean;
  vincular_clientes_existentes: boolean;
  criar_clientes_automaticamente: boolean;
}): Promise<{ overview: HotmartIntegrationOverview; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    hottok: params.hottok,
    ativo: params.ativo,
    sincronizar_vendas: params.sincronizar_vendas,
    sincronizar_carrinho_abandonado: params.sincronizar_carrinho_abandonado,
    sincronizar_assinaturas: params.sincronizar_assinaturas,
    sincronizar_reembolsos: params.sincronizar_reembolsos,
    vincular_clientes_existentes: params.vincular_clientes_existentes,
    criar_clientes_automaticamente: params.criar_clientes_automaticamente,
  });

  const response = await fetch(`${API_BASE}/hotmart/salvar_integracao`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const body = (await response.json()) as HotmartResponse;
  if (!response.ok || !body?.success || !body.data?.integracao) {
    throw new Error(body?.message || "Nao foi possivel salvar a integracao da Hotmart.");
  }

  return {
    overview: normalizeResponse(body, params.empresaId),
    message: body.message || "Integracao salva com sucesso.",
  };
}

export async function saveHotmartProductMapping(params: {
  empresaId: number;
  hotmartProductKey: string;
  hotmartProductId?: string;
  hotmartOfferCode?: string;
  hotmartProductName: string;
  comercialProdutoId: number;
}): Promise<{ overview: HotmartIntegrationOverview; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    hotmart_product_key: params.hotmartProductKey,
    hotmart_product_id: params.hotmartProductId,
    hotmart_offer_code: params.hotmartOfferCode,
    hotmart_product_name: params.hotmartProductName,
    comercial_produto_id: params.comercialProdutoId,
  });

  const response = await fetch(`${API_BASE}/hotmart/vincular_produto`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const body = (await response.json()) as HotmartResponse;
  if (!response.ok || !body?.success || !body.data?.integracao) {
    throw new Error(body?.message || "Nao foi possivel vincular o produto Hotmart.");
  }

  return {
    overview: normalizeResponse(body, params.empresaId),
    message: body.message || "Produto Hotmart vinculado com sucesso.",
  };
}

export async function removeHotmartProductMapping(params: {
  empresaId: number;
  hotmartProductKey: string;
}): Promise<{ overview: HotmartIntegrationOverview; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    hotmart_product_key: params.hotmartProductKey,
  });

  const response = await fetch(`${API_BASE}/hotmart/desvincular_produto`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const body = (await response.json()) as HotmartResponse;
  if (!response.ok || !body?.success || !body.data?.integracao) {
    throw new Error(body?.message || "Nao foi possivel desvincular o produto Hotmart.");
  }

  return {
    overview: normalizeResponse(body, params.empresaId),
    message: body.message || "Produto Hotmart desvinculado com sucesso.",
  };
}
