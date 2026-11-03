import { postEncrypted, postEncryptedMultipart, type RNFile } from './apiClient';
import type { User } from '@/types';

export type ContaKind = 'pagar' | 'receber';

export type StatusTitulo = 'aberto' | 'parcial' | 'pago' | 'vencido' | 'cancelado';

export interface FinanceiroCategoria {
  id: number;
  nome: string;
  tipo_codigo?: string;
  tipo_nome?: string;
  ativo?: boolean;
  created_at?: string;
}

export type CategoriaTipo = 'receita' | 'despesa' | 'ambos';

export type AlertaStatus = 'novo' | 'lido' | 'resolvido';

export interface FinanceiroAlerta {
  id: number;
  titulo: string;
  descricao: string | null;
  tipo_codigo: string;
  status_codigo: AlertaStatus;
  data_alerta: string;
}

export interface ContaTitulo {
  id: number;
  descricao: string;
  vencimento: string;
  valor_original: number;
  desconto: number;
  juros: number;
  multa: number;
  valor_em_aberto: number;
  status_codigo: StatusTitulo;
  status_nome: string;
  categoria_id: number | null;
  categoria_nome: string | null;
  observacao: string | null;
  grupo_parcelamento_id: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  anexo_url: string | null;
  ultimo_pagamento_anexo_url?: string | null;
}

export interface DreMensal {
  mes_referencia: string;
  receita_bruta: number;
  despesas_totais: number;
  resultado_operacional: number;
}

export interface FluxoDia {
  dia: string;
  entradas_realizadas: number;
  saidas_realizadas: number;
  saldo_realizado: number;
}

export interface FinanceiroDashboard {
  dre_mensal: DreMensal[];
  fluxo_30_dias: FluxoDia[];
  inadimplencia: {
    total_titulos_vencidos?: number;
    valor_total_vencido?: number;
    total_titulos_em_aberto?: number;
  };
  mensalidades_ativas: {
    total_assinaturas_ativas?: number;
    mensalidades_ativas_total?: number;
  };
  previsao_crm: {
    data_prevista: string;
    total_negocios: number;
    valor_bruto_pipeline: number;
    valor_ponderado_pipeline: number;
  }[];
}

export interface Lancamento {
  id: number;
  descricao: string | null;
  valor: number;
  data_lancamento: string;
  natureza_codigo: 'entrada' | 'saida';
  status_codigo: string;
  origem_codigo: string;
  categoria_nome: string | null;
}

export async function getFinanceiroDashboard(user: User): Promise<FinanceiroDashboard> {
  const { obj } = await postEncrypted<FinanceiroDashboard>('/financeiro', '/dashboard', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
  });
  return {
    dre_mensal: Array.isArray(obj?.dre_mensal) ? obj.dre_mensal : [],
    fluxo_30_dias: Array.isArray(obj?.fluxo_30_dias) ? obj.fluxo_30_dias : [],
    inadimplencia: obj?.inadimplencia || {},
    mensalidades_ativas: obj?.mensalidades_ativas || {},
    previsao_crm: Array.isArray(obj?.previsao_crm) ? obj.previsao_crm : [],
  };
}

export async function getFinanceiroCategorias(user: User): Promise<FinanceiroCategoria[]> {
  const { obj } = await postEncrypted<FinanceiroCategoria[]>('/financeiro', '/categorias/listar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function criarCategoria(
  user: User,
  payload: { nome: string; tipo_codigo: CategoriaTipo }
): Promise<string> {
  const { message } = await postEncrypted('/financeiro', '/categorias/criar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    nome: payload.nome,
    tipo_codigo: payload.tipo_codigo,
  });
  return message;
}

export async function listarAlertas(
  user: User,
  statusCodigo: AlertaStatus | '' = ''
): Promise<FinanceiroAlerta[]> {
  const { obj } = await postEncrypted<FinanceiroAlerta[]>('/financeiro', '/alertas/listar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    status_codigo: statusCodigo,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function marcarAlertaLido(user: User, alertaId: number): Promise<string> {
  const { message } = await postEncrypted('/financeiro', '/alertas/marcar_lido', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    usuario_id: user.id,
    alerta_id: alertaId,
  });
  return message;
}

export interface ListarContasParams {
  status_codigo?: StatusTitulo | '';
  mes_referencia?: string;
  limit?: number;
  offset?: number;
}

