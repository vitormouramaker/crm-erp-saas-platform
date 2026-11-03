#!/usr/bin/env node
/**
 * Cria o banco (se nao existir), aplica o schema num banco vazio e roda as
 * migracoes de db/migrations em ordem, registrando cada uma em
 * schema_migrations. Pode ser executado varias vezes.
 *
 *   npm run db:init
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
};
const database = process.env.DB_NAME || "orbita_crm";
const dbDir = path.join(__dirname, "..", "db");

async function ensureDatabase() {
  const admin = new Client({ ...config, database: process.env.DB_ADMIN_DATABASE || "postgres" });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (!exists.rows.length) {
      if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error(`Nome de banco invalido: ${database}`);
      await admin.query(`CREATE DATABASE ${database} ENCODING 'UTF8' TEMPLATE template0`);
      console.log(`[db] banco ${database} criado`);
    }
  } finally {
    await admin.end();
  }
}

async function applySchemaIfEmpty() {
  const client = new Client({ ...config, database });
  await client.connect();
  try {
    const ret = await client.query("SELECT to_regclass('public.usuario') AS t");
    if (ret.rows[0].t) {
      console.log("[db] schema ja existe, pulando schema.sql");
      return;
    }
    console.log("[db] aplicando db/schema.sql ...");
    await client.query(fs.readFileSync(path.join(dbDir, "schema.sql"), "utf8"));
  } finally {
    // conexao propria: o dump troca o search_path da sessao
    await client.end();
  }
}

async function applyMigrations() {
  const client = new Client({ ...config, database });
  await client.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
    );
    const done = new Set((await client.query("SELECT name FROM public.schema_migrations")).rows.map((r) => r.name));
    const files = fs
      .readdirSync(path.join(dbDir, "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (done.has(file)) continue;
      console.log(`[db] migracao ${file}`);
      await client.query(fs.readFileSync(path.join(dbDir, "migrations", file), "utf8"));
      await client.query("INSERT INTO public.schema_migrations (name) VALUES ($1)", [file]);
    }
  } finally {
    await client.end();
  }
}

(async () => {
  await ensureDatabase();
  await applySchemaIfEmpty();
  await applyMigrations();
  console.log(`[db] pronto: ${database}@${config.host}:${config.port}`);
})().catch((error) => {
  console.error("[db] falhou:", error.message);
  process.exit(1);
});
