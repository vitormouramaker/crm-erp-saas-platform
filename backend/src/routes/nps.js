const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const execute = require("../services/execute_nps");
const executeUser = require("../services/execute_user");
const utils = require("../utils/templates");
const NPS_REPORT_PERMISSION = "reports.nps.view";

function isValidNota(value) {
  const nota = Number(value);
  return Number.isInteger(nota) && nota >= 1 && nota <= 10;
}

function getAtendimentoIdFromToken(tokenRaw) {
  const token = String(tokenRaw || "").trim();
  if (!token) return null;

  let tokenDecoded = token;
  try {
    tokenDecoded = decodeURIComponent(token);
  } catch (error) {
    tokenDecoded = token;
  }

  const payload = security.decryptNpsPublicToken(tokenDecoded);
  if (!payload) return null;

  const atendimentoId = Number(payload.atendimento_id);
  if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) return null;

  return atendimentoId;
}

function normalizeDashboardDate(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function resolvePermissoesFinais(contexto = null) {
  const planoPerms = Array.isArray(contexto?.permissoes_plano)
    ? contexto.permissoes_plano
    : [];
  const userPerms = Array.isArray(contexto?.permissoes_customizadas)
    ? contexto.permissoes_customizadas
    : [];

  if (Boolean(contexto?.is_master)) {
    return planoPerms;
  }

  const permissoesFinais = userPerms.filter((perm) => planoPerms.includes(perm));

  if (
    userPerms.includes(NPS_REPORT_PERMISSION) &&
    !permissoesFinais.includes(NPS_REPORT_PERMISSION)
  ) {
    permissoesFinais.push(NPS_REPORT_PERMISSION);
  }

  return permissoesFinais;
}

function canAccessNpsReport(contexto = null) {
  if (Boolean(contexto?.is_master)) return true;

  const permissoesFinais = resolvePermissoesFinais(contexto);
  return permissoesFinais.includes(NPS_REPORT_PERMISSION);
}

rota.post("/criar_pergunta", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    const pergunta = String(data.pergunta || "").trim();
    const ordem = Number(data.ordem || 1);

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    if (!pergunta) {
      return res.json(utils.jsonMount(false, {}, "Informe a pergunta do NPS."));
    }

    if (!Number.isInteger(ordem) || ordem <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe ordem valida para a pergunta."));
    }

    const ret = await execute.execute_create_nps_pergunta(empresaId, pergunta, ordem);
    return res.json(utils.jsonMount(true, ret[0], "Pergunta de NPS criada com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/nps/criar_pergunta"));
  }
});

rota.post("/listar_perguntas", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    const perguntas = await execute.execute_list_nps_perguntas(empresaId);
    return res.json(utils.jsonMount(true, perguntas, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/nps/listar_perguntas"));
  }
});

rota.post("/editar_pergunta", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    const perguntaId = Number(data.pergunta_id);
    const pergunta = String(data.pergunta || "").trim();
    const ordem = Number(data.ordem || 1);

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    if (!Number.isInteger(perguntaId) || perguntaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe pergunta_id valido."));
    }

    if (!pergunta) {
      return res.json(utils.jsonMount(false, {}, "Informe a pergunta do NPS."));
    }

    if (!Number.isInteger(ordem) || ordem <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe ordem valida para a pergunta."));
    }

    const exists = await execute.execute_get_nps_pergunta_by_id(perguntaId, empresaId);
    if (!exists.length) {
      return res.json(utils.jsonMount(false, {}, "Pergunta de NPS nao encontrada."));
    }

    const ret = await execute.execute_update_nps_pergunta(
      perguntaId,
      empresaId,
      pergunta,
      ordem
    );

    return res.json(utils.jsonMount(true, ret[0], "Pergunta de NPS alterada com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/nps/editar_pergunta"));
  }
});