export async function listarContas(
  user: User,
  kind: ContaKind,
  params: ListarContasParams = {}
): Promise<ContaTitulo[]> {
  const { obj } = await postEncrypted<ContaTitulo[]>(
    '/financeiro',
    kind === 'pagar' ? '/contas_pagar/listar' : '/contas_receber/listar',
    {
      empresa_id: user.empresa_id,
      usuario_autenticado_id: user.id,
      status_codigo: params.status_codigo || '',
      mes_referencia: params.mes_referencia || null,
      limit: params.limit ?? 200,
      offset: params.offset ?? 0,
    }
  );
  return Array.isArray(obj) ? obj : [];
}

export interface NovaContaPayload {
  descricao: string;
  vencimento: string;
  valor: number;
  categoria_id?: number | null;
  observacao?: string;
  centro_custo_id?: number | null;
  conta_financeira_id?: number | null;
  contraparte_id?: number | null;
  empresa_grupo_id?: number | null;
  emissao?: string | null;
  competencia?: string | null;
  documento_numero?: string | null;
  anexo?: RNFile | null;
}

export async function criarConta(user: User, kind: ContaKind, payload: NovaContaPayload): Promise<string> {
  const { message } = await postEncryptedMultipart(
    '/financeiro',
    kind === 'pagar' ? '/contas_pagar/criar' : '/contas_receber/criar',
    {
      empresa_id: user.empresa_id,
      usuario_autenticado_id: user.id,
      usuario_id: user.id,
      descricao: payload.descricao,
      vencimento: payload.vencimento,
      valor_original: payload.valor,
      categoria_id: payload.categoria_id ?? null,
      observacao: payload.observacao || null,
      centro_custo_id: payload.centro_custo_id ?? null,
      conta_financeira_id: payload.conta_financeira_id ?? null,
      contraparte_id: payload.contraparte_id ?? null,
      empresa_grupo_id: payload.empresa_grupo_id ?? null,
      emissao: payload.emissao || null,
      competencia: payload.competencia || null,
      documento_numero: payload.documento_numero || null,
    },
    { file: payload.anexo || undefined }
  );
  return message;
}

export interface NovaContaParceladaPayload extends NovaContaPayload {
  quantidade_parcelas: number;
}

export async function criarContaParcelada(
  user: User,
  kind: ContaKind,
  payload: NovaContaParceladaPayload
): Promise<string> {
  const { message } = await postEncryptedMultipart(
    '/financeiro',
    kind === 'pagar' ? '/contas_pagar/criar_parcelado' : '/contas_receber/criar_parcelado',
    {
      empresa_id: user.empresa_id,
      usuario_autenticado_id: user.id,
      usuario_id: user.id,
      descricao: payload.descricao,
      vencimento_inicial: payload.vencimento,
      valor_total: payload.valor,
      quantidade_parcelas: payload.quantidade_parcelas,
      periodicidade_meses: 1,
      categoria_id: payload.categoria_id ?? null,
      observacao: payload.observacao || null,
      centro_custo_id: payload.centro_custo_id ?? null,
      conta_financeira_id: payload.conta_financeira_id ?? null,
      contraparte_id: payload.contraparte_id ?? null,
      empresa_grupo_id: payload.empresa_grupo_id ?? null,
      emissao: payload.emissao || null,
      competencia: payload.competencia || null,
      documento_numero: payload.documento_numero || null,
    },
    { file: payload.anexo || undefined }
  );
  return message;
}

export interface BaixaPayload {
  conta_id: number;
  valor: number;
  data?: string;
  observacao?: string;
}

export async function registrarBaixa(user: User, kind: ContaKind, payload: BaixaPayload): Promise<string> {
  const endpoint =
    kind === 'pagar' ? '/contas_pagar/registrar_pagamento' : '/contas_receber/registrar_recebimento';
  const { message } = await postEncrypted('/financeiro', endpoint, {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    usuario_id: user.id,
    ...(kind === 'pagar'
      ? { conta_pagar_id: payload.conta_id, data_pagamento: payload.data || null }
      : { conta_receber_id: payload.conta_id, data_recebimento: payload.data || null }),
    valor: payload.valor,
    observacao: payload.observacao || null,
  });
  return message;
}

export async function deletarConta(
  user: User,
  kind: ContaKind,
  params: { conta_id?: number; grupo_parcelamento_id?: string }
): Promise<string> {
  const { message } = await postEncrypted(
    '/financeiro',
    kind === 'pagar' ? '/contas_pagar/deletar' : '/contas_receber/deletar',
    {
      empresa_id: user.empresa_id,
      usuario_autenticado_id: user.id,
      ...(kind === 'pagar'
        ? { conta_pagar_id: params.conta_id ?? null }
        : { conta_receber_id: params.conta_id ?? null }),
      grupo_parcelamento_id: params.grupo_parcelamento_id || null,
    }
  );
  return message;
}

