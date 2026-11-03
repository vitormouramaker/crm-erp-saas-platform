#!/usr/bin/env node
/**
 * Contas e dados de DEMONSTRACAO, so para rodar localmente.
 *
 *   npm run seed:demo
 *
 * Cria os planos (Basico, Business, Enterprise), duas empresas ficticias e
 * usuarios com a senha local Demo@123. A segunda empresa existe para testar o
 * isolamento entre empresas (multi-tenant). Recusa rodar com NODE_ENV=production.
 * Se as contas ja existirem, nao faz nada.
 */
require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");

if (process.env.NODE_ENV === "production") {
  console.error("[seed] recusado: NODE_ENV=production. Este seed cria contas com senha conhecida.");
  process.exit(1);
}

const DEMO_PASSWORD = "Demo@123";
const ADMIN_EMAIL = "admin@demo.orbita.test";

const BASE = [
  "users.manage", "settings.view", "subscription.manage", "dashboard.view",
  "commercial.view", "commercial.manager", "contacts.view", "contacts.view_all",
  "chat.view", "chat.manager", "chat.view_all_messages", "reports.nps.view",
  "commercial.pipeline", "commercial.scheduled_dispatches", "commercial.dashbord",
  "commercial.report", "settings.quick_messages", "settings.tags", "settings.branches",
  "settings.categories", "meta.view", "settings.api_meta", "settings.api_meta_ads",
];
const BUSINESS = [...BASE, "financial.manage", "meta_ads.view", "google_ads.view"];
const ENTERPRISE = [...BUSINESS, "rh.point.register", "rh.point.manage"];

// Precos ficticios.
const PLANOS = [
  { id: 1, nome: "Basico", preco: 99, permissoes: BASE, max_user: 3, max_filial: 1, max_crm: 1, max_leads: 5000 },
  { id: 2, nome: "Business", preco: 199, permissoes: BUSINESS, max_user: 5, max_filial: 2, max_crm: 3, max_leads: 7000 },
  { id: 3, nome: "Enterprise", preco: 399, permissoes: ENTERPRISE, max_user: 15, max_filial: 5, max_crm: 5, max_leads: 10000 },
];

const hex = (n) => crypto.randomBytes(n).toString("hex");

