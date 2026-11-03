import { API_BASE } from "../config/api";
import { decrypt, encrypt } from "../utils/cripto";
import type { PontoRegistroMetadata } from "../utils/pontoRegistroMetadata";

type ApiEnvelope<T> = {
  boleano: boolean;
  obj?: T;
  mensagem?: string;
  msg?: string;
};

type PontoPayload = {
  empresa_id?: number;
  usuario_id?: number;
  usuario_horario_id?: number | string;
  tipo_justificativa_id?: string | number;
  data_referencia?: string;
  data_inicio?: string;
  data_fim?: string;
  tipo?: string;
  data_hora?: string;
  latitude?: number | string;
  longitude?: number | string;
  precisao_metros?: number | string;
  localizacao_capturada_em?: string;
  geolocalizacao_status?: string;
  geolocalizacao_autorizada?: boolean;
  timezone_cliente?: string;
  idioma_cliente?: string;
  plataforma_cliente?: string;
  user_agent?: string;
  dispositivo_mobile?: boolean;
  origem_registro?: string;
  registrado_por_usuario_id?: number | string;
  status?: string;
  descricao?: string;
  observacao?: string;
  ativo?: boolean;
  nome?: string;
  dia_semana?: number | string;
  carga_horaria_diaria_minutos?: number | string;
  carga_prevista_minutos?: number | string;
  faixas?: Array<{
    entrada?: string | null;
    saida?: string | null;
  }>;
  dias?: Array<{
    dia_semana?: number | string;
    carga_horaria_diaria_minutos?: number | string;
    carga_prevista_minutos?: number | string;
    faixas?: Array<{
      entrada?: string | null;
      saida?: string | null;
    }>;
  }>;
  periodo_ferias_id?: number | string | null;
  aprovado_por?: number | string | null;
  ferias_id?: number | string;
  day_off_id?: number | string;
  feriado_id?: number | string;
  registro_ponto_id?: number | string;
  justificativa_id?: string;
  motivo_recusa?: string;
};

export type PontoRegistro = {
  id: number;
  usuario_id: number;
  data_hora: string;
  tipo: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  precisao_metros?: number | string | null;
  localizacao_capturada_em?: string | null;
  geolocalizacao_status?: string | null;
  geolocalizacao_autorizada?: boolean | null;
  timezone_cliente?: string | null;
  idioma_cliente?: string | null;
  plataforma_cliente?: string | null;
  user_agent?: string | null;
  dispositivo_mobile?: boolean | null;
  origem_registro?: string | null;
  registrado_por_usuario_id?: number | string | null;
  ip_publico?: string | null;
  faixa_ip?: string | null;
  created_at?: string;
};

export type PontoRegistroPayload = {
  registro: PontoRegistro;
};

export type PontoApuracao = {
  id?: number | string;
  usuario_id?: number | string;
  data_referencia?: string;
  minutos_previstos?: number;
  minutos_trabalhados?: number;
  minutos_abonados?: number;
  minutos_extras?: number;
  minutos_falta?: number;
  saldo_minutos?: number;
  status?: string;
};

export type PontoContexto = {
  day_off?: unknown;
  feriado?: unknown;
  horario?: unknown;
  justificativas?: unknown[];
  registros?: PontoRegistro[];
};

export type RegistrarBatidaResponse = {
  registro?: PontoRegistro;
  apuracao?: PontoApuracao;
  banco_horas_lancamento?: unknown;
  contexto?: PontoContexto;
};

export type AlterarBatidaResponse = {
  registro?: PontoRegistro;
  datas_recalculadas?: string[];
  apuracoes?: Array<{
    apuracao?: PontoApuracao;
    banco_horas_lancamento?: unknown;
    contexto?: PontoContexto;
  }>;
};

export type PontoDia = {
  id?: number | string;
  data_referencia?: string;
  registros?: PontoRegistro[];
  minutos_previstos?: number;
  minutos_trabalhados?: number;
  minutos_abonados?: number;
  minutos_extras?: number;
  minutos_falta?: number;
  saldo_minutos?: number;
  status?: string;
  day_off?: unknown;
};

export type PontoRelatorio = {
  periodo?: {
    data_inicio?: string;
    data_fim?: string;
  };
  dias?: PontoDia[];
};

