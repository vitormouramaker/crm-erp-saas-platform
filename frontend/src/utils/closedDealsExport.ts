import * as XLSX from "xlsx";
import type { Deal } from "../service/commercialService";

type ClosedDealsExportFilters = {
  search?: string;
  ownerLabel?: string;
  stageLabel?: string;
  saleOriginLabel?: string;
  dateStart?: string;
  dateEnd?: string;
};

type ExportClosedDealsParams = {
  crmName?: string;
  deals: Deal[];
  filters: ClosedDealsExportFilters;
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
  return String(value || "fechadas")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function getStageLabel(stage?: string) {
  return stage === "closed-lost" ? "Perdido" : "Ganho";
}

function collectDealItems(deal: Deal) {
  if (Array.isArray(deal.quote?.items) && deal.quote.items.length) {
    return deal.quote.items;
  }
  return Array.isArray(deal.products) ? deal.products : [];
}

function buildFilename(crmName?: string) {
  const dateLabel = new Date().toISOString().slice(0, 10);
  return `fechamentos_${sanitizeFilePart(crmName) || "comercial"}_${dateLabel}.xlsx`;
}

export function exportClosedDealsWorkbook(params: ExportClosedDealsParams) {
  const workbook = XLSX.utils.book_new();
  const totalSaleValue = params.deals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const totalQuoteValue = params.deals.reduce(
    (sum, deal) => sum + Number(deal.quote?.total ?? deal.amount ?? 0),
    0
  );

  const summaryRows = [
    { Campo: "Visao", Valor: "Fechamentos comerciais" },
    { Campo: "Funil", Valor: params.crmName || "Comercial" },
    { Campo: "Gerado em", Valor: new Date().toLocaleString("pt-BR") },
    { Campo: "Total de fechamentos", Valor: params.deals.length },
    { Campo: "Valor total vendido", Valor: totalSaleValue },
    { Campo: "Valor total dos orcamentos", Valor: totalQuoteValue },
    { Campo: "Busca", Valor: params.filters.search || "" },
    { Campo: "Vendedor", Valor: params.filters.ownerLabel || "" },
    { Campo: "Status", Valor: params.filters.stageLabel || "" },
    { Campo: "Origem da venda", Valor: params.filters.saleOriginLabel || "" },
    { Campo: "Data inicial", Valor: params.filters.dateStart || "" },
    { Campo: "Data final", Valor: params.filters.dateEnd || "" },
  ];

  const dealsRows = params.deals.map((deal) => {
    const items = collectDealItems(deal);
    return {
      Fechamento: formatDate(deal.saleDate || deal.closingDate || deal.createdAt),
      Status: getStageLabel(deal.stage),
      Cliente: deal.contactName || "",
      Empresa: deal.companyName || "",
      Card: deal.title || "",
      Vendedor: deal.ownerName || "",
      "Valor vendido": Number(deal.amount || 0),
      "Orcamento total": Number(deal.quote?.total ?? deal.amount ?? 0),
      "Qtd. itens": items.length,
      "Qtd. unidades": items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      Origem: deal.saleOrigin || "",
      Pagamento: deal.paymentMethod || "",
      Parcelas:
        deal.installments === null || deal.installments === undefined
          ? ""
          : Number(deal.installments),
      "Criado em": formatDateTime(deal.createdAt),
      "Observacoes venda": deal.saleNotes || "",
      "Observacoes orcamento": deal.quote?.notes || "",
    };
  });

  const itemsRows = params.deals.flatMap((deal) => {
    const items = collectDealItems(deal);
    if (!items.length) return [];

    return items.map((item) => ({
      Fechamento: formatDate(deal.saleDate || deal.closingDate || deal.createdAt),
      Status: getStageLabel(deal.stage),
      Cliente: deal.contactName || "",
      Card: deal.title || "",
      Vendedor: deal.ownerName || "",
      Produto: item.name || "",
      Quantidade: Number(item.quantity || 0),
      "Preco unitario": Number(item.price || 0),
      Subtotal:
        item.subtotal === null || item.subtotal === undefined
          ? Number(item.quantity || 0) * Number(item.price || 0)
          : Number(item.subtotal || 0),
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
    itemsRows.length ? itemsRows : [{ Cliente: "", Card: "", Produto: "", Quantidade: "" }]
  );

  summarySheet["!cols"] = [{ wch: 24 }, { wch: 36 }];
  dealsSheet["!cols"] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
    { wch: 28 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 10 },
    { wch: 20 },
    { wch: 24 },
    { wch: 24 },
  ];
  itemsSheet["!cols"] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
    { wch: 28 },
    { wch: 22 },
    { wch: 28 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
  XLSX.utils.book_append_sheet(workbook, dealsSheet, "Fechamentos");
  XLSX.utils.book_append_sheet(workbook, itemsSheet, "Itens");
  XLSX.writeFile(workbook, buildFilename(params.crmName));
}
