const models = require("../models/models_web");
const { postgres } = require("../server/connect");
const security = require("../security/cypher");
const NPS_REPORT_PERMISSION = "reports.nps.view";
const RESET_CODE_TTL_MINUTES = 15;
const RESET_CODE_MAX_ATTEMPTS = 5;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function ensureDefaultCrmForEmpresa(client, empresaId) {
  if (!empresaId) return null;

  const crmRet = await client.query(models.get_default_crm_empresa(), [empresaId]);
  let crmId = crmRet.rows[0]?.id || null;

  if (!crmId) {
    const createdCrmRet = await client.query(models.insert_crm_master_onboarding(), [
      empresaId,
      "Pipeline Principal",
      "CRM padrao criado automaticamente no onboarding da empresa.",
    ]);
    crmId = createdCrmRet.rows[0]?.id || null;
  }

  if (!crmId) return null;

  const etapasPadrao = [
    {
      codigo: "waiting",
      nome: "Aguardando Atendimento",
      ordem: 0,
      cor: "#4299e1",
      eh_inicial: true,
      eh_fechamento: false,
      eh_ganho: false,
    },
    {
      codigo: "closed-won",
      nome: "Fechado Ganho",
      ordem: 1,
      cor: "#48bb78",
      eh_inicial: false,
      eh_fechamento: true,
      eh_ganho: true,
    },
    {
      codigo: "closed-lost",
      nome: "Fechado Perdido",
      ordem: 2,
      cor: "#f56565",
      eh_inicial: false,
      eh_fechamento: true,
      eh_ganho: false,
    },
  ];

  for (const etapa of etapasPadrao) {
    const etapaRet = await client.query(models.get_etapa_by_codigo_crm(), [crmId, etapa.codigo]);
    if (etapaRet.rows.length) continue;

    await client.query(models.insert_etapa_crm(), [
      crmId,
      etapa.codigo,
      etapa.nome,
      etapa.ordem,
      etapa.cor,
      etapa.eh_inicial,
      etapa.eh_fechamento,
      etapa.eh_ganho,
    ]);
  }

  return crmId;
}

