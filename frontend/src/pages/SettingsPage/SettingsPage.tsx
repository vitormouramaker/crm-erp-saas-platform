import { useState, useMemo, useEffect, useCallback } from "react";
import "./SettingsPage.css";

import { useAuth } from "../../contexts/AuthContext";
import { SETTINGS_TABS, type SettingsTab } from "../../config/settingsTabs";

import { QuickMessagesSettings } from "../../components/QuickMessagesSettings/QuickMessagesSettings";
import { TagsSettings } from "../../components/TagsSettings/TagsSettings";
import { ApiMetaSettings } from "../../components/ApiMetaSettings/ApiMetaSettings";
import { ApiMetaAdsSettings } from "../../components/ApiMetaAdsSettings/ApiMetaAdsSettings";
import { ApiMetaIgSettings } from "../../components/ApiMetaIgSettings/ApiMetaIgSettings";
import { GoogleAdsManagementSettings } from "../../components/GoogleAdsSettings/GoogleAdsSettings";
import { BranchesSettings } from "../../components/BranchesSettings/BranchesSettings";
import { CategoriesSettings } from "../../components/CategoriesSettings/CategoriesSettings";
import { DeveloperWebhooksSettings } from "../../components/DeveloperWebhooksSettings/DeveloperWebhooksSettings";
import { HotmartIntegrationSettings } from "../../components/HotmartIntegrationSettings/HotmartIntegrationSettings";
import { HublaIntegrationSettings } from "../../components/HublaIntegrationSettings/HublaIntegrationSettings";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Modal } from "../../components/common/Modal/Modal";
import { useToast } from "../../contexts/ToastContext";
import {
  getWebhookClienteInfo,
  updateWebhookClienteN8nIaName,
  updateWebhookClienteStatus,
  type WebhookClienteInfo,
} from "../../service/webhookClienteService";
import {
  getPromptIaAtendimento,
  savePromptIaAtendimento,
} from "../../service/promptIaService";
import {
  apagarPerguntaNps,
  criarPerguntaNps,
  editarPerguntaNps,
  listarPerguntasNps,
  type NpsPergunta,
} from "../../service/npsService";

const WEBHOOK_PAYLOAD_EXAMPLE = `{
  "cliente": {
    "nome": "Maria da Silva",
    "telefone": "(11) 99999-0000",
    "email": "maria@email.com"
  },
  "utms": [
    {
      "utm_source": "facebook",
      "utm_medium": "cpc",
      "utm_campaign": "campanha-lancamento",
      "utm_content": "criativo-1"
    }
  ],
  "tags": ["lead-quente", "campanha-abril"]
}`;

const AI_RESPONSE_FORMAT_INFO = `O formato de retorno da IA permanece padrão do sistema e não é editável nesta tela.`;

const N8N_WEBHOOK_PAYLOAD_EXAMPLE = `{
  "secret": "codigo-da-integracao",
  "cliente_number": "5511999999999",
  "message": "Ola! Aqui e a IA dando continuidade ao atendimento.",
  "send_date": "2026-06-23T14:30:00Z",
  "mensagem_whats_id": "n8n-msg-001"
}`;

const N8N_ASSIGN_ATTENDANCE_PAYLOAD_EXAMPLE = `{
  "secret": "codigo-da-integracao",
  "conversa_id": 12345,
  "usuario_id": 147
}`;

const N8N_TRANSFER_ATTENDANCE_PAYLOAD_EXAMPLE = `{
  "secret": "codigo-da-integracao",
  "conversa_id": 12345,
  "usuario_id": 152
}`;

const WEBHOOK_USERS_RESPONSE_EXAMPLE = `{
  "success": true,
  "data": {
    "usuarios": [
      {
        "id": 147,
        "nome": "Maria Silva",
        "email": "maria@empresa.com"
      }
    ],
    "total": 1
  }
}`;

function getWebhookEndpointExample(endpointId: string, method: string) {
  if (method === "GET") return WEBHOOK_USERS_RESPONSE_EXAMPLE;
  if (endpointId === "n8n_mensagem") return N8N_WEBHOOK_PAYLOAD_EXAMPLE;
  if (endpointId === "n8n_atribuir_atendimento") {
    return N8N_ASSIGN_ATTENDANCE_PAYLOAD_EXAMPLE;
  }
  if (endpointId === "n8n_transferir_atendimento") {
    return N8N_TRANSFER_ATTENDANCE_PAYLOAD_EXAMPLE;
  }
  return WEBHOOK_PAYLOAD_EXAMPLE;
}

type IntegrationTab = "clientes" | "n8n" | "hotmart" | "hubla";

