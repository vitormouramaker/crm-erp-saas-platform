const models = require("../models/models_meta_ads");
const modelsUser = require("../models/models_user");
const modelsVendas = require("../models/models_vendas");
const { postgres } = require("../server/connect");
const developerWebhooks = require("./execute_developer_webhooks");
const { isRuntimeSchemaEnsureEnabled } = require("../utils/runtime_schema");

const RUNTIME_SCHEMA_ENSURE_META_ADS = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SCHEMA_ENSURE_META_ADS"
);

const CLIENTE_ORIGENS_PERMITIDAS = new Set([
  "manual",
  "whatsapp",
  "meta_ads",
  "importacao",
  "comercial",
]);

function normalizeNullableText(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizePhoneLookupCandidates(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return [];

  const withoutInternationalPrefix = digits.startsWith("00")
    ? digits.slice(2)
    : digits;
  const normalized = withoutInternationalPrefix.startsWith("55")
    ? withoutInternationalPrefix
    : `55${withoutInternationalPrefix}`;
  const candidates = new Set([normalized]);

  if (/^55\d{2}9\d{8}$/.test(normalized)) {
    candidates.add(`${normalized.slice(0, 4)}${normalized.slice(5)}`);
  } else if (/^55\d{10}$/.test(normalized)) {
    candidates.add(`${normalized.slice(0, 4)}9${normalized.slice(4)}`);
  }

  return [...candidates];
}

function normalizeNullableDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeClienteOrigem(value, fallback = "manual") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (CLIENTE_ORIGENS_PERMITIDAS.has(normalized)) {
    return normalized;
  }

  return fallback;
}

