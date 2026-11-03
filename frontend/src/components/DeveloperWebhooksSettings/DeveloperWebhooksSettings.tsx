import { useEffect, useState } from "react";
import "./DeveloperWebhooksSettings.css";
import { useToast } from "../../contexts/ToastContext";
import {
  deleteDeveloperWebhook,
  getDeveloperWebhookHistory,
  getDeveloperWebhooks,
  saveDeveloperWebhook,
  type DeveloperWebhookEventCatalogItem,
  type DeveloperWebhookEventKey,
  type DeveloperWebhookHistoryRecord,
  type DeveloperWebhookRecord,
  type DeveloperWebhookSecurityLocation,
} from "../../service/developerWebhooksService";

type DeveloperWebhooksSettingsProps = {
  empresaId: number | null;
};

type FormState = {
  id: number | null;
  nome: string;
  url: string;
  securityKey: string;
  securityLocation: DeveloperWebhookSecurityLocation;
  securityFieldName: string;
  ativo: boolean;
  eventos: DeveloperWebhookEventKey[];
};

const EMPTY_FORM: FormState = {
  id: null,
  nome: "",
  url: "",
  securityKey: "",
  securityLocation: "header",
  securityFieldName: "x-webhook-codigo",
  ativo: true,
  eventos: [],
};

const SECURITY_LOCATION_OPTIONS: Array<{
  value: DeveloperWebhookSecurityLocation;
  label: string;
  helper: string;
}> = [
  {
    value: "header",
    label: "Header HTTP",
    helper: "Envia a chave em um header customizado da requisicao.",
  },
  {
    value: "body",
    label: "Campo no body",
    helper: "Envia a chave como campo adicional dentro do JSON enviado.",
  },
  {
    value: "query",
    label: "Parametro na URL",
    helper: "Envia a chave como parametro de query string na URL final.",
  },
];

