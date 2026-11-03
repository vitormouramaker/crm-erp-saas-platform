const crypto = require("crypto");
const express = require("express");
const rota = express.Router();
const execute = require("../services/execute_pagamento");

// Integracao servidor-a-servidor com o Gestao 360.
// JSON puro (sem envelope {payload}), autenticado pelo header x-integration-key.

function jsonErro(res, status, mensagem) {
  return res.status(status).json({ ok: false, mensagem });
}

function hashChave(value) {
  return crypto.createHash("sha256").update(String(value)).digest();
}

function autenticarIntegracao(req, res, next) {
  const chaveEsperada = String(process.env.GESTAO360_INTEGRATION_KEY || "").trim();
  if (!chaveEsperada) {
    return jsonErro(res, 503, "Integracao Gestão 360 desativada.");
  }

  const chaveRecebida = String(req.headers["x-integration-key"] || "").trim();
  const chaveValida =
    Boolean(chaveRecebida) &&
    crypto.timingSafeEqual(hashChave(chaveRecebida), hashChave(chaveEsperada));

  if (!chaveValida) {
    console.warn(`[integracao/gestao360] ${req.method} ${req.path} chave invalida`);
    return jsonErro(res, 401, "Chave de integracao invalida.");
  }

  return next();
}

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeText(value, max = 120) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, max) : null;
}

function parseEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createValidationError("E-mail invalido.");
  }
  return email;
}

function getHojeLocal() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${hoje.getFullYear()}-${mes}-${dia}`;
}

function parseValidade(value) {
  const validade = String(value || "").trim();
  const match = validade.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw createValidationError("Validade invalida. Use o formato YYYY-MM-DD.");
  }

  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== validade) {
    throw createValidationError("Validade invalida. Use o formato YYYY-MM-DD.");
  }

  if (validade < getHojeLocal()) {
    throw createValidationError("Validade nao pode estar no passado.");
  }

  return validade;
}

function responderErro(res, acao, error) {
  const status = Number(error?.status) || 500;
  const codigo = String(error?.code || "").toUpperCase();

  if (status < 500) {
    return jsonErro(res, status, error.message);
  }

  console.error(`[integracao/gestao360] ${acao} erro:`, error);

  // 42703 = coluna inexistente, 42P01 = tabela inexistente.
  if (codigo === "42703" || codigo === "42P01") {
    return jsonErro(
      res,
      503,
      "Schema da integracao Gestão 360 nao aplicado (docs/sql/empresa_origem_gestao360.sql)."
    );
  }

  if (error?.status) {
    return jsonErro(res, status, error.message);
  }

  return jsonErro(res, 500, "Falha interna ao processar a integracao.");
}

function logChamada(acao, email, result) {
  console.log(
    `[integracao/gestao360] ${acao} email=${email} status=${result?.status || "ok"} empresa_id=${
      result?.empresa_id ?? "-"
    }`
  );
}

rota.use(autenticarIntegracao);

rota.post("/provisionar", async (req, res) => {
  try {
    const body = req.body || {};
    const email = parseEmail(body.email);
    const nome = normalizeText(body.nome);
    if (!nome) {
      throw createValidationError("Nome obrigatorio.");
    }
    const referencia = normalizeText(body.referencia);
    if (!referencia) {
      throw createValidationError("Referencia obrigatoria.");
    }
    const validade = parseValidade(body.validade);

    const result = await execute.gestao360_provisionar({
      email,
      nome,
      telefone: normalizeText(body.telefone, 30),
      empresa_nome: normalizeText(body.empresa_nome),
      validade,
      referencia,
    });

    logChamada("provisionar", email, result);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return responderErro(res, "provisionar", error);
  }
});

rota.post("/renovar", async (req, res) => {
  try {
    const body = req.body || {};
    const email = parseEmail(body.email);
    const validade = parseValidade(body.validade);

    const result = await execute.gestao360_renovar({ email, validade });

    logChamada("renovar", email, result);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return responderErro(res, "renovar", error);
  }
});

rota.post("/bloquear", async (req, res) => {
  try {
    const email = parseEmail(req.body?.email);

    const result = await execute.gestao360_bloquear({ email });

    logChamada("bloquear", email, result);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return responderErro(res, "bloquear", error);
  }
});

rota.get("/status", async (req, res) => {
  try {
    const email = parseEmail(req.query?.email);

    const result = await execute.gestao360_status({ email });

    logChamada("status", email, result);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return responderErro(res, "status", error);
  }
});

module.exports = rota;
