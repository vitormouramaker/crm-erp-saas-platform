const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const utils = require("../utils/templates");
const execute = require("../services/execute_meta_ads");
const {
  normalizeMetaAccessTokenData
} = require("../functions/function_meta");
const {
  exchangeCodeForAccessToken,
  filterSelectedAdAccounts,
  getMetaAdsAccounts,
  getMetaAdsFormLeads,
  getMetaAdsLeadForms,
  getMetaPages,
  mountMetaAdsStatus,
  normalizeMetaLead,
  normalizeMetaAdsAccounts
} = require("../functions/function_meta_ads");

function extractMetaAdsErrorMessage(error, fallbackMessage) {
  const metaError =
    error?.response?.data?.error && typeof error.response.data.error === "object"
      ? error.response.data.error
      : error?.response?.data || error || {};

  return String(
    metaError?.error_user_msg ||
      metaError?.error_data?.details ||
      metaError?.message ||
      error?.message ||
      fallbackMessage
  ).trim();
}

rota.post("/status_integracao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    const accounts = await execute.execute_get_meta_ads_accounts(data.empresa_id);
    return res.json(utils.jsonMount(true, mountMetaAdsStatus(accounts), ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/meta_ads/status_integracao"));
  }
});

rota.post("/listar_contas", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    const accounts = await execute.execute_get_meta_ads_accounts(data.empresa_id);
    return res.json(utils.jsonMount(true, accounts, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/meta_ads/listar_contas"));
  }
});

rota.post("/validar_ativos", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }

    let tokenData = {
      access_token: data.access_token || data.accessToken || null,
      token_type: data.token_type || null,
      expires_in: data.expires_in || data.token_expires_in || null
    };

    if (data.signupCode) {
      tokenData = await exchangeCodeForAccessToken(
        data.signupCode,
        data.redirect_uri
      );
    }

    tokenData = await normalizeMetaAccessTokenData(tokenData);

    if (!tokenData.access_token) {
      return res.json(
        utils.jsonMount(
          false,
          { campos_faltantes: ["access_token"] },
          "Dados insuficientes para validar os ativos liberados pela Meta Ads."
        )
      );
    }

    const response = await getMetaAdsAccounts(tokenData.access_token);
    const availableAccounts = Array.isArray(response?.data) ? response.data : [];
    const selectedAccounts = filterSelectedAdAccounts(availableAccounts, data);
    const accountsToReport = Array.isArray(data?.selected_ad_account_ids) &&
      data.selected_ad_account_ids.length
      ? selectedAccounts
      : availableAccounts;

    return res.json(
      utils.jsonMount(
        true,
        {
          liberado: accountsToReport.length > 0,
          total_contas: accountsToReport.length,
          token_type: tokenData.token_type || null,
          expires_in: tokenData.expires_in || null,
          available_accounts: availableAccounts.map((account) => ({
            id: account.id,
            name: account.name,
            account_status: account.account_status,
            currency: account.currency || null,
            timezone_name: account.timezone_name || null,
            business: account.business || null
          })),
          selected_accounts: selectedAccounts.map((account) => ({
            id: account.id,
            name: account.name,
            account_status: account.account_status,
            currency: account.currency || null,
            timezone_name: account.timezone_name || null,
            business: account.business || null
          }))
        },
        accountsToReport.length
          ? "A Meta já retornou contas de anúncio liberadas para este acesso."
          : "A aprovação foi concluída, mas a Meta ainda não retornou contas de anúncio liberadas para este acesso."
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ads/validar_ativos:",
      error?.response?.data || error
    );
    return res.json(
      utils.jsonMount(
        false,
        {},
        extractMetaAdsErrorMessage(
          error,
          "Nao foi possivel validar os ativos liberados pela Meta Ads."
        )
      )
    );
  }
});

