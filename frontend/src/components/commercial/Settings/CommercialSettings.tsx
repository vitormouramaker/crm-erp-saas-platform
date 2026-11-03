import { useEffect, useMemo, useState } from "react";
import { FiSettings } from "react-icons/fi";
import { useToast } from "../../../contexts/ToastContext";
import CommercialProducts from "../Products/CommercialProducts";
import {
  createCommercialCrm,
  createCommercialStage,
  deleteCommercialCrm,
  deleteCommercialStage,
  getCommercialDomains,
  reorderCommercialStages,
  updateCommercialCrm,
  updateCommercialStage,
  type CommercialBranch,
  type CommercialCrm,
  type CommercialDomains,
  type CommercialMetaNumber,
} from "../../../service/commercialService";
import {
  listFinanceiroCategorias,
  listFinanceiroCentrosCusto,
  listFinanceiroContasFinanceiras,
  listFinanceiroEmpresasGrupo,
  type FinanceiroCategoria,
  type FinanceiroCentroCusto,
  type FinanceiroContaFinanceira,
  type FinanceiroEmpresaGrupo,
} from "../../../service/financeiroService";
import "./CommercialSettings.css";

type CommercialSettingsProps = {
  crms: CommercialCrm[];
  selectedCrmId: number | null;
  onSelectCrm: (crmId: number | null) => void;
  onRefreshCrms: () => Promise<void>;
};

type CommercialSettingsViewTab = "active_funnel" | "registered_products";
type CommercialSettingsModalSection =
  | "funnel_data"
  | "sync_rules"
  | "number_access"
  | "columns";

