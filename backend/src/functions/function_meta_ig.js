const axios = require("axios");
const {
  DEFAULT_GRAPH_VERSION,
  exchangeCodeForAccessToken,
  normalizeMetaAccessTokenData
} = require("./function_meta");

async function getInstagramAssets(accessToken) {
  if (!accessToken) {
    throw new Error("Token de acesso da Meta Instagram não informado.");
  }

  const response = await axios.get(
    `https://graph.facebook.com/${DEFAULT_GRAPH_VERSION}/me/accounts`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      params: {
        fields: [
          "id",
          "name",
          "access_token",
          "business{id,name}",
          "instagram_business_account{id,username,name,profile_picture_url}"
        ].join(","),
        limit: 500
      }
    }
  );

  const pages = Array.isArray(response?.data?.data) ? response.data.data : [];

  return pages
    .filter((page) => page?.instagram_business_account?.id)
    .map((page) => ({
      page_id: String(page.id),
      page_name: page.name || null,
      page_access_token: page.access_token || null,
      business_id: page?.business?.id || null,
      business_name: page?.business?.name || null,
      instagram_business_account_id: String(page.instagram_business_account.id),
      instagram_username: page?.instagram_business_account?.username || null,
      instagram_name: page?.instagram_business_account?.name || null,
      instagram_profile_picture_url:
        page?.instagram_business_account?.profile_picture_url || null,
      raw: page
    }));
}

function filterSelectedInstagramAccounts(accounts, payload) {
  const selectedIds = Array.isArray(payload?.selected_instagram_account_ids)
    ? payload.selected_instagram_account_ids.map((item) => String(item))
    : [];

  if (!selectedIds.length) {
    return accounts || [];
  }

  return (accounts || []).filter((account) =>
    selectedIds.includes(String(account?.instagram_business_account_id || ""))
  );
}

function normalizeInstagramIntegrationAccounts(accounts, tokenData = {}) {
  const tokenExpiresIn = Number(
    tokenData.expires_in || tokenData.token_expires_in || 0
  ) || null;
  const accessToken = tokenData.access_token || tokenData.accessToken || null;

  return (accounts || [])
    .map((account) => ({
      meta_business_id: account.business_id || null,
      meta_business_name: account.business_name || null,
      meta_page_id: account.page_id || null,
      meta_page_name: account.page_name || null,
      meta_instagram_business_account_id: account.instagram_business_account_id,
      meta_instagram_username: account.instagram_username || null,
      meta_instagram_name: account.instagram_name || null,
      meta_instagram_profile_picture_url:
        account.instagram_profile_picture_url || null,
      meta_graph_api_version: DEFAULT_GRAPH_VERSION,
      meta_access_token: accessToken,
      meta_access_token_type: tokenData.token_type || null,
      meta_token_expires_in: tokenExpiresIn,
      meta_access_token_expires_at: tokenExpiresIn
        ? new Date(Date.now() + tokenExpiresIn * 1000)
        : null,
      meta_payload: {
        ...account.raw,
        normalized_account: account,
        access_token: accessToken,
        token_type: tokenData.token_type || null,
        expires_in: tokenExpiresIn
      }
    }))
    .filter((account) => account.meta_instagram_business_account_id);
}

function mountMetaIgStatus(accounts) {
  const rows = accounts || [];

  return {
    conectado: rows.length > 0,
    pronto_para_uso: rows.length > 0,
    total_contas: rows.length,
    contas: rows.map((row) => ({
      id: row.id,
      empresa_id: row.empresa_id,
      business_id: row.meta_business_id,
      business_name: row.meta_business_name,
      page_id: row.meta_page_id,
      page_name: row.meta_page_name,
      instagram_business_account_id: row.meta_instagram_business_account_id,
      instagram_username: row.meta_instagram_username,
      instagram_name: row.meta_instagram_name,
      instagram_profile_picture_url: row.meta_instagram_profile_picture_url,
      graph_api_version: row.meta_graph_api_version,
      token_expires_at: row.meta_access_token_expires_at,
      last_embedded_signup_at: row.meta_last_embedded_signup_at
    }))
  };
}

module.exports = {
  DEFAULT_GRAPH_VERSION,
  exchangeCodeForAccessToken,
  filterSelectedInstagramAccounts,
  getInstagramAssets,
  mountMetaIgStatus,
  normalizeInstagramIntegrationAccounts,
  normalizeMetaAccessTokenData
};
