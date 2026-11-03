import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import {
  getCommercialProducts,
  type CommercialDomainProduct,
} from "../../service/commercialService";
import {
  getHotmartIntegrationOverview,
  removeHotmartProductMapping,
  saveHotmartIntegration,
  saveHotmartProductMapping,
  type HotmartIntegrationOverview,
} from "../../service/hotmartService";
import "./HotmartIntegrationSettings.css";

const HOTMART_PAYLOAD_EXAMPLE = `{
  "event": "PURCHASE_APPROVED",
  "data": {
    "buyer": {
      "name": "Maria da Silva",
      "email": "maria@email.com",
      "phone": "+55 11 99999-0000"
    },
    "purchase": {
      "status": "APPROVED",
      "transaction": "HP123456789",
      "product": {
        "id": "987654",
        "name": "Mentoria Comercial"
      }
    }
  }
}`;

type HotmartIntegrationSettingsProps = {
  empresaId: number | null;
};

type DraftState = {
  hottok: string;
  ativo: boolean;
  sincronizar_vendas: boolean;
  sincronizar_carrinho_abandonado: boolean;
  sincronizar_assinaturas: boolean;
  sincronizar_reembolsos: boolean;
  vincular_clientes_existentes: boolean;
  criar_clientes_automaticamente: boolean;
};

function formatDateTime(value?: string | null) {
  if (!value) return "Sem registro";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem registro";
  return parsed.toLocaleString("pt-BR");
}

function formatCategoryLabel(value: string) {
  switch (value) {
    case "vendas":
      return "Vendas";
    case "carrinho_abandonado":
      return "Carrinho abandonado";
    case "assinaturas":
      return "Assinaturas";
    case "reembolsos":
      return "Reembolsos";
    default:
      return value || "Nao categorizado";
  }
}

function buildDraft(overview: HotmartIntegrationOverview): DraftState {
  return {
    hottok: "",
    ativo: overview.integracao.ativo,
    sincronizar_vendas: overview.integracao.sincronizar_vendas,
    sincronizar_carrinho_abandonado:
      overview.integracao.sincronizar_carrinho_abandonado,
    sincronizar_assinaturas: overview.integracao.sincronizar_assinaturas,
    sincronizar_reembolsos: overview.integracao.sincronizar_reembolsos,
    vincular_clientes_existentes:
      overview.integracao.vincular_clientes_existentes,
    criar_clientes_automaticamente:
      overview.integracao.criar_clientes_automaticamente,
  };
}

