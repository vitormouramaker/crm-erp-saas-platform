import * as XLSX from "xlsx";

type MetaAdsCampaignSummaryRow = Record<string, string | number>;
type MetaAdsCampaignAdRow = Record<string, string | number>;
type MetaAdsAccountSummaryRow = Record<string, string | number>;
type MetaAdsAccountCampaignRow = Record<string, string | number>;

function sanitizeSheetName(value: string) {
  return value.slice(0, 31) || "Planilha";
}

function slugifyFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function exportMetaAdsCampaignDetail(params: {
  campaignName: string;
  summaryRows: MetaAdsCampaignSummaryRow[];
  adsRows: MetaAdsCampaignAdRow[];
}) {
  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet(params.summaryRows);
  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    sanitizeSheetName("Resumo campanha"),
  );

  const adsSheet = XLSX.utils.json_to_sheet(params.adsRows);
  XLSX.utils.book_append_sheet(
    workbook,
    adsSheet,
    sanitizeSheetName("Anuncios"),
  );

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const campaignSlug = slugifyFilename(params.campaignName || "campanha");
  XLSX.writeFile(
    workbook,
    `meta_ads_campanha_${campaignSlug}_${dateSuffix}.xlsx`,
  );
}

export function exportMetaAdsAccountOverview(params: {
  accountName: string;
  summaryRows: MetaAdsAccountSummaryRow[];
  campaignRows: MetaAdsAccountCampaignRow[];
}) {
  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet(params.summaryRows);
  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    sanitizeSheetName("Resumo conta"),
  );

  const campaignsSheet = XLSX.utils.json_to_sheet(params.campaignRows);
  XLSX.utils.book_append_sheet(
    workbook,
    campaignsSheet,
    sanitizeSheetName("Campanhas"),
  );

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const accountSlug = slugifyFilename(params.accountName || "conta");
  XLSX.writeFile(
    workbook,
    `meta_ads_conta_${accountSlug}_${dateSuffix}.xlsx`,
  );
}
