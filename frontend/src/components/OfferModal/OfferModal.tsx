import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import type { Product } from "../../data/mockData";
import "./OfferModal.css";
import { API_BASE } from "../../config/api";
import { encrypt } from "../../utils/cripto";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";

interface OfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    productId: number,
    offerData: {
      promoPrice: number;
      promoStartDate: string;
      promoEndDate: string;
    }
  ) => void;
  onDelete?: (productId: number) => void;
  product: Product | null;
}

export function OfferModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  product,
}: OfferModalProps) {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [promoPrice, setPromoPrice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [isEditing, setIsEditing] = useState(false);

  // Helper para formatar data para o input datetime-local (YYYY-MM-DDThh:mm)
  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    // Ajuste simples para garantir formato local (ou UTC dependendo do backend, mas input local precisa de 'T')
    // Se o backend manda ISO com Z, new Date() ajusta para o fuso local do browser.
    // Para datetime-local, precisamos de YYYY-MM-DDThh:mm sem Z.
    // Vamos usar um truque para pegar o offset local
    const offsetBy = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offsetBy);
    return localDate.toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (product && isOpen) {
      // Lógica aprimorada: Considera promoção válida apenas se preço > 0 E data futura
      const now = new Date();
      const end = product.promoEndDate ? new Date(product.promoEndDate) : null;

      // Ajuste para fim do dia se data for apenas YYYY-MM-DD
      if (end && product.promoEndDate && product.promoEndDate.length <= 10) {
        end.setHours(23, 59, 59, 999);
      }

      const isExpired = end ? end < now : false;
      const hasActivePromotion =
        (product.promotionPrice || 0) > 0 && !isExpired;

      if (hasActivePromotion) {
        setPromoPrice(
          product.promotionPrice
            ? product.promotionPrice.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : ""
        );
        setStartDate(formatDateForInput(product.promoStartDate || ""));
        setEndDate(formatDateForInput(product.promoEndDate || ""));
        // Se tem promoção ativa, inicia bloqueado (visualização)
        setIsEditing(false);
      } else {
        // Se expirou ou não tem, inicia limpo e editável (nova promoção)
        setPromoPrice("");
        setStartDate("");
        setEndDate("");
        setIsEditing(true);
      }
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  // Helper para obter data atual em formato ISO Local (YYYY-MM-DDTHH:mm)
  // Corrigindo problema de timezone (UTC vs Local)
  const getCurrentLocalISOString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000; // offset em milissegundos
    const localTime = new Date(now.getTime() - offset);
    return localTime.toISOString().slice(0, 16);
  };

  // Helper para formatar moeda e parsear
  const formatCurrency = (value: string) => {
    // Remove tudo que não é dígito
    const numericValue = value.replace(/\D/g, "");

    // Converte para número e divide por 100 para ter os centavos
    const number = parseFloat(numericValue) / 100;

    if (isNaN(number)) return "";

    // Formata BRL
    return number.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseCurrency = (value: string) => {
    // Remove pontos de milhar e substitui vírgula por ponto decimal
    return parseFloat(value.replace(/\./g, "").replace(",", "."));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Impede que o usuário apague tudo e fique NaN, permite string vazia
    if (rawValue === "") {
      setPromoPrice("");
      return;
    }
    const formatted = formatCurrency(rawValue);
    setPromoPrice(formatted);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const price = parseCurrency(promoPrice);

    if (isNaN(price) || price <= 0) {
      addToast({
        type: "warning",
        title: "Valor Inválido",
        description: "Por favor, insira um valor promocional válido.",
      });
      return;
    }

    if (price >= product.salePrice) {
      addToast({
        type: "warning",
        title: "Valor Inválido",
        description:
          "O valor promocional deve ser menor que o valor de venda atual.",
      });
      return;
    }

    if (!startDate || !endDate) {
      addToast({
        type: "warning",
        title: "Campos Vazios",
        description: "Por favor, preencha as datas de início e fim.",
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      addToast({
        type: "warning",
        title: "Data Inválida",
        description: "A data de início não pode ser posterior à data de fim.",
      });
      return;
    }
    // ================================
    // 🔥 Converter para timestamp
    // ================================
    const encrypted = await encrypt({
      productId: product.id,
      promoPrice: price,
      promoStartDate: startDate,
      promoEndDate: endDate,
      offerCreatedBy: user?.id,
    });
    try {
      const response = await fetch(`${API_BASE}/estoque/cadastro_promocao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: encrypted,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar oferta.");
      }

      // Feedback visual via Toast
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Oferta salva com sucesso!",
      });

      onSave(product.id, {
        promoPrice: price,
        promoStartDate: startDate,
        promoEndDate: endDate,
      });

      onClose();
    } catch (error) {
      console.error(error);
      addToast({
        type: "error",
        title: "Erro",
        description: "Houve um erro ao salvar a oferta. Tente novamente.",
      });
    }
  };

  return (
    <div className="offer-modal-overlay" onClick={onClose}>
      <div className="offer-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="offer-modal-header">
          <h2>Adicionar Oferta</h2>
          <button className="offer-modal-close" onClick={onClose}>
            <FiX />
          </button>
        </header>

        <div className="current-price-info">
          <p>
            Produto: <strong>{product.name}</strong>
          </p>
          <p>
            Preço Atual:{" "}
            <strong>
              {product.salePrice.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </strong>
          </p>
        </div>

        <form onSubmit={handleSave} className="offer-form">
          <div className="form-group">
            <label htmlFor="promoPrice">Valor Promocional (R$)</label>
            <input
              type="text"
              id="promoPrice"
              value={promoPrice}
              onChange={handlePriceChange}
              placeholder="0,00"
              required
              disabled={!isEditing}
            />
          </div>

          <div className="form-group">
            <label htmlFor="startDate">Data de Início</label>
            <input
              type="datetime-local"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              disabled={!isEditing}
              min={getCurrentLocalISOString()}
            />
          </div>

          <div className="form-group">
            <label htmlFor="endDate">Data de Fim</label>
            <input
              type="datetime-local"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              disabled={!isEditing}
              min={startDate || getCurrentLocalISOString()}
            />
          </div>

          <div className="offer-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            {!isEditing ? (
              <div style={{ display: "flex", gap: "10px" }}>
                {product.promotionPrice &&
                  product.promotionPrice > 0 &&
                  onDelete && (
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Tem certeza que deseja excluir esta promoção?"
                          )
                        ) {
                          onDelete(product.id);
                          onClose();
                        }
                      }}
                    >
                      Excluir Promoção
                    </button>
                  )}
                <button
                  type="button"
                  className="btn-save"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                >
                  Editar Promoção
                </button>
              </div>
            ) : (
              <button type="submit" className="btn-save">
                Salvar Oferta
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
