import { API_BASE } from "../config/api";
import { readStoredSession } from "../utils/authSession";
import { decrypt, encrypt } from "../utils/cripto";

type ApiEnvelope<T> = {
  boleano?: boolean;
  boll?: boolean;
  boolean?: boolean;
  success?: boolean;
  ok?: boolean;
  obj?: T;
  mensagem?: string;
  message?: string;
  msg?: string;
};

export type FinanceiroDominio = {
  dominio: string;
  id: number;
  codigo: string;
  nome: string;
};

export type FinanceiroCategoria = {
  id: number;
  nome: string;
  categoria_pai_id?: number | null;
  ativo?: boolean;
  tipo_id?: number;
  tipo_codigo?: string;
  tipo_nome?: string;
};

export type FinanceiroCentroCusto = {
  id: number; codigo?: string | null; nome: string; descricao?: string | null; ativo: boolean;
};

export type FinanceiroContaFinanceira = {
  id: number; nome: string; tipo: string; banco?: string | null; agencia?: string | null;
  conta?: string | null; pix_chave?: string | null; saldo_inicial: number; saldo_atual?: number; ativo: boolean;
  empresas_grupo?: Array<{ id: number; nome: string }>;
  empresas_grupo_ids?: number[];
};

export type FinanceiroContraparte = {
  id: number; nome: string; documento?: string | null; email?: string | null;
  cpf?: string | null; cnpj?: string | null; telefone?: string | null; endereco?: string | null;
  cep?: string | null; uf?: string | null; cidade?: string | null; tipo: string; ativo: boolean;
};

export type FinanceiroEmpresaGrupo = {
  id: number; nome: string; razao_social?: string | null; cnpj?: string | null;
  email?: string | null; telefone?: string | null; endereco?: string | null;
  cep?: string | null; uf?: string | null; cidade?: string | null; ativo: boolean;
};

export type FinanceiroFormaPagamento = {
  id: number; nome: string; taxa_percentual: number; taxa_fixa: number; ativo: boolean;
};

export type FinanceiroContaParcela = {
  id: number;
  parcela_numero: number;
  parcela_total: number;
  valor_original: number;
  valor_em_aberto?: number;
  vencimento: string;
  status_codigo: string;
  status_nome: string;
  anexo_url?: string | null;
  anexo_nome_arquivo?: string | null;
  anexo_mimetype?: string | null;
  ultimo_pagamento_anexo_url?: string | null;
  ultimo_pagamento_anexo_nome_arquivo?: string | null;
  ultimo_pagamento_anexo_mimetype?: string | null;
};

export type FinanceiroContaAgrupada = {
  grupo_parcelamento_id: string;
  descricao: string;
  total_parcelas: number;
  valor_total: number;
  valor_em_aberto_total?: number;
  primeiro_vencimento: string;
  ultimo_vencimento: string;
  parcelas: FinanceiroContaParcela[];
};

export type FinanceiroContaItem = {
  id: number;
  descricao: string;
  valor_original: number;
  valor_pago_acumulado?: number;
  valor_recebido_acumulado?: number;
  valor_em_aberto?: number;
  vencimento: string;
  competencia?: string | null;
  emissao?: string | null;
  documento_numero?: string | null;
  categoria_nome?: string | null;
  centro_custo_nome?: string | null;
  conta_financeira_nome?: string | null;
  contraparte_nome?: string | null;
  empresa_grupo_id?: number | null;
  empresa_grupo_nome?: string | null;
  taxa_acumulada?: number;
  valor_liquido_acumulado?: number;
  status_codigo?: string;
  status_nome?: string;
  parcela_numero?: number;
  parcela_total?: number;
  grupo_parcelamento_id?: string | null;
  anexo_url?: string | null;
  anexo_nome_arquivo?: string | null;
  anexo_mimetype?: string | null;
  ultimo_pagamento_anexo_url?: string | null;
  ultimo_pagamento_anexo_nome_arquivo?: string | null;
  ultimo_pagamento_anexo_mimetype?: string | null;
};

export type FinanceiroLancamento = {
  id: number;
  data_lancamento: string;
  natureza_codigo: string;
  status_codigo: string;
  origem_codigo: string;
  descricao: string;
  valor: number;
  categoria_nome?: string | null;
  centro_custo_nome?: string | null;
  conta_financeira_nome?: string | null;
  transferencia_id?: number | null;
  transferencia_observacao?: string | null;
  transferencia_anexo_url?: string | null;
  transferencia_anexo_nome_arquivo?: string | null;
  transferencia_anexo_mimetype?: string | null;
  transferencia_conta_origem_nome?: string | null;
  transferencia_conta_destino_nome?: string | null;
  transferencia_movimento?: "entrada" | "saida" | null;
};

