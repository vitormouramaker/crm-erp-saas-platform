import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiDollarSign,
  FiEdit2,
  FiFilter,
  FiInfo,
  FiLayers,
  FiFileText,
  FiList,
  FiPlus,
  FiPower,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
} from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Modal } from "../../components/common/Modal/Modal";
import { useToast } from "../../contexts/ToastContext";
import {
  createFinanceiroCategoria,
  createFinanceiroContaPagar,
  createFinanceiroContaPagarParcelado,
  createFinanceiroContaReceber,
  createFinanceiroContaReceberParcelado,
  finalizeFinanceiroMetaUsuario,
  getFinanceiroDashboard,
  getFinanceiroDominios,
  getFinanceiroHealthcheck,
  listFinanceiroAlertas,
  listFinanceiroAssinaturasEmpresa,
  listFinanceiroCategorias,
  listFinanceiroCentrosCusto,
  listFinanceiroComissoesLancadasMes,
  listFinanceiroContasFinanceiras,
  listFinanceiroEmpresasGrupo,
  listFinanceiroFormasPagamento,
  listFinanceiroContasPagar,
  listFinanceiroContasReceber,
  listFinanceiroLancamentos,
  listFinanceiroMetasMes,
  listFinanceiroContrapartes,
  listFinanceiroUsuarios,
  markFinanceiroAlertaLido,
  createFinanceiroAssinaturaEmpresa,
  deleteFinanceiroContaPagar,
  deleteFinanceiroContaReceber,
  deleteFinanceiroLancamento,
  inativarFinanceiroAssinaturaEmpresa,
  registerFinanceiroPagamento,
  registerFinanceiroRecebimento,
  saveFinanceiroMetaUsuario,
  updateFinanceiroAssinaturaEmpresa,
  type FinanceiroAlerta,
  type FinanceiroAssinaturaEmpresa,
  type FinanceiroCategoria,
  type FinanceiroCentroCusto,
  type FinanceiroComissaoLancamento,
  type FinanceiroComissaoLancadaMesItem,
  type FinanceiroContaAgrupada,
  type FinanceiroContaItem,
  type FinanceiroContaFinanceira,
  type FinanceiroContraparte,
  type FinanceiroEmpresaGrupo,
  type FinanceiroFormaPagamento,
  type FinanceiroDashboard,
  type FinanceiroDominio,
  type FinanceiroHealthcheck,
  type FinanceiroLancamento,
  type FinanceiroMetaUsuario,
  type FinanceiroMetaMesItem,
  type FinanceiroUsuarioOption,
} from "../../service/financeiroService";
import { exportFinanceiroWorkbook } from "../../utils/financeiroExport";
import "./FinancialPage.css";
import { FinancialStructurePanel } from "./FinancialStructurePanel";

type Tab =
  | "dashboard"
  | "contas_pagar"
  | "contas_receber"
  | "lancamentos"
  | "alertas"
  | "categorias"
  | "estrutura"
  | "comissoes"
  | "assinaturas";

type PaymentDialogState = {
  open: boolean;
  type: "pagar" | "receber";
  contaId: number | null;
  valorEmAberto: number | null;
  valor: string;
  meio: string;
  formaPagamentoId: string;
  observacao: string;
  file: File | null;
};

type DeleteContaPagarDialogState = {
  open: boolean;
  contaId?: number;
  grupoId?: string;
};

type DeleteContaReceberDialogState = {
  open: boolean;
  contaId?: number;
  grupoId?: string;
};

type DeleteLancamentoDialogState = {
  open: boolean;
  lancamentoId?: number;
};

type DeleteAssinaturaDialogState = {
  open: boolean;
  assinaturaId?: number;
};

function isContaAgrupada(
  value: FinanceiroContaItem | FinanceiroContaAgrupada
): value is FinanceiroContaAgrupada {
  return Array.isArray((value as FinanceiroContaAgrupada).parcelas);
}

function formatCurrency(value: number | string | null | undefined) {
  const numeric = Number(value || 0);
  return numeric.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function FieldLabel({ label, help, required = false }: { label: string; help: string; required?: boolean }) {
  return (
    <span className="financial-field-label">
      {label}{required ? " *" : ""}
      <span
        role="button"
        tabIndex={0}
        className="financial-field-help"
        aria-label={`Ajuda sobre ${label}: ${help}`}
        data-tooltip={help}
        title={help}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <FiInfo size={12} />
      </span>
    </span>
  );
}

function getCurrentMonthInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function resolveValorEmAberto(item: FinanceiroContaItem, tipo: "pagar" | "receber") {
  const valorDireto = Number(item.valor_em_aberto);
  if (Number.isFinite(valorDireto)) {
    return Math.max(valorDireto, 0);
  }

  const valorOriginal = Number(item.valor_original || 0);
  const acumulado =
    tipo === "pagar"
      ? Number(item.valor_pago_acumulado || 0)
      : Number(item.valor_recebido_acumulado || 0);

  return Math.max(valorOriginal - acumulado, 0);
}

function isStatusFinalizado(status?: string | null) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  return normalized === "pago" || normalized === "cancelado";
}

function getStatusBadgeClass(status?: string | null) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (!normalized) return "is-default";
  if (normalized.includes("pago") || normalized.includes("receb")) return "is-paid";
  if (normalized.includes("venc")) return "is-overdue";
  if (normalized.includes("cancel")) return "is-cancelled";
  if (normalized.includes("parcial")) return "is-partial";
  if (normalized.includes("pend")) return "is-pending";
  return "is-default";
}

function openAttachment(url?: string | null) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function buildExportMonthLabel(month: string) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return "todos";
  return month;
}

async function fetchAllFinanceiroContas(
  fetchPage: (payload: {
    status_codigo?: string;
    mes_referencia?: string;
    agrupar_parcelamento?: boolean;
    limit?: number;
    offset?: number;
    conta_financeira_id?: number | null;
    contraparte_id?: number | null;
    empresa_grupo_id?: number | null;
  }) => Promise<Array<FinanceiroContaItem | FinanceiroContaAgrupada>>,
  filters: {
    status_codigo?: string;
    mes_referencia?: string;
    conta_financeira_id?: number | null;
    contraparte_id?: number | null;
    empresa_grupo_id?: number | null;
  }
) {
  const limit = 200;
  const rows: FinanceiroContaItem[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchPage({
      ...filters,
      agrupar_parcelamento: false,
      limit,
      offset,
    });

    const flattenedPage = page.filter(
      (item): item is FinanceiroContaItem => !isContaAgrupada(item)
    );

    rows.push(...flattenedPage);

    if (page.length < limit) {
      break;
    }

    offset += limit;
  }

  return rows;
}

