const express = require("express");
const axios = require("axios");
const rota = express.Router();
const security = require("../security/cypher");
const utils = require("../utils/templates");
const execute = require("../services/execute_meta_ig");
const {
  DEFAULT_GRAPH_VERSION,
  exchangeCodeForAccessToken,
  filterSelectedInstagramAccounts,
  getInstagramAssets,
  mountMetaIgStatus,
  normalizeInstagramIntegrationAccounts,
  normalizeMetaAccessTokenData
} = require("../functions/function_meta_ig");

const DEFAULT_IG_WEBHOOK_VERIFY_TOKEN =
  process.env.META_IG_WEBHOOK_VERIFY_TOKEN || "";
const ALLOWED_IG_ACCOUNT_INSIGHT_METRICS = new Set([
  "reach",
  "follower_count",
  "website_clicks",
  "profile_views",
  "online_followers",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
  "engaged_audience_demographics",
  "reached_audience_demographics",
  "follower_demographics",
  "follows_and_unfollows",
  "profile_links_taps",
  "views",
  "threads_likes",
  "threads_replies",
  "reposts",
  "quotes",
  "threads_followers",
  "threads_follower_demographics",
  "content_views",
  "threads_views",
  "threads_clicks",
  "threads_reposts"
]);
const IG_ACCOUNT_INSIGHT_TOTAL_VALUE_METRICS = new Set([
  "views",
  "profile_views",
  "accounts_engaged",
  "total_interactions",
  "website_clicks",
  "profile_links_taps",
  "follows_and_unfollows"
]);
const IG_ACCOUNT_INSIGHT_LIFETIME_PERIOD_METRICS = new Set([
  "online_followers"
]);
const DEFAULT_IG_ACCOUNT_INSIGHT_METRICS = [
  "reach",
  "follower_count",
  "accounts_engaged",
  "total_interactions",
  "website_clicks",
  "profile_links_taps",
  "follows_and_unfollows",
  "views",
  "profile_views"
];
function normalizeRequestedInsightMetric(metric) {
  const normalized = String(metric || "").trim().toLowerCase();
  if (!normalized) return null;

  // Compat aliases used in other dashboards/tools.
  if (normalized === "impressions") return "views";
  if (normalized === "link_clicks") return "website_clicks";

  return normalized;
}

function normalizeInsightItem(item) {
  if (!item || typeof item !== "object") return item;

  const hasValuesArray = Array.isArray(item.values);
  const totalValue = item?.total_value?.value;

  if (hasValuesArray || totalValue === undefined || totalValue === null) {
    return item;
  }

  // Normalize total_value metrics (views/profile_views) to the same shape used by other metrics.
  return {
    ...item,
    values: [
      {
        value: totalValue
      }
    ]
  };
}

async function getMetaIgAccessTokenForAccount(empresaId, igAccountId) {
  const rows = await execute.execute_get_meta_ig_account_by_ig_id(
    empresaId,
    igAccountId
  );

  const account = rows?.[0] || null;
  const accessToken =
    account?.meta_access_token ||
    account?.meta_payload?.access_token ||
    account?.meta_payload?.accessToken ||
    process.env.META_ACCESS_TOKEN ||
    null;

  if (!accessToken) {
    throw new Error(
      "Token da integracao Meta Instagram nao encontrado para a conta selecionada."
    );
  }

  return accessToken;
}

function normalizeIgComment(item) {
  const from = item?.from && typeof item.from === "object" ? item.from : null;
  const rawUsername = item?.username || from?.username || from?.name || null;
  const displayUsername =
    typeof rawUsername === "string" && /^\d+$/.test(rawUsername.trim())
      ? null
      : rawUsername;

  const replies = Array.isArray(item?.replies?.data)
    ? item.replies.data.map((reply) => {
      return {
        id: reply?.id || null,
        text: reply?.text || "",
        timestamp: reply?.timestamp || null,
        like_count: reply?.like_count ?? 0
      };
    })
    : [];

  return {
    legacy_instagram_comment_id: item?.legacy_instagram_comment_id || null,
    hidden: Boolean(item?.hidden),
    id: item?.id || null,
    like_count: item?.like_count ?? 0,
    media: item?.media?.id ? { id: item.media.id } : null,
    text: item?.text || "",
    timestamp: item?.timestamp || null,
    display_username: displayUsername,
    replies: {
      data: replies
    }
  };
}

