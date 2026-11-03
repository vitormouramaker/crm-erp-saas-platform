import * as XLSX from "xlsx";

export type ImportedContactRow = {
  linha: number;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  data_aniversario: string | null;
  tags: string[];
  utms: Array<Record<string, unknown>>;
};

export type ContactImportIssue = {
  row: number;
  field?: string;
  message: string;
};

export const CONTACT_IMPORT_HEADERS = [
  {
    key: "nome",
    required: false,
    aliases: ["nome", "name", "cliente", "contact_name"],
    description: "Nome do contato. Se ficar vazio, tentamos usar email ou telefone como identificação visual.",
  },
  {
    key: "telefone",
    required: true,
    aliases: ["telefone", "phone", "celular", "whatsapp"],
    description: "Telefone principal do contato. Campo obrigatório.",
  },
  {
    key: "email",
    required: false,
    aliases: ["email", "e-mail", "mail"],
    description: "Email do contato.",
  },
  {
    key: "data_aniversario",
    required: false,
    aliases: ["data_aniversario", "aniversario", "birthday", "data_nascimento"],
    description: "Data no formato YYYY-MM-DD ou DD/MM/YYYY.",
  },
  {
    key: "tags",
    required: false,
    aliases: ["tags", "tag"],
    description: "Lista separada por vírgula, ponto e vírgula ou barra vertical. Ex: VIP; Lead quente",
  },
  {
    key: "utm_source",
    required: false,
    aliases: ["utm_source"],
    description: "UTM source do contato.",
  },
  {
    key: "utm_medium",
    required: false,
    aliases: ["utm_medium"],
    description: "UTM medium do contato.",
  },
  {
    key: "utm_campaign",
    required: false,
    aliases: ["utm_campaign"],
    description: "UTM campaign do contato.",
  },
  {
    key: "utm_term",
    required: false,
    aliases: ["utm_term"],
    description: "UTM term do contato.",
  },
  {
    key: "utm_content",
    required: false,
    aliases: ["utm_content"],
    description: "UTM content do contato.",
  },
  {
    key: "utm_id",
    required: false,
    aliases: ["utm_id"],
    description: "UTM id do contato.",
  },
  {
    key: "utms_json",
    required: false,
    aliases: ["utms_json", "utms", "utm_json"],
    description: "Opcional. JSON com um array de UTMs, seguindo o esquema salvo no banco.",
  },
];

export const CONTACT_IMPORT_SAMPLE_ROW = {
  nome: "Maria Silva",
  telefone: "11999998888",
  email: "maria@empresa.com",
  data_aniversario: "1990-05-10",
  tags: "VIP; Lead quente; Meta Ads",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "campanha_maio",
  utm_term: "crm comercial",
  utm_content: "anuncio_a",
  utm_id: "utm-001",
};

export function downloadContactImportTemplate() {
  const headers = CONTACT_IMPORT_HEADERS.map((header) => header.key);
  const sampleRow = headers.map(
    (header) => CONTACT_IMPORT_SAMPLE_ROW[header as keyof typeof CONTACT_IMPORT_SAMPLE_ROW] || "",
  );
  const worksheet = XLSX.utils.aoa_to_sheet([headers, sampleRow]);

  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.max(header.length + 4, 18),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Contatos");
  XLSX.writeFile(workbook, "modelo_importacao_contatos.xlsx");
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

function asString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || "";
}

function normalizeOptionalString(value: unknown) {
  const normalized = asString(value);
  return normalized || null;
}

function normalizeBirthday(value: unknown) {
  const normalized = asString(value);
  if (!normalized) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const brMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }

  return null;
}

function splitTags(value: unknown) {
  return [...new Set(
    asString(value)
      .split(/[,;|]/g)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function parseUtmsJson(value: unknown) {
  const normalized = asString(value);
  if (!normalized) return [];

  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item) => item && typeof item === "object" && !Array.isArray(item),
      ) as Array<Record<string, unknown>>;
    }

    if (parsed && typeof parsed === "object") {
      return [parsed as Record<string, unknown>];
    }

    return [];
  } catch {
    return null;
  }
}

function getCanonicalValue(row: Record<string, unknown>, aliases: string[]) {
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }
  return "";
}

export async function parseContactsFromSpreadsheet(file: File): Promise<{
  rows: ImportedContactRow[];
  errors: ContactImportIssue[];
  warnings: ContactImportIssue[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });

  const rows: ImportedContactRow[] = [];
  const errors: ContactImportIssue[] = [];
  const warnings: ContactImportIssue[] = [];

  rawRows.forEach((raw, index) => {
    const linha = index + 2;
    const normalizedRow: Record<string, unknown> = {};

    Object.keys(raw).forEach((key) => {
      normalizedRow[normalizeHeader(key)] = raw[key];
    });

    const nome = normalizeOptionalString(getCanonicalValue(normalizedRow, ["nome", "name", "cliente", "contact_name"]));
    const telefone = normalizeOptionalString(
      getCanonicalValue(normalizedRow, ["telefone", "phone", "celular", "whatsapp"]),
    );
    const email = normalizeOptionalString(getCanonicalValue(normalizedRow, ["email", "e-mail", "mail"]));
    const birthdayRaw = getCanonicalValue(normalizedRow, [
      "data_aniversario",
      "aniversario",
      "birthday",
      "data_nascimento",
    ]);
    const data_aniversario = normalizeBirthday(birthdayRaw);
    const tags = splitTags(getCanonicalValue(normalizedRow, ["tags", "tag"]));

    const utmSource = normalizeOptionalString(getCanonicalValue(normalizedRow, ["utm_source"]));
    const utmMedium = normalizeOptionalString(getCanonicalValue(normalizedRow, ["utm_medium"]));
    const utmCampaign = normalizeOptionalString(getCanonicalValue(normalizedRow, ["utm_campaign"]));
    const utmTerm = normalizeOptionalString(getCanonicalValue(normalizedRow, ["utm_term"]));
    const utmContent = normalizeOptionalString(getCanonicalValue(normalizedRow, ["utm_content"]));
    const utmId = normalizeOptionalString(getCanonicalValue(normalizedRow, ["utm_id"]));
    const utmsJson = parseUtmsJson(
      getCanonicalValue(normalizedRow, ["utms_json", "utms", "utm_json"]),
    );

    if (utmsJson === null) {
      errors.push({
        row: linha,
        field: "utms_json",
        message: "O campo utms_json precisa conter um JSON valido.",
      });
      return;
    }

    if (birthdayRaw && !data_aniversario) {
      warnings.push({
        row: linha,
        field: "data_aniversario",
        message: "Data de aniversario ignorada por estar fora do formato esperado.",
      });
    }

    if (!telefone) {
      warnings.push({
        row: linha,
        field: "telefone",
        message: "Linha ignorada por nao conter telefone.",
      });
      return;
    }

    const utms: Array<Record<string, unknown>> = [...utmsJson];
    if (utmSource || utmMedium || utmCampaign || utmTerm || utmContent || utmId) {
      utms.push(
        Object.fromEntries(
          Object.entries({
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            utm_term: utmTerm,
            utm_content: utmContent,
            utm_id: utmId,
          }).filter(([, value]) => value),
        ),
      );
    }

    rows.push({
      linha,
      nome,
      telefone,
      email,
      data_aniversario,
      tags,
      utms,
    });
  });

  return { rows, errors, warnings };
}
