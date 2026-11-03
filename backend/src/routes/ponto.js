const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const execute = require("../services/execute_ponto");
const utils = require("../utils/templates");
const upload = require("../utils/multer_config");
const bunny = require("../utils/bunny_config");
const { requireMasterOrPermission } = require("../security/tenant_guard");

// Rotas de gestao do ponto (aprovar justificativas, editar batidas, ferias,
// feriados...): so o master ou quem tem rh.point.manage. Antes qualquer
// usuario logado podia aprovar as proprias justificativas.
const requirePontoManager = requireMasterOrPermission("rh.point.manage");

function requireToken(data, res) {
  if (!data) {
    res
      .status(401)
      .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    return false;
  }

  return true;
}

function handleDayOffConflict(error, rota) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("day off") && message.includes("cadastrado")) {
    return utils.jsonMount(
      false,
      {},
      "Ja existe um day-off cadastrado para este colaborador nesta data. Edite o registro existente para alterar as informações."
    );
  }

  return utils.errorHandle(error, rota);
}
function extractClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || "")
        .split(",")[0]
        .trim();

  return (
    forwardedIp ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}

rota.post("/cadastrar_horario_trabalho", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo usuario_id."));
    }

    const retorno = await execute.execute_cadastrar_horario_trabalho(
      data.empresa_id,
      data.usuario_id,
      data
    );

    return res.json(
      utils.jsonMount(true, retorno, "Horário de trabalho cadastrado com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/cadastrar_horario_trabalho"));
  }
});

rota.post("/listar_horarios_trabalho", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo usuario_id."));
    }

    const retorno = await execute.execute_listar_horarios_trabalho_usuario(
      data.empresa_id,
      data.usuario_id
    );

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/listar_horarios_trabalho"));
  }
});

rota.post("/editar_horario_trabalho", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id || !data.usuario_horario_id) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Informe os campos usuario_id e usuario_horario_id."
        )
      );
    }

    const retorno = await execute.execute_editar_horario_trabalho(
      data.empresa_id,
      data.usuario_id,
      data.usuario_horario_id,
      data
    );

    return res.json(
      utils.jsonMount(true, retorno, "Horário de trabalho atualizado com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_horario_trabalho"));
  }
});

rota.post("/deletar_horario_trabalho", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id || !data.usuario_horario_id) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Informe os campos usuario_id e usuario_horario_id."
        )
      );
    }

    const retorno = await execute.execute_deletar_horario_trabalho(
      data.empresa_id,
      data.usuario_id,
      data.usuario_horario_id
    );

    return res.json(
      utils.jsonMount(true, retorno, "Horário de trabalho removido com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_horario_trabalho"));
  }
});

rota.post("/adicionar_justificativa", upload.single("file"), async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id || !data.data_inicio || !data.tipo_justificativa_id) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Informe os campos usuario_id, data_inicio e tipo_justificativa_id."
        )
      );
    }

    let anexo = null;

    if (req.file) {
      const filePath = bunny.generateFileName(
        req.file.originalname,
        data.usuario_id
      );
      const uploaded = await bunny.uploadFile(filePath, req.file.buffer);

      anexo = {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype || null,
        url: uploaded.file
      };
    }

    const retorno = await execute.execute_adicionar_justificativa(
      data.empresa_id,
      data.usuario_id,
      data.tipo_justificativa_id,
      data.data_inicio,
      data.data_fim,
      data.descricao,
      anexo
    );

    return res.json(
      utils.jsonMount(true, retorno, "Justificativa adicionada com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/adicionar_justificativa"));
  }
});

rota.post("/justificativa_tipo", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;

    const retorno = await execute.execute_justificativa_tipo_select();

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/justificativa_tipo_select"));
  }
});

rota.post("/listar_justificativas", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;

    const retorno = await execute.execute_listar_justificativas(
      data.empresa_id,
      data.usuario_id,
      data.status,
      data.data_inicio,
      data.data_fim
    );

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/listar_justificativas"));
  }
});

rota.post("/aprovar_reprovar_justificativa", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id || !data.justificativa_id || !data.status) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Informe os campos usuario_id, justificativa_id e status."
        )
      );
    }

    const retorno = await execute.execute_aprovar_reprovar_justificativa(
      data.empresa_id,
      data.usuario_id,
      data.justificativa_id,
      data.status,
      data.motivo_recusa
    );

    return res.json(
      utils.jsonMount(true, retorno, "Justificativa atualizada com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/aprovar_reprovar_justificativa"));
  }
});

