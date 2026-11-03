const express = require("express");
const rota = express.Router();
const execute = require("../services/execute_pagamento");
const security = require("../security/cypher");
const utils = require("../utils/templates");
const { postgres } = require("../server/connect");

// A assinatura e sempre a da empresa da sessao. Antes o e-mail, o
// stripe_customer_id e o stripe_subscription_id vinham do corpo: qualquer
// usuario logado lia, cancelava ou abria o portal de cobranca de outra empresa.
async function getSessionBillingContext(req, { requireMaster = false } = {}) {
  const auth = req.auth || {};
  if (requireMaster && !auth.is_master) {
    const error = new Error("Apenas o usuario master pode alterar a assinatura.");
    error.status = 403;
    throw error;
  }
  const ret = await postgres.query(
    "SELECT email FROM usuario WHERE id = $1 AND empresa_id = $2 AND ativo = true",
    [auth.usuario_id, auth.empresa_id]
  );
  const email = ret.rows[0]?.email;
  if (!email) {
    const error = new Error("Usuario da sessao nao encontrado.");
    error.status = 401;
    throw error;
  }
  return { email };
}

rota.post("/criar_assinatura", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const { email } = await getSessionBillingContext(req, { requireMaster: true });
    const {
      assinatura_id,
      billing_cycle,
      additional_user,
      additional_user_cycle,
      additional_crm,
      additional_crm_cycle,
      additional_leads,
      additional_leads_cycle,
      ui_mode,
      has_pdv,
      coupon_code,
      promotion_code,
      coupon_id,
      allow_promotion_codes,
    } = data;
    // URLs de retorno vem da configuracao do servidor (evita redirect aberto).
    const success_url = undefined;
    const cancel_url = undefined;

    const result = await execute.criar_checkout_assinatura({
      email,
      assinatura_id,
      billing_cycle,
      additional_user,
      additional_user_cycle,
      additional_crm,
      additional_crm_cycle,
      additional_leads,
      additional_leads_cycle,
      ui_mode,
      success_url,
      cancel_url,
      has_pdv,
      coupon_code,
      promotion_code,
      coupon_id,
      allow_promotion_codes,
    });

    const successMessage =
      result?.modo_alteracao === "proration"
        ? result?.mensagem || "Troca de plano aplicada com proration."
        : "Checkout Stripe criado com sucesso.";

    return res.json(
      utils.jsonMount(true, result, successMessage)
    );
  } catch (error) {
    console.error("[pagamento/criar_assinatura] erro:", error?.response || error);
    const message =
      String(error?.message || "").trim() || "Tente novamente mais tarde!";
    return res.json(utils.jsonMount(false, {}, message));
  }
});

rota.post("/get_assinatura", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const { email } = await getSessionBillingContext(req);
    const result = await execute.obter_assinatura_usuario(email);

    return res.json(utils.jsonMount(true, result || {}, "Status recuperado."));
  } catch (error) {
    console.error("[pagamento/get_assinatura] erro:", error?.response || error);
    const message =
      String(error?.message || "").trim() || "Tente novamente mais tarde!";
    return res.json(utils.jsonMount(false, {}, message));
  }
});

rota.post("/historico_pagamentos", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const { email } = await getSessionBillingContext(req);
    const { limit } = data;
    const result = await execute.listar_historico_pagamentos(email, limit);

    return res.json(
      utils.jsonMount(true, result || [], "Historico recuperado com sucesso.")
    );
  } catch (error) {
    console.error("[pagamento/historico_pagamentos] erro:", error?.response || error);
    const message =
      String(error?.message || "").trim() || "Tente novamente mais tarde!";
    return res.json(utils.jsonMount(false, {}, message));
  }
});

rota.post("/cancelar_assinatura", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const { email } = await getSessionBillingContext(req, { requireMaster: true });
    const { imediato } = data;

    const result = await execute.cancelar_assinatura({
      email,
      stripe_subscription_id: null,
      imediato,
    });

    return res.json(
      utils.jsonMount(true, result, "Cancelamento solicitado com sucesso.")
    );
  } catch (error) {
    console.error("[pagamento/cancelar_assinatura] erro:", error?.response || error);
    const message =
      String(error?.message || "").trim() || "Tente novamente mais tarde!";
    return res.json(utils.jsonMount(false, {}, message));
  }
});

rota.post("/alterar_forma_pagamento", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const { email } = await getSessionBillingContext(req, { requireMaster: true });

    const result = await execute.criar_sessao_portal_forma_pagamento({
      email,
      stripe_customer_id: null,
      return_url: null,
    });

    return res.json(
      utils.jsonMount(true, result, "Portal Stripe criado com sucesso.")
    );
  } catch (error) {
    console.error(
      "[pagamento/alterar_forma_pagamento] erro:",
      error?.response || error
    );
    const message =
      String(error?.message || "").trim() || "Tente novamente mais tarde!";
    return res.json(utils.jsonMount(false, {}, message));
  }
});

rota.post("/webhook/stripe", async (req, res) => {
  try {
    const signatureHeader = req.headers["stripe-signature"] || "";
    const result = await execute.processar_evento_webhook(
      req.body,
      signatureHeader
    );
    return res.status(200).json({ received: true, ...result });
  } catch (error) {
    const status = error?.status || 500;
    if (status >= 500) {
      console.error("Erro webhook Stripe:", error);
    }
    return res.status(status).json({ received: false, message: error.message });
  }
});

module.exports = rota;
