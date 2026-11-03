import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import type { Conversation } from "../../data/mockData";
import {
  getCommercialCrms,
  getCommercialDomains,
  type CommercialCrm,
  type CommercialDomainOption,
  type CommercialDomainProduct,
  type CommercialDomains,
  type CommercialResponsible,
  type CommercialStage,
  type Deal,
  type DealProduct,
  type DealQuote,
} from "../../service/commercialService";
import "../commercial/Pipeline/NewAtendimentoModal.css";
import "./ContactDirectSaleModal.css";

type QuoteItemForm = {
  key: string;
  productId: number | null;
  productSearch: string;
  name: string;
  quantity: number;
  price: number;
};

export type ContactDirectSaleDraft = {
  crmId: number;
  wonStageCode: string;
  productCatalog: CommercialDomainProduct[];
  paymentOptions: CommercialDomainOption[];
  lossReasonOptions: CommercialDomainOption[];
  deal: Deal;
};

type ContactDirectSaleModalProps = {
  isOpen: boolean;
  contact: Conversation | null;
  currentUser: {
    id: number;
    name: string;
    isMaster: boolean;
  };
  onClose: () => void;
  onSubmit: (draft: ContactDirectSaleDraft) => void;
};

function createEmptyQuoteItem(): QuoteItemForm {
  return {
    key: `contact-sale-quote-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: null,
    productSearch: "",
    name: "",
    quantity: 1,
    price: 0,
  };
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function buildQuoteTitle(contactName: string, items: DealProduct[]) {
  if (!items.length) {
    return `Venda - ${contactName}`;
  }

  if (items.length === 1) {
    return `Orçamento ${items[0].name} - ${contactName}`;
  }

  return `Orçamento - ${contactName}`;
}

function resolveWonStage(stages: CommercialStage[] = []) {
  return (
    stages.find((stage) => stage.ativo !== false && stage.eh_fechamento && stage.eh_ganho) ||
    stages.find((stage) => stage.ativo !== false && String(stage.codigo || "") === "closed-won") ||
    null
  );
}

function dedupeResponsibles(
  responsibles: CommercialResponsible[],
  currentUser: ContactDirectSaleModalProps["currentUser"]
) {
  const byId = new Map<number, CommercialResponsible>();

  responsibles.forEach((responsible) => {
    const id = Number(responsible.id || 0);
    if (id > 0 && !byId.has(id)) {
      byId.set(id, {
        id,
        nome: String(responsible.nome || "").trim() || `Usuário ${id}`,
      });
    }
  });

  if (!byId.has(Number(currentUser.id))) {
    byId.set(Number(currentUser.id), {
      id: Number(currentUser.id),
      nome: currentUser.name,
    });
  }

  return Array.from(byId.values());
}

export function ContactDirectSaleModal({
  isOpen,
  contact,
  currentUser,
  onClose,
  onSubmit,
}: ContactDirectSaleModalProps) {
  const [availableCrms, setAvailableCrms] = useState<CommercialCrm[]>([]);
  const [domainsByCrm, setDomainsByCrm] = useState<Record<number, CommercialDomains>>({});
  const [loadingCrms, setLoadingCrms] = useState(false);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [selectedCrmId, setSelectedCrmId] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState(String(currentUser.id));
  const [contactName, setContactName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerDocument, setCustomerDocument] = useState("");
  const [quoteItems, setQuoteItems] = useState<QuoteItemForm[]>([createEmptyQuoteItem()]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [activeProductSearchKey, setActiveProductSearchKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingError, setLoadingError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    setAvailableCrms([]);
    setDomainsByCrm({});
    setSelectedCrmId("");
    setSelectedOwnerId(String(currentUser.id));
    setContactName(String(contact?.name || "").trim());
    setCustomerPhone(String(contact?.phone || "").trim());
    setCustomerEmail(String(contact?.email || "").trim());
    setCustomerDocument(String(contact?.cpf || "").trim());
    setQuoteItems([createEmptyQuoteItem()]);
    setQuoteNotes("");
    setErrors({});
    setLoadingError("");
    setActiveProductSearchKey(null);

    const loadCrms = async () => {
      try {
        setLoadingCrms(true);
        const crms = await getCommercialCrms();
        if (cancelled) return;

        setAvailableCrms(crms);

        const preferredCrm = crms.find(
          (crm) =>
            String(crm.nome || "").trim().toLowerCase() ===
            String(contact?.crmName || "").trim().toLowerCase()
        );
        const fallbackCrm = preferredCrm || crms[0] || null;
        setSelectedCrmId(fallbackCrm ? String(fallbackCrm.id) : "");
      } catch (error) {
        if (cancelled) return;
        setLoadingError(
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os funis disponíveis."
        );
      } finally {
        if (!cancelled) {
          setLoadingCrms(false);
        }
      }
    };

    void loadCrms();

    return () => {
      cancelled = true;
    };
  }, [contact?.crmName, contact?.cpf, contact?.email, contact?.name, contact?.phone, currentUser.id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const crmId = Number(selectedCrmId || 0);
    if (!crmId || domainsByCrm[crmId]) {
      return;
    }

    let cancelled = false;

    const loadDomains = async () => {
      try {
        setLoadingDomains(true);
        setLoadingError("");
        const domains = await getCommercialDomains(crmId);
        if (cancelled) return;

        setDomainsByCrm((current) => ({
          ...current,
          [crmId]: domains,
        }));
      } catch (error) {
        if (cancelled) return;
        setLoadingError(
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar o orçamento e os responsáveis do funil."
        );
      } finally {
        if (!cancelled) {
          setLoadingDomains(false);
        }
      }
    };

    void loadDomains();

    return () => {
      cancelled = true;
    };
  }, [domainsByCrm, isOpen, selectedCrmId]);

  const selectedCrmDomains = useMemo(() => {
    const crmId = Number(selectedCrmId || 0);
    return crmId ? domainsByCrm[crmId] || null : null;
  }, [domainsByCrm, selectedCrmId]);

  const sellerOptions = useMemo(
    () =>
      dedupeResponsibles(selectedCrmDomains?.responsaveis || [], {
        id: currentUser.id,
        name: currentUser.name,
        isMaster: currentUser.isMaster,
      }),
    [currentUser.id, currentUser.isMaster, currentUser.name, selectedCrmDomains?.responsaveis]
  );

  useEffect(() => {
    if (!isOpen) return;

    if (!currentUser.isMaster) {
      setSelectedOwnerId(String(currentUser.id));
      return;
    }

    setSelectedOwnerId((current) => {
      if (sellerOptions.some((seller) => String(seller.id) === current)) {
        return current;
      }
      return sellerOptions[0] ? String(sellerOptions[0].id) : String(currentUser.id);
    });
  }, [currentUser.id, currentUser.isMaster, isOpen, sellerOptions]);

  const validQuoteItems = useMemo(
    () => quoteItems.filter((item) => item.productId && String(item.name || "").trim()),
    [quoteItems]
  );

  const invalidQuoteItems = useMemo(
    () =>
      quoteItems.filter(
        (item) =>
          (String(item.productSearch || "").trim() ||
            String(item.name || "").trim() ||
            Number(item.price || 0) > 0) &&
          !item.productId
      ),
    [quoteItems]
  );

  const quoteSubtotal = useMemo(
    () =>
      validQuoteItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0),
        0
      ),
    [validQuoteItems]
  );

  const quoteItemQuantity = useMemo(
    () =>
      validQuoteItems.reduce((sum, item) => sum + (Number(item.quantity || 0) || 0), 0),
    [validQuoteItems]
  );

  const wonStage = useMemo(
    () => resolveWonStage(selectedCrmDomains?.etapas || []),
    [selectedCrmDomains?.etapas]
  );

  const getFilteredProducts = (search: string) => {
    const products = Array.isArray(selectedCrmDomains?.produtos) ? selectedCrmDomains.produtos : [];
    const normalized = String(search || "").trim().toLowerCase();
    if (!normalized) return products.slice(0, 8);

    return products
      .filter((product) => String(product.nome || "").trim().toLowerCase().includes(normalized))
      .slice(0, 8);
  };

  const addCatalogProduct = (productId: number) => {
    const product = (selectedCrmDomains?.produtos || []).find(
      (item) => Number(item.id) === Number(productId)
    );
    if (!product) return;

    setQuoteItems((current) => {
      const existing = current.find(
        (item) =>
          item.productId === Number(product.id) ||
          item.name.trim().toLowerCase() === String(product.nome || "").trim().toLowerCase()
      );

      if (existing) {
        return current.map((item) =>
          item.key === existing.key
            ? { ...item, quantity: Math.max(1, Number(item.quantity || 0) + 1) }
            : item
        );
      }

      return [
        ...current,
        {
          key: `contact-sale-catalog-${product.id}-${Date.now()}`,
          productId: Number(product.id),
          productSearch: product.nome,
          name: product.nome,
          quantity: 1,
          price: Number(product.preco_base || 0) || 0,
        },
      ];
    });
  };

  const updateQuoteItem = (key: string, field: "quantity" | "price", value: string) => {
    setQuoteItems((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        if (field === "quantity") {
          return { ...item, quantity: Math.max(1, Number(value || 1) || 1) };
        }

        return { ...item, price: Math.max(0, Number(value || 0) || 0) };
      })
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
          : item
      )
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
          : item
      )
    );
    setActiveProductSearchKey(null);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!selectedCrmId) {
      nextErrors.crm = "Selecione o funil onde essa venda sera registrada.";
    }
    if (!contactName.trim()) {
      nextErrors.contactName = "Informe o nome do cliente.";
    }
    if (!wonStage) {
      nextErrors.stage = "O funil selecionado nao possui uma etapa de ganho configurada.";
    }
    if (!validQuoteItems.length) {
      nextErrors.quoteItems = "Monte o orçamento antes de continuar com a venda.";
    }
    if (invalidQuoteItems.length) {
      nextErrors.quoteItems = "Selecione apenas produtos cadastrados no sistema.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  if (!isOpen || !contact) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content new-atendimento-modal new-atendimento-modal--quote contact-direct-sale-modal">
        <div className="modal-header">
          <div className="contact-direct-sale-modal__header-copy">
            <h3>Registrar venda direta</h3>
            <p>Escolha o CRM, monte o orçamento e siga para o fechamento da venda.</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <form
          className="modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            if (!validate() || !selectedCrmDomains || !wonStage) return;

            const quoteProducts: DealProduct[] = validQuoteItems.map((item) => ({
              comercialProdutoId: item.productId || undefined,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.quantity * item.price,
            }));

            const quoteTitle = buildQuoteTitle(contactName.trim(), quoteProducts);
            const selectedSeller =
              sellerOptions.find((seller) => String(seller.id) === selectedOwnerId) || sellerOptions[0];
            const sellerId = currentUser.isMaster
              ? String(selectedSeller?.id || currentUser.id)
              : String(currentUser.id);
            const sellerName = currentUser.isMaster
              ? selectedSeller?.nome || currentUser.name
              : currentUser.name;
            const quotePayload: DealQuote = {
              title: quoteTitle,
              subtotal: quoteSubtotal,
              discount: 0,
              total: quoteSubtotal,
              notes: quoteNotes.trim() || null,
              status: "ativo",
              items: quoteProducts,
            };
            const createdAt = new Date().toISOString();

            onSubmit({
              crmId: Number(selectedCrmId),
              wonStageCode: String(wonStage.codigo || "closed-won"),
              productCatalog: selectedCrmDomains.produtos || [],
              paymentOptions: selectedCrmDomains.formas_pagamento || [],
              lossReasonOptions: selectedCrmDomains.motivos_perda || [],
              deal: {
                id: `contact-direct-sale-${Number(contact.cliente_id || contact.id)}-${Date.now()}`,
                cliente_id: Number(contact.cliente_id || contact.id || 0) || undefined,
                title: quoteTitle,
                amount: quoteSubtotal,
                companyName: contactName.trim(),
                contactName: contactName.trim(),
                customerPhone: customerPhone.trim() || undefined,
                customerEmail: customerEmail.trim() || undefined,
                customerDocument: customerDocument.trim() || undefined,
                stage: String(wonStage.codigo || "closed-won"),
                probability: 100,
                createdAt,
                entryDate: createdAt,
                ownerId: sellerId,
                ownerName: sellerName,
                temperature: "quente",
                itemQuantity: quoteItemQuantity,
                saleNotes: quoteNotes.trim() || undefined,
                quote: quotePayload,
                products: quoteProducts,
              },
            });
          }}
        >
          <div className="contact-direct-sale-modal__highlight">
            <strong>{contact.name || "Cliente sem nome"}</strong>
            <span>{contact.phone || contact.email || "Contato sem telefone ou email"}</span>
          </div>

          {loadingError ? <div className="contact-direct-sale-modal__error">{loadingError}</div> : null}

          <div className="form-row">
            <div className="form-group">
              <label>
                CRM <span className="required">*</span>
              </label>
              <select
                value={selectedCrmId}
                onChange={(event) => setSelectedCrmId(event.target.value)}
                disabled={loadingCrms || !availableCrms.length}
                className={errors.crm ? "error" : ""}
              >
                <option value="">
                  {loadingCrms ? "Carregando funis..." : "Selecione o funil"}
                </option>
                {availableCrms.map((crm) => (
                  <option key={crm.id} value={crm.id}>
                    {crm.nome}
                  </option>
                ))}
              </select>
              {errors.crm ? <span className="error-msg">{errors.crm}</span> : null}
            </div>

            <div className="form-group">
              <label>Vendedor</label>
              {currentUser.isMaster ? (
                <select
                  value={selectedOwnerId}
                  onChange={(event) => setSelectedOwnerId(event.target.value)}
                  disabled={loadingDomains || !sellerOptions.length}
                >
                  {sellerOptions.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" value={currentUser.name} disabled className="disabled-input" />
              )}
              <small className="form-hint">
                {currentUser.isMaster
                  ? "Administrador pode atribuir a venda a qualquer responsável visível no funil."
                  : "A venda sera atribuida automaticamente ao seu usuário."}
              </small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                Nome do cliente <span className="required">*</span>
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                className={errors.contactName ? "error" : ""}
              />
              {errors.contactName ? <span className="error-msg">{errors.contactName}</span> : null}
            </div>
            <div className="form-group">
              <label>Telefone</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(formatPhoneNumber(event.target.value))}
                maxLength={15}
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>E-mail</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(event) => setCustomerEmail(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Documento (CPF/CNPJ)</label>
              <input
                type="text"
                value={customerDocument}
                onChange={(event) => setCustomerDocument(event.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Etapa de fechamento</label>
              <input
                type="text"
                value={
                  loadingDomains
                    ? "Carregando etapa de ganho..."
                    : wonStage?.nome || "Funil sem etapa de ganho"
                }
                disabled
                className="disabled-input"
              />
              {errors.stage ? <span className="error-msg">{errors.stage}</span> : null}
            </div>

            <div className="form-group">
              <label>Adicionar produto do catálogo</label>
              <select
                defaultValue=""
                onChange={(event) => {
                  const value = Number(event.target.value || 0);
                  if (value > 0) {
                    addCatalogProduct(value);
                    event.target.value = "";
                  }
                }}
                disabled={loadingDomains || !(selectedCrmDomains?.produtos || []).length}
              >
                <option value="">
                  {loadingDomains ? "Carregando produtos..." : "Selecione um produto..."}
                </option>
                {(selectedCrmDomains?.produtos || []).map((product) => (
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
                <h4>Orçamento obrigatório</h4>
                <p>Defina os itens que compõem essa venda antes de seguir para o fechamento.</p>
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
                            current === item.key ? null : current
                          );
                        }, 120);
                      }}
                      onChange={(event) => updateQuoteItemSearch(item.key, event.target.value)}
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
                              onMouseDown={(event) => {
                                event.preventDefault();
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
                    onChange={(event) => updateQuoteItem(item.key, "quantity", event.target.value)}
                    placeholder="Qtd"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(event) => updateQuoteItem(item.key, "price", event.target.value)}
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
                          : [createEmptyQuoteItem()]
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
              <span>Observações da venda</span>
              <textarea
                value={quoteNotes}
                onChange={(event) => setQuoteNotes(event.target.value)}
                placeholder="Ex.: condição comercial, prazo de entrega, contexto da negociação."
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
            <button
              type="submit"
              className="btn-confirm"
              disabled={loadingCrms || loadingDomains || !availableCrms.length}
            >
              Continuar para venda
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContactDirectSaleModal;
