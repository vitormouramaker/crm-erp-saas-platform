import { API_BASE } from "../config/api";
import { decrypt, encrypt } from "../utils/cripto";
import type { NpsQuestion } from "../types/nps";

export type NpsPergunta = {
  id: number;
  empresa_id: number;
  pergunta: string;
  ordem: number;
  ativo: boolean;
  data_criacao?: string;
  data_atualizacao?: string;
};

export type NpsReportSummary = {
  totalAvaliacoes: number;
  totalRespostas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  mediaNota: number;
  npsGeral: number;
};

export type NpsReportEvolutionItem = {
  data_referencia: string;
  total_avaliacoes: number;
  media_nota: number;
  nps: number;
};

export type NpsReportAttendantItem = {
  usuario_id: number;
  usuario_nome: string;
  total_avaliacoes: number;
  media_nota: number;
  promotores: number;
  neutros: number;
  detratores: number;
  nps: number;
};

export type NpsReportDistributionItem = {
  nota: number;
  total: number;
};

export type NpsReportAnswerQuestionItem = {
  pergunta_id: number;
  pergunta: string;
  nota: number;
  resposta_texto?: string | null;
  data_resposta?: string | null;
};

export type NpsReportAnswerItem = {
  atendimento_id: number;
  cliente_id: number;
  cliente_nome: string;
  cliente_telefone: string;
  usuario_id: number | null;
  atendente_nome: string | null;
  data_resposta?: string | null;
  data_fim?: string | null;
  data_inicio?: string | null;
  total_respostas: number;
  nota_media: number;
  classificacao: "promotor" | "neutro" | "detrator";
  comentarios: string[];
  perguntas: NpsReportAnswerQuestionItem[];
};

export type NpsReportResponse = {
  filtros: {
    date_start?: string | null;
    date_end?: string | null;
    filial_id?: number | null;
    limit?: number;
  };
  filiais: Array<{
    id: number;
    nome?: string;
    name?: string;
  }>;
  resumo: NpsReportSummary;
  evolucao: NpsReportEvolutionItem[];
  porAtendente: NpsReportAttendantItem[];
  distribuicaoNotas: NpsReportDistributionItem[];
  respostas: NpsReportAnswerItem[];
};

type NpsPerguntaResponse = {
  payload?: string;
  boleano?: boolean;
  mensagem?: string;
  obj?: any;
  success?: boolean;
  message?: string;
  data?: any;
};

type ApiPayload = {
  boleano?: boolean;
  mensagem?: string;
  obj?: any;
};

type NpsSubmitParams = {
  token?: string;
  atendimento_id?: number;
  respostas: Array<{
    pergunta_id: number;
    nota: number;
    resposta_texto?: string | null;
  }>;
};

type NpsQuestionarioParams = {
  token?: string;
  atendimento_id?: number;
};

async function parseApiPayload(raw: NpsPerguntaResponse): Promise<ApiPayload> {
  if (raw?.payload) {
    const decoded = await decrypt(raw.payload);
    if (decoded) {
      return decoded as ApiPayload;
    }
  }

  return {
    boleano: raw?.boleano ?? raw?.success ?? false,
    mensagem: raw?.mensagem ?? raw?.message ?? "",
    obj: raw?.obj ?? raw?.data,
  };
}

function normalizePergunta(data: any): NpsPergunta {
  return {
    id: Number(data?.id || 0),
    empresa_id: Number(data?.empresa_id || 0),
    pergunta: String(data?.pergunta || ""),
    ordem: Number(data?.ordem || 1),
    ativo: Boolean(data?.ativo),
    data_criacao: data?.data_criacao ? String(data.data_criacao) : undefined,
    data_atualizacao: data?.data_atualizacao ? String(data.data_atualizacao) : undefined,
  };
}

function normalizeQuestion(data: any): NpsQuestion {
  return {
    id: Number(data?.id || 0),
    pergunta: String(data?.pergunta || ""),
    ordem: Number(data?.ordem || 1),
    ativo: Boolean(data?.ativo),
  };
}

function normalizeToken(value?: string | null): string | null {
  const token = String(value || "").trim();
  return token.length > 0 ? token : null;
}

