import * as XLSX from "xlsx";

type Primitive = string | number | boolean | null | undefined;

type ExportSheet = {
  name: string;
  rows: Array<Record<string, unknown>>;
};

function shouldOmitExportKey(path: string) {
  const normalizedSegments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());

  return normalizedSegments.some(
    (segment) =>
      segment === "id" ||
      segment.endsWith("_id") ||
      segment.endsWith("ids") ||
      segment.endsWith("_ids")
  );
}

function toCellValue(value: unknown): Primitive {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return JSON.stringify(value);
}

function flattenValue(
  value: unknown,
  path: string,
  target: Record<string, Primitive>
) {
  if (shouldOmitExportKey(path)) {
    return;
  }

  if (Array.isArray(value)) {
    if (value.every((item) => item == null || ["string", "number", "boolean"].includes(typeof item))) {
      target[path] = value.map((item) => toCellValue(item)).join("; ");
      return;
    }

    target[path] = JSON.stringify(value);
    return;
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    Object.entries(value as Record<string, unknown>).forEach(([key, nestedValue]) => {
      const nextPath = path ? `${path}.${key}` : key;
      flattenValue(nestedValue, nextPath, target);
    });
    return;
  }

  target[path] = toCellValue(value);
}

function flattenRow(row: Record<string, unknown>) {
  const flattened: Record<string, Primitive> = {};

  Object.entries(row).forEach(([key, value]) => {
    flattenValue(value, key, flattened);
  });

  return flattened;
}

export function exportFinanceiroWorkbook(
  sheets: ExportSheet[],
  filename: string
) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const normalizedRows = sheet.rows.map((row) => flattenRow(row));
    const worksheet = XLSX.utils.json_to_sheet(normalizedRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  });

  XLSX.writeFile(workbook, filename);
}
