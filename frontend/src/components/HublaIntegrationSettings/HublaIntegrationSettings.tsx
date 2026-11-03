import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import {
  getCommercialProducts,
  type CommercialDomainProduct,
} from "../../service/commercialService";
import {
  getHublaIntegrationOverview,
  removeHublaProductMapping,
  removeHublaUtmSellerRule,
  saveHublaIntegration,
  saveHublaProductMapping,
  saveHublaUtmSellerRule,
  type HublaIntegrationOverview,
  type HublaUtmSellerRule,
} from "../../service/hublaService";
import "../HotmartIntegrationSettings/HotmartIntegrationSettings.css";

const HUBLA_PAYLOAD_EXAMPLE = `{
  "type": "invoice.paid",
  "version": "2.0.0",
  "event": {
    "customer": {
      "name": "Maria da Silva",
      "email": "maria@email.com",
      "phone": "+55 11 99999-0000"
    },
    "invoice": {
      "id": "invoice_123",
      "status": "paid"
    },
    "product": {
      "id": "987654",
      "name": "Mentoria Comercial"
    }
  }
}`;

type HublaIntegrationSettingsProps = {
  empresaId: number | null;
};

type DraftState = {
  hublaToken: string;
  ativo: boolean;
  sincronizar_vendas: boolean;
  sincronizar_carrinho_abandonado: boolean;
  sincronizar_assinaturas: boolean;
  sincronizar_reembolsos: boolean;
  vincular_clientes_existentes: boolean;
  criar_clientes_automaticamente: boolean;
};

const UTM_FIELD_OPTIONS: Array<{
  value: HublaUtmSellerRule["utm_campo"];
  label: string;
}> = [
  { value: "source", label: "Source" },
  { value: "medium", label: "Medium" },
  { value: "campaign", label: "Campaign" },
  { value: "content", label: "Content" },
  { value: "term", label: "Term" },
];

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

