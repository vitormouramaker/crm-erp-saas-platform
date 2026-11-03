import * as XLSX from "xlsx";
import type { Deal } from "../service/commercialService";

type CrmExportFilters = {
  search?: string;
  ownerLabel?: string;
  tag?: string;
  dateStart?: string;
  dateEnd?: string;
};

type ExportParams = {
  crmName: string;
  deals: Deal[];
  filters: CrmExportFilters;
  stageLabels?: Record<string, string>;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("pt-BR");
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("pt-BR");
}

function sanitizeFilePart(value?: string | null) {
  return String(value || "crm")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function collectDealItems(deal: Deal) {
  if (Array.isArray(deal.quote?.items) && deal.quote.items.length) {
    return deal.quote.items;
  }
  return Array.isArray(deal.products) ? deal.products : [];
}

function formatProductsSummary(deal: Deal) {
  return collectDealItems(deal)
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      return `${item.name} (${quantity} x ${price.toFixed(2)})`;
    })
    .join(" | ");
}

export function buildCrmExportFilename(crmName: string) {
  const dateLabel = new Date().toISOString().slice(0, 10);
  return `crm_${sanitizeFilePart(crmName) || "pipeline"}_${dateLabel}.xlsx`;
}

export function exportCrmWorkbook(params: ExportParams) {
  const workbook = XLSX.utils.book_new();
  const stageLabels = params.stageLabels || {};
  const totalAmount = params.deals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const totalQuote = params.deals.reduce(
    (sum, deal) => sum + Number(deal.quote?.total ?? deal.amount ?? 0),
    0
  );

  const summaryRows = [
    { Campo: "Funil", Valor: params.crmName || "Funil" },
    { Campo: "Gerado em", Valor: new Date().toLocaleString("pt-BR") },
    { Campo: "Total de negocios", Valor: params.deals.length },
    { Campo: "Valor total do pipeline", Valor: totalAmount },
    { Campo: "Valor total dos orcamentos", Valor: totalQuote },
    { Campo: "Busca", Valor: params.filters.search || "" },
    { Campo: "Vendedor", Valor: params.filters.ownerLabel || "" },
    { Campo: "Tag", Valor: params.filters.tag || "" },
    { Campo: "Data inicial", Valor: params.filters.dateStart || "" },
    { Campo: "Data final", Valor: params.filters.dateEnd || "" },
  ];

  const dealsRows = params.deals.map((deal) => {
    const items = collectDealItems(deal);
    return {
      Negocio: deal.title || "",
      Etapa: stageLabels[deal.stage] || deal.stage || "",
      Cliente: deal.contactName || "",
      Empresa: deal.companyName || "",
      Telefone: deal.customerPhone || "",
      Email: deal.customerEmail || "",
      Documento: deal.customerDocument || "",
      Vendedor: deal.ownerName || "",
      "Valor no pipeline": Number(deal.amount || 0),
      "Orcamento subtotal": Number(deal.quote?.subtotal || 0),
      "Orcamento desconto": Number(deal.quote?.discount || 0),
      "Orcamento total": Number(deal.quote?.total ?? deal.amount ?? 0),
      "Titulo do orcamento": deal.quote?.title || "",
      "Status do orcamento": deal.quote?.status || "",
      "Qtd. itens": items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      Produtos: formatProductsSummary(deal),
      Tags: Array.isArray(deal.tags) ? deal.tags.join(", ") : "",
      Temperatura: deal.temperature || "",
      "Origem da venda": deal.saleOrigin || "",
      "Forma de pagamento": deal.paymentMethod || "",
      Parcelas:
        deal.installments === null || deal.installments === undefined
          ? ""
          : Number(deal.installments),
      "Criado em": formatDateTime(deal.createdAt),
      "Entrada no pipeline": formatDateTime(deal.entryDate),
      "Data de fechamento": formatDate(deal.closingDate),
      "Data da venda": formatDate(deal.saleDate),
      "Interacoes abertas": Number(deal.openInteractionCount || 0),
      "Interacao aberta desde": formatDateTime(deal.openInteractionStartedAt),
      "Agendamentos hoje": Number(deal.scheduledInteractionTodayCount || 0),
      "Agendamento de hoje": formatDateTime(deal.scheduledInteractionTodayAt),
      "Motivo de perda": deal.refusalReason || "",
      "Observacoes de perda": deal.refusalNotes || "",
      "Observacoes de venda": deal.saleNotes || "",
      "Observacoes do orcamento": deal.quote?.notes || "",
    };
  });

  const itemsRows = params.deals.flatMap((deal) => {
    const items = collectDealItems(deal);
    if (!items.length) {
      return [];
    }

    return items.map((item) => ({
      Negocio: deal.title || "",
      Etapa: stageLabels[deal.stage] || deal.stage || "",
      Cliente: deal.contactName || "",
      Vendedor: deal.ownerName || "",
      Produto: item.name || "",
      Quantidade: Number(item.quantity || 0),
      "Preco unitario": Number(item.price || 0),
      Subtotal:
        item.subtotal === null || item.subtotal === undefined
          ? Number(item.quantity || 0) * Number(item.price || 0)
          : Number(item.subtotal || 0),
      Status: item.status || "",
      "Qtd. vendida":
        item.soldQuantity === null || item.soldQuantity === undefined
          ? ""
          : Number(item.soldQuantity),
      "Qtd. perdida":
        item.lostQuantity === null || item.lostQuantity === undefined
          ? ""
          : Number(item.lostQuantity),
    }));
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  const dealsSheet = XLSX.utils.json_to_sheet(dealsRows);
  const itemsSheet = XLSX.utils.json_to_sheet(
    itemsRows.length ? itemsRows : [{ Negocio: "", Produto: "", Quantidade: "", Subtotal: "" }]
  );

  summarySheet["!cols"] = [{ wch: 24 }, { wch: 36 }];
  dealsSheet["!cols"] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 24 },
    { wch: 24 },
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
    { wch: 16 },
    { wch: 12 },
    { wch: 42 },
    { wch: 28 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 10 },
    { wch: 20 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 20 },
    { wch: 12 },
    { wch: 20 },
    { wch: 22 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
  ];
  itemsSheet["!cols"] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 24 },
    { wch: 22 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
  XLSX.utils.book_append_sheet(workbook, dealsSheet, "Negocios");
  XLSX.utils.book_append_sheet(workbook, itemsSheet, "Itens");
  XLSX.writeFile(workbook, buildCrmExportFilename(params.crmName));
}
