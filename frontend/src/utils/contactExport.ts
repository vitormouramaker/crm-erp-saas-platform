import * as XLSX from "xlsx";

export type ContactExportMode = "date" | "tag" | "utm";

type ContactExportTag = {
  name?: string | null;
};

export type ContactExportRowInput = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  origem?: string | null;
  tags?: ContactExportTag[] | null;
  utms?: unknown;
  meta_ads_referral?: unknown;
  meta_ads_utm?: unknown;
  meta_ads_attributed_at?: string | null;
  meta_ads_source_url?: string | null;
  meta_ads_source_type?: string | null;
  meta_ads_source_id?: string | null;
  meta_ads_headline?: string | null;
  meta_ads_body?: string | null;
  meta_ads_media_type?: string | null;
  meta_ads_image_url?: string | null;
  meta_ads_video_url?: string | null;
  meta_ads_thumbnail_url?: string | null;
  meta_ads_ctwa_clid?: string | null;
  meta_ads_message_id?: string | null;
  meta_ads_phone_number_id?: string | null;
  data_cadastro?: string | null;
  data_aniversario?: string | null;
  last_contact?: string | null;
  total_purchases?: number | string | null;
  total_spent?: number | string | null;
  average_ticket?: number | string | null;
  last_purchase_at?: string | null;
  total_interactions?: number | string | null;
  last_interaction?: string | null;
  total_history_entries?: number | string | null;
  total_whatsapp_attendances?: number | string | null;
  last_whatsapp_attendance?: string | null;
  crm_nome?: string | null;
  crm_stage_name?: string | null;
  crm_title?: string | null;
  crm_responsible_name?: string | null;
};

export type ContactExportCriteria = {
  mode: ContactExportMode;
  dateStart?: string | null;
  dateEnd?: string | null;
  tagNames?: string[];
  utm?: string | null;
  totalContacts?: number;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-");
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString("pt-BR");
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("pt-BR");
}