rota.post("/registrar_batida", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo usuario_id."));
    }
    console.log(data)

    const retorno = await execute.execute_registrar_batida(
      data.empresa_id,
      data.usuario_id,
      data.tipo,
      data.data_hora,
      {
        latitude: data.latitude,
        longitude: data.longitude,
        precisao_metros: data.precisao_metros,
        localizacao_capturada_em: data.localizacao_capturada_em,
        geolocalizacao_status: data.geolocalizacao_status,
        geolocalizacao_autorizada: data.geolocalizacao_autorizada,
        timezone_cliente: data.timezone_cliente,
        idioma_cliente: data.idioma_cliente,
        plataforma_cliente: data.plataforma_cliente,
        user_agent: data.user_agent,
        dispositivo_mobile: data.dispositivo_mobile,
        origem_registro: data.origem_registro,
        registrado_por_usuario_id: data.registrado_por_usuario_id,
        ip_publico: extractClientIp(req)
      }
    );
    console.log(retorno)

    return res.json(utils.jsonMount(true, retorno, "Batida registrada com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/registrar_batida"));
  }
});

rota.post("/editar_batida", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id || !data.registro_ponto_id) {
      return res.json(
        utils.jsonMount(false, {}, "Informe os campos usuario_id e registro_ponto_id.")
      );
    }

    const retorno = await execute.execute_editar_registro_ponto(
      data.empresa_id,
      data.usuario_id,
      data.registro_ponto_id,
      data.tipo,
      data.data_hora
    );

    return res.json(utils.jsonMount(true, retorno, "Batida atualizada com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_batida"));
  }
});

rota.post("/deletar_batida", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id || !data.registro_ponto_id) {
      return res.json(
        utils.jsonMount(false, {}, "Informe os campos usuario_id e registro_ponto_id.")
      );
    }

    const retorno = await execute.execute_deletar_registro_ponto(
      data.empresa_id,
      data.usuario_id,
      data.registro_ponto_id
    );

    return res.json(utils.jsonMount(true, retorno, "Batida removida com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/deletar_batida"));
  }
});

rota.post("/criar_periodo_ferias", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id || !data.periodo_aquisitivo_inicio || !data.periodo_aquisitivo_fim) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "Informe os campos usuario_id, periodo_aquisitivo_inicio e periodo_aquisitivo_fim."
        )
      );
    }

    const retorno = await execute.execute_criar_periodo_ferias(
      data.empresa_id,
      data.usuario_id,
      data.periodo_aquisitivo_inicio,
      data.periodo_aquisitivo_fim,
      data.saldo_dias
    );

    return res.json(
      utils.jsonMount(true, retorno, "Periodo de ferias cadastrado com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/criar_periodo_ferias"));
  }
});

rota.post("/listar_periodos_ferias", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;

    const retorno = await execute.execute_listar_periodos_ferias(
      data.empresa_id,
      data.usuario_id,
      data.data_inicio,
      data.data_fim
    );

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/listar_periodos_ferias"));
  }
});

rota.post("/editar_periodo_ferias", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.periodo_ferias_id) {
      return res.json(
        utils.jsonMount(false, {}, "Informe o campo periodo_ferias_id.")
      );
    }

    const retorno = await execute.execute_editar_periodo_ferias(
      data.empresa_id,
      data.periodo_ferias_id,
      data.periodo_aquisitivo_inicio,
      data.periodo_aquisitivo_fim,
      data.saldo_dias
    );

    return res.json(
      utils.jsonMount(true, retorno, "Periodo de ferias atualizado com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_periodo_ferias"));
  }
});

rota.post("/remover_periodo_ferias", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.periodo_ferias_id) {
      return res.json(
        utils.jsonMount(false, {}, "Informe o campo periodo_ferias_id.")
      );
    }

    const retorno = await execute.execute_remover_periodo_ferias(
      data.empresa_id,
      data.periodo_ferias_id
    );

    return res.json(
      utils.jsonMount(true, retorno, "Periodo de ferias removido com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/remover_periodo_ferias"));
  }
});

rota.post("/criar_ferias", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id || !data.data_inicio) {
      return res.json(
        utils.jsonMount(false, {}, "Informe os campos usuario_id e data_inicio.")
      );
    }

    const retorno = await execute.execute_criar_ferias(
      data.empresa_id,
      data.usuario_id,
      data.data_inicio,
      data.data_fim,
      data.observacao,
      data.status,
      data.periodo_ferias_id,
      data.aprovado_por
    );

    return res.json(utils.jsonMount(true, retorno, "Ferias cadastradas com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/criar_ferias"));
  }
});

rota.post("/listar_ferias_usuario", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;

    const retorno = await execute.execute_listar_ferias_usuario(
      data.empresa_id,
      data.usuario_id,
      data.data_inicio,
      data.data_fim
    );

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/listar_ferias_usuario"));
  }
});

rota.post("/editar_ferias", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.ferias_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo ferias_id."));
    }

    const retorno = await execute.execute_editar_ferias(
      data.empresa_id,
      data.ferias_id,
      data.data_inicio,
      data.data_fim,
      data.observacao,
      data.status,
      data.periodo_ferias_id,
      data.aprovado_por
    );

    return res.json(utils.jsonMount(true, retorno, "Ferias atualizadas com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_ferias"));
  }
});