const execute = {
  execute_login: async (user, pass) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.login(), [normalizeEmail(user)]);

      // A senha e conferida aqui (bcrypt). Hash legado em MD5 e aceito e
      // regravado em bcrypt no mesmo login (migracao transparente).
      let usuario = null;
      for (const row of ret.rows) {
        const check = security.verifyPassword(pass, row.senha_hash);
        if (!check.ok) continue;
        if (check.needsRehash) {
          await client.query(models.update_senha_usuario(), [row.id, security.hashPassword(pass)]);
        }
        usuario = row;
        break;
      }
      for (const row of ret.rows) delete row.senha_hash;

      if (usuario) {

        // --- LÓGICA DE PERMISSÕES ---
        let permissoesFinais = [];

        // Garante que são arrays (caso venha null do banco)
        const permissoesPlanoBase = Array.isArray(usuario.permissoes_plano)
          ? usuario.permissoes_plano
          : [];
        const permissoesConfiguracoes = permissoesPlanoBase.includes("settings.view")
          ? [
              "settings.quick_messages",
              "settings.tags",
              "settings.branches",
              "settings.categories",
            ]
          : [];
        const permissoesPlano = [
          ...new Set([...permissoesPlanoBase, ...permissoesConfiguracoes]),
        ];
        const permissoesUsuario = usuario.permissoes_customizadas || [];

        if (usuario.is_master) {
          // Master tem poder total do plano
          permissoesFinais = permissoesPlano;
        } else {
          // Funcionário tem apenas o que foi dado a ele, LIMITADO pelo plano
          // Ex: Se ele tem 'chat.view' mas o plano Básico não tem chat, ele não vê.
          permissoesFinais = permissoesUsuario.filter((p) =>
            permissoesPlano.includes(p)
          );
        }

        if (
          permissoesUsuario.includes(NPS_REPORT_PERMISSION) &&
          !permissoesFinais.includes(NPS_REPORT_PERMISSION)
        ) {
          permissoesFinais.push(NPS_REPORT_PERMISSION);
        }

        // Injeta a lista limpa no objeto de retorno
        usuario.permissions = permissoesFinais;
        if (usuario.pdv) {
          usuario.permissions.push("sales.view","sales.create",)
        }

        // Removemos campos técnicos brutos para não trafegar lixo
        delete usuario.permissoes_plano;
        delete usuario.permissoes_customizadas;

        return [usuario];
      }

      return [];
    } finally {
      client.release();
    }
  },

  // ... (restante das funções execute_forgot_pass, etc. mantêm-se iguais)
  execute_forgot_pass: async (email) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.forgot_pass(), [normalizeEmail(email)]);
      return ret.rows;
    } finally {
      client.release();
    }
  },

  execute_get_parans: async () => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(models.get_parans());
      return ret.rows;
    } finally {
      client.release();
    }
  },

  // Gera um codigo novo para o e-mail (invalida os anteriores). Retorna null
  // se nao houver conta ativa com esse e-mail.
  execute_criar_codigo_reset: async (email) => {
    const client = await postgres.connect();
    try {
      const normalized = normalizeEmail(email);
      const usuarios = (await client.query(models.forgot_pass(), [normalized])).rows;
      if (!usuarios.length) return null;
      const codigo = security.generateResetCode();
      await client.query("BEGIN");
      await client.query(models.invalidar_codigos_reset(), [usuarios.map((u) => u.id)]);
      // Um e-mail pode ter conta em mais de uma empresa: o codigo vale para as
      // contas desse e-mail, e so para elas.
      for (const u of usuarios) {
        await client.query(models.insert_codigo_reset(), [
          u.id,
          security.hashResetCode(u.id, codigo),
          RESET_CODE_TTL_MINUTES,
        ]);
      }
      await client.query("COMMIT");
      return { email: normalized, codigo };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  },

  // Confere o codigo (ligado ao e-mail, com validade e limite de tentativas)
  // e troca a senha. Retorna true se trocou.
  execute_redefinir_senha_com_codigo: async (email, codigo, novaSenha) => {
    const client = await postgres.connect();
    try {
      const normalized = normalizeEmail(email);
      const code = String(codigo || "").trim();
      if (!normalized || !/^\d{6}$/.test(code)) return false;

      await client.query("BEGIN");
      const ativos = (await client.query(models.get_codigos_reset_ativos(), [normalized])).rows
        .filter((r) => Number(r.tentativas) < RESET_CODE_MAX_ATTEMPTS);
      const matches = ativos.filter((r) =>
        security.timingSafeEqualText(r.codigo_hash, security.hashResetCode(r.usuario_id, code))
      );

      if (!matches.length) {
        if (ativos.length) {
          await client.query(models.incrementar_tentativa_reset(), [ativos.map((r) => r.id)]);
        }
        await client.query("COMMIT");
        return false;
      }

      const hash = security.hashPassword(novaSenha);
      for (const r of matches) {
        await client.query(models.update_senha_usuario(), [r.usuario_id, hash]);
        await client.query(models.marcar_reset_usado(), [r.id]);
      }
      await client.query(models.invalidar_codigos_reset(), [matches.map((r) => r.usuario_id)]);
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  },

  execute_get_onboarding_empresa: async ({ empresa_id, email }) => {
    const client = await postgres.connect();
    try {
      const ret = await client.query(
        models.get_onboarding_empresa_by_token_context(),
        [empresa_id, email]
      );
      return ret.rows[0] || null;
    } finally {
      client.release();
    }
  },

  execute_finalizar_onboarding_empresa: async ({
    empresa_id,
    email,
    pwv,
    nome_responsavel,
    senha,
    nome_fantasia,
    razao_social,
    cnpj,
    logradouro,
    numero,
    bairro,
    cidade,
    uf,
    cep,
  }) => {
    const client = await postgres.connect();

    const safeText = (value, max = 255) => {
      if (value === undefined || value === null) return null;
      const normalized = String(value).trim();
      if (!normalized) return null;
      return normalized.slice(0, max);
    };

    const normalizeUpper = (value, max = 8) => {
      const base = safeText(value, max);
      return base ? base.toUpperCase() : null;
    };

    const sanitizedSenha = String(senha || "").trim();
    if (sanitizedSenha.length < 6) {
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    }

    try {
      const ctx = await client.query(
        models.get_onboarding_empresa_by_token_context(),
        [empresa_id, email]
      );
      const onboardingContext = ctx.rows[0] || null;

      if (!onboardingContext?.empresa_id || !onboardingContext?.usuario_id) {
        throw new Error("Token invalido para finalizar cadastro.");
      }
      // Uso unico: o token guarda um resumo do hash de senha da epoca em que
      // foi emitido. Depois que a senha e definida, ele deixa de valer.
      if (security.passwordVersion(onboardingContext.usuario_senha) !== String(pwv || "")) {
        throw new Error("Link de cadastro ja utilizado ou expirado.");
      }

      const empresaNomeFantasia =
        safeText(nome_fantasia, 120) ||
        safeText(onboardingContext.nome_fantasia, 120) ||
        "Empresa";
      const empresaRazaoSocial =
        safeText(razao_social, 120) ||
        safeText(onboardingContext.razao_social, 120) ||
        empresaNomeFantasia;
      const usuarioNome =
        safeText(nome_responsavel, 120) ||
        safeText(onboardingContext.usuario_nome, 120) ||
        "Administrador";

      await client.query("BEGIN");

      await client.query(models.update_empresa_onboarding(), [
        onboardingContext.empresa_id,
        empresaNomeFantasia,
        empresaRazaoSocial,
        safeText(cnpj, 30),
        safeText(logradouro, 200),
        safeText(numero, 40),
        safeText(bairro, 120),
        safeText(cidade, 120),
        normalizeUpper(uf, 2),
        safeText(cep, 20),
      ]);

      const usuarioRet = await client.query(models.update_usuario_onboarding(), [
        onboardingContext.usuario_id,
        usuarioNome,
        security.hashPassword(sanitizedSenha),
      ]);
      await ensureDefaultCrmForEmpresa(client, onboardingContext.empresa_id);

      await client.query("COMMIT");

      return {
        empresa_id: onboardingContext.empresa_id,
        usuario_id: onboardingContext.usuario_id,
        usuario_email: usuarioRet.rows?.[0]?.email || onboardingContext.usuario_email,
      };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // noop
      }
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = execute;
