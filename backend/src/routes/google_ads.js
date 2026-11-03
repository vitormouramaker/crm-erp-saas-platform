const express = require("express");
const rota = express.Router();
const security = require("../security/cypher");
const utils = require("../utils/templates");
const execute = require("../services/execute_google_ads");
const {
  buildGoogleAdsOauthUrl,
  exchangeGoogleAdsCodeForTokens,
  filterSelectedGoogleAdsAccounts,
  generateGoogleAdsOauthState,
  getGoogleAdsAdGroupMetrics,
  getGoogleAdsAvailableAccounts,
  getGoogleAdsCampaignMetrics,
  getGoogleAdsDailyCampaignMetrics,
  getGoogleAdsKeywordMetrics,
  mountGoogleAdsStatus,
  normalizeGoogleAdsAccounts,
  normalizeGoogleAdsTokenData,
  refreshGoogleAdsAccessToken,
  resolveGoogleAdsDateRange,
  shouldRefreshGoogleAdsAccessToken,
  summarizeGoogleAdsMetricRows,
} = require("../functions/function_google_ads");

function getRequestData(req) {
  const payload = req.body;
  return security.jwtdecript(payload);
}

function mountMissingAuthDataResponse(message) {
  return utils.jsonMount(
    false,
    { campos_faltantes: ["code", "oauth_token", "redirect_uri"] },
    message
  );
}

function normalizeLinkedGoogleAdsAccount(row) {
  return {
    id: row.id,
    empresa_id: row.empresa_id,
    customer_id: row.google_customer_id,
    customer_name: row.google_customer_name,
    currency_code: row.google_currency_code,
    time_zone: row.google_time_zone,
    status: row.google_status,
    manager: row.google_manager,
    test_account: row.google_test_account,
    resource_name: row.google_resource_name,
    login_customer_id: row.google_login_customer_id,
    token_expires_at: row.google_access_token_expires_at,
    last_oauth_at: row.google_last_oauth_at,
  };
}

function isGoogleAdsAuthError(error) {
  const payload = error?.response?.data || error || {};
  const nestedError = payload?.error || {};
  const status = String(nestedError?.status || "").trim().toUpperCase();
  const code = Number(nestedError?.code || error?.response?.status || 0);
  return code === 401 || status === "UNAUTHENTICATED";
}

function getGoogleAdsFailureErrors(error) {
  const payload = error?.response?.data || error || {};
  const responseItems = Array.isArray(payload) ? payload : [payload];

  return responseItems.flatMap((item) => {
    const details = Array.isArray(item?.error?.details) ? item.error.details : [];
    return details.flatMap((detail) =>
      Array.isArray(detail?.errors) ? detail.errors : []
    );
  });
}

function getGoogleAdsFailureMessages(error) {
  const failureErrors = getGoogleAdsFailureErrors(error);
  const messages = failureErrors
    .map((item) => String(item?.message || "").trim())
    .filter(Boolean);

  if (messages.length) {
    return [...new Set(messages)];
  }

  const fallbackMessage = String(
    error?.response?.data?.error?.message || error?.message || ""
  ).trim();

  return fallbackMessage ? [fallbackMessage] : [];
}

function hasGoogleAdsFailureCode(error, code) {
  const targetCode = String(code || "").trim().toUpperCase();
  if (!targetCode) return false;

  return getGoogleAdsFailureErrors(error).some((item) =>
    Object.values(item?.errorCode || {}).some(
      (value) => String(value || "").trim().toUpperCase() === targetCode
    )
  );
}

function shouldSkipGoogleAdsMetricsError(error) {
  return (
    hasGoogleAdsFailureCode(error, "REQUESTED_METRICS_FOR_MANAGER") ||
    hasGoogleAdsFailureCode(error, "CUSTOMER_NOT_ENABLED") ||
    hasGoogleAdsFailureCode(error, "USER_PERMISSION_DENIED") ||
    hasGoogleAdsFailureCode(error, "CUSTOMER_NOT_FOUND") ||
    hasGoogleAdsFailureCode(error, "OPERATION_NOT_PERMITTED_FOR_CONTEXT")
  );
}

function buildGoogleAdsErrorDebug(error) {
  const payload = error?.response?.data || error || {};
  const failureErrors = getGoogleAdsFailureErrors(error);
  const failureMessages = getGoogleAdsFailureMessages(error);

  return {
    top_level: payload?.error || payload,
    failure_errors: failureErrors,
    failure_messages: failureMessages,
  };
}

