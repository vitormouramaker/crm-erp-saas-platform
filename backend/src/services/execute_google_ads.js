const models = require("../models/models_google_ads");
const { postgres } = require("../server/connect");
const { isRuntimeSchemaEnsureEnabled } = require("../utils/runtime_schema");

const RUNTIME_SCHEMA_ENSURE_GOOGLE_ADS = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SCHEMA_ENSURE_GOOGLE_ADS"
);

const execute = {
  execute_ensure_google_ads_schema: async (client) => {
    if (!RUNTIME_SCHEMA_ENSURE_GOOGLE_ADS) {
      return;
    }

    await client.query(models.ensure_empresa_google_ads_accounts_table());
    await client.query(models.ensure_empresa_google_ads_accounts_unique());
    await client.query(models.ensure_empresa_google_ads_accounts_empresa_fk());
  },

  execute_get_google_ads_accounts: async (empresa_id) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_google_ads_schema(client);
      const ret = await client.query(models.get_google_ads_accounts(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_google_ads_account_by_customer_id: async (empresa_id, customer_id) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_google_ads_schema(client);
      const ret = await client.query(models.get_google_ads_account_by_customer_id(), [
        empresa_id,
        customer_id,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_replace_google_ads_accounts: async (empresa_id, accounts) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_google_ads_schema(client);
      await client.query("BEGIN");

      const customerIds = (accounts || [])
        .map((account) => String(account.google_customer_id || "").trim())
        .filter(Boolean);

      if (customerIds.length) {
        await client.query(models.delete_google_ads_accounts_not_in(), [
          empresa_id,
          customerIds,
        ]);
      } else {
        await client.query(models.delete_all_google_ads_accounts(), [empresa_id]);
      }

      for (const account of accounts || []) {
        await client.query(models.upsert_google_ads_account(), [
          empresa_id,
          account.google_customer_id,
          account.google_customer_name,
          account.google_currency_code,
          account.google_time_zone,
          account.google_status,
          Boolean(account.google_manager),
          Boolean(account.google_test_account),
          account.google_resource_name,
          account.google_login_customer_id,
          account.google_access_token,
          account.google_refresh_token,
          account.google_token_type,
          account.google_token_scope,
          account.google_token_expires_in,
          account.google_access_token_expires_at,
          account.google_payload,
        ]);
      }

      const ret = await client.query(models.get_google_ads_accounts(), [empresa_id]);
      await client.query("COMMIT");
      return ret.rows;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  execute_remove_google_ads_account: async (empresa_id, customer_id) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_google_ads_schema(client);
      await client.query(models.delete_google_ads_account_by_customer_id(), [
        empresa_id,
        customer_id,
      ]);
      const ret = await client.query(models.get_google_ads_accounts(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_update_google_ads_account_tokens: async (empresa_id, customer_id, token_data) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_google_ads_schema(client);
      const ret = await client.query(models.update_google_ads_account_tokens(), [
        empresa_id,
        customer_id,
        token_data?.access_token || null,
        token_data?.refresh_token || null,
        token_data?.token_type || null,
        token_data?.scope || null,
        token_data?.expires_in || null,
        token_data?.access_token_expires_at || null,
      ]);
      return ret.rows;
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