export function FinancialPage() {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [ , setVisitedTabs] = useState<Record<Tab, boolean>>({
    dashboard: true,
    contas_pagar: false,
    contas_receber: false,
    lancamentos: false,
    alertas: false,
    categorias: false,
    estrutura: false,
    comissoes: false,
    assinaturas: false,
  });

  const [dominios, setDominios] = useState<FinanceiroDominio[]>([]);
  const [dashboard, setDashboard] = useState<FinanceiroDashboard | null>(null);
  const [health, setHealth] = useState<FinanceiroHealthcheck | null>(null);

  const [categorias, setCategorias] = useState<FinanceiroCategoria[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<FinanceiroCentroCusto[]>([]);
  const [contasFinanceiras, setContasFinanceiras] = useState<FinanceiroContaFinanceira[]>([]);
  const [contrapartes, setContrapartes] = useState<FinanceiroContraparte[]>([]);
  const [empresasGrupo, setEmpresasGrupo] = useState<FinanceiroEmpresaGrupo[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FinanceiroFormaPagamento[]>([]);
  const [contasPagar, setContasPagar] = useState<
    Array<FinanceiroContaItem | FinanceiroContaAgrupada>
  >([]);
  const [contasReceber, setContasReceber] = useState<
    Array<FinanceiroContaItem | FinanceiroContaAgrupada>
  >([]);
  const [lancamentos, setLancamentos] = useState<FinanceiroLancamento[]>([]);
  const [alertas, setAlertas] = useState<FinanceiroAlerta[]>([]);
  const [assinaturasEmpresa, setAssinaturasEmpresa] = useState<FinanceiroAssinaturaEmpresa[]>([]);
  const [usuarios, setUsuarios] = useState<FinanceiroUsuarioOption[]>([]);
  const [ultimaMetaSalva, setUltimaMetaSalva] = useState<FinanceiroMetaUsuario | null>(null);
  const [ultimaComissaoLancada, setUltimaComissaoLancada] =
    useState<FinanceiroComissaoLancamento | null>(null);
  const [metasMes, setMetasMes] = useState<FinanceiroMetaMesItem[]>([]);
  const [comissoesLancadasMes, setComissoesLancadasMes] = useState<FinanceiroComissaoLancadaMesItem[]>(
    []
  );

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingContasPagar, setLoadingContasPagar] = useState(false);
  const [loadingContasReceber, setLoadingContasReceber] = useState(false);
  const [loadingLancamentos, setLoadingLancamentos] = useState(false);
  const [loadingAlertas, setLoadingAlertas] = useState(false);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [loadingEstruturaOptions, setLoadingEstruturaOptions] = useState(false);
  const [loadingAssinaturas, setLoadingAssinaturas] = useState(false);
  const [, setLoadingUsuarios] = useState(false);
  const [loadingComissoesPainel, setLoadingComissoesPainel] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState({
    contasPagar: false,
    contasReceber: false,
    lancamentos: false,
    alertas: false,
    comissoes: false,
    assinaturas: false,
  });

  const [statusPagar, setStatusPagar] = useState("");
  const [statusReceber, setStatusReceber] = useState("");
  const [mesPagar, setMesPagar] = useState(getCurrentMonthInputValue);
  const [mesReceber, setMesReceber] = useState(getCurrentMonthInputValue);
  const [contaPagarFiltro, setContaPagarFiltro] = useState("");
  const [contrapartePagarFiltro, setContrapartePagarFiltro] = useState("");
  const [empresaPagarFiltro, setEmpresaPagarFiltro] = useState("");
  const [contaReceberFiltro, setContaReceberFiltro] = useState("");
  const [contraparteReceberFiltro, setContraparteReceberFiltro] = useState("");
  const [empresaReceberFiltro, setEmpresaReceberFiltro] = useState("");
  const [statusAlerta, setStatusAlerta] = useState("");
  const [statusAssinatura, setStatusAssinatura] = useState<"" | "ativos" | "inativos">("ativos");
  const [agruparPagar, setAgruparPagar] = useState(false);
  const [agruparReceber, setAgruparReceber] = useState(false);
  const [naturezaLancamento, setNaturezaLancamento] = useState("");
  const [dataInicioLancamento, setDataInicioLancamento] = useState("");
  const [dataFimLancamento, setDataFimLancamento] = useState("");
  const [mesMetasFiltro, setMesMetasFiltro] = useState(getCurrentMonthInputValue);
  const [mesComissoesFiltro, setMesComissoesFiltro] = useState(getCurrentMonthInputValue);
  const [exportOptions, setExportOptions] = useState({
    incluirContasPagar: true,
    incluirContasReceber: true,
    incluirLancamentos: true,
    statusPagar: "",
    contaPagar: "",
    contrapartePagar: "",
    empresaPagar: "",
    statusReceber: "",
    contaReceber: "",
    contraparteReceber: "",
    empresaReceber: "",
    mesPagar: getCurrentMonthInputValue(),
    mesReceber: getCurrentMonthInputValue(),
    naturezaLancamento: "",
    dataInicioLancamento: "",
    dataFimLancamento: "",
  });

  const [assinaturaForm, setAssinaturaForm] = useState({
    id: "",
    nome: "",
    fornecedor: "",
    plano: "",
    valor: "",
    ciclo_cobranca: "mensal",
    dia_vencimento: "",
    proximo_vencimento: "",
    categoriaId: "",
    observacao: "",
    ativo: true,
  });
  const [isAssinaturaModalOpen, setIsAssinaturaModalOpen] = useState(false);

  const [metaForm, setMetaForm] = useState({
    usuarioId: "",
    usuarioNome: "",
    mesReferencia: getCurrentMonthInputValue(),
    valorMeta: "",
    percentualComissao: "",
    valorComissaoFixa: "",
  });
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);

  const [metaUserSuggestionsOpen, setMetaUserSuggestionsOpen] = useState(false);

  const [categoriaForm, setCategoriaForm] = useState({
    nome: "",
    tipo_codigo: "ambos",
  });
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);

  const [contaPagarForm, setContaPagarForm] = useState({
    descricao: "",
    vencimento: "",
    valor: "",
    categoriaId: "",
    centroCustoId: "",
    contaFinanceiraId: "",
    contraparteId: "",
    empresaGrupoId: "",
    competencia: "",
    emissao: "",
    documentoNumero: "",
    observacao: "",
    parcelado: false,
    parcelas: "2",
    periodicidadeMeses: "1",
  });
  const [contaPagarAnexo, setContaPagarAnexo] = useState<File | null>(null);
  const [isContaPagarModalOpen, setIsContaPagarModalOpen] = useState(false);

  const [contaReceberForm, setContaReceberForm] = useState({
    descricao: "",
    vencimento: "",
    valor: "",
    categoriaId: "",
    centroCustoId: "",
    contaFinanceiraId: "",
    contraparteId: "",
    empresaGrupoId: "",
    competencia: "",
    emissao: "",
    documentoNumero: "",
    observacao: "",
    parcelado: false,
    parcelas: "2",
    periodicidadeMeses: "1",
  });
  const [contaReceberAnexo, setContaReceberAnexo] = useState<File | null>(null);
  const [isContaReceberModalOpen, setIsContaReceberModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [paymentDialog, setPaymentDialog] = useState<PaymentDialogState>({
    open: false,
    type: "pagar",
    contaId: null,
    valorEmAberto: null,
    valor: "",
    meio: "",
    formaPagamentoId: "",
    observacao: "",
    file: null,
  });
  const [deleteContaPagarDialog, setDeleteContaPagarDialog] =
    useState<DeleteContaPagarDialogState>({ open: false });
  const [deleteContaReceberDialog, setDeleteContaReceberDialog] =
    useState<DeleteContaReceberDialogState>({ open: false });
  const [deleteLancamentoDialog, setDeleteLancamentoDialog] =
    useState<DeleteLancamentoDialogState>({ open: false });
  const [deleteAssinaturaDialog, setDeleteAssinaturaDialog] =
    useState<DeleteAssinaturaDialogState>({ open: false });

  const contaPagarFileInputRef = useRef<HTMLInputElement | null>(null);
  const contaReceberFileInputRef = useRef<HTMLInputElement | null>(null);
  const paymentFileInputRef = useRef<HTMLInputElement | null>(null);

  const resetContaPagarFormState = () => {
    setContaPagarForm({
      descricao: "",
      vencimento: "",
      valor: "",
      categoriaId: "",
      centroCustoId: "",
      contaFinanceiraId: "",
      contraparteId: "",
      empresaGrupoId: "",
      competencia: "",
      emissao: "",
      documentoNumero: "",
      observacao: "",
      parcelado: false,
      parcelas: "2",
      periodicidadeMeses: "1",
    });
    setContaPagarAnexo(null);
    if (contaPagarFileInputRef.current) {
      contaPagarFileInputRef.current.value = "";
    }
  };

  const closeContaPagarModal = () => {
    setIsContaPagarModalOpen(false);
    resetContaPagarFormState();
  };

  const resetContaReceberFormState = () => {
    setContaReceberForm({
      descricao: "",
      vencimento: "",
      valor: "",
      categoriaId: "",
      centroCustoId: "",
      contaFinanceiraId: "",
      contraparteId: "",
      empresaGrupoId: "",
      competencia: "",
      emissao: "",
      documentoNumero: "",
      observacao: "",
      parcelado: false,
      parcelas: "2",
      periodicidadeMeses: "1",
    });
    setContaReceberAnexo(null);
    if (contaReceberFileInputRef.current) {
      contaReceberFileInputRef.current.value = "";
    }
  };

  const closeContaReceberModal = () => {
    setIsContaReceberModalOpen(false);
    resetContaReceberFormState();
  };

  const resetCategoriaFormState = () => {
    setCategoriaForm({
      nome: "",
      tipo_codigo: dominiosTipoCategoria[0]?.codigo || "ambos",
    });
  };

  const closeCategoriaModal = () => {
    setIsCategoriaModalOpen(false);
    resetCategoriaFormState();
  };

  const resetMetaFormState = () => {
    setMetaForm({
      usuarioId: "",
      usuarioNome: "",
      mesReferencia: getCurrentMonthInputValue(),
      valorMeta: "",
      percentualComissao: "",
      valorComissaoFixa: "",
    });
    setMetaUserSuggestionsOpen(false);
  };

  const closeMetaModal = () => {
    setIsMetaModalOpen(false);
    resetMetaFormState();
  };

  const closeAssinaturaModal = () => {
    setIsAssinaturaModalOpen(false);
    resetAssinaturaForm();
  };

  const dominiosStatusTitulo = useMemo(
    () => dominios.filter((item) => item.dominio === "status_titulo"),
    [dominios]
  );
  const dominiosStatusAlerta = useMemo(
    () => dominios.filter((item) => item.dominio === "alerta_status"),
    [dominios]
  );
  const dominiosNatureza = useMemo(
    () => dominios.filter((item) => item.dominio === "natureza_lancamento"),
    [dominios]
  );
  const dominiosTipoCategoria = useMemo(
    () => dominios.filter((item) => item.dominio === "categoria_tipo"),
    [dominios]
  );

  const ciclosAssinatura = useMemo(
    () => [
      { value: "mensal", label: "Mensal" },
      { value: "bimestral", label: "Bimestral" },
      { value: "trimestral", label: "Trimestral" },
      { value: "semestral", label: "Semestral" },
      { value: "anual", label: "Anual" },
      { value: "outro", label: "Outro" },
    ],
    []
  );

  const metaUserSuggestions = useMemo(() => {
    const term = metaForm.usuarioNome.trim().toLowerCase();
    if (!term) return [];
    return usuarios
      .filter((user) => {
        const name = String(user.name || "").toLowerCase();
        const email = String(user.email || "").toLowerCase();
        return name.includes(term) || email.includes(term);
      })
      .slice(0, 8);
  }, [usuarios, metaForm.usuarioNome]);

  const dashboardResumo = useMemo(() => {
    const dreAtual = dashboard?.dre_mensal?.[0];
    const inad = dashboard?.inadimplencia || {};
    const fluxo = dashboard?.fluxo_30_dias || [];
    const previsao = dashboard?.previsao_crm || [];
    const operacional = dashboard?.resumo_operacional || {};

    const saldoFluxo30Dias = fluxo.reduce(
      (acc, item) => acc + Number(item.saldo_realizado || 0),
      0
    );
    const pipelinePonderado = previsao.reduce(
      (acc, item) => acc + Number(item.valor_ponderado_pipeline || 0),
      0
    );

    return {
      receitaAtual: Number(dreAtual?.receita_bruta || 0),
      despesasAtual: Number(dreAtual?.despesas_totais || 0),
      resultadoAtual: Number(dreAtual?.resultado_operacional || 0),
      mensalidadesAtivas: Number(
        dashboard?.mensalidades_ativas?.mensalidades_ativas_total || 0
      ),
      vencidos: Number(inad.valor_total_vencido || 0),
      titulosVencidos: Number(inad.total_titulos_vencidos || 0),
      saldoFluxo30Dias,
      pipelinePonderado,
      saldoDisponivel: Number(operacional.saldo_disponivel || 0),
      receberMes: Number(operacional.receber_mes || 0),
      pagarMes: Number(operacional.pagar_mes || 0),
      recebidoMes: Number(operacional.recebido_mes || 0),
      pagoMes: Number(operacional.pago_mes || 0),
      resultadoPrevisto: Number(operacional.receber_mes || 0) - Number(operacional.pagar_mes || 0),
    };
  }, [dashboard]);

  const loadBase = useCallback(async () => {
    setLoadingBase(true);
    try {
      const [dom, dash, hc] = await Promise.all([
        getFinanceiroDominios(),
        getFinanceiroDashboard(),
        getFinanceiroHealthcheck(),
      ]);
      setDominios(dom);
      setDashboard(dash);
      setHealth(hc);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os dados iniciais do financeiro.",
      });
    } finally {
      setLoadingBase(false);
    }
  }, [addToast]);

  const loadCategorias = useCallback(async () => {
    setLoadingCategorias(true);
    try {
      const rows = await listFinanceiroCategorias();
      setCategorias(rows);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar categorias.",
      });
    } finally {
      setLoadingCategorias(false);
    }
  }, [addToast]);

  const loadEstruturaOptions = useCallback(async () => {
    setLoadingEstruturaOptions(true);
    try {
      const [centros, contas, pessoas, empresas, formas] = await Promise.all([
        listFinanceiroCentrosCusto(),
        listFinanceiroContasFinanceiras(),
        listFinanceiroContrapartes(),
        listFinanceiroEmpresasGrupo(),
        listFinanceiroFormasPagamento(),
      ]);
      setCentrosCusto(centros.filter((item) => item.ativo !== false));
      setContasFinanceiras(contas.filter((item) => item.ativo !== false));
      setContrapartes(pessoas.filter((item) => item.ativo !== false));
      setEmpresasGrupo(empresas.filter((item) => item.ativo !== false));
      setFormasPagamento(formas.filter((item) => item.ativo !== false));
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a estrutura financeira.",
      });
    } finally {
      setLoadingEstruturaOptions(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadEstruturaOptions();
  }, [loadEstruturaOptions]);

  const openContaPagarModal = () => {
    setIsContaPagarModalOpen(true);
    void loadEstruturaOptions();
  };

  const openContaReceberModal = () => {
    setIsContaReceberModalOpen(true);
    void loadEstruturaOptions();
  };

  const loadContasPagar = useCallback(async () => {
    setLoadingContasPagar(true);
    try {
      const rows = await listFinanceiroContasPagar({
        status_codigo: statusPagar,
        mes_referencia: mesPagar,
        agrupar_parcelamento: agruparPagar,
        conta_financeira_id: contaPagarFiltro ? Number(contaPagarFiltro) : null,
        contraparte_id: contrapartePagarFiltro ? Number(contrapartePagarFiltro) : null,
        empresa_grupo_id: empresaPagarFiltro ? Number(empresaPagarFiltro) : null,
      });
      setContasPagar(rows);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar contas a pagar.",
      });
    } finally {
      setLoadingContasPagar(false);
    }
  }, [addToast, statusPagar, mesPagar, agruparPagar, contaPagarFiltro, contrapartePagarFiltro, empresaPagarFiltro]);

  const loadContasReceber = useCallback(async () => {
    setLoadingContasReceber(true);
    try {
      const rows = await listFinanceiroContasReceber({
        status_codigo: statusReceber,
        mes_referencia: mesReceber,
        agrupar_parcelamento: agruparReceber,
        conta_financeira_id: contaReceberFiltro ? Number(contaReceberFiltro) : null,
        contraparte_id: contraparteReceberFiltro ? Number(contraparteReceberFiltro) : null,
        empresa_grupo_id: empresaReceberFiltro ? Number(empresaReceberFiltro) : null,
      });
      setContasReceber(rows);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar contas a receber.",
      });
    } finally {
      setLoadingContasReceber(false);
    }
  }, [addToast, statusReceber, mesReceber, agruparReceber, contaReceberFiltro, contraparteReceberFiltro, empresaReceberFiltro]);

  const loadLancamentos = useCallback(async () => {
    setLoadingLancamentos(true);
    try {
      const rows = await listFinanceiroLancamentos({
        natureza_codigo: naturezaLancamento,
        data_inicio: dataInicioLancamento || undefined,
        data_fim: dataFimLancamento || undefined,
      });
      setLancamentos(rows);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar lancamentos.",
      });
    } finally {
      setLoadingLancamentos(false);
    }
  }, [addToast, naturezaLancamento, dataInicioLancamento, dataFimLancamento]);

  const loadAlertas = useCallback(async () => {
    setLoadingAlertas(true);
    try {
      const rows = await listFinanceiroAlertas({
        status_codigo: statusAlerta,
      });
      setAlertas(rows);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar alertas.",
      });
    } finally {
      setLoadingAlertas(false);
    }
  }, [addToast, statusAlerta]);

  const loadAssinaturas = useCallback(async () => {
    setLoadingAssinaturas(true);
    try {
      const rows = await listFinanceiroAssinaturasEmpresa({ status: statusAssinatura });
      setAssinaturasEmpresa(rows);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar assinaturas da empresa.",
      });
    } finally {
      setLoadingAssinaturas(false);
    }
  }, [addToast, statusAssinatura]);

  const loadUsuarios = useCallback(async () => {
    setLoadingUsuarios(true);
    try {
      const rows = await listFinanceiroUsuarios();
      setUsuarios(rows);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar usuarios para comissoes.",
      });
    } finally {
      setLoadingUsuarios(false);
    }
  }, [addToast]);

  const loadComissoesPainel = useCallback(async () => {
    setLoadingComissoesPainel(true);
    try {
      const [metas, comissoes] = await Promise.all([
        listFinanceiroMetasMes({ mes_referencia: mesMetasFiltro }),
        listFinanceiroComissoesLancadasMes({ mes_referencia: mesComissoesFiltro }),
      ]);
      setMetasMes(metas);
      setComissoesLancadasMes(comissoes);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar metas e comissões do periodo.",
      });
    } finally {
      setLoadingComissoesPainel(false);
    }
  }, [addToast, mesMetasFiltro, mesComissoesFiltro]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    setVisitedTabs((prev) => (prev[activeTab] ? prev : { ...prev, [activeTab]: true }));

    if (activeTab === "contas_pagar") {
      void loadCategorias();
    }
    if (activeTab === "contas_receber") {
      void loadContasReceber();
      void loadCategorias();
    }
    if (activeTab === "lancamentos") {
      void loadLancamentos();
    }
    if (activeTab === "alertas") {
      void loadAlertas();
    }
    if (activeTab === "categorias") {
      void loadCategorias();
    }
    if (activeTab === "comissoes") {
      if (usuarios.length === 0) {
        void loadUsuarios();
      }
      void loadComissoesPainel();
    }
    if (activeTab === "assinaturas") {
      void loadAssinaturas();
      if (categorias.length === 0) {
        void loadCategorias();
      }
    }
  }, [
    activeTab,
    categorias.length,
    usuarios.length,
    loadAlertas,
    loadAssinaturas,
    loadCategorias,
    loadComissoesPainel,
    loadContasReceber,
    loadLancamentos,
    loadUsuarios,
  ]);

  useEffect(() => {
    if (activeTab !== "contas_pagar") return;
    void loadContasPagar();
  }, [activeTab, loadContasPagar]);

  const handleCreateCategoria = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoriaForm.nome.trim()) {
      addToast({
        type: "warning",
        title: "Atenção",
        description: "Informe o nome da categoria.",
      });
      return;
    }

    setSaving(true);
      try {
        await createFinanceiroCategoria({
          nome: categoriaForm.nome.trim(),
          tipo_codigo: categoriaForm.tipo_codigo,
        });
      resetCategoriaFormState();
        await loadCategorias();
        addToast({
          type: "success",
          title: "Sucesso",
          description: "Categoria criada com sucesso.",
        });
        setIsCategoriaModalOpen(false);
      } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar categoria.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportFinancialReport = useCallback(async () => {
    if (
      !exportOptions.incluirContasPagar &&
      !exportOptions.incluirContasReceber &&
      !exportOptions.incluirLancamentos
    ) {
      addToast({
        type: "warning",
        title: "Atencao",
        description: "Selecione ao menos um conjunto de dados para exportar.",
      });
      return;
    }

    setExportingReport(true);

    try {
      const [pagarRows, receberRows, lancamentoRows] = await Promise.all([
        exportOptions.incluirContasPagar
          ? fetchAllFinanceiroContas(listFinanceiroContasPagar, {
              status_codigo: exportOptions.statusPagar,
              mes_referencia: exportOptions.mesPagar,
              conta_financeira_id: exportOptions.contaPagar ? Number(exportOptions.contaPagar) : null,
              contraparte_id: exportOptions.contrapartePagar ? Number(exportOptions.contrapartePagar) : null,
              empresa_grupo_id: exportOptions.empresaPagar ? Number(exportOptions.empresaPagar) : null,
            })
          : Promise.resolve([]),
        exportOptions.incluirContasReceber
          ? fetchAllFinanceiroContas(listFinanceiroContasReceber, {
              status_codigo: exportOptions.statusReceber,
              mes_referencia: exportOptions.mesReceber,
              conta_financeira_id: exportOptions.contaReceber ? Number(exportOptions.contaReceber) : null,
              contraparte_id: exportOptions.contraparteReceber ? Number(exportOptions.contraparteReceber) : null,
              empresa_grupo_id: exportOptions.empresaReceber ? Number(exportOptions.empresaReceber) : null,
            })
          : Promise.resolve([]),
        exportOptions.incluirLancamentos
          ? listFinanceiroLancamentos({
              natureza_codigo: exportOptions.naturezaLancamento,
              data_inicio: exportOptions.dataInicioLancamento || undefined,
              data_fim: exportOptions.dataFimLancamento || undefined,
              limit: 1000,
              offset: 0,
            })
          : Promise.resolve([]),
      ]);

      const sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }> = [
        {
          name: "Resumo",
          rows: [
            {
              gerado_em: new Date().toLocaleString("pt-BR"),
              incluir_contas_pagar: exportOptions.incluirContasPagar ? "Sim" : "Nao",
              incluir_contas_receber: exportOptions.incluirContasReceber ? "Sim" : "Nao",
              incluir_lancamentos: exportOptions.incluirLancamentos ? "Sim" : "Nao",
              filtro_status_pagar: exportOptions.statusPagar || "Todos",
              filtro_mes_pagar: buildExportMonthLabel(exportOptions.mesPagar),
              filtro_conta_pagar: contasFinanceiras.find((item) => String(item.id) === exportOptions.contaPagar)?.nome || "Todas",
              filtro_fornecedor: contrapartes.find((item) => String(item.id) === exportOptions.contrapartePagar)?.nome || "Todos",
              filtro_empresa_pagar: empresasGrupo.find((item) => String(item.id) === exportOptions.empresaPagar)?.nome || "Todas",
              total_contas_pagar: pagarRows.length,
              filtro_status_receber: exportOptions.statusReceber || "Todos",
              filtro_mes_receber: buildExportMonthLabel(exportOptions.mesReceber),
              filtro_conta_receber: contasFinanceiras.find((item) => String(item.id) === exportOptions.contaReceber)?.nome || "Todas",
              filtro_cliente: contrapartes.find((item) => String(item.id) === exportOptions.contraparteReceber)?.nome || "Todos",
              filtro_empresa_receber: empresasGrupo.find((item) => String(item.id) === exportOptions.empresaReceber)?.nome || "Todas",
              total_contas_receber: receberRows.length,
              filtro_natureza_lancamento: exportOptions.naturezaLancamento || "Todos",
              filtro_data_inicio_lancamento: exportOptions.dataInicioLancamento || "Todas",
              filtro_data_fim_lancamento: exportOptions.dataFimLancamento || "Todas",
              total_lancamentos: lancamentoRows.length,
            },
          ],
        },
      ];

      if (exportOptions.incluirContasPagar) {
        sheets.push({
          name: "Contas a Pagar",
          rows: pagarRows.map((item) => ({
            tipo_relatorio: "conta_pagar",
            valor_em_aberto_calculado: resolveValorEmAberto(item, "pagar"),
            ...item,
          })),
        });
      }

      if (exportOptions.incluirContasReceber) {
        sheets.push({
          name: "Contas a Receber",
          rows: receberRows.map((item) => ({
            tipo_relatorio: "conta_receber",
            valor_em_aberto_calculado: resolveValorEmAberto(item, "receber"),
            ...item,
          })),
        });
      }

      if (exportOptions.incluirLancamentos) {
        sheets.push({
          name: "Lancamentos",
          rows: lancamentoRows.map((item) => ({
            tipo_relatorio: "lancamento",
            ...item,
          })),
        });
      }

      exportFinanceiroWorkbook(
        sheets,
        `relatorio_financeiro_${new Date().toISOString().slice(0, 10)}.xlsx`
      );

      addToast({
        type: "success",
        title: "Sucesso",
        description: "Planilha do financeiro exportada com sucesso.",
      });
      setIsExportModalOpen(false);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Nao foi possivel exportar a planilha.",
      });
    } finally {
      setExportingReport(false);
    }
  }, [addToast, exportOptions, contasFinanceiras, contrapartes, empresasGrupo]);

  const handleCreateContaPagar = async (event: React.FormEvent) => {
    event.preventDefault();
    const valor = Number(contaPagarForm.valor || 0);
    const parcelas = Number(contaPagarForm.parcelas || 1);

    if (!contaPagarForm.descricao.trim() || !contaPagarForm.vencimento || valor <= 0) {
      addToast({
        type: "warning",
        title: "Atenção",
        description: "Preencha descricao, vencimento e valor válido.",
      });
      return;
    }

    if (contaPagarForm.parcelado && parcelas < 2) {
      addToast({
        type: "warning",
        title: "Atenção",
        description: "Para parcelar, informe ao menos 2 parcelas.",
      });
      return;
    }

    setSaving(true);
    try {
      if (contaPagarForm.parcelado) {
        await createFinanceiroContaPagarParcelado({
          descricao: contaPagarForm.descricao.trim(),
          vencimento_inicial: contaPagarForm.vencimento,
          valor_total: valor,
          quantidade_parcelas: parcelas,
          periodicidade_meses: Number(contaPagarForm.periodicidadeMeses || 1),
          categoria_id: contaPagarForm.categoriaId ? Number(contaPagarForm.categoriaId) : null,
          centro_custo_id: contaPagarForm.centroCustoId ? Number(contaPagarForm.centroCustoId) : null,
          conta_financeira_id: contaPagarForm.contaFinanceiraId ? Number(contaPagarForm.contaFinanceiraId) : null,
          contraparte_id: contaPagarForm.contraparteId ? Number(contaPagarForm.contraparteId) : null,
          empresa_grupo_id: contaPagarForm.empresaGrupoId ? Number(contaPagarForm.empresaGrupoId) : null,
          competencia: contaPagarForm.competencia || null,
          emissao: contaPagarForm.emissao || null,
          documento_numero: contaPagarForm.documentoNumero || null,
          observacao: contaPagarForm.observacao || undefined,
          file: contaPagarAnexo,
        });
      } else {
        await createFinanceiroContaPagar({
          descricao: contaPagarForm.descricao.trim(),
          vencimento: contaPagarForm.vencimento,
          valor_original: valor,
          categoria_id: contaPagarForm.categoriaId ? Number(contaPagarForm.categoriaId) : null,
          centro_custo_id: contaPagarForm.centroCustoId ? Number(contaPagarForm.centroCustoId) : null,
          conta_financeira_id: contaPagarForm.contaFinanceiraId ? Number(contaPagarForm.contaFinanceiraId) : null,
          contraparte_id: contaPagarForm.contraparteId ? Number(contaPagarForm.contraparteId) : null,
          empresa_grupo_id: contaPagarForm.empresaGrupoId ? Number(contaPagarForm.empresaGrupoId) : null,
          competencia: contaPagarForm.competencia || null,
          emissao: contaPagarForm.emissao || null,
          documento_numero: contaPagarForm.documentoNumero || null,
          observacao: contaPagarForm.observacao || undefined,
          file: contaPagarAnexo,
        });
      }

      resetContaPagarFormState();
      await Promise.all([loadContasPagar(), loadBase()]);
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Conta a pagar criada com sucesso.",
      });
      setIsContaPagarModalOpen(false);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar conta a pagar.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateContaReceber = async (event: React.FormEvent) => {
    event.preventDefault();
    const valor = Number(contaReceberForm.valor || 0);
    const parcelas = Number(contaReceberForm.parcelas || 1);

    if (!contaReceberForm.descricao.trim() || !contaReceberForm.vencimento || valor <= 0) {
      addToast({
        type: "warning",
        title: "Atenção",
        description: "Preencha descricao, vencimento e valor válido.",
      });
      return;
    }

    if (contaReceberForm.parcelado && parcelas < 2) {
      addToast({
        type: "warning",
        title: "Atenção",
        description: "Para parcelar, informe ao menos 2 parcelas.",
      });
      return;
    }

    setSaving(true);
    try {
      if (contaReceberForm.parcelado) {
        await createFinanceiroContaReceberParcelado({
          descricao: contaReceberForm.descricao.trim(),
          vencimento_inicial: contaReceberForm.vencimento,
          valor_total: valor,
          quantidade_parcelas: parcelas,
          periodicidade_meses: Number(contaReceberForm.periodicidadeMeses || 1),
          categoria_id: contaReceberForm.categoriaId ? Number(contaReceberForm.categoriaId) : null,
          centro_custo_id: contaReceberForm.centroCustoId ? Number(contaReceberForm.centroCustoId) : null,
          conta_financeira_id: contaReceberForm.contaFinanceiraId ? Number(contaReceberForm.contaFinanceiraId) : null,
          contraparte_id: contaReceberForm.contraparteId ? Number(contaReceberForm.contraparteId) : null,
          empresa_grupo_id: contaReceberForm.empresaGrupoId ? Number(contaReceberForm.empresaGrupoId) : null,
          competencia: contaReceberForm.competencia || null,
          emissao: contaReceberForm.emissao || null,
          documento_numero: contaReceberForm.documentoNumero || null,
          observacao: contaReceberForm.observacao || undefined,
          file: contaReceberAnexo,
        });
      } else {
        await createFinanceiroContaReceber({
          descricao: contaReceberForm.descricao.trim(),
          vencimento: contaReceberForm.vencimento,
          valor_original: valor,
          categoria_id: contaReceberForm.categoriaId ? Number(contaReceberForm.categoriaId) : null,
          centro_custo_id: contaReceberForm.centroCustoId ? Number(contaReceberForm.centroCustoId) : null,
          conta_financeira_id: contaReceberForm.contaFinanceiraId ? Number(contaReceberForm.contaFinanceiraId) : null,
          contraparte_id: contaReceberForm.contraparteId ? Number(contaReceberForm.contraparteId) : null,
          empresa_grupo_id: contaReceberForm.empresaGrupoId ? Number(contaReceberForm.empresaGrupoId) : null,
          competencia: contaReceberForm.competencia || null,
          emissao: contaReceberForm.emissao || null,
          documento_numero: contaReceberForm.documentoNumero || null,
          observacao: contaReceberForm.observacao || undefined,
          file: contaReceberAnexo,
        });
      }

        resetContaReceberFormState();
        await Promise.all([loadContasReceber(), loadBase()]);
        addToast({
          type: "success",
          title: "Sucesso",
          description: "Conta a receber criada com sucesso.",
        });
        setIsContaReceberModalOpen(false);
      } catch (error) {
        addToast({
          type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel criar conta a receber.",
      });
    } finally {
      setSaving(false);
    }
  };

  const openPaymentDialog = (
    type: "pagar" | "receber",
    contaId: number,
    valorEmAberto?: number | null
  ) => {
    setPaymentDialog({
      open: true,
      type,
      contaId,
      valorEmAberto: Number.isFinite(Number(valorEmAberto))
        ? Math.max(Number(valorEmAberto), 0)
        : null,
      valor: "",
      meio: "",
      formaPagamentoId: "",
      observacao: "",
      file: null,
    });

    if (paymentFileInputRef.current) {
      paymentFileInputRef.current.value = "";
    }
  };

  const requestDeleteContaPagar = (payload: { contaId?: number; grupoId?: string }) => {
    setDeleteContaPagarDialog({
      open: true,
      contaId: payload.contaId,
      grupoId: payload.grupoId,
    });
  };

  const requestDeleteContaReceber = (payload: { contaId?: number; grupoId?: string }) => {
    setDeleteContaReceberDialog({
      open: true,
      contaId: payload.contaId,
      grupoId: payload.grupoId,
    });
  };

  const requestDeleteLancamento = (lancamentoId: number) => {
    setDeleteLancamentoDialog({ open: true, lancamentoId });
  };

  const requestInativarAssinatura = (assinaturaId: number) => {
    setDeleteAssinaturaDialog({ open: true, assinaturaId });
  };

  const handleSubmitPaymentDialog = async () => {
    const valor = Number(paymentDialog.valor || 0);
    if (!paymentDialog.contaId || valor <= 0) {
      addToast({
        type: "warning",
        title: "Atenção",
        description: "Informe um valor válido para registrar.",
      });
      return;
    }

    setSaving(true);
    try {
      if (paymentDialog.type === "pagar") {
        await registerFinanceiroPagamento({
          conta_pagar_id: paymentDialog.contaId,
          valor,
          meio_pagamento: paymentDialog.meio || undefined,
          forma_pagamento_id: paymentDialog.formaPagamentoId ? Number(paymentDialog.formaPagamentoId) : null,
          observacao: paymentDialog.observacao || undefined,
          file: paymentDialog.file,
        });
        await Promise.all([loadContasPagar(), loadBase()]);
      } else {
        await registerFinanceiroRecebimento({
          conta_receber_id: paymentDialog.contaId,
          valor,
          meio_pagamento: paymentDialog.meio || undefined,
          forma_pagamento_id: paymentDialog.formaPagamentoId ? Number(paymentDialog.formaPagamentoId) : null,
          observacao: paymentDialog.observacao || undefined,
        });
        await Promise.all([loadContasReceber(), loadBase()]);
      }

      const valorAbertoAtual = Number(paymentDialog.valorEmAberto || 0);
      const faltante = Math.max(valorAbertoAtual - valor, 0);
      const parcial = valorAbertoAtual > 0 && valor < valorAbertoAtual;

      setPaymentDialog({
        open: false,
        type: paymentDialog.type,
        contaId: null,
        valorEmAberto: null,
        valor: "",
        meio: "",
        formaPagamentoId: "",
        observacao: "",
        file: null,
      });
      if (paymentFileInputRef.current) {
        paymentFileInputRef.current.value = "";
      }
      addToast({
        type: "success",
        title: "Sucesso",
        description: parcial
          ? paymentDialog.type === "pagar"
            ? `Pagamento parcial registrado. Falta pagar ${formatCurrency(faltante)}.`
            : `Recebimento parcial registrado. Falta receber ${formatCurrency(faltante)}.`
          : paymentDialog.type === "pagar"
          ? "Pagamento registrado com sucesso."
          : "Recebimento registrado com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel registrar operacao.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContaPagar = async (payload: {
    contaId?: number;
    grupoId?: string;
  }) => {
    setSaving(true);
    try {
      const ret = await deleteFinanceiroContaPagar({
        conta_pagar_id: payload.contaId,
        grupo_parcelamento_id: payload.grupoId,
      });
      setDeleteContaPagarDialog({ open: false });
      await Promise.all([loadContasPagar(), loadBase()]);
      addToast({
        type: "success",
        title: "Sucesso",
        description: `Conta(s) a pagar removida(s): ${ret.total_afetados}.`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Nao foi possivel excluir conta a pagar.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContaReceber = async (payload: {
    contaId?: number;
    grupoId?: string;
  }) => {
    setSaving(true);
    try {
      const ret = await deleteFinanceiroContaReceber({
        conta_receber_id: payload.contaId,
        grupo_parcelamento_id: payload.grupoId,
      });
      setDeleteContaReceberDialog({ open: false });
      await Promise.all([loadContasReceber(), loadBase()]);
      addToast({
        type: "success",
        title: "Sucesso",
        description: `Conta(s) a receber removida(s): ${ret.total_afetados}.`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Nao foi possivel excluir conta a receber.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLancamento = async (lancamentoId: number) => {
    setSaving(true);
    try {
      await deleteFinanceiroLancamento(lancamentoId);
      setDeleteLancamentoDialog({ open: false });
      await Promise.all([loadLancamentos(), loadBase()]);
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Lancamento removido com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Nao foi possivel excluir lancamento.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMarcarAlertaLido = async (alertaId: number) => {
    setSaving(true);
    try {
      await markFinanceiroAlertaLido(alertaId);
      await loadAlertas();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Alerta marcado como lido.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel marcar alerta como lido.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectMetaUsuario = (user: FinanceiroUsuarioOption) => {
    setMetaForm((prev) => ({
      ...prev,
      usuarioId: String(user.id),
      usuarioNome: user.name,
    }));
    setMetaUserSuggestionsOpen(false);
  };

  const handleSalvarMeta = async (event: React.FormEvent) => {
    event.preventDefault();

    const usuarioId = Number(metaForm.usuarioId || 0);
    const valorMeta = Number(metaForm.valorMeta || 0);
    const mes = String(metaForm.mesReferencia || "").trim();

    if (!usuarioId || !mes || valorMeta < 0) {
      addToast({
        type: "warning",
        title: "Atencao",
        description: "Selecione um usuario pelo nome, informe mes de referencia e valor de meta valido.",
      });
      return;
    }

    setSaving(true);
    try {
      const referencia = `${mes}-01`;
      const row = await saveFinanceiroMetaUsuario({
        usuario_id: usuarioId,
        mes_referencia: referencia,
        valor_meta: valorMeta,
        percentual_comissao: Number(metaForm.percentualComissao || 0),
        valor_comissao_fixa: Number(metaForm.valorComissaoFixa || 0),
      });
      setUltimaMetaSalva(row);
      if (mesMetasFiltro !== mes) {
        setMesMetasFiltro(mes);
      } else {
        await loadComissoesPainel();
      }
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Meta financeira salva com sucesso.",
      });
      resetMetaFormState();
      setIsMetaModalOpen(false);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Nao foi possivel salvar a meta.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizarMeta = async (item: FinanceiroMetaMesItem) => {
    const mesAtual = getCurrentMonthInputValue();
    if (mesMetasFiltro >= mesAtual) {
      addToast({
        type: "warning",
        title: "Atencao",
        description: "A finalizacao so e permitida para meses ja encerrados.",
      });
      return;
    }

    if (item.possui_comissao_lancada) {
      addToast({
        type: "warning",
        title: "Meta ja finalizada",
        description: "Esta meta ja possui comissão lancada no mes selecionado.",
      });
      return;
    }

    const confirmar = window.confirm(
      `Finalizar meta de ${item.usuario_nome || `Usuario ${item.usuario_id}`} para ${mesMetasFiltro}?`
    );
    if (!confirmar) return;

    setSaving(true);
    try {
      const ret = await finalizeFinanceiroMetaUsuario({
        usuario_id: item.usuario_id,
        mes_referencia: mesMetasFiltro,
      });
      setUltimaComissaoLancada(ret.comissao_lancamento);
      if (mesComissoesFiltro !== mesMetasFiltro) {
        setMesComissoesFiltro(mesMetasFiltro);
      } else {
        await loadComissoesPainel();
      }
      await loadContasPagar();
      addToast({
        type: "success",
        title: "Sucesso",
        description: `Meta finalizada. Conta a pagar criada em ${formatCurrency(
          ret.resumo?.valor_comissao || ret.comissao_lancamento?.valor_comissao || 0
        )}.`,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Nao foi possivel finalizar a meta.",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetAssinaturaForm = () => {
    setAssinaturaForm({
      id: "",
      nome: "",
      fornecedor: "",
      plano: "",
      valor: "",
      ciclo_cobranca: "mensal",
      dia_vencimento: "",
      proximo_vencimento: "",
      categoriaId: "",
      observacao: "",
      ativo: true,
    });
  };

  const handleSalvarAssinatura = async (event: React.FormEvent) => {
    event.preventDefault();

    const nome = assinaturaForm.nome.trim();
    const fornecedor = assinaturaForm.fornecedor.trim();
    const valor = Number(assinaturaForm.valor || 0);

    if (!nome || !fornecedor || Number.isNaN(valor) || valor < 0) {
      addToast({
        type: "warning",
        title: "Atencao",
        description: "Preencha nome, fornecedor e valor valido para a assinatura.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome,
        fornecedor,
        plano: assinaturaForm.plano.trim() || undefined,
        valor,
        ciclo_cobranca: assinaturaForm.ciclo_cobranca,
        dia_vencimento: assinaturaForm.dia_vencimento
          ? Number(assinaturaForm.dia_vencimento)
          : null,
        proximo_vencimento: assinaturaForm.proximo_vencimento || null,
        categoria_id: assinaturaForm.categoriaId ? Number(assinaturaForm.categoriaId) : null,
        observacao: assinaturaForm.observacao.trim() || undefined,
        ativo: assinaturaForm.ativo,
      };

      if (assinaturaForm.id) {
        await updateFinanceiroAssinaturaEmpresa({
          assinatura_id: Number(assinaturaForm.id),
          ...payload,
        });
        addToast({
          type: "success",
          title: "Sucesso",
          description: "Assinatura atualizada com sucesso.",
        });
      } else {
        await createFinanceiroAssinaturaEmpresa(payload);
        addToast({
          type: "success",
          title: "Sucesso",
          description: "Assinatura cadastrada com sucesso.",
        });
      }

      resetAssinaturaForm();
      setIsAssinaturaModalOpen(false);
      await loadAssinaturas();
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar assinatura.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditarAssinatura = (assinatura: FinanceiroAssinaturaEmpresa) => {
    setAssinaturaForm({
      id: String(assinatura.id),
      nome: assinatura.nome || "",
      fornecedor: assinatura.fornecedor || "",
      plano: assinatura.plano || "",
      valor: String(assinatura.valor ?? ""),
      ciclo_cobranca: assinatura.ciclo_cobranca || "mensal",
      dia_vencimento:
        assinatura.dia_vencimento !== null && assinatura.dia_vencimento !== undefined
          ? String(assinatura.dia_vencimento)
          : "",
      proximo_vencimento: assinatura.proximo_vencimento || "",
      categoriaId:
        assinatura.categoria_id !== null && assinatura.categoria_id !== undefined
          ? String(assinatura.categoria_id)
          : "",
      observacao: assinatura.observacao || "",
      ativo: Boolean(assinatura.ativo),
    });
    setIsAssinaturaModalOpen(true);
  };

  const handleInativarAssinatura = async (assinaturaId: number) => {
    setSaving(true);
    try {
      await inativarFinanceiroAssinaturaEmpresa(assinaturaId);
      setDeleteAssinaturaDialog({ open: false });
      if (assinaturaForm.id && Number(assinaturaForm.id) === assinaturaId) {
        resetAssinaturaForm();
      }
      await loadAssinaturas();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Assinatura inativada com sucesso.",
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel inativar assinatura.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="financial-page">
      <MobileHeader title="Financeiro" />

      <div className="financial-page-header">
        <div>
          <h1>Módulo Financeiro</h1>
          <p>Controle de títulos, fluxo e indicadores financeiros.</p>
        </div>
        {/* <button
          className="financial-refresh-btn"
          onClick={() => void loadBase()}
          disabled={loadingBase}
        >
          <FiRefreshCcw size={16} /> Atualizar base
        </button> */}
      </div>

      <nav className="financial-tabs">
        <button
          type="button"
          className={activeTab === "dashboard" ? "active" : ""}
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={activeTab === "contas_pagar" ? "active" : ""}
          onClick={() => setActiveTab("contas_pagar")}
        >
          Contas a Pagar
        </button>
        <button
          type="button"
          className={activeTab === "contas_receber" ? "active" : ""}
          onClick={() => setActiveTab("contas_receber")}
        >
          Contas a Receber
        </button>
        <button
          type="button"
          className={activeTab === "lancamentos" ? "active" : ""}
          onClick={() => setActiveTab("lancamentos")}
        >
          Lançamentos
        </button>
        <button
          type="button"
          className={activeTab === "alertas" ? "active" : ""}
          onClick={() => setActiveTab("alertas")}
        >
          Alertas
        </button>
        <button
          type="button"
          className={activeTab === "categorias" ? "active" : ""}
          onClick={() => setActiveTab("categorias")}
        >
          Categorias
        </button>
        <button
          type="button"
          className={activeTab === "estrutura" ? "active" : ""}
          onClick={() => setActiveTab("estrutura")}
        >
          Estrutura
        </button>
        <button
          type="button"
          className={activeTab === "comissoes" ? "active" : ""}
          onClick={() => setActiveTab("comissoes")}
        >
          Comissões e Metas
        </button>
        <button
          type="button"
          className={activeTab === "assinaturas" ? "active" : ""}
          onClick={() => setActiveTab("assinaturas")}
        >
          Assinaturas
        </button>
      </nav>

      <main className="financial-content">
        {activeTab === "dashboard" && (
          <section className="financial-panel">
            {loadingBase ? (
              <div className="financial-loading">Carregando dashboard financeiro...</div>
            ) : (
              <>
                <div className="financial-panel-header">
                  <h2 className="financial-dashboard-title">Dashboard Financeiro</h2>
                  <button
                    type="button"
                    className="financial-btn-primary"
                    onClick={() => setIsExportModalOpen(true)}
                  >
                    <FiDownload size={14} /> Exportar relatorio
                  </button>
                </div>

                <div className="financial-kpis-grid">
                  <article className="financial-kpi-card">
                    <div className="financial-kpi-icon up">
                      <FiTrendingUp />
                    </div>
                    <div>
                      <span className="financial-kpi-title">
                        Saldo disponível
                        <span
                          className="financial-kpi-info"
                          title="Soma das entradas realizadas no mês corrente."
                          aria-label="Explicação do indicador de receita do mês atual"
                        >
                          <FiInfo size={11} />
                        </span>
                      </span>
                      <strong>{formatCurrency(dashboardResumo.saldoDisponivel)}</strong>
                    </div>
                  </article>
                  <article className="financial-kpi-card">
                    <div className="financial-kpi-icon down">
                      <FiTrendingDown />
                    </div>
                    <div>
                      <span className="financial-kpi-title">
                        A receber este mês
                        <span
                          className="financial-kpi-info"
                          title="Soma das saídas realizadas no mês corrente."
                          aria-label="Explicação do indicador de despesas do mês atual"
                        >
                          <FiInfo size={11} />
                        </span>
                      </span>
                      <strong>{formatCurrency(dashboardResumo.receberMes)}</strong>
                    </div>
                  </article>
                  <article className="financial-kpi-card">
                    <div className="financial-kpi-icon money">
                      <FiDollarSign />
                    </div>
                    <div>
                      <span className="financial-kpi-title">
                        A pagar este mês
                        <span
                          className="financial-kpi-info"
                          title="Receita bruta menos despesas totais no período."
                          aria-label="Explicação do indicador de resultado operacional"
                        >
                          <FiInfo size={11} />
                        </span>
                      </span>
                      <strong>{formatCurrency(dashboardResumo.pagarMes)}</strong>
                    </div>
                  </article>
                  <article className="financial-kpi-card">
                    <div className="financial-kpi-icon chart">
                      <FiBarChart2 />
                    </div>
                    <div>
                      <span className="financial-kpi-title">
                        Resultado previsto
                        <span
                          className="financial-kpi-info"
                          title="Soma mensal equivalente das assinaturas empresariais ativas."
                          aria-label="Explicação do indicador de mensalidades ativas"
                        >
                          <FiInfo size={11} />
                        </span>
                      </span>
                      <strong>{formatCurrency(dashboardResumo.resultadoPrevisto)}</strong>
                    </div>
                  </article>
                  <article className="financial-kpi-card">
                    <div className="financial-kpi-icon warning">
                      <FiAlertTriangle />
                    </div>
                    <div>
                      <span className="financial-kpi-title">
                        Inadimplência (vencidos)
                        <span
                          className="financial-kpi-info"
                          title="Valor total em aberto de títulos com status vencido."
                          aria-label="Explicação do indicador de inadimplência"
                        >
                          <FiInfo size={11} />
                        </span>
                      </span>
                      <strong>{formatCurrency(dashboardResumo.vencidos)}</strong>
                    </div>
                  </article>
                  <article className="financial-kpi-card">
                    <div className="financial-kpi-icon clock">
                      <FiClock />
                    </div>
                    <div>
                      <span className="financial-kpi-title">
                        Recebido no mês
                        <span
                          className="financial-kpi-info"
                          title="Quantidade de títulos a receber com vencimento expirado e ainda não quitados."
                          aria-label="Explicação do indicador de títulos vencidos"
                        >
                          <FiInfo size={11} />
                        </span>
                      </span>
                      <strong>{formatCurrency(dashboardResumo.recebidoMes)}</strong>
                    </div>
                  </article>
                  <article className="financial-kpi-card">
                    <div className="financial-kpi-icon list">
                      <FiList />
                    </div>
                    <div>
                      <span className="financial-kpi-title">
                        Pago no mês
                        <span
                          className="financial-kpi-info"
                          title="Entradas realizadas menos saídas realizadas nos últimos 30 dias."
                          aria-label="Explicação do indicador de saldo realizado"
                        >
                          <FiInfo size={11} />
                        </span>
                      </span>
                      <strong>{formatCurrency(dashboardResumo.pagoMes)}</strong>
                    </div>
                  </article>
                  <article className="financial-kpi-card">
                    <div className="financial-kpi-icon layers">
                      <FiLayers />
                    </div>
                    <div>
                      <span className="financial-kpi-title">
                        Pipeline Ponderado (Funil)
                        <span
                          className="financial-kpi-info"
                          title="Soma do pipeline comercial ajustada pela probabilidade de fechamento."
                          aria-label="Explicação do indicador de pipeline ponderado"
                        >
                          <FiInfo size={11} />
                        </span>
                      </span>
                      <strong>{formatCurrency(dashboardResumo.pipelinePonderado)}</strong>
                    </div>
                  </article>
                </div>

                <div className="financial-summary-boxes">
                  <div className="financial-summary-box financial-chart-card">
                    <div className="financial-chart-header">
                      <h4>
                        <FiList /> Fluxo de caixa realizado e previsto
                      </h4>
                    </div>
                    <div className="financial-chart-wrapper">
                      <div className="financial-compact-table-wrap">
                        <table className="financial-compact-table">
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Saldo Realizado</th>
                              <th>Saldo Projetado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(dashboard?.fluxo_30_dias || [])
                              .slice(-10)
                              .reverse()
                              .map((item, index) => (
                                <tr key={`${item.dia}-${index}`}>
                                  <td>{formatDate(item.dia)}</td>
                                  <td>{formatCurrency(item.saldo_realizado)}</td>
                                  <td>{formatCurrency(item.saldo_projetado)}</td>
                                </tr>
                              ))}
                            {(!dashboard?.fluxo_30_dias ||
                              dashboard.fluxo_30_dias.length === 0) && (
                              <tr>
                                <td colSpan={3} className="financial-compact-table-empty">
                                  Nenhum dado no período.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="financial-summary-box">
                    <h3>Saúde do Módulo</h3>
                    <div className="financial-health-grid">
                      <div>
                        <span>Contas a pagar</span>
                        <strong>{health?.contas_pagar ?? 0}</strong>
                      </div>
                      <div>
                        <span>Contas a receber</span>
                        <strong>{health?.contas_receber ?? 0}</strong>
                      </div>
                      <div>
                        <span>Lançamentos</span>
                        <strong>{health?.lancamentos ?? 0}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="financial-summary-box">
                    <h3>Próximos 7 dias</h3>
                    <div className="financial-upcoming-list">
                      {(dashboard?.proximos_vencimentos || []).map((item) => (
                        <div key={`${item.tipo}-${item.id}`}>
                          <span><strong>{formatDate(item.vencimento)}</strong>{item.descricao}</span>
                          <b className={item.tipo === "receber" ? "is-incoming" : "is-outgoing"}>
                            {item.tipo === "receber" ? "+ " : "- "}{formatCurrency(item.valor)}
                          </b>
                        </div>
                      ))}
                      {(dashboard?.proximos_vencimentos || []).length === 0 && <p>Nenhum vencimento nos próximos dias.</p>}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "contas_pagar" && (
          <section className="financial-panel">
            <div className="financial-panel-header">
              <h2 className="financial-mobile-section-title">Contas a Pagar</h2>
              <div className="financial-filter-row">
                <button
                  type="button"
                  className={`financial-btn-secondary financial-mobile-filter-trigger ${
                    mobileFiltersOpen.contasPagar ? "is-active" : ""
                  }`}
                  onClick={() =>
                    setMobileFiltersOpen((prev) => ({
                      ...prev,
                      contasPagar: !prev.contasPagar,
                    }))
                  }
                  aria-expanded={mobileFiltersOpen.contasPagar}
                >
                  <FiFilter size={14} /> Filtros
                </button>
                <div
                  className={`financial-filter-fields ${
                    mobileFiltersOpen.contasPagar ? "is-mobile-open" : ""
                  }`}
                >
                  <label className="financial-filter-control">
                    <span className="financial-filter-label-title">
                      <FiFilter size={14} /> Status
                    </span>
                    <select value={statusPagar} onChange={(e) => setStatusPagar(e.target.value)}>
                      <option value="">Todos</option>
                      {dominiosStatusTitulo.map((item) => (
                        <option key={item.id} value={item.codigo}>
                          {item.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="financial-filter-control">
                    <span className="financial-filter-label-title">Mes</span>
                    <input
                      type="month"
                      value={mesPagar}
                      onChange={(e) =>
                        setMesPagar(e.target.value || getCurrentMonthInputValue())
                      }
                    />
                  </label>
                  <label className="financial-filter-control"><span className="financial-filter-label-title">Conta</span><select value={contaPagarFiltro} onChange={(e) => setContaPagarFiltro(e.target.value)}><option value="">Todas</option>{contasFinanceiras.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
                  <label className="financial-filter-control"><span className="financial-filter-label-title">Fornecedor</span><select value={contrapartePagarFiltro} onChange={(e) => setContrapartePagarFiltro(e.target.value)}><option value="">Todos</option>{contrapartes.filter((item) => item.tipo !== "cliente").map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
                  <label className="financial-filter-control"><span className="financial-filter-label-title">Empresa</span><select value={empresaPagarFiltro} onChange={(e) => setEmpresaPagarFiltro(e.target.value)}><option value="">Todas</option>{empresasGrupo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
                  <label
                    className={`toggle-label financial-toggle-filter ${
                      agruparPagar ? "is-active" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={agruparPagar}
                      onChange={(e) => setAgruparPagar(e.target.checked)}
                    />
                    Agrupar parcelamento
                  </label>
                </div>
                <button
                  type="button"
                  className="financial-btn-primary financial-mobile-primary-action"
                  onClick={openContaPagarModal}
                >
                  <FiPlus size={14} /> Nova conta
                </button>
              </div>
            </div>

            <div className="financial-table-wrap financial-payables-card-table">
              {loadingContasPagar ? (
                <div className="financial-loading">Carregando contas a pagar...</div>
              ) : contasPagar.length === 0 ? (
                <div className="financial-empty">Nenhum título encontrado.</div>
              ) : (
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Conta</th>
                      <th>Vencimento</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Parcela</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contasPagar.map((item, index) => {
                      if (isContaAgrupada(item)) {
                        const parcelaParaRegistrar = item.parcelas.find((parcela) => {
                          const valorEmAberto = Number(parcela.valor_em_aberto || 0);
                          return !isStatusFinalizado(parcela.status_codigo) && valorEmAberto > 0;
                        });
                        const parcelaReferencia =
                          parcelaParaRegistrar ||
                          item.parcelas.find(
                            (parcela) =>
                              Boolean(parcela.anexo_url) ||
                              Boolean(parcela.ultimo_pagamento_anexo_url)
                          ) ||
                          item.parcelas[0];

                        return (
                          <tr key={`${item.grupo_parcelamento_id}-${index}`}>
                            <td>
                              <strong>{item.descricao}</strong>
                              <p>{item.total_parcelas} parcela(s)</p>
                            </td>
                            <td>
                              {formatDate(item.primeiro_vencimento)} até {formatDate(item.ultimo_vencimento)}
                            </td>
                            <td>
                              <strong>{formatCurrency(item.valor_total)}</strong>
                              <p>
                                Em aberto:{" "}
                                {formatCurrency(Number(item.valor_em_aberto_total || 0))}
                              </p>
                            </td>
                            <td>
                              <span
                                className={`financial-status-badge ${
                                  parcelaParaRegistrar
                                    ? getStatusBadgeClass(parcelaParaRegistrar.status_codigo)
                                    : "is-paid"
                                }`}
                              >
                                {parcelaParaRegistrar
                                  ? parcelaParaRegistrar.status_nome ||
                                    parcelaParaRegistrar.status_codigo ||
                                    "Pendente"
                                  : "Pago"}
                              </span>
                            </td>
                            <td>Grupo</td>
                            <td>
                              <div className="financial-inline-actions">
                                {parcelaParaRegistrar ? (
                                  <button
                                    type="button"
                                    className="financial-icon-action action-primary"
                                    title="Registrar próxima parcela"
                                    aria-label="Registrar próxima parcela"
                                    onClick={() =>
                                      openPaymentDialog(
                                        "pagar",
                                        Number(parcelaParaRegistrar.id),
                                        Number(parcelaParaRegistrar.valor_em_aberto || 0)
                                      )
                                    }
                                  >
                                    <FiCheckCircle size={16} />
                                  </button>
                                ) : (
                                  <span className="financial-status-badge is-paid">Pago</span>
                                )}
                                {parcelaReferencia?.anexo_url ? (
                                  <button
                                    type="button"
                                    className="financial-icon-action action-neutral"
                                    title="Abrir anexo de criação"
                                    aria-label="Abrir anexo de criação"
                                    onClick={() => openAttachment(parcelaReferencia.anexo_url)}
                                  >
                                    <FiFileText size={16} />
                                  </button>
                                ) : null}
                                {parcelaReferencia?.ultimo_pagamento_anexo_url ? (
                                  <button
                                    type="button"
                                    className="financial-icon-action action-attachment"
                                    title="Abrir anexo de pagamento"
                                    aria-label="Abrir anexo de pagamento"
                                    onClick={() =>
                                      openAttachment(parcelaReferencia.ultimo_pagamento_anexo_url)
                                    }
                                  >
                                    <FiInfo size={16} />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="financial-icon-action action-danger"
                                  title="Excluir grupo"
                                  aria-label="Excluir grupo"
                                  onClick={() =>
                                      requestDeleteContaPagar({
                                        grupoId: item.grupo_parcelamento_id,
                                      })
                                  }
                                  disabled={saving}
                                >
                                  <FiTrash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const valorEmAbertoPagar = resolveValorEmAberto(item, "pagar");
                      const podeRegistrarPagamento =
                        !isStatusFinalizado(item.status_codigo) && valorEmAbertoPagar > 0;

                      return (
                        <tr key={item.id}>
                          <td>{item.descricao}</td>
                          <td>{formatDate(item.vencimento)}</td>
                          <td>
                            <strong>{formatCurrency(item.valor_original)}</strong>
                            <p>Em aberto: {formatCurrency(resolveValorEmAberto(item, "pagar"))}</p>
                            {Number(item.valor_pago_acumulado || 0) > 0 && <p>Bruto pago: {formatCurrency(item.valor_pago_acumulado)} · Líquido: {formatCurrency(item.valor_liquido_acumulado)}</p>}
                          </td>
                          <td>
                            <span
                              className={`financial-status-badge ${getStatusBadgeClass(
                                item.status_codigo || item.status_nome
                              )}`}
                            >
                              {item.status_nome || item.status_codigo || "-"}
                            </span>
                          </td>
                          <td>
                            {item.parcela_numero && item.parcela_total
                              ? `${item.parcela_numero}/${item.parcela_total}`
                              : "-"}
                          </td>
                          <td>
                            <div className="financial-inline-actions">
                              {podeRegistrarPagamento ? (
                                <button
                                  type="button"
                                  className="financial-icon-action action-primary"
                                  title="Registrar pagamento"
                                  aria-label="Registrar pagamento"
                                  onClick={() =>
                                    openPaymentDialog("pagar", item.id, valorEmAbertoPagar)
                                  }
                                >
                                  <FiCheckCircle size={16} />
                                </button>
                              ) : null}
                              {item.anexo_url ? (
                                <button
                                  type="button"
                                  className="financial-icon-action action-neutral"
                                  title="Abrir anexo de criação"
                                  aria-label="Abrir anexo de criação"
                                  onClick={() => openAttachment(item.anexo_url)}
                                >
                                  <FiFileText size={16} />
                                </button>
                              ) : null}
                              {item.ultimo_pagamento_anexo_url ? (
                                <button
                                  type="button"
                                  className="financial-icon-action action-attachment"
                                  title="Abrir anexo de pagamento"
                                  aria-label="Abrir anexo de pagamento"
                                  onClick={() => openAttachment(item.ultimo_pagamento_anexo_url)}
                                >
                                  <FiInfo size={16} />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="financial-icon-action action-danger"
                                title="Excluir"
                                aria-label="Excluir"
                                onClick={() => requestDeleteContaPagar({ contaId: item.id })}
                                disabled={saving}
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {activeTab === "contas_receber" && (
          <section className="financial-panel">
            <div className="financial-panel-header">
              <h2 className="financial-mobile-section-title">Contas a Receber</h2>
              <div className="financial-filter-row">
                <button
                  type="button"
                  className={`financial-btn-secondary financial-mobile-filter-trigger ${
                    mobileFiltersOpen.contasReceber ? "is-active" : ""
                  }`}
                  onClick={() =>
                    setMobileFiltersOpen((prev) => ({
                      ...prev,
                      contasReceber: !prev.contasReceber,
                    }))
                  }
                  aria-expanded={mobileFiltersOpen.contasReceber}
                >
                  <FiFilter size={14} /> Filtros
                </button>
                <div
                  className={`financial-filter-fields ${
                    mobileFiltersOpen.contasReceber ? "is-mobile-open" : ""
                  }`}
                >
                  <label className="financial-filter-control">
                    <span className="financial-filter-label-title">
                      <FiFilter size={14} /> Status
                    </span>
                    <select value={statusReceber} onChange={(e) => setStatusReceber(e.target.value)}>
                      <option value="">Todos</option>
                      {dominiosStatusTitulo.map((item) => (
                        <option key={item.id} value={item.codigo}>
                          {item.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="financial-filter-control">
                    <span className="financial-filter-label-title">Mes</span>
                    <input
                      type="month"
                      value={mesReceber}
                      onChange={(e) =>
                        setMesReceber(e.target.value || getCurrentMonthInputValue())
                      }
                    />
                  </label>
                  <label className="financial-filter-control"><span className="financial-filter-label-title">Conta</span><select value={contaReceberFiltro} onChange={(e) => setContaReceberFiltro(e.target.value)}><option value="">Todas</option>{contasFinanceiras.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
                  <label className="financial-filter-control"><span className="financial-filter-label-title">Cliente</span><select value={contraparteReceberFiltro} onChange={(e) => setContraparteReceberFiltro(e.target.value)}><option value="">Todos</option>{contrapartes.filter((item) => item.tipo !== "fornecedor").map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
                  <label className="financial-filter-control"><span className="financial-filter-label-title">Empresa</span><select value={empresaReceberFiltro} onChange={(e) => setEmpresaReceberFiltro(e.target.value)}><option value="">Todas</option>{empresasGrupo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
                  <label
                    className={`toggle-label financial-toggle-filter ${
                      agruparReceber ? "is-active" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={agruparReceber}
                      onChange={(e) => setAgruparReceber(e.target.checked)}
                    />
                    Agrupar parcelamento
                  </label>
                </div>
                <button
                  type="button"
                  className="financial-btn-primary financial-mobile-primary-action"
                  onClick={openContaReceberModal}
                >
                  <FiPlus size={14} /> Nova conta
                </button>
              </div>
            </div>

            <div className="financial-table-wrap financial-payables-card-table financial-receivables-card-table">
              {loadingContasReceber ? (
                <div className="financial-loading">Carregando contas a receber...</div>
              ) : contasReceber.length === 0 ? (
                <div className="financial-empty">Nenhum título encontrado.</div>
              ) : (
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Vencimento</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th>Parcela</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contasReceber.map((item, index) => {
                      if (isContaAgrupada(item)) {
                        const parcelaParaRegistrar = item.parcelas.find((parcela) => {
                          const valorEmAberto = Number(parcela.valor_em_aberto || 0);
                          return !isStatusFinalizado(parcela.status_codigo) && valorEmAberto > 0;
                        });
                        const parcelaReferencia =
                          parcelaParaRegistrar ||
                          item.parcelas.find((parcela) => Boolean(parcela.anexo_url)) ||
                          item.parcelas[0];

                        return (
                          <tr key={`${item.grupo_parcelamento_id}-${index}`}>
                            <td>
                              <strong>{item.descricao}</strong>
                              <p>{item.total_parcelas} parcela(s)</p>
                            </td>
                            <td>
                              {formatDate(item.primeiro_vencimento)} até {formatDate(item.ultimo_vencimento)}
                            </td>
                            <td>
                              <strong>{formatCurrency(item.valor_total)}</strong>
                              <p>
                                Em aberto:{" "}
                                {formatCurrency(Number(item.valor_em_aberto_total || 0))}
                              </p>
                            </td>
                            <td>
                              <span
                                className={`financial-status-badge ${
                                  parcelaParaRegistrar
                                    ? getStatusBadgeClass(parcelaParaRegistrar.status_codigo)
                                    : "is-paid"
                                }`}
                              >
                                {parcelaParaRegistrar
                                  ? parcelaParaRegistrar.status_nome ||
                                    parcelaParaRegistrar.status_codigo ||
                                    "Pendente"
                                  : "Recebido"}
                              </span>
                            </td>
                            <td>Grupo</td>
                            <td>
                              <div className="financial-inline-actions">
                                {parcelaParaRegistrar ? (
                                  <button
                                    type="button"
                                    className="financial-icon-action action-primary"
                                    title="Registrar próxima parcela"
                                    aria-label="Registrar próxima parcela"
                                    onClick={() =>
                                      openPaymentDialog(
                                        "receber",
                                        Number(parcelaParaRegistrar.id),
                                        Number(parcelaParaRegistrar.valor_em_aberto || 0)
                                      )
                                    }
                                  >
                                    <FiCheckCircle size={16} />
                                  </button>
                                ) : (
                                  <span className="financial-status-badge is-paid">Recebido</span>
                                )}
                                {parcelaReferencia?.anexo_url ? (
                                  <button
                                    type="button"
                                    className="financial-icon-action action-neutral"
                                    title="Abrir anexo de criação"
                                    aria-label="Abrir anexo de criação"
                                    onClick={() => openAttachment(parcelaReferencia.anexo_url)}
                                  >
                                    <FiFileText size={16} />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="financial-icon-action action-danger"
                                  title="Excluir grupo"
                                  aria-label="Excluir grupo"
                                  onClick={() =>
                                    requestDeleteContaReceber({
                                      grupoId: item.grupo_parcelamento_id,
                                    })
                                  }
                                  disabled={saving}
                                >
                                  <FiTrash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const valorEmAbertoReceber = resolveValorEmAberto(item, "receber");
                      const podeRegistrarRecebimento =
                        !isStatusFinalizado(item.status_codigo) && valorEmAbertoReceber > 0;

                      return (
                        <tr key={item.id}>
                          <td>{item.descricao}</td>
                          <td>{formatDate(item.vencimento)}</td>
                          <td>
                            <strong>{formatCurrency(item.valor_original)}</strong>
                            <p>Em aberto: {formatCurrency(valorEmAbertoReceber)}</p>
                            {Number(item.valor_recebido_acumulado || 0) > 0 && <p>Bruto recebido: {formatCurrency(item.valor_recebido_acumulado)} · Líquido: {formatCurrency(item.valor_liquido_acumulado)}</p>}
                          </td>
                          <td>
                            <span
                              className={`financial-status-badge ${getStatusBadgeClass(
                                item.status_codigo || item.status_nome
                              )}`}
                            >
                              {item.status_nome || item.status_codigo || "-"}
                            </span>
                          </td>
                          <td>
                            {item.parcela_numero && item.parcela_total
                              ? `${item.parcela_numero}/${item.parcela_total}`
                              : "-"}
                          </td>
                          <td>
                            <div className="financial-inline-actions">
                              {podeRegistrarRecebimento ? (
                                <button
                                  type="button"
                                  className="financial-icon-action action-primary"
                                  title="Registrar recebimento"
                                  aria-label="Registrar recebimento"
                                  onClick={() =>
                                    openPaymentDialog("receber", item.id, valorEmAbertoReceber)
                                  }
                                >
                                  <FiCheckCircle size={16} />
                                </button>
                              ) : null}
                              {item.anexo_url ? (
                                <button
                                  type="button"
                                  className="financial-icon-action action-neutral"
                                  title="Abrir anexo de criação"
                                  aria-label="Abrir anexo de criação"
                                  onClick={() => openAttachment(item.anexo_url)}
                                >
                                  <FiFileText size={16} />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="financial-icon-action action-danger"
                                title="Excluir"
                                aria-label="Excluir"
                                onClick={() => requestDeleteContaReceber({ contaId: item.id })}
                                disabled={saving}
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {activeTab === "lancamentos" && (
          <section className="financial-panel">
            <div className="financial-panel-header">
              <h2 className="financial-mobile-section-title">Lançamentos Financeiros</h2>
              <div className="financial-filter-row">
                <button
                  type="button"
                  className={`financial-btn-secondary financial-mobile-filter-trigger ${
                    mobileFiltersOpen.lancamentos ? "is-active" : ""
                  }`}
                  onClick={() =>
                    setMobileFiltersOpen((prev) => ({
                      ...prev,
                      lancamentos: !prev.lancamentos,
                    }))
                  }
                  aria-expanded={mobileFiltersOpen.lancamentos}
                >
                  <FiFilter size={14} /> Filtros
                </button>
                <div
                  className={`financial-filter-fields ${
                    mobileFiltersOpen.lancamentos ? "is-mobile-open" : ""
                  }`}
                >
                <label>
                  Natureza
                  <select
                    value={naturezaLancamento}
                    onChange={(e) => setNaturezaLancamento(e.target.value)}
                  >
                    <option value="">Todas</option>
                    {dominiosNatureza.map((item) => (
                      <option key={item.id} value={item.codigo}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  De
                  <input
                    type="date"
                    value={dataInicioLancamento}
                    onChange={(e) => setDataInicioLancamento(e.target.value)}
                  />
                </label>
                <label>
                  Até
                  <input
                    type="date"
                    value={dataFimLancamento}
                    onChange={(e) => setDataFimLancamento(e.target.value)}
                  />
                </label>
                </div>
              </div>
            </div>

            {lancamentos.some((item) => item.transferencia_id) && <div className="financial-ledger-transfer-info"><FiInfo /> Transferências aparecem em dois movimentos vinculados: saída da conta de origem e entrada na conta de destino.</div>}
            <div className="financial-table-wrap financial-payables-card-table financial-ledger-card-table">
              {loadingLancamentos ? (
                <div className="financial-loading">Carregando lançamentos...</div>
              ) : lancamentos.length === 0 ? (
                <div className="financial-empty">Nenhum lançamento encontrado.</div>
              ) : (
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th>Natureza</th>
                      <th>Status</th>
                      <th>Origem</th>
                      <th>Categoria</th>
                      <th>Valor</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDateTime(item.data_lancamento)}</td>
                        <td>{item.transferencia_id ? <><strong>Transferência #{item.transferencia_id}</strong><p>{item.transferencia_conta_origem_nome} → {item.transferencia_conta_destino_nome}</p>{item.transferencia_observacao && <p>{item.transferencia_observacao}</p>}{item.transferencia_anexo_url && <a className="financial-transfer-receipt-link" href={item.transferencia_anexo_url} target="_blank" rel="noopener noreferrer"><FiFileText size={14} /> {item.transferencia_anexo_nome_arquivo || "Abrir comprovante"}</a>}</> : item.descricao}</td>
                        <td>{item.conta_financeira_nome || "-"}</td>
                        <td>{item.natureza_codigo}</td>
                        <td>
                          <span
                            className={`financial-status-badge ${getStatusBadgeClass(
                              item.status_codigo
                            )}`}
                          >
                            {item.status_codigo || "-"}
                          </span>
                        </td>
                        <td>{item.transferencia_id ? `transferência · ${item.transferencia_movimento}` : item.origem_codigo}</td>
                        <td>{item.categoria_nome || "-"}</td>
                        <td>{formatCurrency(item.valor)}</td>
                        <td>
                          {item.transferencia_id ? <span className="financial-status-badge">Automático</span> : <button
                            type="button"
                            className="financial-icon-action action-danger"
                            title="Excluir lançamento"
                            aria-label="Excluir lançamento"
                            onClick={() => requestDeleteLancamento(item.id)}
                            disabled={saving}
                          >
                            <FiTrash2 size={16} />
                          </button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {activeTab === "alertas" && (
          <section className="financial-panel">
            <div className="financial-panel-header">
              <h2 className="financial-mobile-section-title">Alertas Financeiros</h2>
              <div className="financial-filter-row">
                <button
                  type="button"
                  className={`financial-btn-secondary financial-mobile-filter-trigger ${
                    mobileFiltersOpen.alertas ? "is-active" : ""
                  }`}
                  onClick={() =>
                    setMobileFiltersOpen((prev) => ({
                      ...prev,
                      alertas: !prev.alertas,
                    }))
                  }
                  aria-expanded={mobileFiltersOpen.alertas}
                >
                  <FiFilter size={14} /> Filtros
                </button>
                <div
                  className={`financial-filter-fields ${
                    mobileFiltersOpen.alertas ? "is-mobile-open" : ""
                  }`}
                >
                  <label className="financial-filter-control">
                    <span>Status</span>
                    <select value={statusAlerta} onChange={(e) => setStatusAlerta(e.target.value)}>
                      <option value="">Todos</option>
                      {dominiosStatusAlerta.map((item) => (
                        <option key={item.id} value={item.codigo}>
                          {item.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="financial-btn-secondary financial-mobile-primary-action"
                  onClick={() => void loadAlertas()}
                  disabled={loadingAlertas}
                >
                  Atualizar
                </button>
              </div>
            </div>

            <div className="financial-alerts-grid">
              {loadingAlertas ? (
                <div className="financial-loading">Carregando alertas...</div>
              ) : alertas.length === 0 ? (
                <div className="financial-empty">Nenhum alerta encontrado.</div>
              ) : (
                alertas.map((alerta) => (
                  <article key={alerta.id} className="financial-alert-card">
                    <div className="financial-alert-header">
                      <h4>{alerta.titulo}</h4>
                      <span className={`alert-badge ${alerta.status_codigo || "novo"}`}>
                        {alerta.status_codigo || "novo"}
                      </span>
                    </div>
                    <p>{alerta.descricao || "Sem descrição."}</p>
                    <div className="financial-alert-meta">
                      <span>Tipo: {alerta.tipo_codigo}</span>
                      <span>{formatDateTime(alerta.data_alerta)}</span>
                    </div>
                    <button
                      type="button"
                      className="financial-alert-action"
                      onClick={() => void handleMarcarAlertaLido(alerta.id)}
                      disabled={saving || alerta.status_codigo === "lido"}
                    >
                      <FiCheckCircle size={14} /> Marcar como lido
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === "estrutura" && <FinancialStructurePanel />}

        {activeTab === "categorias" && (
          <section className="financial-panel">
            <div className="financial-panel-header">
              <h2 className="financial-mobile-section-title">Categorias Financeiras</h2>
              <button
                type="button"
                className="financial-btn-primary"
                onClick={() => setIsCategoriaModalOpen(true)}
              >
                <FiPlus size={14} /> Nova categoria
              </button>
            </div>

            <div className="financial-table-wrap financial-payables-card-table financial-categories-card-table">
              {loadingCategorias ? (
                <div className="financial-loading">Carregando categorias...</div>
              ) : categorias.length === 0 ? (
                <div className="financial-empty">Nenhuma categoria cadastrada.</div>
              ) : (
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Tipo</th>
                      <th>Ativo</th>
                      <th>Criada em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorias.map((item) => (
                      <tr key={item.id}>
                        <td>{item.nome}</td>
                        <td>{item.tipo_nome || item.tipo_codigo || "-"}</td>
                        <td>
                          <span
                            className={`financial-status-badge ${
                              item.ativo ? "is-paid" : "is-cancelled"
                            }`}
                          >
                            {item.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td>{formatDate((item as FinanceiroCategoria & { created_at?: string }).created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {activeTab === "comissoes" && (
          <section className="financial-panel">
            <div className="financial-panel-header">
              <h2 className="financial-mobile-section-title">Metas e Comissões</h2>
              <div className="financial-filter-row">
                <button
                  type="button"
                  className={`financial-btn-secondary financial-mobile-filter-trigger ${
                    mobileFiltersOpen.comissoes ? "is-active" : ""
                  }`}
                  onClick={() =>
                    setMobileFiltersOpen((prev) => ({
                      ...prev,
                      comissoes: !prev.comissoes,
                    }))
                  }
                  aria-expanded={mobileFiltersOpen.comissoes}
                >
                  <FiFilter size={14} /> Filtros
                </button>
                <div
                  className={`financial-filter-fields ${
                    mobileFiltersOpen.comissoes ? "is-mobile-open" : ""
                  }`}
                >
                  <label className="financial-filter-control">
                    <span>Mês das metas</span>
                    <input
                      type="month"
                      value={mesMetasFiltro}
                      onChange={(e) =>
                        setMesMetasFiltro(e.target.value || getCurrentMonthInputValue())
                      }
                    />
                  </label>
                  <label className="financial-filter-control">
                    <span>Mês das comissões</span>
                    <input
                      type="month"
                      value={mesComissoesFiltro}
                      onChange={(e) =>
                        setMesComissoesFiltro(e.target.value || getCurrentMonthInputValue())
                      }
                    />
                  </label>
                </div>
                {/* <button
                  type="button"
                  className="financial-btn-secondary financial-mobile-primary-action"
                  onClick={() => void loadUsuarios()}
                  disabled={loadingUsuarios}
                >
                  {loadingUsuarios ? "Carregando usuarios..." : "Atualizar usuarios"}
                </button> */}
                <button
                  type="button"
                  className="financial-btn-primary financial-mobile-primary-action"
                  onClick={() => setIsMetaModalOpen(true)}
                >
                  <FiPlus size={14} /> Nova meta
                </button>
              </div>
            </div>

            <div className="financial-form financial-info-card">
              <h3>
                <FiCheckCircle size={16} /> Finalização de meta
              </h3>
              <p>
                A comissão e a conta a pagar agora sao geradas automaticamente ao finalizar a meta
                do usuario na tabela abaixo.
              </p>
              <p>
                Regra: apenas metas de meses encerrados podem ser finalizadas. O valor da comissão e
                calculado por:
                {" "}
                <strong>(Realizado de negócios ganhos no funil x % comissão) + comissão fixa</strong>.
              </p>
            </div>

            <div className="financial-summary-boxes">
              <div className="financial-summary-box">
                <h3>Ultima meta salva</h3>
                {ultimaMetaSalva ? (
                  <div className="financial-health-grid">
                    <div>
                      <span>Usuario</span>
                      <strong>{ultimaMetaSalva.usuario_id}</strong>
                    </div>
                    <div>
                      <span>Mes ref.</span>
                      <strong>{formatDate(ultimaMetaSalva.mes_referencia)}</strong>
                    </div>
                    <div>
                      <span>Meta</span>
                      <strong>{formatCurrency(ultimaMetaSalva.valor_meta)}</strong>
                    </div>
                  </div>
                ) : (
                  <p>Nenhuma meta salva nesta sessão.</p>
                )}
              </div>
              <div className="financial-summary-box">
                <h3>Ultima comissão lancada</h3>
                {ultimaComissaoLancada ? (
                  <div className="financial-health-grid">
                    <div>
                      <span>Usuario</span>
                      <strong>{ultimaComissaoLancada.usuario_id}</strong>
                    </div>
                    <div>
                      <span>Base</span>
                      <strong>{formatCurrency(ultimaComissaoLancada.base_calculo)}</strong>
                    </div>
                    <div>
                      <span>comissão</span>
                      <strong>{formatCurrency(ultimaComissaoLancada.valor_comissao)}</strong>
                    </div>
                  </div>
                ) : (
                  <p>Nenhuma comissão lancada nesta sessão.</p>
                )}
              </div>
            </div>

            <div className="financial-table-wrap">
              <h3 className="financial-table-section-title">
                Metas do mes ({mesMetasFiltro}) com realizado de negócios ganhos no funil
              </h3>
              {loadingComissoesPainel ? (
                <div className="financial-loading">Carregando metas do mes...</div>
              ) : metasMes.length === 0 ? (
                <div className="financial-empty">Nenhuma meta encontrada para este mes.</div>
              ) : (
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Meta</th>
                      <th>Realizado do funil (ganho)</th>
                      <th>Atingimento</th>
                      <th>Faltante</th>
                      <th>% comissão</th>
                      <th>Comissão fixa</th>
                      <th>Finalização</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metasMes.map((item) => (
                      <tr key={`meta-mes-${item.id}`}>
                        <td>{item.usuario_nome || `Usuario ${item.usuario_id}`}</td>
                        <td>{formatCurrency(item.valor_meta)}</td>
                        <td>{formatCurrency(item.valor_realizado_crm || 0)}</td>
                        <td>{Number(item.percentual_atingimento || 0).toFixed(2)}%</td>
                        <td>{formatCurrency(item.valor_faltante_meta || 0)}</td>
                        <td>{Number(item.percentual_comissao || 0).toFixed(4)}%</td>
                        <td>{formatCurrency(item.valor_comissao_fixa || 0)}</td>
                        <td>
                          <span
                            className={`financial-status-badge ${
                              item.possui_comissao_lancada ? "is-paid" : "is-pending"
                            }`}
                          >
                            {item.possui_comissao_lancada ? "Finalizada" : "Pendente"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={
                              item.possui_comissao_lancada ||
                              mesMetasFiltro >= getCurrentMonthInputValue()
                                ? "action-neutral"
                                : "action-primary"
                            }
                            disabled={
                              saving ||
                              item.possui_comissao_lancada ||
                              mesMetasFiltro >= getCurrentMonthInputValue()
                            }
                            onClick={() => void handleFinalizarMeta(item)}
                          >
                            {item.possui_comissao_lancada
                              ? "Finalizada"
                              : mesMetasFiltro >= getCurrentMonthInputValue()
                                ? "Mes em aberto"
                                : "Finalizar meta"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="financial-table-wrap">
              <h3 className="financial-table-section-title">
                Comissoes lancadas no mes ({mesComissoesFiltro})
              </h3>
              {loadingComissoesPainel ? (
                <div className="financial-loading">Carregando comissoes do mes...</div>
              ) : comissoesLancadasMes.length === 0 ? (
                <div className="financial-empty">Nenhuma comissão encontrada para este mes.</div>
              ) : (
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Usuario</th>
                      <th>Base</th>
                      <th>% aplicado</th>
                      <th>Valor comissão</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comissoesLancadasMes.map((item) => (
                      <tr key={`comissao-mes-${item.id}`}>
                        <td>{String(item.competencia || "").slice(0, 7) || "-"}</td>
                        <td>{item.usuario_nome || `Usuario ${item.usuario_id}`}</td>
                        <td>{formatCurrency(item.base_calculo)}</td>
                        <td>{Number(item.percentual_aplicado || 0).toFixed(4)}%</td>
                        <td>{formatCurrency(item.valor_comissao)}</td>
                        <td>
                          <span
                            className={`financial-status-badge ${getStatusBadgeClass(
                              item.status_codigo || item.status_nome
                            )}`}
                          >
                            {item.status_nome || item.status_codigo || "-"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {activeTab === "assinaturas" && (
          <section className="financial-panel">
            <div className="financial-panel-header">
              <h2 className="financial-mobile-section-title">Assinaturas da Empresa</h2>
              <div className="financial-filter-row">
                <button
                  type="button"
                  className={`financial-btn-secondary financial-mobile-filter-trigger ${
                    mobileFiltersOpen.assinaturas ? "is-active" : ""
                  }`}
                  onClick={() =>
                    setMobileFiltersOpen((prev) => ({
                      ...prev,
                      assinaturas: !prev.assinaturas,
                    }))
                  }
                  aria-expanded={mobileFiltersOpen.assinaturas}
                >
                  <FiFilter size={14} /> Filtros
                </button>
                <div
                  className={`financial-filter-fields ${
                    mobileFiltersOpen.assinaturas ? "is-mobile-open" : ""
                  }`}
                >
                  <label className="financial-filter-control">
                    <span>Status</span>
                    <select
                      value={statusAssinatura}
                      onChange={(e) =>
                        setStatusAssinatura(e.target.value as "" | "ativos" | "inativos")
                      }
                    >
                      <option value="ativos">Ativos</option>
                      <option value="inativos">Inativos</option>
                      <option value="">Todos</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="financial-btn-primary financial-mobile-primary-action"
                  onClick={() => setIsAssinaturaModalOpen(true)}
                >
                  <FiPlus size={14} /> Nova assinatura
                </button>
              </div>
            </div>

            <div className="financial-table-wrap financial-payables-card-table financial-subscriptions-card-table">
              {loadingAssinaturas ? (
                <div className="financial-loading">Carregando assinaturas...</div>
              ) : assinaturasEmpresa.length === 0 ? (
                <div className="financial-empty">Nenhuma assinatura encontrada.</div>
              ) : (
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Serviço</th>
                      <th>Fornecedor / Plano</th>
                      <th>Ciclo</th>
                      <th>Status</th>
                      <th>Valor</th>
                      <th>Dia Venc.</th>
                      <th>Prox. Venc.</th>
                      <th>Categoria</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assinaturasEmpresa.map((item) => (
                      <tr key={item.id}>
                        <td>{item.nome}</td>
                        <td>
                          <strong>{item.fornecedor}</strong>
                          <p>{item.plano || "Sem plano especificado"}</p>
                        </td>
                        <td>{item.ciclo_cobranca}</td>
                        <td>
                          <span
                            className={`financial-status-badge ${
                              item.ativo ? "is-paid" : "is-cancelled"
                            }`}
                          >
                            {item.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td>{formatCurrency(item.valor)}</td>
                        <td>{item.dia_vencimento ?? "-"}</td>
                        <td>{formatDate(item.proximo_vencimento)}</td>
                        <td>{item.categoria_nome || "-"}</td>
                        <td>
                          <div className="financial-inline-actions">
                            <button
                              type="button"
                              className="financial-icon-action action-neutral"
                              title="Editar assinatura"
                              aria-label="Editar assinatura"
                              onClick={() => handleEditarAssinatura(item)}
                              disabled={saving}
                            >
                              <FiEdit2 size={16} />
                            </button>
                            {item.ativo && (
                              <button
                                type="button"
                                className="financial-icon-action action-danger"
                                title="Inativar assinatura"
                                aria-label="Inativar assinatura"
                                onClick={() => requestInativarAssinatura(item.id)}
                                disabled={saving}
                              >
                                <FiPower size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </main>

      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Exportar relatorio financeiro"
        size="lg"
      >
        <div className="financial-dialog-content financial-export-modal">
          <p className="financial-dialog-highlight">
            A exportação vem completa por padrão. Desmarque apenas o que não quiser incluir.
          </p>

          <div className="financial-export-grid">
            <div className="financial-export-card">
              <label
                className={`toggle-label financial-toggle-filter ${
                  exportOptions.incluirContasPagar ? "is-active" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={exportOptions.incluirContasPagar}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      incluirContasPagar: e.target.checked,
                    }))
                  }
                />
                Incluir contas a pagar
              </label>

              <label className="financial-form-field financial-export-field">
                <span>Mes de referencia</span>
                <input
                  type="month"
                  value={exportOptions.mesPagar}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      mesPagar: e.target.value || getCurrentMonthInputValue(),
                    }))
                  }
                  disabled={!exportOptions.incluirContasPagar}
                />
              </label>

              <label className="financial-form-field financial-export-field">
                <span>Status</span>
                <select
                  value={exportOptions.statusPagar}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      statusPagar: e.target.value,
                    }))
                  }
                  disabled={!exportOptions.incluirContasPagar}
                >
                  <option value="">Todos</option>
                  {dominiosStatusTitulo.map((item) => (
                    <option key={`export-pagar-${item.id}`} value={item.codigo}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="financial-form-field financial-export-field"><span>Conta/banco</span><select value={exportOptions.contaPagar} onChange={(e) => setExportOptions((prev) => ({ ...prev, contaPagar: e.target.value }))}><option value="">Todos</option>{contasFinanceiras.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
              <label className="financial-form-field financial-export-field"><span>Fornecedor</span><select value={exportOptions.contrapartePagar} onChange={(e) => setExportOptions((prev) => ({ ...prev, contrapartePagar: e.target.value }))}><option value="">Todos</option>{contrapartes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
              <label className="financial-form-field financial-export-field"><span>Empresa</span><select value={exportOptions.empresaPagar} onChange={(e) => setExportOptions((prev) => ({ ...prev, empresaPagar: e.target.value }))}><option value="">Todas</option>{empresasGrupo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            </div>

            <div className="financial-export-card">
              <label
                className={`toggle-label financial-toggle-filter ${
                  exportOptions.incluirContasReceber ? "is-active" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={exportOptions.incluirContasReceber}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      incluirContasReceber: e.target.checked,
                    }))
                  }
                />
                Incluir contas a receber
              </label>

              <label className="financial-form-field financial-export-field">
                <span>Mes de referencia</span>
                <input
                  type="month"
                  value={exportOptions.mesReceber}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      mesReceber: e.target.value || getCurrentMonthInputValue(),
                    }))
                  }
                  disabled={!exportOptions.incluirContasReceber}
                />
              </label>

              <label className="financial-form-field financial-export-field">
                <span>Status</span>
                <select
                  value={exportOptions.statusReceber}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      statusReceber: e.target.value,
                    }))
                  }
                  disabled={!exportOptions.incluirContasReceber}
                >
                  <option value="">Todos</option>
                  {dominiosStatusTitulo.map((item) => (
                    <option key={`export-receber-${item.id}`} value={item.codigo}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="financial-form-field financial-export-field"><span>Conta/banco</span><select value={exportOptions.contaReceber} onChange={(e) => setExportOptions((prev) => ({ ...prev, contaReceber: e.target.value }))}><option value="">Todos</option>{contasFinanceiras.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
              <label className="financial-form-field financial-export-field"><span>Cliente/fornecedor</span><select value={exportOptions.contraparteReceber} onChange={(e) => setExportOptions((prev) => ({ ...prev, contraparteReceber: e.target.value }))}><option value="">Todos</option>{contrapartes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
              <label className="financial-form-field financial-export-field"><span>Empresa</span><select value={exportOptions.empresaReceber} onChange={(e) => setExportOptions((prev) => ({ ...prev, empresaReceber: e.target.value }))}><option value="">Todas</option>{empresasGrupo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            </div>

            <div className="financial-export-card">
              <label
                className={`toggle-label financial-toggle-filter ${
                  exportOptions.incluirLancamentos ? "is-active" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={exportOptions.incluirLancamentos}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      incluirLancamentos: e.target.checked,
                    }))
                  }
                />
                Incluir lancamentos
              </label>

              <label className="financial-form-field financial-export-field">
                <span>Natureza</span>
                <select
                  value={exportOptions.naturezaLancamento}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      naturezaLancamento: e.target.value,
                    }))
                  }
                  disabled={!exportOptions.incluirLancamentos}
                >
                  <option value="">Todos</option>
                  {dominiosNatureza.map((item) => (
                    <option key={`export-lancamento-${item.id}`} value={item.codigo}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="financial-form-field financial-export-field">
                <span>Data inicial</span>
                <input
                  type="date"
                  value={exportOptions.dataInicioLancamento}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      dataInicioLancamento: e.target.value,
                    }))
                  }
                  disabled={!exportOptions.incluirLancamentos}
                />
              </label>

              <label className="financial-form-field financial-export-field">
                <span>Data final</span>
                <input
                  type="date"
                  value={exportOptions.dataFimLancamento}
                  onChange={(e) =>
                    setExportOptions((prev) => ({
                      ...prev,
                      dataFimLancamento: e.target.value,
                    }))
                  }
                  disabled={!exportOptions.incluirLancamentos}
                />
              </label>
            </div>
          </div>

          <div className="financial-dialog-actions">
            <button
              type="button"
              className="financial-btn-secondary"
              onClick={() => setIsExportModalOpen(false)}
              disabled={exportingReport}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="financial-btn-primary"
              onClick={() => void handleExportFinancialReport()}
              disabled={exportingReport}
            >
              <FiDownload size={14} />
              {exportingReport ? "Exportando..." : "Exportar planilha"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteContaPagarDialog.open}
        onClose={() => setDeleteContaPagarDialog({ open: false })}
        title="Excluir conta a pagar"
      >
        <div className="financial-dialog-content">
          <p>
            {deleteContaPagarDialog.grupoId
              ? "Deseja excluir (inativar) todas as parcelas deste grupo?"
              : "Deseja excluir (inativar) esta conta a pagar?"}
          </p>
          <div className="financial-dialog-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setDeleteContaPagarDialog({ open: false })}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="danger"
              onClick={() =>
                void handleDeleteContaPagar({
                  contaId: deleteContaPagarDialog.contaId,
                  grupoId: deleteContaPagarDialog.grupoId,
                })
              }
              disabled={saving}
            >
              {saving ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteContaReceberDialog.open}
        onClose={() => setDeleteContaReceberDialog({ open: false })}
        title="Excluir conta a receber"
      >
        <div className="financial-dialog-content">
          <p>
            {deleteContaReceberDialog.grupoId
              ? "Deseja excluir (inativar) todas as parcelas deste grupo?"
              : "Deseja excluir (inativar) esta conta a receber?"}
          </p>
          <div className="financial-dialog-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setDeleteContaReceberDialog({ open: false })}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="danger"
              onClick={() =>
                void handleDeleteContaReceber({
                  contaId: deleteContaReceberDialog.contaId,
                  grupoId: deleteContaReceberDialog.grupoId,
                })
              }
              disabled={saving}
            >
              {saving ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteLancamentoDialog.open}
        onClose={() => setDeleteLancamentoDialog({ open: false })}
        title="Excluir lançamento"
      >
        <div className="financial-dialog-content">
          <p>Deseja excluir (inativar) este lançamento?</p>
          <div className="financial-dialog-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setDeleteLancamentoDialog({ open: false })}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="danger"
              onClick={() =>
                deleteLancamentoDialog.lancamentoId
                  ? void handleDeleteLancamento(deleteLancamentoDialog.lancamentoId)
                  : undefined
              }
              disabled={saving}
            >
              {saving ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteAssinaturaDialog.open}
        onClose={() => setDeleteAssinaturaDialog({ open: false })}
        title="Inativar assinatura"
      >
        <div className="financial-dialog-content">
          <p>Deseja inativar esta assinatura?</p>
          <div className="financial-dialog-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => setDeleteAssinaturaDialog({ open: false })}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="danger"
              onClick={() =>
                deleteAssinaturaDialog.assinaturaId
                  ? void handleInativarAssinatura(deleteAssinaturaDialog.assinaturaId)
                  : undefined
              }
              disabled={saving}
            >
              {saving ? "Inativando..." : "Inativar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isContaPagarModalOpen}
        onClose={closeContaPagarModal}
        title="Nova conta a pagar"
        size="lg"
      >
        <form className="financial-form financial-form-modal" onSubmit={handleCreateContaPagar}>
          <p className="financial-modal-intro">Registre a obrigação e defina quando ela pertence ao financeiro e quando deverá ser paga.</p>
          <div className="financial-form-grid">
            <h3 className="financial-form-section-title">Dados principais</h3>
            <label className="financial-form-field financial-field-wide"><FieldLabel label="Descrição" required help="Diga de forma simples o que será pago. Exemplo: mensalidade do servidor AWS." /><input required placeholder="Ex.: Servidor AWS" value={contaPagarForm.descricao} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, descricao: e.target.value }))} /></label>
            <label className="financial-form-field"><FieldLabel label="Valor total" required help="É o valor completo da despesa. Se parcelar, o sistema dividirá esse total entre as parcelas." /><input required type="number" step="0.01" min="0.01" placeholder="R$ 0,00" value={contaPagarForm.valor} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, valor: e.target.value }))} /></label>
            <label className="financial-form-field"><FieldLabel label="Vencimento" required help="É o último dia para pagar sem ficar em atraso." /><input required type="date" value={contaPagarForm.vencimento} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, vencimento: e.target.value }))} /><small>Data limite para efetuar o pagamento.</small></label>
            <h3 className="financial-form-section-title">Vínculos da estrutura</h3>
            <label className="financial-form-field">
              <FieldLabel label="Conta de saída" help="Escolha o banco, carteira ou caixa de onde este pagamento deverá sair." />
              <select disabled={loadingEstruturaOptions} value={contaPagarForm.contaFinanceiraId} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, contaFinanceiraId: e.target.value }))}>
                <option value="">{loadingEstruturaOptions ? "Carregando contas..." : "Não vincular uma conta"}</option>
                {contasFinanceiras.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.banco ? ` - ${item.banco}` : ""}</option>)}
              </select>
            </label>
            <label className="financial-form-field">
              <FieldLabel label="Centro de custo" help="Indique qual área, projeto ou unidade será responsável por esta despesa." />
              <select disabled={loadingEstruturaOptions} value={contaPagarForm.centroCustoId} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, centroCustoId: e.target.value }))}>
                <option value="">{loadingEstruturaOptions ? "Carregando centros..." : "Não vincular um centro"}</option>
                {centrosCusto.map((item) => <option key={item.id} value={item.id}>{item.codigo ? `${item.codigo} - ` : ""}{item.nome}</option>)}
              </select>
            </label>
            <label className="financial-form-field">
              <FieldLabel label="Fornecedor ou favorecido" help="Selecione a pessoa ou empresa que receberá este pagamento." />
              <select disabled={loadingEstruturaOptions} value={contaPagarForm.contraparteId} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, contraparteId: e.target.value }))}>
                <option value="">{loadingEstruturaOptions ? "Carregando pessoas..." : "Não vincular uma pessoa"}</option>
                {contrapartes.map((item) => <option key={item.id} value={item.id}>{item.nome} - {item.tipo}</option>)}
              </select>
            </label>
            <label className="financial-form-field">
              <span>Empresa do grupo (opcional)</span>
              <select disabled={loadingEstruturaOptions} value={contaPagarForm.empresaGrupoId} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, empresaGrupoId: e.target.value }))}>
                <option value="">Não vincular empresa</option>
                {empresasGrupo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            {!loadingEstruturaOptions && contasFinanceiras.length === 0 && centrosCusto.length === 0 && contrapartes.length === 0 && (
              <p className="financial-structure-form-note financial-field-wide"><FiInfo /> Nenhuma opção encontrada. Você pode salvar sem vínculos ou cadastrar contas, centros e pessoas na aba Estrutura.</p>
            )}
            <h3 className="financial-form-section-title">Classificação e datas</h3>
            <label className="financial-form-field"><FieldLabel label="Categoria" help="Serve para organizar despesas semelhantes. Exemplos: Marketing, Servidores, Impostos ou Salários." /><select value={contaPagarForm.categoriaId} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, categoriaId: e.target.value }))}>
              <option value="">Categoria (opcional)</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select></label>
            <label className="financial-form-field"><FieldLabel label="Emissão" help="É o dia em que o boleto, nota fiscal ou cobrança foi criado pelo fornecedor." /><input type="date" value={contaPagarForm.emissao} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, emissao: e.target.value }))} /><small>Quando boleto, nota ou cobrança foi emitido.</small></label>
            <label className="financial-form-field"><FieldLabel label="Competência" help="Indica a qual mês a despesa pertence, mesmo que seja paga em outro mês. Exemplo: conta de agosto paga em setembro." /><input type="date" value={contaPagarForm.competencia} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, competencia: e.target.value }))} /><small>Mês ao qual a despesa pertence na análise gerencial.</small></label>
            <label className="financial-form-field"><FieldLabel label="Número do documento" help="É o código usado para identificar a nota fiscal, boleto, fatura ou contrato." /><input placeholder="Nota fiscal, boleto ou contrato" value={contaPagarForm.documentoNumero} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, documentoNumero: e.target.value }))} /></label>
            <label className="financial-form-field financial-field-wide"><FieldLabel label="Observação" help="Use para registrar qualquer detalhe importante que não cabe nos outros campos." /><input placeholder="Informações adicionais" value={contaPagarForm.observacao} onChange={(e) => setContaPagarForm((prev) => ({ ...prev, observacao: e.target.value }))} /></label>
            <label className="financial-form-field">
              <FieldLabel label="Anexo" help="Adicione o boleto, nota fiscal, contrato ou outro arquivo que comprove esta despesa." />
              <input
                ref={contaPagarFileInputRef}
                type="file"
                onChange={(e) => setContaPagarAnexo(e.target.files?.[0] || null)}
              />
              <small>Anexe comprovante, boleto ou documento de suporte.</small>
            </label>
            <label className="toggle-label inline-toggle">
              <input
                type="checkbox"
                checked={contaPagarForm.parcelado}
                onChange={(e) =>
                  setContaPagarForm((prev) => ({
                    ...prev,
                    parcelado: e.target.checked,
                  }))
                }
              />
              <FieldLabel label="Criar parcelado" help="Ative quando o valor total será pago em duas ou mais parcelas." />
            </label>
          </div>
          {contaPagarForm.parcelado && (
            <div className="financial-form-grid secondary">
              <label className="financial-form-field" htmlFor="conta-pagar-parcelas">
                <FieldLabel label="Quantidade de parcelas" help="Informe em quantas partes o valor total será dividido. Exemplo: 12 para doze parcelas." />
                <input
                  id="conta-pagar-parcelas"
                  type="number"
                  min="2"
                  value={contaPagarForm.parcelas}
                  onChange={(e) =>
                    setContaPagarForm((prev) => ({
                      ...prev,
                      parcelas: e.target.value,
                    }))
                  }
                  placeholder="Ex.: 2"
                />
                <small>Numero total de parcelas que serao geradas.</small>
              </label>
              <label className="financial-form-field" htmlFor="conta-pagar-periodicidade">
                <FieldLabel label="Periodicidade (meses)" help="É o intervalo entre parcelas. Use 1 para mensal, 2 para a cada dois meses e 3 para trimestral." />
                <input
                  id="conta-pagar-periodicidade"
                  type="number"
                  min="1"
                  value={contaPagarForm.periodicidadeMeses}
                  onChange={(e) =>
                    setContaPagarForm((prev) => ({
                      ...prev,
                      periodicidadeMeses: e.target.value,
                    }))
                  }
                  placeholder="Ex.: 1"
                />
                <small>1 = mensal, 2 = bimestral, 3 = trimestral.</small>
              </label>
            </div>
          )}
          <div className="financial-form-actions">
            <button type="button" className="financial-btn-secondary" onClick={closeContaPagarModal}>
              Cancelar
            </button>
            <button type="submit" className="financial-btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isCategoriaModalOpen}
        onClose={closeCategoriaModal}
        title="Nova categoria"
        size="lg"
      >
        <form className="financial-form financial-form-modal" onSubmit={handleCreateCategoria}>
          <div className="financial-form-grid">
            <input
              placeholder="Nome da categoria"
              value={categoriaForm.nome}
              onChange={(e) =>
                setCategoriaForm((prev) => ({ ...prev, nome: e.target.value }))
              }
            />
            <select
              value={categoriaForm.tipo_codigo}
              onChange={(e) =>
                setCategoriaForm((prev) => ({
                  ...prev,
                  tipo_codigo: e.target.value,
                }))
              }
            >
              {dominiosTipoCategoria.map((item) => (
                <option key={item.id} value={item.codigo}>
                  {item.nome}
                </option>
              ))}
              {dominiosTipoCategoria.length === 0 && <option value="ambos">Ambos</option>}
            </select>
          </div>
          <div className="financial-form-actions">
            <button type="button" className="financial-btn-secondary" onClick={closeCategoriaModal}>
              Cancelar
            </button>
            <button type="submit" className="financial-btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar categoria"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isAssinaturaModalOpen}
        onClose={closeAssinaturaModal}
        title={assinaturaForm.id ? "Editar assinatura empresarial" : "Nova assinatura empresarial"}
        size="lg"
      >
        <form className="financial-form financial-form-modal" onSubmit={handleSalvarAssinatura}>
          <div className="financial-form-grid">
            <label className="financial-form-field">
              <span>Nome da assinatura</span>
              <input
                placeholder="Ex.: Office 365"
                value={assinaturaForm.nome}
                onChange={(e) =>
                  setAssinaturaForm((prev) => ({
                    ...prev,
                    nome: e.target.value,
                  }))
                }
              />
            </label>
            <label className="financial-form-field">
              <span>Fornecedor</span>
              <input
                placeholder="Ex.: Microsoft"
                value={assinaturaForm.fornecedor}
                onChange={(e) =>
                  setAssinaturaForm((prev) => ({
                    ...prev,
                    fornecedor: e.target.value,
                  }))
                }
              />
            </label>
            <label className="financial-form-field">
              <span>Plano</span>
              <input
                placeholder="Opcional"
                value={assinaturaForm.plano}
                onChange={(e) =>
                  setAssinaturaForm((prev) => ({
                    ...prev,
                    plano: e.target.value,
                  }))
                }
              />
            </label>
            <label className="financial-form-field">
              <span>Valor</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={assinaturaForm.valor}
                onChange={(e) =>
                  setAssinaturaForm((prev) => ({
                    ...prev,
                    valor: e.target.value,
                  }))
                }
              />
            </label>
            <label className="financial-form-field">
              <span>Ciclo de cobranca</span>
              <select
                value={assinaturaForm.ciclo_cobranca}
                onChange={(e) =>
                  setAssinaturaForm((prev) => ({
                    ...prev,
                    ciclo_cobranca: e.target.value,
                  }))
                }
              >
                {ciclosAssinatura.map((ciclo) => (
                  <option key={ciclo.value} value={ciclo.value}>
                    {ciclo.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="financial-form-field">
              <span>Dia de vencimento</span>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="Opcional"
                value={assinaturaForm.dia_vencimento}
                onChange={(e) =>
                  setAssinaturaForm((prev) => ({
                    ...prev,
                    dia_vencimento: e.target.value,
                  }))
                }
              />
            </label>
            <label className="financial-form-field">
              <span>Proximo vencimento</span>
              <input
                type="date"
                value={assinaturaForm.proximo_vencimento}
                onChange={(e) =>
                  setAssinaturaForm((prev) => ({
                    ...prev,
                    proximo_vencimento: e.target.value,
                  }))
                }
              />
            </label>
            <label className="financial-form-field">
              <span>Categoria financeira</span>
              <select
                value={assinaturaForm.categoriaId}
                onChange={(e) =>
                  setAssinaturaForm((prev) => ({
                    ...prev,
                    categoriaId: e.target.value,
                  }))
                }
              >
                <option value="">Opcional</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="financial-form-field">
              <span>Observacao</span>
              <input
                placeholder="Opcional"
                value={assinaturaForm.observacao}
                onChange={(e) =>
                  setAssinaturaForm((prev) => ({
                    ...prev,
                    observacao: e.target.value,
                  }))
                }
              />
            </label>
            <label className="toggle-label inline-toggle">
              <input
                type="checkbox"
                checked={assinaturaForm.ativo}
                onChange={(e) =>
                  setAssinaturaForm((prev) => ({
                    ...prev,
                    ativo: e.target.checked,
                  }))
                }
              />
              Assinatura ativa
            </label>
          </div>
          <div className="financial-form-actions">
            <button type="button" className="financial-btn-secondary" onClick={closeAssinaturaModal}>
              {assinaturaForm.id ? "Cancelar edicao" : "Cancelar"}
            </button>
            <button type="submit" className="financial-btn-primary" disabled={saving}>
              {saving
                ? "Salvando..."
                : assinaturaForm.id
                  ? "Atualizar assinatura"
                  : "Salvar assinatura"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isMetaModalOpen}
        onClose={closeMetaModal}
        title="Salvar meta por usuario"
        size="lg"
      >
        <form className="financial-form financial-form-modal" onSubmit={handleSalvarMeta}>
          <div className="financial-form-grid">
            <label className="financial-form-field financial-user-search">
              <span>Usuario (busca por nome)</span>
              <input
                type="text"
                placeholder="Digite o nome do usuario"
                value={metaForm.usuarioNome}
                onFocus={() => setMetaUserSuggestionsOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setMetaUserSuggestionsOpen(false), 150);
                }}
                onChange={(e) =>
                  setMetaForm((prev) => ({
                    ...prev,
                    usuarioNome: e.target.value,
                    usuarioId: "",
                  }))
                }
              />
              {metaForm.usuarioId ? (
                <small>
                  Selecionado: {metaForm.usuarioNome} (ID {metaForm.usuarioId})
                </small>
              ) : (
                <small>Selecione o usuario na lista para vincular o ID.</small>
              )}
              {metaUserSuggestionsOpen && metaForm.usuarioNome.trim() && (
                <ul className="financial-user-suggestions">
                  {metaUserSuggestions.length > 0 ? (
                    metaUserSuggestions.map((user) => (
                      <li
                        key={`meta-user-${user.id}`}
                        onMouseDown={() => handleSelectMetaUsuario(user)}
                      >
                        <strong>{user.name}</strong>
                        <span>
                          ID {user.id}
                          {user.email ? ` - ${user.email}` : ""}
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="empty">Nenhum usuario encontrado.</li>
                  )}
                </ul>
              )}
            </label>
            <label className="financial-form-field">
              <span>Mes de referencia</span>
              <input
                type="month"
                value={metaForm.mesReferencia}
                onChange={(e) =>
                  setMetaForm((prev) => ({
                    ...prev,
                    mesReferencia: e.target.value,
                  }))
                }
              />
              <small>A meta sera comparada com os negocios ganhos no funil deste mes.</small>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Valor meta"
              value={metaForm.valorMeta}
              onChange={(e) =>
                setMetaForm((prev) => ({
                  ...prev,
                  valorMeta: e.target.value,
                }))
              }
            />
            <input
              type="number"
              step="0.0001"
              min="0"
              placeholder="% comissão"
              value={metaForm.percentualComissao}
              onChange={(e) =>
                setMetaForm((prev) => ({
                  ...prev,
                  percentualComissao: e.target.value,
                }))
              }
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Comissão fixa"
              value={metaForm.valorComissaoFixa}
              onChange={(e) =>
                setMetaForm((prev) => ({
                  ...prev,
                  valorComissaoFixa: e.target.value,
                }))
              }
            />
          </div>
          <div className="financial-form-actions">
            <button type="button" className="financial-btn-secondary" onClick={closeMetaModal}>
              Cancelar
            </button>
            <button type="submit" className="financial-btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar meta"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={isContaReceberModalOpen}
        onClose={closeContaReceberModal}
        title="Nova conta a receber"
        size="lg"
      >
        <form className="financial-form financial-form-modal" onSubmit={handleCreateContaReceber}>
          <p className="financial-modal-intro">Registre a cobrança do cliente e defina sua competência, emissão e vencimento.</p>
          <div className="financial-form-grid">
            <h3 className="financial-form-section-title">Dados principais</h3>
            <label className="financial-form-field financial-field-wide"><FieldLabel label="Descrição" required help="Diga de forma simples o que será recebido. Exemplo: mensalidade do cliente XPTO." /><input required placeholder="Ex.: Mensalidade cliente XPTO" value={contaReceberForm.descricao} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, descricao: e.target.value }))} /></label>
            <label className="financial-form-field"><FieldLabel label="Valor total" required help="É o valor completo que o cliente deve pagar. Se parcelar, o sistema dividirá esse total entre as parcelas." /><input required type="number" step="0.01" min="0.01" placeholder="R$ 0,00" value={contaReceberForm.valor} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, valor: e.target.value }))} /></label>
            <label className="financial-form-field"><FieldLabel label="Vencimento" required help="É o último dia previsto para receber o pagamento antes de a conta ficar em atraso." /><input required type="date" value={contaReceberForm.vencimento} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, vencimento: e.target.value }))} /><small>Data limite prevista para o recebimento.</small></label>
            <h3 className="financial-form-section-title">Vínculos da estrutura</h3>
            <label className="financial-form-field">
              <FieldLabel label="Conta de entrada" help="Escolha o banco, carteira ou caixa onde este recebimento deverá entrar." />
              <select disabled={loadingEstruturaOptions} value={contaReceberForm.contaFinanceiraId} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, contaFinanceiraId: e.target.value }))}>
                <option value="">{loadingEstruturaOptions ? "Carregando contas..." : "Não vincular uma conta"}</option>
                {contasFinanceiras.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.banco ? ` - ${item.banco}` : ""}</option>)}
              </select>
            </label>
            <label className="financial-form-field">
              <FieldLabel label="Centro de custo" help="Indique qual área, projeto ou unidade receberá o resultado desta receita." />
              <select disabled={loadingEstruturaOptions} value={contaReceberForm.centroCustoId} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, centroCustoId: e.target.value }))}>
                <option value="">{loadingEstruturaOptions ? "Carregando centros..." : "Não vincular um centro"}</option>
                {centrosCusto.map((item) => <option key={item.id} value={item.id}>{item.codigo ? `${item.codigo} - ` : ""}{item.nome}</option>)}
              </select>
            </label>
            <label className="financial-form-field">
              <FieldLabel label="Cliente ou pagador" help="Selecione a pessoa ou empresa de quem este valor será recebido." />
              <select disabled={loadingEstruturaOptions} value={contaReceberForm.contraparteId} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, contraparteId: e.target.value }))}>
                <option value="">{loadingEstruturaOptions ? "Carregando pessoas..." : "Não vincular uma pessoa"}</option>
                {contrapartes.map((item) => <option key={item.id} value={item.id}>{item.nome} - {item.tipo}</option>)}
              </select>
            </label>
            <label className="financial-form-field">
              <span>Empresa do grupo (opcional)</span>
              <select disabled={loadingEstruturaOptions} value={contaReceberForm.empresaGrupoId} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, empresaGrupoId: e.target.value }))}>
                <option value="">Não vincular empresa</option>
                {empresasGrupo.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </label>
            {!loadingEstruturaOptions && contasFinanceiras.length === 0 && centrosCusto.length === 0 && contrapartes.length === 0 && (
              <p className="financial-structure-form-note financial-field-wide"><FiInfo /> Nenhuma opção encontrada. Você pode salvar sem vínculos ou cadastrar contas, centros e pessoas na aba Estrutura.</p>
            )}
            <h3 className="financial-form-section-title">Classificação e datas</h3>
            <label className="financial-form-field"><FieldLabel label="Categoria" help="Serve para organizar receitas semelhantes. Exemplos: Vendas, Mensalidades ou Serviços." /><select value={contaReceberForm.categoriaId} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, categoriaId: e.target.value }))}>
              <option value="">Categoria (opcional)</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select></label>
            <label className="financial-form-field"><FieldLabel label="Emissão" help="É o dia em que a cobrança, nota fiscal ou boleto foi criado para o cliente." /><input type="date" value={contaReceberForm.emissao} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, emissao: e.target.value }))} /><small>Quando a cobrança ou nota foi emitida.</small></label>
            <label className="financial-form-field"><FieldLabel label="Competência" help="Indica a qual mês a receita pertence, mesmo que o pagamento aconteça depois. Exemplo: mensalidade de agosto recebida em setembro." /><input type="date" value={contaReceberForm.competencia} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, competencia: e.target.value }))} /><small>Mês ao qual a receita pertence na análise gerencial.</small></label>
            <label className="financial-form-field"><FieldLabel label="Número do documento" help="É o código usado para identificar a nota fiscal, cobrança, boleto ou contrato." /><input placeholder="Nota fiscal, cobrança ou contrato" value={contaReceberForm.documentoNumero} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, documentoNumero: e.target.value }))} /></label>
            <label className="financial-form-field financial-field-wide"><FieldLabel label="Observação" help="Use para registrar qualquer detalhe importante que não cabe nos outros campos." /><input placeholder="Informações adicionais" value={contaReceberForm.observacao} onChange={(e) => setContaReceberForm((prev) => ({ ...prev, observacao: e.target.value }))} /></label>
            <label className="financial-form-field">
              <FieldLabel label="Anexo" help="Adicione contrato, nota fiscal, boleto ou outro arquivo relacionado a este recebimento." />
              <input
                ref={contaReceberFileInputRef}
                type="file"
                onChange={(e) => setContaReceberAnexo(e.target.files?.[0] || null)}
              />
              <small>Anexe contrato, nota ou documento relacionado ao titulo.</small>
            </label>
            <label className="toggle-label inline-toggle">
              <input
                type="checkbox"
                checked={contaReceberForm.parcelado}
                onChange={(e) =>
                  setContaReceberForm((prev) => ({
                    ...prev,
                    parcelado: e.target.checked,
                  }))
                }
              />
              <FieldLabel label="Criar parcelado" help="Ative quando o cliente pagará o valor total em duas ou mais parcelas." />
            </label>
          </div>
          {contaReceberForm.parcelado && (
            <div className="financial-form-grid secondary">
              <label className="financial-form-field" htmlFor="conta-receber-parcelas">
                <FieldLabel label="Quantidade de parcelas" help="Informe em quantas partes o valor total será dividido. Exemplo: 12 para doze parcelas." />
                <input
                  id="conta-receber-parcelas"
                  type="number"
                  min="2"
                  value={contaReceberForm.parcelas}
                  onChange={(e) =>
                    setContaReceberForm((prev) => ({
                      ...prev,
                      parcelas: e.target.value,
                    }))
                  }
                  placeholder="Ex.: 2"
                />
                <small>Numero total de parcelas que serao geradas.</small>
              </label>
              <label className="financial-form-field" htmlFor="conta-receber-periodicidade">
                <FieldLabel label="Periodicidade (meses)" help="É o intervalo entre parcelas. Use 1 para mensal, 2 para a cada dois meses e 3 para trimestral." />
                <input
                  id="conta-receber-periodicidade"
                  type="number"
                  min="1"
                  value={contaReceberForm.periodicidadeMeses}
                  onChange={(e) =>
                    setContaReceberForm((prev) => ({
                      ...prev,
                      periodicidadeMeses: e.target.value,
                    }))
                  }
                  placeholder="Ex.: 1"
                />
                <small>1 = mensal, 2 = bimestral, 3 = trimestral.</small>
              </label>
            </div>
          )}
          <div className="financial-form-actions">
            <button
              type="button"
              className="financial-btn-secondary"
              onClick={closeContaReceberModal}
            >
              Cancelar
            </button>
            <button type="submit" className="financial-btn-primary" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        isOpen={paymentDialog.open}
        onClose={() => {
          setPaymentDialog((prev) => ({
            ...prev,
            open: false,
            contaId: null,
            valorEmAberto: null,
            valor: "",
            meio: "",
            formaPagamentoId: "",
            observacao: "",
            file: null,
          }));
          if (paymentFileInputRef.current) {
            paymentFileInputRef.current.value = "";
          }
        }}
        title={paymentDialog.type === "pagar" ? "Registrar Pagamento" : "Registrar Recebimento"}
      >
        <div className="financial-dialog-content">
          {Number(paymentDialog.valorEmAberto || 0) > 0 && (
            <p className="financial-dialog-highlight">
              {paymentDialog.type === "pagar" ? "Valor em aberto: " : "Valor em aberto para receber: "}
              <strong>{formatCurrency(paymentDialog.valorEmAberto)}</strong>
            </p>
          )}
          <label>
            Valor
            <input
              type="number"
              step="0.01"
              min="0"
              value={paymentDialog.valor}
              onChange={(e) =>
                setPaymentDialog((prev) => ({
                  ...prev,
                  valor: e.target.value,
                }))
              }
            />
          </label>
          <label>
            Forma de pagamento (opcional)
            <select
              value={paymentDialog.formaPagamentoId}
              onChange={(e) =>
                setPaymentDialog((prev) => ({
                  ...prev,
                  formaPagamentoId: e.target.value,
                }))
              }
            >
              <option value="">Sem forma cadastrada</option>
              {formasPagamento.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          {paymentDialog.formaPagamentoId && (() => {
            const forma = formasPagamento.find((item) => String(item.id) === paymentDialog.formaPagamentoId);
            const bruto = Number(paymentDialog.valor || 0);
            const taxa = bruto * Number(forma?.taxa_percentual || 0) / 100 + Number(forma?.taxa_fixa || 0);
            return <p className="financial-dialog-highlight">Bruto: <strong>{formatCurrency(bruto)}</strong> · Taxa: <strong>{formatCurrency(taxa)}</strong> · Líquido: <strong>{formatCurrency(Math.max(bruto - taxa, 0))}</strong></p>;
          })()}
          <label>
            Observacao (opcional)
            <input
              placeholder="Detalhes da operacao"
              value={paymentDialog.observacao}
              onChange={(e) =>
                setPaymentDialog((prev) => ({
                  ...prev,
                  observacao: e.target.value,
                }))
              }
            />
          </label>
          {paymentDialog.type === "pagar" && (
            <label>
              Anexo (opcional)
              <input
                ref={paymentFileInputRef}
                type="file"
                onChange={(e) =>
                  setPaymentDialog((prev) => ({
                    ...prev,
                    file: e.target.files?.[0] || null,
                  }))
                }
              />
            </label>
          )}
          <div className="financial-dialog-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setPaymentDialog((prev) => ({
                  ...prev,
                  open: false,
                  contaId: null,
                  valorEmAberto: null,
                  valor: "",
                  meio: "",
                  formaPagamentoId: "",
                  observacao: "",
                  file: null,
                }));
                if (paymentFileInputRef.current) {
                  paymentFileInputRef.current.value = "";
                }
              }}
            >
              Cancelar
            </button>
            <button type="button" onClick={() => void handleSubmitPaymentDialog()} disabled={saving}>
              {saving ? "Registrando..." : "Confirmar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
