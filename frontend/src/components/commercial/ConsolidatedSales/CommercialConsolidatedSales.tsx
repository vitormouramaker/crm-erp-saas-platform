import { useEffect, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
  FiUserCheck,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import { Modal } from "../../common/Modal/Modal";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  assignIntegratedCommercialSaleSeller,
  deleteCommercialConsolidatedSale,
  getCommercialConsolidatedSales,
  getCommercialDomains,
  getCommercialProducts,
  importCommercialConsolidatedSales,
  updateCommercialDeal,
  updateImportedCommercialSale,
  type ConsolidatedSale,
  type Deal,
  type PaginatedConsolidatedSalesResult,
} from "../../../service/commercialService";
import "./CommercialConsolidatedSales.css";

const EMPTY_RESULT: PaginatedConsolidatedSalesResult = {
  items: [],
  total: 0,
  pagina: 1,
  limite: 20,
  total_paginas: 1,
};

type SaleEditDraft = {
  clienteNome: string;
  descricao: string;
  valor: string;
  vendidoEm: string;
  origem: string;
  vendedorId: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("pt-BR");
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "Nao informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function sourceLabel(source: ConsolidatedSale["fonte"]) {
  if (source === "importada") return "Importada";
  if (source === "hotmart") return "Hotmart";
  if (source === "hubla") return "Hubla";
  return "CRM";
}