function extractGoogleAdsRouteErrorMessage(error, fallbackMessage) {
  const failureMessages = getGoogleAdsFailureMessages(error);
  if (failureMessages.length) {
    return failureMessages.join(" | ");
  }

  return String(
    error?.response?.data?.error?.message ||
      error?.message ||
      fallbackMessage
  ).trim();
}

async function resolveGoogleAdsAccessTokenForMetrics(empresaId, accountRow) {
  const tokenData = normalizeGoogleAdsTokenData({
    access_token: accountRow.google_access_token,
    refresh_token: accountRow.google_refresh_token,
    token_type: accountRow.google_token_type,
    scope: accountRow.google_token_scope,
    expires_in: accountRow.google_token_expires_in,
  });

  if (tokenData.access_token && !shouldRefreshGoogleAdsAccessToken(accountRow)) {
    return tokenData;
  }

  if (!accountRow.google_refresh_token) {
    throw new Error(
      `Conta ${accountRow.google_customer_id} sem refresh token para atualizar acesso do Google Ads.`
    );
  }

  const refreshedToken = await refreshGoogleAdsAccessToken(
    accountRow.google_refresh_token
  );

  await execute.execute_update_google_ads_account_tokens(
    empresaId,
    accountRow.google_customer_id,
    refreshedToken
  );

  return refreshedToken;
}

