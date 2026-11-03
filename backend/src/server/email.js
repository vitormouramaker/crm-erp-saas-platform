const nodemailer = require("nodemailer");
const execute = require("../services/execute_web");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pickEmailConfig(rows, preferredEmpresaId) {
  const normalizedEmpresaId = Number(preferredEmpresaId || 0) || null;
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  if (normalizedEmpresaId) {
    const matchingConfig = rows.find(
      (item) => Number(item?.empresa_id || 0) === normalizedEmpresaId
    );
    if (matchingConfig) return matchingConfig;
  }

  return rows[0] || null;
}

// SMTP: primeiro as variaveis de ambiente (SMTP_HOST/SMTP_USER/SMTP_PASS);
// sem elas, a tabela parametros (como no sistema original). Sem nenhuma das
// duas, o e-mail nao sai da maquina: assunto, destino e links vao para o
// console da API (modo local).
async function getEmailConfig(preferredEmpresaId = null) {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      provider: process.env.SMTP_HOST,
      email: process.env.SMTP_FROM || process.env.SMTP_USER,
      user: process.env.SMTP_USER,
      senha: process.env.SMTP_PASS,
    };
  }

  const emailRows = await execute.execute_get_parans();
  const config = pickEmailConfig(emailRows, preferredEmpresaId);

  if (!config?.provider || !config?.email || !config?.senha) {
    return null;
  }

  return config;
}

function logEmailToConsole(to, subject, html) {
  const links = String(html || "").match(/href="([^"]+)"/g) || [];
  const codes = String(html || "").match(/<h3[^>]*>\s*([0-9]{6})\s*<\/h3>/);
  console.log(
    `[email:local] SMTP nao configurado. Para: ${to} | Assunto: ${subject}` +
      (codes ? ` | Codigo: ${codes[1]}` : "") +
      (links.length ? ` | Links: ${links.map((l) => l.slice(6, -1)).join(" ")}` : "")
  );
  return { local: true };
}

async function send_email(email_recive, subject, html, options = {}) {
  const { preferredEmpresaId = null, replyTo = null } = options;
  const config = await getEmailConfig(preferredEmpresaId);
  if (!config) {
    return logEmailToConsole(email_recive, subject, html);
  }
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpSecure =
    String(process.env.SMTP_SECURE || (smtpPort === 465 ? "true" : "false")).toLowerCase() ===
    "true";

  const transporter = nodemailer.createTransport({
    host: config.provider,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: config.user || config.email,
      pass: config.senha,
    },
  });

  const mailOptions = {
    from: config.email,
    to: email_recive,
    subject,
    html,
  };

  if (replyTo) {
    mailOptions.replyTo = replyTo;
  }

  return transporter.sendMail(mailOptions);
}

function buildFeedbackSubject(tipo, assunto) {
  const safeAssunto = String(assunto || "").trim() || "Sem assunto";
  const labels = {
    support: "Suporte tecnico",
    suggestion: "Sugestao",
    pdv_interest: "Interesse PDV",
    data_request: "Solicitacao de dados",
  };

  return `[${labels[tipo] || "Contato"}] ${safeAssunto}`;
}

function buildFeedbackHtml({
  tipo,
  assunto,
  mensagem,
  email_usuario,
  usuario_id,
  empresa_id,
  dados_formulario,
}) {
  const safeTipo = escapeHtml(tipo);
  const safeAssunto = escapeHtml(assunto || "Sem assunto");
  const safeMensagem = escapeHtml(mensagem || "").replace(/\r?\n/g, "<br />");
  const safeEmailUsuario = escapeHtml(email_usuario || "-");
  const safeUsuarioId = escapeHtml(usuario_id || "-");
  const safeEmpresaId = escapeHtml(empresa_id || "-");

  const pdvFields = dados_formulario
    ? `
      <h3>Dados do interesse PDV</h3>
      <ul>
        <li><strong>Empresa:</strong> ${escapeHtml(dados_formulario.companyName || "-")}</li>
        <li><strong>Responsavel:</strong> ${escapeHtml(dados_formulario.ceoName || "-")}</li>
        <li><strong>Telefone:</strong> ${escapeHtml(dados_formulario.phone || "-")}</li>
        <li><strong>Faturamento:</strong> ${escapeHtml(dados_formulario.revenue || "-")}</li>
        <li><strong>Funcionarios:</strong> ${escapeHtml(dados_formulario.employees || "-")}</li>
      </ul>
    `
    : "";

  const dataRequestFields =
    tipo === "data_request" && dados_formulario
      ? `
      <h3>Escopo solicitado</h3>
      <ul>
        <li><strong>Categorias:</strong> ${
          Array.isArray(dados_formulario.categorias) && dados_formulario.categorias.length
            ? dados_formulario.categorias.map((item) => escapeHtml(item)).join(", ")
            : "-"
        }</li>
        <li><strong>Observacoes:</strong> ${escapeHtml(dados_formulario.observacoes || "-")}</li>
      </ul>
    `
      : "";

  const dataRequestBlock =
    tipo === "data_request"
      ? `
      <h3>Solicitacao do titular</h3>
      <p>O usuario autenticado solicitou acesso aos dados vinculados a sua conta/empresa no sistema.</p>
      <p><strong>Base legal sugerida:</strong> atendimento de solicitacao do titular (LGPD).</p>
    `
      : "";

  const messageBlock = safeMensagem
    ? `
      <h3>Mensagem</h3>
      <p>${safeMensagem}</p>
    `
    : "";

  return `
    <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeAssunto}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
      color: #333333;
    }
    .container {
      max-width: 680px;
      margin: 20px auto;
      background: #ffffff;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.08);
    }
    h1, h2, h3 {
      margin-top: 0;
    }
    ul {
      padding-left: 20px;
    }
    .meta {
      background: #f7f9fc;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Novo contato de ${safeTipo}</h1>
    <div class="meta">
      <p><strong>Tipo:</strong> ${safeTipo}</p>
      <p><strong>Assunto:</strong> ${safeAssunto}</p>
      <p><strong>E-mail do usuario:</strong> ${safeEmailUsuario}</p>
      <p><strong>Usuario ID:</strong> ${safeUsuarioId}</p>
      <p><strong>Empresa ID:</strong> ${safeEmpresaId}</p>
    </div>
    ${dataRequestBlock}
    ${messageBlock}
    ${pdvFields}
    ${dataRequestFields}
  </div>
</body>
</html>
  `;
}