function buildDraft(overview: HublaIntegrationOverview): DraftState {
  return {
    hublaToken: "",
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

export function HublaIntegrationSettings({
  empresaId,
}: HublaIntegrationSettingsProps) {
  const { addToast } = useToast();
  const [overview, setOverview] = useState<HublaIntegrationOverview | null>(
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
  const [utmField, setUtmField] = useState<HublaUtmSellerRule["utm_campo"]>(
    "source",
  );
  const [utmValue, setUtmValue] = useState("");
  const [utmSellerId, setUtmSellerId] = useState("");
  const [isSavingUtmRule, setIsSavingUtmRule] = useState(false);
  const [removingUtmRuleId, setRemovingUtmRuleId] = useState<number | null>(null);

  const loadOverview = useCallback(async () => {
    if (!empresaId) return;

    try {
      setIsLoading(true);
      setError("");
      const [nextOverview, nextProducts] = await Promise.all([
        getHublaIntegrationOverview(empresaId),
        getCommercialProducts(),
      ]);
      setOverview(nextOverview);
      setDraft(buildDraft(nextOverview));
      setCommercialProducts(nextProducts);
      setMappingDrafts(
        Object.fromEntries(
          (nextOverview.produtos_detectados || []).map((item) => [
            item.hubla_product_key,
            item.comercial_produto_id ? String(item.comercial_produto_id) : "",
          ]),
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel carregar a integracao da Hubla.",
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
      draft.hublaToken.trim().length > 0 ||
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
        description: "Nao ha URL da Hubla para copiar.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(webhookUrl);
      addToast({
        type: "success",
        title: "URL copiada",
        description: "A URL da Hubla foi copiada para a area de transferencia.",
      });
    } catch {
      addToast({
        type: "error",
        title: "Erro ao copiar URL",
        description: "Nao foi possivel copiar a URL do webhook da Hubla.",
      });
    }
  }, [addToast, overview?.integracao.webhook_url]);

  const handleSave = useCallback(async () => {
    if (!empresaId || !draft) return;

    try {
      setIsSaving(true);
      const result = await saveHublaIntegration({
        empresaId,
        hublaToken: draft.hublaToken,
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
            item.hubla_product_key,
            item.comercial_produto_id ? String(item.comercial_produto_id) : "",
          ]),
        ),
      );
      addToast({
        type: "success",
        title: "Hubla atualizada",
        description: result.message,
      });
    } catch (saveError) {
      addToast({
        type: "error",
        title: "Erro ao salvar Hubla",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Nao foi possivel salvar a integracao da Hubla.",
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
        (item) => item.hubla_product_key === productKey,
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
        const result = await saveHublaProductMapping({
          empresaId,
          hublaProductKey: detectedProduct.hubla_product_key,
          hublaProductId: detectedProduct.hubla_product_id || undefined,
          hublaOfferCode: detectedProduct.hubla_offer_code || undefined,
          hublaProductName: detectedProduct.hubla_product_name,
          comercialProdutoId: selectedProductId,
        });
        setOverview(result.overview);
        setMappingDrafts(
          Object.fromEntries(
            (result.overview.produtos_detectados || []).map((item) => [
              item.hubla_product_key,
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
              : "Nao foi possivel vincular o produto Hubla.",
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
        const result = await removeHublaProductMapping({
          empresaId,
          hublaProductKey: productKey,
        });
        setOverview(result.overview);
        setMappingDrafts(
          Object.fromEntries(
            (result.overview.produtos_detectados || []).map((item) => [
              item.hubla_product_key,
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
              : "Nao foi possivel desvincular o produto Hubla.",
        });
      } finally {
        setRemovingMappingKey(null);
      }
    },
    [addToast, empresaId],
  );

  const handleSaveUtmRule = useCallback(async () => {
    if (!empresaId || !utmValue.trim() || !Number(utmSellerId)) {
      addToast({
        type: "warning",
        title: "Regra incompleta",
        description: "Selecione o vendedor e informe o valor da UTM.",
      });
      return;
    }

    try {
      setIsSavingUtmRule(true);
      const result = await saveHublaUtmSellerRule({
        empresaId,
        sellerId: Number(utmSellerId),
        utmField,
        utmValue: utmValue.trim(),
      });
      setOverview(result.overview);
      setUtmValue("");
      addToast({
        type: "success",
        title: "Regra UTM salva",
        description: result.message,
      });
    } catch (ruleError) {
      addToast({
        type: "error",
        title: "Erro ao salvar regra UTM",
        description:
          ruleError instanceof Error
            ? ruleError.message
            : "Nao foi possivel salvar a regra UTM.",
      });
    } finally {
      setIsSavingUtmRule(false);
    }
  }, [addToast, empresaId, utmField, utmSellerId, utmValue]);

  const handleRemoveUtmRule = useCallback(
    async (ruleId: number) => {
      if (!empresaId) return;
      try {
        setRemovingUtmRuleId(ruleId);
        const result = await removeHublaUtmSellerRule({ empresaId, ruleId });
        setOverview(result.overview);
        addToast({
          type: "success",
          title: "Regra UTM removida",
          description: result.message,
        });
      } catch (ruleError) {
        addToast({
          type: "error",
          title: "Erro ao remover regra UTM",
          description:
            ruleError instanceof Error
              ? ruleError.message
              : "Nao foi possivel remover a regra UTM.",
        });
      } finally {
        setRemovingUtmRuleId(null);
      }
    },
    [addToast, empresaId],
  );

  if (isLoading) {
    return (
      <p className="settings-integration-loading">
        Carregando configuracao da Hubla...
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
      <h3>Hubla</h3>
      <p className="settings-integration-panel__description">
        Receba eventos da Hubla, como vendas e carrinho abandonado, e tente
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
          <strong>Token configurado:</strong>
          <span>{overview.integracao.hubla_token_configurado ? "Sim" : "Nao"}</span>
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
          <span>Token do webhook da Hubla</span>
          <input
            type="text"
            value={draft.hublaToken}
            onChange={(event) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      hublaToken: event.target.value,
                    }
                  : current,
              )
            }
            placeholder={
              overview.integracao.hubla_token_configurado
                ? "Preencha apenas se quiser trocar o token atual"
                : "Cole aqui o token configurado no webhook da Hubla"
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
              <span>Libera o recebimento do webhook da Hubla neste funil.</span>
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
                Hubla.
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
        O token deve ser enviado no header <strong>X-Hubla-Token</strong>. O sistema
        usa telefone e e-mail do cliente para vincular ou criar o contato.
      </div>

      <div className="settings-webhook-payload">
        <h4>Exemplo de payload esperado:</h4>
        <pre>{HUBLA_PAYLOAD_EXAMPLE}</pre>
      </div>

      <section className="hotmart-mapping hubla-utm-mapping">
        <header className="hotmart-events__header">
          <h4>Atribuicao automatica por UTM</h4>
          <p>
            Quando uma venda combinar exatamente com a regra, ela sera atribuida
            ao vendedor selecionado. A comparacao ignora maiusculas e minusculas.
          </p>
        </header>

        <div className="hubla-utm-mapping__form">
          <label>
            <span>Campo UTM</span>
            <select
              value={utmField}
              onChange={(event) =>
                setUtmField(event.target.value as HublaUtmSellerRule["utm_campo"])
              }
            >
              {UTM_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Valor esperado</span>
            <input
              value={utmValue}
              onChange={(event) => setUtmValue(event.target.value)}
              placeholder="Ex.: oferta-principal"
              maxLength={255}
            />
          </label>
          <label>
            <span>Vendedor</span>
            <select
              value={utmSellerId}
              onChange={(event) => setUtmSellerId(event.target.value)}
            >
              <option value="">Selecione...</option>
              {overview.vendedores.map((seller) => (
                <option key={seller.id} value={String(seller.id)}>
                  {seller.nome}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="settings-integration-button settings-integration-button--primary"
            onClick={() => void handleSaveUtmRule()}
            disabled={isSavingUtmRule || !utmValue.trim() || !utmSellerId}
          >
            {isSavingUtmRule ? "Salvando..." : "Adicionar regra"}
          </button>
        </div>

        {!overview.utm_vendedor_regras.length ? (
          <p className="hotmart-events__empty">Nenhuma regra UTM cadastrada.</p>
        ) : (
          <div className="hubla-utm-mapping__rules">
            {overview.utm_vendedor_regras.map((rule) => (
              <article key={rule.id} className="hubla-utm-rule">
                <div>
                  <strong>{rule.vendedor_nome}</strong>
                  <span>
                    utm_{rule.utm_campo} = <b>{rule.utm_valor}</b>
                  </span>
                </div>
                <button
                  type="button"
                  className="settings-integration-button settings-integration-button--secondary"
                  onClick={() => void handleRemoveUtmRule(rule.id)}
                  disabled={removingUtmRuleId === rule.id}
                >
                  {removingUtmRuleId === rule.id ? "Removendo..." : "Remover"}
                </button>
              </article>
            ))}
          </div>
        )}
        <p className="hubla-utm-mapping__hint">
          Um vendedor pode ter varias regras. Se mais de uma regra combinar, a
          regra cadastrada primeiro sera utilizada.
        </p>
      </section>

      <section className="hotmart-mapping">
        <header className="hotmart-events__header">
          <h4>Vinculacao de produtos</h4>
          <p>
            Relacione cada produto recebido da Hubla com um produto do
            catalogo comercial do CRM.
          </p>
        </header>

        {!overview.produtos_detectados.length ? (
          <p className="hotmart-events__empty">
            Nenhum produto Hubla foi detectado nos eventos recebidos ate agora.
          </p>
        ) : (
          <div className="hotmart-mapping__list">
            {overview.produtos_detectados.map((product) => {
              const selectedValue = mappingDrafts[product.hubla_product_key] || "";
              const isMapped =
                product.comercial_produto_id !== null &&
                product.comercial_produto_id !== undefined;
              const hasChanged =
                selectedValue !==
                (product.comercial_produto_id ? String(product.comercial_produto_id) : "");

              return (
                <article
                  key={product.hubla_product_key}
                  className="hotmart-mapping-card"
                >
                  <div className="hotmart-mapping-card__info">
                    <strong>{product.hubla_product_name || "Produto sem nome"}</strong>
                    <span>
                      ID Hubla: {product.hubla_product_id || product.hubla_product_key}
                    </span>
                    {product.hubla_offer_code ? (
                      <span>Oferta Hubla: {product.hubla_offer_code}</span>
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
                          product.hubla_product_key,
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
                        onClick={() => void handleSaveProductMapping(product.hubla_product_key)}
                        disabled={
                          savingMappingKey === product.hubla_product_key ||
                          !commercialProducts.length ||
                          !selectedValue ||
                          !hasChanged
                        }
                      >
                        {savingMappingKey === product.hubla_product_key
                          ? "Salvando..."
                          : "Vincular"}
                      </button>

                      {isMapped ? (
                        <button
                          type="button"
                          className="settings-integration-button settings-integration-button--secondary"
                          onClick={() =>
                            void handleRemoveProductMapping(product.hubla_product_key)
                          }
                          disabled={
                            removingMappingKey === product.hubla_product_key
                          }
                        >
                          {removingMappingKey === product.hubla_product_key
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
            Nenhum evento Hubla recebido ainda.
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