export interface ListarLancamentosParams {
  data_inicio?: string;
  data_fim?: string;
  natureza_codigo?: 'entrada' | 'saida' | '';
  limit?: number;
  offset?: number;
}

export async function listarLancamentos(
  user: User,
  params: ListarLancamentosParams = {}
): Promise<Lancamento[]> {
  const { obj } = await postEncrypted<Lancamento[]>('/financeiro', '/lancamentos/listar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    data_inicio: params.data_inicio || null,
    data_fim: params.data_fim || null,
    natureza_codigo: params.natureza_codigo || '',
    limit: params.limit ?? 200,
    offset: params.offset ?? 0,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function deletarLancamento(user: User, lancamentoId: number): Promise<string> {
  const { message } = await postEncrypted('/financeiro', '/lancamentos/deletar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    lancamento_id: lancamentoId,
  });
  return message;
}

export interface MetaUsuario {
  id: number;
  usuario_id: number;
  usuario_nome: string;
  mes_referencia: string;
  valor_meta: number;
  percentual_comissao: number;
  valor_comissao_fixa: number;
  valor_realizado_crm: number;
  possui_comissao_lancada: boolean;
  percentual_atingimento: number;
  valor_faltante_meta: number;
}

export interface ComissaoLancamento {
  id: number;
  usuario_id: number;
  usuario_nome: string;
  competencia: string;
  base_calculo: number;
  percentual_aplicado: number;
  valor_comissao: number;
  status_codigo: string;
  status_nome: string;
  observacao: string | null;
}

export async function listarMetasMes(user: User, mesReferencia?: string): Promise<MetaUsuario[]> {
  const { obj } = await postEncrypted<MetaUsuario[]>('/financeiro', '/comissoes/metas_listar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    mes_referencia: mesReferencia || null,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function listarComissoesMes(
  user: User,
  mesReferencia?: string
): Promise<ComissaoLancamento[]> {
  const { obj } = await postEncrypted<ComissaoLancamento[]>(
    '/financeiro',
    '/comissoes/lancamentos_listar',
    {
      empresa_id: user.empresa_id,
      usuario_autenticado_id: user.id,
      mes_referencia: mesReferencia || null,
    }
  );
  return Array.isArray(obj) ? obj : [];
}

export interface SalvarMetaPayload {
  usuario_id: number;
  mes_referencia: string; // YYYY-MM
  valor_meta: number;
  percentual_comissao: number;
  valor_comissao_fixa: number;
}

export async function salvarMeta(user: User, payload: SalvarMetaPayload): Promise<MetaUsuario> {
  const { obj } = await postEncrypted<MetaUsuario>('/financeiro', '/comissoes/meta_salvar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    usuario_id: payload.usuario_id,
    mes_referencia: `${payload.mes_referencia}-01`,
    valor_meta: payload.valor_meta,
    percentual_comissao: payload.percentual_comissao,
    valor_comissao_fixa: payload.valor_comissao_fixa,
  });
  return obj;
}

export interface FinalizarMetaResultado {
  meta: Partial<MetaUsuario>;
  comissao_lancamento: ComissaoLancamento;
  resumo: {
    base_calculo: number;
    percentual_aplicado: number;
    valor_comissao: number;
  };
}

export async function finalizarMeta(
  user: User,
  params: { usuario_id: number; mes_referencia: string }
): Promise<FinalizarMetaResultado> {
  const { obj } = await postEncrypted<FinalizarMetaResultado>(
    '/financeiro',
    '/comissoes/meta_finalizar',
    {
      empresa_id: user.empresa_id,
      usuario_id: params.usuario_id,
      mes_referencia: params.mes_referencia,
      usuario_executor_id: user.id,
    }
  );
  return obj;
}

export type CicloCobranca = 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' | 'outro';

export interface Assinatura {
  id: number;
  nome: string;
  fornecedor: string;
  plano: string | null;
  valor: number;
  ciclo_cobranca: CicloCobranca;
  dia_vencimento: number | null;
  proximo_vencimento: string | null;
  categoria_id: number | null;
  categoria_nome: string | null;
  observacao: string | null;
  ativo: boolean;
}

export interface AssinaturaPayload {
  nome: string;
  fornecedor: string;
  plano?: string;
  valor: number;
  ciclo_cobranca: CicloCobranca;
  dia_vencimento?: number | null;
  proximo_vencimento?: string | null;
  categoria_id?: number | null;
  observacao?: string;
  ativo: boolean;
}

export async function listarAssinaturas(
  user: User,
  status: '' | 'ativos' | 'inativos' = ''
): Promise<Assinatura[]> {
  const { obj } = await postEncrypted<Assinatura[]>('/financeiro', '/assinaturas/listar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    status,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function criarAssinatura(user: User, payload: AssinaturaPayload): Promise<string> {
  const { message } = await postEncrypted('/financeiro', '/assinaturas/criar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    usuario_id: user.id,
    ...payload,
  });
  return message;
}

export async function editarAssinatura(
  user: User,
  assinaturaId: number,
  payload: AssinaturaPayload
): Promise<string> {
  const { message } = await postEncrypted('/financeiro', '/assinaturas/editar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    assinatura_id: assinaturaId,
    ...payload,
  });
  return message;
}