export function DeveloperWebhooksSettings({ empresaId }: DeveloperWebhooksSettingsProps) {
  const { addToast } = useToast();
  const [webhooks, setWebhooks] = useState<DeveloperWebhookRecord[]>([]);
  const [eventCatalog, setEventCatalog] = useState<DeveloperWebhookEventCatalogItem[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [historyWebhookId, setHistoryWebhookId] = useState<number | null>(null);
  const [historyEntries, setHistoryEntries] = useState<DeveloperWebhookHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    if (!empresaId) return;

    try {
      setIsLoading(true);
      setError("");
      const result = await getDeveloperWebhooks(empresaId);
      setWebhooks(result.webhooks);
      setEventCatalog(result.eventCatalog);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel carregar os webhooks de desenvolvedor.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [empresaId]);

  async function loadHistory(webhookId: number) {
    if (!empresaId) return;

    try {
      setHistoryWebhookId(webhookId);
      setIsLoadingHistory(true);
      const result = await getDeveloperWebhookHistory({
        empresaId,
        webhookId,
        limit: 30,
      });
      setHistoryEntries(result);
    } catch (historyError) {
      addToast({
        type: "error",
        title: "Erro ao carregar historico",
        description:
          historyError instanceof Error
            ? historyError.message
            : "Nao foi possivel carregar o historico do webhook.",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function handleToggleEvent(eventKey: DeveloperWebhookEventKey) {
    setForm((current) => ({
      ...current,
      eventos: current.eventos.includes(eventKey)
        ? current.eventos.filter((item) => item !== eventKey)
        : [...current.eventos, eventKey],
    }));
  }

  function handleEdit(webhook: DeveloperWebhookRecord) {
    setForm({
      id: webhook.id,
      nome: webhook.nome,
      url: webhook.url,
      securityKey: webhook.security_key,
      securityLocation: webhook.security_location,
      securityFieldName: webhook.security_field_name,
      ativo: webhook.ativo,
      eventos: webhook.eventos,
    });
  }

  function handleReset() {
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!empresaId) return;

    try {
      setIsSaving(true);
      const result = await saveDeveloperWebhook({
        empresaId,
        id: form.id,
        nome: form.nome,
        url: form.url,
        securityKey: form.securityKey,
        securityLocation: form.securityLocation,
        securityFieldName: form.securityFieldName,
        eventos: form.eventos,
        ativo: form.ativo,
      });

      addToast({
        type: "success",
        title: form.id ? "Webhook atualizado" : "Webhook criado",
        description: result.message,
      });

      handleReset();
      await loadData();
    } catch (saveError) {
      addToast({
        type: "error",
        title: "Erro ao salvar webhook",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Nao foi possivel salvar o webhook de desenvolvedor.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!empresaId) return;
    if (!window.confirm("Deseja remover este webhook de desenvolvedor?")) return;

    try {
      setDeletingId(id);
      const message = await deleteDeveloperWebhook({ empresaId, id });
      if (form.id === id) {
        handleReset();
      }
      if (historyWebhookId === id) {
        setHistoryWebhookId(null);
        setHistoryEntries([]);
      }
      addToast({
        type: "success",
        title: "Webhook removido",
        description: message,
      });
      await loadData();
    } catch (deleteError) {
      addToast({
        type: "error",
        title: "Erro ao remover webhook",
        description:
          deleteError instanceof Error
            ? deleteError.message
            : "Nao foi possivel remover o webhook de desenvolvedor.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  function getEventLabel(eventKey: string) {
    return eventCatalog.find((item) => item.key === eventKey)?.label || eventKey;
  }

  function getHistoryStatusLabel(status: string) {
    if (status === "success") return "Sucesso";
    if (status === "error") return "Erro";
    return "Processando";
  }

  function formatDateTime(value: string | null) {
    if (!value) return "-";

    try {
      return new Date(value).toLocaleString("pt-BR");
    } catch {
      return value;
    }
  }

  const selectedHistoryWebhook =
    historyWebhookId !== null ? webhooks.find((item) => item.id === historyWebhookId) || null : null;

  return (
    <section className="developer-webhooks-settings">
      <header className="developer-webhooks-settings__header">
        <div>
          <h2>Desenvolvedores</h2>
          <p>Cadastre webhooks externos e escolha quais eventos administrativos o sistema deve enviar.</p>
        </div>
        <button
          type="button"
          className="developer-webhooks-settings__secondary-button"
          onClick={() => void loadData()}
          disabled={isLoading}
        >
          {isLoading ? "Carregando..." : "Atualizar"}
        </button>
      </header>

      {error ? (
        <div className="developer-webhooks-settings__error">
          <p>{error}</p>
        </div>
      ) : null}

      <div className="developer-webhooks-settings__layout">
        <article className="developer-webhooks-settings__panel">
          <div className="developer-webhooks-settings__panel-header">
            <h3>{form.id ? "Editar webhook" : "Novo webhook"}</h3>
            <p>Defina uma URL externa e marque os tipos de payload que devem ser enviados.</p>
          </div>

          <div className="developer-webhooks-settings__warning">
            <strong>Aviso importante:</strong>
            <p>
              A Órbita nao se responsabiliza pelos dados enviados a terceiros por meio destes
              webhooks. A configuracao, o destino e o tratamento dessas informacoes sao de
              responsabilidade da empresa contratante.
            </p>
          </div>

          <div className="developer-webhooks-settings__form">
            <label className="developer-webhooks-settings__field">
              <span>Nome interno</span>
              <input
                type="text"
                value={form.nome}
                onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))}
                placeholder="Ex.: ERP principal"
              />
            </label>

            <label className="developer-webhooks-settings__field">
              <span>URL do webhook</span>
              <input
                type="url"
                value={form.url}
                onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                placeholder="https://seu-sistema.com/webhooks/orbita"
              />
            </label>

            <label className="developer-webhooks-settings__field">
              <span>Chave de seguranca</span>
              <input
                type="text"
                value={form.securityKey}
                onChange={(event) =>
                  setForm((current) => ({ ...current, securityKey: event.target.value }))
                }
                placeholder="Ex.: 8f12a9c0-orbita"
              />
            </label>

            <label className="developer-webhooks-settings__field">
              <span>Forma de envio da chave</span>
              <select
                value={form.securityLocation}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    securityLocation: event.target.value as DeveloperWebhookSecurityLocation,
                  }))
                }
              >
                {SECURITY_LOCATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small className="developer-webhooks-settings__helper">
                {SECURITY_LOCATION_OPTIONS.find((option) => option.value === form.securityLocation)?.helper}
              </small>
            </label>

            <label className="developer-webhooks-settings__field">
              <span>
                {form.securityLocation === "header"
                  ? "Nome do header"
                  : form.securityLocation === "query"
                    ? "Nome do parametro"
                    : "Nome do campo no body"}
              </span>
              <input
                type="text"
                value={form.securityFieldName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, securityFieldName: event.target.value }))
                }
                placeholder={
                  form.securityLocation === "header"
                    ? "x-webhook-codigo"
                    : form.securityLocation === "query"
                      ? "token"
                      : "secret"
                }
              />
            </label>

            <label className="developer-webhooks-settings__toggle">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))}
              />
              <span>Webhook ativo para envio imediato.</span>
            </label>

            <div className="developer-webhooks-settings__events">
              {eventCatalog.map((item) => (
                <article key={item.key} className="developer-webhooks-settings__event-card">
                  <label className="developer-webhooks-settings__event-header">
                    <input
                      type="checkbox"
                      checked={form.eventos.includes(item.key)}
                      onChange={() => handleToggleEvent(item.key)}
                    />
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                  </label>

                  <details className="developer-webhooks-settings__event-payload">
                    <summary>Detalhes do payload</summary>
                    <pre>{JSON.stringify(item.payload_example, null, 2)}</pre>
                  </details>
                </article>
              ))}
            </div>

            <div className="developer-webhooks-settings__actions">
              <button
                type="button"
                className="developer-webhooks-settings__primary-button"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? "Salvando..." : form.id ? "Salvar alteracoes" : "Criar webhook"}
              </button>
              <button
                type="button"
                className="developer-webhooks-settings__secondary-button"
                onClick={handleReset}
                disabled={isSaving}
              >
                Limpar
              </button>
            </div>
          </div>
        </article>

        <aside className="developer-webhooks-settings__panel">
          <div className="developer-webhooks-settings__panel-header">
            <h3>Webhooks cadastrados</h3>
            <p>
              {webhooks.length
                ? `${webhooks.length} configuracao(oes) cadastrada(s) para esta empresa.`
                : "Nenhum webhook cadastrado ainda."}
            </p>
          </div>

          <div className="developer-webhooks-settings__list">
            {webhooks.map((webhook) => (
              <article key={webhook.id} className="developer-webhooks-settings__list-card">
                <div className="developer-webhooks-settings__list-top">
                  <div>
                    <strong>{webhook.nome}</strong>
                    <p>{webhook.url}</p>
                  </div>
                  <span
                    className={
                      webhook.ativo
                        ? "developer-webhooks-settings__status developer-webhooks-settings__status--active"
                        : "developer-webhooks-settings__status developer-webhooks-settings__status--inactive"
                    }
                  >
                    {webhook.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="developer-webhooks-settings__badges">
                  {webhook.eventos.map((eventKey) => {
                    const eventInfo = eventCatalog.find((item) => item.key === eventKey);
                    return (
                      <span key={`${webhook.id}-${eventKey}`} className="developer-webhooks-settings__badge">
                        {eventInfo?.label || eventKey}
                      </span>
                    );
                  })}
                </div>

                <p className="developer-webhooks-settings__security-summary">
                  Seguranca: {SECURITY_LOCATION_OPTIONS.find((option) => option.value === webhook.security_location)?.label || webhook.security_location} via <strong>{webhook.security_field_name}</strong>
                </p>

                <div className="developer-webhooks-settings__list-actions">
                  <button
                    type="button"
                    className="developer-webhooks-settings__secondary-button"
                    onClick={() => handleEdit(webhook)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="developer-webhooks-settings__secondary-button"
                    onClick={() => void loadHistory(webhook.id)}
                    disabled={isLoadingHistory && historyWebhookId === webhook.id}
                  >
                    {isLoadingHistory && historyWebhookId === webhook.id ? "Carregando..." : "Historico"}
                  </button>
                  <button
                    type="button"
                    className="developer-webhooks-settings__danger-button"
                    onClick={() => void handleDelete(webhook.id)}
                    disabled={deletingId === webhook.id}
                  >
                    {deletingId === webhook.id ? "Apagando..." : "Apagar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>

      {selectedHistoryWebhook ? (
        <article className="developer-webhooks-settings__panel">
          <div className="developer-webhooks-settings__panel-header">
            <div>
              <h3>Historico do webhook</h3>
              <p>
                {selectedHistoryWebhook.nome} ({historyEntries.length} interacao(oes) recente(s)).
              </p>
            </div>
            <button
              type="button"
              className="developer-webhooks-settings__secondary-button"
              onClick={() => void loadHistory(selectedHistoryWebhook.id)}
              disabled={isLoadingHistory}
            >
              {isLoadingHistory ? "Atualizando..." : "Atualizar historico"}
            </button>
          </div>

          {!historyEntries.length && !isLoadingHistory ? (
            <p className="developer-webhooks-settings__empty-history">
              Nenhum disparo salvo ainda para este webhook.
            </p>
          ) : null}

          <div className="developer-webhooks-settings__history-list">
            {historyEntries.map((entry) => (
              <article key={entry.id} className="developer-webhooks-settings__history-card">
                <div className="developer-webhooks-settings__history-top">
                  <div>
                    <strong>{getEventLabel(entry.event_key)}</strong>
                    <p>
                      Entidade: {entry.entity_id || "-"} | {formatDateTime(entry.created_at)}
                    </p>
                  </div>
                  <span
                    className={
                      entry.status === "success"
                        ? "developer-webhooks-settings__status developer-webhooks-settings__status--active"
                        : entry.status === "error"
                          ? "developer-webhooks-settings__status developer-webhooks-settings__status--inactive"
                          : "developer-webhooks-settings__status"
                    }
                  >
                    {getHistoryStatusLabel(entry.status)}
                  </span>
                </div>

                <p className="developer-webhooks-settings__history-meta">
                  HTTP: {entry.response_status || "-"} | Instancia: {entry.instance_id || "-"} | Finalizado:{" "}
                  {formatDateTime(entry.finished_at)}
                </p>

                {entry.error_message ? (
                  <p className="developer-webhooks-settings__history-error">{entry.error_message}</p>
                ) : null}

                <details className="developer-webhooks-settings__event-payload">
                  <summary>Detalhes da interacao</summary>
                  <pre>
                    {JSON.stringify(
                      {
                        request: {
                          url: entry.request_url,
                          headers: entry.request_headers,
                          body: entry.request_body,
                        },
                        response: {
                          status: entry.response_status,
                          headers: entry.response_headers,
                          body: entry.response_body,
                        },
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}
