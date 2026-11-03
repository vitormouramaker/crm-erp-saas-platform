import * as XLSX from "xlsx";
import type { CommercialConversationExportRow } from "../service/commercialService";

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("pt-BR");
}

function formatStatus(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "waiting") return "Fila";
  if (normalized === "active") return "Em atendimento";
  if (normalized === "finished") return "Finalizada";
  return normalized || "Nao informado";
}

function parseUtms(value: unknown): Array<Record<string, string>> {
  const source =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        })()
      : value;

  if (!Array.isArray(source)) return [];

  return source
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      return Object.entries(item as Record<string, unknown>).reduce<Record<string, string>>(
        (acc, [key, rawValue]) => {
          const normalized = String(rawValue ?? "").trim();
          if (normalized) {
            acc[key] = normalized;
          }
          return acc;
        },
        {}
      );
    })
    .filter((item): item is Record<string, string> => Boolean(item));
}

function buildUtmSummary(value: unknown) {
  return parseUtms(value)
    .map((utm) =>
      Object.entries(utm)
        .map(([key, itemValue]) => `${key}: ${itemValue}`)
        .join(", ")
    )
    .filter(Boolean)
    .join(" | ");
}

function formatMediaType(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "text") return "Texto";
  if (normalized === "image") return "Imagem";
  if (normalized === "video") return "Video";
  if (normalized === "audio") return "Audio";
  if (normalized === "document") return "Documento";
  if (normalized === "sticker") return "Sticker";
  if (normalized === "location") return "Localizacao";
  if (normalized === "contacts") return "Contato";
  if (normalized === "meta_referral") return "Meta Ads";
  return normalized;
}

export function exportCommercialCompanyConversationsWorkbook(
  rows: CommercialConversationExportRow[]
) {
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    { Campo: "Gerado em", Valor: new Date().toLocaleString("pt-BR") },
    { Campo: "Total de conversas", Valor: Number(rows.length || 0) },
    {
      Campo: "Conversas em fila",
      Valor: rows.filter((row) => String(row.status) === "waiting").length,
    },
    {
      Campo: "Conversas em atendimento",
      Valor: rows.filter((row) => String(row.status) === "active").length,
    },
    {
      Campo: "Conversas finalizadas",
      Valor: rows.filter((row) => String(row.status) === "finished").length,
    },
    {
      Campo: "Total de mensagens exportadas",
      Valor: rows.reduce(
        (total, row) => total + (Array.isArray(row.mensagens) ? row.mensagens.length : 0),
        0
      ),
    },
  ];

  const conversationRows = rows.map((row) => ({
    ID: row.id,
    Cliente: row.clienteNome,
    Telefone: row.clienteTelefone,
    "Origem do cliente": row.origemCliente,
    Status: formatStatus(row.status),
    "Numero Meta": row.metaNumeroConta,
    "Nome Meta": row.metaNomeConta,
    Funil: row.funilNome || "Sem funil",
    Atendente: row.atendenteNome || "",
    "Usuario atribuido": row.usuarioAtribuidoNome || "",
    "Data de inicio": formatDateTime(row.dataInicio),
    "Fila desde": formatDateTime(row.filaDesde),
    "Ultima atualizacao": formatDateTime(row.ultimaAtualizacao),
    "Data de fim": formatDateTime(row.dataFim),
    "Ultima msg cliente em": formatDateTime(row.ultimaMensagemClienteEm),
    "Janela Meta expira em": formatDateTime(row.janelaMetaExpiraEm),
    "Janela Meta aberta": row.janelaMetaAberta ? "Sim" : "Nao",
    "Fila ha mais de 24h": row.filaMais24h ? "Sim" : "Nao",
    "Aguardando resposta template": row.aguardandoRespostaTemplate ? "Sim" : "Nao",
    "Total de mensagens": row.totalMensagens,
    "Mensagens do cliente": row.totalMensagensCliente,
    "Mensagens do usuario": row.totalMensagensUsuario,
    "Autor da ultima mensagem": row.ultimaMensagemAutor,
    "Ultima mensagem": row.ultimaMensagem || "",
    UTMs: buildUtmSummary(row.utms),
  }));

  const messageRows = rows.flatMap((row) => {
    const messages = Array.isArray(row.mensagens) ? row.mensagens : [];

    return messages.map((message, index) => ({
      "ID da conversa": row.id,
      Cliente: row.clienteNome,
      Telefone: row.clienteTelefone,
      Status: formatStatus(row.status),
      Sequencia: index + 1,
      "Data da mensagem": formatDateTime(message.dataMensagem),
      Autor: message.autor || "",
      "Tipo de midia": formatMediaType(message.mediaType),
      Apagada: message.apagada ? "Sim" : "Nao",
      Mensagem: message.mensagem || "",
      "WhatsApp message ID": message.mensagemWhatsId || "",
      "Status da mensagem": message.status || "",
    }));
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  const conversationsSheet = XLSX.utils.json_to_sheet(conversationRows);
  const messagesSheet = XLSX.utils.json_to_sheet(
    messageRows.length
      ? messageRows
      : [
          {
            "ID da conversa": "",
            Cliente: "",
            Telefone: "",
            Status: "",
            Sequencia: "",
            "Data da mensagem": "",
            Autor: "",
            "Tipo de midia": "",
            Apagada: "",
            Mensagem: "Nenhuma mensagem encontrada para as conversas filtradas.",
            "WhatsApp message ID": "",
            "Status da mensagem": "",
          },
        ]
  );

  summarySheet["!cols"] = [
    { wch: 28 },
    { wch: 24 },
  ];

  conversationsSheet["!cols"] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 28 },
    { wch: 24 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 24 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 60 },
    { wch: 52 },
  ];

  messagesSheet["!cols"] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
    { wch: 90 },
    { wch: 34 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
  XLSX.utils.book_append_sheet(workbook, conversationsSheet, "Conversas");
  XLSX.utils.book_append_sheet(workbook, messagesSheet, "Mensagens");
  XLSX.writeFile(
    workbook,
    `conversas_empresa_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