async function refreshInstagramAccountPreview(account) {
  const igAccountId = String(account?.meta_instagram_business_account_id || "");
  const accessToken =
    account?.meta_access_token ||
    account?.meta_payload?.access_token ||
    account?.meta_payload?.accessToken ||
    null;

  if (!igAccountId || !accessToken) {
    return account;
  }

  try {
    const response = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${igAccountId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          fields: "id,username,name,profile_picture_url"
        }
      }
    );

    const remote = response?.data || {};

    return {
      ...account,
      meta_instagram_username:
        remote.username || account.meta_instagram_username || null,
      meta_instagram_name:
        remote.name || account.meta_instagram_name || null,
      meta_instagram_profile_picture_url:
        remote.profile_picture_url ||
        account.meta_instagram_profile_picture_url ||
        null,
    };
  } catch (error) {
    console.error(
      "[meta_ig/listar_contas] falha ao atualizar avatar da conta Instagram:",
      igAccountId,
      error?.response?.data || error?.message || error
    );
    return account;
  }
}

rota.post("/status_integracao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const rows = await execute.execute_get_meta_ig_accounts(data.empresa_id);
    return res.json(utils.jsonMount(true, mountMetaIgStatus(rows), ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/meta_ig/status_integracao"));
  }
});

rota.post("/listar_contas", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    const rows = await execute.execute_get_meta_ig_accounts(data.empresa_id);
    const refreshedRows = await Promise.all(
      (rows || []).map((row) => refreshInstagramAccountPreview(row))
    );
    return res.json(utils.jsonMount(true, refreshedRows, ""));
  } catch (error) {
    return res.json(utils.errorHandle(error, "/meta_ig/listar_contas"));
  }
});

rota.post("/validar_ativos", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
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
          "Dados insuficientes para validar os ativos do Instagram."
        )
      );
    }

    const availableAccounts = await getInstagramAssets(tokenData.access_token);
    const selectedAccounts = filterSelectedInstagramAccounts(availableAccounts, data);
    const accountsToReport = Array.isArray(data?.selected_instagram_account_ids) &&
      data.selected_instagram_account_ids.length
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
            page_id: account.page_id,
            page_name: account.page_name,
            business_id: account.business_id,
            business_name: account.business_name,
            instagram_business_account_id: account.instagram_business_account_id,
            instagram_username: account.instagram_username,
            instagram_name: account.instagram_name,
            instagram_profile_picture_url: account.instagram_profile_picture_url
          })),
          selected_accounts: selectedAccounts.map((account) => ({
            page_id: account.page_id,
            page_name: account.page_name,
            business_id: account.business_id,
            business_name: account.business_name,
            instagram_business_account_id: account.instagram_business_account_id,
            instagram_username: account.instagram_username,
            instagram_name: account.instagram_name,
            instagram_profile_picture_url: account.instagram_profile_picture_url
          }))
        },
        accountsToReport.length
          ? "A Meta retornou contas do Instagram para este acesso."
          : "A aprovacao foi concluida, mas nenhuma conta Instagram foi retornada."
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ig/validar_ativos:",
      error?.response?.data || error
    );
    return res.json(utils.errorHandle(error, "/meta_ig/validar_ativos"));
  }
});

rota.post("/salvar_integracao", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
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
          "Dados insuficientes para salvar a integracao do Instagram."
        )
      );
    }

    const availableAccounts = await getInstagramAssets(tokenData.access_token);
    const selectedAccounts = filterSelectedInstagramAccounts(availableAccounts, data);

    if (!selectedAccounts.length) {
      return res.json(
        utils.jsonMount(
          false,
          {
            selected_instagram_account_ids: data.selected_instagram_account_ids || [],
            available_accounts: availableAccounts
          },
          "Nenhuma conta Instagram valida foi encontrada para salvar."
        )
      );
    }

    const rows = await execute.execute_replace_meta_ig_accounts(
      data.empresa_id,
      normalizeInstagramIntegrationAccounts(selectedAccounts, tokenData)
    );

    return res.json(
      utils.jsonMount(
        true,
        {
          status: mountMetaIgStatus(rows),
          available_accounts: availableAccounts.map((account) => ({
            page_id: account.page_id,
            page_name: account.page_name,
            business_id: account.business_id,
            business_name: account.business_name,
            instagram_business_account_id: account.instagram_business_account_id,
            instagram_username: account.instagram_username,
            instagram_name: account.instagram_name
          }))
        },
        "Integracao das contas Instagram salva com sucesso."
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ig/salvar_integracao:",
      error?.response?.data || error
    );
    return res.json(utils.errorHandle(error, "/meta_ig/salvar_integracao"));
  }
});