export async function listarPerguntasNps(empresaId: number): Promise<NpsPergunta[]> {
  const payload = await encrypt({ empresa_id: empresaId });

  const response = await fetch(`${API_BASE}/nps/listar_perguntas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as NpsPerguntaResponse;
  const body = await parseApiPayload(raw);

  if (!response.ok || !body?.boleano) {
    throw new Error(body?.mensagem || "Nao foi possivel listar as perguntas de NPS.");
  }

  return Array.isArray(body.obj) ? body.obj.map(normalizePergunta) : [];
}

export async function criarPerguntaNps(params: {
  empresaId: number;
  pergunta: string;
  ordem: number;
}): Promise<{ item: NpsPergunta; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    pergunta: params.pergunta,
    ordem: params.ordem,
  });

  const response = await fetch(`${API_BASE}/nps/criar_pergunta`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as NpsPerguntaResponse;
  const body = await parseApiPayload(raw);

  if (!response.ok || !body?.boleano || !body.obj) {
    throw new Error(body?.mensagem || "Nao foi possivel criar a pergunta de NPS.");
  }

  return {
    item: normalizePergunta(body.obj),
    message: String(body.mensagem || "Pergunta criada com sucesso."),
  };
}

export async function editarPerguntaNps(params: {
  empresaId: number;
  perguntaId: number;
  pergunta: string;
  ordem: number;
}): Promise<{ item: NpsPergunta; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    pergunta_id: params.perguntaId,
    pergunta: params.pergunta,
    ordem: params.ordem,
  });

  const response = await fetch(`${API_BASE}/nps/editar_pergunta`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as NpsPerguntaResponse;
  const body = await parseApiPayload(raw);

  if (!response.ok || !body?.boleano || !body.obj) {
    throw new Error(body?.mensagem || "Nao foi possivel editar a pergunta de NPS.");
  }

  return {
    item: normalizePergunta(body.obj),
    message: String(body.mensagem || "Pergunta alterada com sucesso."),
  };
}

export async function apagarPerguntaNps(params: {
  empresaId: number;
  perguntaId: number;
}): Promise<{ item: NpsPergunta; message: string }> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    pergunta_id: params.perguntaId,
  });

  const response = await fetch(`${API_BASE}/nps/apagar_pergunta`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as NpsPerguntaResponse;
  const body = await parseApiPayload(raw);

  if (!response.ok || !body?.boleano || !body.obj) {
    throw new Error(body?.mensagem || "Nao foi possivel apagar a pergunta de NPS.");
  }

  return {
    item: normalizePergunta(body.obj),
    message: String(body.mensagem || "Pergunta apagada com sucesso."),
  };
}

export async function listarPerguntasNpsResposta(
  params: NpsQuestionarioParams,
): Promise<{ atendimento_id: number; perguntas: NpsQuestion[] }> {
  const token = normalizeToken(params.token);
  const atendimentoId = Number(params.atendimento_id);
  const hasAtendimentoId = Number.isInteger(atendimentoId) && atendimentoId > 0;

  if (!token && !hasAtendimentoId) {
    throw new Error("Informe um token de NPS ou atendimento_id valido.");
  }

  const response = token
    ? await fetch(`${API_BASE}/nps/questionario/${encodeURIComponent(token)}`)
    : await fetch(`${API_BASE}/nps/questionario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ atendimento_id: atendimentoId }),
      });

  const raw = (await response.json()) as NpsPerguntaResponse;
  const parsed = await parseApiPayload(raw);

  if (!response.ok || !parsed?.boleano || !parsed.obj) {
    throw new Error(parsed?.mensagem || "Nao foi possivel listar as perguntas de NPS.");
  }

  const atendimentoIdResp = Number(parsed.obj?.atendimento_id || 0);
  const perguntasRaw: unknown[] = Array.isArray(parsed.obj?.perguntas)
    ? (parsed.obj.perguntas as unknown[])
    : [];

  return {
    atendimento_id: atendimentoIdResp,
    perguntas: perguntasRaw
      .map((item) => normalizeQuestion(item))
      .filter((item) => item.id > 0 && item.pergunta.trim().length > 0)
      .sort((a, b) => a.ordem - b.ordem),
  };
}

export async function enviarRespostasNps(params: NpsSubmitParams): Promise<{ message: string }> {
  const token = normalizeToken(params.token);
  const atendimentoId = Number(params.atendimento_id);
  const hasAtendimentoId = Number.isInteger(atendimentoId) && atendimentoId > 0;

  if (!token && !hasAtendimentoId) {
    throw new Error("Informe um token de NPS ou atendimento_id valido.");
  }

  const response = token
    ? await fetch(`${API_BASE}/nps/responder/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ respostas: params.respostas }),
      })
    : await fetch(`${API_BASE}/nps/responder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          atendimento_id: atendimentoId,
          respostas: params.respostas,
        }),
      });

  const raw = (await response.json()) as NpsPerguntaResponse;
  const parsed = await parseApiPayload(raw);

  if (!response.ok || !parsed?.boleano) {
    throw new Error(parsed?.mensagem || "Nao foi possivel enviar as respostas.");
  }

  return {
    message: String(parsed.mensagem || "Respostas enviadas com sucesso."),
  };
}

export const npsService = {
  listQuestions: listarPerguntasNpsResposta,
  submit: enviarRespostasNps,
};

export async function obterRelatorioNps(params: {
  empresaId: number;
  usuarioId: number;
  dateStart?: string;
  dateEnd?: string;
  filialId?: number | null;
  limit?: number;
}): Promise<NpsReportResponse> {
  const payload = await encrypt({
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
    date_start: params.dateStart,
    date_end: params.dateEnd,
    filial_id: params.filialId ?? undefined,
    limit: params.limit ?? 100,
  });

  const response = await fetch(`${API_BASE}/nps/relatorio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });

  const raw = (await response.json()) as NpsPerguntaResponse;
  const body = await parseApiPayload(raw);

  if (!response.ok || !body?.boleano || !body.obj) {
    throw new Error(body?.mensagem || "Nao foi possivel carregar o relatorio de NPS.");
  }

  return body.obj as NpsReportResponse;
}