rota.post("/status_integracao", async (req, res) => {
  try {
    const data = getRequestData(req);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const accounts = await execute.execute_get_google_ads_accounts(data.empresa_id);
    return res.json(utils.jsonMount(true, mountGoogleAdsStatus(accounts), ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/google_ads/status_integracao"));
  }
});

rota.post("/listar_contas", async (req, res) => {
  try {
    const data = getRequestData(req);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const accounts = await execute.execute_get_google_ads_accounts(data.empresa_id);
    return res.json(utils.jsonMount(true, accounts, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/google_ads/listar_contas"));
  }
});

rota.post("/oauth_url", async (req, res) => {
  try {
    const data = getRequestData(req);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const state = generateGoogleAdsOauthState();
    const oauthUrl = buildGoogleAdsOauthUrl({
      state,
      redirectUri: data.redirect_uri,
      loginHint: data.login_hint || data.email || null,
    });

    return res.json(utils.jsonMount(true, oauthUrl, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/google_ads/oauth_url"));
  }
});

rota.post("/validar_ativos", async (req, res) => {
  try {
    const data = getRequestData(req);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    let tokenData = normalizeGoogleAdsTokenData({
      access_token: data.access_token || data.accessToken,
      refresh_token: data.refresh_token || data.refreshToken,
      token_type: data.token_type || data.tokenType,
      scope: data.scope,
      expires_in: data.expires_in || data.token_expires_in,
    });

    if (!tokenData.access_token && data.code) {
      tokenData = await exchangeGoogleAdsCodeForTokens(data.code, data.redirect_uri);
    }

    if (!tokenData.access_token) {
      return res.json(
        mountMissingAuthDataResponse(
          "Dados insuficientes para validar as contas liberadas no Google Ads."
        )
      );
    }

    const availableAccounts = await getGoogleAdsAvailableAccounts(tokenData);
    const selectedAccounts = filterSelectedGoogleAdsAccounts(availableAccounts, data);
    const accountsToReport =
      Array.isArray(data?.selected_customer_ids) && data.selected_customer_ids.length
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
          scope: tokenData.scope || null,
          oauth_token: {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_type: tokenData.token_type || null,
            scope: tokenData.scope || null,
            expires_in: tokenData.expires_in || null,
          },
          available_accounts: availableAccounts,
          selected_accounts: selectedAccounts,
        },
        accountsToReport.length
          ? "O Google Ads retornou contas acessiveis para este login."
          : "A autenticacao foi concluida, mas o Google Ads nao retornou contas acessiveis para este usuario."
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /google_ads/validar_ativos:",
      JSON.stringify(buildGoogleAdsErrorDebug(error), null, 2)
    );
    return res.json(
      utils.jsonMount(
        false,
        {},
        extractGoogleAdsRouteErrorMessage(
          error,
          "Nao foi possivel validar as contas liberadas no Google Ads."
        )
      )
    );
  }
});

rota.post("/salvar_integracao", async (req, res) => {
  try {
    const data = getRequestData(req);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    let tokenData = normalizeGoogleAdsTokenData({
      access_token: data.access_token || data.accessToken,
      refresh_token: data.refresh_token || data.refreshToken,
      token_type: data.token_type || data.tokenType,
      scope: data.scope,
      expires_in: data.expires_in || data.token_expires_in,
    });

    if (!tokenData.access_token && data.code) {
      tokenData = await exchangeGoogleAdsCodeForTokens(data.code, data.redirect_uri);
    }

    if (!tokenData.access_token) {
      return res.json(
        mountMissingAuthDataResponse(
          "Dados insuficientes para salvar a integracao do Google Ads."
        )
      );
    }

    const availableAccounts = await getGoogleAdsAvailableAccounts(tokenData);
    const selectedAccounts = filterSelectedGoogleAdsAccounts(availableAccounts, data);

    if (!selectedAccounts.length) {
      return res.json(
        utils.jsonMount(
          false,
          {
            selected_customer_ids: data.selected_customer_ids || [],
            available_accounts: availableAccounts,
          },
          "Nenhuma conta valida do Google Ads foi encontrada para salvar."
        )
      );
    }

    const rows = await execute.execute_replace_google_ads_accounts(
      data.empresa_id,
      normalizeGoogleAdsAccounts(selectedAccounts, tokenData)
    );

    return res.json(
      utils.jsonMount(
        true,
        {
          status: mountGoogleAdsStatus(rows),
          available_accounts: availableAccounts,
        },
        "Integracao do Google Ads salva com sucesso."
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /google_ads/salvar_integracao:",
      JSON.stringify(buildGoogleAdsErrorDebug(error), null, 2)
    );
    return res.json(
      utils.jsonMount(
        false,
        {},
        extractGoogleAdsRouteErrorMessage(
          error,
          "Nao foi possivel salvar a integracao do Google Ads."
        )
      )
    );
  }
});

rota.post("/remover_conta", async (req, res) => {
  try {
    const data = getRequestData(req);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const customerId = String(data.customer_id || "").replace(/\D/g, "");
    if (!customerId) {
      return res.json(
        utils.jsonMount(
          false,
          { campo: "customer_id" },
          "Informe a conta Google Ads que deve ser removida."
        )
      );
    }

    const rows = await execute.execute_remove_google_ads_account(
      data.empresa_id,
      customerId
    );

    return res.json(
      utils.jsonMount(
        true,
        {
          status: mountGoogleAdsStatus(rows),
          contas: rows.map((row) => normalizeLinkedGoogleAdsAccount(row)),
        },
        "Conta do Google Ads removida com sucesso."
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /google_ads/remover_conta:",
      error?.response?.data || error
    );
    return res.json(utils.errorHandle(error, "/google_ads/remover_conta"));
  }
});

rota.post("/metricas", async (req, res) => {
  try {
    const data = getRequestData(req);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const period = resolveGoogleAdsDateRange({
      startDate: data.start_date,
      endDate: data.end_date,
    });

    const linkedAccounts = await execute.execute_get_google_ads_accounts(data.empresa_id);
    if (!linkedAccounts.length) {
      return res.json(
        utils.jsonMount(
          true,
          {
            period,
            linked_accounts: [],
            account_summaries: [],
            campaigns: [],
            ad_groups: [],
            keywords: [],
            daily_performance: [],
            summary: summarizeGoogleAdsMetricRows([]),
            warnings: [],
            total_accounts: 0,
            total_campaigns: 0,
            total_ad_groups: 0,
            total_keywords: 0,
            total_daily_rows: 0,
          },
          "Nenhuma conta Google Ads vinculada para esta empresa."
        )
      );
    }

    const requestedCustomerId = String(data.customer_id || "").replace(/\D/g, "");
    const targetAccounts = requestedCustomerId
      ? linkedAccounts.filter(
          (account) => String(account.google_customer_id || "") === requestedCustomerId
        )
      : linkedAccounts;

    const accountSummaries = [];
    const campaigns = [];
    const adGroups = [];
    const keywords = [];
    const dailyPerformance = [];
    const warnings = [];

    for (const account of targetAccounts) {
      if (account.google_manager) {
        warnings.push({
          customer_id: account.google_customer_id,
          message:
            "Conta gerente ignorada na consulta de metricas. Consulte as contas clientes vinculadas a ela.",
        });
        continue;
      }

      let tokenData = await resolveGoogleAdsAccessTokenForMetrics(
        data.empresa_id,
        account
      );

      let metricsResult = null;
      let adGroupResult = null;
      let keywordResult = null;
      let dailyResult = null;

      try {
        metricsResult = await getGoogleAdsCampaignMetrics({
          accessToken: tokenData.access_token,
          customerId: account.google_customer_id,
          loginCustomerId: account.google_login_customer_id,
          startDate: period.start_date,
          endDate: period.end_date,
        });
        adGroupResult = await getGoogleAdsAdGroupMetrics({
          accessToken: tokenData.access_token,
          customerId: account.google_customer_id,
          loginCustomerId: account.google_login_customer_id,
          startDate: period.start_date,
          endDate: period.end_date,
        });
        keywordResult = await getGoogleAdsKeywordMetrics({
          accessToken: tokenData.access_token,
          customerId: account.google_customer_id,
          loginCustomerId: account.google_login_customer_id,
          startDate: period.start_date,
          endDate: period.end_date,
        });
        dailyResult = await getGoogleAdsDailyCampaignMetrics({
          accessToken: tokenData.access_token,
          customerId: account.google_customer_id,
          loginCustomerId: account.google_login_customer_id,
          startDate: period.start_date,
          endDate: period.end_date,
        });
      } catch (error) {
        if (!isGoogleAdsAuthError(error) || !account.google_refresh_token) {
          if (shouldSkipGoogleAdsMetricsError(error)) {
            warnings.push({
              customer_id: account.google_customer_id,
              message:
                getGoogleAdsFailureMessages(error)[0] ||
                "Conta Google Ads ignorada por restricao da API.",
            });
            continue;
          }

          throw error;
        }

        try {
          tokenData = await refreshGoogleAdsAccessToken(account.google_refresh_token);
          await execute.execute_update_google_ads_account_tokens(
            data.empresa_id,
            account.google_customer_id,
            tokenData
          );

          metricsResult = await getGoogleAdsCampaignMetrics({
            accessToken: tokenData.access_token,
            customerId: account.google_customer_id,
            loginCustomerId: account.google_login_customer_id,
            startDate: period.start_date,
            endDate: period.end_date,
          });
          adGroupResult = await getGoogleAdsAdGroupMetrics({
            accessToken: tokenData.access_token,
            customerId: account.google_customer_id,
            loginCustomerId: account.google_login_customer_id,
            startDate: period.start_date,
            endDate: period.end_date,
          });
          keywordResult = await getGoogleAdsKeywordMetrics({
            accessToken: tokenData.access_token,
            customerId: account.google_customer_id,
            loginCustomerId: account.google_login_customer_id,
            startDate: period.start_date,
            endDate: period.end_date,
          });
          dailyResult = await getGoogleAdsDailyCampaignMetrics({
            accessToken: tokenData.access_token,
            customerId: account.google_customer_id,
            loginCustomerId: account.google_login_customer_id,
            startDate: period.start_date,
            endDate: period.end_date,
          });
        } catch (retryError) {
          if (shouldSkipGoogleAdsMetricsError(retryError)) {
            warnings.push({
              customer_id: account.google_customer_id,
              message:
                getGoogleAdsFailureMessages(retryError)[0] ||
                "Conta Google Ads ignorada por restricao da API.",
            });
            continue;
          }

          throw retryError;
        }
      }

      const normalizedAccount = normalizeLinkedGoogleAdsAccount(account);
      const accountCampaigns = Array.isArray(metricsResult?.campaigns)
        ? metricsResult.campaigns.map((campaign) => ({
            ...campaign,
            customer_id: normalizedAccount.customer_id,
            customer_name:
              campaign.customer_name || normalizedAccount.customer_name || normalizedAccount.customer_id,
            currency_code: normalizedAccount.currency_code,
            time_zone: normalizedAccount.time_zone,
          }))
        : [];
      const accountAdGroups = Array.isArray(adGroupResult?.ad_groups)
        ? adGroupResult.ad_groups.map((adGroup) => ({
            ...adGroup,
            customer_id: normalizedAccount.customer_id,
            customer_name:
              adGroup.customer_name || normalizedAccount.customer_name || normalizedAccount.customer_id,
            currency_code: normalizedAccount.currency_code,
            time_zone: normalizedAccount.time_zone,
          }))
        : [];
      const accountKeywords = Array.isArray(keywordResult?.keywords)
        ? keywordResult.keywords.map((keyword) => ({
            ...keyword,
            customer_id: normalizedAccount.customer_id,
            customer_name:
              keyword.customer_name || normalizedAccount.customer_name || normalizedAccount.customer_id,
            currency_code: normalizedAccount.currency_code,
            time_zone: normalizedAccount.time_zone,
          }))
        : [];
      const accountDailyRows = Array.isArray(dailyResult?.daily_performance)
        ? dailyResult.daily_performance.map((dayRow) => ({
            ...dayRow,
            customer_id: normalizedAccount.customer_id,
            customer_name:
              dayRow.customer_name || normalizedAccount.customer_name || normalizedAccount.customer_id,
            currency_code: normalizedAccount.currency_code,
            time_zone: normalizedAccount.time_zone,
          }))
        : [];

      campaigns.push(...accountCampaigns);
      adGroups.push(...accountAdGroups);
      keywords.push(...accountKeywords);
      dailyPerformance.push(...accountDailyRows);
      accountSummaries.push({
        ...normalizedAccount,
        summary: metricsResult?.summary || summarizeGoogleAdsMetricRows([]),
        total_campaigns: accountCampaigns.length,
        total_ad_groups: accountAdGroups.length,
        total_keywords: accountKeywords.length,
      });
    }

    const sortedAccountSummaries = accountSummaries.sort((left, right) => {
      const rightCost = Number(right?.summary?.cost || 0);
      const leftCost = Number(left?.summary?.cost || 0);
      return rightCost - leftCost;
    });

    const sortedCampaigns = campaigns.sort((left, right) => {
      const rightCost = Number(right?.cost || 0);
      const leftCost = Number(left?.cost || 0);
      if (rightCost !== leftCost) return rightCost - leftCost;
      return Number(right?.clicks || 0) - Number(left?.clicks || 0);
    });
    const sortedAdGroups = adGroups.sort((left, right) => {
      const rightCost = Number(right?.cost || 0);
      const leftCost = Number(left?.cost || 0);
      if (rightCost !== leftCost) return rightCost - leftCost;
      return Number(right?.clicks || 0) - Number(left?.clicks || 0);
    });
    const sortedKeywords = keywords.sort((left, right) => {
      const rightCost = Number(right?.cost || 0);
      const leftCost = Number(left?.cost || 0);
      if (rightCost !== leftCost) return rightCost - leftCost;
      return Number(right?.clicks || 0) - Number(left?.clicks || 0);
    });
    const sortedDailyRows = dailyPerformance.sort((left, right) => {
      const dateDiff = String(right?.date || "").localeCompare(String(left?.date || ""));
      if (dateDiff !== 0) return dateDiff;
      return Number(right?.cost || 0) - Number(left?.cost || 0);
    });

    return res.json(
      utils.jsonMount(
        true,
        {
          period,
          linked_accounts: linkedAccounts.map((account) =>
            normalizeLinkedGoogleAdsAccount(account)
          ),
          account_summaries: sortedAccountSummaries,
          campaigns: sortedCampaigns,
          ad_groups: sortedAdGroups,
          keywords: sortedKeywords,
          daily_performance: sortedDailyRows,
          summary: summarizeGoogleAdsMetricRows(sortedCampaigns),
          warnings,
          total_accounts: sortedAccountSummaries.length,
          total_campaigns: sortedCampaigns.length,
          total_ad_groups: sortedAdGroups.length,
          total_keywords: sortedKeywords.length,
          total_daily_rows: sortedDailyRows.length,
        },
        sortedCampaigns.length
          ? "Metricas do Google Ads carregadas com sucesso."
          : "Nenhuma metrica encontrada para o periodo selecionado."
      )
    );
  } catch (error) {
    console.error("Erro na rota /google_ads/metricas:", error?.response?.data || error);
    return res.json(utils.errorHandle(error, "/google_ads/metricas"));
  }
});

module.exports = rota;