rota.post("/conta_insights", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!data.instagram_business_account_id) {
      return res.json(
        utils.jsonMount(
          false,
          { campos_faltantes: ["instagram_business_account_id"] },
          "Informe instagram_business_account_id."
        )
      );
    }

    const accessToken = await getMetaIgAccessTokenForAccount(
      data.empresa_id,
      data.instagram_business_account_id
    );

    const requestedMetrics = Array.isArray(data.metrics) && data.metrics.length
      ? data.metrics
      : DEFAULT_IG_ACCOUNT_INSIGHT_METRICS;
    const metrics = [...new Set(
      requestedMetrics
        .map(normalizeRequestedInsightMetric)
        .filter((metric) => metric && ALLOWED_IG_ACCOUNT_INSIGHT_METRICS.has(metric))
    )];
    if (!metrics.length) {
      return res.json(
        utils.jsonMount(
          false,
          {
            metrics_recebidas: requestedMetrics,
            metrics_permitidas: [...ALLOWED_IG_ACCOUNT_INSIGHT_METRICS]
          },
          "Nenhuma metrica valida foi informada para insights da conta Instagram."
        )
      );
    }

    const period = data.period || "day";
    const requestedMetricType = String(data.metric_type || "").trim().toLowerCase();

    const requestGroups = new Map();

    metrics.forEach((metric) => {
      const metricType = IG_ACCOUNT_INSIGHT_TOTAL_VALUE_METRICS.has(metric)
        ? "total_value"
        : (requestedMetricType || "");
      const metricPeriod = IG_ACCOUNT_INSIGHT_LIFETIME_PERIOD_METRICS.has(metric)
        ? "lifetime"
        : period;
      const groupKey = `${metricPeriod}|${metricType || "default"}`;
      const existingGroup = requestGroups.get(groupKey) || {
        metrics: [],
        period: metricPeriod,
        metricType
      };

      existingGroup.metrics.push(metric);
      requestGroups.set(groupKey, existingGroup);
    });

    const insightsData = [];

    for (const group of requestGroups.values()) {
      const response = await axios.get(
        `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${data.instagram_business_account_id}/insights`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          params: {
            metric: group.metrics.join(","),
            period: group.period,
            ...(group.metricType ? { metric_type: group.metricType } : {})
          }
        }
      );

      insightsData.push(...(response?.data?.data || []));
    }
    const normalizedInsights = insightsData.map(normalizeInsightItem);

    return res.json(
      utils.jsonMount(
        true,
        {
          instagram_business_account_id: data.instagram_business_account_id,
          metrics,
          period,
          insights: normalizedInsights
        },
        ""
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ig/conta_insights:",
      error?.response?.data || error
    );
    return res.json(utils.errorHandle(error, "/meta_ig/conta_insights"));
  }
});

rota.post("/midias", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!data.instagram_business_account_id) {
      return res.json(
        utils.jsonMount(
          false,
          { campos_faltantes: ["instagram_business_account_id"] },
          "Informe instagram_business_account_id."
        )
      );
    }

    const accessToken = await getMetaIgAccessTokenForAccount(
      data.empresa_id,
      data.instagram_business_account_id
    );

    const mediaResponse = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${data.instagram_business_account_id}/media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          fields: [
            "id",
            "caption",
            "media_type",
            "media_url",
            "thumbnail_url",
            "permalink",
            "timestamp",
            "like_count",
            "comments_count",
            "children{media_type,media_url,thumbnail_url,permalink,id}"
          ].join(","),
          limit: data.limit || 25
        }
      }
    );

    return res.json(
      utils.jsonMount(
        true,
        {
          instagram_business_account_id: data.instagram_business_account_id,
          total: (mediaResponse?.data?.data || []).length,
          items: mediaResponse?.data?.data || [],
          paging: mediaResponse?.data?.paging || null
        },
        ""
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ig/midias:",
      error?.response?.data || error
    );
    return res.json(utils.errorHandle(error, "/meta_ig/midias"));
  }
});