async function createEmpresa(c, { nome, razao, cnpj, plano, pdv }) {
  const e = (
    await c.query(
      `INSERT INTO empresa (nome_fantasia, razao_social, cnpj, logradouro, numero, bairro, cidade, uf, cep, ativo,
         cliente_webhook_codigo, cliente_webhook_public_id)
       VALUES ($1,$2,$3,'Rua de Exemplo','100','Centro','Sao Paulo','SP','01000-000',true,$4,$5) RETURNING id`,
      [nome, razao, cnpj, hex(20), hex(16)]
    )
  ).rows[0];
  await c.query(
    `INSERT INTO empresa_assinatura (empresa_id, assinatura_id, ativo, has_pdv, validade, data_inicial)
     VALUES ($1,$2,true,$3,(current_date + interval '1 year')::date, now())`,
    [e.id, plano, pdv]
  );
  const filial = (
    await c.query(
      `INSERT INTO empresa_filial (empresa_id, nome, telefone, logradouro, responsavel, primaria, ativo, cidade, uf)
       VALUES ($1,'Matriz','(11) 3000-0000','Rua de Exemplo, 100','Equipe Demo',true,true,'Sao Paulo','SP') RETURNING id`,
      [e.id]
    )
  ).rows[0];
  const crm = (
    await c.query(
      `INSERT INTO comercial_crm (empresa_id, nome, descricao, ativo, master)
       VALUES ($1,'Pipeline Principal','Funil de demonstracao',true,true) RETURNING id`,
      [e.id]
    )
  ).rows[0];
  const etapas = [
    ["waiting", "Aguardando Atendimento", 0, "#4299e1", true, false, false],
    ["qualificacao", "Qualificacao", 1, "#9f7aea", false, false, false],
    ["proposta", "Proposta enviada", 2, "#ed8936", false, false, false],
    ["closed-won", "Fechado Ganho", 3, "#48bb78", false, true, true],
    ["closed-lost", "Fechado Perdido", 4, "#f56565", false, true, false],
  ];
  for (const [codigo, nomeEtapa, ordem, cor, ini, fech, ganho] of etapas) {
    await c.query(
      `INSERT INTO comercial_etapa (crm_id, codigo, nome, ordem, cor, eh_inicial, eh_fechamento, eh_ganho, ativo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
      [crm.id, codigo, nomeEtapa, ordem, cor, ini, fech, ganho]
    );
  }
  return { id: e.id, filialId: filial.id, crmId: crm.id };
}

async function createUsuario(c, empresa, { nome, email, master, permissoes = [], perfilId = null }) {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 11);
  const u = (
    await c.query(
      `INSERT INTO usuario (nome, email, senha, ativo, empresa_id, is_master, permissoes_customizadas, telefone, filial_id, perfil_id)
       VALUES ($1,$2,$3,true,$4,$5,$6::jsonb,'5511999990000',$7,$8) RETURNING id`,
      [nome, email, hash, empresa.id, master, JSON.stringify(permissoes), empresa.filialId, perfilId]
    )
  ).rows[0];
  await c.query(`INSERT INTO comercial_crm_usuario (crm_id, usuario_id) VALUES ($1,$2)`, [empresa.crmId, u.id]);
  return u.id;
}

async function main() {
  const c = new Client({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "orbita_crm",
  });
  await c.connect();
  try {
    const exists = await c.query("SELECT 1 FROM usuario WHERE lower(email) = $1", [ADMIN_EMAIL]);
    if (exists.rows.length) {
      console.log("[seed] contas de demonstracao ja existem; nada a fazer.");
      return;
    }

    await c.query("BEGIN");

    for (const p of PLANOS) {
      await c.query(
        `INSERT INTO assinatura (id, nome, preco, permissoes, ativo, max_user, max_filial, max_crm, max_leads)
         VALUES ($1,$2,$3,$4::jsonb,true,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, preco = EXCLUDED.preco, permissoes = EXCLUDED.permissoes,
           ativo = true, max_user = EXCLUDED.max_user, max_filial = EXCLUDED.max_filial,
           max_crm = EXCLUDED.max_crm, max_leads = EXCLUDED.max_leads`,
        [p.id, p.nome, p.preco, JSON.stringify(p.permissoes), p.max_user, p.max_filial, p.max_crm, p.max_leads]
      );
    }
    await c.query("SELECT setval(pg_get_serial_sequence('assinatura','id'), (SELECT max(id) FROM assinatura))");

    // Empresa 1: plano Enterprise com PDV (todos os modulos).
    const loja = await createEmpresa(c, {
      nome: "Loja Exemplo", razao: "Loja Exemplo Comercio Ltda", cnpj: "00.000.000/0001-00", plano: 3, pdv: true,
    });
    const perfil = (
      await c.query(`INSERT INTO perfil (nome, ativo, empresa_id) VALUES ('Vendedor', true, $1) RETURNING id`, [loja.id])
    ).rows[0];
    await createUsuario(c, loja, { nome: "Ana Administradora", email: ADMIN_EMAIL, master: true });
    await createUsuario(c, loja, {
      nome: "Bruno Vendedor",
      email: "vendedor@demo.orbita.test",
      master: false,
      perfilId: perfil.id,
      permissoes: [
        "dashboard.view", "chat.view", "contacts.view", "commercial.view", "commercial.pipeline",
        "sales.view", "sales.create", "stock.view", "rh.point.register",
      ],
    });

    // Empresa 2: outro tenant, para conferir que os dados nao se misturam.
    const outra = await createEmpresa(c, {
      nome: "Outra Empresa Demo", razao: "Outra Empresa Demo Ltda", cnpj: "00.000.000/0002-00", plano: 1, pdv: false,
    });
    await createUsuario(c, outra, { nome: "Carla Outra Empresa", email: "outra@demo.orbita.test", master: true });

    // Dados ficticios.
    const clientes = [
      ["Cliente Exemplo Um", "5511900000001", "cliente1@example.com", "manual"],
      ["Cliente Exemplo Dois", "5511900000002", "cliente2@example.com", "whatsapp"],
      ["Cliente Exemplo Tres", "5511900000003", "cliente3@example.com", "meta_ads"],
      ["Cliente Exemplo Quatro", "5511900000004", null, "manual"],
      ["Cliente Exemplo Cinco", "5511900000005", "cliente5@example.com", "webhook"],
    ];
    const clienteIds = [];
    for (const [nome, tel, email, origem] of clientes) {
      clienteIds.push(
        (
          await c.query(
            `INSERT INTO cliente (nome, telefone, email, ativo, empresa_id, origem, cidade, uf)
             VALUES ($1,$2,$3,true,$4,$5,'Sao Paulo','SP') RETURNING id`,
            [nome, tel, email, loja.id, origem]
          )
        ).rows[0].id
      );
    }
    await c.query(
      `INSERT INTO cliente (nome, telefone, email, ativo, empresa_id, origem)
       VALUES ('Cliente da Outra Empresa','5511900000099','outro@example.com',true,$1,'manual')`,
      [outra.id]
    );

    const tagVip = (await c.query(`INSERT INTO tag (nome, empresa_id) VALUES ('VIP',$1) RETURNING id`, [loja.id])).rows[0].id;
    await c.query(`INSERT INTO tag (nome, empresa_id) VALUES ('Novo contato',$1)`, [loja.id]);
    await c.query(`INSERT INTO cliente_tag (cliente_id, tag_id) VALUES ($1,$2),($3,$2)`, [clienteIds[0], tagVip, clienteIds[2]]);

    const catIds = [];
    for (const nome of ["Eletronicos", "Acessorios"]) {
      catIds.push((await c.query(`INSERT INTO categoria (nome, empresa_id) VALUES ($1,$2) RETURNING id`, [nome, loja.id])).rows[0].id);
    }
    const fab = (
      await c.query(
        `INSERT INTO fabricante (nome, telefone, email, empresa_id, contato) VALUES ('Distribuidora Exemplo','(11) 3000-0001','vendas@example.com',$1,'Equipe comercial') RETURNING id`,
        [loja.id]
      )
    ).rows[0].id;
    const produtos = [
      ["Fone de ouvido sem fio", "7890000000011", 80, 149.9, 0],
      ["Carregador USB-C", "7890000000012", 25, 59.9, 1],
      ["Caixa de som portatil", "7890000000013", 120, 229.9, 0],
      ["Capa protetora", "7890000000014", 8, 29.9, 1],
    ];
    for (const [nome, barra, custo, venda, cat] of produtos) {
      const p = (
        await c.query(
          `INSERT INTO produto (nome, cd_barra, preco, preco_venda, empresa_id, fabricante_id, unidade_medida)
           VALUES ($1,$2,$3,$4,$5,$6,'UN') RETURNING id`,
          [nome, barra, custo, venda, loja.id, fab]
        )
      ).rows[0].id;
      await c.query(`INSERT INTO produto_categoria (categoria_id, produto_id) VALUES ($1,$2)`, [catIds[cat], p]);
      await c.query(
        `INSERT INTO produto_estoque (produto_id, filial_id, empresa_id, tot_it, qt_estoque, qt_vitrine) VALUES ($1,$2,$3,30,25,5)`,
        [p, loja.filialId, loja.id]
      );
    }

    await c.query("COMMIT");
    console.log("[seed] pronto. Senha de todas as contas: " + DEMO_PASSWORD);
    console.log("  admin@demo.orbita.test     (master, Loja Exemplo, plano Enterprise + PDV)");
    console.log("  vendedor@demo.orbita.test  (usuario comum, Loja Exemplo)");
    console.log("  outra@demo.orbita.test     (master, Outra Empresa Demo, plano Basico)");
  } catch (error) {
    await c.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await c.end();
  }
}

main().catch((error) => {
  console.error("[seed] falhou:", error.message);
  process.exit(1);
});