export function SettingsPage() {
  const { hasPermission, user } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("quick-messages");
  const [activeIntegrationTab, setActiveIntegrationTab] =
    useState<IntegrationTab>("clientes");
  const [webhookInfo, setWebhookInfo] = useState<WebhookClienteInfo | null>(
    null,
  );
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState("");
  const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);
  const [n8nIaNomeInput, setN8nIaNomeInput] = useState("");
  const [isSavingN8nIaNome, setIsSavingN8nIaNome] = useState(false);

  const [aiPrompt, setAiPrompt] = useState("");
  const [isLoadingAiPrompt, setIsLoadingAiPrompt] = useState(false);
  const [hasLoadedAiPrompt, setHasLoadedAiPrompt] = useState(false);
  const [isSavingAiPrompt, setIsSavingAiPrompt] = useState(false);

  const [npsPerguntas, setNpsPerguntas] = useState<NpsPergunta[]>([]);
  const [isLoadingNps, setIsLoadingNps] = useState(false);
  const [hasLoadedNps, setHasLoadedNps] = useState(false);
  const [isSavingNps, setIsSavingNps] = useState(false);
  const [npsPerguntaInput, setNpsPerguntaInput] = useState("");
  const [npsOrdemInput, setNpsOrdemInput] = useState("1");
  const [editingNpsId, setEditingNpsId] = useState<number | null>(null);
  const [editingPergunta, setEditingPergunta] = useState("");
  const [editingOrdem, setEditingOrdem] = useState("1");
  const [deletingNpsId, setDeletingNpsId] = useState<number | null>(null);
  const [npsDeleteDialog, setNpsDeleteDialog] = useState<{
    open: boolean;
    perguntaId?: number;
  }>({
    open: false,
  });

  const npsPreviewQuestion = useMemo(() => {
    if (!npsPerguntas.length)
      return "De 1 a 10, como você avalia seu atendimento?";
    const sorted = [...npsPerguntas].sort((a, b) => a.ordem - b.ordem);
    return (
      sorted[0]?.pergunta || "De 1 a 10, como você avalia seu atendimento?"
    );
  }, [npsPerguntas]);

  const canConfigureMeta = hasPermission("settings.api_meta");
  const canConfigureMetaAds = hasPermission("settings.api_meta_ads");

  const allowedTabs = useMemo(() => {
    return SETTINGS_TABS.filter((tab) => {
      if (tab.permission) return hasPermission(tab.permission);
      if (Array.isArray(tab.permissionsAny)) {
        return tab.permissionsAny.some((permission) =>
          hasPermission(permission),
        );
      }
      return false;
    });
  }, [hasPermission]);

  useEffect(() => {
    if (!allowedTabs.length) return;

    const isValid = allowedTabs.some((tab) => tab.key === activeTab);
    if (!isValid) {
      setActiveTab(allowedTabs[0].key);
    }
  }, [allowedTabs, activeTab]);

  const loadWebhookInfo = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsLoadingWebhook(true);
      setWebhookError("");
      const info = await getWebhookClienteInfo(user.empresa_id);
      setWebhookInfo(info);
      setN8nIaNomeInput(info.n8n_ia_nome || "n8n IA");
    } catch (error) {
      setWebhookError(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar os dados do webhook de clientes.",
      );
    } finally {
      setIsLoadingWebhook(false);
    }
  }, [user?.empresa_id]);

  const loadAiPrompt = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsLoadingAiPrompt(true);
      const prompt = await getPromptIaAtendimento(user.empresa_id);
      setAiPrompt(prompt);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar prompt",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar o prompt da IA.",
      });
    } finally {
      setIsLoadingAiPrompt(false);
      setHasLoadedAiPrompt(true);
    }
  }, [addToast, user?.empresa_id]);

  const loadNpsPerguntas = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsLoadingNps(true);
      const result = await listarPerguntasNps(user.empresa_id);
      setNpsPerguntas(result);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar NPS",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as perguntas de NPS.",
      });
    } finally {
      setIsLoadingNps(false);
      setHasLoadedNps(true);
    }
  }, [addToast, user?.empresa_id]);

  useEffect(() => {
    if (activeTab === "integrations" && !webhookInfo && !isLoadingWebhook) {
      void loadWebhookInfo();
    }
  }, [activeTab, webhookInfo, isLoadingWebhook, loadWebhookInfo]);

  useEffect(() => {
    if (activeTab !== "integrations") {
      setActiveIntegrationTab("clientes");
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "ai" && !isLoadingAiPrompt && !hasLoadedAiPrompt) {
      void loadAiPrompt();
    }
  }, [activeTab, isLoadingAiPrompt, hasLoadedAiPrompt, loadAiPrompt]);

  useEffect(() => {
    if (activeTab === "nps" && !isLoadingNps && !hasLoadedNps) {
      void loadNpsPerguntas();
    }
  }, [activeTab, isLoadingNps, hasLoadedNps, loadNpsPerguntas]);

  const handleCopyWebhookUrl = useCallback(async () => {
    const webhookUrl =
      activeIntegrationTab === "n8n"
        ? webhookInfo?.n8n_webhook_url
        : webhookInfo?.webhook_url;
    if (!webhookUrl) {
      addToast({
        type: "warning",
        title: "URL indisponivel",
        description: "Nao ha URL de webhook para copiar.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(webhookUrl);
      addToast({
        type: "success",
        title: "URL copiada",
        description:
          "A URL do webhook foi copiada para a area de transferencia.",
      });
    } catch {
      addToast({
        type: "error",
        title: "Erro ao copiar URL",
        description: "Nao foi possivel copiar a URL.",
      });
    }
  }, [
    activeIntegrationTab,
    addToast,
    webhookInfo?.n8n_webhook_url,
    webhookInfo?.webhook_url,
  ]);

  const handleCopyEndpointUrl = useCallback(
    async (url: string) => {
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        addToast({
          type: "success",
          title: "URL copiada",
          description: "A URL do endpoint foi copiada.",
        });
      } catch {
        addToast({
          type: "error",
          title: "Erro ao copiar URL",
          description: "Nao foi possivel copiar a URL do endpoint.",
        });
      }
    },
    [addToast],
  );

  const handleToggleWebhookStatus = useCallback(async () => {
    if (!user?.empresa_id || !webhookInfo) return;

    const code = webhookInfo.webhook_codigo_validacao?.trim() || "";
    if (!code) {
      addToast({
        type: "warning",
        title: "Codigo indisponivel",
        description: "Nao ha codigo de validacao cadastrado para este webhook.",
      });
      return;
    }

    const nextStatus = !webhookInfo.webhook_ativo;

    try {
      setIsUpdatingWebhook(true);
      const result = await updateWebhookClienteStatus({
        empresaId: user.empresa_id,
        ativo: nextStatus,
        webhookCodigo: code,
      });

      setWebhookInfo((current) =>
        current
          ? {
              ...current,
              webhook_ativo: result.ativo,
            }
          : current,
      );
      addToast({
        type: "success",
        title: nextStatus ? "Webhook ativado" : "Webhook desativado",
        description: result.message,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao atualizar webhook",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar o status do webhook.",
      });
    } finally {
      setIsUpdatingWebhook(false);
    }
  }, [addToast, user?.empresa_id, webhookInfo]);

  const handleCopyWebhookCode = useCallback(async () => {
    const code = webhookInfo?.webhook_codigo_validacao;
    if (!code) {
      addToast({
        type: "warning",
        title: "Codigo indisponivel",
        description: "Nao ha codigo de validacao para copiar.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      addToast({
        type: "success",
        title: "Codigo copiado",
        description:
          "O codigo de validacao foi copiado para a area de transferencia.",
      });
    } catch {
      addToast({
        type: "error",
        title: "Erro ao copiar codigo",
        description: "Nao foi possivel copiar o codigo de validacao.",
      });
    }
  }, [addToast, webhookInfo?.webhook_codigo_validacao]);

  const handleSaveN8nIaName = useCallback(async () => {
    if (!user?.empresa_id || activeIntegrationTab !== "n8n") return;

    const nextName = n8nIaNomeInput.trim();

    if (!nextName) {
      addToast({
        type: "warning",
        title: "Nome obrigatorio",
        description: "Informe o nome que deve aparecer nas mensagens da IA.",
      });
      return;
    }

    try {
      setIsSavingN8nIaNome(true);
      const result = await updateWebhookClienteN8nIaName({
        empresaId: user.empresa_id,
        n8nIaNome: nextName,
      });

      setWebhookInfo((current) =>
        current
          ? {
              ...current,
              n8n_ia_nome: result.n8nIaNome,
            }
          : current,
      );
      setN8nIaNomeInput(result.n8nIaNome);
      addToast({
        type: "success",
        title: "Nome da IA salvo",
        description: result.message,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao salvar nome da IA",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar o nome da IA.",
      });
    } finally {
      setIsSavingN8nIaNome(false);
    }
  }, [activeIntegrationTab, addToast, n8nIaNomeInput, user?.empresa_id]);

  const integrationContent = useMemo(() => {
    if (!webhookInfo) return null;

    if (activeIntegrationTab === "n8n") {
      return {
        title: "Webhook n8n IA",
        description:
          "Recebe respostas de IAs externas, como fluxos do n8n, e grava a mensagem na conversa aberta do cliente.",
        method: webhookInfo.n8n_webhook_metodo || "POST",
        url: webhookInfo.n8n_webhook_url || "",
        validationTitle: "Campo secret:",
        validationValue: webhookInfo.n8n_webhook_secret_field || "secret",
        secondaryTitle: "Header opcional:",
        secondaryValue:
          webhookInfo.n8n_webhook_header_validacao || "x-webhook-codigo",
        identifierTitle: "Identificador da origem:",
        identifierValue: webhookInfo.n8n_ia_nome || "n8n IA",
        payloadExample: N8N_WEBHOOK_PAYLOAD_EXAMPLE,
        sharedSecretHint:
          "Este webhook usa o mesmo codigo de validacao e o mesmo status de ativacao do webhook de clientes.",
      };
    }

    return {
      title: "Webhook de Clientes",
      description:
        "Recebe cadastros de clientes externos com dados basicos, tags e UTMs.",
      method: webhookInfo.webhook_metodo || "POST",
      url: webhookInfo.webhook_url || "",
      validationTitle: "Header de validacao:",
      validationValue: "x-webhook-codigo",
      secondaryTitle: "ID publico do webhook:",
      secondaryValue: webhookInfo.webhook_public_id || "-",
      identifierTitle: "",
      identifierValue: "",
      payloadExample: WEBHOOK_PAYLOAD_EXAMPLE,
      sharedSecretHint: "",
    };
  }, [activeIntegrationTab, webhookInfo]);

  const handleSaveAiPrompt = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setIsSavingAiPrompt(true);
      const result = await savePromptIaAtendimento({
        empresaId: user.empresa_id,
        prompt: aiPrompt,
      });
      setAiPrompt(result.prompt);
      addToast({
        type: "success",
        title: "Prompt salvo",
        description: result.message,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao salvar prompt",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o prompt da IA.",
      });
    } finally {
      setIsSavingAiPrompt(false);
    }
  }, [addToast, user?.empresa_id, aiPrompt]);

  const handleCriarPerguntaNps = useCallback(async () => {
    if (!user?.empresa_id) return;

    const pergunta = npsPerguntaInput.trim();
    const ordem = Number(npsOrdemInput);

    if (!pergunta) {
      addToast({
        type: "warning",
        title: "Campo obrigatorio",
        description: "Informe a pergunta do NPS.",
      });
      return;
    }

    if (!Number.isInteger(ordem) || ordem <= 0) {
      addToast({
        type: "warning",
        title: "Ordem invalida",
        description: "Informe uma ordem valida (maior que 0).",
      });
      return;
    }

    try {
      setIsSavingNps(true);
      const result = await criarPerguntaNps({
        empresaId: user.empresa_id,
        pergunta,
        ordem,
      });
      setNpsPerguntaInput("");
      setNpsOrdemInput("1");
      addToast({
        type: "success",
        title: "Pergunta criada",
        description: result.message,
      });
      await loadNpsPerguntas();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao criar pergunta",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar a pergunta de NPS.",
      });
    } finally {
      setIsSavingNps(false);
    }
  }, [
    addToast,
    user?.empresa_id,
    npsPerguntaInput,
    npsOrdemInput,
    loadNpsPerguntas,
  ]);

  const handleStartEditNps = useCallback((item: NpsPergunta) => {
    setEditingNpsId(item.id);
    setEditingPergunta(item.pergunta);
    setEditingOrdem(String(item.ordem));
  }, []);

  const handleCancelEditNps = useCallback(() => {
    setEditingNpsId(null);
    setEditingPergunta("");
    setEditingOrdem("1");
  }, []);

  const handleSalvarEditNps = useCallback(async () => {
    if (!user?.empresa_id || !editingNpsId) return;

    const pergunta = editingPergunta.trim();
    const ordem = Number(editingOrdem);

    if (!pergunta) {
      addToast({
        type: "warning",
        title: "Campo obrigatorio",
        description: "Informe a pergunta do NPS.",
      });
      return;
    }

    if (!Number.isInteger(ordem) || ordem <= 0) {
      addToast({
        type: "warning",
        title: "Ordem invalida",
        description: "Informe uma ordem valida (maior que 0).",
      });
      return;
    }

    try {
      setIsSavingNps(true);
      const result = await editarPerguntaNps({
        empresaId: user.empresa_id,
        perguntaId: editingNpsId,
        pergunta,
        ordem,
      });
      addToast({
        type: "success",
        title: "Pergunta atualizada",
        description: result.message,
      });
      handleCancelEditNps();
      await loadNpsPerguntas();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao editar pergunta",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel editar a pergunta de NPS.",
      });
    } finally {
      setIsSavingNps(false);
    }
  }, [
    addToast,
    user?.empresa_id,
    editingNpsId,
    editingPergunta,
    editingOrdem,
    handleCancelEditNps,
    loadNpsPerguntas,
  ]);

  const handleApagarPerguntaNps = useCallback(
    async (perguntaId: number) => {
      if (!user?.empresa_id) return;

      try {
        setDeletingNpsId(perguntaId);
        const result = await apagarPerguntaNps({
          empresaId: user.empresa_id,
          perguntaId,
        });
        addToast({
          type: "success",
          title: "Pergunta removida",
          description: result.message,
        });
        if (editingNpsId === perguntaId) {
          handleCancelEditNps();
        }
        setNpsDeleteDialog({ open: false });
        await loadNpsPerguntas();
      } catch (error) {
        addToast({
          type: "error",
          title: "Erro ao apagar pergunta",
          description:
            error instanceof Error
              ? error.message
              : "Nao foi possivel apagar a pergunta de NPS.",
        });
      } finally {
        setDeletingNpsId(null);
      }
    },
    [
      addToast,
      user?.empresa_id,
      editingNpsId,
      handleCancelEditNps,
      loadNpsPerguntas,
    ],
  );

  return (
    <div className="settings-page-layout">
      <MobileHeader title="Configurações" />

      <header className="settings-header">
        <h1>Configurações</h1>
      </header>

      <nav className="settings-tabs">
        {allowedTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            onMouseUp={(event) => event.currentTarget.blur()}
            onTouchEnd={(event) => event.currentTarget.blur()}
            className={activeTab === tab.key ? "active" : ""}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="settings-content">
        {activeTab === "quick-messages" && <QuickMessagesSettings />}
        {activeTab === "tags" && <TagsSettings />}
        {activeTab === "meta" && (
          <div className="settings-meta-stack">
            {canConfigureMeta && (
              <section className="settings-meta-card">
                <ApiMetaSettings />
              </section>
            )}
            {canConfigureMetaAds && (
              <section className="settings-meta-card">
                <ApiMetaAdsSettings />
              </section>
            )}
            {canConfigureMeta && (
              <section className="settings-meta-card">
                <ApiMetaIgSettings />
              </section>
            )}
          </div>
        )}
        {activeTab === "google-ads" && (
          <div className="settings-meta-stack">
            <GoogleAdsManagementSettings />
          </div>
        )}
        {activeTab === "branches" && <BranchesSettings />}
        {activeTab === "categories" && <CategoriesSettings />}
        {activeTab === "developers" && (
          <DeveloperWebhooksSettings empresaId={user?.empresa_id ?? null} />
        )}

        {activeTab === "integrations" && (
          <section className="settings-tab-section settings-tab-section--integrations">
            <header className="settings-integration-card__header">
              <h2>Integracoes</h2>
              <p>
                Configure os webhooks de clientes, da integracao n8n IA, Hotmart
                e Hubla.
              </p>
            </header>

            <div
              className="settings-integration-tabs"
              role="tablist"
              aria-label="Tipos de webhook"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeIntegrationTab === "clientes"}
                className={
                  activeIntegrationTab === "clientes"
                    ? "settings-integration-tab settings-integration-tab--active"
                    : "settings-integration-tab"
                }
                onClick={() => setActiveIntegrationTab("clientes")}
              >
                Webhook de Clientes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeIntegrationTab === "n8n"}
                className={
                  activeIntegrationTab === "n8n"
                    ? "settings-integration-tab settings-integration-tab--active"
                    : "settings-integration-tab"
                }
                onClick={() => setActiveIntegrationTab("n8n")}
              >
                Webhook n8n IA
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeIntegrationTab === "hotmart"}
                className={
                  activeIntegrationTab === "hotmart"
                    ? "settings-integration-tab settings-integration-tab--active"
                    : "settings-integration-tab"
                }
                onClick={() => setActiveIntegrationTab("hotmart")}
              >
                Hotmart
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeIntegrationTab === "hubla"}
                className={
                  activeIntegrationTab === "hubla"
                    ? "settings-integration-tab settings-integration-tab--active"
                    : "settings-integration-tab"
                }
                onClick={() => setActiveIntegrationTab("hubla")}
              >
                Hubla
              </button>
            </div>

            {activeIntegrationTab !== "hotmart" &&
              activeIntegrationTab !== "hubla" &&
              isLoadingWebhook && (
                <p className="settings-integration-loading">
                  Carregando integracoes...
                </p>
              )}

            {activeIntegrationTab !== "hotmart" &&
              activeIntegrationTab !== "hubla" &&
              !isLoadingWebhook &&
              webhookError && (
                <div className="settings-integration-error-box">
                  <p>{webhookError}</p>
                  <button
                    type="button"
                    className="settings-integration-button settings-integration-button--secondary"
                    onClick={() => void loadWebhookInfo()}
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

            {activeIntegrationTab === "hotmart" && (
              <HotmartIntegrationSettings
                empresaId={user?.empresa_id ?? null}
              />
            )}

            {activeIntegrationTab === "hubla" && (
              <HublaIntegrationSettings empresaId={user?.empresa_id ?? null} />
            )}

            {activeIntegrationTab !== "hotmart" &&
              activeIntegrationTab !== "hubla" &&
              !isLoadingWebhook &&
              !webhookError &&
              webhookInfo &&
              integrationContent && (
                <article className="settings-integration-panel settings-integration-panel--webhook">
                  <h3>{integrationContent.title}</h3>
                  <p className="settings-integration-panel__description">
                    {integrationContent.description}
                  </p>

                  <div className="settings-integration-grid">
                    <p className="settings-integration-grid-item">
                      <strong>Status:</strong>{" "}
                      <span
                        className={
                          webhookInfo.webhook_ativo
                            ? "settings-integration-status settings-integration-status--active"
                            : "settings-integration-status settings-integration-status--inactive"
                        }
                      >
                        {webhookInfo.webhook_ativo ? "Ativo" : "Inativo"}
                      </span>
                    </p>
                    <p className="settings-integration-grid-item">
                      <strong>
                        {activeIntegrationTab === "clientes" ||
                        activeIntegrationTab === "n8n"
                          ? "Rotas disponíveis:"
                          : "Metodo:"}
                      </strong>{" "}
                      {activeIntegrationTab === "clientes" ||
                      activeIntegrationTab === "n8n"
                        ? (activeIntegrationTab === "n8n"
                            ? webhookInfo.n8n_endpoints.length
                            : webhookInfo.endpoints.length) || 1
                        : integrationContent.method}
                    </p>
                    <p className="settings-integration-grid-item settings-integration-grid-item--stacked">
                      <strong>{integrationContent.validationTitle}</strong>
                      <span>{integrationContent.validationValue}</span>
                    </p>
                    {activeIntegrationTab !== "clientes" &&
                    activeIntegrationTab !== "n8n" ? (
                      <p className="settings-integration-grid-item settings-integration-grid-item--full">
                        <strong>URL:</strong> {integrationContent.url || "-"}
                      </p>
                    ) : null}
                    <p className="settings-integration-grid-item settings-integration-grid-item--full">
                      <strong>{integrationContent.secondaryTitle}</strong>
                      <span>{integrationContent.secondaryValue}</span>
                    </p>
                    {integrationContent.identifierTitle ? (
                      <p className="settings-integration-grid-item settings-integration-grid-item--full">
                        <strong>{integrationContent.identifierTitle}</strong>
                        <span>{integrationContent.identifierValue}</span>
                      </p>
                    ) : null}
                  </div>

                  <div className="settings-integration-actions">
                    {activeIntegrationTab !== "clientes" ? (
                      <button
                        type="button"
                        className="settings-integration-button settings-integration-button--primary"
                        onClick={handleCopyWebhookUrl}
                      >
                        Copiar URL
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="settings-integration-button settings-integration-button--secondary"
                      onClick={() => void loadWebhookInfo()}
                    >
                      Atualizar
                    </button>
                  </div>

                  <div className="settings-webhook-toggle">
                    <label htmlFor="settings-webhook-code">
                      Codigo de validacao do webhook
                    </label>
                    <div className="settings-webhook-toggle__row">
                      <input
                        id="settings-webhook-code"
                        type="text"
                        value={
                          webhookInfo.webhook_codigo_validacao
                            ? "****************"
                            : "-"
                        }
                        readOnly
                        aria-readonly="true"
                      />
                      <button
                        type="button"
                        className="settings-integration-button settings-integration-button--secondary"
                        onClick={() => void handleCopyWebhookCode()}
                      >
                        Copiar codigo
                      </button>
                      <button
                        type="button"
                        className={
                          webhookInfo.webhook_ativo
                            ? "settings-integration-button settings-integration-button--danger"
                            : "settings-integration-button settings-integration-button--primary"
                        }
                        onClick={() => void handleToggleWebhookStatus()}
                        disabled={isUpdatingWebhook}
                      >
                        {isUpdatingWebhook
                          ? "Salvando..."
                          : webhookInfo.webhook_ativo
                            ? "Desativar webhook"
                            : "Ativar webhook"}
                      </button>
                    </div>
                  </div>

                  {activeIntegrationTab === "n8n" ? (
                    <div className="settings-webhook-toggle">
                      <label htmlFor="settings-n8n-ia-name">
                        Nome exibido da IA
                      </label>
                      <p>
                        Esse nome aparece no chat quando a mensagem for
                        registrada pela integracao do n8n.
                      </p>
                      <div className="settings-webhook-toggle__row">
                        <input
                          id="settings-n8n-ia-name"
                          type="text"
                          maxLength={120}
                          value={n8nIaNomeInput}
                          onChange={(event) =>
                            setN8nIaNomeInput(event.target.value)
                          }
                          placeholder="Ex.: Assistente Comercial"
                        />
                        <button
                          type="button"
                          className="settings-integration-button settings-integration-button--primary"
                          onClick={() => void handleSaveN8nIaName()}
                          disabled={isSavingN8nIaNome}
                        >
                          {isSavingN8nIaNome ? "Salvando..." : "Salvar nome"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {integrationContent.sharedSecretHint ? (
                    <p className="settings-webhook-hint">
                      {integrationContent.sharedSecretHint}
                    </p>
                  ) : null}

                  {activeIntegrationTab === "clientes" ||
                  activeIntegrationTab === "n8n" ? (
                    <div className="settings-endpoint-catalog">
                      <div className="settings-endpoint-catalog__header">
                        <div>
                          <span>API da integração</span>
                          <h4>Rotas disponíveis</h4>
                        </div>
                        <p>
                          Novas consultas e ações serão adicionadas nesta área.
                        </p>
                      </div>
                      <div className="settings-endpoint-list">
                        {((activeIntegrationTab === "n8n"
                          ? webhookInfo.n8n_endpoints
                          : webhookInfo.endpoints
                        ).length
                          ? activeIntegrationTab === "n8n"
                            ? webhookInfo.n8n_endpoints
                            : webhookInfo.endpoints
                          : [
                              {
                                id: "clientes_upsert",
                                metodo: "POST",
                                titulo: "Criar ou atualizar cliente",
                                descricao:
                                  "Cadastra ou atualiza um cliente, suas tags e UTMs.",
                                url: webhookInfo.webhook_url,
                              },
                              {
                                id: "usuarios_listar",
                                metodo: "GET",
                                titulo: "Consultar usuários",
                                descricao:
                                  "Lista usuários ativos com id, nome e email.",
                                url: `${webhookInfo.webhook_url}/usuarios`,
                              },
                            ]
                        ).map((endpoint) => (
                          <article
                            key={endpoint.id}
                            className="settings-endpoint-card"
                          >
                            <div className="settings-endpoint-card__top">
                              <span
                                className={`settings-endpoint-method settings-endpoint-method--${endpoint.metodo.toLowerCase()}`}
                              >
                                {endpoint.metodo}
                              </span>
                              <div>
                                <h5>{endpoint.titulo}</h5>
                                <p>{endpoint.descricao}</p>
                              </div>
                            </div>
                            <div className="settings-endpoint-url">
                              <code>{endpoint.url}</code>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCopyEndpointUrl(endpoint.url)
                                }
                              >
                                Copiar URL
                              </button>
                            </div>
                            <div className="settings-endpoint-auth">
                              <strong>Autenticação</strong>
                              <span>
                                {activeIntegrationTab === "n8n"
                                  ? "Campo `secret` no JSON ou header `x-webhook-codigo`."
                                  : "Header `x-webhook-codigo` com o código de validação."}
                              </span>
                            </div>
                            <details className="settings-endpoint-example">
                              <summary>
                                {endpoint.metodo === "GET"
                                  ? "Ver exemplo de resposta"
                                  : "Ver exemplo de requisição"}
                              </summary>
                              <pre>
                                {getWebhookEndpointExample(
                                  endpoint.id,
                                  endpoint.metodo,
                                )}
                              </pre>
                            </details>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="settings-webhook-payload">
                      <h4>Exemplo de payload esperado:</h4>
                      <pre>{integrationContent.payloadExample}</pre>
                    </div>
                  )}
                </article>
              )}
          </section>
        )}

        {activeTab === "ai" && (
          <section className="settings-tab-section settings-tab-section--ai">
            <header className="settings-integration-card__header">
              <h2>Prompt da IA</h2>
              <p>
                Defina as instruções da IA para análise de atendimento e
                assistente de conversão.
              </p>
            </header>

            <article className="settings-ai-panel settings-ai-panel--flat">
              {isLoadingAiPrompt && (
                <p className="settings-ai-loading">
                  Carregando prompt da IA...
                </p>
              )}

              {!isLoadingAiPrompt && (
                <div className="settings-ai-form settings-ai-form--flat">
                  <label htmlFor="settings-ai-prompt">
                    Prompt personalizado
                  </label>
                  <textarea
                    id="settings-ai-prompt"
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Escreva aqui o prompt que deve guiar a IA no seu atendimento..."
                    rows={14}
                  />

                  <div className="settings-ai-actions">
                    <button
                      type="button"
                      className="settings-ai-button settings-ai-button--primary"
                      onClick={() => void handleSaveAiPrompt()}
                      disabled={isSavingAiPrompt}
                    >
                      {isSavingAiPrompt ? "Salvando..." : "Salvar prompt"}
                    </button>
                    <button
                      type="button"
                      className="settings-ai-button settings-ai-button--secondary"
                      onClick={() => void loadAiPrompt()}
                      disabled={isLoadingAiPrompt}
                    >
                      Recarregar
                    </button>
                  </div>

                  <div className="settings-ai-note">
                    <strong>Formato fixo:</strong> {AI_RESPONSE_FORMAT_INFO}
                  </div>
                </div>
              )}
            </article>
          </section>
        )}

        {activeTab === "nps" && (
          <section className="settings-nps-layout">
            <div className="settings-integration-card">
              <header className="settings-integration-card__header">
                <h2>Perguntas de NPS</h2>
                <p>
                  Cadastre as perguntas de NPS que serão exibidas na avaliação
                  de atendimento.
                </p>
              </header>

              <article className="settings-integration-panel settings-nps-panel">
                <div className="settings-nps-create-form">
                  <div className="settings-nps-create-grid">
                    <div className="settings-nps-field">
                      <label htmlFor="nps-pergunta-input">Nova pergunta</label>
                      <input
                        id="nps-pergunta-input"
                        type="text"
                        value={npsPerguntaInput}
                        onChange={(event) =>
                          setNpsPerguntaInput(event.target.value)
                        }
                        placeholder="Ex.: De 1 a 10, como você avalia seu atendimento?"
                      />
                    </div>

                    <div className="settings-nps-field settings-nps-field--ordem">
                      <label htmlFor="nps-ordem-input">Ordem</label>
                      <input
                        id="nps-ordem-input"
                        type="number"
                        min={1}
                        value={npsOrdemInput}
                        onChange={(event) =>
                          setNpsOrdemInput(event.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="settings-nps-actions settings-nps-actions--create">
                    <button
                      type="button"
                      className="settings-nps-button settings-nps-button--primary"
                      onClick={() => void handleCriarPerguntaNps()}
                      disabled={isSavingNps}
                    >
                      {isSavingNps ? "Salvando..." : "Adicionar pergunta"}
                    </button>
                    <button
                      type="button"
                      className="settings-nps-button settings-nps-button--secondary"
                      onClick={() => void loadNpsPerguntas()}
                      disabled={isLoadingNps}
                    >
                      Atualizar lista
                    </button>
                  </div>
                </div>

                {isLoadingNps && (
                  <p className="settings-nps-loading">
                    Carregando perguntas de NPS...
                  </p>
                )}

                {!isLoadingNps && (
                  <div className="settings-nps-list">
                    {!npsPerguntas.length && (
                      <p className="settings-nps-empty">
                        Nenhuma pergunta cadastrada ainda.
                      </p>
                    )}

                    {npsPerguntas.map((item) => (
                      <article key={item.id} className="settings-nps-item">
                        {editingNpsId === item.id ? (
                          <div className="settings-nps-edit-grid">
                            <input
                              type="text"
                              value={editingPergunta}
                              onChange={(event) =>
                                setEditingPergunta(event.target.value)
                              }
                            />
                            <input
                              type="number"
                              min={1}
                              value={editingOrdem}
                              onChange={(event) =>
                                setEditingOrdem(event.target.value)
                              }
                            />
                            <div className="settings-nps-actions">
                              <button
                                type="button"
                                className="settings-nps-button settings-nps-button--primary"
                                onClick={() => void handleSalvarEditNps()}
                                disabled={isSavingNps}
                              >
                                Salvar
                              </button>
                              <button
                                type="button"
                                className="settings-nps-button settings-nps-button--secondary"
                                onClick={handleCancelEditNps}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="settings-nps-item__content">
                              <p className="settings-nps-item__question">
                                {item.pergunta}
                              </p>
                              <span className="settings-nps-item__meta">
                                Ordem: {item.ordem}
                              </span>
                            </div>
                            <div className="settings-nps-actions">
                              <button
                                type="button"
                                className="settings-nps-button settings-nps-button--secondary"
                                onClick={() => handleStartEditNps(item)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="settings-nps-button settings-nps-button--danger"
                                onClick={() =>
                                  setNpsDeleteDialog({
                                    open: true,
                                    perguntaId: item.id,
                                  })
                                }
                                disabled={deletingNpsId === item.id}
                              >
                                {deletingNpsId === item.id
                                  ? "Apagando..."
                                  : "Apagar"}
                              </button>
                            </div>
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </div>

            <aside
              className="settings-nps-preview-card"
              aria-label="Preview da pagina de NPS"
            >
              <header className="settings-nps-preview-header">
                <h3>Preview da pagina NPS</h3>
                <p>Visual de como o cliente recebera o questionario.</p>
              </header>

              <div className="settings-nps-preview-shell">
                <p className="settings-nps-preview-eyebrow">
                  Pesquisa de satisfação
                </p>
                <h4>NPS do atendimento #1234</h4>
                <p className="settings-nps-preview-subtitle">
                  Avalie de 1 a 10, onde 1 significa muito insatisfeito e 10
                  muito satisfeito.
                </p>

                <div className="settings-nps-preview-question">
                  <span className="settings-nps-preview-step">1</span>
                  <div>
                    <strong>{npsPreviewQuestion}</strong>
                    <p>Escolha apenas uma nota.</p>
                  </div>
                </div>

                <div className="settings-nps-preview-grid">
                  {Array.from({ length: 10 }, (_, index) => index + 1).map(
                    (value) => (
                      <span
                        key={`nps-preview-${value}`}
                        className={
                          value === 8
                            ? "settings-nps-preview-score settings-nps-preview-score--selected"
                            : "settings-nps-preview-score"
                        }
                      >
                        {value}
                      </span>
                    ),
                  )}
                </div>

                <div className="settings-nps-preview-labels">
                  <span>Muito insatisfeito</span>
                  <span>Muito satisfeito</span>
                </div>
              </div>
            </aside>
          </section>
        )}
      </main>

      <Modal
        isOpen={npsDeleteDialog.open}
        onClose={() => setNpsDeleteDialog({ open: false })}
        title="Apagar pergunta de NPS"
      >
        <div className="settings-nps-delete-dialog">
          <p>Tem certeza que deseja apagar esta pergunta de NPS?</p>
          <div className="settings-nps-actions settings-nps-delete-dialog__actions">
            <button
              type="button"
              className="settings-nps-button settings-nps-button--secondary"
              onClick={() => setNpsDeleteDialog({ open: false })}
              disabled={deletingNpsId !== null}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="settings-nps-button settings-nps-button--danger"
              onClick={() =>
                npsDeleteDialog.perguntaId
                  ? void handleApagarPerguntaNps(npsDeleteDialog.perguntaId)
                  : undefined
              }
              disabled={deletingNpsId !== null}
            >
              {deletingNpsId !== null ? "Apagando..." : "Apagar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
