import { useEffect, useMemo, useState } from "react";
import { FiMinus, FiPlus, FiTrash2 } from "react-icons/fi";
import { FaFire, FaSnowflake } from "react-icons/fa";
import type {
  CommercialDomainProduct,
  CommercialStage,
  Deal,
  DealProduct,
  DealStage,
} from "../../../service/commercialService";
import "./NewAtendimentoModal.css";

type EditDealModalProps = {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal;
  onConfirm: (updatedDeal: Partial<Deal>) => void;
  products: CommercialDomainProduct[];
  stages: CommercialStage[];
};

type QuoteItemForm = {
  key: string;
  productId: number | null;
  productSearch: string;
  name: string;
  quantity: number;
  price: number;
};

function createEmptyQuoteItem(): QuoteItemForm {
  return {
    key: `quote-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: null,
    productSearch: "",
    name: "",
    quantity: 1,
    price: 0,
  };
}

function mapDealProductsToFormItems(
  items: DealProduct[] = [],
  catalog: CommercialDomainProduct[] = [],
): QuoteItemForm[] {
  const mapped = items
    .map((item, index) => {
      const name = String(item.name || "").trim();
      if (!name) return null;

      const matchedCatalog = catalog.find(
        (product) =>
          Number(product.id) === Number(item.comercialProdutoId || item.id) ||
          product.nome.trim().toLowerCase() === name.toLowerCase(),
      );

      return {
        key: `quote-item-existing-${index}-${matchedCatalog?.id || name}`,
        productId: matchedCatalog?.id || (item.comercialProdutoId ? Number(item.comercialProdutoId) : null),
        productSearch: name,
        name,
        quantity: Number(item.quantity || 1) || 1,
        price: Number(item.price || 0) || 0,
      };
    })
    .filter(Boolean) as QuoteItemForm[];

  return mapped.length ? mapped : [createEmptyQuoteItem()];
}

export function EditDealModal({
  isOpen,
  onClose,
  deal,
  onConfirm,
  products,
  stages,
}: EditDealModalProps) {
  const [formData, setFormData] = useState({
    contactName: "",
    customerPhone: "",
    customerEmail: "",
    customerDocument: "",
    temperature: "morno" as "quente" | "morno" | "frio",
    stage: "waiting" as DealStage,
  });
  const [quoteItems, setQuoteItems] = useState<QuoteItemForm[]>([createEmptyQuoteItem()]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeProductSearchKey, setActiveProductSearchKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const availableStageCodes = new Set(
      stages.filter((stage) => stage.ativo !== false).map((stage) => stage.codigo),
    );
    const fallbackStage =
      stages.find((stage) => stage.codigo === "waiting" && stage.ativo !== false)?.codigo ||
      stages[0]?.codigo ||
      "waiting";

    setFormData({
      contactName: deal.contactName || "",
      customerPhone: deal.customerPhone || "",
      customerEmail: deal.customerEmail || "",
      customerDocument: deal.customerDocument || "",
      temperature: deal.temperature || "morno",
      stage: (availableStageCodes.has(deal.stage) ? deal.stage : fallbackStage) as DealStage,
    });
    setQuoteItems(mapDealProductsToFormItems(deal.quote?.items || deal.products || [], products));
    setQuoteNotes(String(deal.quote?.notes || deal.saleNotes || "").trim());
    setErrors({});
    setActiveProductSearchKey(null);
  }, [deal, isOpen, products, stages]);

  const validQuoteItems = useMemo(
    () => quoteItems.filter((item) => item.productId && String(item.name || "").trim()),
    [quoteItems],
  );
  const invalidQuoteItems = useMemo(
    () =>
      quoteItems.filter(
        (item) =>
          (String(item.productSearch || "").trim() ||
            String(item.name || "").trim() ||
            Number(item.price || 0) > 0) &&
          !item.productId,
      ),
    [quoteItems],
  );
  const quoteSubtotal = useMemo(
    () =>
      validQuoteItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
        0,
      ),
    [validQuoteItems],
  );
  const quoteItemQuantity = useMemo(
    () =>
      validQuoteItems.reduce(
        (sum, item) => sum + (Number(item.quantity || 0) || 0),
        0,
      ),
    [validQuoteItems],
  );

  if (!isOpen) return null;

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.contactName) nextErrors.contactName = "Nome e obrigatorio";
    if (!formData.customerPhone) nextErrors.customerPhone = "Telefone e obrigatorio";
    if (!formData.customerEmail) nextErrors.customerEmail = "E-mail e obrigatorio";
    if (invalidQuoteItems.length) nextErrors.quoteItems = "Selecione apenas produtos ja cadastrados no sistema";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const getProbabilityFromTemp = (temp: string) => {
    if (temp === "quente") return 90;
    if (temp === "frio") return 10;
    return 50;
  };

  const stageOptions = stages.filter((stage) => stage.ativo !== false);

  const addCatalogProduct = (productId: number) => {
    const product = products.find((item) => Number(item.id) === Number(productId));
    if (!product) return;

    setQuoteItems((current) => {
      const existing = current.find(
        (item) =>
          item.productId === product.id ||
          item.name.trim().toLowerCase() === product.nome.trim().toLowerCase(),
      );

      if (existing) {
        return current.map((item) =>
          item.key === existing.key
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [
        ...current,
        {
          key: `catalog-${product.id}-${Date.now()}`,
          productId: product.id,
          productSearch: product.nome,
          name: product.nome,
          quantity: 1,
          price: Number(product.preco_base || 0) || 0,
        },
      ];
    });
  };

  const updateQuoteItem = (
    key: string,
    field: "quantity" | "price",
    value: string,
  ) => {
    setQuoteItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        if (field === "quantity") return { ...item, quantity: Math.max(1, Number(value || 1) || 1) };
        return { ...item, price: Math.max(0, Number(value || 0) || 0) };
      }),
    );
  };

  const updateQuoteItemSearch = (key: string, value: string) => {
    setQuoteItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              productSearch: value,
              productId: null,
              name: "",
              price: 0,
            }
          : item,
      ),
    );
    setActiveProductSearchKey(key);
  };

  const selectProductForQuoteItem = (key: string, product: CommercialDomainProduct) => {
    setQuoteItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              productId: Number(product.id),
              productSearch: product.nome,
              name: product.nome,
              price: Number(product.preco_base || 0) || 0,
            }
          : item,
      ),
    );
    setActiveProductSearchKey(null);
  };

  const getFilteredProducts = (search: string) => {
    const normalized = String(search || "").trim().toLowerCase();
    if (!normalized) return products.slice(0, 8);
    return products
      .filter((product) => String(product.nome || "").trim().toLowerCase().includes(normalized))
      .slice(0, 8);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content new-atendimento-modal new-atendimento-modal--quote">
        <div className="modal-header">
          <h3>Editar orçamento</h3>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <form
          className="modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            if (!validate()) return;

            const hasQuoteItems = validQuoteItems.length > 0;
            const hasExistingQuote = Boolean(deal.quote?.id);
            const quoteTitle = hasQuoteItems
              ? validQuoteItems.length === 1
                ? `Orçamento ${validQuoteItems[0].name} - ${formData.contactName}`
                : `Orçamento - ${formData.contactName}`
              : `Negócio - ${formData.contactName}`;
            const quoteProducts: DealProduct[] = validQuoteItems.map((item) => ({
              comercialProdutoId: item.productId || undefined,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.quantity * item.price,
            }));

            const payload: Partial<Deal> = {
              contactName: formData.contactName,
              companyName: formData.contactName,
              customerPhone: formData.customerPhone,
              customerEmail: formData.customerEmail,
              customerDocument: formData.customerDocument,
              temperature: formData.temperature,
              probability: getProbabilityFromTemp(formData.temperature),
              stage: formData.stage,
              title: quoteTitle,
              saleNotes: quoteNotes.trim() || undefined,
            };

            if (hasQuoteItems || hasExistingQuote) {
              payload.amount = quoteSubtotal;
              payload.itemQuantity = quoteItemQuantity;
              payload.products = quoteProducts;
              payload.quote = {
                id: deal.quote?.id,
                title: quoteTitle,
                subtotal: quoteSubtotal,
                discount: 0,
                total: quoteSubtotal,
                notes: quoteNotes.trim() || null,
                status: deal.quote?.status || "ativo",
                items: quoteProducts,
              };
            }

            onConfirm(payload);
          }}
        >
          <div className="form-row">
            <div className="form-group">
              <label>
                Nome do cliente <span className="required">*</span>
              </label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData((prev) => ({ ...prev, contactName: e.target.value }))}
                className={errors.contactName ? "error" : ""}
              />
              {errors.contactName && <span className="error-msg">{errors.contactName}</span>}
            </div>
            <div className="form-group">
              <label>
                Telefone <span className="required">*</span>
              </label>
              <input
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))}
                className={errors.customerPhone ? "error" : ""}
              />
              {errors.customerPhone && <span className="error-msg">{errors.customerPhone}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                E-mail <span className="required">*</span>
              </label>
              <input
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerEmail: e.target.value }))}
                className={errors.customerEmail ? "error" : ""}
              />
              {errors.customerEmail && <span className="error-msg">{errors.customerEmail}</span>}
            </div>
            <div className="form-group">
              <label>Documento (CPF/CNPJ)</label>
              <input
                type="text"
                value={formData.customerDocument}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerDocument: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Temperatura</label>
              <div className="temperature-selector">
                <button
                  type="button"
                  className={`temp-btn quente ${formData.temperature === "quente" ? "selected" : ""}`}
                  onClick={() => setFormData((prev) => ({ ...prev, temperature: "quente" }))}
                >
                  <FaFire /> Quente
                </button>
                <button
                  type="button"
                  className={`temp-btn morno ${formData.temperature === "morno" ? "selected" : ""}`}
                  onClick={() => setFormData((prev) => ({ ...prev, temperature: "morno" }))}
                >
                  <FiMinus /> Morno
                </button>
                <button
                  type="button"
                  className={`temp-btn frio ${formData.temperature === "frio" ? "selected" : ""}`}
                  onClick={() => setFormData((prev) => ({ ...prev, temperature: "frio" }))}
                >
                  <FaSnowflake /> Frio
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Etapa atual</label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData((prev) => ({ ...prev, stage: e.target.value as DealStage }))}
              >
                {stageOptions.map((stage) => (
                  <option key={stage.id} value={stage.codigo}>
                    {stage.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Responsável</label>
              <input type="text" value={deal.ownerName || "Sem responsável"} disabled className="disabled-input" />
            </div>
            <div className="form-group">
              <label>Adicionar produto do catálogo</label>
              <select
                defaultValue=""
                onChange={(e) => {
                  const value = Number(e.target.value || 0);
                  if (value > 0) {
                    addCatalogProduct(value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">Selecione um produto...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.nome} - R$ {Number(product.preco_base || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="quote-builder">
            <div className="quote-builder__header">
              <div>
                <h4>Itens do orçamento</h4>
                <p>Edite os produtos e valores negociados neste card.</p>
              </div>
              <button
                type="button"
                className="quote-builder__add"
                onClick={() => setQuoteItems((current) => [...current, createEmptyQuoteItem()])}
              >
                <FiPlus /> Adicionar linha
              </button>
            </div>

            <div className="quote-builder__list">
              {quoteItems.map((item) => (
                <div key={item.key} className="quote-builder__item">
                  <div className="quote-builder__product-search">
                    <input
                      type="text"
                      value={item.productSearch}
                      onFocus={() => setActiveProductSearchKey(item.key)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setActiveProductSearchKey((current) =>
                            current === item.key ? null : current,
                          );
                        }, 120);
                      }}
                      onChange={(e) => updateQuoteItemSearch(item.key, e.target.value)}
                      placeholder="Buscar produto cadastrado"
                    />
                    {activeProductSearchKey === item.key && (
                      <div className="quote-builder__product-results">
                        {getFilteredProducts(item.productSearch).length ? (
                          getFilteredProducts(item.productSearch).map((product) => (
                            <button
                              key={`${item.key}-product-${product.id}`}
                              type="button"
                              className="quote-builder__product-result"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectProductForQuoteItem(item.key, product);
                              }}
                            >
                              <span>{product.nome}</span>
                              <small>R$ {Number(product.preco_base || 0).toFixed(2)}</small>
                            </button>
                          ))
                        ) : (
                          <div className="quote-builder__product-empty">
                            Nenhum produto encontrado.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateQuoteItem(item.key, "quantity", e.target.value)}
                    placeholder="Qtd"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => updateQuoteItem(item.key, "price", e.target.value)}
                    placeholder="Preço"
                  />
                  <span className="quote-builder__subtotal">
                    R$ {(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    className="quote-builder__remove"
                    onClick={() =>
                      setQuoteItems((current) =>
                        current.length > 1
                          ? current.filter((quoteItem) => quoteItem.key !== item.key)
                          : [createEmptyQuoteItem()],
                      )
                    }
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
            </div>

            {errors.quoteItems ? <span className="error-msg">{errors.quoteItems}</span> : null}

            <label className="quote-builder__notes">
              <span>Observações do orçamento</span>
              <textarea
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder="Ex.: prazo de entrega, condições comerciais, observações gerais."
              />
            </label>

            <div className="quote-builder__summary">
              <strong>{validQuoteItems.length} item(ns)</strong>
              <span>Quantidade total: {quoteItemQuantity}</span>
              <span>Total do orçamento: R$ {quoteSubtotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-confirm">
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditDealModal;