function getFeedbackRecipient(tipo) {
  if (tipo === "data_request") {
    return process.env.SUPPORT_EMAIL || "contato@example.com";
  }

  return process.env.SUPPORT_EMAIL || "contato@example.com";
}

async function send_retrive_pass(destino, token) {
  const resetUrl = `${process.env.APP_WEB_BASE_URL || "http://localhost:5173"}/reset?email=${encodeURIComponent(destino)}`;
  const html = `
    <!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #eeeeee;
        }
        .content {
            padding: 20px 0;
            text-align: center;
            color: #333333;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            margin-top: 20px;
            text-decoration: none;
            background-color: #007bff;
            color: #ffffff;
            border-radius: 5px;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            color: #777777;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Alteração de senha!</h2>
        </div>
        <div class="content">
            <p>Ola,</p>
            <p>Recebemos uma solicitação de alteração de senha.</p>
            <p>Use o codigo abaixo na tela de redefinição para cadastrar uma nova senha:</p>
            <h3 style="color: #007bff;">${token}</h3>
            <a class="button" href="${resetUrl}">Redefinir Senha</a>
            <p style="margin-top: 20px;">Esse codigo nãp funciona como senha de login. Primeiro conclua a redefinicao da senha.</p>
            <p style="margin-top: 20px;">Caso nao tenha solicitado a alteração, ignore este email</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 Órbita CRM. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>
  `;

  const assunto = "Token de alteração de senha";
  return send_email(destino, assunto, html);
}

async function send_onboarding_empresa(destino, { nome, nomeEmpresa, onboardingUrl }) {
  const safeNome = String(nome || "usuario").trim();
  const safeEmpresa = String(nomeEmpresa || "sua empresa").trim();
  const safeUrl = String(onboardingUrl || "").trim();
  if (!safeUrl) return null;

  const html = `
    <!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Finalizar cadastro</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #eeeeee;
        }
        .content {
            padding: 20px 0;
            color: #333333;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            margin-top: 20px;
            text-decoration: none;
            background-color: #007bff;
            color: #ffffff !important;
            border-radius: 5px;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            color: #777777;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Pagamento confirmado</h2>
        </div>
        <div class="content">
            <p>Ola, ${safeNome}.</p>
            <p>Recebemos a assinatura da empresa <strong>${safeEmpresa}</strong>.</p>
            <p>Para concluir o cadastro e preencher as informações faltantes, clique no botão abaixo:</p>
            <a class="button" href="${safeUrl}">Finalizar cadastro</a>
        </div>
        <div class="footer">
            <p>&copy; 2026 Órbita CRM. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>
  `;

  const assunto = "Finalize seu cadastro na plataforma";
  return send_email(destino, assunto, html);
}

async function send_feedback_email({
  tipo,
  assunto,
  mensagem,
  email_usuario,
  usuario_id,
  empresa_id,
  dados_formulario,
}) {
  const config = await getEmailConfig(empresa_id);
  const supportRecipient = String(getFeedbackRecipient(tipo)).trim();

  if (!supportRecipient) {
    throw new Error("Nao foi encontrado destinatario para o e-mail de suporte.");
  }

  const html = buildFeedbackHtml({
    tipo,
    assunto,
    mensagem,
    email_usuario,
    usuario_id,
    empresa_id,
    dados_formulario,
  });

  return send_email(supportRecipient, buildFeedbackSubject(tipo, assunto), html, {
    preferredEmpresaId: empresa_id,
    replyTo: email_usuario || null,
  });
}

module.exports = {
  send_retrive_pass: send_retrive_pass,
  send_onboarding_empresa: send_onboarding_empresa,
  send_feedback_email: send_feedback_email,
};