export type FinanceiroAlerta = {
  id: number;
  titulo: string;
  descricao?: string | null;
  data_alerta: string;
  tipo_codigo: string;
  status_codigo: string;
};

export type FinanceiroMetaUsuario = {
  id: number;
  empresa_id: number;
  usuario_id: number;
  mes_referencia: string;
  valor_meta: number;
  percentual_comissao: number;
  valor_comissao_fixa: number;
  created_at?: string;
  updated_at?: string;
};

export type FinanceiroComissaoLancamento = {
  id: number;
  empresa_id: number;
  usuario_id: number;
  base_calculo: number;
  percentual_aplicado: number;
  valor_comissao: number;
  status_id: number;
  observacao?: string | null;
  competencia: string;
  created_at?: string;
  updated_at?: string;
};

export type FinanceiroMetaMesItem = FinanceiroMetaUsuario & {
  usuario_nome?: string;
  valor_realizado_crm?: number;
  percentual_atingimento?: number;
  valor_faltante_meta?: number;
  possui_comissao_lancada?: boolean;
};

export type FinanceiroComissaoLancadaMesItem = FinanceiroComissaoLancamento & {
  usuario_nome?: string;
  status_codigo?: string;
  status_nome?: string;
};

export type FinanceiroMetaFinalizacaoResultado = {
  meta: {
    id: number;
    usuario_id: number;
    mes_referencia: string;
    valor_meta: number;
    valor_realizado_crm: number;
    percentual_comissao: number;
    valor_comissao_fixa: number;
  };
  comissao_lancamento: FinanceiroComissaoLancamento;
  conta_pagar: FinanceiroContaItem;
  resumo: {
    base_calculo: number;
    percentual_aplicado: number;
    valor_comissao: number;
  };
};

export type FinanceiroCobrancaAssinatura = {
  empresa_id: number;
  assinatura_id?: number | null;
  stripe_invoice_id?: string | null;
  status?: string | null;
  valor_total?: number | null;
  moeda?: string | null;
  paid?: boolean | null;
  paid_at?: string | null;
  due_date?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  tentativa?: number | null;
  stripe_event_type?: string | null;
  created_at?: string | null;
};

export type FinanceiroAssinaturaEmpresa = {
  id: number;
  empresa_id: number;
  nome: string;
  fornecedor: string;
  plano?: string | null;
  valor: number;
  ciclo_cobranca: string;
  dia_vencimento?: number | null;
  proximo_vencimento?: string | null;
  categoria_id?: number | null;
  categoria_nome?: string | null;
  conta_financeira_id?: number | null;
  observacao?: string | null;
  ativo: boolean;
  criado_por?: number | null;
  created_at?: string;
  updated_at?: string;
};

export type FinanceiroUsuarioOption = {
  id: number;
  name: string;
  email?: string;
  ativo?: boolean;
  is_master?: boolean;
};

export type FinanceiroDashboard = {
  dre_mensal: Array<{
    mes_referencia: string;
    receita_bruta: number;
    despesas_totais: number;
    resultado_operacional: number;
  }>;
  fluxo_30_dias: Array<{
    dia: string;
    entradas_realizadas: number;
    saidas_realizadas: number;
    entradas_previstas: number;
    saidas_previstas: number;
    saldo_realizado: number;
    saldo_projetado: number;
  }>;
  inadimplencia: {
    total_titulos_vencidos?: number;
    valor_total_vencido?: number;
    total_titulos_em_aberto?: number;
  };
  mensalidades_ativas: {
    total_assinaturas_ativas?: number;
    mensalidades_ativas_total?: number;
  };
  previsao_crm: Array<{
    data_prevista: string;
    total_negocios: number;
    valor_bruto_pipeline: number;
    valor_ponderado_pipeline: number;
  }>;
  resumo_operacional: {
    saldo_disponivel?: number; receber_mes?: number; pagar_mes?: number;
    recebido_mes?: number; pago_mes?: number;
  };
  proximos_vencimentos: Array<{
    id: number; tipo: "receber" | "pagar"; descricao: string; vencimento: string; valor: number;
  }>;
};

