import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Modal } from "../common/Modal/Modal";
import type { Branch, Category, Supplier, Product } from "../../data/mockData";
import { parseProductsFromXlsx, type ImportedProductPayload } from "../../utils/importProductsFromXlsx";
import "./ImportProductsModal.css";

type ImportConflictMode = "create" | "update" | "skip";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    branches: Branch[];
    categories: Category[];
    suppliers: Supplier[];
    existingProducts: Product[];
    existingProductsLoading?: boolean;
    onImportOne: (params: {
        product: ImportedProductPayload;
        existingProduct: Product | null;
        conflictMode: ImportConflictMode;
    }) => Promise<void>;
    onDone?: () => void; // ex: fetchProducts()
};

type RowResult = {
    index: number;
    rowNumber: number;
    sku: string;
    name: string;
    ok: boolean;
    error?: string;
};

export function ImportProductsModal({
    isOpen,
    onClose,
    branches,
    categories,
    suppliers,
    existingProducts,
    existingProductsLoading = false,
    onImportOne,
    onDone,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const [loadingParse, setLoadingParse] = useState(false);
    const [products, setProducts] = useState<ImportedProductPayload[]>([]);
    const [parseErrors, setParseErrors] = useState<{ row: number; field?: string; message: string }[]>([]);
    const [parseWarnings, setParseWarnings] = useState<{ row: number; field?: string; message: string }[]>([]);

    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [conflictMode, setConflictMode] = useState<ImportConflictMode>("update");
    // const [results, setResults] = useState<RowResult[]>([]);

    const existingProductsBySku = useMemo(() => {
        const map = new Map<string, Product>();
        existingProducts.forEach((product) => {
            const key = String(product.sku || "").trim().toLowerCase();
            if (key && !map.has(key)) {
                map.set(key, product);
            }
        });
        return map;
    }, [existingProducts]);

    const duplicateCandidates = useMemo(() => {
        return products.filter((product) =>
            existingProductsBySku.has(String(product.sku || "").trim().toLowerCase())
        );
    }, [existingProductsBySku, products]);

    const importPlan = useMemo(() => {
        const existingCount = duplicateCandidates.length;
        const newCount = Math.max(0, products.length - existingCount);

        if (conflictMode === "update") {
            return { createCount: newCount, updateCount: existingCount, skipCount: 0 };
        }

        if (conflictMode === "skip") {
            return { createCount: newCount, updateCount: 0, skipCount: existingCount };
        }

        return { createCount: products.length, updateCount: 0, skipCount: 0 };
    }, [conflictMode, duplicateCandidates.length, products.length]);

    const canImport = useMemo(() => {
        return (
            products.length > 0 &&
            parseErrors.length === 0 &&
            !importing &&
            !existingProductsLoading
        );
    }, [products, parseErrors, importing, existingProductsLoading]);

    const resetAll = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setFile(null);
        setProducts([]);
        setParseErrors([]);
        setParseWarnings([]);
        setImporting(false);
        setProgress({ done: 0, total: 0 });
        // setResults([]);
        setLoadingParse(false);
    };

    const handlePickFile = async (f: File) => {
        resetAll();
        setFile(f);
        setLoadingParse(true);
        try {
            const { products, errors, warnings } = await parseProductsFromXlsx(
                f,
                branches,
                categories,
                suppliers
            );
            setProducts(products);
            setParseErrors(errors);
            setParseWarnings(warnings);
        } catch (e: any) {
            setParseErrors([{ row: 0, message: e?.message || "Falha ao ler XLSX." }]);
        } finally {
            setLoadingParse(false);
        }
    };

    const handleDownloadTemplate = () => {
        const sampleBranch = branches[0];
        const sampleCategory = categories[0];
        const sampleSupplier = suppliers[0];
        const rows = [
            {
                nome: "Produto Exemplo",
                codigo: "7890000000001",
                precoCusto: 10.5,
                precoVenda: 19.9,
                fornecedorId: sampleSupplier?.id || "",
                nomeDoFornecedor: sampleSupplier?.name || "Fornecedor Exemplo",
                categorias: sampleCategory?.name || "",
                estoquePrincipal: sampleBranch ? `${sampleBranch.id}:10` : "",
                estoqueVitrine: sampleBranch ? `${sampleBranch.id}:2` : "",
                vendidoPorPeso: "nao",
            },
        ];

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Produtos");
        XLSX.writeFile(workbook, "modelo_importacao_produtos.xls", {
            bookType: "biff8",
        });
    };

    // const downloadCsvReport = () => {
    //     const lines = [
    //         ["rowNumber", "sku", "name", "status", "message"].join(","),
    //         ...results.map((r) =>
    //             [
    //                 r.rowNumber,
    //                 JSON.stringify(r.sku),
    //                 JSON.stringify(r.name),
    //                 r.ok ? "OK" : "ERROR",
    //                 JSON.stringify(r.error || ""),
    //             ].join(",")
    //         ),
    //     ];
    //     const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    //     const url = URL.createObjectURL(blob);
    //     const a = document.createElement("a");
    //     a.href = url;
    //     a.download = "import_produtos_resultado.csv";
    //     a.click();
    //     URL.revokeObjectURL(url);
    // };

    const handleImport = async () => {
        setImporting(true);
        // setResults([]);
        setProgress({ done: 0, total: products.length });

        const nextResults: RowResult[] = [];

        for (let i = 0; i < products.length; i++) {
            const p = products[i];
            const existingProduct =
                existingProductsBySku.get(String(p.sku || "").trim().toLowerCase()) || null;

            // linha “real”: como parser considera header na linha 1,
            // a linha do produto i é i+2
            const rowNumber = i + 2;

            try {
                if (!(existingProduct && conflictMode === "skip")) {
                    await onImportOne({
                        product: p,
                        existingProduct,
                        conflictMode,
                    });
                }
                nextResults.push({
                    index: i,
                    rowNumber,
                    sku: p.sku,
                    name: p.name,
                    ok: true,
                });
            } catch (e: any) {
                nextResults.push({
                    index: i,
                    rowNumber,
                    sku: p.sku,
                    name: p.name,
                    ok: false,
                    error: e?.message || "Erro ao cadastrar.",
                });
            } finally {
                setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
                // setResults([...nextResults]); // atualiza em tempo real
            }
        }

        setImporting(false);
        onDone?.();
    };

    const preview = products.slice(0, 20);

    return (
        <Modal isOpen={isOpen} onClose={() => { resetAll(); onClose(); }} title="Importar Produtos (Excel)">
            <div className="import-products-modal">
                <div className="import-row">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handlePickFile(f);
                        }}
                    />
                    <button type="button" className="secondary-btn" onClick={resetAll} disabled={importing || loadingParse}>
                        Limpar
                    </button>
                    <button type="button" className="secondary-btn" onClick={handleDownloadTemplate} disabled={importing || loadingParse}>
                          .xls
                    </button>
                </div>

                <div className="import-mode-panel">
                    <strong>Quando o SKU ja existir no estoque</strong>
                    <label>
                        <input
                            type="radio"
                            name="conflictMode"
                            value="update"
                            checked={conflictMode === "update"}
                            onChange={() => setConflictMode("update")}
                            disabled={importing}
                        />
                        Atualizar produto existente
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="conflictMode"
                            value="skip"
                            checked={conflictMode === "skip"}
                            onChange={() => setConflictMode("skip")}
                            disabled={importing}
                        />
                        Ignorar produto existente
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="conflictMode"
                            value="create"
                            checked={conflictMode === "create"}
                            onChange={() => setConflictMode("create")}
                            disabled={importing}
                        />
                        Tentar criar mesmo assim
                    </label>
                </div>

                <div className="import-plan-panel">
                    <strong>Resumo antes de importar</strong>
                    <div className="import-plan-grid">
                        <div className="import-plan-card">
                            <span>Criar</span>
                            <strong>{importPlan.createCount}</strong>
                        </div>
                        <div className="import-plan-card">
                            <span>Atualizar</span>
                            <strong>{importPlan.updateCount}</strong>
                        </div>
                        <div className="import-plan-card">
                            <span>Ignorar</span>
                            <strong>{importPlan.skipCount}</strong>
                        </div>
                    </div>
                </div>

                {file && (
                    <div className="file-info">
                        <strong>Arquivo:</strong> {file.name}
                    </div>
                )}

                {existingProductsLoading && <p>Carregando produtos existentes para validar duplicidades...</p>}

                {loadingParse && <p>Lendo e validando planilha...</p>}

                {parseErrors.length > 0 && (
                    <div className="import-errors">
                        <h4>Erros (corrija antes de importar)</h4>
                        <ul>
                            {parseErrors.slice(0, 50).map((e, idx) => (
                                <li key={idx}>
                                    <strong>Linha {e.row || "?"}:</strong> {e.field ? `[${e.field}] ` : ""}{e.message}
                                </li>
                            ))}
                        </ul>
                        {parseErrors.length > 50 && <p>Mostrando 50 de {parseErrors.length}.</p>}
                    </div>
                )}

                {parseWarnings.length > 0 && (
                    <div className="import-warnings">
                        <h4>Avisos (não bloqueiam importação)</h4>
                        <ul>
                            {parseWarnings.slice(0, 50).map((w, idx) => (
                                <li key={idx}>
                                    <strong>Linha {w.row || "?"}:</strong> {w.field ? `[${w.field}] ` : ""}{w.message}
                                </li>
                            ))}
                        </ul>
                        {parseWarnings.length > 50 && <p>Mostrando 50 de {parseWarnings.length}.</p>}
                    </div>
                )}

                {products.length > 0 && parseErrors.length === 0 && (
                    <>
                        <div className="import-summary">
                            <div><strong>Total na planilha:</strong> {products.length}</div>
                            <div><strong>Preview:</strong> mostrando {preview.length} primeiras linhas</div>
                            <div><strong>SKUs ja existentes:</strong> {duplicateCandidates.length}</div>
                        </div>

                        <div className="import-preview-table">
                            <div className="table-head">
                                <span>Linha</span>
                                <span>SKU</span>
                                <span>Nome</span>
                                <span>Fornecedor</span>
                                <span>Venda</span>
                                <span>Custo</span>
                            </div>
                            {preview.map((p, i) => (
                                <div className="table-row" key={`${p.sku}-${i}`}>
                                    <span>{i + 2}</span>
                                    <span>{p.sku}</span>
                                    <span>{p.name}</span>
                                    <span>{p.supplierName}</span>
                                    <span>{p.salePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                    <span>{p.costPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                </div>
                            ))}
                        </div>

                        <div className="import-actions">
                            <button type="button" className="cancel-button" onClick={() => { resetAll(); onClose(); }} disabled={importing}>
                                Fechar
                            </button>
                            <button type="button" className="save-button" onClick={handleImport} disabled={!canImport}>
                                Importar {products.length} produtos
                            </button>

                        </div>

                        {importing && (
                            <div className="import-progress">
                                <strong>Importando:</strong> {progress.done}/{progress.total}
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* {results.length > 0 && (
                            <div className="import-results">
                                <div className="results-header">
                                    <h4>Resultado</h4>
                                    <button type="button" className="save-button" onClick={downloadCsvReport}>
                                        Baixar relatório CSV
                                    </button>
                                </div>

                                <div className="results-list">
                                    {results.slice(0, 200).map((r) => (
                                        <div key={`${r.index}`} className={`result-item ${r.ok ? "ok" : "fail"}`}>
                                            <strong>Linha {r.rowNumber}</strong> — {r.sku} — {r.name} — {r.ok ? "OK" : `ERRO: ${r.error}`}
                                        </div>
                                    ))}
                                    {results.length > 200 && <p>Mostrando 200 de {results.length}.</p>}
                                </div>
                            </div>
                        )} */}
                    </>
                )}

                {!file && (
                    <div className="import-help">
                        <h4>Formato esperado</h4>

                        <p>
                            Colunas mínimas:
                            {" "}
                            <code>nome</code>, <code>codigo</code>, <code>precoCusto</code>,{" "}
                            <code>precoVenda</code>, <code>fornecedorId</code>
                            {" "}.
                        </p>

                        <p>
                            Colunas opcionais:
                            {" "}
                            <code>categorias</code>, <code>estoquePrincipal</code>,{" "}
                            <code>estoqueVitrine</code> e <code>vendidoPorPeso</code>.
                        </p>

                        <p>
                            Fornecedor:
                            {" "}
                            além de <code>fornecedorId</code>, você pode usar{" "}
                            <code>nomeDoFornecedor</code> para criar ou reutilizar pelo nome.
                        </p>

                        <p>
                            Estoque:
                            {" "}
                            use <code>filialId:qtd</code> em cada coluna. Exemplo:{" "}
                            <code>10:10</code> significa 10 itens na filial 10, e{" "}
                            <code>10:2</code> significa 2 itens na vitrine da filial 10.
                        </p>

                        <p>
                            Para mais de uma filial na mesma célula, use{" "}
                            <code>1:10;2:5</code>. Se existir apenas uma filial cadastrada,
                            você também pode informar só a quantidade, como <code>30</code>.
                        </p>

                        {/* <p>
                            Categorias (opcional):
                            {" "}
                            <code>categoriasId</code> (ex: <code>1;4;7</code>)
                            {" "}
                            ou <code>categorias</code> (ex: <code>Brincos;Prata</code>).
                        </p>

                        <p>
                            Estoque (opcional):
                            {" "}
                            <code>estoquePrincipal</code> e <code>estoqueVitrine</code>
                            {" "}
                            no formato <code>filialId:qtd;filialId:qtd</code>
                            {" "}
                            (ex: <code>1:10;2:5</code>).
                        </p> */}
                    </div>
                )}

            </div>
        </Modal>
    );
}