function normalizeMetaAdsMappingScopeType(value) {
  return String(value || "").trim().toLowerCase() === "campaign"
    ? "campaign"
    : "form";
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function resolveMetaAdsImportCrm(client, empresaId, crmId) {
  const normalizedCrmId = toNumber(crmId);
  if (!normalizedCrmId) return null;

  const crmRet = await client.query(modelsVendas.get_crm_by_id(), [normalizedCrmId, empresaId]);
  const crm = crmRet.rows?.[0] || null;

  if (!crm || crm.ativo === false) {
    throw new Error("CRM informado para importacao nao foi encontrado ou esta inativo.");
  }

  return crm;
}

async function resolveMetaAdsWaitingStage(client, crmId) {
  const etapaRet = await client.query(modelsVendas.get_etapa_by_codigo(), [crmId, "waiting"]);
  const etapa = etapaRet.rows?.[0] || null;

  if (!etapa) {
    throw new Error('A coluna "Aguardando Atendimento" nao foi encontrada no CRM selecionado.');
  }

  return etapa;
}

async function createMetaAdsLeadWaitingDeal(
  client,
  {
    empresaId,
    crmId,
    etapaId,
    etapaCodigo,
    etapaNome,
    cliente,
    lead,
    metaLeadId,
    metaAdsAccountId,
    formId,
    formName,
  }
) {
  const nomeContato =
    normalizeNullableText(lead.nome || lead.name) ||
    normalizeNullableText(cliente?.nome) ||
    "Cliente";
  const telefone =
    normalizeNullableText(lead.telefone || lead.phone) ||
    normalizeNullableText(cliente?.telefone);
  const email = normalizeNullableText(lead.email) || normalizeNullableText(cliente?.email);
  const createdAt = new Date().toISOString();
  const observacaoEntrada = "Lead recebido via Meta Ads.";

  const posRet = await client.query(modelsVendas.get_next_posicao(), [crmId, etapaId]);
  const created = await client.query(modelsVendas.insert_negocio(), [
    empresaId,
    crmId,
    cliente.id,
    null,
    etapaId,
    `Meta Ads - ${nomeContato}`,
    nomeContato,
    nomeContato,
    telefone,
    email,
    null,
    "morno",
    50,
    0,
    null,
    null,
    "meta_ads",
    null,
    null,
    null,
    null,
    null,
    createdAt,
    createdAt,
    null,
    null,
    posRet.rows?.[0]?.proxima_posicao || 0,
  ]);

  const negocioId = created.rows?.[0]?.id || null;
  if (!negocioId) {
    throw new Error("Nao foi possivel criar o negocio do lead importado.");
  }

  await client.query(modelsVendas.insert_movimentacao(), [
    negocioId,
    null,
    null,
    etapaId,
    observacaoEntrada,
  ]);

  await client.query(modelsVendas.insert_historico_cliente(), [
    empresaId,
    negocioId,
    cliente.id,
    null,
    null,
    "meta-ads-entry",
    "Entrada via Meta Ads",
    observacaoEntrada,
    JSON.stringify({
      metaLeadId,
      metaAdsAccountId: normalizeNullableText(metaAdsAccountId),
      formId: normalizeNullableText(formId),
      formName: normalizeNullableText(formName),
      campaignId: normalizeNullableText(lead.campaign_id),
      campaignName: normalizeNullableText(lead.campaign_name),
      adId: normalizeNullableText(lead.ad_id),
      adName: normalizeNullableText(lead.ad_name),
      crmId,
      etapaId,
      etapaCodigo,
      etapaNome,
      createdAt,
    }),
  ]);

  await client.query(modelsVendas.resequence_stage(), [crmId, etapaId]);

  return {
    negocio_id: negocioId,
    crm_id: crmId,
    etapa_id: etapaId,
  };
}

const execute = {

  execute_ensure_meta_ads_schema: async (client) => {
    if (!RUNTIME_SCHEMA_ENSURE_META_ADS) {
      return;
    }

    await client.query(models.ensure_empresa_meta_ads_accounts_table());
    await client.query(models.ensure_empresa_meta_ads_access_token_column());
    await client.query(models.ensure_empresa_meta_ads_accounts_unique());
    await client.query(models.ensure_cliente_meta_ads_leads_table());
    await client.query(models.ensure_cliente_meta_ads_leads_unique());
    await client.query(models.ensure_cliente_meta_ads_leads_cliente_fk());
    await client.query(models.ensure_cliente_meta_ads_leads_empresa_fk());
    await client.query(models.ensure_meta_ads_field_mapping_table());
    await client.query(models.ensure_meta_ads_field_mapping_unique());
    await client.query(models.ensure_meta_ads_field_mapping_empresa_fk());
  },

  execute_get_meta_ads_accounts: async (empresa_id) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ads_schema(client);
      const ret = await client.query(models.get_meta_ads_accounts(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_meta_ads_account_by_ad_account_id: async (empresa_id, ad_account_id) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ads_schema(client);
      const ret = await client.query(
        models.get_meta_ads_account_by_ad_account_id(),
        [empresa_id, ad_account_id]
      );
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_cliente_meta_ads_leads_by_ids: async (empresa_id, lead_ids = []) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ads_schema(client);
      const normalizedLeadIds = [...new Set(
        (lead_ids || [])
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )];

      if (!normalizedLeadIds.length) {
        return [];
      }

      const ret = await client.query(models.get_cliente_meta_ads_leads_by_ids(), [
        empresa_id,
        normalizedLeadIds,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_meta_ads_field_mapping: async ({
    empresa_id,
    escopo_tipo,
    escopo_id,
  }) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ads_schema(client);
      const normalizedScopeId = normalizeNullableText(escopo_id);
      if (!empresa_id || !normalizedScopeId) {
        return null;
      }

      const ret = await client.query(models.get_meta_ads_field_mapping_by_scope(), [
        empresa_id,
        normalizeMetaAdsMappingScopeType(escopo_tipo),
        normalizedScopeId,
      ]);

      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_get_meta_ads_field_mappings: async ({
    empresa_id,
    form_ids = [],
    campaign_ids = [],
  }) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ads_schema(client);

      const normalizedFormIds = [...new Set(
        (form_ids || []).map((item) => String(item || "").trim()).filter(Boolean)
      )];
      const normalizedCampaignIds = [...new Set(
        (campaign_ids || []).map((item) => String(item || "").trim()).filter(Boolean)
      )];

      if (!empresa_id || (!normalizedFormIds.length && !normalizedCampaignIds.length)) {
        return [];
      }

      const ret = await client.query(models.get_meta_ads_field_mappings_by_scope_ids(), [
        empresa_id,
        normalizedFormIds.length ? normalizedFormIds : null,
        normalizedCampaignIds.length ? normalizedCampaignIds : null,
      ]);

      return ret.rows || [];
    } finally {
      client.release();
    }
  },

  execute_save_meta_ads_field_mapping: async ({
    empresa_id,
    escopo_tipo,
    escopo_id,
    escopo_nome,
    campo_nome,
    campo_telefone,
    campo_email,
  }) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ads_schema(client);

      const normalizedScopeId = normalizeNullableText(escopo_id);
      if (!empresa_id || !normalizedScopeId) {
        throw new Error("Escopo invalido para salvar o mapeamento dos leads.");
      }

      const ret = await client.query(models.upsert_meta_ads_field_mapping(), [
        empresa_id,
        normalizeMetaAdsMappingScopeType(escopo_tipo),
        normalizedScopeId,
        normalizeNullableText(escopo_nome),
        normalizeNullableText(campo_nome),
        normalizeNullableText(campo_telefone),
        normalizeNullableText(campo_email),
      ]);

      return ret.rows?.[0] || null;
    } finally {
      client.release();
    }
  },

  execute_import_meta_ads_leads: async ({
    empresa_id,
    meta_ads_account_id,
    crm_id = null,
    form_id = null,
    form_name = null,
    leads = [],
  }) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ads_schema(client);

      const resultado = {
        total: Array.isArray(leads) ? leads.length : 0,
        criados: 0,
        atualizados: 0,
        ignorados: 0,
        negocios_criados: 0,
        erros: [],
        vinculados: [],
      };

      if (!empresa_id) {
        throw new Error("Empresa invalida para importar leads da Meta Ads.");
      }

      if (!meta_ads_account_id) {
        throw new Error("Conta de anuncios nao informada.");
      }

      if (!Array.isArray(leads) || !leads.length) {
        return resultado;
      }

      const selectedCrm = await resolveMetaAdsImportCrm(client, empresa_id, crm_id);
      const waitingStage = selectedCrm
        ? await resolveMetaAdsWaitingStage(client, selectedCrm.id)
        : null;

      for (let index = 0; index < leads.length; index += 1) {
        const lead = leads[index] || {};
        const linha = index + 1;
        let createdCustomerId = null;

        try {
          await client.query("BEGIN");

          const metaLeadId = normalizeNullableText(lead.id || lead.meta_lead_id);
          const nome =
            normalizeNullableText(lead.nome) ||
            normalizeNullableText(lead.name) ||
            normalizeNullableText(lead.email) ||
            normalizeNullableText(lead.telefone) ||
            "Lead Meta Ads";
          const telefone = normalizeNullableText(lead.telefone || lead.phone);
          const email = normalizeNullableText(lead.email);

          if (!metaLeadId) {
            throw new Error("Lead da Meta Ads sem identificador.");
          }

          if (!telefone && !email) {
            throw new Error("O lead precisa ter telefone ou email para virar contato.");
          }

          const existingLeadRet = await client.query(
            models.get_cliente_meta_ads_lead_by_lead_id(),
            [empresa_id, metaLeadId]
          );
          const leadVinculado = existingLeadRet.rows?.[0] || null;

          const existingClienteRet = await client.query(
            modelsUser.get_cliente_by_email_or_phone(),
            [empresa_id, email, normalizePhoneLookupCandidates(telefone)]
          );

          let cliente = existingClienteRet.rows?.[0] || null;

          if (cliente) {
            const updatedRet = await client.query(modelsUser.update_cliente_importacao(), [
              cliente.id,
              nome || cliente.nome,
              telefone || cliente.telefone,
              email || cliente.email,
              null,
              cliente.origem || "meta_ads",
            ]);
            cliente = updatedRet.rows?.[0] || cliente;
            if (!leadVinculado) {
              resultado.atualizados += 1;
            } else {
              resultado.ignorados += 1;
            }
          } else {
            const createdRet = await client.query(modelsUser.criar_cliente(), [
              nome,
              telefone,
              email,
              empresa_id,
              normalizeNullableDate(lead.data_aniversario || lead.birthday),
              normalizeClienteOrigem("meta_ads", "meta_ads"),
            ]);
            cliente = createdRet.rows?.[0] || null;
            createdCustomerId = cliente?.id || null;
            resultado.criados += 1;
          }

          if (!cliente?.id) {
            throw new Error("Nao foi possivel criar ou localizar o contato do lead.");
          }

          const payload = {
            ...lead.payload,
            normalized_lead: lead,
          };

          let negocioCriado = null;
          if (!leadVinculado && selectedCrm && waitingStage) {
            negocioCriado = await createMetaAdsLeadWaitingDeal(client, {
              empresaId: empresa_id,
              crmId: selectedCrm.id,
              etapaId: waitingStage.id,
              etapaCodigo: waitingStage.codigo,
              etapaNome: waitingStage.nome,
              cliente,
              lead,
              metaLeadId,
              metaAdsAccountId: meta_ads_account_id,
              formId: lead.form_id || form_id,
              formName: lead.form_name || form_name,
            });
            resultado.negocios_criados += 1;
          }

          const vinculoRet = await client.query(models.upsert_cliente_meta_ads_lead(), [
            empresa_id,
            cliente.id,
            String(meta_ads_account_id),
            metaLeadId,
            normalizeNullableText(lead.form_id || form_id),
            normalizeNullableText(lead.form_name || form_name),
            normalizeNullableText(lead.campaign_id),
            normalizeNullableText(lead.campaign_name),
            normalizeNullableText(lead.ad_id),
            normalizeNullableText(lead.ad_name),
            JSON.stringify(payload),
          ]);

          await client.query("COMMIT");
          if (createdCustomerId) {
            developerWebhooks.queueCustomerCreated(createdCustomerId);
          }

          resultado.vinculados.push({
            lead_id: metaLeadId,
            cliente_id: cliente.id,
            nome: cliente.nome || nome,
            vinculo_id: vinculoRet.rows?.[0]?.id || null,
            negocio_id: negocioCriado?.negocio_id || null,
            crm_id: negocioCriado?.crm_id || null,
            etapa_id: negocioCriado?.etapa_id || null,
          });
        } catch (error) {
          await client.query("ROLLBACK");
          resultado.erros.push({
            linha,
            lead_id: lead?.id || null,
            mensagem: error?.message || "Falha ao importar lead.",
          });
        }
      }

      return resultado;
    } finally {
      client.release();
    }
  },

  execute_replace_meta_ads_accounts: async (empresa_id, accounts) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ads_schema(client);
      await client.query("BEGIN");

      const accountIds = (accounts || [])
        .map((account) => String(account.meta_ad_account_id || ""))
        .filter(Boolean);

      if (accountIds.length) {
        await client.query(models.delete_meta_ads_accounts_not_in(), [
          empresa_id,
          accountIds
        ]);
      } else {
        await client.query(models.delete_all_meta_ads_accounts(), [empresa_id]);
      }

      for (const account of accounts || []) {
        await client.query(models.upsert_meta_ads_account(), [
          empresa_id,
          account.meta_business_id,
          account.meta_business_name,
          account.meta_ad_account_id,
          account.meta_ad_account_name,
          account.meta_ad_account_status,
          account.meta_currency,
          account.meta_timezone_id,
          account.meta_timezone_name,
          account.meta_account_id,
          account.meta_disable_reason,
          account.meta_graph_api_version,
          account.meta_access_token,
          account.meta_access_token_type,
          account.meta_token_expires_in,
          account.meta_access_token_expires_at,
          account.meta_payload
        ]);
      }

      const ret = await client.query(models.get_meta_ads_accounts(), [empresa_id]);
      await client.query("COMMIT");
      return ret.rows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = execute;