rota.post("/salvar_integracao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }
    let tokenData = {
      access_token: data.access_token || data.accessToken || null,
      token_type: data.token_type || null,
      expires_in: data.expires_in || data.token_expires_in || null
    };

    if (data.signupCode) {
      tokenData = await exchangeCodeForAccessToken(
        data.signupCode,
        data.redirect_uri
      );
    }

    tokenData = await normalizeMetaAccessTokenData(tokenData);

    if (!tokenData.access_token) {
      return res.json(
        utils.jsonMount(
          false,
          { campos_faltantes: ["access_token"] },
          "Dados insuficientes para salvar a integração das contas de anúncio da Meta."
        )
      );
    }

    const response = await getMetaAdsAccounts(tokenData.access_token);
    const availableAccounts = Array.isArray(response?.data) ? response.data : [];
    const selectedAccounts = filterSelectedAdAccounts(availableAccounts, data);
    if (!selectedAccounts.length) {
      return res.json(
        utils.jsonMount(
          false,
          {
            selected_ad_account_ids: data.selected_ad_account_ids || [],
            available_accounts: availableAccounts
          },
          "Nenhuma conta de anúncio válida foi encontrada para salvar."
        )
      );
    }

    const rows = await execute.execute_replace_meta_ads_accounts(
      data.empresa_id,
      normalizeMetaAdsAccounts(selectedAccounts, tokenData)
    );

    return res.json(
      utils.jsonMount(
        true,
        {
          status: mountMetaAdsStatus(rows),
          available_accounts: availableAccounts.map((account) => ({
            id: account.id,
            name: account.name,
            account_status: account.account_status,
            business: account.business || null
          }))
        },
        "Integração das contas de anúncio da Meta salva com sucesso."
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ads/salvar_integracao:",
      error?.response?.data || error
    );
    return res.json(
      utils.jsonMount(
        false,
        {},
        extractMetaAdsErrorMessage(
          error,
          "Nao foi possivel salvar a integracao da Meta Ads."
        )
      )
    );
  }
});


rota.post('/campanhas', async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }
    const campaings = await utils.getCampaigns(
      data.empresa_id,
      data.act_ad_account,
      data?.filtro,
      data.inicio,
      data.fim
    )
    return res.json(
      utils.jsonMount(
        true,
        campaings,
        ''
      )
    )
  } catch (error) {
    console.error(
      "Erro na rota /meta_ads/campanhas:",
      error?.response?.data || error
    );
    return res.json(utils.metaAdsErrorHandle(error, "/meta_ads/campanhas"));
  }
})


rota.post('/ads', async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }
    const campaing = data.campanha_id
    const adAccountId = data.act_ad_account || data.ad_account_id || null;

    if (!adAccountId) {
      return res.json(
        utils.jsonMount(
          false,
          { campos_faltantes: ["act_ad_account"] },
          "Informe act_ad_account ou ad_account_id para consultar os anúncios."
        )
      );
    }

    const meta = await utils.getAds(
      data.empresa_id,
      adAccountId,
      campaing
    )
    return res.json(utils.jsonMount(true, meta, ''))
  } catch (error) {
    console.error(
      "Erro na rota /meta_ads/ads:",
      error?.response?.data || error
    );
    return res.json(utils.metaAdsErrorHandle(error, "/meta_ads/ads"));
  }
})


rota.post('/campanhas/filtro', async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token inválido ou expirado."));
    }
    const result = await utils.getCampaignsMinusOne(
      data.campanha_id,
      data.inicio,
      data.fim
    )
    return res.json(utils.jsonMount(true, result, ''))
  } catch (error) {
    console.error(
      "Erro na rota /meta_ads/campanhas:",
      error?.response?.data || error
    );
    return res.json(utils.metaAdsErrorHandle(error, "/meta_ads/campanhas"));
  }
})

rota.post("/formularios", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const adAccountId = String(data.ad_account_id || data.act_ad_account || "").trim();
    if (!adAccountId) {
      return res.json(
        utils.jsonMount(
          false,
          { campos_faltantes: ["ad_account_id"] },
          "Informe a conta de anuncios para listar os formularios."
        )
      );
    }

    const accountRows = await execute.execute_get_meta_ads_account_by_ad_account_id(
      data.empresa_id,
      adAccountId
    );
    const account = accountRows?.[0] || null;

    if (!account?.meta_access_token) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "A conta de anuncios selecionada nao possui token salvo para consultar os formularios."
        )
      );
    }

    const forms = await getMetaAdsLeadForms(account.meta_access_token, adAccountId);
    return res.json(utils.jsonMount(true, forms, ""));
  } catch (error) {
    console.error(
      "Erro na rota /meta_ads/formularios:",
      error?.response?.data || error
    );
    return res.json(utils.metaAdsErrorHandle(error, "/meta_ads/formularios"));
  }
});

rota.post("/mapeamento_campos", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mapping = await execute.execute_get_meta_ads_field_mapping({
      empresa_id: data.empresa_id,
      escopo_tipo: data.escopo_tipo,
      escopo_id: data.escopo_id,
    });

    return res.json(utils.jsonMount(true, mapping || {}, ""));
  } catch (error) {
    console.error(
      "Erro na rota /meta_ads/mapeamento_campos:",
      error?.response?.data || error
    );
    return res.json(utils.metaAdsErrorHandle(error, "/meta_ads/mapeamento_campos"));
  }
});

