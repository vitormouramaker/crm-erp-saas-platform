import { useEffect, useMemo, useRef, useState } from "react";
import { FiPlus, FiTrash2, FiX } from "react-icons/fi";
import type {
  CommercialDomainProduct,
  Deal,
  DealProduct,
  DealQuote,
} from "../../../service/commercialService";
import "./FinishServiceModal.css";

type FinishServiceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  deal: Deal;
  onConfirmSale: (data: Partial<Deal>) => void;
  onConfirmRefusal: (data: Partial<Deal>) => void;
  initialFinishType?: "won" | "lost" | null;
  paymentOptions: Array<{ codigo: string; nome: string; permite_parcelamento?: boolean }>;
  lossReasonOptions: Array<{ codigo: string; nome: string }>;
  productCatalog?: CommercialDomainProduct[];
};

type DealOutcomeItem = DealProduct & {
  soldQuantity: number;
  lostQuantity: number;
  status: string;
};

type QuoteBuilderItem = {
  key: string;
  productId: number | null;
  name: string;
  quantity: number;
  price: number;
};

const SALE_ORIGIN_PRESET_VALUES = new Set([
  "instagram_organic",
  "instagram_ads",
  "google",
  "youtube",
  "referral",
  "other",
]);

function resolveOutcomeStatus(totalQuantity: number, soldQuantity: number): string {
  if (soldQuantity <= 0) return "perdido";
  if (soldQuantity >= totalQuantity) return "ganho";
  return "parcial";
}

function clampSoldQuantity(value: number, maxQuantity: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maxQuantity, Math.max(0, value));
}

function parseNumberInput(value: string): number {
  const normalizedValue = value.replace(",", ".");
  return Number(normalizedValue);
}