export type PontoDayInfo = {
  permite_batida: boolean;
  data_referencia?: string;
  day_off?: {
    id?: number | string;
    usuario_id?: number | string;
    data_referencia?: string;
    tipo?: string;
    observacao?: string | null;
    status?: string;
    created_at?: string;
  } | null;
  feriado?: {
    id?: number | string;
    empresa_id?: number | string;
    data_referencia?: string;
    descricao?: string;
    tipo?: string;
    ativo?: boolean;
  } | null;
  horario?: {
    horario_trabalho_id?: number | string;
    nome?: string;
    dia_semana?: number;
    carga_prevista_minutos?: number;
    faixas?: Array<{
      entrada?: string | null;
      saida?: string | null;
    }>;
  } | null;
};

export type EmpresaUsuarioResumo = {
  id: number;
  name?: string;
  nome?: string;
  email?: string;
  ativo?: boolean;
  filial_id?: number | string | null;
  filial_nome?: string | null;
};

export type EmpresaFilialResumo = {
  id: number;
  name?: string;
  address?: string;
  manager?: string;
  contact?: string;
  cnpj?: string;
  isPrimary?: boolean;
  latitude?: number | string | null;
  longitude?: number | string | null;
  toleranceMeters?: number | string | null;
};

export type DayOffItem = {
  id: number | string;
  empresa_id?: number | string;
  usuario_id?: number | string;
  data_referencia?: string;
  tipo?: string;
  observacao?: string | null;
  status?: string;
  created_at?: string;
};

export type FeriasItem = {
  id: number | string;
  empresa_id?: number | string;
  usuario_id?: number | string;
  usuario_nome?: string;
  data_inicio?: string;
  data_fim?: string;
  quantidade_dias?: number;
  observacao?: string | null;
  status?: string;
  periodo_ferias_id?: number | string | null;
  periodo_aquisitivo_inicio?: string;
  periodo_aquisitivo_fim?: string;
  saldo_dias?: number;
  periodo_status?: string;
  aprovado_por?: number | string | null;
  aprovado_em?: string | null;
  created_at?: string;
};

export type PeriodoFeriasItem = {
  id: number | string;
  usuario_id?: number | string;
  usuario_nome?: string;
  empresa_id?: number | string;
  periodo_aquisitivo_inicio?: string;
  periodo_aquisitivo_fim?: string;
  saldo_dias?: number;
  status?: string;
};

export type FeriadoItem = {
  id: number | string;
  empresa_id?: number | string;
  data_referencia?: string;
  descricao?: string;
  tipo?: string;
  ativo?: boolean;
  created_at?: string;
};

export type AdicionarJustificativaPayload = {
  justificativa?: {
    id?: number | string;
    usuario_id?: number | string;
    tipo?: string;
    data_inicio?: string;
    data_fim?: string;
    descricao?: string | null;
    status?: string;
  };
  anexo?: {
    id?: number | string;
    justificativa_id?: number | string;
    nome_arquivo?: string;
    url?: string;
    mime_type?: string | null;
  } | null;
};

export type JustificativaTipo = {
  id: number | string;
  descricao: string;
  has_text: boolean;
  has_anexo?: boolean;
};

export type JustificativaAnexo = {
  id?: number | string;
  nome_arquivo?: string;
  url?: string;
  mime_type?: string | null;
  created_at?: string;
};

export type JustificativaItem = {
  id: number | string;
  usuario_id?: number | string;
  usuario_nome?: string;
  empresa_id?: number | string;
  tipo_justificativa_id?: number | string;
  tipo?: string;
  tipo_descricao?: string;
  has_text?: boolean;
  data_inicio?: string;
  data_fim?: string;
  descricao?: string | null;
  status?: "pendente" | "aprovado" | "reprovado" | string;
  aprovado_por?: number | string | null;
  aprovado_por_nome?: string | null;
  aprovado_em?: string | null;
  motivo_recusa?: string | null;
  created_at?: string;
  anexos?: JustificativaAnexo[];
};

export type AprovarReprovarJustificativaResponse = {
  justificativa?: JustificativaItem;
  datas_recalculadas?: string[];
  apuracoes?: unknown[];
};

export type HorarioFaixa = {
  entrada?: string | null;
  saida?: string | null;
};