rota.post("/salvar_mapeamento_campos", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const mapping = await execute.execute_save_meta_ads_field_mapping({
      empresa_id: data.empresa_id,
      escopo_tipo: data.escopo_tipo,
      escopo_id: data.escopo_id,
      escopo_nome: data.escopo_nome,
      campo_nome: data.campo_nome,
      campo_telefone: data.campo_telefone,
      campo_email: data.campo_email,
    });

    return res.json(
      utils.jsonMount(true, mapping || {}, "Mapeamento de campos salvo com sucesso.")
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ads/salvar_mapeamento_campos:",
      error?.response?.data || error
    );
    return res.json(utils.metaAdsErrorHandle(error, "/meta_ads/salvar_mapeamento_campos"));
  }
});

rota.post("/formularios/leads", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const adAccountId = String(data.ad_account_id || data.act_ad_account || "").trim();
    const formId = String(data.form_id || "").trim();
    const formName = String(data.form_name || "").trim() || null;
    const pageId = String(data.page_id || "").trim() || null;
    const limit = Math.max(1, Math.min(Number(data.limit) || 100, 200));

    if (!adAccountId || !formId) {
      return res.json(
        utils.jsonMount(
          false,
          { campos_faltantes: ["ad_account_id", "form_id"] },
          "Informe a conta de anuncios e o formulario para consultar os leads."
        )
      );
    }

    const accountRows = await execute.execute_get_meta_ads_account_by_ad_account_id(
      data.empresa_id,
      adAccountId
    );
    const account = accountRows?.[0] || null;

    if (!account?.meta_access_token) {
      return res.json(
        utils.jsonMount(
          false,
          {},
          "A conta de anuncios selecionada nao possui token salvo para consultar os leads."
        )
      );
    }

    let tokenForLeadRetrieval = account.meta_access_token;

    if (pageId) {
      const pages = await getMetaPages(account.meta_access_token);
      const matchedPage = pages.find(
        (page) => String(page?.id || "").trim() === pageId
      );
      if (matchedPage?.access_token) {
        tokenForLeadRetrieval = matchedPage.access_token;
      }
    }

    const rawLeads = await getMetaAdsFormLeads(tokenForLeadRetrieval, formId, limit);
    const mappings = await execute.execute_get_meta_ads_field_mappings({
      empresa_id: data.empresa_id,
      form_ids: [formId],
      campaign_ids: rawLeads.map((lead) => String(lead?.campaign_id || "").trim()).filter(Boolean),
    });
    const formMappings = new Map(
      mappings
        .filter((mapping) => String(mapping.escopo_tipo || "").trim() === "form")
        .map((mapping) => [String(mapping.escopo_id || ""), mapping])
    );
    const campaignMappings = new Map(
      mappings
        .filter((mapping) => String(mapping.escopo_tipo || "").trim() === "campaign")
        .map((mapping) => [String(mapping.escopo_id || ""), mapping])
    );
    const normalizedLeads = rawLeads
      .map((lead) => {
        const campaignId = String(lead?.campaign_id || "").trim();
        const appliedMapping =
          (campaignId ? campaignMappings.get(campaignId) : null) ||
          formMappings.get(formId) ||
          null;

        return normalizeMetaLead(
          lead,
          { id: formId, name: formName },
          appliedMapping
        );
      })
      .filter((lead) => lead.id);

    const importedRows = await execute.execute_get_cliente_meta_ads_leads_by_ids(
      data.empresa_id,
      normalizedLeads.map((lead) => lead.id)
    );
    const importedMap = new Map(
      importedRows.map((row) => [String(row.meta_lead_id), row])
    );

    return res.json(
      utils.jsonMount(
        true,
        normalizedLeads.map((lead) => {
          const imported = importedMap.get(String(lead.id));
          return {
            ...lead,
            imported: Boolean(imported),
            imported_cliente_id: imported?.cliente_id || null,
            imported_at: imported?.created_at || null,
            mapping_applied:
              (lead.campaign_id ? campaignMappings.get(String(lead.campaign_id)) : null) ||
              formMappings.get(formId) ||
              null,
          };
        }),
        ""
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ads/formularios/leads:",
      error?.response?.data || error
    );
    return res.json(utils.metaAdsErrorHandle(error, "/meta_ads/formularios/leads"));
  }
});

rota.post("/importar_leads", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invÃ¡lido ou expirado."));
    }

    const resultado = await execute.execute_import_meta_ads_leads({
      empresa_id: data.empresa_id,
      meta_ads_account_id: data.ad_account_id || data.act_ad_account,
      crm_id: data.crm_id || data.crmId || null,
      form_id: data.form_id || null,
      form_name: data.form_name || null,
      leads: Array.isArray(data.leads) ? data.leads : [],
    });

    return res.json(
      utils.jsonMount(true, resultado, "Leads da Meta Ads importados com sucesso.")
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ads/importar_leads:",
      error?.response?.data || error
    );
    return res.json(utils.metaAdsErrorHandle(error, "/meta_ads/importar_leads"));
  }
});


module.exports = rota;
