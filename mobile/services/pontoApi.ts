import { API_BASE, authFetch, postEncrypted } from './apiClient';
import { decrypt, encrypt } from './security';
import type { User } from '@/types';

export interface RegistroPonto {
  id: number;
  usuario_id: number;
  data_hora: string;
  tipo: string;
  origem_registro: string | null;
  created_at: string;
}

export interface ApuracaoDia {
  id: number;
  usuario_id: number;
  data_referencia: string;
  minutos_previstos: number;
  minutos_trabalhados: number;
  minutos_abonados: number;
  minutos_extras: number;
  minutos_falta: number;
  saldo_minutos: number;
  status: string;
}

export interface DiaRelatorio extends ApuracaoDia {
  registros: RegistroPonto[];
  day_off: { id: number; tipo: string | null; observacao: string | null; status: string } | null;
}

export interface RelatorioPonto {
  periodo: { data_inicio: string; data_fim: string };
  dias: DiaRelatorio[];
}

export interface ApuracaoContexto {
  registros: RegistroPonto[];
  justificativas: unknown[];
  horario: { faixas: { entrada: string | null; saida: string | null }[] } | null;
}

export interface ApuracaoResultado {
  apuracao: ApuracaoDia;
  contexto: ApuracaoContexto;
}

export interface JustificativaTipo {
  id: number;
  descricao: string;
  has_text: boolean;
  has_anexo: boolean;
}

export interface BatidaMetadata {
  latitude?: number;
  longitude?: number;
  precisao_metros?: number;
  localizacao_capturada_em?: string;
  geolocalizacao_status?: string;
  geolocalizacao_autorizada?: boolean;
}

export const STATUS_LABELS: Record<string, string> = {
  apurado: 'Dia apurado.',
  incompleto: 'Dia com um ou mais registros pendentes.',
  sem_horario: 'Sem horário de trabalho configurado.',
  day_off: 'Day off aprovado.',
  ferias: 'Férias aprovadas.',
  feriado: 'Feriado.',
  justificado: 'Dia justificado.',
};

export function getStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Sem apuração para esta data.';
  return STATUS_LABELS[status] || status;
}

export const TIPO_BATIDA_LABELS: Record<string, string> = {
  entrada_1: 'Entrada',
  saida_1: 'Saída (intervalo)',
  entrada_2: 'Retorno',
  saida_2: 'Saída',
};

export function getTipoBatidaLabel(tipo: string): string {
  return TIPO_BATIDA_LABELS[tipo] || tipo.replace(/_/g, ' ');
}

export async function getRelatorioPonto(
  user: User,
  dataInicio: string,
  dataFim: string
): Promise<RelatorioPonto> {
  const { obj } = await postEncrypted<RelatorioPonto>('/ponto', '/relatorio_ponto', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    data_inicio: dataInicio,
    data_fim: dataFim,
  });
  return obj;
}

export async function registrarBatida(user: User, metadata: BatidaMetadata): Promise<ApuracaoResultado> {
  const { obj } = await postEncrypted<ApuracaoResultado>('/ponto', '/registrar_batida', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    origem_registro: 'mobile_colaborador',
    dispositivo_mobile: true,
    timezone_cliente: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...metadata,
  });
  return obj;
}

export async function recalcularDia(user: User, dataReferencia: string): Promise<ApuracaoResultado> {
  const { obj } = await postEncrypted<ApuracaoResultado>('/ponto', '/recalcular_dia', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    data_referencia: dataReferencia,
  });
  return obj;
}

export async function getJustificativaTipos(user: User): Promise<JustificativaTipo[]> {
  const { obj } = await postEncrypted<JustificativaTipo[]>('/ponto', '/justificativa_tipo', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export interface JustificativaAnexo {
  uri: string;
  name: string;
  mimeType?: string;
}

export async function adicionarJustificativa(
  user: User,
  tipoJustificativaId: number,
  dataInicio: string,
  dataFim: string,
  descricao: string,
  anexo?: JustificativaAnexo | null
): Promise<void> {
  const payload = {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    tipo_justificativa_id: tipoJustificativaId,
    data_inicio: dataInicio,
    data_fim: dataFim,
    descricao,
  };

  if (!anexo) {
    await postEncrypted('/ponto', '/adicionar_justificativa', payload);
    return;
  }

  const form = new FormData();
  form.append('payload', encrypt(payload));
  form.append('file', {
    uri: anexo.uri,
    name: anexo.name,
    type: anexo.mimeType || 'application/octet-stream',
  } as any);

  const response = await authFetch(`${API_BASE}/ponto/adicionar_justificativa`, {
    method: 'POST',
    body: form,
  });

  const responseData = await response.json();
  const decrypted = decrypt(responseData.payload);

  if (!decrypted?.boleano) {
    throw new Error(decrypted?.mensagem || decrypted?.msg || 'Não foi possível enviar a justificativa.');
  }
}