rota.post("/midia_comentarios", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!data.instagram_business_account_id || !data.media_id) {
      return res.json(
        utils.jsonMount(
          false,
          { campos_faltantes: ["instagram_business_account_id", "media_id"] },
          "Informe instagram_business_account_id e media_id."
        )
      );
    }

    const accessToken = await getMetaIgAccessTokenForAccount(
      data.empresa_id,
      data.instagram_business_account_id
    );
    const commentsResponse = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${data.media_id}/comments`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          fields: [
            "id",
            "legacy_instagram_comment_id",
            "hidden",
            "media{id}",
            "text",
            "timestamp",
            "username",
            "from{id,username,name,profile_picture_url}",
            "like_count",
            "replies{id,text,timestamp,like_count}"
          ].join(","),
          limit: Number(data.limit) || 50
        }
      }
    );

    const normalizedItems = Array.isArray(commentsResponse?.data?.data)
      ? commentsResponse.data.data.map(normalizeIgComment)
      : [];

    return res.json(
      utils.jsonMount(
        true,
        {
          media_id: data.media_id,
          total: normalizedItems.length,
          items: normalizedItems,
          paging: commentsResponse?.data?.paging || null
        },
        ""
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ig/midia_comentarios:",
      error?.response?.data || error
    );
    return res.json(utils.errorHandle(error, "/meta_ig/midia_comentarios"));
  }
});

rota.post("/conta_resumo", async (req, res) => {
  try {
    const payload = req.body;
    const data = security.jwtdecript(payload);

    if (!data) {
      return res
        .status(401)
        .json(utils.jsonMount(false, {}, "Token invalido ou expirado."));
    }

    if (!data.instagram_business_account_id) {
      return res.json(
        utils.jsonMount(
          false,
          { campos_faltantes: ["instagram_business_account_id"] },
          "Informe instagram_business_account_id."
        )
      );
    }

    const accessToken = await getMetaIgAccessTokenForAccount(
      data.empresa_id,
      data.instagram_business_account_id
    );

    const accountInfoResponse = await axios.get(
      `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${data.instagram_business_account_id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          fields: [
            "id",
            "username",
            "name",
            "biography",
            "profile_picture_url",
            "followers_count",
            "follows_count",
            "media_count",
            "website"
          ].join(",")
        }
      }
    );

    let insights = [];
    try {
      const insightsResponse = await axios.get(
        `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/${data.instagram_business_account_id}/insights`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          params: {
            metric: DEFAULT_IG_ACCOUNT_INSIGHT_METRICS.join(","),
            period: "day"
          }
        }
      );
      insights = (insightsResponse?.data?.data || []).map(normalizeInsightItem);
    } catch (insightError) {
      insights = [];
    }

    return res.json(
      utils.jsonMount(
        true,
        {
          account: accountInfoResponse?.data || {},
          insights
        },
        ""
      )
    );
  } catch (error) {
    console.error(
      "Erro na rota /meta_ig/conta_resumo:",
      error?.response?.data || error
    );
    return res.json(utils.errorHandle(error, "/meta_ig/conta_resumo"));
  }
});

rota.get("/webhook", async (req, res) => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode !== "subscribe" || !token || !challenge) {
      return res.sendStatus(400);
    }

    if (token !== DEFAULT_IG_WEBHOOK_VERIFY_TOKEN) {
      return res.sendStatus(403);
    }

    return res.status(200).send(challenge);
  } catch (error) {
    console.error("Erro na validacao do webhook Meta IG:", error);
    return res.sendStatus(500);
  }
});

rota.post("/webhook", async (req, res) => {
  try {
    console.log("Webhook Meta IG recebido:", JSON.stringify(req.body));
    return res.sendStatus(200);
  } catch (error) {
    console.error("Erro na rota /meta_ig/webhook:", error);
    return res.sendStatus(500);
  }
});

module.exports = rota;
