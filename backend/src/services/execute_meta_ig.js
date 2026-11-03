const models = require("../models/models_meta_ig");
const { postgres } = require("../server/connect");
const { isRuntimeSchemaEnsureEnabled } = require("../utils/runtime_schema");

const RUNTIME_SCHEMA_ENSURE_META_IG = isRuntimeSchemaEnsureEnabled(
  "RUNTIME_SCHEMA_ENSURE_META_IG"
);

const execute = {

  execute_ensure_meta_ig_schema: async (client) => {
    if (!RUNTIME_SCHEMA_ENSURE_META_IG) {
      return;
    }

    await client.query(models.ensure_empresa_meta_instagram_accounts_table());
    await client.query(models.ensure_empresa_meta_instagram_accounts_unique());
    await client.query(models.ensure_empresa_meta_instagram_accounts_empresa_index());
  },

  execute_get_meta_ig_accounts: async (empresa_id) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ig_schema(client);
      const ret = await client.query(models.get_meta_instagram_accounts(), [empresa_id]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_meta_ig_account_by_ig_id: async (empresa_id, ig_account_id) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ig_schema(client);
      const ret = await client.query(
        models.get_meta_instagram_account_by_ig_id(),
        [empresa_id, ig_account_id]
      );
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_replace_meta_ig_accounts: async (empresa_id, accounts) => {
    const client = await postgres.connect();

    try {
      await execute.execute_ensure_meta_ig_schema(client);
      await client.query("BEGIN");

      const accountIds = (accounts || [])
        .map((account) => String(account.meta_instagram_business_account_id || ""))
        .filter(Boolean);

      if (accountIds.length) {
        await client.query(models.delete_meta_instagram_accounts_not_in(), [
          empresa_id,
          accountIds
        ]);
      } else {
        await client.query(models.delete_all_meta_instagram_accounts(), [empresa_id]);
      }

      for (const account of accounts || []) {
        await client.query(models.upsert_meta_instagram_account(), [
          empresa_id,
          account.meta_business_id,
          account.meta_business_name,
          account.meta_page_id,
          account.meta_page_name,
          account.meta_instagram_business_account_id,
          account.meta_instagram_username,
          account.meta_instagram_name,
          account.meta_instagram_profile_picture_url,
          account.meta_graph_api_version,
          account.meta_access_token,
          account.meta_access_token_type,
          account.meta_token_expires_in,
          account.meta_access_token_expires_at,
          account.meta_payload
        ]);
      }

      const ret = await client.query(models.get_meta_instagram_accounts(), [empresa_id]);
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