export function CommercialConsolidatedSales() {
  const { user, hasPermission } = useAuth();
  const { addToast } = useToast();
  const [result, setResult] = useState<PaginatedConsolidatedSalesResult>(EMPTY_RESULT);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"" | ConsolidatedSale["fonte"]>("");
  const [ownerId, setOwnerId] = useState("");
  const [product, setProduct] = useState("");
  const [owners, setOwners] = useState<Array<{ id: number; nome: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: number; nome: string }>>([]);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingSale, setEditingSale] = useState<ConsolidatedSale | null>(null);
  const [editDraft, setEditDraft] = useState<SaleEditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const canManageSales = Boolean(user?.is_master) || hasPermission("commercial.manager");
  const tableColumnCount = canManageSales ? 9 : 8;

  const downloadImportModel = () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["cliente_nome", "telefone", "email", "produto", "valor", "data_venda", "origem", "vendedor_id", "observacoes"],
      ["Cliente exemplo", "5511999999999", "cliente@email.com", "Produto exemplo", 199.9, "2026-09-01", "Importacao", "", ""],
    ]);
    sheet["!cols"] = [22, 18, 28, 24, 14, 16, 18, 15, 36].map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Vendas importadas");
    XLSX.writeFile(workbook, "modelo_importacao_vendas.xlsx");
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const result = await importCommercialConsolidatedSales(rows);
      setPage(1);
      setSearch("");
      setSearchInput("");
      setRefreshKey((current) => current + 1);
      window.alert(`${result.imported} venda(s) importada(s).${result.errors?.length ? ` ${result.errors.length} linha(s) ignorada(s).` : ""}`);
    } catch (importError) {
      window.alert(importError instanceof Error ? importError.message : "Nao foi possivel importar as vendas.");
    }
  };

  const exportSales = async () => {
    const all: ConsolidatedSale[] = [];
    for (let currentPage = 1; currentPage <= result.total_paginas; currentPage += 1) {
      const response = await getCommercialConsolidatedSales({ source: source || undefined, search: search || undefined, ownerId: ownerId || undefined, product: product || undefined, dateStart: dateStart || undefined, dateEnd: dateEnd || undefined, page: currentPage, limit: 100 });
      all.push(...response.items);
    }
    const sheet = XLSX.utils.json_to_sheet(all.map((sale) => ({ Data: formatDate(sale.vendidoEm), Cliente: sale.clienteNome, Produto: sale.descricao, Fonte: sourceLabel(sale.fonte), Funil: sale.funilNome || "", Vendedor: sale.vendedorNome || "", Transacao: sale.transacaoId || "", Valor: sale.valor ?? "" })));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Vendas"); XLSX.writeFile(workbook, "vendas_unificadas.xlsx");
  };

  useEffect(() => {
    void Promise.all([getCommercialDomains(), getCommercialProducts()]).then(([domains, catalog]) => {
      setOwners((domains.responsaveis || []).map((owner) => ({ id: Number(owner.id), nome: owner.nome })));
      setProducts((catalog || []).map((item) => ({ id: Number(item.id), nome: item.nome })));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    void getCommercialConsolidatedSales({
      source: source || undefined,
      ownerId: ownerId || undefined,
      product: product || undefined,
      search: search || undefined,
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
      page,
      limit: 20,
    })
      .then((nextResult) => {
        if (active) setResult(nextResult);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar as vendas.");
        setResult(EMPTY_RESULT);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dateEnd, dateStart, ownerId, page, product, refreshKey, search, source]);

  const openEdit = (sale: ConsolidatedSale) => {
    setEditingSale(sale);
    setEditDraft({
      clienteNome: sale.clienteNome,
      descricao: sale.descricao,
      valor: String(sale.valor ?? 0),
      vendidoEm: sale.vendidoEm ? sale.vendidoEm.slice(0, 10) : "",
      origem: sale.origem || "",
      vendedorId: sale.vendedorId ? String(sale.vendedorId) : "",
    });
  };

  const closeEdit = () => {
    if (savingEdit) return;
    setEditingSale(null);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (!editingSale || !editDraft) return;
    const isIntegrated = editingSale.fonte === "hotmart" || editingSale.fonte === "hubla";
    const value = Number(editDraft.valor.replace(",", "."));
    if (
      !isIntegrated &&
      ((editingSale.fonte === "importada" && !editDraft.clienteNome.trim()) ||
        !editDraft.descricao.trim() ||
        !editDraft.vendidoEm ||
        !Number.isFinite(value) ||
        value < 0)
    ) {
      addToast({
        type: "error",
        title: "Revise os dados",
        description: "Informe a venda, a data e um valor valido.",
      });
      return;
    }

    try {
      setSavingEdit(true);
      if (editingSale.fonte === "crm") {
        const updates: Partial<Deal> = {
          title: editDraft.descricao.trim(),
          amount: value,
          saleDate: editDraft.vendidoEm,
          saleOrigin: editDraft.origem.trim(),
        };
        if (editDraft.vendedorId) updates.ownerId = editDraft.vendedorId;
        await updateCommercialDeal(editingSale.vendaId, updates, editingSale.crmId);
      } else if (editingSale.fonte === "importada") {
        await updateImportedCommercialSale(editingSale.vendaId, {
          clienteNome: editDraft.clienteNome.trim(),
          descricao: editDraft.descricao.trim(),
          valor: value,
          vendidoEm: editDraft.vendidoEm,
          origem: editDraft.origem.trim(),
          vendedorId: editDraft.vendedorId ? Number(editDraft.vendedorId) : null,
        });
      } else {
        await assignIntegratedCommercialSaleSeller(
          editingSale.fonte,
          editingSale.vendaId,
          editDraft.vendedorId ? Number(editDraft.vendedorId) : null
        );
      }

      setEditingSale(null);
      setEditDraft(null);
      setRefreshKey((current) => current + 1);
      addToast({
        type: "success",
        title: isIntegrated ? "Vendedor atribuido" : "Venda atualizada",
        description: isIntegrated
          ? "O responsavel pela venda foi atualizado."
          : "As alteracoes foram salvas com sucesso.",
      });
    } catch (saveError) {
      addToast({
        type: "error",
        title: "Erro ao editar venda",
        description: saveError instanceof Error ? saveError.message : "Nao foi possivel atualizar a venda.",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteSale = async (sale: ConsolidatedSale) => {
    if (sale.fonte !== "crm" && sale.fonte !== "importada") return;
    const confirmed = window.confirm(
      `Excluir a venda de ${sale.clienteNome}? Ela deixara de aparecer nos relatorios e listagens.`
    );
    if (!confirmed) return;

    try {
      setDeletingSaleId(sale.id);
      await deleteCommercialConsolidatedSale(sale.fonte, sale.vendaId);
      if (result.items.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        setRefreshKey((current) => current + 1);
      }
      addToast({
        type: "success",
        title: "Venda excluida",
        description: "A venda foi removida da visao unificada.",
      });
    } catch (deleteError) {
      addToast({
        type: "error",
        title: "Erro ao excluir venda",
        description: deleteError instanceof Error ? deleteError.message : "Nao foi possivel excluir a venda.",
      });
    } finally {
      setDeletingSaleId(null);
    }
  };

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setSource("");
    setOwnerId("");
    setProduct("");
    setDateStart("");
    setDateEnd("");
    setPage(1);
  };

  return (
    <section className="consolidated-sales-page">
      <header className="consolidated-sales-header">
        <div className="consolidated-sales-header__copy">
          <span>VISÃO CONSOLIDADA</span>
          <h1>Vendas</h1>
          <p>Fechamentos ganhos de todos os funis e vendas recebidas pelas integrações.</p>
        </div>
        <div className="consolidated-sales-header__tools">
          <strong className="consolidated-sales-total">{result.total} registro(s)</strong>
          <div className="consolidated-sales-actions">
            <button type="button" className="consolidated-sales-action" onClick={exportSales}>
              <FiDownload />
              <span>Exportar</span>
            </button>
            <button type="button" className="consolidated-sales-action" onClick={downloadImportModel}>
              <FiFileText />
              <span>Baixar modelo</span>
            </button>
            <label className="consolidated-sales-action consolidated-sales-action--primary">
              <FiUploadCloud />
              <span>Importar vendas</span>
              <input
                className="consolidated-sales-file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => {
                  void handleImport(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </header>

      <div className="consolidated-sales-filters">
        <div className="consolidated-sales-search">
          <FiSearch />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applySearch();
            }}
            placeholder="Buscar cliente, produto ou transacao"
          />
          <button type="button" onClick={applySearch}>Buscar</button>
        </div>

        <select
          value={source}
          onChange={(event) => {
            setSource(event.target.value as "" | ConsolidatedSale["fonte"]);
            setPage(1);
          }}
        >
          <option value="">Todas as origens</option>
          <option value="crm">CRM</option>
          <option value="hotmart">Hotmart</option>
          <option value="hubla">Hubla</option>
          <option value="importada">Importadas</option>
        </select>

        <select value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setPage(1); }}>
          <option value="">Todos os vendedores</option>
          {owners.map((owner) => <option key={owner.id} value={String(owner.id)}>{owner.nome}</option>)}
        </select>

        <select value={product} onChange={(event) => { setProduct(event.target.value); setPage(1); }}>
          <option value="">Todos os produtos</option>
          {products.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}
        </select>

        <label>
          <span>De</span>
          <input type="date" value={dateStart} onChange={(event) => { setDateStart(event.target.value); setPage(1); }} />
        </label>
        <label>
          <span>Ate</span>
          <input type="date" value={dateEnd} onChange={(event) => { setDateEnd(event.target.value); setPage(1); }} />
        </label>
        <button type="button" className="consolidated-sales-clear" onClick={resetFilters}>Limpar</button>
      </div>

      {error ? <div className="consolidated-sales-error">{error}</div> : null}

      <div className="consolidated-sales-table-wrap">
        <table className="consolidated-sales-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Venda / Produto</th>
              <th>Fonte</th>
              <th>Funil / Integração</th>
              <th>Vendedor</th>
              <th>Transação</th>
              <th>Valor</th>
              {canManageSales ? <th>Acoes</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={tableColumnCount}>Carregando vendas...</td></tr>
            ) : result.items.length ? (
              result.items.map((sale) => (
                <tr key={sale.id}>
                  <td>{formatDate(sale.vendidoEm)}</td>
                  <td>{sale.clienteNome}</td>
                  <td><strong>{sale.descricao}</strong>{sale.status ? <small>{sale.status}</small> : null}</td>
                  <td><span className={`consolidated-sales-source consolidated-sales-source--${sale.fonte}`}>{sourceLabel(sale.fonte)}</span></td>
                  <td>{sale.funilNome || sourceLabel(sale.fonte)}</td>
                  <td>{sale.vendedorNome || "-"}</td>
                  <td>{sale.transacaoId || "-"}</td>
                  <td>{formatCurrency(sale.valor)}</td>
                  {canManageSales ? (
                    <td>
                      <div className="consolidated-sales-row-actions">
                        <button
                          type="button"
                          className="consolidated-sales-edit-button"
                          onClick={() => openEdit(sale)}
                          aria-label={`${sale.fonte === "hotmart" || sale.fonte === "hubla" ? "Atribuir vendedor" : "Editar venda"} de ${sale.clienteNome}`}
                        >
                          {sale.fonte === "hotmart" || sale.fonte === "hubla" ? <FiUserCheck /> : <FiEdit2 />}
                          {sale.fonte === "hotmart" || sale.fonte === "hubla" ? "Atribuir" : "Editar"}
                        </button>
                        {sale.fonte === "crm" || sale.fonte === "importada" ? (
                          <button
                            type="button"
                            className="consolidated-sales-delete-button"
                            onClick={() => void deleteSale(sale)}
                            disabled={deletingSaleId === sale.id}
                            aria-label={`Excluir venda de ${sale.clienteNome}`}
                          >
                            <FiTrash2 /> {deletingSaleId === sale.id ? "Excluindo..." : "Excluir"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr><td colSpan={tableColumnCount}>Nenhuma venda encontrada para os filtros atuais.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="consolidated-sales-pagination">
        <button type="button" onClick={() => setPage(1)} disabled={loading || page <= 1}>Primeira</button>
        <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}><FiChevronLeft /> Anterior</button>
        <span>Pagina {result.pagina} de {result.total_paginas}</span>
        <button type="button" onClick={() => setPage((current) => Math.min(result.total_paginas, current + 1))} disabled={loading || page >= result.total_paginas}>Proxima <FiChevronRight /></button>
        <button type="button" onClick={() => setPage(result.total_paginas)} disabled={loading || page >= result.total_paginas}>Ultima</button>
      </footer>

      <Modal
        isOpen={Boolean(editingSale && editDraft)}
        onClose={closeEdit}
        title={editingSale?.fonte === "hotmart" || editingSale?.fonte === "hubla" ? "Atribuir vendedor" : "Editar venda"}
        size={editingSale?.fonte === "hotmart" || editingSale?.fonte === "hubla" ? "sm" : "lg"}
      >
        {editingSale && editDraft ? (
          <form
            className="consolidated-sales-edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveEdit();
            }}
          >
            <div className="consolidated-sales-edit-context">
              <span className={`consolidated-sales-source consolidated-sales-source--${editingSale.fonte}`}>
                {sourceLabel(editingSale.fonte)}
              </span>
              <strong>{editingSale.funilNome || sourceLabel(editingSale.fonte)}</strong>
            </div>

            {editingSale.fonte === "hotmart" || editingSale.fonte === "hubla" ? (
              <div className="consolidated-sales-assign-summary">
                <strong>{editingSale.clienteNome}</strong>
                <span>{editingSale.descricao}</span>
              </div>
            ) : null}

            <div className={`consolidated-sales-edit-grid${editingSale.fonte === "hotmart" || editingSale.fonte === "hubla" ? " consolidated-sales-edit-grid--assignment" : ""}`}>
              {editingSale.fonte !== "hotmart" && editingSale.fonte !== "hubla" ? (
                <>
              <label>
                <span>Cliente</span>
                <input
                  required={editingSale.fonte === "importada"}
                  value={editDraft.clienteNome}
                  disabled={editingSale.fonte === "crm"}
                  onChange={(event) => setEditDraft({ ...editDraft, clienteNome: event.target.value })}
                />
                {editingSale.fonte === "crm" ? <small>O cliente e alterado pelo cadastro de contatos.</small> : null}
              </label>
              <label>
                <span>Venda / produto *</span>
                <input
                  required
                  value={editDraft.descricao}
                  onChange={(event) => setEditDraft({ ...editDraft, descricao: event.target.value })}
                />
              </label>
              <label>
                <span>Valor *</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={editDraft.valor}
                  onChange={(event) => setEditDraft({ ...editDraft, valor: event.target.value })}
                />
              </label>
              <label>
                <span>Data da venda *</span>
                <input
                  required
                  type="date"
                  value={editDraft.vendidoEm}
                  onChange={(event) => setEditDraft({ ...editDraft, vendidoEm: event.target.value })}
                />
              </label>
              <label>
                <span>Origem</span>
                <input
                  value={editDraft.origem}
                  onChange={(event) => setEditDraft({ ...editDraft, origem: event.target.value })}
                />
              </label>
                </>
              ) : null}
              <label>
                <span>Vendedor</span>
                <select
                  value={editDraft.vendedorId}
                  onChange={(event) => setEditDraft({ ...editDraft, vendedorId: event.target.value })}
                >
                  <option value="">Sem vendedor</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={String(owner.id)}>{owner.nome}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="consolidated-sales-edit-actions">
              <button type="button" onClick={closeEdit} disabled={savingEdit}>Cancelar</button>
              <button type="submit" className="consolidated-sales-edit-save" disabled={savingEdit}>
                {savingEdit
                  ? "Salvando..."
                  : editingSale.fonte === "hotmart" || editingSale.fonte === "hubla"
                  ? "Salvar vendedor"
                  : "Salvar alteracoes"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </section>
  );
}