export type HorarioTrabalhoItem = {
  id?: number | string;
  usuario_horario_id?: number | string;
  horario_trabalho_id?: number | string;
  empresa_id?: number | string;
  usuario_id?: number | string;
  nome?: string;
  dia_semana?: number | string;
  carga_horaria_diaria_minutos?: number | string;
  carga_prevista_minutos?: number | string;
  ativo?: boolean;
  faixas?: HorarioFaixa[];
  dias?: Array<{
    dia_semana?: number | string;
    carga_horaria_diaria_minutos?: number | string;
    carga_prevista_minutos?: number | string;
    faixas?: HorarioFaixa[];
  }>;
  created_at?: string;
  updated_at?: string;
};

export type HorarioTrabalhoInput = {
  nome?: string;
  dia_semana?: number | string;
  carga_prevista_minutos?: number | string;
  ativo?: boolean;
  faixas?: HorarioFaixa[];
  [key: string]: unknown;
};

async function postPontoEndpoint<T>(endpoint: string, payload: PontoPayload): Promise<T> {
  const encrypted = await encrypt(payload);

  const response = await fetch(`${API_BASE}/ponto${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: encrypted }),
  });

  if (!response.ok) {
    throw new Error("Erro de conexao com o servico de ponto.");
  }

  const responseData = await response.json();
  const payloadData = await decrypt(responseData.payload);
  console.log("[pontoService] response:decrypted", {
    endpoint,
    payloadData,
  });

  if (!payloadData || typeof payloadData !== "object") {
    throw new Error("Resposta invalida do servico de ponto.");
  }

  const { boleano, obj, mensagem, msg } = payloadData as ApiEnvelope<T>;

  if (!boleano) {
    throw new Error(mensagem || msg || "Nao foi possivel concluir a operacao.");
  }

  return obj as T;
}

function resolveDataReferenciaFromDataHora(dataHora?: string): string {
  const dateMatch = dataHora?.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return dateMatch[1];

  if (dataHora) {
    const parsed = new Date(dataHora);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const RhPontoService = {
  async listarUsuariosEmpresa(empresaId: number): Promise<EmpresaUsuarioResumo[]> {
    const encrypted = await encrypt({ empresa_id: empresaId });
    const response = await fetch(`${API_BASE}/user/lista_usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });

    if (!response.ok) {
      throw new Error("Erro de conexao ao carregar os usuarios.");
    }

    const responseData = await response.json();
    const payloadData = await decrypt(responseData.payload);

    if (!payloadData || typeof payloadData !== "object") {
      throw new Error("Resposta invalida ao carregar os usuarios.");
    }

    const { boleano, obj, mensagem, msg } =
      payloadData as ApiEnvelope<EmpresaUsuarioResumo[]>;

    if (!boleano) {
      throw new Error(mensagem || msg || "Nao foi possivel carregar os usuarios.");
    }

    return obj || [];
  },

  async listarFiliaisEmpresa(empresaId: number): Promise<EmpresaFilialResumo[]> {
    const encrypted = await encrypt({ empresa_id: empresaId });
    const response = await fetch(`${API_BASE}/user/lista_filial`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });

    if (!response.ok) {
      throw new Error("Erro de conexao ao carregar as filiais.");
    }

    const responseData = await response.json();
    const payloadData = await decrypt(responseData.payload);

    if (!payloadData || typeof payloadData !== "object") {
      throw new Error("Resposta invalida ao carregar as filiais.");
    }

    const { boleano, obj, mensagem, msg } =
      payloadData as ApiEnvelope<EmpresaFilialResumo[]>;

    if (!boleano) {
      throw new Error(mensagem || msg || "Nao foi possivel carregar as filiais.");
    }

    return obj || [];
  },

  async cadastrarHorarioTrabalho(params: {
    empresaId: number;
    usuarioId: number;
    dados: HorarioTrabalhoInput;
  }): Promise<HorarioTrabalhoItem> {
    return postPontoEndpoint("/cadastrar_horario_trabalho", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      ...params.dados,
    });
  },

  async listarHorariosTrabalho(params: {
    empresaId: number;
    usuarioId: number;
  }): Promise<HorarioTrabalhoItem[]> {
    return postPontoEndpoint("/listar_horarios_trabalho", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
    });
  },

  async editarHorarioTrabalho(params: {
    empresaId: number;
    usuarioId: number;
    usuarioHorarioId: number | string;
    dados: HorarioTrabalhoInput;
  }): Promise<HorarioTrabalhoItem> {
    return postPontoEndpoint("/editar_horario_trabalho", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      usuario_horario_id: params.usuarioHorarioId,
      ...params.dados,
    });
  },

  async deletarHorarioTrabalho(params: {
    empresaId: number;
    usuarioId: number;
    usuarioHorarioId: number | string;
  }): Promise<{ removed?: boolean } & Record<string, unknown>> {
    return postPontoEndpoint("/deletar_horario_trabalho", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      usuario_horario_id: params.usuarioHorarioId,
    });
  },

  async registrarBatida(
    empresaId: number,
    usuarioId: number,
    tipo?: string,
    dataHora?: string,
    metadata?: PontoRegistroMetadata
  ): Promise<RegistrarBatidaResponse> {
    const dataReferencia = resolveDataReferenciaFromDataHora(dataHora);
    const dayInfo = await postPontoEndpoint<PontoDayInfo>("/validar_day_off", {
      empresa_id: empresaId,
      usuario_id: usuarioId,
      data_referencia: dataReferencia,
    });

    if (!dayInfo.permite_batida) {
      if (dayInfo.day_off) {
        throw new Error("Batida bloqueada: existe day-off para esta data.");
      }
      if (dayInfo.feriado) {
        throw new Error("Batida bloqueada: a data selecionada e feriado.");
      }
      if (dayInfo.horario === null) {
        throw new Error("Batida bloqueada: usuario sem horario vinculado para esta data.");
      }
      throw new Error("Batida bloqueada para a data selecionada.");
    }

    return postPontoEndpoint("/registrar_batida", {
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tipo,
      data_hora: dataHora,
      ...metadata,
    });
  },

  async editarBatida(params: {
    empresaId: number;
    usuarioId: number;
    registroPontoId: number | string;
    tipo?: string;
    dataHora?: string;
  }): Promise<AlterarBatidaResponse> {
    return postPontoEndpoint("/editar_batida", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      registro_ponto_id: params.registroPontoId,
      tipo: params.tipo,
      data_hora: params.dataHora,
    });
  },

  async deletarBatida(params: {
    empresaId: number;
    usuarioId: number;
    registroPontoId: number | string;
  }): Promise<AlterarBatidaResponse> {
    return postPontoEndpoint("/deletar_batida", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      registro_ponto_id: params.registroPontoId,
    });
  },

  async validarDayOff(
    empresaId: number,
    usuarioId: number,
    dataReferencia: string
  ): Promise<PontoDayInfo> {
    return postPontoEndpoint("/validar_day_off", {
      empresa_id: empresaId,
      usuario_id: usuarioId,
      data_referencia: dataReferencia,
    });
  },

  async relatorioPonto(
    empresaId: number,
    usuarioId: number,
    dataInicio: string,
    dataFim: string
  ): Promise<PontoRelatorio> {
    return postPontoEndpoint("/relatorio_ponto", {
      empresa_id: empresaId,
      usuario_id: usuarioId,
      data_inicio: dataInicio,
      data_fim: dataFim,
    });
  },

  async recalcularDia(
    empresaId: number,
    usuarioId: number,
    dataReferencia: string
  ): Promise<{
    apuracao?: PontoApuracao;
    banco_horas_lancamento?: unknown;
    contexto?: PontoContexto & {
      ferias?: unknown;
      horario?: PontoDayInfo["horario"];
    };
  }> {
    return postPontoEndpoint("/recalcular_dia", {
      empresa_id: empresaId,
      usuario_id: usuarioId,
      data_referencia: dataReferencia,
    });
  },

  async adicionarJustificativa(params: {
    empresaId: number;
    usuarioId: number;
    tipoJustificativaId: string;
    dataInicio: string;
    dataFim?: string;
    descricao?: string;
    file?: File | null;
  }): Promise<AdicionarJustificativaPayload> {
    const payload = {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      tipo_justificativa_id: params.tipoJustificativaId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim || params.dataInicio,
      descricao: params.descricao || "",
    };

    console.log("[pontoService] request:start", {
      endpoint: "/adicionar_justificativa",
      payload,
      hasFile: !!params.file,
    });

    const encrypted = await encrypt(payload);
    const formData = new FormData();
    formData.append("payload", encrypted);

    if (params.file) {
      formData.append("file", params.file);
    }

    const response = await fetch(`${API_BASE}/ponto/adicionar_justificativa`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Erro de conexao com o servico de justificativa.");
    }

    const responseData = await response.json();
    const payloadData = await decrypt(responseData.payload);

    console.log("[pontoService] response:decrypted", {
      endpoint: "/adicionar_justificativa",
      payloadData,
    });

    if (!payloadData || typeof payloadData !== "object") {
      throw new Error("Resposta invalida do servico de justificativa.");
    }

    const { boleano, obj, mensagem, msg } =
      payloadData as ApiEnvelope<AdicionarJustificativaPayload>;

    if (!boleano) {
      throw new Error(
        mensagem || msg || "Nao foi possivel enviar a justificativa.",
      );
    }

    return obj as AdicionarJustificativaPayload;
  },

  async listarJustificativaTipos(): Promise<JustificativaTipo[]> {
    return postPontoEndpoint("/justificativa_tipo", {});
  },

  async listarJustificativas(params: {
    empresaId: number;
    usuarioId?: number;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<JustificativaItem[]> {
    return postPontoEndpoint("/listar_justificativas", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim,
      status: params.status,
    });
  },

  async aprovarReprovarJustificativa(params: {
    empresaId: number;
    usuarioId: number;
    justificativaId: string;
    status: "aprovado" | "reprovado";
    motivoRecusa?: string;
  }): Promise<AprovarReprovarJustificativaResponse> {
    return postPontoEndpoint("/aprovar_reprovar_justificativa", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      justificativa_id: params.justificativaId,
      status: params.status,
      motivo_recusa: params.motivoRecusa,
    });
  },

  async criarFerias(params: {
    empresaId: number;
    usuarioId: number;
    dataInicio: string;
    dataFim?: string;
    observacao?: string;
    status?: string;
    periodoFeriasId?: number | string | null;
    aprovadoPor?: number | string | null;
  }): Promise<FeriasItem> {
    return postPontoEndpoint("/criar_ferias", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim,
      observacao: params.observacao,
      status: params.status,
      periodo_ferias_id: params.periodoFeriasId ?? null,
      aprovado_por: params.aprovadoPor ?? null,
    });
  },

  async criarPeriodoFerias(params: {
    empresaId: number;
    usuarioId: number;
    periodoAquisitivoInicio: string;
    periodoAquisitivoFim: string;
    saldoDias?: number | string;
  }): Promise<PeriodoFeriasItem> {
    return postPontoEndpoint("/criar_periodo_ferias", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      periodo_aquisitivo_inicio: params.periodoAquisitivoInicio,
      periodo_aquisitivo_fim: params.periodoAquisitivoFim,
      saldo_dias: params.saldoDias,
    } as PontoPayload & {
      periodo_aquisitivo_inicio: string;
      periodo_aquisitivo_fim: string;
      saldo_dias?: number | string;
    });
  },

  async listarPeriodosFerias(params: {
    empresaId: number;
    usuarioId?: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<PeriodoFeriasItem[]> {
    return postPontoEndpoint("/listar_periodos_ferias", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim,
    });
  },

  async editarPeriodoFerias(params: {
    empresaId: number;
    periodoFeriasId: number | string;
    periodoAquisitivoInicio?: string;
    periodoAquisitivoFim?: string;
    saldoDias?: number | string;
  }): Promise<PeriodoFeriasItem> {
    return postPontoEndpoint("/editar_periodo_ferias", {
      empresa_id: params.empresaId,
      periodo_ferias_id: params.periodoFeriasId,
      periodo_aquisitivo_inicio: params.periodoAquisitivoInicio,
      periodo_aquisitivo_fim: params.periodoAquisitivoFim,
      saldo_dias: params.saldoDias,
    } as PontoPayload & {
      periodo_aquisitivo_inicio?: string;
      periodo_aquisitivo_fim?: string;
      saldo_dias?: number | string;
    });
  },

  async removerPeriodoFerias(params: {
    empresaId: number;
    periodoFeriasId: number | string;
  }): Promise<PeriodoFeriasItem> {
    return postPontoEndpoint("/remover_periodo_ferias", {
      empresa_id: params.empresaId,
      periodo_ferias_id: params.periodoFeriasId,
    } as PontoPayload);
  },

  async listarFeriasUsuario(params: {
    empresaId: number;
    usuarioId: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<FeriasItem[]> {
    return postPontoEndpoint("/listar_ferias_usuario", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim,
    });
  },

  async editarFerias(params: {
    empresaId: number;
    feriasId: number | string;
    dataInicio?: string;
    dataFim?: string;
    observacao?: string;
    status?: string;
    periodoFeriasId?: number | string | null;
    aprovadoPor?: number | string | null;
  }): Promise<FeriasItem> {
    return postPontoEndpoint("/editar_ferias", {
      empresa_id: params.empresaId,
      ferias_id: params.feriasId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim,
      observacao: params.observacao,
      status: params.status,
      periodo_ferias_id: params.periodoFeriasId ?? null,
      aprovado_por: params.aprovadoPor ?? null,
    });
  },

  async removerFerias(params: {
    empresaId: number;
    feriasId: number | string;
  }): Promise<{ removed?: boolean } & Record<string, unknown>> {
    return postPontoEndpoint("/remover_ferias", {
      empresa_id: params.empresaId,
      ferias_id: params.feriasId,
    });
  },

  async criarDayOff(params: {
    empresaId: number;
    usuarioId: number;
    dataReferencia: string;
    tipo?: string;
    observacao?: string;
    status?: string;
  }): Promise<DayOffItem> {
    return postPontoEndpoint("/criar_day_off", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      data_referencia: params.dataReferencia,
      tipo: params.tipo,
      observacao: params.observacao,
      status: params.status,
    });
  },

  async listarDayOffUsuario(params: {
    empresaId: number;
    usuarioId: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<DayOffItem[]> {
    return postPontoEndpoint("/listar_day_off_usuario", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim,
    });
  },

  async editarDayOff(params: {
    empresaId: number;
    dayOffId: number | string;
    dataReferencia?: string;
    tipo?: string;
    observacao?: string;
    status?: string;
  }): Promise<DayOffItem> {
    return postPontoEndpoint("/editar_day_off", {
      empresa_id: params.empresaId,
      day_off_id: params.dayOffId,
      data_referencia: params.dataReferencia,
      tipo: params.tipo,
      observacao: params.observacao,
      status: params.status,
    });
  },

  async removerDayOff(params: {
    empresaId: number;
    dayOffId: number | string;
  }): Promise<{ removed?: boolean } & Record<string, unknown>> {
    return postPontoEndpoint("/remover_day_off", {
      empresa_id: params.empresaId,
      day_off_id: params.dayOffId,
    });
  },

  async criarFeriado(params: {
    empresaId: number;
    dataReferencia: string;
    descricao: string;
    tipo?: string;
    ativo?: boolean;
  }): Promise<FeriadoItem> {
    return postPontoEndpoint("/criar_feriado", {
      empresa_id: params.empresaId,
      data_referencia: params.dataReferencia,
      descricao: params.descricao,
      tipo: params.tipo,
      ativo: params.ativo ?? true,
    });
  },

  async listarFeriados(params: {
    empresaId: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<FeriadoItem[]> {
    return postPontoEndpoint("/listar_feriados", {
      empresa_id: params.empresaId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim,
    });
  },

  async editarFeriado(params: {
    empresaId: number;
    feriadoId: number | string;
    dataReferencia?: string;
    descricao?: string;
    tipo?: string;
    ativo?: boolean;
  }): Promise<FeriadoItem> {
    return postPontoEndpoint("/editar_feriado", {
      empresa_id: params.empresaId,
      feriado_id: params.feriadoId,
      data_referencia: params.dataReferencia,
      descricao: params.descricao,
      tipo: params.tipo,
      ativo: params.ativo,
    });
  },

  async removerFeriado(params: {
    empresaId: number;
    feriadoId: number | string;
  }): Promise<{ removed?: boolean } & Record<string, unknown>> {
    return postPontoEndpoint("/remover_feriado", {
      empresa_id: params.empresaId,
      feriado_id: params.feriadoId,
    });
  },

  async balancoPonto(params: {
    empresaId: number;
    usuarioId: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<Record<string, unknown>> {
    return postPontoEndpoint("/balanco_ponto", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim,
    });
  },

  async bancoHoras(params: {
    empresaId: number;
    usuarioId: number;
    dataInicio?: string;
    dataFim?: string;
  }): Promise<unknown> {
    return postPontoEndpoint("/banco_horas", {
      empresa_id: params.empresaId,
      usuario_id: params.usuarioId,
      data_inicio: params.dataInicio,
      data_fim: params.dataFim,
    });
  },
};
