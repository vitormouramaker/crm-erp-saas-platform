import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export interface DashboardVisibilidade {
  financeiro: boolean;
  estoque: boolean;
  atendimento: boolean;
  fornecedores: boolean;
  crm: boolean;
}

export interface DashboardFinanceiro {
  totalVendas: number;
  totalPedidos: number;
  ticketMedio: number;
}

export interface DashboardEstoque {
  valorTotal: number;
}

export interface DashboardTopTag {
  name: string;
  count: number;
}

export interface DashboardClienteNovo {
  cliente_id: number;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string | null;
  data_cadastro: string;
}

export interface DashboardNpsPorAtendente {
  usuario_id: number;
  usuario_nome: string;
  total_avaliacoes: number;
  media_nota: number;
  promotores: number;
  neutros: number;
  detratores: number;
  nps: number;
}

export interface DashboardNpsNotaUltimos5PorPergunta {
  atendimento_id: number;
  data_fim: string | null;
  atendente_id: number | null;
  atendente_nome: string | null;
  pergunta_id: number;
  pergunta: string;
  nota: number;
  resposta_texto: string | null;
  data_resposta: string;
}

export interface DashboardAtendimentoPorUsuario {
  usuario_id: number;
  usuario_nome: string;
  total_atendimentos: number;
  ativos: number;
  finalizados: number;
  tempo_medio_minutos: number;
}

export interface DashboardAtendimento {
  filaEspera: number;
  ativos: number;
  finalizados: number;
  tempoMedioAtendimentoMinutos: number;
  topTags: DashboardTopTag[];
  ultimosClientesNovos: DashboardClienteNovo[];
  atendimentoPorUsuario: DashboardAtendimentoPorUsuario[];
  nps: {
    geral: {
      npsGeral: number;
      mediaNota: number;
    };
    porAtendente: DashboardNpsPorAtendente[];
    notasUltimos5PorPergunta: DashboardNpsNotaUltimos5PorPergunta[];
  };
}

export interface DashboardFunilEtapa {
  codigo: string;
  nome: string;
  ordem: number | null;
  total: number;
  valorTotal: number;
}

export interface DashboardTopResponsavel {
  usuario_nome: string;
  pipeline_ativos: number;
  ganhos_30_dias: number;
  valor_ganho_30_dias: number;
}

export interface DashboardCrm {
  pipelineAtivos: number;
  valorPipelineAberto: number;
  ganhos30Dias: number;
  valorPerdido30Dias: number;
  valorGanho30Dias: number;
  taxaConversao30Dias: number;
  funilPorEtapa: DashboardFunilEtapa[];
  topResponsaveis: DashboardTopResponsavel[];
}

export interface DashboardStats {
  visibilidade: DashboardVisibilidade;
  financeiro: DashboardFinanceiro | null;
  estoque: DashboardEstoque | null;
  atendimento: DashboardAtendimento | null;
  crm: DashboardCrm | null;
  geral: { totalFornecedores: number | null };
  has_pdv: boolean;
}

export interface DashboardFilters {
  date_start?: string;
  date_end?: string;
}

export async function getDashboardStats(
  user: User,
  filters: DashboardFilters = {}
): Promise<DashboardStats> {
  const { obj } = await postEncrypted<DashboardStats>('/user', '/dashboard_stats', {
    usuario_id: user.id,
    empresa_id: user.empresa_id,
    ...filters,
  });
  return obj;
}
