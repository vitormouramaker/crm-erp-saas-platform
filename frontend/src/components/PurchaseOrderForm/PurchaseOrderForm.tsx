import { useState, useMemo, useEffect } from "react";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  Branch, // Importa o tipo Branch COMPLETO
} from "../../data/mockData";
import { FiTrash2, FiSearch, FiX } from "react-icons/fi"; // Importa FiX
import { Input } from "../common/Input/Input";
// Importe o novo hook e os tipos de resultado
import {
  usePurchaseOrderSearch,
  type SearchResultProduct,
  type SearchResultSupplier,
} from "../../hooks/usePurchaseOrderSearch";
import "./PurchaseOrderForm.css";

interface PurchaseOrderFormProps {
  onSave: (orderData: any) => void;
  onCancel: () => void;
  initialData?: Omit<PurchaseOrder, "id">;
  // Props de dados removidas
}

// Interface simplificada para os itens do pedido
type FormItem = Pick<
  PurchaseOrderItem,
  "productId" | "productName" | "sku" | "quantity" | "costPrice"
>;

export function PurchaseOrderForm({
  onSave,
  onCancel,
  initialData,
}: PurchaseOrderFormProps) {
  // --- Estados de Seleção ---
  const [selectedSupplier, setSelectedSupplier] =
    useState<SearchResultSupplier | null>(null); // <- Usa o tipo simplificado
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null); // <- Usa o tipo COMPLETO
  const [items, setItems] = useState<FormItem[]>([]);

  // --- USA O NOVO HOOK DE BUSCA ---
  const {
    supplierSearch,
    setSupplierSearch,
    productSearch,
    setProductSearch,
    branches,
    supplierResults,
    productResults,
    loadingBranches,
    loadingSuppliers,
    loadingProducts,
  } = usePurchaseOrderSearch();

  // Carrega dados iniciais se for edição
  useEffect(() => {
    if (initialData) {
      setItems(initialData.items);
      setSupplierSearch(initialData.supplierName || "");
      // Tenta pré-selecionar a filial e o fornecedor se os dados existirem
      const initialBranch = branches.find((b) => b.name === initialData.filial);
      if (initialBranch) setSelectedBranch(initialBranch);

      // Para o fornecedor, definimos um objeto 'fake'
      setSelectedSupplier({
        id: initialData.supplierId,
        name: initialData.supplierName,
      });
    }
  }, [initialData, branches]); // Adiciona 'branches' à dependência

  // --- LÓGICA DE MANIPULAÇÃO DA LISTA ---
  const handleAddProduct = (product: SearchResultProduct) => {
    // <- Usa o tipo simplificado
    const newItem: FormItem = {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: 1,
      costPrice: product.costPrice,
    };
    setItems((prev) => [...prev, newItem]);
    setProductSearch(""); // Limpa a busca
  };

  const handleItemChange = (
    index: number,
    field: "quantity" | "costPrice",
    value: number | string
  ) => {
    const numericValue = Number(value) || 0;
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: numericValue };
    setItems(newItems);
  };

  const removeItemRow = (indexToRemove: number) => {
    setItems(items.filter((_, index) => index !== indexToRemove));
  };

  const totalValue = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.costPrice || 0),
      0
    );
  }, [items]);

  // --- SUBMISSÃO ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplier) {
      alert("Por favor, selecione um Fornecedor.");
      return;
    }
    if (!selectedBranch) {
      alert("Por favor, selecione uma Filial de Destino.");
      return;
    }
    if (items.length === 0) {
      alert("Adicione pelo menos um produto ao pedido.");
      return;
    }

    // Os 'items' já estão no formato PurchaseOrderItem
    const finalItems: PurchaseOrderItem[] = items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      costPrice: item.costPrice,
    }));

    // **CORREÇÃO AQUI:** Enviando os IDs corretos que o backend espera
    const payload = {
      supplierId: selectedSupplier.id,
      filial_id: selectedBranch.id, // <--- ID da filial
      // status: "Pendente", // O backend já deve saber disso
      items: finalItems,
    };

    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="purchase-order-form">
      {/* --- SEÇÃO DE SELEÇÃO GLOBAL (FORNECEDOR E FILIAL) --- */}
      <div className="form-global-selection">
        {/* Fornecedor */}
        <div className="dynamic-search-wrapper">
          <Input
            label="Fornecedor"
            value={supplierSearch}
            onChange={(e) => {
              setSupplierSearch(e.target.value);
              setSelectedSupplier(null); // Limpa seleção se digitar
            }}
            placeholder={
              loadingSuppliers ? "Buscando..." : "Digite para buscar..."
            }
            required
            autoComplete="off"
            // Desabilita se já selecionou
            disabled={!!selectedSupplier}
          />
          {/* Mostra o resultado da busca */}
          {supplierResults.length > 0 && !selectedSupplier && (
            <ul className="suggestions-list">
              {supplierResults.map((s) => (
                <li
                  key={s.id}
                  onClick={() => {
                    setSelectedSupplier(s); // <- Usa o tipo simplificado
                    setSupplierSearch(s.name);
                  }}
                >
                  {s.name}
                </li>
              ))}
            </ul>
          )}
          {/* Mostra o fornecedor selecionado */}
          {selectedSupplier && (
            <button
              type="button"
              className="remove-row-btn" // Reutilizando estilo
              style={{
                position: "absolute",
                top: "32px",
                right: "10px",
                zIndex: 102,
                border: "none", // Adicionado para parecer um ícone
                background: "transparent", // Adicionado
              }}
              onClick={() => {
                setSelectedSupplier(null);
                setSupplierSearch("");
              }}
            >
              <FiX />
            </button>
          )}
        </div>

        {/* Filial (Mudamos para Select, pois a lista é pequena) */}
        <div className="input-wrapper">
          <label htmlFor="branch-select">Filial Destino</label>
          <select
            id="branch-select"
            className="input-field" // Reutiliza o estilo do Input
            value={selectedBranch?.id || ""}
            onChange={(e) => {
              const branch = branches.find(
                // <- 'branches' é Branch[] (completo)
                (b) => b.id === Number(e.target.value)
              );
              setSelectedBranch(branch || null); // <- CORRIGIDO (|| em vez de ??)
            }}
            required
          >
            <option value="" disabled>
              {loadingBranches ? "Carregando filiais..." : "Selecione..."}
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* --- SEÇÃO DE BUSCA DE PRODUTOS --- */}
      <div className="dynamic-search-wrapper product-search-section">
        <label>Adicionar Produtos ao Pedido</label>
        <div className="product-search-input">
          <FiSearch />
          <input
            type="text"
            placeholder={
              loadingProducts
                ? "Buscando..."
                : "Digite o nome ou SKU do produto..."
            }
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            autoComplete="off"
            // Só pode adicionar produtos após selecionar Fornecedor e Filial
            disabled={!selectedSupplier || !selectedBranch}
          />
        </div>
        {productResults.length > 0 && (
          <ul className="suggestions-list product-suggestions">
            {productResults.map((p) => (
              <li key={p.id} onClick={() => handleAddProduct(p)}>
                {p.name} <small>({p.sku})</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- SEÇÃO DOS ITENS ADICIONADOS --- */}
      <div className="items-section">
        <div className="items-table-header-v2">
          <span>Produto</span>
          <span>Qtd.</span>
          <span>Custo Unit.</span>
          <span>Subtotal</span>
          <span></span>
        </div>
        {items.length === 0 && (
          <p className="empty-list-message">
            Nenhum produto adicionado ao pedido.
          </p>
        )}
        {items.map((item, index) => (
          <div key={item.productId || index} className="item-row-v2">
            <span className="item-product-name">
              {item.productName}
              <small>{item.sku}</small>
            </span>
            <input
              type="number"
              value={item.quantity}
              min="1"
              onChange={(e) =>
                handleItemChange(index, "quantity", e.target.value)
              }
              required
            />
            <div className="cost-input-wrapper">
              <span>R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={item.costPrice}
                onChange={(e) =>
                  handleItemChange(index, "costPrice", e.target.value)
                }
                required
              />
            </div>
            <span className="item-subtotal">
              {(item.quantity * item.costPrice).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
            <button
              type="button"
              className="remove-row-btn"
              onClick={() => removeItemRow(index)}
            >
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>

      {/* --- RODAPÉ DO FORMULÁRIO --- */}
      <div className="form-footer">
        <div className="total-value">
          <strong>Valor Total:</strong>
          <span>
            {totalValue.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
        </div>
        <div className="form-actions">
          <button type="button" className="cancel-button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="save-button">
            Salvar Pedido
          </button>
        </div>
      </div>
    </form>
  );
}