rota.post("/apagar_pergunta", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    const perguntaId = Number(data.pergunta_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    if (!Number.isInteger(perguntaId) || perguntaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe pergunta_id valido."));
    }

    const ret = await execute.execute_delete_nps_pergunta(perguntaId, empresaId);
    if (!ret.length) {
      return res.json(utils.jsonMount(false, {}, "Pergunta de NPS nao encontrada."));
    }

    return res.json(utils.jsonMount(true, ret[0], "Pergunta de NPS apagada com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/nps/apagar_pergunta"));
  }
});

rota.get("/questionario/:token", async (req, res) => {
  try {
    const atendimentoId = getAtendimentoIdFromToken(req.params?.token);

    if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Token de NPS invalido ou expirado."));
    }

    const atendimento = await execute.execute_get_empresa_id_by_atendimento(atendimentoId);
    if (!atendimento.length) {
      return res.json(utils.jsonMount(false, {}, "Atendimento nao encontrado."));
    }

    const empresaId = Number(atendimento[0].empresa_id);
    const perguntas = await execute.execute_list_nps_perguntas_ativas_empresa(empresaId);

    return res.json(
      utils.jsonMount(
        true,
        {
          atendimento_id: atendimentoId,
          empresa_id: empresaId,
          escala: {
            min: 1,
            max: 10,
          },
          perguntas,
        },
        ""
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/nps/questionario/:token"));
  }
});

rota.post("/questionario", async (req, res) => {
  try {
    const atendimentoId = Number(req.body?.atendimento_id);

    if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe atendimento_id valido."));
    }

    const atendimento = await execute.execute_get_empresa_id_by_atendimento(atendimentoId);
    if (!atendimento.length) {
      return res.json(utils.jsonMount(false, {}, "Atendimento nao encontrado."));
    }

    const empresaId = Number(atendimento[0].empresa_id);
    const perguntas = await execute.execute_list_nps_perguntas_ativas_empresa(empresaId);

    return res.json(
      utils.jsonMount(
        true,
        {
          atendimento_id: atendimentoId,
          empresa_id: empresaId,
          escala: {
            min: 1,
            max: 10,
          },
          perguntas,
        },
        ""
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/nps/questionario"));
  }
});

rota.post("/responder/:token", async (req, res) => {
  try {
    const atendimentoId = getAtendimentoIdFromToken(req.params?.token);
    const respostasPayload = Array.isArray(req.body?.respostas) ? req.body.respostas : [];

    if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Token de NPS invalido ou expirado."));
    }

    if (!respostasPayload.length) {
      return res.json(utils.jsonMount(false, {}, "Informe ao menos uma resposta de NPS."));
    }

    const atendimento = await execute.execute_get_empresa_id_by_atendimento(atendimentoId);
    if (!atendimento.length) {
      return res.json(utils.jsonMount(false, {}, "Atendimento nao encontrado."));
    }

    const empresaId = Number(atendimento[0].empresa_id);
    const perguntasAtivas = await execute.execute_list_nps_perguntas_ativas_empresa(empresaId);
    const perguntasMap = new Map(perguntasAtivas.map((p) => [Number(p.id), true]));

    const respostas = [];

    for (const item of respostasPayload) {
      const perguntaId = Number(item?.pergunta_id);
      const nota = Number(item?.nota);
      const respostaTexto = String(item?.resposta_texto || "").trim();

      if (!Number.isInteger(perguntaId) || perguntaId <= 0) {
        return res.json(utils.jsonMount(false, {}, "Uma resposta possui pergunta_id invalido."));
      }

      if (!perguntasMap.has(perguntaId)) {
        return res.json(
          utils.jsonMount(false, {}, `Pergunta de NPS invalida para esta empresa: ${perguntaId}.`)
        );
      }

      if (!isValidNota(nota)) {
        return res.json(utils.jsonMount(false, {}, "Cada nota do NPS deve estar entre 1 e 10."));
      }

      const ret = await execute.execute_upsert_nps_resposta(
        empresaId,
        atendimentoId,
        perguntaId,
        nota,
        respostaTexto || null
      );
      respostas.push(ret[0]);
    }

    return res.json(
      utils.jsonMount(
        true,
        {
          atendimento_id: atendimentoId,
          empresa_id: empresaId,
          respostas,
        },
        "Respostas de NPS registradas com sucesso."
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/nps/responder/:token"));
  }
});

rota.post("/responder", async (req, res) => {
  try {
    const atendimentoId = Number(req.body?.atendimento_id);
    const respostasPayload = Array.isArray(req.body?.respostas) ? req.body.respostas : [];

    if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe atendimento_id valido."));
    }

    if (!respostasPayload.length) {
      return res.json(utils.jsonMount(false, {}, "Informe ao menos uma resposta de NPS."));
    }

    const atendimento = await execute.execute_get_empresa_id_by_atendimento(atendimentoId);
    if (!atendimento.length) {
      return res.json(utils.jsonMount(false, {}, "Atendimento nao encontrado."));
    }

    const empresaId = Number(atendimento[0].empresa_id);
    const perguntasAtivas = await execute.execute_list_nps_perguntas_ativas_empresa(empresaId);
    const perguntasMap = new Map(perguntasAtivas.map((p) => [Number(p.id), true]));

    const respostas = [];

    for (const item of respostasPayload) {
      const perguntaId = Number(item?.pergunta_id);
      const nota = Number(item?.nota);
      const respostaTexto = String(item?.resposta_texto || "").trim();

      if (!Number.isInteger(perguntaId) || perguntaId <= 0) {
        return res.json(utils.jsonMount(false, {}, "Uma resposta possui pergunta_id invalido."));
      }

      if (!perguntasMap.has(perguntaId)) {
        return res.json(
          utils.jsonMount(false, {}, `Pergunta de NPS invalida para esta empresa: ${perguntaId}.`)
        );
      }

      if (!isValidNota(nota)) {
        return res.json(utils.jsonMount(false, {}, "Cada nota do NPS deve estar entre 1 e 10."));
      }

      const ret = await execute.execute_upsert_nps_resposta(
        empresaId,
        atendimentoId,
        perguntaId,
        nota,
        respostaTexto || null
      );
      respostas.push(ret[0]);
    }

    return res.json(
      utils.jsonMount(
        true,
        {
          atendimento_id: atendimentoId,
          empresa_id: empresaId,
          respostas,
        },
        "Respostas de NPS registradas com sucesso."
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/nps/responder"));
  }
});

rota.post("/respostas_atendimento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    const atendimentoId = Number(data.atendimento_id);

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    if (!Number.isInteger(atendimentoId) || atendimentoId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe atendimento_id valido."));
    }

    const respostas = await execute.execute_list_nps_respostas_atendimento(
      atendimentoId,
      empresaId
    );

    return res.json(utils.jsonMount(true, respostas, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/nps/respostas_atendimento"));
  }
});

rota.post("/relatorio", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const empresaId = Number(data.empresa_id);
    const usuarioId = Number(data.usuario_id || data.user_id || data.id);
    let dateStart = normalizeDashboardDate(
      data.date_start || data.dateStart || data.data_inicio
    );
    let dateEnd = normalizeDashboardDate(
      data.date_end || data.dateEnd || data.data_fim
    );
    const filialIdRaw =
      data.filial_id !== undefined
        ? data.filial_id
        : data.filialId !== undefined
          ? data.filialId
          : data.branchId;
    const filialId = Number.isInteger(Number(filialIdRaw)) && Number(filialIdRaw) > 0
      ? Number(filialIdRaw)
      : null;
    const limit = Math.min(Math.max(Number(data.limit || 100) || 100, 1), 200);

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe empresa_id valido."));
    }

    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return res.json(utils.jsonMount(false, {}, "Informe usuario_id valido."));
    }

    if (dateStart && dateEnd && dateStart > dateEnd) {
      [dateStart, dateEnd] = [dateEnd, dateStart];
    }

    const contextoRows = await executeUser.execute_get_dashboard_contexto_usuario(
      usuarioId,
      empresaId
    );
    const contexto = Array.isArray(contextoRows) ? contextoRows[0] || null : null;

    if (!contexto) {
      return res.json(
        utils.jsonMount(false, {}, "Usuario nao encontrado para esta empresa.")
      );
    }

    if (!canAccessNpsReport(contexto)) {
      return res.json(
        utils.jsonMount(false, {}, "Voce nao possui permissao para acessar o relatorio de NPS.")
      );
    }

    const filters = {
      dateStart,
      dateEnd,
      filial_id: filialId,
    };

    const [
      resumoRet,
      evolucaoRet,
      porAtendenteRet,
      distribuicaoRet,
      respostasRet,
      filiaisRet,
    ] = await Promise.all([
      execute.execute_relatorio_nps_resumo(empresaId, filters),
      execute.execute_relatorio_nps_evolucao_diaria(empresaId, filters),
      execute.execute_relatorio_nps_por_atendente(empresaId, filters),
      execute.execute_relatorio_nps_distribuicao_notas(empresaId, filters),
      execute.execute_relatorio_nps_respostas_detalhadas(empresaId, filters, limit),
      executeUser.execute_listar_filial(empresaId),
    ]);

    const resumo = resumoRet?.[0] || {};

    return res.json(
      utils.jsonMount(
        true,
        {
          filtros: {
            date_start: dateStart,
            date_end: dateEnd,
            filial_id: filialId,
            limit,
          },
          filiais: Array.isArray(filiaisRet) ? filiaisRet : [],
          resumo: {
            totalAvaliacoes: Number(resumo.total_avaliacoes || 0),
            totalRespostas: Number(resumo.total_respostas || 0),
            promotores: Number(resumo.promotores || 0),
            neutros: Number(resumo.neutros || 0),
            detratores: Number(resumo.detratores || 0),
            mediaNota: Number(resumo.media_nota || 0),
            npsGeral: Number(resumo.nps_geral || 0),
          },
          evolucao: Array.isArray(evolucaoRet)
            ? evolucaoRet.map((item) => ({
                data_referencia: item.data_referencia,
                total_avaliacoes: Number(item.total_avaliacoes || 0),
                media_nota: Number(item.media_nota || 0),
                nps: Number(item.nps || 0),
              }))
            : [],
          porAtendente: Array.isArray(porAtendenteRet)
            ? porAtendenteRet.map((item) => ({
                usuario_id: Number(item.usuario_id || 0),
                usuario_nome: String(item.usuario_nome || "Sem atendente"),
                total_avaliacoes: Number(item.total_avaliacoes || 0),
                media_nota: Number(item.media_nota || 0),
                promotores: Number(item.promotores || 0),
                neutros: Number(item.neutros || 0),
                detratores: Number(item.detratores || 0),
                nps: Number(item.nps || 0),
              }))
            : [],
          distribuicaoNotas: Array.isArray(distribuicaoRet)
            ? distribuicaoRet.map((item) => ({
                nota: Number(item.nota || 0),
                total: Number(item.total || 0),
              }))
            : [],
          respostas: Array.isArray(respostasRet)
            ? respostasRet.map((item) => {
                const notaMedia = Number(item.nota_media || 0);
                return {
                  atendimento_id: Number(item.atendimento_id || 0),
                  cliente_id: Number(item.cliente_id || 0),
                  cliente_nome: String(item.cliente_nome || "Sem nome"),
                  cliente_telefone: String(item.cliente_telefone || ""),
                  usuario_id: item.usuario_id ? Number(item.usuario_id) : null,
                  atendente_nome: item.atendente_nome ? String(item.atendente_nome) : null,
                  data_resposta: item.data_resposta,
                  data_fim: item.data_fim,
                  data_inicio: item.data_inicio,
                  total_respostas: Number(item.total_respostas || 0),
                  nota_media: notaMedia,
                  classificacao:
                    notaMedia >= 9 ? "promotor" : notaMedia >= 7 ? "neutro" : "detrator",
                  comentarios: Array.isArray(item.comentarios)
                    ? item.comentarios.map((comment) => String(comment || "")).filter(Boolean)
                    : [],
                  perguntas: Array.isArray(item.perguntas) ? item.perguntas : [],
                };
              })
            : [],
        },
        ""
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/nps/relatorio"));
  }
});

module.exports = rota;
