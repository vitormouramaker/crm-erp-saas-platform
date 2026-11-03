import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export interface NpsPergunta {
  id: number;
  empresa_id: number;
  pergunta: string;
  ordem: number;
  ativo: boolean;
}

export async function getPerguntasNps(user: User): Promise<NpsPergunta[]> {
  const { obj } = await postEncrypted<NpsPergunta[]>('/nps', '/listar_perguntas', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function criarPerguntaNps(user: User, pergunta: string, ordem: number): Promise<NpsPergunta> {
  const { obj } = await postEncrypted<NpsPergunta>('/nps', '/criar_pergunta', {
    empresa_id: user.empresa_id,
    pergunta,
    ordem,
  });
  return obj;
}

export async function editarPerguntaNps(
  user: User,
  perguntaId: number,
  pergunta: string,
  ordem: number
): Promise<NpsPergunta> {
  const { obj } = await postEncrypted<NpsPergunta>('/nps', '/editar_pergunta', {
    empresa_id: user.empresa_id,
    pergunta_id: perguntaId,
    pergunta,
    ordem,
  });
  return obj;
}

export async function deletarPerguntaNps(user: User, perguntaId: number): Promise<void> {
  await postEncrypted('/nps', '/apagar_pergunta', {
    empresa_id: user.empresa_id,
    pergunta_id: perguntaId,
  });
}

export interface NpsRelatorioFiltros {
  date_start?: string;
  date_end?: string;
  filial_id?: number;
}

export interface NpsRelatorioFilial {
  id: number;
  name: string;
}

export interface NpsRelatorioResumo {
  totalAvaliacoes: number;
  totalRespostas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  mediaNota: number;
  npsGeral: number;
}

export interface NpsRelatorioEvolucaoItem {
  data_referencia: string;
  total_avaliacoes: number;
  media_nota: number;
  nps: number;
}

export interface NpsRelatorioPorAtendenteItem {
  usuario_id: number;
  usuario_nome: string;
  total_avaliacoes: number;
  media_nota: number;
  promotores: number;
  neutros: number;
  detratores: number;
  nps: number;
}

export interface NpsRelatorioDistribuicaoItem {
  nota: number;
  total: number;
}

export interface NpsRelatorioResposta {
  atendimento_id: number;
  cliente_id: number;
  cliente_nome: string;
  cliente_telefone: string;
  usuario_id: number | null;
  atendente_nome: string | null;
  data_resposta: string;
  data_fim: string | null;
  data_inicio: string | null;
  total_respostas: number;
  nota_media: number;
  classificacao: 'promotor' | 'neutro' | 'detrator';
  comentarios: string[];
}

export interface NpsRelatorio {
  filiais: NpsRelatorioFilial[];
  resumo: NpsRelatorioResumo;
  evolucao: NpsRelatorioEvolucaoItem[];
  porAtendente: NpsRelatorioPorAtendenteItem[];
  distribuicaoNotas: NpsRelatorioDistribuicaoItem[];
  respostas: NpsRelatorioResposta[];
}

export async function getRelatorioNps(user: User, filters: NpsRelatorioFiltros = {}): Promise<NpsRelatorio> {
  const { obj } = await postEncrypted<NpsRelatorio>('/nps', '/relatorio', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    ...filters,
  });
  return obj;
}