export default function CommercialSettings({
  crms,
  selectedCrmId,
  onSelectCrm,
  onRefreshCrms,
}: CommercialSettingsProps) {
  const { addToast } = useToast();
  const [domains, setDomains] = useState<CommercialDomains | null>(null);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [creatingCrm, setCreatingCrm] = useState(false);
  const [savingCrm, setSavingCrm] = useState(false);
  const [deletingCrm, setDeletingCrm] = useState(false);
  const [creatingStage, setCreatingStage] = useState(false);
  const [isCreateCrmModalOpen, setIsCreateCrmModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [activeViewTab, setActiveViewTab] =
    useState<CommercialSettingsViewTab>("active_funnel");
  const [activeModalSection, setActiveModalSection] =
    useState<CommercialSettingsModalSection>("funnel_data");
  const [newCrmName, setNewCrmName] = useState("");
  const [newCrmDescription, setNewCrmDescription] = useState("");
  const [crmName, setCrmName] = useState("");
  const [crmDescription, setCrmDescription] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#4299e1");
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [editingStageColor, setEditingStageColor] = useState("#4299e1");
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedMetaNumberIds, setSelectedMetaNumberIds] = useState<number[]>(
    [],
  );
  const [automationAttendanceStageId, setAutomationAttendanceStageId] =
    useState<number | null>(null);
  const [automationQuoteStageId, setAutomationQuoteStageId] = useState<
    number | null
  >(null);
  const [generateReceivable, setGenerateReceivable] = useState(false);
  const [financialAccountId, setFinancialAccountId] = useState<number | null>(null);
  const [financialCategoryId, setFinancialCategoryId] = useState<number | null>(null);
  const [financialCostCenterId, setFinancialCostCenterId] = useState<number | null>(null);
  const [financialGroupCompanyId, setFinancialGroupCompanyId] = useState<number | null>(null);
  const [financialDueDays, setFinancialDueDays] = useState(0);
  const [financialAccounts, setFinancialAccounts] = useState<FinanceiroContaFinanceira[]>([]);
  const [financialCategories, setFinancialCategories] = useState<FinanceiroCategoria[]>([]);
  const [financialCostCenters, setFinancialCostCenters] = useState<FinanceiroCentroCusto[]>([]);
  const [financialGroupCompanies, setFinancialGroupCompanies] = useState<FinanceiroEmpresaGrupo[]>([]);
  const [loadingFinancialOptions, setLoadingFinancialOptions] = useState(false);
  const [crmStageCounts, setCrmStageCounts] = useState<Record<number, number>>(
    {},
  );
  const [loadingCrmStageCounts, setLoadingCrmStageCounts] = useState(false);
  const hasDomainsBranchValue = domains
    ? Object.prototype.hasOwnProperty.call(domains, "filial_id")
    : false;

  const currentCrm = useMemo(
    () => crms.find((crm) => Number(crm.id) === Number(selectedCrmId)) || null,
    [crms, selectedCrmId],
  );

  useEffect(() => {
    setCrmName(currentCrm?.nome || "");
    setCrmDescription(currentCrm?.descricao || "");
  }, [currentCrm]);

  useEffect(() => {
    setAssignedUserIds(
      Array.isArray(domains?.usuarios_vinculados)
        ? domains.usuarios_vinculados
            .map((responsavel) => Number(responsavel.id))
            .filter(Boolean)
        : [],
    );
  }, [domains?.usuarios_vinculados, selectedCrmId]);

  useEffect(() => {
    const linkedMetaNumbers = Array.isArray(domains?.meta_numeros_vinculados)
      ? domains.meta_numeros_vinculados
      : currentCrm?.meta_numeros || [];
    setSelectedBranchId(
      (hasDomainsBranchValue ? (domains?.filial_id ?? null) : undefined) ??
        (currentCrm?.filial_id === undefined
          ? null
          : (currentCrm.filial_id ?? null)),
    );
    setSelectedMetaNumberIds(
      linkedMetaNumbers.map((item) => Number(item.id)).filter(Boolean),
    );
    setAutomationAttendanceStageId(
      domains?.automacao_etapa_atendimento_iniciado_id ??
        currentCrm?.automacao_etapa_atendimento_iniciado_id ??
        null,
    );
    setAutomationQuoteStageId(
      domains?.automacao_etapa_orcamento_enviado_id ??
        currentCrm?.automacao_etapa_orcamento_enviado_id ??
        null,
    );
    setGenerateReceivable(Boolean(domains?.financeiro_gerar_conta_receber ?? currentCrm?.financeiro_gerar_conta_receber));
    setFinancialAccountId(Number(domains?.financeiro_conta_financeira_id ?? currentCrm?.financeiro_conta_financeira_id ?? 0) || null);
    setFinancialCategoryId(Number(domains?.financeiro_categoria_id ?? currentCrm?.financeiro_categoria_id ?? 0) || null);
    setFinancialCostCenterId(Number(domains?.financeiro_centro_custo_id ?? currentCrm?.financeiro_centro_custo_id ?? 0) || null);
    setFinancialGroupCompanyId(Number(domains?.financeiro_empresa_grupo_id ?? currentCrm?.financeiro_empresa_grupo_id ?? 0) || null);
    setFinancialDueDays(Math.max(0, Number(domains?.financeiro_vencimento_dias ?? currentCrm?.financeiro_vencimento_dias ?? 0)));
  }, [
    currentCrm?.automacao_etapa_atendimento_iniciado_id,
    currentCrm?.automacao_etapa_orcamento_enviado_id,
    currentCrm?.financeiro_gerar_conta_receber,
    currentCrm?.financeiro_conta_financeira_id,
    currentCrm?.financeiro_categoria_id,
    currentCrm?.financeiro_centro_custo_id,
    currentCrm?.financeiro_empresa_grupo_id,
    currentCrm?.financeiro_vencimento_dias,
    currentCrm?.filial_id,
    currentCrm?.meta_numeros,
    domains?.automacao_etapa_atendimento_iniciado_id,
    domains?.automacao_etapa_orcamento_enviado_id,
    domains?.financeiro_gerar_conta_receber,
    domains?.financeiro_conta_financeira_id,
    domains?.financeiro_categoria_id,
    domains?.financeiro_centro_custo_id,
    domains?.financeiro_empresa_grupo_id,
    domains?.financeiro_vencimento_dias,
    domains?.filial_id,
    domains?.meta_numeros_vinculados,
    hasDomainsBranchValue,
    selectedCrmId,
  ]);

  useEffect(() => {
    if (!isConfigModalOpen || activeModalSection !== "sync_rules") return;
    setLoadingFinancialOptions(true);
    void Promise.all([
      listFinanceiroContasFinanceiras(),
      listFinanceiroCategorias(),
      listFinanceiroCentrosCusto(),
      listFinanceiroEmpresasGrupo(),
    ]).then(([accounts, categories, costCenters, groupCompanies]) => {
      setFinancialAccounts(accounts.filter((item) => item.ativo !== false));
      setFinancialCategories(categories.filter((item) => item.ativo !== false && (!item.tipo_codigo || item.tipo_codigo === "receita")));
      setFinancialCostCenters(costCenters.filter((item) => item.ativo !== false));
      setFinancialGroupCompanies(groupCompanies.filter((item) => item.ativo !== false));
    }).catch((error) => {
      addToast({ type: "error", title: "Financeiro", description: error instanceof Error ? error.message : "Nao foi possivel carregar as opcoes financeiras." });
    }).finally(() => setLoadingFinancialOptions(false));
  }, [activeModalSection, isConfigModalOpen]);

  const loadDomains = async () => {
    if (!selectedCrmId) {
      setDomains(null);
      return;
    }

    setLoadingDomains(true);
    try {
      const nextDomains = await getCommercialDomains(selectedCrmId);
      setDomains(nextDomains);
      setCrmStageCounts((current) => ({
        ...current,
        [selectedCrmId]: nextDomains.etapas.length,
      }));
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as colunas do funil.",
      });
    } finally {
      setLoadingDomains(false);
    }
  };

  useEffect(() => {
    void loadDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCrmId]);

  const sortedStages = useMemo(
    () => (domains?.etapas || []).slice().sort((a, b) => a.ordem - b.ordem),
    [domains],
  );
  const automationStageOptions = useMemo(
    () =>
      sortedStages.filter(
        (stage) => stage.ativo !== false && stage.eh_fechamento !== true,
      ),
    [sortedStages],
  );
  const activeCrms = useMemo(
    () =>
      [...crms]
        .filter((crm) => crm.ativo !== false)
        .sort((a, b) => {
          if (a.master && !b.master) return -1;
          if (!a.master && b.master) return 1;
          return String(a.nome || "").localeCompare(
            String(b.nome || ""),
            "pt-BR",
          );
        }),
    [crms],
  );

  const activeCrmIdsKey = useMemo(
    () => activeCrms.map((crm) => Number(crm.id)).join("|"),
    [activeCrms],
  );

  useEffect(() => {
    if (!activeCrms.length) {
      setCrmStageCounts({});
      setLoadingCrmStageCounts(false);
      return;
    }

    let isMounted = true;
    setLoadingCrmStageCounts(true);

    void Promise.all(
      activeCrms.map(async (crm) => {
        const crmId = Number(crm.id);
        try {
          const crmDomains = await getCommercialDomains(crmId);
          return [crmId, crmDomains.etapas.length] as const;
        } catch (error) {
          console.error("Erro ao carregar etapas do funil:", crmId, error);
          return [crmId, null] as const;
        }
      }),
    ).then((entries) => {
      if (!isMounted) return;

      setCrmStageCounts((current) => {
        const next = { ...current };
        entries.forEach(([crmId, count]) => {
          if (count === null) {
            delete next[crmId];
            return;
          }
          next[crmId] = count;
        });
        return next;
      });
      setLoadingCrmStageCounts(false);
    });

    return () => {
      isMounted = false;
    };
  }, [activeCrmIdsKey, activeCrms]);

  const hasSelectedCrm = Boolean(selectedCrmId && currentCrm);
  const currentAssignedUserIds = useMemo(
    () =>
      Array.isArray(domains?.usuarios_vinculados)
        ? domains.usuarios_vinculados
            .map((responsavel) => Number(responsavel.id))
            .filter(Boolean)
            .sort((a, b) => a - b)
        : [],
    [domains?.usuarios_vinculados],
  );
  const nextAssignedUserIds = useMemo(
    () => [...assignedUserIds].sort((a, b) => a - b),
    [assignedUserIds],
  );
  const currentBranchId =
    (hasDomainsBranchValue ? (domains?.filial_id ?? null) : undefined) ??
    (currentCrm?.filial_id === undefined
      ? null
      : (currentCrm.filial_id ?? null));
  const currentMetaNumberIds = useMemo(
    () =>
      [...(domains?.meta_numeros_vinculados || currentCrm?.meta_numeros || [])]
        .map((item) => Number(item.id))
        .filter(Boolean)
        .sort((a, b) => a - b),
    [currentCrm?.meta_numeros, domains?.meta_numeros_vinculados],
  );
  const nextMetaNumberIds = useMemo(
    () => [...selectedMetaNumberIds].sort((a, b) => a - b),
    [selectedMetaNumberIds],
  );
  const hasAssignedUsersChanges =
    JSON.stringify(currentAssignedUserIds) !==
    JSON.stringify(nextAssignedUserIds);
  const hasBranchChanges =
    Number(currentBranchId || 0) !== Number(selectedBranchId || 0);
  const hasMetaNumberChanges =
    JSON.stringify(currentMetaNumberIds) !== JSON.stringify(nextMetaNumberIds);
  const currentAutomationAttendanceStageId = Number(
    (domains?.automacao_etapa_atendimento_iniciado_id ??
      currentCrm?.automacao_etapa_atendimento_iniciado_id ??
      0) ||
      0,
  );
  const currentAutomationQuoteStageId = Number(
    (domains?.automacao_etapa_orcamento_enviado_id ??
      currentCrm?.automacao_etapa_orcamento_enviado_id ??
      0) ||
      0,
  );
  const hasAutomationAttendanceStageChanges =
    currentAutomationAttendanceStageId !==
    Number(automationAttendanceStageId || 0);
  const hasAutomationQuoteStageChanges =
    currentAutomationQuoteStageId !== Number(automationQuoteStageId || 0);
  const hasFinancialSyncChanges =
    Boolean(currentCrm?.financeiro_gerar_conta_receber) !== generateReceivable ||
    Number(currentCrm?.financeiro_conta_financeira_id || 0) !== Number(financialAccountId || 0) ||
    Number(currentCrm?.financeiro_categoria_id || 0) !== Number(financialCategoryId || 0) ||
    Number(currentCrm?.financeiro_centro_custo_id || 0) !== Number(financialCostCenterId || 0) ||
    Number(currentCrm?.financeiro_empresa_grupo_id || 0) !== Number(financialGroupCompanyId || 0) ||
    Number(currentCrm?.financeiro_vencimento_dias || 0) !== Number(financialDueDays || 0);
  const hasCrmBasicChanges =
    hasSelectedCrm &&
    (crmName.trim() !== (currentCrm?.nome || "") ||
      (crmDescription.trim() || "") !== (currentCrm?.descricao || "") ||
      hasBranchChanges);
  const hasCrmSyncChanges =
    hasSelectedCrm &&
    (hasAutomationAttendanceStageChanges ||
      hasAutomationQuoteStageChanges ||
      hasFinancialSyncChanges);
  const hasCrmAccessChanges =
    hasSelectedCrm && (hasAssignedUsersChanges || hasMetaNumberChanges);
  const hasCrmChanges =
    hasSelectedCrm &&
    (crmName.trim() !== (currentCrm?.nome || "") ||
      (crmDescription.trim() || "") !== (currentCrm?.descricao || "") ||
      hasAssignedUsersChanges ||
      hasBranchChanges ||
      hasMetaNumberChanges ||
      hasAutomationAttendanceStageChanges ||
      hasAutomationQuoteStageChanges ||
      hasFinancialSyncChanges);

  const activeCrmsCountLabel = `${activeCrms.length} ${
    activeCrms.length === 1 ? "funil" : "funis"
  }`;

  const getCrmStagesLabel = (crm: CommercialCrm) => {
    const crmId = Number(crm.id);
    if (Number.isFinite(crmId) && crmStageCounts[crmId] !== undefined) {
      return String(crmStageCounts[crmId]);
    }

    const crmWithStageCount = crm as CommercialCrm & {
      etapas?: unknown[];
      etapas_count?: number;
      etapas_total?: number;
      total_etapas?: number;
    };
    const count =
      crmWithStageCount.etapas_count ??
      crmWithStageCount.etapas_total ??
      crmWithStageCount.total_etapas ??
      (Array.isArray(crmWithStageCount.etapas)
        ? crmWithStageCount.etapas.length
        : null);

    return typeof count === "number" && Number.isFinite(count)
      ? String(count)
      : loadingCrmStageCounts
        ? "Carregando"
        : "-";
  };

  const metaNumberLabel = (
    metaNumber: CommercialMetaNumber | null | undefined,
  ) => {
    const primary =
      metaNumber?.display_phone_number ||
      metaNumber?.verified_name ||
      metaNumber?.phone_number_id ||
      `Numero ${metaNumber?.id || "-"}`;
    const secondary =
      metaNumber?.verified_name && metaNumber.display_phone_number
        ? metaNumber.verified_name
        : metaNumber?.phone_number_id || null;
    return secondary ? `${primary} • ${secondary}` : primary;
  };

  const branchLabel = (branch: CommercialBranch | null | undefined) =>
    branch?.nome || "Sem filial vinculada";

  const handleCreateCrm = async () => {
    if (!newCrmName.trim()) {
      addToast({
        type: "error",
        title: "Erro",
        description: "Informe o nome do funil.",
      });
      return;
    }

    setCreatingCrm(true);
    try {
      const created = await createCommercialCrm(
        newCrmName.trim(),
        newCrmDescription.trim() || undefined,
      );
      await onRefreshCrms();
      onSelectCrm(created.id);
      setNewCrmName("");
      setNewCrmDescription("");
      setIsCreateCrmModalOpen(false);
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Funil criado com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar o funil.",
      });
    } finally {
      setCreatingCrm(false);
    }
  };

  const handleSaveCrm = async () => {
    if (!selectedCrmId) return;
    if (!crmName.trim()) {
      addToast({
        type: "error",
        title: "Erro",
        description: "Informe o nome do funil.",
      });
      return;
    }

    setSavingCrm(true);
    try {
      await updateCommercialCrm(selectedCrmId, {
        name: crmName.trim(),
        description: crmDescription.trim() || null,
        assignedUserIds,
        branchId: selectedBranchId,
        metaParamIds: selectedMetaNumberIds,
        automacaoEtapaAtendimentoIniciadoId: automationAttendanceStageId,
        automacaoEtapaOrcamentoEnviadoId: automationQuoteStageId,
        financeiroGerarContaReceber: generateReceivable,
        financeiroContaFinanceiraId: financialAccountId,
        financeiroCategoriaId: financialCategoryId,
        financeiroCentroCustoId: financialCostCenterId,
        financeiroEmpresaGrupoId: financialGroupCompanyId,
        financeiroVencimentoDias: financialDueDays,
      });
      await onRefreshCrms();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Funil atualizado com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar o funil.",
      });
    } finally {
      setSavingCrm(false);
    }
  };

  const handleSaveCrmBasics = async () => {
    if (!selectedCrmId) return;
    if (!crmName.trim()) {
      addToast({
        type: "error",
        title: "Erro",
        description: "Informe o nome do funil.",
      });
      return;
    }

    setSavingCrm(true);
    try {
      await updateCommercialCrm(selectedCrmId, {
        name: crmName.trim(),
        description: crmDescription.trim() || null,
        branchId: selectedBranchId,
      });
      await onRefreshCrms();
      await loadDomains();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Dados do funil atualizados.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar os dados do funil.",
      });
    } finally {
      setSavingCrm(false);
    }
  };

  const handleSaveCrmSyncRules = async () => {
    if (!selectedCrmId) return;
    if (generateReceivable && (!financialAccountId || !financialCategoryId)) {
      addToast({
        type: "error",
        title: "Configuracao incompleta",
        description: "Selecione a conta financeira e a categoria da receita.",
      });
      return;
    }

    setSavingCrm(true);
    try {
      await updateCommercialCrm(selectedCrmId, {
        automacaoEtapaAtendimentoIniciadoId: automationAttendanceStageId,
        automacaoEtapaOrcamentoEnviadoId: automationQuoteStageId,
        financeiroGerarContaReceber: generateReceivable,
        financeiroContaFinanceiraId: financialAccountId,
        financeiroCategoriaId: financialCategoryId,
        financeiroCentroCustoId: financialCostCenterId,
        financeiroEmpresaGrupoId: financialGroupCompanyId,
        financeiroVencimentoDias: financialDueDays,
      });
      await onRefreshCrms();
      await loadDomains();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Regras de sincronização atualizadas.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possivel atualizar as regras de sincronização.",
      });
    } finally {
      setSavingCrm(false);
    }
  };

  const handleSaveCrmAccessConfig = async () => {
    if (!selectedCrmId) return;

    setSavingCrm(true);
    try {
      await updateCommercialCrm(selectedCrmId, {
        assignedUserIds,
        metaParamIds: selectedMetaNumberIds,
      });
      await onRefreshCrms();
      await loadDomains();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Numeros e acesso atualizados.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar numeros e acesso.",
      });
    } finally {
      setSavingCrm(false);
    }
  };

  const handleDeleteCrm = async () => {
    if (!selectedCrmId || !currentCrm) return;
    if (currentCrm.master) {
      addToast({
        type: "error",
        title: "Nao permitido",
        description: "O pipeline master nao pode ser apagado.",
      });
      return;
    }

    if (!window.confirm(`Apagar o funil "${currentCrm.nome}"?`)) return;

    setDeletingCrm(true);
    try {
      await deleteCommercialCrm(selectedCrmId);
      await onRefreshCrms();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Funil removido com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel apagar o funil.",
      });
    } finally {
      setDeletingCrm(false);
    }
  };

  const handleCreateStage = async () => {
    if (!selectedCrmId) return;
    if (!newStageName.trim()) {
      addToast({
        type: "error",
        title: "Erro",
        description: "Informe o nome da coluna.",
      });
      return;
    }

    setCreatingStage(true);
    try {
      await createCommercialStage(selectedCrmId, {
        name: newStageName.trim(),
        color: newStageColor,
      });
      setNewStageName("");
      setNewStageColor("#4299e1");
      await loadDomains();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Coluna criada com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar a coluna.",
      });
    } finally {
      setCreatingStage(false);
    }
  };

  const handleMoveStage = async (stageId: number, direction: "up" | "down") => {
    if (!selectedCrmId) return;
    const ids = sortedStages.map((stage) => stage.id);
    const currentIndex = ids.findIndex((id) => Number(id) === Number(stageId));
    if (currentIndex < 0) return;

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= ids.length) return;

    const reordered = [...ids];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    try {
      await reorderCommercialStages(selectedCrmId, reordered);
      await loadDomains();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel reordenar as colunas.",
      });
    }
  };

  const startEditingStage = (
    stageId: number,
    name: string,
    color?: string | null,
  ) => {
    setEditingStageId(stageId);
    setEditingStageName(name);
    setEditingStageColor(color || "#4299e1");
  };

  const saveStageEdit = async () => {
    if (!selectedCrmId || !editingStageId) return;
    if (!editingStageName.trim()) {
      addToast({
        type: "error",
        title: "Erro",
        description: "Informe o nome da coluna.",
      });
      return;
    }

    try {
      await updateCommercialStage(selectedCrmId, editingStageId, {
        name: editingStageName.trim(),
        color: editingStageColor,
      });
      setEditingStageId(null);
      await loadDomains();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Coluna atualizada.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel atualizar a coluna.",
      });
    }
  };

  const handleDeleteStage = async (stageId: number, stageName: string) => {
    if (!selectedCrmId) return;
    if (!window.confirm(`Apagar a coluna "${stageName}"?`)) return;

    try {
      await deleteCommercialStage(selectedCrmId, stageId);
      await loadDomains();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Coluna removida.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel apagar a coluna.",
      });
    }
  };

  const handleEditCrmFromList = (crmId: number) => {
    onSelectCrm(crmId);
    setActiveModalSection("funnel_data");
    setIsConfigModalOpen(true);
  };

  const toggleAssignedUser = (userId: number) => {
    setAssignedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((currentId) => currentId !== userId)
        : [...prev, userId],
    );
  };

  const toggleMetaNumber = (metaNumberId: number) => {
    setSelectedMetaNumberIds((prev) =>
      prev.includes(metaNumberId)
        ? prev.filter((currentId) => currentId !== metaNumberId)
        : [...prev, metaNumberId],
    );
  };

  return (
    <div className="crm-settings-root">
      <div
        className="crm-settings-view-actions crm-settings-view-tabs"
        role="tablist"
        aria-label="Selecione a tela de configuracao do funil"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeViewTab === "active_funnel"}
          className={
            activeViewTab === "active_funnel"
              ? "crm-settings-view-tab crm-settings-view-tab--active"
              : "crm-settings-view-tab"
          }
          onClick={() => setActiveViewTab("active_funnel")}
        >
          Funil ativo
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeViewTab === "registered_products"}
          className={
            activeViewTab === "registered_products"
              ? "crm-settings-view-tab crm-settings-view-tab--active"
              : "crm-settings-view-tab"
          }
          onClick={() => setActiveViewTab("registered_products")}
        >
          Produtos cadastrados
        </button>
      </div>

      <div className="settings-top-row">
        {activeViewTab === "active_funnel" ? (
          <div className="settings-card crm-selector-card" role="tabpanel">
            <div className="settings-card-header crm-selector-card-header">
              <div>
                <h3>Funis ativos</h3>
                <span className="crm-selector-card-count">
                  {activeCrmsCountLabel}
                </span>
              </div>
              <button
                type="button"
                className="crm-settings-primary-action crm-selector-create-button"
                onClick={() => setIsCreateCrmModalOpen(true)}
              >
                + Criar funil
              </button>
            </div>

            {!activeCrms.length ? (
              <p className="crm-funnel-card-empty">
                Nenhum pipeline ativo disponivel.
              </p>
            ) : (
              <div className="crm-funnel-card-grid">
                {activeCrms.map((crm) => {
                  const linkedNumbers = Array.isArray(crm.meta_numeros)
                    ? crm.meta_numeros
                    : [];
                  const metaCount = linkedNumbers.length;

                  return (
                    <article
                      className="crm-funnel-card"
                      key={`funnel-card-${crm.id}`}
                    >
                      <div className="crm-funnel-card-meta-wrap">
                        <div className="crm-funnel-card-header">
                          <div className="crm-funnel-card-identity">
                            <p className="crm-funnel-card-name">{crm.nome}</p>
                            {crm.master ? (
                              <span className="crm-funnel-card-badge crm-funnel-card-badge--master">
                                Master
                              </span>
                            ) : crm.acesso_restrito ? (
                              <span className="crm-funnel-card-badge crm-funnel-card-badge--restricted">
                                Restrito
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <p className="crm-funnel-card-description">
                        {crm.descricao || "Sem descrição"}
                      </p>

                      <dl className="crm-funnel-card-meta">
                        <div>
                          <dt>Filial</dt>
                          <dd>{crm.filial_nome || "Sem vinculo"}</dd>
                        </div>
                        <div>
                          <dt>Número Meta</dt>
                          <dd>
                            {metaCount
                              ? `${metaCount} ${metaCount === 1 ? "número" : "números"}`
                              : "Sem número"}
                          </dd>
                        </div>
                        <div>
                          <dt>Etapas</dt>
                          <dd>{getCrmStagesLabel(crm)}</dd>
                        </div>
                      </dl>

                      <div className="crm-funnel-card-actions">
                        <button
                          type="button"
                          className="action-button"
                          onClick={() => {
                            handleEditCrmFromList(Number(crm.id));
                          }}
                        >
                          <FiSettings aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="crm-settings-products-panel" role="tabpanel">
            <CommercialProducts embedded />
          </div>
        )}
      </div>

      {isCreateCrmModalOpen ? (
        <div
          className="crm-settings-modal-backdrop"
          onClick={() => setIsCreateCrmModalOpen(false)}
        >
          <div
            className="crm-settings-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-card-header">
              <h3>Novo funil</h3>
              <button
                type="button"
                className="crm-settings-modal-close"
                onClick={() => setIsCreateCrmModalOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="settings-form-grid crm-create-modal-grid">
              <label className="field-group">
                <span>Nome</span>
                <input
                  type="text"
                  placeholder="Ex: Vendas B2B"
                  value={newCrmName}
                  onChange={(e) => setNewCrmName(e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>Descrição</span>
                <input
                  type="text"
                  placeholder="Opcional"
                  value={newCrmDescription}
                  onChange={(e) => setNewCrmDescription(e.target.value)}
                />
              </label>
            </div>

            <div className="crm-settings-modal-actions">
              <button
                type="button"
                className="crm-settings-secondary-action"
                onClick={() => setIsCreateCrmModalOpen(false)}
                disabled={creatingCrm}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="crm-settings-primary-action"
                onClick={() => void handleCreateCrm()}
                disabled={creatingCrm}
              >
                {creatingCrm ? "Criando..." : "Cadastrar funil"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isConfigModalOpen ? (
        <div
          className="crm-settings-modal-backdrop"
          onClick={() => setIsConfigModalOpen(false)}
        >
          <div
            className="crm-settings-modal crm-settings-modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="settings-card-header crm-settings-modal-header">
              <div>
              <h3>Configurações do funil</h3>
              <p>{currentCrm?.nome || "Nenhum funil selecionado"}</p>
              </div>
              <button
                type="button"
                className="crm-settings-modal-close"
                onClick={() => setIsConfigModalOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="crm-settings-modal-content">
              <aside className="crm-settings-modal-sidebar" aria-label="Secoes do funil">
                <button
                  type="button"
                  className={
                    activeModalSection === "funnel_data"
                      ? "crm-settings-modal-nav-item is-active"
                      : "crm-settings-modal-nav-item"
                  }
                  onClick={() => setActiveModalSection("funnel_data")}
                >
                  Dados do funil
                </button>
                <button
                  type="button"
                  className={
                    activeModalSection === "sync_rules"
                      ? "crm-settings-modal-nav-item is-active"
                      : "crm-settings-modal-nav-item"
                  }
                  onClick={() => setActiveModalSection("sync_rules")}
                >
                  Regras de sincronização
                </button>
                <button
                  type="button"
                  className={
                    activeModalSection === "number_access"
                      ? "crm-settings-modal-nav-item is-active"
                      : "crm-settings-modal-nav-item"
                  }
                  onClick={() => setActiveModalSection("number_access")}
                >
                  Número e acesso
                </button>
                <button
                  type="button"
                  className={
                    activeModalSection === "columns"
                      ? "crm-settings-modal-nav-item is-active"
                      : "crm-settings-modal-nav-item"
                  }
                  onClick={() => setActiveModalSection("columns")}
                >
                  <span>Colunas</span>
                  <strong>{sortedStages.length}</strong>
                </button>
              </aside>

              <div className="crm-settings-modal-panel">
                {!currentCrm ? (
                  <section className="crm-settings-section-card">
                    <p className="empty-state-text">Nenhum funil selecionado.</p>
                  </section>
                ) : null}

                {currentCrm && activeModalSection === "funnel_data" ? (
                  <section className="crm-settings-section-card">
                    <div className="crm-settings-section-header">
                      <div>
                        <h3>Dados do funil</h3>
                        <p>Configure as informacoes basicas do funil.</p>
                      </div>
                      {currentCrm.master ? (
                        <span className="master-badge">Pipeline master</span>
                      ) : null}
                    </div>

                    <div className="settings-form-grid crm-settings-section-grid">
                      <label className="field-group">
                        <span>Nome do funil</span>
                        <input
                          type="text"
                          value={crmName}
                          onChange={(e) => setCrmName(e.target.value)}
                        />
                      </label>
                      <label className="field-group">
                        <span>Filial vinculada</span>
                        <select
                          value={selectedBranchId ? String(selectedBranchId) : ""}
                          onChange={(e) =>
                            setSelectedBranchId(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        >
                          <option value="">Sem filial vinculada</option>
                          {(domains?.filiais || []).map((branch) => (
                            <option key={branch.id} value={String(branch.id)}>
                              {branchLabel(branch)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-group crm-settings-section-grid-full">
                        <span>Descricao</span>
                        <input
                          type="text"
                          value={crmDescription}
                          onChange={(e) => setCrmDescription(e.target.value)}
                          placeholder="Opcional"
                        />
                      </label>
                    </div>

                    <div className="crm-settings-danger-zone">
                      <div>
                        <strong>Zona de perigo</strong>
                        <p>Excluir permanentemente este funil.</p>
                      </div>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => void handleDeleteCrm()}
                        disabled={deletingCrm || savingCrm || currentCrm.master}
                        title={
                          currentCrm.master
                            ? "O pipeline master nao pode ser apagado."
                            : "Apagar funil"
                        }
                      >
                        {deletingCrm ? "Apagando..." : "Apagar funil"}
                      </button>
                    </div>

                    <div className="crm-settings-section-actions">
                      <button
                        type="button"
                        className="crm-settings-secondary-action"
                        onClick={() => setIsConfigModalOpen(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="crm-settings-primary-action"
                        onClick={() => void handleSaveCrmBasics()}
                        disabled={savingCrm || !hasCrmBasicChanges}
                      >
                        {savingCrm ? "Salvando..." : "Salvar dados"}
                      </button>
                    </div>
                  </section>
                ) : null}

                {currentCrm && activeModalSection === "sync_rules" ? (
                  <section className="crm-settings-section-card">
                    <div className="crm-settings-section-header">
                      <div>
                        <h3>Regras de sincronização</h3>
                        <p>Defina as movimentações automáticas do funil.</p>
                      </div>
                    </div>

                    <div className="settings-form-grid crm-settings-section-grid">
                      <label className="field-group">
                        <span>Mover ao iniciar atendimento</span>
                        <select
                          value={
                            automationAttendanceStageId
                              ? String(automationAttendanceStageId)
                              : ""
                          }
                          onChange={(e) =>
                            setAutomationAttendanceStageId(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        >
                          <option value="">Não mover automaticamente</option>
                          {automationStageOptions.map((stage) => (
                            <option key={`attendance-panel-${stage.id}`} value={String(stage.id)}>
                              {stage.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-group">
                        <span>Mover ao criar orçamento</span>
                        <select
                          value={
                            automationQuoteStageId
                              ? String(automationQuoteStageId)
                              : ""
                          }
                          onChange={(e) =>
                            setAutomationQuoteStageId(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        >
                          <option value="">Não mover automaticamente</option>
                          {automationStageOptions.map((stage) => (
                            <option key={`quote-panel-${stage.id}`} value={String(stage.id)}>
                              {stage.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="crm-financial-sync-card">
                      <label className="crm-financial-sync-toggle">
                        <input
                          type="checkbox"
                          checked={generateReceivable}
                          onChange={(event) => setGenerateReceivable(event.target.checked)}
                        />
                        <span>
                          <strong>Gerar conta a receber</strong>
                          <small>Ao mover um negocio para Fechado ganho, cria uma receita no Financeiro uma unica vez.</small>
                        </span>
                      </label>
                      {generateReceivable ? (
                        <div className="settings-form-grid crm-settings-section-grid crm-financial-sync-fields">
                          <label className="field-group">
                            <span>Conta financeira *</span>
                            <select value={financialAccountId || ""} disabled={loadingFinancialOptions} onChange={(event) => setFinancialAccountId(Number(event.target.value) || null)}>
                              <option value="">Selecione a conta de destino</option>
                              {financialAccounts.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                            </select>
                          </label>
                          <label className="field-group">
                            <span>Categoria da receita *</span>
                            <select value={financialCategoryId || ""} disabled={loadingFinancialOptions} onChange={(event) => setFinancialCategoryId(Number(event.target.value) || null)}>
                              <option value="">Selecione a categoria</option>
                              {financialCategories.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                            </select>
                          </label>
                          <label className="field-group">
                            <span>Centro de custo</span>
                            <select value={financialCostCenterId || ""} disabled={loadingFinancialOptions} onChange={(event) => setFinancialCostCenterId(Number(event.target.value) || null)}>
                              <option value="">Nao vincular</option>
                              {financialCostCenters.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                            </select>
                          </label>
                          <label className="field-group">
                            <span>Empresa do grupo</span>
                            <select value={financialGroupCompanyId || ""} disabled={loadingFinancialOptions} onChange={(event) => setFinancialGroupCompanyId(Number(event.target.value) || null)}>
                              <option value="">Nao vincular</option>
                              {financialGroupCompanies.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                            </select>
                          </label>
                          <label className="field-group">
                            <span>Vencimento apos (dias)</span>
                            <input type="number" min={0} max={3650} value={financialDueDays} onChange={(event) => setFinancialDueDays(Math.max(0, Math.min(3650, Number(event.target.value) || 0)))} />
                            <small>Use 0 para vencer na data do fechamento.</small>
                          </label>
                        </div>
                      ) : null}
                    </div>
                    <p className="empty-state-text">
                      Cada ação aceita apenas uma coluna por funil. O atendimento iniciado dispara pela tela de chat e o orçamento criado vale tanto no chat quanto no pipeline.
                    </p>

                    <div className="crm-settings-section-actions">
                      <button
                        type="button"
                        className="crm-settings-primary-action"
                        onClick={() => void handleSaveCrmSyncRules()}
                        disabled={savingCrm || !hasCrmSyncChanges}
                      >
                        {savingCrm ? "Salvando..." : "Salvar regras"}
                      </button>
                    </div>
                  </section>
                ) : null}

                {currentCrm && activeModalSection === "number_access" ? (
                  <section className="crm-settings-section-card">
                    <div className="crm-settings-section-header">
                      <div>
                        <h3>Configuração número e acesso</h3>
                        <p>Escolha os números Meta e quem pode acessar este funil.</p>
                      </div>
                    </div>

                    <div className="crm-access-card">
                      <div className="crm-access-card-head">
                        <div>
                          <strong>Números da Meta que alimentam este funil</strong>
                          <p>
                            Leads so entram automaticamente aqui quando chegarem por um dos números marcados.
                            Cada número pode alimentar somente um funil por vez; números já utilizados aparecem bloqueados abaixo.
                            Se nenhum número for marcado, este funil recebe leads apenas manualmente.
                          </p>
                        </div>
                        <span className={`crm-access-badge ${selectedMetaNumberIds.length ? "is-restricted" : ""}`}>
                          {selectedMetaNumberIds.length
                            ? `${selectedMetaNumberIds.length} vinculado(s)`
                            : "Manual apenas"}
                        </span>
                      </div>

                      <div className="crm-access-users">
                        {(domains?.meta_numeros || []).length ? (
                          (domains?.meta_numeros || []).map((metaNumber) => {
                            const isChecked = selectedMetaNumberIds.includes(Number(metaNumber.id));
                            const linkedCrmId = Number(metaNumber.crm_vinculado_id || 0);
                            const isLinkedElsewhere =
                              linkedCrmId > 0 && linkedCrmId !== Number(selectedCrmId);
                            const linkedCrmName =
                              metaNumber.crm_vinculado_nome || `Funil #${linkedCrmId}`;
                            return (
                              <label
                                key={`panel-meta-${metaNumber.id}`}
                                className={`crm-access-user ${isChecked ? "is-selected" : ""} ${isLinkedElsewhere ? "is-unavailable" : ""}`}
                                title={
                                  isLinkedElsewhere
                                    ? `Este número já está vinculado ao funil "${linkedCrmName}".`
                                    : undefined
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleMetaNumber(Number(metaNumber.id))}
                                  disabled={isLinkedElsewhere}
                                />
                                <span>
                                  {metaNumberLabel(metaNumber)}
                                  {metaNumber.ativo === false ? " (inativo)" : ""}
                                  {isLinkedElsewhere ? (
                                    <small className="crm-access-user__reason">
                                      Vinculado ao funil {linkedCrmName}
                                    </small>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="empty-state-text">
                            Nenhum número Meta cadastrado para vincular a este funil.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="crm-access-card">
                      <div className="crm-access-card-head">
                        <div>
                          <strong>Acesso ao pipeline</strong>
                          <p>Se nenhum usuário for marcado, o pipeline continua liberado para todos.</p>
                        </div>
                        <span className={`crm-access-badge ${domains?.acesso_restrito ? "is-restricted" : ""}`}>
                          {domains?.acesso_restrito ? "Restrito" : "Aberto"}
                        </span>
                      </div>

                      <div className="crm-access-users">
                        {(domains?.responsaveis || []).map((responsavel) => {
                          const isChecked = assignedUserIds.includes(Number(responsavel.id));
                          return (
                            <label
                              key={`panel-user-${responsavel.id}`}
                              className={`crm-access-user ${isChecked ? "is-selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleAssignedUser(Number(responsavel.id))}
                              />
                              <span>{responsavel.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="crm-settings-section-actions">
                      <button
                        type="button"
                        className="crm-settings-primary-action"
                        onClick={() => void handleSaveCrmAccessConfig()}
                        disabled={savingCrm || !hasCrmAccessChanges}
                      >
                        {savingCrm ? "Salvando..." : "Salvar acesso"}
                      </button>
                    </div>
                  </section>
                ) : null}

                {currentCrm && activeModalSection === "columns" ? (
                  <section className="crm-settings-section-card">
                    <div className="crm-settings-section-header">
                      <div>
                        <h3>Customização colunas</h3>
                        <p>Crie, edite e ordene as etapas deste funil.</p>
                      </div>
                      <span className="muted-label">{sortedStages.length} etapa(s)</span>
                    </div>

                    <div className="settings-form-grid stage-create-row">
                      <label className="field-group">
                        <span>Nova coluna</span>
                        <input
                          type="text"
                          placeholder="Ex: Proposta enviada"
                          value={newStageName}
                          onChange={(e) => setNewStageName(e.target.value)}
                        />
                      </label>
                      <label className="field-group color-field">
                        <span>Cor</span>
                        <input
                          type="color"
                          value={newStageColor}
                          onChange={(e) => setNewStageColor(e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="crm-settings-primary-action"
                        onClick={() => void handleCreateStage()}
                        disabled={creatingStage}
                      >
                        {creatingStage ? "Criando..." : "Adicionar"}
                      </button>
                    </div>

                    {loadingDomains ? (
                      <p className="empty-state-text">Carregando colunas...</p>
                    ) : (
                      <div className="stage-list">
                        {sortedStages.map((stage, index) => {
                          const isRequired =
                            stage.codigo === "waiting" ||
                            stage.codigo === "closed-won" ||
                            stage.codigo === "closed-lost";
                          const isEditing = Number(editingStageId) === Number(stage.id);

                          return (
                            <div className="stage-row" key={`panel-stage-${stage.id}`}>
                              <span className="stage-index">{String(index + 1).padStart(2, "0")}</span>

                              {isEditing ? (
                                <>
                                  <label className="field-group">
                                    <span className="sr-only">Nome da coluna</span>
                                    <input
                                      type="text"
                                      value={editingStageName}
                                      onChange={(e) => setEditingStageName(e.target.value)}
                                    />
                                  </label>
                                  <input
                                    type="color"
                                    value={editingStageColor}
                                    onChange={(e) => setEditingStageColor(e.target.value)}
                                  />
                                </>
                              ) : (
                                <>
                                  <div className="stage-name-wrap">
                                    <span className="stage-name">{stage.nome}</span>
                                    {isRequired ? (
                                      <span className="required-badge">Obrigatoria</span>
                                    ) : null}
                                  </div>
                                  <span
                                    className="stage-color-chip"
                                    style={{ backgroundColor: stage.cor || "#cbd5e0" }}
                                  />
                                </>
                              )}

                              <div className="stage-actions">
                                <button
                                  type="button"
                                  onClick={() => void handleMoveStage(stage.id, "up")}
                                  disabled={index === 0}
                                >
                                  Subir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleMoveStage(stage.id, "down")}
                                  disabled={index === sortedStages.length - 1}
                                >
                                  Descer
                                </button>

                                {isEditing ? (
                                  <>
                                    <button type="button" onClick={() => void saveStageEdit()}>
                                      Salvar
                                    </button>
                                    <button type="button" onClick={() => setEditingStageId(null)}>
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditingStage(stage.id, stage.nome, stage.cor)
                                    }
                                  >
                                    Editar
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="btn-danger-outline"
                                  onClick={() => void handleDeleteStage(stage.id, stage.nome)}
                                  disabled={isRequired}
                                  title={
                                    isRequired
                                      ? "Coluna obrigatoria do sistema."
                                      : "Apagar coluna"
                                  }
                                >
                                  Apagar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                ) : null}
              </div>
              <div className="settings-card">
                <div className="settings-card-header">
                  <h3>Dados do funil</h3>
                  {currentCrm?.master ? (
                    <span className="master-badge">Pipeline master</span>
                  ) : null}
                </div>
                {!currentCrm ? (
                  <p className="empty-state-text">Nenhum funil selecionado.</p>
                ) : (
                  <>
                    <div className="settings-form-grid crm-edit-grid">
                      <label className="field-group">
                        <span>Nome do funil</span>
                        <input
                          type="text"
                          value={crmName}
                          onChange={(e) => setCrmName(e.target.value)}
                        />
                      </label>
                      <label className="field-group">
                        <span>Descrição</span>
                        <input
                          type="text"
                          value={crmDescription}
                          onChange={(e) => setCrmDescription(e.target.value)}
                          placeholder="Opcional"
                        />
                      </label>
                      <label className="field-group">
                        <span>Filial vinculada</span>
                        <select
                          value={
                            selectedBranchId ? String(selectedBranchId) : ""
                          }
                          onChange={(e) =>
                            setSelectedBranchId(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        >
                          <option value="">Sem filial vinculada</option>
                          {(domains?.filiais || []).map((branch) => (
                            <option key={branch.id} value={String(branch.id)}>
                              {branchLabel(branch)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-group">
                        <span>Mover ao iniciar atendimento</span>
                        <select
                          value={
                            automationAttendanceStageId
                              ? String(automationAttendanceStageId)
                              : ""
                          }
                          onChange={(e) =>
                            setAutomationAttendanceStageId(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        >
                          <option value="">Nao mover automaticamente</option>
                          {automationStageOptions.map((stage) => (
                            <option
                              key={`attendance-${stage.id}`}
                              value={String(stage.id)}
                            >
                              {stage.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-group">
                        <span>Mover ao criar orcamento</span>
                        <select
                          value={
                            automationQuoteStageId
                              ? String(automationQuoteStageId)
                              : ""
                          }
                          onChange={(e) =>
                            setAutomationQuoteStageId(
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        >
                          <option value="">Nao mover automaticamente</option>
                          {automationStageOptions.map((stage) => (
                            <option
                              key={`quote-${stage.id}`}
                              value={String(stage.id)}
                            >
                              {stage.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="empty-state-text">
                      Cada acao aceita apenas uma coluna por funil. O
                      atendimento iniciado dispara pela tela de chat e o
                      orcamento criado vale tanto no chat quanto no pipeline.
                    </p>
                    <div className="crm-access-card">
                      <div className="crm-access-card-head">
                        <div>
                          <strong>
                            Numeros da Meta que alimentam este funil
                          </strong>
                          <p>
                            Leads so entram automaticamente aqui quando chegarem
                            por um dos numeros marcados. Cada numero pode alimentar
                            somente um funil por vez; numeros ja utilizados aparecem
                            bloqueados abaixo. Se nenhum numero for
                            marcado, este funil recebe leads apenas manualmente.
                          </p>
                        </div>
                        <span
                          className={`crm-access-badge ${selectedMetaNumberIds.length ? "is-restricted" : ""}`}
                        >
                          {selectedMetaNumberIds.length
                            ? `${selectedMetaNumberIds.length} vinculado(s)`
                            : "Manual apenas"}
                        </span>
                      </div>

                      <div className="crm-access-users">
                        {(domains?.meta_numeros || []).length ? (
                          (domains?.meta_numeros || []).map((metaNumber) => {
                            const isChecked = selectedMetaNumberIds.includes(
                              Number(metaNumber.id),
                            );
                            const linkedCrmId = Number(metaNumber.crm_vinculado_id || 0);
                            const isLinkedElsewhere =
                              linkedCrmId > 0 && linkedCrmId !== Number(selectedCrmId);
                            const linkedCrmName =
                              metaNumber.crm_vinculado_nome || `Funil #${linkedCrmId}`;
                            return (
                              <label
                                key={metaNumber.id}
                                className={`crm-access-user ${isChecked ? "is-selected" : ""} ${isLinkedElsewhere ? "is-unavailable" : ""}`}
                                title={
                                  isLinkedElsewhere
                                    ? `Este número já está vinculado ao funil "${linkedCrmName}".`
                                    : undefined
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() =>
                                    toggleMetaNumber(Number(metaNumber.id))
                                  }
                                  disabled={isLinkedElsewhere}
                                />
                                <span>
                                  {metaNumberLabel(metaNumber)}
                                  {metaNumber.ativo === false
                                    ? " (inativo)"
                                    : ""}
                                  {isLinkedElsewhere ? (
                                    <small className="crm-access-user__reason">
                                      Vinculado ao funil {linkedCrmName}
                                    </small>
                                  ) : null}
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="empty-state-text">
                            Nenhum numero Meta cadastrado para vincular a este
                            funil.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="crm-access-card">
                      <div className="crm-access-card-head">
                        <div>
                          <strong>Acesso ao pipeline</strong>
                          <p>
                            Se nenhum usuario for marcado, o pipeline continua
                            liberado para todos.
                          </p>
                        </div>
                        <span
                          className={`crm-access-badge ${domains?.acesso_restrito ? "is-restricted" : ""}`}
                        >
                          {domains?.acesso_restrito ? "Restrito" : "Aberto"}
                        </span>
                      </div>

                      <div className="crm-access-users">
                        {(domains?.responsaveis || []).map((responsavel) => {
                          const isChecked = assignedUserIds.includes(
                            Number(responsavel.id),
                          );
                          return (
                            <label
                              key={responsavel.id}
                              className={`crm-access-user ${isChecked ? "is-selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  toggleAssignedUser(Number(responsavel.id))
                                }
                              />
                              <span>{responsavel.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    <div className="settings-crm-actions">
                      <button
                        type="button"
                        className="crm-settings-primary-action"
                        onClick={() => void handleSaveCrm()}
                        disabled={savingCrm || !hasCrmChanges}
                      >
                        {savingCrm ? "Salvando..." : "Salvar alteracoes"}
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => void handleDeleteCrm()}
                        disabled={
                          deletingCrm || savingCrm || currentCrm?.master
                        }
                        title={
                          currentCrm?.master
                            ? "O pipeline master nao pode ser apagado."
                            : "Apagar funil"
                        }
                      >
                        {deletingCrm ? "Apagando..." : "Apagar funil"}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="settings-card">
                <div className="settings-card-header">
                  <h3>Colunas do funil</h3>
                  {hasSelectedCrm ? (
                    <span className="muted-label">
                      {sortedStages.length} etapa(s)
                    </span>
                  ) : null}
                </div>
                {!selectedCrmId ? (
                  <p className="empty-state-text">
                    Selecione um funil para gerenciar colunas.
                  </p>
                ) : (
                  <>
                    <div className="settings-form-grid stage-create-row">
                      <label className="field-group">
                        <span>Nova coluna</span>
                        <input
                          type="text"
                          placeholder="Ex: Proposta enviada"
                          value={newStageName}
                          onChange={(e) => setNewStageName(e.target.value)}
                        />
                      </label>
                      <label className="field-group color-field">
                        <span>Cor</span>
                        <input
                          type="color"
                          value={newStageColor}
                          onChange={(e) => setNewStageColor(e.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="crm-settings-primary-action"
                        onClick={() => void handleCreateStage()}
                        disabled={creatingStage}
                      >
                        {creatingStage ? "Criando..." : "Adicionar"}
                      </button>
                    </div>

                    {loadingDomains ? (
                      <p className="empty-state-text">Carregando colunas...</p>
                    ) : (
                      <div className="stage-list">
                        {sortedStages.map((stage, index) => {
                          const isRequired =
                            stage.codigo === "waiting" ||
                            stage.codigo === "closed-won" ||
                            stage.codigo === "closed-lost";
                          const isEditing =
                            Number(editingStageId) === Number(stage.id);

                          return (
                            <div className="stage-row" key={stage.id}>
                              <span className="stage-index">
                                {String(index + 1).padStart(2, "0")}
                              </span>

                              {isEditing ? (
                                <>
                                  <label className="field-group">
                                    <span className="sr-only">
                                      Nome da coluna
                                    </span>
                                    <input
                                      type="text"
                                      value={editingStageName}
                                      onChange={(e) =>
                                        setEditingStageName(e.target.value)
                                      }
                                    />
                                  </label>
                                  <input
                                    type="color"
                                    value={editingStageColor}
                                    onChange={(e) =>
                                      setEditingStageColor(e.target.value)
                                    }
                                  />
                                </>
                              ) : (
                                <>
                                  <div className="stage-name-wrap">
                                    <span className="stage-name">
                                      {stage.nome}
                                    </span>
                                    {isRequired ? (
                                      <span className="required-badge">
                                        Obrigatoria
                                      </span>
                                    ) : null}
                                  </div>
                                  <span
                                    className="stage-color-chip"
                                    style={{
                                      backgroundColor: stage.cor || "#cbd5e0",
                                    }}
                                  />
                                </>
                              )}

                              <div className="stage-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleMoveStage(stage.id, "up")
                                  }
                                  disabled={index === 0}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleMoveStage(stage.id, "down")
                                  }
                                  disabled={index === sortedStages.length - 1}
                                >
                                  ↓
                                </button>

                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void saveStageEdit()}
                                    >
                                      Salvar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingStageId(null)}
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditingStage(
                                        stage.id,
                                        stage.nome,
                                        stage.cor,
                                      )
                                    }
                                  >
                                    Editar
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="btn-danger-outline"
                                  onClick={() =>
                                    void handleDeleteStage(stage.id, stage.nome)
                                  }
                                  disabled={isRequired}
                                  title={
                                    isRequired
                                      ? "Coluna obrigatoria do sistema."
                                      : "Apagar coluna"
                                  }
                                >
                                  Apagar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