export async function inativarAssinatura(user: User, assinaturaId: number): Promise<string> {
  const { message } = await postEncrypted('/financeiro', '/assinaturas/inativar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    assinatura_id: assinaturaId,
  });
  return message;
}

// Estrutura financeira (cadastros base — "conciliação manual")

export interface CentroCusto {
  id: number;
  codigo: string | null;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at?: string;
}

export type ContaFinanceiraTipo =
  | 'conta_corrente'
  | 'poupanca'
  | 'carteira_digital'
  | 'caixa'
  | 'outro';

export interface ContaFinanceira {
  id: number;
  nome: string;
  tipo: ContaFinanceiraTipo;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix_chave: string | null;
  saldo_inicial: number;
  saldo_atual: number;
  ativo: boolean;
  empresas_grupo: { id: number; nome: string }[];
  created_at?: string;
}

export type ContraparteTipo = 'cliente' | 'fornecedor' | 'ambos' | 'outros';

export interface Contraparte {
  id: number;
  nome: string;
  documento: string | null;
  cpf: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cep: string | null;
  uf: string | null;
  cidade: string | null;
  tipo: ContraparteTipo;
  ativo: boolean;
  created_at?: string;
}

export interface EmpresaGrupo {
  id: number;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cep: string | null;
  uf: string | null;
  cidade: string | null;
  ativo: boolean;
  created_at?: string;
}

export interface FormaPagamento {
  id: number;
  nome: string;
  taxa_percentual: number;
  taxa_fixa: number;
  ativo: boolean;
  created_at?: string;
}

function registryListar<T>(path: string) {
  return async (user: User, incluirInativos = false): Promise<T[]> => {
    const { obj } = await postEncrypted<T[]>('/financeiro', `/${path}/listar`, {
      empresa_id: user.empresa_id,
      usuario_autenticado_id: user.id,
      incluir_inativos: incluirInativos,
    });
    return Array.isArray(obj) ? obj : [];
  };
}

function registrySalvar<T>(path: string) {
  return async (user: User, payload: Record<string, unknown>): Promise<T> => {
    const { obj } = await postEncrypted<T>('/financeiro', `/${path}/salvar`, {
      empresa_id: user.empresa_id,
      usuario_autenticado_id: user.id,
      ...payload,
    });
    return obj;
  };
}

export const listarCentrosCusto = registryListar<CentroCusto>('centros_custo');
export const salvarCentroCusto = registrySalvar<CentroCusto>('centros_custo');

export const listarContasFinanceiras = registryListar<ContaFinanceira>('contas_financeiras');
export const salvarContaFinanceira = registrySalvar<ContaFinanceira>('contas_financeiras');

export const listarContrapartes = registryListar<Contraparte>('contrapartes');
export const salvarContraparte = registrySalvar<Contraparte>('contrapartes');

export const listarEmpresasGrupo = registryListar<EmpresaGrupo>('empresas_grupo');
export const salvarEmpresaGrupo = registrySalvar<EmpresaGrupo>('empresas_grupo');

export const listarFormasPagamento = registryListar<FormaPagamento>('formas_pagamento');
export const salvarFormaPagamento = registrySalvar<FormaPagamento>('formas_pagamento');

export interface TransferenciaPayload {
  conta_origem_id: number;
  conta_destino_id: number;
  valor: number;
  data_transferencia?: string;
  observacao?: string;
}

export async function criarTransferencia(user: User, payload: TransferenciaPayload): Promise<string> {
  const { message } = await postEncrypted('/financeiro', '/transferencias/criar', {
    empresa_id: user.empresa_id,
    usuario_autenticado_id: user.id,
    usuario_id: user.id,
    conta_origem_id: payload.conta_origem_id,
    conta_destino_id: payload.conta_destino_id,
    valor: payload.valor,
    data_transferencia: payload.data_transferencia || null,
    observacao: payload.observacao || null,
  });
  return message;
}