function normalizeNumber(value?: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function textValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function collectUtmValues(
  utms: Array<Record<string, string>>,
  key: string
) {
  return [...new Set(
    utms
      .map((utm) => String(utm[key] || "").trim())
      .filter(Boolean)
  )].join(" | ");
}

function buildUtmSummary(utms: Array<Record<string, string>>) {
  return utms
    .map((utm) =>
      Object.entries(utm)
        .filter(([, value]) => String(value || "").trim())
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
    )
    .filter(Boolean)
    .join(" || ");
}

function formatExportMode(mode: ContactExportMode) {
  switch (mode) {
    case "date":
      return "Data de entrada";
    case "tag":
      return "Tag";
    default:
      return "UTM";
  }
}

export function exportContactsWorkbook(params: {
  rows: ContactExportRowInput[];
  filename: string;
  criteria: ContactExportCriteria;
}) {
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    { Campo: "Tipo de exportacao", Valor: formatExportMode(params.criteria.mode) },
    { Campo: "Gerado em", Valor: new Date().toLocaleString("pt-BR") },
    { Campo: "Total de contatos", Valor: Number(params.criteria.totalContacts || 0) },
    {
      Campo: "Periodo inicial",
      Valor: formatDate(params.criteria.dateStart || ""),
    },
    {
      Campo: "Periodo final",
      Valor: formatDate(params.criteria.dateEnd || ""),
    },
    {
      Campo: "Tags",
      Valor: Array.isArray(params.criteria.tagNames)
        ? params.criteria.tagNames.filter(Boolean).join(", ")
        : "",
    },
    {
      Campo: "UTM",
      Valor: String(params.criteria.utm || "").trim(),
    },
  ];

  const normalizedRows = params.rows.map((row) => {
    const utms = parseUtms(row.utms);
    const referral = parseObject(row.meta_ads_referral);
    const metaAdsUtm = parseObject(row.meta_ads_utm);

    return {
      Nome: String(row.name || "").trim(),
      Telefone: String(row.phone || "").trim(),
      Email: String(row.email || "").trim(),
      CPF: String(row.cpf || "").trim(),
      Origem: String(row.origem || "").trim(),
      Tags: Array.isArray(row.tags)
        ? row.tags
            .map((tag) => String(tag?.name || "").trim())
            .filter(Boolean)
            .join(", ")
        : "",
      "Data de cadastro": formatDate(row.data_cadastro),
      Aniversario: formatDate(row.data_aniversario),
      "Ultimo contato": formatDateTime(row.last_contact),
      "Total de compras": normalizeNumber(row.total_purchases),
      "Valor total gasto": normalizeNumber(row.total_spent),
      "Ticket medio": normalizeNumber(row.average_ticket),
      "Ultima compra": formatDateTime(row.last_purchase_at),
      "Total de interacoes": normalizeNumber(row.total_interactions),
      "Ultima interacao": formatDateTime(row.last_interaction),
      "Historicos registrados": normalizeNumber(row.total_history_entries),
      "Atendimentos WhatsApp": normalizeNumber(row.total_whatsapp_attendances),
      "Ultimo atendimento WhatsApp": formatDateTime(row.last_whatsapp_attendance),
      Funil: String(row.crm_nome || "").trim(),
      "Etapa do funil": String(row.crm_stage_name || "").trim(),
      "Titulo do funil": String(row.crm_title || "").trim(),
      "Responsavel do funil": String(row.crm_responsible_name || "").trim(),
      "UTM Source": collectUtmValues(utms, "utm_source"),
      "UTM Medium": collectUtmValues(utms, "utm_medium"),
      "UTM Campaign": collectUtmValues(utms, "utm_campaign"),
      "UTM Term": collectUtmValues(utms, "utm_term"),
      "UTM Content": collectUtmValues(utms, "utm_content"),
      "UTM ID": collectUtmValues(utms, "utm_id"),
      "Resumo UTMs": buildUtmSummary(utms),
      "Meta Ads - ID do anuncio": textValue(row.meta_ads_source_id ?? referral.source_id),
      "Meta Ads - Tipo da origem": textValue(row.meta_ads_source_type ?? referral.source_type),
      "Meta Ads - URL de origem": textValue(row.meta_ads_source_url ?? referral.source_url),
      "Meta Ads - Titulo": textValue(row.meta_ads_headline ?? referral.headline),
      "Meta Ads - Texto": textValue(row.meta_ads_body ?? referral.body),
      "Meta Ads - Tipo de midia": textValue(row.meta_ads_media_type ?? referral.media_type),
      "Meta Ads - URL da imagem": textValue(row.meta_ads_image_url ?? referral.image_url),
      "Meta Ads - URL do video": textValue(row.meta_ads_video_url ?? referral.video_url),
      "Meta Ads - URL da miniatura": textValue(row.meta_ads_thumbnail_url ?? referral.thumbnail_url),
      "Meta Ads - CTWA Click ID": textValue(row.meta_ads_ctwa_clid ?? referral.ctwa_clid),
      "Meta Ads - UTM Source": textValue(metaAdsUtm.utm_source),
      "Meta Ads - UTM Medium": textValue(metaAdsUtm.utm_medium),
      "Meta Ads - UTM Campaign": textValue(metaAdsUtm.utm_campaign),
      "Meta Ads - UTM Content": textValue(metaAdsUtm.utm_content),
      "Meta Ads - UTM Term": textValue(metaAdsUtm.utm_term),
      "Meta Ads - FBCLID": textValue(metaAdsUtm.fbclid),
      "Meta Ads - GCLID": textValue(metaAdsUtm.gclid),
      "Meta Ads - ID da mensagem": textValue(row.meta_ads_message_id),
      "Meta Ads - ID do numero WhatsApp": textValue(row.meta_ads_phone_number_id),
      "Meta Ads - Atribuido em": formatDateTime(row.meta_ads_attributed_at),
      "Meta Ads - Referral completo": JSON.stringify(referral),
    };
  });

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  const contactsSheet = XLSX.utils.json_to_sheet(normalizedRows);

  summarySheet["!cols"] = [
    { wch: 24 },
    { wch: 48 },
  ];

  contactsSheet["!cols"] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 42 },
    { wch: 24 },
    { wch: 20 },
    { wch: 42 },
    { wch: 32 },
    { wch: 48 },
    { wch: 20 },
    { wch: 42 },
    { wch: 42 },
    { wch: 42 },
    { wch: 38 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
    { wch: 24 },
    { wch: 22 },
    { wch: 28 },
    { wch: 28 },
    { wch: 34 },
    { wch: 30 },
    { wch: 22 },
    { wch: 60 },
  ];

  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
  XLSX.utils.book_append_sheet(workbook, contactsSheet, "Contatos");
  XLSX.writeFile(workbook, params.filename);
}
