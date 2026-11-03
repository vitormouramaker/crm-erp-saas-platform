const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const execute = require("../services/execute_push");
const utils = require("../utils/templates");

function normalizePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value) {
  const text = String(value || "").trim();
  return text || "";
}

function normalizePlatform(value) {
  const platform = normalizeText(value).toLowerCase();
  if (platform === "ios" || platform === "android") {
    return platform;
  }
  return "";
}

function getAuthContext(payload) {
  const data = security.jwtdecript(payload);
  if (!data) return null;

  const empresaId = normalizePositiveInt(data.empresa_id);
  const usuarioId = normalizePositiveInt(
    data.usuario_id || data.user_id || data.id
  );

  if (!empresaId || !usuarioId) {
    return null;
  }

  return {
    data,
    empresaId,
    usuarioId,
  };
}

rota.post("/register", async (req, res) => {
  try {
    const auth = getAuthContext(req.body);
    if (!auth) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const expoPushToken = normalizeText(req.body?.expo_push_token);
    const platform = normalizePlatform(req.body?.platform);
    const deviceId = normalizeText(req.body?.device_id) || null;

    if (!expoPushToken) {
      return res.json(
        utils.jsonMount(false, {}, "Informe expo_push_token valido.")
      );
    }

    if (!platform) {
      return res.json(
        utils.jsonMount(false, {}, "Informe platform valido.")
      );
    }

    const token = await execute.execute_upsert_push_token({
      usuario_id: auth.usuarioId,
      empresa_id: auth.empresaId,
      expo_push_token: expoPushToken,
      platform,
      device_id: deviceId,
    });

    return res.json(
      utils.jsonMount(true, token || {}, "Push token registrado com sucesso.")
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/push/register"));
  }
});

rota.delete("/unregister", async (req, res) => {
  try {
    const auth = getAuthContext(req.body);
    if (!auth) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const expoPushToken = normalizeText(req.body?.expo_push_token);
    if (!expoPushToken) {
      return res.json(
        utils.jsonMount(false, {}, "Informe expo_push_token valido.")
      );
    }

    const total = await execute.execute_deactivate_push_token_by_user({
      usuario_id: auth.usuarioId,
      empresa_id: auth.empresaId,
      expo_push_token: expoPushToken,
    });

    return res.json(
      utils.jsonMount(
        true,
        { total },
        "Push token desativado com sucesso."
      )
    );
  } catch (error) {
    return res.json(utils.errorHandle(error, "/push/unregister"));
  }
});

module.exports = rota;
