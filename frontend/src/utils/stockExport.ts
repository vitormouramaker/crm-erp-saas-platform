import * as XLSX from "xlsx";

type StockExportRow = Record<string, string | number | boolean>;

function slugifyFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function exportStockWorkbook(rows: StockExportRow[], filenameBase: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Estoque");

  const dateSuffix = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${slugifyFilename(filenameBase)}_${dateSuffix}.xlsx`);
}