function formatNumberInput(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

function createEmptyQuoteBuilderItem(): QuoteBuilderItem {
  return {
    key: `finish-quote-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: null,
    name: "",
    quantity: 1,
    price: 0,
  };
}

function mapItemsToQuoteBuilder(
  items: DealProduct[] = [],
  catalog: CommercialDomainProduct[] = []
): QuoteBuilderItem[] {
  const mapped = items
    .map((item, index) => {
      const name = String(item.name || "").trim();
      if (!name) return null;

      const matchedCatalog = catalog.find(
        (product) =>
          Number(product.id) === Number(item.comercialProdutoId || item.id) ||
          String(product.nome || "").trim().toLowerCase() === name.toLowerCase()
      );

      return {
        key: `finish-existing-${index}-${matchedCatalog?.id || name}`,
        productId: matchedCatalog?.id || (item.comercialProdutoId ? Number(item.comercialProdutoId) : null),
        name,
        quantity: Math.max(1, Number(item.quantity || 1) || 1),
        price: Math.max(0, Number(item.price || 0) || 0),
      } satisfies QuoteBuilderItem;
    })
    .filter(Boolean) as QuoteBuilderItem[];

  return mapped.length ? mapped : [createEmptyQuoteBuilderItem()];
}

function buildProductsFromQuoteBuilder(items: QuoteBuilderItem[]): DealProduct[] {
  return items
    .map((item) => {
      const name = String(item.name || "").trim();
      const quantity = Math.max(0, Number(item.quantity || 0) || 0);
      if (!name || quantity <= 0) return null;

      const price = Math.max(0, Number(item.price || 0) || 0);

      return {
        comercialProdutoId: item.productId || undefined,
        name,
        quantity,
        price,
        subtotal: quantity * price,
      } satisfies DealProduct;
    })
    .filter(Boolean) as DealProduct[];
}

function resolveInitialSaleOrigin(deal: Deal) {
  const rawValue = String(deal.saleOrigin || "").trim();
  const normalizedValue = rawValue.toLowerCase();

  if (!normalizedValue) {
    return {
      preset: "",
      custom: "",
    };
  }

  if (SALE_ORIGIN_PRESET_VALUES.has(normalizedValue)) {
    return {
      preset: normalizedValue,
      custom: "",
    };
  }

  return {
    preset: "other",
    custom: rawValue,
  };
}

function buildOutcomeItems(deal: Deal, finishType: "won" | "lost" | null): DealOutcomeItem[] {
  const baseItems =
    Array.isArray(deal.quote?.items) && deal.quote.items.length
      ? deal.quote.items
      : Array.isArray(deal.products)
        ? deal.products
        : [];

  return baseItems.map((item) => {
    const explicitSoldQuantity = Number(item.soldQuantity || 0);
    const explicitLostQuantity = Number(item.lostQuantity || 0);
    const quantity = Math.max(
      Number(item.quantity || 0),
      explicitSoldQuantity + explicitLostQuantity
    );
    const defaultSoldQuantity =
      finishType === "won"
        ? quantity
        : item.soldQuantity === null || item.soldQuantity === undefined
          ? 0
          : Number(item.soldQuantity || 0);
    const soldQuantity = clampSoldQuantity(defaultSoldQuantity, quantity);
    const lostQuantity = Math.max(0, quantity - soldQuantity);

    return {
      ...item,
      quantity,
      price: Number(item.price || 0),
      subtotal:
        item.subtotal === null || item.subtotal === undefined
          ? quantity * Number(item.price || 0)
          : Number(item.subtotal || 0),
      soldQuantity,
      lostQuantity,
      status: item.status || resolveOutcomeStatus(quantity, soldQuantity),
    };
  });
}

function resolveSuggestedSaleValue(deal: Deal, items: DealOutcomeItem[]): number {
  if (deal.quote?.total !== null && deal.quote?.total !== undefined) {
    return Number(deal.quote.total || 0);
  }

  if (!items.length) {
    return Number(deal.amount || 0);
  }

  return items.reduce(
    (sum, item) => sum + Number(item.soldQuantity || 0) * Number(item.price || 0),
    0
  );
}

export function FinishServiceModal({
  isOpen,
  onClose,
  deal,
  onConfirmSale,
  onConfirmRefusal,
  initialFinishType = null,
  paymentOptions,
  lossReasonOptions,
  productCatalog = [],
}: FinishServiceModalProps) {
  const [finishType, setFinishType] = useState<"won" | "lost" | null>(initialFinishType);
  const [saleOrigin, setSaleOrigin] = useState("");
  const [saleOriginCustom, setSaleOriginCustom] = useState("");
  const [saleValue, setSaleValue] = useState(() =>
    initialFinishType === "won" ? resolveSuggestedSaleValue(deal, buildOutcomeItems(deal, "won")) : 0
  );
  const [saleValueInput, setSaleValueInput] = useState(() => formatNumberInput(saleValue));
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [saleNotes, setSaleNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [installments, setInstallments] = useState(1);
  const [refusalReason, setRefusalReason] = useState("");
  const [refusalNotes, setRefusalNotes] = useState("");
  const [itemResults, setItemResults] = useState<DealOutcomeItem[]>([]);
  const [itemSoldQuantityInputs, setItemSoldQuantityInputs] = useState<string[]>([]);
  const [quoteBuilderItems, setQuoteBuilderItems] = useState<QuoteBuilderItem[]>([
    createEmptyQuoteBuilderItem(),
  ]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const wasOpenRef = useRef(false);
  const lastDealIdRef = useRef<string | null>(null);
  const lastFinishTypeRef = useRef<"won" | "lost" | null>(null);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const shouldReset =
      !wasOpenRef.current ||
      lastDealIdRef.current !== deal.id ||
      lastFinishTypeRef.current !== initialFinishType;

    if (!shouldReset) {
      return;
    }

    const nextFinishType = initialFinishType;
    const nextItems = buildOutcomeItems(deal, nextFinishType);
    const suggestedSaleValue = resolveSuggestedSaleValue(deal, nextItems);
    const initialSaleOrigin = resolveInitialSaleOrigin(deal);
    const initialSaleValue =
      nextFinishType === "won"
        ? Math.max(0, Number(deal.amount || suggestedSaleValue || 0))
        : 0;
    const initialSaleDate = String(deal.saleDate || "").trim() || new Date().toISOString().split("T")[0];

    setFinishType(nextFinishType);
    setSaleOrigin(initialSaleOrigin.preset);
    setSaleOriginCustom(initialSaleOrigin.custom);
    setSaleValue(initialSaleValue);
    setSaleValueInput(formatNumberInput(initialSaleValue));
    setSaleDate(initialSaleDate);
    setSaleNotes(String(deal.saleNotes || "").trim());
    setPaymentMethod(String(deal.paymentMethod || "").trim());
    setInstallments(Math.max(1, Number(deal.installments || 1) || 1));
    setRefusalReason(String(deal.refusalReason || "").trim());
    setRefusalNotes(String(deal.refusalNotes || "").trim());
    setItemResults(nextItems);
    setItemSoldQuantityInputs(nextItems.map((item) => formatNumberInput(Number(item.soldQuantity || 0))));
    setQuoteBuilderItems(
      mapItemsToQuoteBuilder(
        nextItems.length ? nextItems : deal.quote?.items || deal.products || [],
        productCatalog
      )
    );
    setQuoteNotes(String(deal.quote?.notes || deal.saleNotes || "").trim());
    wasOpenRef.current = true;
    lastDealIdRef.current = deal.id;
    lastFinishTypeRef.current = initialFinishType;
  }, [deal, deal.id, deal.products, deal.quote, initialFinishType, isOpen, productCatalog]);

  const currentPayment = paymentOptions.find((item) => item.codigo === paymentMethod);
  const canInstall = Boolean(currentPayment?.permite_parcelamento);
  const hasQuoteItems = itemResults.length > 0;

  const draftProducts = useMemo(
    () => buildProductsFromQuoteBuilder(quoteBuilderItems),
    [quoteBuilderItems]
  );

  const draftOutcomeItems = useMemo(
    () =>
      draftProducts.map((item) => {
        const quantity = Number(item.quantity || 0);
        return {
          ...item,
          soldQuantity: quantity,
          lostQuantity: 0,
          status: resolveOutcomeStatus(quantity, quantity),
        };
      }),
    [draftProducts]
  );

  const isQuoteBuilderMode = finishType === "won" && !hasQuoteItems;
  const effectiveOutcomeItems = isQuoteBuilderMode ? draftOutcomeItems : itemResults;

  const quoteSummary = useMemo(() => {
    const soldQuantity = effectiveOutcomeItems.reduce(
      (sum, item) => sum + Number(item.soldQuantity || 0),
      0
    );
    const lostQuantity = effectiveOutcomeItems.reduce(
      (sum, item) => sum + Number(item.lostQuantity || 0),
      0
    );
    const quotedTotal = effectiveOutcomeItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
      0
    );
    const soldTotal = effectiveOutcomeItems.reduce(
      (sum, item) => sum + Number(item.soldQuantity || 0) * Number(item.price || 0),
      0
    );

    return {
      soldQuantity,
      lostQuantity,
      quotedTotal,
      soldTotal,
    };
  }, [effectiveOutcomeItems]);

  const maxSaleValue = hasQuoteItems ? quoteSummary.soldTotal : undefined;
  const shouldClampSaleValue =
    hasQuoteItems && maxSaleValue !== undefined && Number(maxSaleValue || 0) > 0;

  useEffect(() => {
    if (!isOpen || !shouldClampSaleValue || maxSaleValue === undefined) return;

    setSaleValue((currentValue) => {
      const nextValue = Math.min(Math.max(0, Number(currentValue || 0)), maxSaleValue);
      setSaleValueInput((currentInput) => {
        if (currentInput === "") return currentInput;
        return nextValue === currentValue ? currentInput : formatNumberInput(nextValue);
      });
      return nextValue;
    });
  }, [isOpen, maxSaleValue, shouldClampSaleValue]);

  const quotePayload: DealQuote | null = useMemo(() => {
    const existingQuote = deal.quote || null;
    const quoteItems = isQuoteBuilderMode ? draftProducts : effectiveOutcomeItems;
    const quotedTotal =
      existingQuote?.total ??
      quoteItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);
    const subtotal =
      existingQuote?.subtotal ??
      quoteItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0);
    const discount = existingQuote?.discount ?? Math.max(0, subtotal - quotedTotal);

    return {
      id: existingQuote?.id,
      title: existingQuote?.title || deal.title || "Orçamento",
      subtotal,
      discount,
      total: quotedTotal,
      notes: quoteNotes.trim() || existingQuote?.notes || null,
      status: finishType === "won" ? "ganho" : finishType === "lost" ? "perdido" : existingQuote?.status,
      items: quoteItems.map((item) => ({
        id: item.id,
        comercialProdutoId: item.comercialProdutoId,
        name: item.name,
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        subtotal:
          item.subtotal === null || item.subtotal === undefined
            ? Number(item.quantity || 0) * Number(item.price || 0)
            : Number(item.subtotal || 0),
        soldQuantity: Number(item.soldQuantity || 0),
        lostQuantity: Number(item.lostQuantity || 0),
        status: item.status,
      })),
    };
  }, [deal.quote, deal.title, draftProducts, effectiveOutcomeItems, finishType, isQuoteBuilderMode, quoteNotes]);

  const updateItemSoldQuantity = (itemIndex: number, value: number) => {
    setItemResults((currentItems) =>
      currentItems.map((item, index) => {
        if (index !== itemIndex) return item;
        const soldQuantity = clampSoldQuantity(value, Number(item.quantity || 0));
        const lostQuantity = Math.max(0, Number(item.quantity || 0) - soldQuantity);

        return {
          ...item,
          soldQuantity,
          lostQuantity,
          status: resolveOutcomeStatus(Number(item.quantity || 0), soldQuantity),
        };
      })
    );
  };

  const handleItemSoldQuantityChange = (itemIndex: number, value: string) => {
    setItemSoldQuantityInputs((currentInputs) =>
      currentInputs.map((currentValue, index) => (index === itemIndex ? value : currentValue))
    );

    if (value === "") return;
    const parsedValue = parseNumberInput(value);
    if (Number.isFinite(parsedValue)) updateItemSoldQuantity(itemIndex, parsedValue);
  };

  const normalizeItemSoldQuantityInput = (itemIndex: number) => {
    const item = itemResults[itemIndex];
    if (!item) return;

    setItemSoldQuantityInputs((currentInputs) =>
      currentInputs.map((currentValue, index) =>
        index === itemIndex ? formatNumberInput(Number(item.soldQuantity || 0)) : currentValue
      )
    );
  };

  const addQuoteBuilderLine = () => {
    setQuoteBuilderItems((current) => [...current, createEmptyQuoteBuilderItem()]);
  };

  const removeQuoteBuilderLine = (key: string) => {
    setQuoteBuilderItems((current) =>
      current.length > 1 ? current.filter((item) => item.key !== key) : [createEmptyQuoteBuilderItem()]
    );
  };

  const updateQuoteBuilderItem = (
    key: string,
    field: "name" | "quantity" | "price",
    value: string
  ) => {
    setQuoteBuilderItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        if (field === "name") return { ...item, name: value };
        if (field === "quantity") return { ...item, quantity: Math.max(1, Number(value || 1) || 1) };
        return { ...item, price: Math.max(0, Number(value || 0) || 0) };
      })
    );
  };

  const selectCatalogProduct = (key: string, productId: number) => {
    const product = productCatalog.find((item) => Number(item.id) === Number(productId));
    if (!product) return;

    setQuoteBuilderItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              productId: product.id,
              name: product.nome,
              price: Number(product.preco_base || 0) || 0,
            }
          : item
      )
    );
  };

  const normalizeSaleValueInput = (): number => {
    const parsedValue = parseNumberInput(saleValueInput);
    const clampedValue = Number.isFinite(parsedValue)
      ? Math.max(
          0,
          shouldClampSaleValue && maxSaleValue !== undefined
            ? Math.min(parsedValue, maxSaleValue)
            : parsedValue
        )
      : 0;

    setSaleValue(clampedValue);
    setSaleValueInput(formatNumberInput(clampedValue));
    return clampedValue;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content finish-service-modal">
        <div className="modal-header">
          <h2>Finalizar atendimento</h2>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="modal-body">
          {finishType === null ? (
            <div className="finish-options">
              <button
                className="finish-option-btn won"
                onClick={() => {
                  const nextItems = buildOutcomeItems(deal, "won");
                  const nextSaleValue = resolveSuggestedSaleValue(deal, nextItems);

                  setFinishType("won");
                  setItemResults(nextItems);
                  setItemSoldQuantityInputs(
                    nextItems.map((item) => formatNumberInput(Number(item.soldQuantity || 0)))
                  );
                  setQuoteBuilderItems(
                    mapItemsToQuoteBuilder(
                      nextItems.length ? nextItems : deal.quote?.items || deal.products || [],
                      productCatalog
                    )
                  );
                  setSaleValue(nextSaleValue);
                  setSaleValueInput(formatNumberInput(nextSaleValue));
                }}
              >
                Venda concluida
              </button>
              <button
                className="finish-option-btn lost"
                onClick={() => {
                  const nextItems = buildOutcomeItems(deal, "lost");
                  setFinishType("lost");
                  setItemResults(nextItems);
                  setItemSoldQuantityInputs(
                    nextItems.map((item) => formatNumberInput(Number(item.soldQuantity || 0)))
                  );
                  setSaleValue(0);
                  setSaleValueInput("0");
                }}
              >
                Venda recusada
              </button>
            </div>
          ) : finishType === "won" ? (
            <form
              className="finish-form finish-form--won"
              onSubmit={(event) => {
                event.preventDefault();
                const submittedSaleValue = normalizeSaleValueInput();
                onConfirmSale({
                  stage: "closed-won",
                  saleOrigin: saleOrigin === "other" ? saleOriginCustom : saleOrigin,
                  amount: submittedSaleValue,
                  itemQuantity: quoteSummary.soldQuantity,
                  saleDate,
                  saleNotes,
                  paymentMethod,
                  installments: canInstall ? installments : 1,
                  quote: quotePayload,
                  products: quotePayload?.items,
                });
              }}
            >
              <h3>Dados da venda</h3>

              <div className="finish-sale-toolbar">
                <div className="finish-sale-toolbar__meta">
                  <strong>Cliente:</strong> {deal.contactName || deal.companyName || deal.title}
                </div>
                <div className="finish-sale-toolbar__meta">
                  <strong>Total sugerido:</strong> R$ {quoteSummary.soldTotal.toFixed(2)}
                </div>
              </div>

              <div className="finish-sale-summary">
                <div className="form-group">
                  <label>Origem da venda *</label>
                  <select required value={saleOrigin} onChange={(e) => setSaleOrigin(e.target.value)}>
                    <option value="">Selecione...</option>
                    <option value="instagram_organic">Instagram - Organico</option>
                    <option value="instagram_ads">Instagram - Trafego</option>
                    <option value="google">Google</option>
                    <option value="youtube">YouTube</option>
                    <option value="referral">Indicação</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Valor da venda *</label>
                  <input
                    type="number"
                    min="0"
                    max={shouldClampSaleValue ? maxSaleValue : undefined}
                    step="0.01"
                    required
                    value={saleValueInput}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setSaleValueInput(nextValue);
                      if (nextValue === "") return;

                      const parsedValue = parseNumberInput(nextValue);
                      if (!Number.isFinite(parsedValue)) return;

                      const clampedValue = Math.max(
                        0,
                        shouldClampSaleValue && maxSaleValue !== undefined
                          ? Math.min(parsedValue, maxSaleValue)
                          : parsedValue
                      );
                      setSaleValue(clampedValue);
                    }}
                    onBlur={() => {
                      normalizeSaleValueInput();
                    }}
                  />
                  <small className="form-hint">
                    Sugerido pelos itens vendidos: R$ {quoteSummary.soldTotal.toFixed(2)}
                  </small>
                </div>

                <div className="form-group">
                  <label>Quantidade vendida</label>
                  <input type="number" min="0" step="1" value={quoteSummary.soldQuantity} readOnly />
                </div>

                <div className="form-group">
                  <label>Data da venda *</label>
                  <input
                    type="date"
                    required
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Forma de pagamento *</label>
                  <select
                    required
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {paymentOptions.map((option) => (
                      <option key={option.codigo} value={option.codigo}>
                        {option.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {canInstall && (
                  <div className="form-group">
                    <label>Numero de parcelas *</label>
                    <select
                      required
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                    >
                      {Array.from({ length: 11 }, (_, index) => index + 2).map((value) => (
                        <option key={value} value={value}>
                          {value}x
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {saleOrigin === "other" && (
                <div className="form-group">
                  <label>Especifique a origem *</label>
                  <input
                    required
                    value={saleOriginCustom}
                    onChange={(e) => setSaleOriginCustom(e.target.value)}
                    placeholder="Digite a origem da venda..."
                  />
                </div>
              )}

              <div className="finish-quote-section">
                <div className="finish-quote-section__header">
                  <h4>Itens do orcamento</h4>
                  <span>
                    Orçado: R$ {quoteSummary.quotedTotal.toFixed(2)} • Não vendido:{" "}
                    {quoteSummary.lostQuantity}
                  </span>
                </div>

                {hasQuoteItems ? (
                  <div className="finish-quote-list">
                    {itemResults.map((item, index) => (
                      <div
                        key={`${deal.id}-${item.comercialProdutoId || item.name}-${index}`}
                        className="finish-quote-item"
                      >
                        <div className="finish-quote-item__content">
                          <strong>{item.name}</strong>
                          <span>
                            Orcado: {Number(item.quantity || 0)} x R$ {Number(item.price || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="finish-quote-item__controls">
                          <label className="finish-quote-item__sold-field">
                            Qtd vendida
                            <input
                              className="finish-quote-item__sold-input"
                              type="number"
                              min="0"
                              step="0.01"
                              max={Number(item.quantity || 0)}
                              value={
                                itemSoldQuantityInputs[index] ??
                                formatNumberInput(Number(item.soldQuantity || 0))
                              }
                              onChange={(e) => handleItemSoldQuantityChange(index, e.target.value)}
                              onBlur={() => normalizeItemSoldQuantityInput(index)}
                            />
                          </label>
                          <div className="finish-quote-item__result">
                            <span>Não vendida</span>
                            <strong>{Number(item.lostQuantity || 0)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="finish-quote-builder">
                    <div className="finish-quote-builder__header">
                      <div>
                        <strong>Monte o orçamento para concluir a venda</strong>
                        <p>Adicione os itens negociados diretamente nesta tela.</p>
                      </div>
                      <button
                        type="button"
                        className="finish-quote-builder__add"
                        onClick={addQuoteBuilderLine}
                      >
                        <FiPlus size={16} /> Adicionar linha
                      </button>
                    </div>

                    {quoteBuilderItems.map((item) => (
                      <div key={item.key} className="finish-quote-builder__item">
                        <select
                          value={item.productId || ""}
                          onChange={(e) => {
                            const nextProductId = Number(e.target.value || 0);
                            if (nextProductId > 0) {
                              selectCatalogProduct(item.key, nextProductId);
                            }
                          }}
                        >
                          <option value="">Produto do catálogo (opcional)</option>
                          {productCatalog.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.nome} - R$ {Number(product.preco_base || 0).toFixed(2)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateQuoteBuilderItem(item.key, "name", e.target.value)}
                          placeholder="Nome do item"
                        />
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => updateQuoteBuilderItem(item.key, "quantity", e.target.value)}
                          placeholder="Qtd"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updateQuoteBuilderItem(item.key, "price", e.target.value)}
                          placeholder="Preço"
                        />
                        <span className="finish-quote-builder__subtotal">
                          R$ {(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          className="finish-quote-builder__remove"
                          onClick={() => removeQuoteBuilderLine(item.key)}
                          aria-label="Remover item do orçamento"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    ))}

                    <label className="finish-quote-builder__notes">
                      <span>Observações do orçamento</span>
                      <textarea
                        value={quoteNotes}
                        onChange={(e) => setQuoteNotes(e.target.value)}
                        placeholder="Ex.: prazo de entrega, condições comerciais, observações gerais."
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Observação da venda *</label>
                <textarea required value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} />
              </div>

              <div className="modal-footer modal-footer--quote-pattern">
                <button type="button" className="cancel-btn" onClick={() => setFinishType(null)}>
                  Voltar
                </button>
                <button
                  type="submit"
                  className="confirm-btn won"
                  disabled={
                    saleValueInput === "" ||
                    itemSoldQuantityInputs.some((value) => value === "") ||
                    quoteSummary.soldQuantity <= 0 ||
                    (isQuoteBuilderMode && draftProducts.length <= 0)
                  }
                >
                  Confirmar venda
                </button>
              </div>
            </form>
          ) : (
            <form
              className="finish-form"
              onSubmit={(event) => {
                event.preventDefault();
                onConfirmRefusal({
                  stage: "closed-lost",
                  itemQuantity: quoteSummary.soldQuantity,
                  refusalReason,
                  refusalNotes,
                  quote: quotePayload,
                  products: quotePayload?.items,
                });
              }}
            >
              <h3>Dados da recusa</h3>

              <div className="finish-quote-section">
                <div className="finish-quote-section__header">
                  <h4>Itens do orcamento</h4>
                  <span>
                    Orçado: R$ {quoteSummary.quotedTotal.toFixed(2)} • Não vendido:{" "}
                    {quoteSummary.lostQuantity}
                  </span>
                </div>

                {hasQuoteItems ? (
                  <div className="finish-quote-list">
                    {itemResults.map((item, index) => (
                      <div
                        key={`${deal.id}-${item.comercialProdutoId || item.name}-${index}`}
                        className="finish-quote-item"
                      >
                        <div className="finish-quote-item__content">
                          <strong>{item.name}</strong>
                          <span>
                            Orcado: {Number(item.quantity || 0)} x R$ {Number(item.price || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="finish-quote-item__controls">
                          <label className="finish-quote-item__sold-field">
                            Qtd vendida
                            <input
                              className="finish-quote-item__sold-input"
                              type="number"
                              min="0"
                              step="0.01"
                              max={Number(item.quantity || 0)}
                              value={
                                itemSoldQuantityInputs[index] ??
                                formatNumberInput(Number(item.soldQuantity || 0))
                              }
                              onChange={(e) => handleItemSoldQuantityChange(index, e.target.value)}
                              onBlur={() => normalizeItemSoldQuantityInput(index)}
                            />
                          </label>
                          <div className="finish-quote-item__result">
                            <span>Não vendida</span>
                            <strong>{Number(item.lostQuantity || 0)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="finish-quote-empty">Nenhum item encontrado no orçamento deste card.</p>
                )}
              </div>

              <div className="form-group">
                <label>Motivo da recusa *</label>
                <select
                  required
                  value={refusalReason}
                  onChange={(e) => setRefusalReason(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {lossReasonOptions.map((option) => (
                    <option key={option.codigo} value={option.codigo}>
                      {option.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Observações *</label>
                <textarea
                  required
                  value={refusalNotes}
                  onChange={(e) => setRefusalNotes(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setFinishType(null)}>
                  Voltar
                </button>
                <button type="submit" className="confirm-btn lost">
                  Confirmar recusa
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