export function HotmartIntegrationSettings({
  empresaId,
}: HotmartIntegrationSettingsProps) {
  const { addToast } = useToast();
  const [overview, setOverview] = useState<HotmartIntegrationOverview | null>(
    null,
  );
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [commercialProducts, setCommercialProducts] = useState<
    CommercialDomainProduct[]
  >([]);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, string>>({});
  const [savingMappingKey, setSavingMappingKey] = useState<string | null>(null);
  const [removingMappingKey, setRemovingMappingKey] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!empresaId) return;

    try {
      setIsLoading(true);
      setError("");
      const [nextOverview, nextProducts] = await Promise.all([
        getHotmartIntegrationOverview(empresaId),
        getCommercialProducts(),
      ]);
      setOverview(nextOverview);
      setDraft(buildDraft(nextOverview));
      setCommercialProducts(nextProducts);
      setMappingDrafts(
        Object.fromEntries(
          (nextOverview.produtos_detectados || []).map((item) => [
            item.hotmart_product_key,
            item.comercial_produto_id ? String(item.comercial_produto_id) : "",
          ]),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel carregar a integracao da Hotmart.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const hasUnsavedChanges = useMemo(() => {
    if (!overview || !draft) return false;

    return (
      draft.hottok.trim().length > 0 ||
      draft.ativo !== overview.integracao.ativo ||
      draft.sincronizar_vendas !== overview.integracao.sincronizar_vendas ||
      draft.sincronizar_carrinho_abandonado !==
        overview.integracao.sincronizar_carrinho_abandonado ||
      draft.sincronizar_assinaturas !==
        overview.integracao.sincronizar_assinaturas ||
      draft.sincronizar_reembolsos !==
        overview.integracao.sincronizar_reembolsos ||
      draft.vincular_clientes_existentes !==
        overview.integracao.vincular_clientes_existentes ||
      draft.criar_clientes_automaticamente !==
        overview.integracao.criar_clientes_automaticamente
    );
  }, [draft, overview]);

  const handleCopyWebhookUrl = useCallback(async () => {
    const webhookUrl = overview?.integracao.webhook_url;
    if (!webhookUrl) {
      addToast({
        type: "warning",
        title: "URL indisponivel",
        description: "Nao ha URL da Hotmart para copiar.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(webhookUrl);
      addToast({
        type: "success",
        title: "URL copiada",
        description: "A URL da Hotmart foi copiada para a area de transferencia.",
      });
    } catch {
      addToast({
        type: "error",
        title: "Erro ao copiar URL",
        description: "Nao foi possivel copiar a URL do webhook da Hotmart.",
      });
    }
  }, [addToast, overview?.integracao.webhook_url]);

  const handleSave = useCallback(async () => {
    if (!empresaId || !draft) return;

    try {
      setIsSaving(true);
      const result = await saveHotmartIntegration({
        empresaId,
        hottok: draft.hottok,
        ativo: draft.ativo,
        sincronizar_vendas: draft.sincronizar_vendas,
        sincronizar_carrinho_abandonado: draft.sincronizar_carrinho_abandonado,
        sincronizar_assinaturas: draft.sincronizar_assinaturas,
        sincronizar_reembolsos: draft.sincronizar_reembolsos,
        vincular_clientes_existentes: draft.vincular_clientes_existentes,
        criar_clientes_automaticamente: draft.criar_clientes_automaticamente,
      });
      setOverview(result.overview);
      setDraft(buildDraft(result.overview));
      setMappingDrafts(
        Object.fromEntries(
          (result.overview.produtos_detectados || []).map((item) => [
            item.hotmart_product_key,
            item.comercial_produto_id ? String(item.comercial_produto_id) : "",
          ]),
        ),
      );
      addToast({
        type: "success",
        title: "Hotmart atualizada",
        description: result.message,
      });
    } catch (saveError) {
      addToast({
        type: "error",
        title: "Erro ao salvar Hotmart",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Nao foi possivel salvar a integracao da Hotmart.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [addToast, draft, empresaId]);

  const handleChangeProductMapping = useCallback(
    (productKey: string, value: string) => {
      setMappingDrafts((current) => ({
        ...current,
        [productKey]: value,
      }));
    },
    [],
  );

  const handleSaveProductMapping = useCallback(
    async (productKey: string) => {
      if (!empresaId || !overview) return;
      const detectedProduct = overview.produtos_detectados.find(
        (item) => item.hotmart_product_key === productKey,
      );
      const selectedProductId = Number(mappingDrafts[productKey] || 0);

      if (!detectedProduct) return;
      if (!selectedProductId) {
        addToast({
          type: "warning",
          title: "Produto nao selecionado",
          description: "Escolha um produto comercial antes de salvar o vinculo.",
        });
        return;
      }

      try {
        setSavingMappingKey(productKey);
        const result = await saveHotmartProductMapping({
          empresaId,
          hotmartProductKey: detectedProduct.hotmart_product_key,
          hotmartProductId: detectedProduct.hotmart_product_id || undefined,
          hotmartOfferCode: detectedProduct.hotmart_offer_code || undefined,
          hotmartProductName: detectedProduct.hotmart_product_name,
          comercialProdutoId: selectedProductId,
        });
        setOverview(result.overview);
        setMappingDrafts(
          Object.fromEntries(
            (result.overview.produtos_detectados || []).map((item) => [
              item.hotmart_product_key,
              item.comercial_produto_id ? String(item.comercial_produto_id) : "",
            ]),
          ),
        );
        addToast({
          type: "success",
          title: "Produto vinculado",
          description: result.message,
        });
      } catch (mappingError) {
        addToast({
          type: "error",
          title: "Erro ao vincular produto",
          description:
            mappingError instanceof Error
              ? mappingError.message
              : "Nao foi possivel vincular o produto Hotmart.",
        });
      } finally {
        setSavingMappingKey(null);
      }
    },
    [addToast, empresaId, mappingDrafts, overview],
  );

  const handleRemoveProductMapping = useCallback(
    async (productKey: string) => {
      if (!empresaId) return;

      try {
        setRemovingMappingKey(productKey);
        const result = await removeHotmartProductMapping({
          empresaId,
          hotmartProductKey: productKey,
        });
        setOverview(result.overview);
        setMappingDrafts(
          Object.fromEntries(
            (result.overview.produtos_detectados || []).map((item) => [
              item.hotmart_product_key,
              item.comercial_produto_id ? String(item.comercial_produto_id) : "",
            ]),
          ),
        );
        addToast({
          type: "success",
          title: "Produto desvinculado",
          description: result.message,
        });
      } catch (mappingError) {
        addToast({
          type: "error",
          title: "Erro ao desvincular produto",
          description:
            mappingError instanceof Error
              ? mappingError.message
              : "Nao foi possivel desvincular o produto Hotmart.",
        });
      } finally {
        setRemovingMappingKey(null);
      }
    },
    [addToast, empresaId],
  );

  if (isLoading) {
    return (
      <p className="settings-integration-loading">
        Carregando configuracao da Hotmart...
      </p>
    );
  }

  if (error) {
    return (
      <div className="settings-integration-error-box">
        <p>{error}</p>
        <button
          type="button"
          className="settings-integration-button settings-integration-button--secondary"
          onClick={() => void loadOverview()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!overview || !draft) return null;

  return (
    <article className="settings-integration-panel settings-integration-panel--webhook">
      <h3>Hotmart</h3>
      <p className="settings-integration-panel__description">
        Receba eventos da Hotmart, como vendas e carrinho abandonado, e tente
        vincular o comprador a contatos ja existentes pelo telefone normalizado.
      </p>

      <div className="settings-integration-grid">
        <p className="settings-integration-grid-item">
          <strong>Status:</strong>{" "}
          <span
            className={
              overview.integracao.ativo
                ? "settings-integration-status settings-integration-status--active"
                : "settings-integration-status settings-integration-status--inactive"
            }
          >
            {overview.integracao.ativo ? "Ativo" : "Inativo"}
          </span>
        </p>
        <p className="settings-integration-grid-item">
          <strong>Metodo:</strong> POST
        </p>
        <p className="settings-integration-grid-item settings-integration-grid-item--stacked">
          <strong>Header oficial:</strong>
          <span>{overview.official_header_name}</span>
        </p>
        <p className="settings-integration-grid-item settings-integration-grid-item--stacked">
          <strong>Hottok configurado:</strong>
          <span>{overview.integracao.hottok_configurado ? "Sim" : "Nao"}</span>
        </p>
        <p className="settings-integration-grid-item settings-integration-grid-item--full">
          <strong>URL:</strong> {overview.integracao.webhook_url || "-"}
        </p>
        <p className="settings-integration-grid-item">
          <strong>Ultimo evento:</strong>{" "}
          {formatDateTime(overview.summary.ultimo_evento_em)}
        </p>
        <p className="settings-integration-grid-item">
          <strong>Ultima sincronizacao:</strong>{" "}
          {formatDateTime(overview.summary.ultima_sincronizacao_em)}
        </p>
      </div>

      <div className="settings-integration-actions">
        <button
          type="button"
          className="settings-integration-button settings-integration-button--primary"
          onClick={handleCopyWebhookUrl}
        >
          Copiar URL
        </button>
        <button
          type="button"
          className="settings-integration-button settings-integration-button--secondary"
          onClick={() => void loadOverview()}
        >
          Atualizar
        </button>
      </div>

      <div className="hotmart-integration-form">
        <label className="hotmart-integration-field">
          <span>Hottok da Hotmart</span>
          <input
            type="text"
            value={draft.hottok}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      hottok: event.target.value,
                    }
                  : current,
              )
            }
            placeholder={
              overview.integracao.hottok_configurado
                ? "Preencha apenas se quiser trocar o Hottok atual"
                : "Cole aqui o Hottok informado pela Hotmart"
            }
          />
        </label>

        <div className="hotmart-integration-switches">
          <label className="hotmart-integration-check">
            <input
              type="checkbox"
              checked={draft.ativo}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        ativo: event.target.checked,
                      }
                    : current,
                )
              }
            />
            <div>
              <strong>Ativar integracao</strong>
              <span>Libera o recebimento do webhook da Hotmart neste funil.</span>
            </div>
          </label>

          <label className="hotmart-integration-check">
            <input
              type="checkbox"
              checked={draft.sincronizar_vendas}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sincronizar_vendas: event.target.checked,
                      }
                    : current,
                )
              }
            />
            <div>
              <strong>Sincronizar vendas e pagamentos</strong>
              <span>Inclui compras aprovadas e eventos de pagamento.</span>
            </div>
          </label>

          <label className="hotmart-integration-check">
            <input
              type="checkbox"
              checked={draft.sincronizar_carrinho_abandonado}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sincronizar_carrinho_abandonado: event.target.checked,
                      }
                    : current,
                )
              }
            />
            <div>
              <strong>Sincronizar carrinho abandonado</strong>
              <span>Usa o telefone do lead para tentar vincular o contato.</span>
            </div>
          </label>

          <label className="hotmart-integration-check">
            <input
              type="checkbox"
              checked={draft.sincronizar_assinaturas}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sincronizar_assinaturas: event.target.checked,
                      }
                    : current,
                )
              }
            />
            <div>
              <strong>Sincronizar assinaturas</strong>
              <span>Cobre recorrencia, atraso e ajustes de cobranca.</span>
            </div>
          </label>

          <label className="hotmart-integration-check">
            <input
              type="checkbox"
              checked={draft.sincronizar_reembolsos}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        sincronizar_reembolsos: event.target.checked,
                      }
                    : current,
                )
              }
            />
            <div>
              <strong>Sincronizar reembolsos e chargebacks</strong>
              <span>Registra eventos de devolucao, cancelamento e contestacao.</span>
            </div>
          </label>

          <label className="hotmart-integration-check">
            <input
              type="checkbox"
              checked={draft.vincular_clientes_existentes}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        vincular_clientes_existentes: event.target.checked,
                      }
                    : current,
                )
              }
            />
            <div>
              <strong>Vincular clientes existentes</strong>
              <span>
                Procura primeiro por telefone normalizado e e-mail ja
                cadastrados.
              </span>
            </div>
          </label>

          <label className="hotmart-integration-check">
            <input
              type="checkbox"
              checked={draft.criar_clientes_automaticamente}
              onChange={(event) =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        criar_clientes_automaticamente: event.target.checked,
                      }
                    : current,
                )
              }
            />
            <div>
              <strong>Criar contato se nao existir</strong>
              <span>
                Quando nao encontra o cliente, cria um novo contato com origem
                Hotmart.
              </span>
            </div>
          </label>
        </div>

        <div className="settings-integration-actions hotmart-integration-actions">
          <button
            type="button"
            className="settings-integration-button settings-integration-button--primary"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasUnsavedChanges}
          >
            {isSaving ? "Salvando..." : "Salvar integracao"}
          </button>
        </div>
      </div>

      <div className="hotmart-integration-summary-grid">
        <div className="hotmart-integration-stat">
          <strong>{overview.summary.total_eventos}</strong>
          <span>Eventos recebidos</span>
        </div>
        <div className="hotmart-integration-stat">
          <strong>{overview.summary.total_processados}</strong>
          <span>Eventos processados</span>
        </div>
        <div className="hotmart-integration-stat">
          <strong>{overview.summary.total_clientes_vinculados}</strong>
          <span>Clientes vinculados</span>
        </div>
      </div>

      <div className="settings-webhook-hint">
        O webhook usa o header <strong>{overview.official_header_name}</strong>.
        Segundo a documentacao da Hotmart, eventos de compra trazem o telefone
        do comprador e o de carrinho abandonado traz <strong>data.buyer.phone</strong>,
        que e o campo usado para normalizacao.
      </div>

      <div className="settings-webhook-payload">
        <h4>Exemplo de payload esperado:</h4>
        <pre>{HOTMART_PAYLOAD_EXAMPLE}</pre>
      </div>

      <section className="hotmart-mapping">
        <header className="hotmart-events__header">
          <h4>Vinculacao de produtos</h4>
          <p>
            Relacione cada produto recebido da Hotmart com um produto do
            catalogo comercial do CRM.
          </p>
        </header>

        {!overview.produtos_detectados.length ? (
          <p className="hotmart-events__empty">
            Nenhum produto Hotmart foi detectado nos eventos recebidos ate agora.
          </p>
        ) : (
          <div className="hotmart-mapping__list">
            {overview.produtos_detectados.map((product) => {
              const selectedValue = mappingDrafts[product.hotmart_product_key] || "";
              const isMapped =
                product.comercial_produto_id !== null &&
                product.comercial_produto_id !== undefined;
              const hasChanged =
                selectedValue !==
                (product.comercial_produto_id ? String(product.comercial_produto_id) : "");

              return (
                <article
                  key={product.hotmart_product_key}
                  className="hotmart-mapping-card"
                >
                  <div className="hotmart-mapping-card__info">
                    <strong>{product.hotmart_product_name || "Produto sem nome"}</strong>
                    <span>
                      ID Hotmart: {product.hotmart_product_id || product.hotmart_product_key}
                    </span>
                    {product.hotmart_offer_code ? (
                      <span>Oferta Hotmart: {product.hotmart_offer_code}</span>
                    ) : null}
                    <span>
                      Eventos: {product.total_eventos} • Ultimo em{" "}
                      {formatDateTime(product.ultimo_recebimento_em)}
                    </span>
                    <span>
                      Mapeado hoje para:{" "}
                      {product.comercial_produto_nome || "Nenhum produto comercial vinculado"}
                    </span>
                  </div>

                  <div className="hotmart-mapping-card__controls">
                    <select
                      value={selectedValue}
                      onChange={(event) =>
                        handleChangeProductMapping(
                          product.hotmart_product_key,
                          event.target.value,
                        )
                      }
                    >
                      <option value="">Selecione um produto comercial...</option>
                      {commercialProducts.map((catalogProduct) => (
                        <option
                          key={catalogProduct.id}
                          value={String(catalogProduct.id)}
                        >
                          {catalogProduct.nome} - R${" "}
                          {Number(catalogProduct.preco_base || 0).toFixed(2)}
                        </option>
                      ))}
                    </select>
                    {!commercialProducts.length ? (
                      <p className="hotmart-mapping-card__hint">
                        Cadastre um produto no CRM comercial para liberar esta vinculacao.
                      </p>
                    ) : null}

                    <div className="hotmart-mapping-card__actions">
                      <button
                        type="button"
                        className="settings-integration-button settings-integration-button--primary"
                        onClick={() => void handleSaveProductMapping(product.hotmart_product_key)}
                        disabled={
                          savingMappingKey === product.hotmart_product_key ||
                          !commercialProducts.length ||
                          !selectedValue ||
                          !hasChanged
                        }
                      >
                        {savingMappingKey === product.hotmart_product_key
                          ? "Salvando..."
                          : "Vincular"}
                      </button>

                      {isMapped ? (
                        <button
                          type="button"
                          className="settings-integration-button settings-integration-button--secondary"
                          onClick={() =>
                            void handleRemoveProductMapping(product.hotmart_product_key)
                          }
                          disabled={
                            removingMappingKey === product.hotmart_product_key
                          }
                        >
                          {removingMappingKey === product.hotmart_product_key
                            ? "Removendo..."
                            : "Desvincular"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="hotmart-events">
        <header className="hotmart-events__header">
          <h4>Ultimos 20 eventos</h4>
          <p>Mostra o resultado do vinculo com contatos e o status do processo.</p>
        </header>

        {!overview.eventos_recentes.length ? (
          <p className="hotmart-events__empty">
            Nenhum evento Hotmart recebido ainda.
          </p>
        ) : (
          <div className="hotmart-events__list">
            {overview.eventos_recentes.map((event) => (
              <article key={event.id} className="hotmart-event-card">
                <div className="hotmart-event-card__topline">
                  <strong>{event.tipo_evento || "Evento sem nome"}</strong>
                  <span>{formatDateTime(event.recebido_em)}</span>
                </div>
                <div className="hotmart-event-card__badges">
                  <span>{formatCategoryLabel(event.categoria_evento)}</span>
                  <span>{event.status_compra || "Sem status"}</span>
                  <span>{event.processado ? "Processado" : "Ignorado"}</span>
                </div>
                <p>
                  <strong>Cliente:</strong>{" "}
                  {event.cliente_nome ||
                    event.cliente_email ||
                    event.cliente_telefone_normalizado ||
                    "Nao identificado"}
                </p>
                <p>
                  <strong>Telefone:</strong>{" "}
                  {event.cliente_telefone_normalizado ||
                    event.cliente_telefone ||
                    "-"}
                </p>
                <p>
                  <strong>Produto:</strong> {event.produto_nome || "-"}
                </p>
                <p>
                  <strong>Transacao:</strong> {event.transacao_id || "-"}
                </p>
                <p>{event.mensagem_processamento || "Sem observacoes."}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
