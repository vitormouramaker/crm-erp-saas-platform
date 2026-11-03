require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { configureRealtime } = require("./server/realtime");
const executeVendas = require("./services/execute_vendas");
const sessionAuth = require("./security/session_auth");

const app = express();
const server = http.createServer(app);
const bunny = require("./utils/bunny_config");

const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "80mb";
// A autenticacao e por Bearer token (sem cookies), entao CORS aberto nao
// expoe sessao. Para restringir, liste as origens em CORS_ORIGINS.
const corsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOrigin = corsOrigins.length ? corsOrigins : "*";
const io = new Server(server, {
  cors: { origin: corsOrigin },
});
configureRealtime(io);

app.disable("x-powered-by");
app.use(cors({ origin: corsOrigin, exposedHeaders: ["X-Session-Token"] }));
app.use("/pagamento/webhook/stripe", express.raw({ type: "application/json" }));
// rawBody: usado para conferir a assinatura do webhook da Meta.
app.use(
  express.json({
    limit: requestBodyLimit,
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ limit: requestBodyLimit, extended: true }));
app.set("trust proxy", 1);

app.get("/health", (req, res) => res.json({ ok: true }));
// Arquivos enviados quando o Bunny Storage nao esta configurado (modo local).
app.use("/media-local", express.static(bunny.localMediaDir, { fallthrough: false, dotfiles: "deny" }));

app.use(sessionAuth);

// Import rotas
const web = require("./routes/web");
const att = require("./routes/atendimento");
const user = require("./routes/user");
const estoque = require("./routes/estoque");
const vendas = require("./routes/vendas");
const templates = require("./routes/meta")
const metaAds = require("./routes/meta_ads");
const metaIg = require("./routes/meta_ig");
const googleAds = require("./routes/google_ads");
const hotmart = require("./routes/hotmart");
const hubla = require("./routes/hubla");
const pagamento = require("./routes/pagamento");
const ponto = require("./routes/ponto");
const webhookCliente = require("./routes/webhook_cliente");
const nps = require("./routes/nps");
const financeiro = require("./routes/financeiro");
const manual = require("./routes/manual");
const developerWebhooks = require("./routes/developer_webhooks");
const push = require("./routes/push");
const novidades = require("./routes/novidades");
const gestao360 = require("./routes/gestao360");
app.use("/web", web);
app.use("/atendimento", att);
app.use("/user", user);
app.use("/estoque", estoque);
app.use("/vendas", vendas);
app.use("/pagamento", pagamento);
app.use("/meta", templates);
app.use("/meta_ads", metaAds);
app.use("/meta_ig", metaIg);
app.use("/google_ads", googleAds);
app.use("/hotmart", hotmart);
app.use("/hubla", hubla);
app.use("/ponto", ponto);
app.use("/webhook", webhookCliente);
app.use("/nps", nps);
app.use("/financeiro", financeiro);
app.use("/manual", manual);
app.use("/developer_webhooks", developerWebhooks);
app.use("/push", push);
app.use("/novidades", novidades);
app.use("/integracao/gestao360", gestao360);

function canSkipCrmAutomationSchemaError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "55P03" ||
    message.includes("lock timeout") ||
    message.includes("canceling statement due to lock timeout")
  );
}

async function startApplication() {
  const shouldEnsureCrmAutomationSchema = String(
    process.env.CRM_AUTOMATION_SCHEMA_ENSURE_ON_STARTUP || "false"
  )
    .trim()
    .toLowerCase() !== "false";

  if (shouldEnsureCrmAutomationSchema) {
    try {
      await executeVendas.execute_ensure_crm_automation_schema();
    } catch (error) {
      if (canSkipCrmAutomationSchemaError(error)) {
        console.warn(
          "[startup] ensure do schema de automacao do CRM ignorado por lock temporario:",
          error?.message || error
        );
      } else {
        throw error;
      }
    }
  }

  const port = Number(process.env.PORT || 4444);
  server.listen(port, () => console.log(`[startup] API ouvindo na porta ${port}`));
}

startApplication().catch((error) => {
  console.error("[startup] falha ao inicializar aplicacao:", error);
  process.exit(1);
});