rota.post("/remover_ferias", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.ferias_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo ferias_id."));
    }

    const retorno = await execute.execute_remover_ferias(
      data.empresa_id,
      data.ferias_id
    );

    return res.json(utils.jsonMount(true, retorno, "Ferias removidas com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/remover_ferias"));
  }
});

rota.post("/criar_day_off", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id || !data.data_referencia) {
      return res.json(
        utils.jsonMount(false, {}, "Informe os campos usuario_id e data_referencia.")
      );
    }

    const retorno = await execute.execute_criar_day_off(
      data.empresa_id,
      data.usuario_id,
      data.data_referencia,
      data.tipo,
      data.observacao,
      data.status
    );

    return res.json(utils.jsonMount(true, retorno, "Day off cadastrado com sucesso."));
  } catch (error) {
    return res.json(handleDayOffConflict(error, "/criar_day_off"));
  }
});

rota.post("/listar_day_off_usuario", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;

    const retorno = await execute.execute_listar_day_off_usuario(
      data.empresa_id,
      data.usuario_id,
      data.data_inicio,
      data.data_fim
    );

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/listar_day_off_usuario"));
  }
});

rota.post("/editar_day_off", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.day_off_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo day_off_id."));
    }

    const retorno = await execute.execute_editar_day_off(
      data.empresa_id,
      data.day_off_id,
      data.data_referencia,
      data.tipo,
      data.observacao,
      data.status
    );

    return res.json(utils.jsonMount(true, retorno, "Day off atualizado com sucesso."));
  } catch (error) {
    return res.json(handleDayOffConflict(error, "/editar_day_off"));
  }
});

rota.post("/remover_day_off", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.day_off_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo day_off_id."));
    }

    const retorno = await execute.execute_remover_day_off(
      data.empresa_id,
      data.day_off_id
    );

    return res.json(utils.jsonMount(true, retorno, "Day off removido com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/remover_day_off"));
  }
});

rota.post("/criar_feriado", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.data_referencia || !data.descricao) {
      return res.json(
        utils.jsonMount(false, {}, "Informe os campos data_referencia e descricao.")
      );
    }

    const retorno = await execute.execute_criar_feriado(
      data.empresa_id,
      data.data_referencia,
      data.descricao,
      data.tipo,
      data.ativo
    );

    return res.json(utils.jsonMount(true, retorno, "Feriado cadastrado com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/criar_feriado"));
  }
});

rota.post("/listar_feriados", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;

    const retorno = await execute.execute_listar_feriados(
      data.empresa_id,
      data.data_inicio,
      data.data_fim
    );

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/listar_feriados"));
  }
});

rota.post("/editar_feriado", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.feriado_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo feriado_id."));
    }

    const retorno = await execute.execute_editar_feriado(
      data.empresa_id,
      data.feriado_id,
      data.data_referencia,
      data.descricao,
      data.tipo,
      data.ativo
    );

    return res.json(utils.jsonMount(true, retorno, "Feriado atualizado com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/editar_feriado"));
  }
});

rota.post("/remover_feriado", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.feriado_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo feriado_id."));
    }

    const retorno = await execute.execute_remover_feriado(
      data.empresa_id,
      data.feriado_id
    );

    return res.json(utils.jsonMount(true, retorno, "Feriado removido com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/remover_feriado"));
  }
});

rota.post("/validar_day_off", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo usuario_id."));
    }

    const retorno = await execute.execute_validar_day_off(
      data.empresa_id,
      data.usuario_id,
      data.data_referencia
    );

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/validar_day_off"));
  }
});

rota.post("/recalcular_dia", requirePontoManager, async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id || !data.data_referencia) {
      return res.json(
        utils.jsonMount(false, {}, "Informe os campos usuario_id e data_referencia.")
      );
    }

    const retorno = await execute.execute_recalcular_dia(
      data.empresa_id,
      data.usuario_id,
      data.data_referencia
    );

    return res.json(utils.jsonMount(true, retorno, "Dia recalculado com sucesso."));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/recalcular_dia"));
  }
});

rota.post("/relatorio_ponto", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo usuario_id."));
    }

    const retorno = await execute.execute_relatorio_ponto(
      data.empresa_id,
      data.usuario_id,
      data.data_inicio,
      data.data_fim
    );

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/relatorio_ponto"));
  }
});

rota.post("/balanco_ponto", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo usuario_id."));
    }

    const retorno = await execute.execute_balanco_ponto(
      data.empresa_id,
      data.usuario_id,
      data.data_inicio,
      data.data_fim
    );

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/balanco_ponto"));
  }
});

rota.post("/banco_horas", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!requireToken(data, res)) return;
    if (!data.usuario_id) {
      return res.json(utils.jsonMount(false, {}, "Informe o campo usuario_id."));
    }

    const retorno = await execute.execute_banco_horas(
      data.empresa_id,
      data.usuario_id,
      data.data_inicio,
      data.data_fim
    );

    return res.json(utils.jsonMount(true, retorno, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/banco_horas"));
  }
});

module.exports = rota;