export type FinanceiroHealthcheck = {
  contas_pagar: number;
  contas_receber: number;
  lancamentos: number;
};

type SessionContext = {
  empresaId: number;
  userId: number;
};

async function getSessionContext(): Promise<SessionContext> {
  const session = await readStoredSession();
  if (!session?.user?.empresa_id || !session.user.id) {
    throw new Error("Sessao invalida. Faca login novamente.");
  }

  return {
    empresaId: session.user.empresa_id,
    userId: session.user.id,
  };
}

async function postEncrypted<T>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<{ obj: T; message?: string }> {
  const session = await getSessionContext();
  const encrypted = await encrypt({
    ...payload,
    empresa_id: session.empresaId,
    usuario_autenticado_id: session.userId,
  });
  const response = await fetch(`${API_BASE}/financeiro${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: encrypted }),
  });

  return parseApiResponse<T>(response);
}

async function postEncryptedWithFile<T>(
  endpoint: string,
  payload: Record<string, unknown>,
  file?: File | null
): Promise<{ obj: T; message?: string }> {
  const session = await getSessionContext();
  const encrypted = await encrypt({
    ...payload,
    empresa_id: session.empresaId,
    usuario_autenticado_id: session.userId,
  });
  const body = new FormData();
  body.append("payload", encrypted);

  if (file) {
    body.append("file", file);
  }

  const response = await fetch(`${API_BASE}/financeiro${endpoint}`, {
    method: "POST",
    body,
  });

  return parseApiResponse<T>(response);
}

async function parseApiResponse<T>(response: Response): Promise<{ obj: T; message?: string }> {
  if (!response.ok) {
    throw new Error("Falha de comunicacao com o servidor.");
  }

  const responseData = await response.json();
  const decryptedPayload = responseData?.payload
    ? await decrypt(responseData.payload)
    : responseData;

  const data = decryptedPayload as ApiEnvelope<T> & Record<string, unknown>;
  const ok =
    Boolean(data?.boleano) ||
    Boolean(data?.boll) ||
    Boolean(data?.boolean) ||
    Boolean(data?.ok) ||
    Boolean(data?.success);
  const message =
    data?.mensagem ||
    data?.message ||
    data?.msg ||
    (ok ? undefined : "Nao foi possivel concluir a operacao.");

  if (!ok) {
    throw new Error(message);
  }

  return {
    obj: (data?.obj as T) ?? ({} as T),
    message,
  };
}

export async function getFinanceiroDominios(): Promise<FinanceiroDominio[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroDominio[]>("/dominios", {
    empresa_id: session.empresaId,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function getFinanceiroDashboard(): Promise<FinanceiroDashboard> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroDashboard>("/dashboard", {
    empresa_id: session.empresaId,
  });
  return obj;
}

export async function getFinanceiroHealthcheck(): Promise<FinanceiroHealthcheck> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroHealthcheck>("/healthcheck", {
    empresa_id: session.empresaId,
  });
  return obj;
}

export async function listFinanceiroCategorias(): Promise<FinanceiroCategoria[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroCategoria[]>("/categorias/listar", {
    empresa_id: session.empresaId,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function createFinanceiroCategoria(payload: {
  nome: string;
  tipo_codigo: string;
  categoria_pai_id?: number | null;
}): Promise<FinanceiroCategoria> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroCategoria>("/categorias/criar", {
    empresa_id: session.empresaId,
    nome: payload.nome,
    tipo_codigo: payload.tipo_codigo,
    categoria_pai_id: payload.categoria_pai_id ?? null,
  });
  return obj;
}

export async function listFinanceiroCentrosCusto(): Promise<FinanceiroCentroCusto[]> {
  const { obj } = await postEncrypted<FinanceiroCentroCusto[]>("/centros_custo/listar", {});
  return Array.isArray(obj) ? obj : [];
}

export async function saveFinanceiroCentroCusto(payload: Partial<FinanceiroCentroCusto> & { nome: string }) {
  const { obj } = await postEncrypted<FinanceiroCentroCusto>("/centros_custo/salvar", payload);
  return obj;
}

export async function listFinanceiroContasFinanceiras(): Promise<FinanceiroContaFinanceira[]> {
  const { obj } = await postEncrypted<FinanceiroContaFinanceira[]>("/contas_financeiras/listar", {});
  return Array.isArray(obj) ? obj : [];
}

export async function saveFinanceiroContaFinanceira(payload: Partial<FinanceiroContaFinanceira> & { nome: string }) {
  const { obj } = await postEncrypted<FinanceiroContaFinanceira>("/contas_financeiras/salvar", payload);
  return obj;
}

export async function listFinanceiroEmpresasGrupo(): Promise<FinanceiroEmpresaGrupo[]> {
  const { obj } = await postEncrypted<FinanceiroEmpresaGrupo[]>("/empresas_grupo/listar", {});
  return Array.isArray(obj) ? obj : [];
}

export async function saveFinanceiroEmpresaGrupo(payload: Partial<FinanceiroEmpresaGrupo> & { nome: string }) {
  const { obj } = await postEncrypted<FinanceiroEmpresaGrupo>("/empresas_grupo/salvar", payload);
  return obj;
}

export async function listFinanceiroFormasPagamento(): Promise<FinanceiroFormaPagamento[]> {
  const { obj } = await postEncrypted<FinanceiroFormaPagamento[]>("/formas_pagamento/listar", {});
  return Array.isArray(obj) ? obj : [];
}

export async function saveFinanceiroFormaPagamento(payload: Partial<FinanceiroFormaPagamento> & { nome: string }) {
  const { obj } = await postEncrypted<FinanceiroFormaPagamento>("/formas_pagamento/salvar", payload);
  return obj;
}

export async function createFinanceiroTransferencia(payload: {
  conta_origem_id: number; conta_destino_id: number; valor: number;
  data_transferencia?: string | null; observacao?: string; comprovante?: File | null;
}) {
  const session = await getSessionContext();
  const { comprovante, ...transferData } = payload;
  const { obj } = await postEncryptedWithFile<{ id: number }>("/transferencias/criar", {
    ...transferData, usuario_id: session.userId,
  }, comprovante);
  return obj;
}

export async function listFinanceiroContrapartes(): Promise<FinanceiroContraparte[]> {
  const { obj } = await postEncrypted<FinanceiroContraparte[]>("/contrapartes/listar", {});
  return Array.isArray(obj) ? obj : [];
}

export async function saveFinanceiroContraparte(payload: Partial<FinanceiroContraparte> & { nome: string }) {
  const { obj } = await postEncrypted<FinanceiroContraparte>("/contrapartes/salvar", payload);
  return obj;
}

export async function listFinanceiroContasPagar(payload: {
  status_codigo?: string;
  mes_referencia?: string;
  agrupar_parcelamento?: boolean;
  limit?: number;
  offset?: number;
  conta_financeira_id?: number | null;
  contraparte_id?: number | null;
  empresa_grupo_id?: number | null;
}): Promise<Array<FinanceiroContaItem | FinanceiroContaAgrupada>> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<Array<FinanceiroContaItem | FinanceiroContaAgrupada>>(
    "/contas_pagar/listar",
    {
      empresa_id: session.empresaId,
      status_codigo: payload.status_codigo || "",
      mes_referencia: payload.mes_referencia || undefined,
      agrupar_parcelamento: payload.agrupar_parcelamento ?? false,
      limit: payload.limit ?? 50,
      offset: payload.offset ?? 0,
      conta_financeira_id: payload.conta_financeira_id ?? null,
      contraparte_id: payload.contraparte_id ?? null,
      empresa_grupo_id: payload.empresa_grupo_id ?? null,
    }
  );
  return Array.isArray(obj) ? obj : [];
}

export async function createFinanceiroContaPagar(payload: {
  descricao: string;
  vencimento: string;
  valor_original: number;
  categoria_id?: number | null;
  centro_custo_id?: number | null;
  conta_financeira_id?: number | null;
  contraparte_id?: number | null;
  empresa_grupo_id?: number | null;
  competencia?: string | null;
  emissao?: string | null;
  documento_numero?: string | null;
  observacao?: string;
  file?: File | null;
}): Promise<FinanceiroContaItem> {
  const session = await getSessionContext();
  const { obj } = await postEncryptedWithFile<FinanceiroContaItem>(
    "/contas_pagar/criar",
    {
      empresa_id: session.empresaId,
      usuario_id: session.userId,
      descricao: payload.descricao,
      vencimento: payload.vencimento,
      valor_original: payload.valor_original,
      categoria_id: payload.categoria_id ?? null,
      centro_custo_id: payload.centro_custo_id ?? null,
      conta_financeira_id: payload.conta_financeira_id ?? null,
      contraparte_id: payload.contraparte_id ?? null,
      empresa_grupo_id: payload.empresa_grupo_id ?? null,
      competencia: payload.competencia ?? null,
      emissao: payload.emissao ?? null,
      documento_numero: payload.documento_numero ?? null,
      observacao: payload.observacao || undefined,
    },
    payload.file
  );
  return obj;
}

export async function createFinanceiroContaPagarParcelado(payload: {
  descricao: string;
  vencimento_inicial: string;
  valor_total: number;
  quantidade_parcelas: number;
  periodicidade_meses?: number;
  categoria_id?: number | null;
  centro_custo_id?: number | null;
  conta_financeira_id?: number | null;
  contraparte_id?: number | null;
  empresa_grupo_id?: number | null;
  competencia?: string | null;
  emissao?: string | null;
  documento_numero?: string | null;
  observacao?: string;
  file?: File | null;
}): Promise<{ grupo_parcelamento_id: string; parcelas: FinanceiroContaItem[] }> {
  const session = await getSessionContext();
  const { obj } = await postEncryptedWithFile<{
    grupo_parcelamento_id: string;
    parcelas: FinanceiroContaItem[];
  }>(
    "/contas_pagar/criar_parcelado",
    {
      empresa_id: session.empresaId,
      usuario_id: session.userId,
      descricao: payload.descricao,
      vencimento_inicial: payload.vencimento_inicial,
      valor_total: payload.valor_total,
      quantidade_parcelas: payload.quantidade_parcelas,
      periodicidade_meses: payload.periodicidade_meses ?? 1,
      categoria_id: payload.categoria_id ?? null,
      centro_custo_id: payload.centro_custo_id ?? null,
      conta_financeira_id: payload.conta_financeira_id ?? null,
      contraparte_id: payload.contraparte_id ?? null,
      empresa_grupo_id: payload.empresa_grupo_id ?? null,
      competencia: payload.competencia ?? null,
      emissao: payload.emissao ?? null,
      documento_numero: payload.documento_numero ?? null,
      observacao: payload.observacao || undefined,
    },
    payload.file
  );
  return obj;
}

export async function registerFinanceiroPagamento(payload: {
  conta_pagar_id: number;
  valor: number;
  meio_pagamento?: string;
  observacao?: string;
  file?: File | null;
  conta_financeira_id?: number | null;
  data_pagamento?: string | null;
  forma_pagamento_id?: number | null;
}): Promise<{ id: number }> {
  const session = await getSessionContext();
  const { obj } = await postEncryptedWithFile<{ id: number }>(
    "/contas_pagar/registrar_pagamento",
    {
      empresa_id: session.empresaId,
      usuario_id: session.userId,
      conta_pagar_id: payload.conta_pagar_id,
      valor: payload.valor,
      conta_financeira_id: payload.conta_financeira_id ?? null,
      data_pagamento: payload.data_pagamento ?? null,
      meio_pagamento: payload.meio_pagamento || undefined,
      forma_pagamento_id: payload.forma_pagamento_id ?? null,
      observacao: payload.observacao || undefined,
    },
    payload.file
  );
  return obj;
}

export async function deleteFinanceiroContaPagar(payload: {
  conta_pagar_id?: number;
  grupo_parcelamento_id?: string;
}): Promise<{ total_afetados: number; ids: number[] }> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<{ total_afetados: number; ids: number[] }>(
    "/contas_pagar/deletar",
    {
      empresa_id: session.empresaId,
      conta_pagar_id: payload.conta_pagar_id ?? undefined,
      grupo_parcelamento_id: payload.grupo_parcelamento_id ?? undefined,
    }
  );
  return obj;
}

export async function listFinanceiroContasReceber(payload: {
  status_codigo?: string;
  mes_referencia?: string;
  agrupar_parcelamento?: boolean;
  limit?: number;
  offset?: number;
  conta_financeira_id?: number | null;
  contraparte_id?: number | null;
  empresa_grupo_id?: number | null;
}): Promise<Array<FinanceiroContaItem | FinanceiroContaAgrupada>> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<Array<FinanceiroContaItem | FinanceiroContaAgrupada>>(
    "/contas_receber/listar",
    {
      empresa_id: session.empresaId,
      status_codigo: payload.status_codigo || "",
      mes_referencia: payload.mes_referencia || undefined,
      agrupar_parcelamento: payload.agrupar_parcelamento ?? false,
      limit: payload.limit ?? 50,
      offset: payload.offset ?? 0,
      conta_financeira_id: payload.conta_financeira_id ?? null,
      contraparte_id: payload.contraparte_id ?? null,
      empresa_grupo_id: payload.empresa_grupo_id ?? null,
    }
  );
  return Array.isArray(obj) ? obj : [];
}

export async function createFinanceiroContaReceber(payload: {
  descricao: string;
  vencimento: string;
  valor_original: number;
  categoria_id?: number | null;
  centro_custo_id?: number | null;
  conta_financeira_id?: number | null;
  contraparte_id?: number | null;
  empresa_grupo_id?: number | null;
  competencia?: string | null;
  emissao?: string | null;
  documento_numero?: string | null;
  observacao?: string;
  file?: File | null;
}): Promise<FinanceiroContaItem> {
  const session = await getSessionContext();
  const { obj } = await postEncryptedWithFile<FinanceiroContaItem>(
    "/contas_receber/criar",
    {
      empresa_id: session.empresaId,
      usuario_id: session.userId,
      descricao: payload.descricao,
      vencimento: payload.vencimento,
      valor_original: payload.valor_original,
      categoria_id: payload.categoria_id ?? null,
      centro_custo_id: payload.centro_custo_id ?? null,
      conta_financeira_id: payload.conta_financeira_id ?? null,
      contraparte_id: payload.contraparte_id ?? null,
      empresa_grupo_id: payload.empresa_grupo_id ?? null,
      competencia: payload.competencia ?? null,
      emissao: payload.emissao ?? null,
      documento_numero: payload.documento_numero ?? null,
      observacao: payload.observacao || undefined,
    },
    payload.file
  );
  return obj;
}

export async function createFinanceiroContaReceberParcelado(payload: {
  descricao: string;
  vencimento_inicial: string;
  valor_total: number;
  quantidade_parcelas: number;
  periodicidade_meses?: number;
  categoria_id?: number | null;
  centro_custo_id?: number | null;
  conta_financeira_id?: number | null;
  contraparte_id?: number | null;
  empresa_grupo_id?: number | null;
  competencia?: string | null;
  emissao?: string | null;
  documento_numero?: string | null;
  observacao?: string;
  file?: File | null;
}): Promise<{ grupo_parcelamento_id: string; parcelas: FinanceiroContaItem[] }> {
  const session = await getSessionContext();
  const { obj } = await postEncryptedWithFile<{
    grupo_parcelamento_id: string;
    parcelas: FinanceiroContaItem[];
  }>(
    "/contas_receber/criar_parcelado",
    {
      empresa_id: session.empresaId,
      usuario_id: session.userId,
      descricao: payload.descricao,
      vencimento_inicial: payload.vencimento_inicial,
      valor_total: payload.valor_total,
      quantidade_parcelas: payload.quantidade_parcelas,
      periodicidade_meses: payload.periodicidade_meses ?? 1,
      categoria_id: payload.categoria_id ?? null,
      centro_custo_id: payload.centro_custo_id ?? null,
      conta_financeira_id: payload.conta_financeira_id ?? null,
      contraparte_id: payload.contraparte_id ?? null,
      empresa_grupo_id: payload.empresa_grupo_id ?? null,
      competencia: payload.competencia ?? null,
      emissao: payload.emissao ?? null,
      documento_numero: payload.documento_numero ?? null,
      observacao: payload.observacao || undefined,
    },
    payload.file
  );
  return obj;
}

export async function registerFinanceiroRecebimento(payload: {
  conta_receber_id: number;
  valor: number;
  meio_pagamento?: string;
  observacao?: string;
  conta_financeira_id?: number | null;
  data_recebimento?: string | null;
  forma_pagamento_id?: number | null;
}): Promise<{ id: number }> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<{ id: number }>("/contas_receber/registrar_recebimento", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    conta_receber_id: payload.conta_receber_id,
    valor: payload.valor,
    conta_financeira_id: payload.conta_financeira_id ?? null,
    data_recebimento: payload.data_recebimento ?? null,
    meio_pagamento: payload.meio_pagamento || undefined,
    forma_pagamento_id: payload.forma_pagamento_id ?? null,
    observacao: payload.observacao || undefined,
  });
  return obj;
}

export async function deleteFinanceiroContaReceber(payload: {
  conta_receber_id?: number;
  grupo_parcelamento_id?: string;
}): Promise<{ total_afetados: number; ids: number[] }> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<{ total_afetados: number; ids: number[] }>(
    "/contas_receber/deletar",
    {
      empresa_id: session.empresaId,
      conta_receber_id: payload.conta_receber_id ?? undefined,
      grupo_parcelamento_id: payload.grupo_parcelamento_id ?? undefined,
    }
  );
  return obj;
}

export async function listFinanceiroLancamentos(payload: {
  natureza_codigo?: string;
  data_inicio?: string;
  data_fim?: string;
  limit?: number;
  offset?: number;
}): Promise<FinanceiroLancamento[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroLancamento[]>("/lancamentos/listar", {
    empresa_id: session.empresaId,
    natureza_codigo: payload.natureza_codigo || "",
    data_inicio: payload.data_inicio || undefined,
    data_fim: payload.data_fim || undefined,
    limit: payload.limit ?? 100,
    offset: payload.offset ?? 0,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function deleteFinanceiroLancamento(lancamentoId: number): Promise<void> {
  const session = await getSessionContext();
  await postEncrypted("/lancamentos/deletar", {
    empresa_id: session.empresaId,
    lancamento_id: lancamentoId,
  });
}

export async function listFinanceiroAlertas(payload?: {
  status_codigo?: string;
}): Promise<FinanceiroAlerta[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroAlerta[]>("/alertas/listar", {
    empresa_id: session.empresaId,
    status_codigo: payload?.status_codigo || "",
  });
  return Array.isArray(obj) ? obj : [];
}

export async function saveFinanceiroMetaUsuario(payload: {
  usuario_id: number;
  mes_referencia: string;
  valor_meta: number;
  percentual_comissao?: number;
  valor_comissao_fixa?: number;
}): Promise<FinanceiroMetaUsuario> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroMetaUsuario>("/comissoes/meta_salvar", {
    empresa_id: session.empresaId,
    usuario_id: payload.usuario_id,
    mes_referencia: payload.mes_referencia,
    valor_meta: payload.valor_meta,
    percentual_comissao: payload.percentual_comissao ?? 0,
    valor_comissao_fixa: payload.valor_comissao_fixa ?? 0,
  });
  return obj;
}

export async function launchFinanceiroComissao(payload: {
  usuario_id: number;
  base_calculo: number;
  percentual_aplicado?: number;
  valor_comissao?: number;
  mes_referencia?: string;
  observacao?: string;
}): Promise<FinanceiroComissaoLancamento> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroComissaoLancamento>("/comissoes/lancar", {
    empresa_id: session.empresaId,
    usuario_id: payload.usuario_id,
    base_calculo: payload.base_calculo,
    percentual_aplicado: payload.percentual_aplicado ?? 0,
    valor_comissao: payload.valor_comissao,
    mes_referencia: payload.mes_referencia || undefined,
    observacao: payload.observacao || undefined,
  });
  return obj;
}

export async function finalizeFinanceiroMetaUsuario(payload: {
  usuario_id: number;
  mes_referencia: string;
  observacao?: string;
}): Promise<FinanceiroMetaFinalizacaoResultado> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroMetaFinalizacaoResultado>(
    "/comissoes/meta_finalizar",
    {
      empresa_id: session.empresaId,
      usuario_id: payload.usuario_id,
      usuario_executor_id: session.userId,
      mes_referencia: payload.mes_referencia,
      observacao: payload.observacao || undefined,
    }
  );
  return obj;
}

export async function listFinanceiroMetasMes(payload: {
  mes_referencia?: string;
}): Promise<FinanceiroMetaMesItem[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroMetaMesItem[]>("/comissoes/metas_listar", {
    empresa_id: session.empresaId,
    mes_referencia: payload.mes_referencia || undefined,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function listFinanceiroComissoesLancadasMes(payload: {
  mes_referencia?: string;
}): Promise<FinanceiroComissaoLancadaMesItem[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroComissaoLancadaMesItem[]>(
    "/comissoes/lancamentos_listar",
    {
      empresa_id: session.empresaId,
      mes_referencia: payload.mes_referencia || undefined,
    }
  );
  return Array.isArray(obj) ? obj : [];
}

export async function listFinanceiroAssinaturasCobrancas(payload?: {
  limit?: number;
}): Promise<FinanceiroCobrancaAssinatura[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroCobrancaAssinatura[]>("/assinaturas/cobrancas", {
    empresa_id: session.empresaId,
    limit: payload?.limit ?? 100,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function listFinanceiroAssinaturasEmpresa(payload?: {
  status?: "" | "ativos" | "inativos";
}): Promise<FinanceiroAssinaturaEmpresa[]> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroAssinaturaEmpresa[]>("/assinaturas/listar", {
    empresa_id: session.empresaId,
    status: payload?.status || "",
  });
  return Array.isArray(obj) ? obj : [];
}

export async function createFinanceiroAssinaturaEmpresa(payload: {
  nome: string;
  fornecedor: string;
  plano?: string;
  valor: number;
  ciclo_cobranca: string;
  dia_vencimento?: number | null;
  proximo_vencimento?: string | null;
  categoria_id?: number | null;
  observacao?: string;
  ativo?: boolean;
}): Promise<FinanceiroAssinaturaEmpresa> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroAssinaturaEmpresa>("/assinaturas/criar", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    nome: payload.nome,
    fornecedor: payload.fornecedor,
    plano: payload.plano || undefined,
    valor: payload.valor,
    ciclo_cobranca: payload.ciclo_cobranca,
    dia_vencimento: payload.dia_vencimento ?? null,
    proximo_vencimento: payload.proximo_vencimento ?? null,
    categoria_id: payload.categoria_id ?? null,
    observacao: payload.observacao || undefined,
    ativo: payload.ativo ?? true,
  });
  return obj;
}

export async function updateFinanceiroAssinaturaEmpresa(payload: {
  assinatura_id: number;
  nome: string;
  fornecedor: string;
  plano?: string;
  valor: number;
  ciclo_cobranca: string;
  dia_vencimento?: number | null;
  proximo_vencimento?: string | null;
  categoria_id?: number | null;
  observacao?: string;
  ativo?: boolean;
}): Promise<FinanceiroAssinaturaEmpresa> {
  const session = await getSessionContext();
  const { obj } = await postEncrypted<FinanceiroAssinaturaEmpresa>("/assinaturas/editar", {
    empresa_id: session.empresaId,
    assinatura_id: payload.assinatura_id,
    nome: payload.nome,
    fornecedor: payload.fornecedor,
    plano: payload.plano || null,
    valor: payload.valor,
    ciclo_cobranca: payload.ciclo_cobranca,
    dia_vencimento: payload.dia_vencimento ?? null,
    proximo_vencimento: payload.proximo_vencimento ?? null,
    categoria_id: payload.categoria_id ?? null,
    observacao: payload.observacao || null,
    ativo: payload.ativo,
  });
  return obj;
}

export async function inativarFinanceiroAssinaturaEmpresa(assinaturaId: number): Promise<void> {
  const session = await getSessionContext();
  await postEncrypted("/assinaturas/inativar", {
    empresa_id: session.empresaId,
    assinatura_id: assinaturaId,
  });
}

export async function listFinanceiroUsuarios(): Promise<FinanceiroUsuarioOption[]> {
  const session = await getSessionContext();
  const encrypted = await encrypt({ empresa_id: session.empresaId });
  const response = await fetch(`${API_BASE}/user/lista_usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: encrypted }),
  });

  if (!response.ok) {
    throw new Error("Falha de comunicacao com o servidor.");
  }

  const responseData = await response.json();
  const decryptedPayload = responseData?.payload
    ? await decrypt(responseData.payload)
    : responseData;

  const data = decryptedPayload as ApiEnvelope<FinanceiroUsuarioOption[]> & Record<string, unknown>;
  const ok =
    Boolean(data?.boleano) ||
    Boolean(data?.boll) ||
    Boolean(data?.boolean) ||
    Boolean(data?.ok) ||
    Boolean(data?.success);

  if (!ok) {
    throw new Error(
      data?.mensagem ||
        data?.message ||
        data?.msg ||
        "Nao foi possivel carregar usuarios."
    );
  }

  const users = Array.isArray(data?.obj) ? data.obj : [];
  return users.filter((user) => Boolean(user?.id && user?.name));
}

export async function markFinanceiroAlertaLido(alertaId: number): Promise<void> {
  const session = await getSessionContext();
  await postEncrypted("/alertas/marcar_lido", {
    empresa_id: session.empresaId,
    usuario_id: session.userId,
    alerta_id: alertaId,
  });
}
