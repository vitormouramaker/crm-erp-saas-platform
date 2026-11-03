import * as XLSX from "xlsx";
import type { Branch, Category, Supplier, Product } from "../data/mockData";

export type ImportedProductPayload = Omit<Product, "id" | "movementHistory"> & {
  missingCategoryNames?: string[];
  missingSupplierName?: string;
};

export type ImportRowError = {
  row: number;
  field?: string;
  message: string;
};

function normHeader(h: any) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

function asString(v: any) {
  return String(v ?? "").trim();
}

function parseBRL(v: any): number {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v;

  const s = String(v).trim();
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function firstValidNumber(...values: number[]): number {
  return values.find((value) => Number.isFinite(value)) ?? NaN;
}

function parseBool(v: any): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "sim" || s === "yes";
}

function parseIdList(v: any): number[] {
  if (!v) return [];
  return String(v)
    .split(/[,;|]/g)
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseNameList(v: any): string[] {
  if (!v) return [];
  return String(v)
    .split(/[,;|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseBranchQtyPairs(v: any): Map<number, number> {
  const out = new Map<number, number>();
  if (!v) return out;

  String(v)
    .split(/;/g)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [idRaw, qtyRaw] = pair.split(":").map((x) => x.trim());
      const id = Number(idRaw);
      const qty = Number(qtyRaw);
      if (!Number.isFinite(id) || id <= 0) return;
      if (!Number.isFinite(qty) || qty < 0) return;
      out.set(id, qty);
    });

  return out;
}

function parseStockInput(
  v: any,
  branches: Branch[],
  rowNumber: number,
  field: string,
  errors: ImportRowError[],
  warnings: ImportRowError[]
): Map<number, number> {
  const rawValue = String(v ?? "").trim();
  if (!rawValue) return new Map<number, number>();

  const singleQty = Number(rawValue);
  if (Number.isFinite(singleQty) && singleQty >= 0 && !rawValue.includes(":")) {
    if (branches.length === 1) {
      return new Map<number, number>([[branches[0].id, singleQty]]);
    }

    errors.push({
      row: rowNumber,
      field,
      message: `Use o formato filialId:qtd em ${field} quando houver mais de uma filial cadastrada.`,
    });
    return new Map<number, number>();
  }

  const pairMap = parseBranchQtyPairs(rawValue);

  if (pairMap.size > 0) {
    const knownBranchIds = new Set(branches.map((branch) => branch.id));
    const unknownBranchIds = Array.from(pairMap.keys()).filter(
      (branchId) => !knownBranchIds.has(branchId)
    );
    const hasKnownBranch = unknownBranchIds.length < pairMap.size;

    if (!hasKnownBranch) {
      const fallbackBranch =
        branches.find((branch) => branch.isPrimary) ?? branches[0];

      if (!fallbackBranch) {
        errors.push({
          row: rowNumber,
          field,
          message: `A planilha informa estoque para filial inexistente (${unknownBranchIds.join(
            ", "
          )}), e nenhuma filial foi carregada no sistema.`,
        });
        return new Map<number, number>();
      }

      const totalQty = Array.from(pairMap.values()).reduce(
        (sum, qty) => sum + qty,
        0
      );
      warnings.push({
        row: rowNumber,
        field,
        message: `Filial ID ${unknownBranchIds.join(
          ", "
        )} nao existe para esta empresa. O estoque sera aplicado na filial primaria "${fallbackBranch.name}" (ID ${fallbackBranch.id}).`,
      });
      return new Map<number, number>([[fallbackBranch.id, totalQty]]);
    }

    if (unknownBranchIds.length > 0) {
      errors.push({
        row: rowNumber,
        field,
        message: `A planilha informa filial inexistente (${unknownBranchIds.join(
          ", "
        )}). Ajuste para um ID de filial valido antes de importar.`,
      });
    }
  }

  return pairMap;
}

export async function parseProductsFromXlsx(
  file: File,
  branches: Branch[],
  categories: Category[],
  suppliers: Supplier[]
): Promise<{
  products: ImportedProductPayload[];
  errors: ImportRowError[];
  warnings: ImportRowError[];
}> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const errors: ImportRowError[] = [];
  const warnings: ImportRowError[] = [];
  const products: ImportedProductPayload[] = [];
  const seenSku = new Map<string, number>();

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const row: Record<string, any> = {};

    Object.keys(raw).forEach((k) => {
      row[normHeader(k)] = raw[k];
    });

    const name =
      asString(row["name"]) ||
      asString(row["nome"]) ||
      asString(row["produtonome"]);

    const sku =
      asString(row["sku"]) ||
      asString(row["codigo"]) ||
      asString(row["codigobarras"]) ||
      asString(row["barras"]);

    const costPrice = firstValidNumber(
      parseBRL(row["costprice"]),
      parseBRL(row["precocusto"]),
      parseBRL(row["custo"]),
      parseBRL(row["valorcusto"])
    );

    const salePrice = firstValidNumber(
      parseBRL(row["saleprice"]),
      parseBRL(row["precovenda"]),
      parseBRL(row["venda"]),
      parseBRL(row["valorvenda"])
    );

    const supplierId = Number(
      asString(row["supplierid"]) ||
        asString(row["fornecedorid"]) ||
        asString(row["idfornecedor"]) ||
        asString(row["iddofornecedor"])
    );

    const supplierName =
      asString(row["suppliername"]) ||
      asString(row["fornecedor"]) ||
      asString(row["nomefornecedor"]) ||
      asString(row["nomedofornecedor"]) ||
      asString(row["fornecedornome"]);

    const isSoldByWeight =
      parseBool(row["issoldbyweight"]) ||
      parseBool(row["vendidoporpeso"]) ||
      parseBool(row["pesokg"]) ||
      parseBool(row["porpeso"]);

    const categoryIds = parseIdList(
      row["categoryids"] || row["categoriasid"] || row["categoriIds"]
    );

    const categoryNames = parseNameList(
      row["categories"] ||
        row["categorias"] ||
        row["categorynames"] ||
        row["categoria"] ||
        row["nomedacategoria"]
    );

    const resolvedCategories: Category[] = [];
    const missingCategoryNames: string[] = [];
    const missingCategoryIds: number[] = [];

    if (categoryIds.length) {
      categoryIds.forEach((id) => {
        const found = categories.find((c) => c.id === id);
        if (found) resolvedCategories.push(found);
        else missingCategoryIds.push(id);
      });
    } else if (categoryNames.length) {
      categoryNames.forEach((nm) => {
        const found = categories.find(
          (c) => c.name.toLowerCase() === nm.toLowerCase()
        );
        if (found) resolvedCategories.push(found);
        else missingCategoryNames.push(nm);
      });
    }

    const mainMap = parseStockInput(
      row["mainstocks"] || row["estoqueprincipal"] || row["estoque"],
      branches,
      rowNumber,
      "estoquePrincipal",
      errors,
      warnings
    );

    const showMap = parseStockInput(
      row["showcasestocks"] || row["estoquevitrine"] || row["vitrine"],
      branches,
      rowNumber,
      "estoqueVitrine",
      errors,
      warnings
    );

    const stockByFilial = branches
      .map((b) => {
        const main = mainMap.get(b.id) ?? 0;
        const show = showMap.get(b.id) ?? 0;
        return {
          id: b.id,
          filial: b.name,
          mainStock: main,
          showcaseStock: show,
        };
      })
      .filter((s) => s.mainStock > 0 || s.showcaseStock > 0);

    if (!name) {
      errors.push({
        row: rowNumber,
        field: "name/nome",
        message: 'Nome do produto vazio. Use a coluna "name" ou "nome".',
      });
    }

    if (!sku) {
      errors.push({
        row: rowNumber,
        field: "sku/codigo",
        message:
          'Codigo de barras vazio. Use a coluna "sku" ou "codigo" (ou "codigoBarras").',
      });
    }

    if (sku) {
      const prevRow = seenSku.get(sku);
      if (prevRow) {
        errors.push({
          row: rowNumber,
          field: "sku",
          message: `SKU duplicado no arquivo. Ja apareceu na linha ${prevRow}.`,
        });
      } else {
        seenSku.set(sku, rowNumber);
      }
    }

    if (!Number.isFinite(costPrice)) {
      errors.push({
        row: rowNumber,
        field: "costPrice/precoCusto",
        message: 'Preco de custo invalido. Use "costPrice" ou "precoCusto".',
      });
    }

    if (!Number.isFinite(salePrice)) {
      errors.push({
        row: rowNumber,
        field: "salePrice/precoVenda",
        message: 'Preco de venda invalido. Use "salePrice" ou "precoVenda".',
      });
    }

    let finalSupplierName = "";
    let missingSupplierName = "";

    if (Number.isFinite(supplierId) && supplierId > 0) {
      const found = suppliers.find((s) => s.id === supplierId);
      if (!found) {
        if (supplierName) {
          finalSupplierName = supplierName;
          missingSupplierName = supplierName;
          warnings.push({
            row: rowNumber,
            field: "Id do fornecedor",
            message: `Id do fornecedor=${supplierId} nao encontrado. O nome "${supplierName}" sera usado para criar ou reutilizar o fornecedor automaticamente.`,
          });
        } else {
          errors.push({
            row: rowNumber,
            field: "Id do fornecedor",
            message: `Id do fornecedor=${supplierId} nao encontrado na lista carregada.`,
          });
        }
      } else {
        finalSupplierName = found.name;
      }
    } else if (supplierName) {
      const found = suppliers.find(
        (s) => s.name.toLowerCase() === supplierName.toLowerCase()
      );
      finalSupplierName = found?.name || supplierName;
      if (!found) {
        missingSupplierName = supplierName;
        warnings.push({
          row: rowNumber,
          field: "Nome do fornecedor",
          message: `Fornecedor "${supplierName}" nao encontrado na lista. Ele sera criado ou reutilizado automaticamente.`,
        });
      }
    } else {
      errors.push({
        row: rowNumber,
        field: "Id do fornecedor",
        message: "Informe o Id do fornecedor ou o nome do fornecedor.",
      });
    }

    if (missingCategoryIds.length) {
      warnings.push({
        row: rowNumber,
        field: "Id da categoria",
        message: `Categorias nao encontradas (IDs): ${missingCategoryIds.join(", ")}.`,
      });
    }

    if (missingCategoryNames.length) {
      warnings.push({
        row: rowNumber,
        field: "Nome da categoria",
        message: `Categorias nao encontradas (nomes): ${missingCategoryNames.join(", ")}.`,
      });
    }

    const product: ImportedProductPayload = {
      name,
      sku,
      costPrice: Number.isFinite(costPrice) ? costPrice : 0,
      salePrice: Number.isFinite(salePrice) ? salePrice : 0,
      categories: resolvedCategories,
      supplierName: finalSupplierName,
      isSoldByWeight,
      stockByFilial,
      missingCategoryNames,
      missingSupplierName,
    };

    products.push(product);
  });

  return { products, errors, warnings };
}
