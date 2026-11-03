import { useState, useEffect, useMemo } from "react";
import {
  FiCalendar,
  FiDollarSign,
  FiShoppingCart,
  FiBox,
  FiPaperclip,
  FiTrendingUp,
  FiTruck,
  FiTag,
  FiBriefcase,
  FiCheckCircle,
  FiXCircle,
} from "react-icons/fi";
import { useRef } from "react";
import { Link } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "../../components/ui/chart";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import {
  PeriodRangePicker,
  type PeriodRangeValue,
} from "../../components/common/PeriodRangePicker/PeriodRangePicker";
import { useAuth } from "../../contexts/AuthContext";
import { API_BASE } from "../../config/api";
import { encrypt, decrypt } from "../../utils/cripto";
import "./DashboardPage.css";

interface FinancialStats {
  totalVendas: number;
  totalPedidos: number;
  ticketMedio: number;
  graficoVendas: { name: string; valor: number }[];
}

interface InventoryStats {
  valorTotal: number;
  produtosBaixoEstoque: number;
  produtosTotal: number;
}

interface ChatStats {
  filaEspera: number;
  ativos: number;
  finalizados: number;
  leads30Dias: number;
  topTags: { name: string; count: number }[];
  ultimosClientesNovos: {
    cliente_id: number;
    cliente_nome: string;
    cliente_telefone: string;
    cliente_email: string;
    data_cadastro: string;
  }[];
  tempoMedioAtendimentoMinutos: number;
  atendimentoPorUsuario: {
    usuario_id: number;
    usuario_nome: string;
    total_atendimentos: number;
    ativos: number;
    finalizados: number;
    tempo_medio_minutos: number;
  }[];
  documentosPorAtendente: {
    usuario_id: number | null;
    usuario_nome: string | null;
    total_documentos: number;
  }[];
  nps: {
    geral: {
      totalAvaliacoes: number;
      promotores: number;
      neutros: number;
      detratores: number;
      mediaNota: number;
      npsGeral: number;
    };
    mediaUltimos5: {
      totalAtendimentosConsiderados: number;
      mediaNotaUltimos5: number;
    };
    porAtendente: {
      usuario_id: number;
      usuario_nome: string;
      total_avaliacoes: number;
      media_nota: number;
      promotores: number;
      neutros: number;
      detratores: number;
      nps: number;
    }[];
    notasUltimos5PorPergunta: {
      atendimento_id: number;
      data_fim: string;
      atendente_id: number | null;
      atendente_nome: string | null;
      pergunta_id: number;
      pergunta: string;
      nota: number;
      resposta_texto: string | null;
      data_resposta: string;
    }[];
  };
}

interface GeneralStats {
  totalFornecedores: number | null;
}

interface VisibilityStats {
  financeiro: boolean;
  estoque: boolean;
  atendimento: boolean;
  fornecedores: boolean;
  crm: boolean;
}

interface CrmStats {
  pipelineAtivos: number;
  valorPipelineAberto: number;
  ganhos30Dias: number;
  perdidos30Dias: number;
  fechados30Dias: number;
  taxaConversao30Dias: number;
  valorGanho30Dias: number;
  valorPerdido30Dias: number;
  ticketMedioGanho30Dias: number;
  tempoMedioFechamentoDias: number;
  funilPorEtapa: {
    codigo: string;
    nome: string;
    ordem: number | null;
    total: number;
    valorTotal: number;
  }[];
  topResponsaveis: {
    usuario_nome: string;
    pipeline_ativos: number;
    ganhos_30_dias: number;
    valor_ganho_30_dias: number;
  }[];
}

interface DashboardResponse {
  filiais?: {
    id: number;
    name?: string;
  }[];
  visibilidade: VisibilityStats;
  financeiro: FinancialStats | null;
  estoque: InventoryStats | null;
  atendimento: ChatStats | null;
  crm: CrmStats | null;
  geral: GeneralStats;
  has_pdv: boolean;
  filtros?: {
    date_start?: string | null;
    date_end?: string | null;
    filial_id?: number | null;
  };
}

interface DashboardBranchOption {
  id: number;
  name: string;
}

const initialFinancial: FinancialStats = {
  totalVendas: 0,
  totalPedidos: 0,
  ticketMedio: 0,
  graficoVendas: [],
};
const initialInventory: InventoryStats = {
  valorTotal: 0,
  produtosBaixoEstoque: 0,
  produtosTotal: 0,
};
const initialChat: ChatStats = {
  filaEspera: 0,
  ativos: 0,
  finalizados: 0,
  leads30Dias: 0,
  topTags: [],
  ultimosClientesNovos: [],
  tempoMedioAtendimentoMinutos: 0,
  atendimentoPorUsuario: [],
  documentosPorAtendente: [],
  nps: {
    geral: {
      totalAvaliacoes: 0,
      promotores: 0,
      neutros: 0,
      detratores: 0,
      mediaNota: 0,
      npsGeral: 0,
    },
    mediaUltimos5: {
      totalAtendimentosConsiderados: 0,
      mediaNotaUltimos5: 0,
    },
    porAtendente: [],
    notasUltimos5PorPergunta: [],
  },
};
const initialGeneral: GeneralStats = { totalFornecedores: null };

const initialVisibility: VisibilityStats = {
  financeiro: false,
  estoque: false,
  atendimento: false,
  fornecedores: false,
  crm: false,
};

const initialCrm: CrmStats = {
  pipelineAtivos: 0,
  valorPipelineAberto: 0,
  ganhos30Dias: 0,
  perdidos30Dias: 0,
  fechados30Dias: 0,
  taxaConversao30Dias: 0,
  valorGanho30Dias: 0,
  valorPerdido30Dias: 0,
  ticketMedioGanho30Dias: 0,
  tempoMedioFechamentoDias: 0,
  funilPorEtapa: [],
  topResponsaveis: [],
};

const atendimentoChartColors = {
  total: "#C5D200",
  ativos: "#7E8900",
  finalizados: "#D7E85C",
};

const dashboardChartPalette = {
  dark: "#7E8900",
  base: "#C5D200",
  light: "#D7E85C",
};

const topTagsChartConfig = {
  count: {
    label: "Ocorrencias",
    color: dashboardChartPalette.base,
  },
} satisfies ChartConfig;

const atendimentoPorUsuarioChartConfig = {
  total_atendimentos: {
    label: "Total",
    color: atendimentoChartColors.total,
  },
  ativos: {
    label: "Ativos",
    color: atendimentoChartColors.ativos,
  },
  finalizados: {
    label: "Finalizados",
    color: atendimentoChartColors.finalizados,
  },
} satisfies ChartConfig;

const documentosPorAtendenteChartConfig = {
  total_documentos: {
    label: "Documentos",
    color: dashboardChartPalette.base,
  },
} satisfies ChartConfig;

const npsPorAtendenteChartConfig = {
  nps: {
    label: "NPS",
    color: dashboardChartPalette.dark,
  },
} satisfies ChartConfig;

type PrimaryMetricCard = {
  label: string;
  value: string;
  helper: string;
  icon: IconType;
  accent?: "highlight" | "success";
};

type MetricGroupItem = {
  label: string;
  value: string;
  icon: IconType;
};

type MetricGroup = {
  title: string;
  description: string;
  items: MetricGroupItem[];
};

function PrimaryCard({ card }: { card: PrimaryMetricCard }) {
  const Icon = card.icon;

  return (
    <article
      className={`dashboard-primary-card${card.accent ? ` ${card.accent}` : ""}`}
    >
      <div className="dashboard-primary-card__content">
        <div>
          <p className="dashboard-primary-card__label">{card.label}</p>
          <strong className="dashboard-primary-card__value">
            {card.value}
          </strong>
          <p className="dashboard-primary-card__helper">{card.helper}</p>
        </div>

        <div className="dashboard-primary-card__icon">
          <Icon size={22} />
        </div>
      </div>

      <div className="dashboard-primary-card__bar" />
    </article>
  );
}

function MetricMiniCard({ item }: { item: MetricGroupItem }) {
  const Icon = item.icon;

  return (
    <article className="dashboard-mini-card">
      <div className="dashboard-mini-card__content">
        <p className="dashboard-mini-card__label">{item.label}</p>
        <strong className="dashboard-mini-card__value">{item.value}</strong>
      </div>

      <div className="dashboard-mini-card__icon">
        <Icon size={18} />
      </div>
    </article>
  );
}

function MetricGroupSection({ group }: { group: MetricGroup }) {
  const sectionClassName =
    group.title === "Pipeline / Funil"
      ? "dashboard-metric-group dashboard-metric-group--crm"
      : group.title === "Atendimento"
        ? "dashboard-metric-group dashboard-metric-group--service"
        : group.title === "Qualidade"
          ? "dashboard-metric-group dashboard-metric-group--quality"
          : group.title === "Operacional"
            ? "dashboard-metric-group dashboard-metric-group--operational"
            : "dashboard-metric-group";

  return (
    <section className={sectionClassName}>
      <div className="dashboard-metric-group__header">
        <h2>{group.title}</h2>
        <p>{group.description}</p>
      </div>

      <div className="dashboard-metric-group__grid">
        {group.items.map((item) => (
          <MetricMiniCard key={item.label} item={item} />
        ))}
      </div>
    </section>
  );
}

function normalizeTopTags(raw: unknown): { name: string; count: number }[] {
  const toNumber = (value: unknown) => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, unknown>)
      .map(([name, count]) => ({
        name: String(name || "Sem tag"),
        count: toNumber(count),
      }))
      .filter((item) => item.name);
  }

  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      const obj = (item ?? {}) as Record<string, unknown>;
      return {
        name: String(obj.name ?? obj.tag ?? obj.label ?? "Sem tag"),
        count: toNumber(
          obj.count ??
            obj.total ??
            obj.valor ??
            obj.qtd ??
            obj.ocorrencias ??
            0,
        ),
      };
    })
    .filter((item) => item.name);
}

function formatDashboardPeriodLabel(start?: string, end?: string) {
  if (!start && !end) {
    return "Padrão operacional do sistema";
  }

  const formatDate = (value?: string) => {
    if (!value) return null;
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
  };

  return `${formatDate(start || undefined) || "inicio"} ate ${
    formatDate(end || undefined) || "hoje"
  }`;
}

export function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [atendimentoSeriesView, setAtendimentoSeriesView] = useState<
    "all" | "status" | "total"
  >("all");
  const [periodFilter, setPeriodFilter] = useState({
    start: "",
    end: "",
  });
  const [branchFilter, setBranchFilter] = useState("all");
  const [branches, setBranches] = useState<DashboardBranchOption[]>([]);
  const [isPeriodFilterOpen, setIsPeriodFilterOpen] = useState(false);
  const periodFilterRef = useRef<HTMLDivElement | null>(null);

  const [financial, setFinancial] = useState<FinancialStats>(initialFinancial);
  const [inventory, setInventory] = useState<InventoryStats>(initialInventory);
  const [chat, setChat] = useState<ChatStats>(initialChat);
  const [crm, setCrm] = useState<CrmStats>(initialCrm);
  const [general, setGeneral] = useState<GeneralStats>(initialGeneral);
  const [visibility, setVisibility] =
    useState<VisibilityStats>(initialVisibility);

  const finalVisibility = visibility;
  const canViewNpsReport = hasPermission("reports.nps.view");

  const hasAnyVisibleMetric =
    finalVisibility.financeiro ||
    finalVisibility.estoque ||
    finalVisibility.atendimento ||
    finalVisibility.fornecedores ||
    finalVisibility.crm;

  const atendimentoAreaData = useMemo(() => {
    const base = [...chat.atendimentoPorUsuario]
      .sort((a, b) => b.total_atendimentos - a.total_atendimentos)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        nome_curto:
          item.usuario_nome?.split(" ").slice(0, 2).join(" ") || "Usuário",
      }));

    // AreaChart precisa de pelo menos 2 pontos no eixo X para preencher a area.
    if (base.length === 1) {
      const only = base[0];
      return [{ ...only, nome_curto: "" }, only];
    }

    return base;
  }, [chat.atendimentoPorUsuario]);

  const documentosPorAtendenteData = useMemo(() => {
    return [...chat.documentosPorAtendente]
      .sort((a, b) => b.total_documentos - a.total_documentos)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        usuario_nome: item.usuario_nome || "Nao identificado",
        nome_curto:
          item.usuario_nome?.split(" ").slice(0, 2).join(" ") ||
          "Nao identificado",
      }));
  }, [chat.documentosPorAtendente]);

  const totalDocumentosCliente = useMemo(
    () =>
      chat.documentosPorAtendente.reduce(
        (acc, item) => acc + Number(item.total_documentos || 0),
        0,
      ),
    [chat.documentosPorAtendente],
  );

  const topTagsData = useMemo(
    () => normalizeTopTags(chat.topTags),
    [chat.topTags],
  );

  const crmFunilData = useMemo(() => {
    return crm.funilPorEtapa.map((item) => ({
      ...item,
      nome_curto:
        item.nome && item.nome.length > 18
          ? `${item.nome.slice(0, 18).trim()}...`
          : item.nome,
    }));
  }, [crm.funilPorEtapa]);

  const formatCurrency = (value: number) =>
    Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const primaryCards = useMemo<PrimaryMetricCard[]>(() => {
    const cards: PrimaryMetricCard[] = [];

    if (finalVisibility.financeiro) {
      cards.push({
        label: "Faturamento",
        value: formatCurrency(financial.totalVendas),
        helper: "Receita registrada",
        icon: FiDollarSign,
        accent: "highlight",
      });
      cards.push({
        label: "Vendas",
        value: String(financial.totalPedidos || 0),
        helper: "Total de pedidos",
        icon: FiShoppingCart,
      });
    }

    if (finalVisibility.crm) {
      cards.push({
        label: "Valor Convertido",
        value: formatCurrency(crm.valorGanho30Dias),
        helper: "Negocios ganhos no periodo",
        icon: FiCheckCircle,
        accent: "success",
      });
      cards.push({
        label: "Taxa de Conversão",
        value: `${Number(crm.taxaConversao30Dias || 0).toFixed(1)}%`,
        helper: "Aproveitamento recente do funil",
        icon: FiTrendingUp,
      });
    }

    if (cards.length < 4 && finalVisibility.atendimento) {
      cards.push({
        label: "Finalizados",
        value: String(chat.finalizados || 0),
        helper: "Atendimentos concluidos",
        icon: FiCheckCircle,
      });
    }

    if (cards.length < 4 && finalVisibility.estoque) {
      cards.push({
        label: "Valor em Estoque",
        value: formatCurrency(inventory.valorTotal),
        helper: "Capital imobilizado",
        icon: FiBox,
      });
    }

    if (cards.length < 4 && finalVisibility.fornecedores) {
      cards.push({
        label: "Fornecedores",
        value: String(general.totalFornecedores ?? 0),
        helper: "Base cadastrada",
        icon: FiTruck,
      });
    }

    return cards.slice(0, 4);
  }, [
    chat.finalizados,
    crm.taxaConversao30Dias,
    crm.valorGanho30Dias,
    finalVisibility.atendimento,
    finalVisibility.crm,
    finalVisibility.estoque,
    finalVisibility.financeiro,
    finalVisibility.fornecedores,
    financial.totalPedidos,
    financial.totalVendas,
    general.totalFornecedores,
    inventory.valorTotal,
  ]);

  const metricGroups = useMemo<MetricGroup[]>(() => {
    const groups: MetricGroup[] = [];

    if (finalVisibility.crm) {
      groups.push({
        title: "Pipeline / Funil",
        description: "Acompanhamento dos negócios em andamento",
        items: [
          {
            label: "Pipeline Ativo",
            value: String(crm.pipelineAtivos || 0),
            icon: FiBriefcase,
          },
          {
            label: "Valor Pipeline",
            value: formatCurrency(crm.valorPipelineAberto),
            icon: FiDollarSign,
          },
          {
            label: "Ganhos no periodo",
            value: String(crm.ganhos30Dias || 0),
            icon: FiCheckCircle,
          },
          {
            label: "Valor Perdido",
            value: formatCurrency(crm.valorPerdido30Dias),
            icon: FiXCircle,
          },
        ],
      });
    }

    if (finalVisibility.atendimento) {
      const atendimentoItems: MetricGroupItem[] = [
        {
          label: "Fila Atendimento",
          value: String(chat.filaEspera || 0),
          icon: FiTag,
        },
        { label: "Ativos", value: String(chat.ativos || 0), icon: FiTag },
        {
          label: "Finalizados",
          value: String(chat.finalizados || 0),
          icon: FiCheckCircle,
        },
      ];

      if (user?.is_master) {
        atendimentoItems.push({
          label: "Tempo Medio",
          value: `${Number(chat.tempoMedioAtendimentoMinutos || 0).toFixed(1)} min`,
          icon: FiTrendingUp,
        });
      }

      groups.push({
        title: "Atendimento",
        description: "Status operacional e ritmo da equipe",
        items: atendimentoItems,
      });

      groups.push({
        title: "Qualidade",
        description: "Indicadores de satisfação do atendimento",
        items: [
          {
            label: "NPS Geral",
            value: Number(chat.nps.geral.npsGeral || 0).toFixed(1),
            icon: FiTrendingUp,
          },
          {
            label: "Media NPS",
            value: Number(
              chat.nps.mediaUltimos5.mediaNotaUltimos5 || 0,
            ).toFixed(1),
            icon: FiTrendingUp,
          },
        ],
      });
    }

    if (
      finalVisibility.financeiro ||
      finalVisibility.estoque ||
      finalVisibility.fornecedores
    ) {
      const items: MetricGroupItem[] = [];

      if (finalVisibility.financeiro) {
        items.push(
          {
            label: "Faturamento",
            value: formatCurrency(financial.totalVendas),
            icon: FiDollarSign,
          },
          {
            label: "Vendas",
            value: String(financial.totalPedidos || 0),
            icon: FiShoppingCart,
          },
          {
            label: "Ticket Medio",
            value: formatCurrency(financial.ticketMedio),
            icon: FiTrendingUp,
          },
        );
      }

      if (finalVisibility.estoque) {
        items.push({
          label: "Valor em Estoque",
          value: formatCurrency(inventory.valorTotal),
          icon: FiBox,
        });
      }

      if (finalVisibility.fornecedores) {
        items.push({
          label: "Fornecedores",
          value: String(general.totalFornecedores ?? 0),
          icon: FiTruck,
        });
      }

      groups.push({
        title: "Operacional",
        description: "Visão consolidada de receita, estoque e base parceira",
        items,
      });
    }

    return groups;
  }, [
    chat.ativos,
    chat.filaEspera,
    chat.finalizados,
    chat.nps.geral.npsGeral,
    chat.nps.mediaUltimos5.mediaNotaUltimos5,
    chat.tempoMedioAtendimentoMinutos,
    crm.ganhos30Dias,
    crm.pipelineAtivos,
    crm.valorPerdido30Dias,
    crm.valorPipelineAberto,
    finalVisibility.atendimento,
    finalVisibility.crm,
    finalVisibility.estoque,
    finalVisibility.financeiro,
    finalVisibility.fornecedores,
    financial.ticketMedio,
    financial.totalPedidos,
    financial.totalVendas,
    general.totalFornecedores,
    inventory.valorTotal,
    user?.is_master,
  ]);

  const npsPorAtendenteData = useMemo(() => {
    return (chat.nps.porAtendente || []).map((item) => ({
      ...item,
      media_nota_num: Number(item.media_nota || 0),
    }));
  }, [chat.nps.porAtendente]);

  const activePeriodLabel = useMemo(
    () => formatDashboardPeriodLabel(periodFilter.start, periodFilter.end),
    [periodFilter.end, periodFilter.start],
  );

  const hasActiveFilters = Boolean(
    periodFilter.start || periodFilter.end || branchFilter !== "all",
  );

  const applyPeriodFilter = (nextPeriod: PeriodRangeValue) => {
    setPeriodFilter({
      start: nextPeriod.dateStart,
      end: nextPeriod.dateEnd,
    });
    setIsPeriodFilterOpen(false);
  };

  const clearFilters = () => {
    if (!hasActiveFilters) return;
    setPeriodFilter({ start: "", end: "" });
    setBranchFilter("all");
    setIsPeriodFilterOpen(false);
  };

  useEffect(() => {
    if (!isPeriodFilterOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!periodFilterRef.current?.contains(event.target as Node)) {
        setIsPeriodFilterOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPeriodFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPeriodFilterOpen]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.empresa_id || !user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoadError(null);
        const encrypted = await encrypt({
          empresa_id: user.empresa_id,
          usuario_id: user.id,
          date_start: periodFilter.start || undefined,
          date_end: periodFilter.end || undefined,
          filial_id: branchFilter !== "all" ? Number(branchFilter) : undefined,
        });

        const response = await fetch(`${API_BASE}/user/dashboard_stats`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });

        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          boleano: boolean;
          obj: DashboardResponse;
          mensagem?: string;
        };

        if (resp?.boleano && resp.obj) {
          type RawAtendimento = Partial<ChatStats> & {
            top_tags?: unknown;
            tags?: unknown;
            nps?: Partial<ChatStats["nps"]>;
          };

          const atendimentoData = (resp.obj.atendimento ||
            {}) as RawAtendimento;

          console.log(
            "[Dashboard] nps.porAtendente (backend):",
            atendimentoData.nps?.porAtendente,
          );
          setBranches(
            Array.isArray(resp.obj.filiais)
              ? resp.obj.filiais
                  .map((item) => ({
                    id: Number(item?.id || 0),
                    name: String(item?.name || `Filial ${item?.id || ""}`),
                  }))
                  .filter((item) => item.id > 0)
              : [],
          );
          setVisibility(resp.obj.visibilidade || initialVisibility);
          setFinancial(resp.obj.financeiro || initialFinancial);
          setInventory(resp.obj.estoque || initialInventory);
          const rawTopTags =
            atendimentoData.topTags ??
            atendimentoData.top_tags ??
            atendimentoData.tags ??
            [];
          let normalizedTopTags = normalizeTopTags(rawTopTags);

          // Fallback: se ainda nao houver dados de ocorrencia, mostra tags cadastradas com contagem 0.
          if (normalizedTopTags.length === 0 && user?.empresa_id) {
            try {
              const encryptedTags = await encrypt({
                empresa_id: user.empresa_id,
              });
              const tagsResponse = await fetch(`${API_BASE}/user/lista_tags`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload: encryptedTags }),
              });
              const tagsRespData = await tagsResponse.json();
              const tagsResp = (await decrypt(tagsRespData.payload)) as {
                boleano: boolean;
                obj: Array<{ nome?: string; name?: string }>;
              };
              if (tagsResp?.boleano && Array.isArray(tagsResp.obj)) {
                normalizedTopTags = tagsResp.obj
                  .map((tag) => ({
                    name: String(tag?.nome ?? tag?.name ?? "Sem tag"),
                    count: 0,
                  }))
                  .filter((tag) => tag.name);
              }
            } catch (tagsErr) {
              console.error(
                "Erro ao buscar fallback de tags cadastradas:",
                tagsErr,
              );
            }
          }

          setChat({
            ...initialChat,
            ...atendimentoData,
            topTags: normalizedTopTags,
            nps: {
              ...initialChat.nps,
              ...(atendimentoData.nps || {}),
            },
          });
          setCrm(resp.obj.crm || initialCrm);
          setGeneral(resp.obj.geral || initialGeneral);
        } else {
          console.error("Erro ao carregar dashboard:", resp);
          setLoadError(
            resp?.mensagem ||
              "Nao foi possivel carregar as metricas do dashboard.",
          );
        }
      } catch (err) {
        console.error("Erro na requisicao do dashboard:", err);
        setLoadError(
          "Nao foi possivel carregar as metricas do dashboard. Tente novamente.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [
    branchFilter,
    periodFilter.end,
    periodFilter.start,
    user?.empresa_id,
    user?.id,
  ]);

  return (
    <div className="dashboard-page-layout">
      <MobileHeader title="Dashboard" />

      <header className="dashboard-header">
        <div className="dashboard-header__title">
          <h1>Visão Geral</h1>
          <p className="date-label">
            Olá, <strong>{user?.name || "Usuário"}</strong>. Aqui está o resumo
            do seu acesso.
          </p>
        </div>

        <section
          className="dashboard-header-controls"
          aria-label="Filtros do dashboard"
        >
          <div className="dashboard-filters-area">
            <div className="dashboard-filters-group">
              <select
                id="dashboard-branch"
                className="filter-select compact dashboard-branch-filter-select"
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                aria-label="Filial"
              >
                <option value="all">Todas as filiais</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={String(branch.id)}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <div
                className={`dashboard-period-menu-wrapper ${isPeriodFilterOpen ? "open" : ""}`}
                ref={periodFilterRef}
              >
                <button
                  type="button"
                  className={`dashboard-date-filter-trigger ${
                    periodFilter.start || periodFilter.end ? "is-active" : ""
                  }`}
                  onClick={() => setIsPeriodFilterOpen((current) => !current)}
                  aria-haspopup="dialog"
                  aria-expanded={isPeriodFilterOpen}
                >
                  <FiCalendar />
                  <span>{activePeriodLabel}</span>
                </button>

                {isPeriodFilterOpen ? (
                  <div className="dashboard-period-dropdown">
                    <PeriodRangePicker
                      value={{
                        dateStart: periodFilter.start,
                        dateEnd: periodFilter.end,
                      }}
                      onApply={applyPeriodFilter}
                      onCancel={() => setIsPeriodFilterOpen(false)}
                    />
                  </div>
                ) : null}
              </div>

              {hasActiveFilters ? (
                <button
                  type="button"
                  className="dashboard-toolbar-button dashboard-clear-filters-button"
                  onClick={clearFilters}
                  disabled={loading}
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </header>

      <main className="dashboard-content">
        {loading ? (
          <p style={{ textAlign: "center", marginTop: "20px" }}>
            Carregando indicadores...
          </p>
        ) : loadError ? (
          <p style={{ textAlign: "center", marginTop: "20px" }}>{loadError}</p>
        ) : !hasAnyVisibleMetric ? (
          <p style={{ textAlign: "center", marginTop: "20px" }}>
            Seu perfil/plano nao possui metricas de dashboard habilitadas no
            momento.
          </p>
        ) : (
          <>
            {/* <section className="dashboard-kpi-overview"> */}
            {/* <div className="dashboard-kpi-overview__header">
                <div>
                  <h2>Resumo Geral</h2>
                  <p>Principais indicadores do seu acesso em destaque</p>
                </div>
              </div> */}

            <div className="dashboard-primary-grid">
              {primaryCards.map((card) => (
                <PrimaryCard key={card.label} card={card} />
              ))}
            </div>
            {/* </section> */}

            {metricGroups.length > 0 && (
              <div className="dashboard-groups-grid">
                {metricGroups.map((group) => (
                  <MetricGroupSection key={group.title} group={group} />
                ))}
              </div>
            )}

            {finalVisibility.atendimento && canViewNpsReport ? (
              <section className="dashboard-nps-cta-card">
                <div className="dashboard-nps-cta-card__content">
                  <div>
                    <p className="dashboard-nps-cta-card__eyebrow">
                      Satisfação do Atendimento
                    </p>
                    <h3>Relatorio NPS</h3>
                    <p className="dashboard-nps-cta-card__text">
                      Consulte o consolidado de satisfação com evolução do NPS,
                      distribuição das notas, ranking por atendente e respostas
                      recentes dos clientes.
                    </p>
                  </div>

                  <div className="dashboard-nps-cta-card__stats">
                    <div>
                      <span>NPS geral</span>
                      <strong>
                        {Number(chat.nps.geral.npsGeral || 0).toFixed(1)}
                      </strong>
                    </div>
                    <div>
                      <span>Avaliações</span>
                      <strong>
                        {Number(chat.nps.geral.totalAvaliacoes || 0)}
                      </strong>
                    </div>
                    <div>
                      <span>Média</span>
                      <strong>
                        {Number(chat.nps.geral.mediaNota || 0).toFixed(1)}
                      </strong>
                    </div>
                  </div>
                </div>

                <Link
                  to="/relatorios/nps"
                  className="dashboard-nps-cta-card__link"
                >
                  Abrir relatorio completo
                </Link>
              </section>
            ) : null}

            <div className="dashboard-charts-layout">
              {finalVisibility.atendimento && atendimentoAreaData.length > 0 ? (
                <div className="dashboard-charts-row dashboard-charts-row--single">
                  <Card className="chart-card chart-card--wide modern-chart-card">
                    <CardHeader className="modern-chart-header">
                      <CardTitle className="chart-title-with-actions">
                        <FiTag /> Atendimentos por Usuário
                      </CardTitle>
                      <CardDescription>
                        Top 10 atendentes por volume total
                      </CardDescription>
                      <div className="atendimento-chart-filters">
                        <button
                          type="button"
                          className={`atendimento-filter-btn ${atendimentoSeriesView === "all" ? "active" : ""}`}
                          onClick={() => setAtendimentoSeriesView("all")}
                        >
                          Geral
                        </button>
                        <button
                          type="button"
                          className={`atendimento-filter-btn ${atendimentoSeriesView === "status" ? "active" : ""}`}
                          onClick={() => setAtendimentoSeriesView("status")}
                        >
                          Status
                        </button>
                        <button
                          type="button"
                          className={`atendimento-filter-btn ${atendimentoSeriesView === "total" ? "active" : ""}`}
                          onClick={() => setAtendimentoSeriesView("total")}
                        >
                          Total
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="modern-chart-content">
                      <ChartContainer
                        config={atendimentoPorUsuarioChartConfig}
                        className="dashboard-chart-container"
                      >
                        <ResponsiveContainer
                          width="100%"
                          height={350}
                          minWidth={0}
                        >
                          <AreaChart
                            data={atendimentoAreaData}
                            baseValue={0}
                            margin={{ left: 8, right: 10, top: 25, bottom: 0 }}
                          >
                            <CartesianGrid
                              vertical={false}
                              strokeDasharray="2 4"
                              stroke="var(--color-border)"
                            />
                            <XAxis
                              dataKey="nome_curto"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                              minTickGap={18}
                              interval={0}
                              tick={{
                                fontSize: 11,
                                fill: "var(--color-text-secondary)",
                              }}
                            />
                            <YAxis
                              domain={[0, "auto"]}
                              tickLine={false}
                              axisLine={false}
                              tick={{
                                fontSize: 11,
                                fill: "var(--color-text-secondary)",
                              }}
                            />
                            <ChartTooltip
                              cursor={false}
                              content={<ChartTooltipContent hideLabel />}
                            />
                            {(atendimentoSeriesView === "all" ||
                              atendimentoSeriesView === "total") && (
                              <Area
                                dataKey="total_atendimentos"
                                name="Total"
                                type="natural"
                                stroke={atendimentoChartColors.total}
                                fill={atendimentoChartColors.total}
                                fillOpacity={0.25}
                                strokeWidth={2}
                                dot={{
                                  r: 2,
                                  fill: atendimentoChartColors.total,
                                }}
                              />
                            )}
                            {(atendimentoSeriesView === "all" ||
                              atendimentoSeriesView === "status") && (
                              <Area
                                dataKey="ativos"
                                name="Ativos"
                                type="natural"
                                stroke={atendimentoChartColors.ativos}
                                fill={atendimentoChartColors.ativos}
                                fillOpacity={0.22}
                                strokeWidth={2}
                                dot={{
                                  r: 2,
                                  fill: atendimentoChartColors.ativos,
                                }}
                              />
                            )}
                            {(atendimentoSeriesView === "all" ||
                              atendimentoSeriesView === "status") && (
                              <Area
                                dataKey="finalizados"
                                name="Finalizados"
                                type="natural"
                                stroke={atendimentoChartColors.finalizados}
                                fill={atendimentoChartColors.finalizados}
                                fillOpacity={0.22}
                                strokeWidth={2}
                                dot={{
                                  r: 2,
                                  fill: atendimentoChartColors.finalizados,
                                }}
                              />
                            )}
                          </AreaChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {finalVisibility.crm && crmFunilData.length > 0 && (
                <div className="dashboard-charts-row">
                  <div className="chart-card side-chart modern-chart-card">
                    <CardHeader className="modern-chart-header">
                      <CardTitle>
                        <FiTrendingUp /> Funil de Vendas por Etapa
                      </CardTitle>
                      <CardDescription>
                        Volume de negócios ativos por etapa
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="modern-chart-content">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          layout="vertical"
                          data={crmFunilData}
                          margin={{ left: 0, right: 10 }}
                        >
                          <CartesianGrid
                            strokeDasharray="2 4"
                            horizontal={false}
                            stroke="var(--color-border)"
                          />
                          <XAxis
                            type="number"
                            axisLine={false}
                            tickLine={false}
                            tickMargin={8}
                          />
                          <YAxis
                            dataKey="nome_curto"
                            type="category"
                            width={75}
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fontSize: 11,
                              fill: "var(--color-text-secondary)",
                            }}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="total"
                            name="Negocios"
                            fill={dashboardChartPalette.dark}
                            radius={[8, 8, 8, 8]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </div>

                  <div className="chart-card side-chart">
                    <div className="chart-header">
                      <h4>
                        <FiTag /> Top Responsaveis (periodo)
                      </h4>
                    </div>
                    <div className="chart-wrapper">
                      <div className="dashboard-compact-table-wrap">
                        <table className="dashboard-compact-table">
                          <thead>
                            <tr>
                              <th>Responsavel</th>
                              <th>Pipeline</th>
                              <th>Ganhos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {crm.topResponsaveis.map((item, idx) => (
                              <tr key={`${item.usuario_nome}-${idx}`}>
                                <td>
                                  {item.usuario_nome || "Sem responsavel"}
                                </td>
                                <td>{item.pipeline_ativos || 0}</td>
                                <td>{item.ganhos_30_dias || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {finalVisibility.financeiro &&
                financial.graficoVendas.length > 0 && (
                  <div className="chart-card chart-card--wide main-chart">
                    <div className="chart-header">
                      <h4>
                        <FiTrendingUp /> Vendas no Periodo
                      </h4>
                    </div>
                    <div className="chart-wrapper">
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={financial.graficoVendas}>
                          <defs>
                            <linearGradient
                              id="colorValor"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor={dashboardChartPalette.base}
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor={dashboardChartPalette.light}
                                stopOpacity={0.08}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="var(--color-border)"
                          />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fontSize: 12,
                              fill: "var(--color-text-secondary)",
                            }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fontSize: 12,
                              fill: "var(--color-text-secondary)",
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "8px",
                              border: "1px solid var(--color-border)",
                              background: "var(--color-surface)",
                              color: "var(--color-text-primary)",
                              boxShadow: "var(--shadow-sm)",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="valor"
                            stroke={dashboardChartPalette.dark}
                            fillOpacity={1}
                            fill="url(#colorValor)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

              {finalVisibility.atendimento &&
                documentosPorAtendenteData.length > 0 && (
                  <div className="dashboard-charts-row">
                    <Card className="chart-card side-chart modern-chart-card">
                      <CardHeader className="modern-chart-header">
                        <CardTitle>
                          <FiPaperclip /> Documentos por Atendente
                        </CardTitle>
                        <CardDescription>
                          {totalDocumentosCliente} documento(s) anexado(s) ao
                          cliente no periodo
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="modern-chart-content">
                        <ChartContainer
                          config={documentosPorAtendenteChartConfig}
                          className="dashboard-chart-container"
                        >
                          <ResponsiveContainer
                            width="100%"
                            height={300}
                            minWidth={0}
                          >
                            <BarChart
                              layout="vertical"
                              data={documentosPorAtendenteData}
                              margin={{ left: 10, right: 10 }}
                            >
                              <CartesianGrid
                                strokeDasharray="2 4"
                                horizontal={false}
                                stroke="var(--color-border)"
                              />
                              <XAxis
                                type="number"
                                allowDecimals={false}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                dataKey="nome_curto"
                                type="category"
                                width={92}
                                tickLine={false}
                                axisLine={false}
                                tick={{
                                  fontSize: 11,
                                  fill: "var(--color-text-secondary)",
                                }}
                              />
                              <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                              />
                              <Bar
                                dataKey="total_documentos"
                                name="Documentos"
                                fill={dashboardChartPalette.base}
                                radius={[8, 8, 8, 8]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

              {(finalVisibility.atendimento && topTagsData.length > 0) ||
              (finalVisibility.atendimento &&
                chat.ultimosClientesNovos.length > 0) ? (
                <div className="dashboard-charts-row">
                  {finalVisibility.atendimento && topTagsData.length > 0 && (
                    <Card className="chart-card side-chart modern-chart-card">
                      <CardHeader className="modern-chart-header">
                        <CardTitle>
                          <FiTag /> Top Tags (Atendimentos)
                        </CardTitle>
                        <CardDescription>
                          Distribuição de tags mais utilizadas
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="modern-chart-content">
                        {topTagsData.length > 0 ? (
                          <ChartContainer
                            config={topTagsChartConfig}
                            className="dashboard-chart-container"
                          >
                            <ResponsiveContainer
                              width="100%"
                              height={300}
                              minWidth={0}
                            >
                              <BarChart
                                layout="vertical"
                                data={topTagsData}
                                margin={{ left: 10, right: 10 }}
                              >
                                <CartesianGrid
                                  strokeDasharray="2 4"
                                  horizontal={false}
                                  stroke="var(--color-border)"
                                />
                                <XAxis
                                  type="number"
                                  axisLine={false}
                                  tickLine={false}
                                  tickMargin={8}
                                />
                                <YAxis
                                  dataKey="name"
                                  type="category"
                                  width={75}
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{
                                    fontSize: 11,
                                    fill: "var(--color-text-secondary)",
                                  }}
                                />
                                <ChartTooltip
                                  cursor={false}
                                  content={
                                    <ChartTooltipContent
                                      labelFormatter={() => "Top tags"}
                                      hideLabel
                                    />
                                  }
                                />
                                <Bar
                                  dataKey="count"
                                  name="Ocorrencias"
                                  fill="var(--color-count)"
                                  radius={[8, 8, 8, 8]}
                                  barSize={18}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        ) : (
                          <p className="top-tags-empty">
                            Sem dados de tags para o periodo.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {finalVisibility.atendimento &&
                    chat.ultimosClientesNovos.length > 0 && (
                      <div className="chart-card side-chart">
                        <div className="chart-header">
                          <h4>
                            <FiTag /> Últimos 10 Clientes Novos
                          </h4>
                        </div>
                        <div className="chart-wrapper">
                          <div className="dashboard-compact-table-wrap">
                            <table className="dashboard-compact-table">
                              <thead>
                                <tr>
                                  <th>Nome</th>
                                  <th>Telefone</th>
                                  <th>Email</th>
                                </tr>
                              </thead>
                              <tbody>
                                {chat.ultimosClientesNovos.map((cliente) => (
                                  <tr key={cliente.cliente_id}>
                                    <td>
                                      {cliente.cliente_nome || "Sem nome"}
                                    </td>
                                    <td>{cliente.cliente_telefone || "-"}</td>
                                    <td>{cliente.cliente_email || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              ) : null}

              {(finalVisibility.atendimento &&
                user?.is_master &&
                npsPorAtendenteData.length > 0) ||
              (finalVisibility.atendimento &&
                chat.nps.notasUltimos5PorPergunta.length > 0) ? (
                <div className="dashboard-charts-row">
                  {finalVisibility.atendimento &&
                    user?.is_master &&
                    npsPorAtendenteData.length > 0 && (
                      <Card className="chart-card side-chart modern-chart-card">
                        <CardHeader className="modern-chart-header">
                          <CardTitle>
                            <FiTrendingUp /> Media de Nota por Atendente
                          </CardTitle>
                          <CardDescription>
                            {chat.nps.geral.totalAvaliacoes > 0
                              ? `${chat.nps.geral.totalAvaliacoes} avaliações consideradas`
                              : "Sem avaliações no periodo"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="modern-chart-content">
                          <ChartContainer
                            config={npsPorAtendenteChartConfig}
                            className="dashboard-chart-container"
                          >
                            <ResponsiveContainer
                              width="100%"
                              height={300}
                              minWidth={0}
                            >
                              <BarChart
                                layout="vertical"
                                data={npsPorAtendenteData}
                                margin={{ left: 10, right: 10 }}
                              >
                                <CartesianGrid
                                  strokeDasharray="2 4"
                                  horizontal={false}
                                  stroke="var(--color-border)"
                                />
                                <ReferenceLine
                                  x={0}
                                  stroke="var(--color-text-secondary)"
                                  strokeDasharray="3 3"
                                />
                                <XAxis
                                  type="number"
                                  axisLine={false}
                                  tickLine={false}
                                  tickMargin={8}
                                  tick={{
                                    fontSize: 11,
                                    fill: "var(--color-text-secondary)",
                                  }}
                                />
                                <YAxis
                                  dataKey="usuario_nome"
                                  type="category"
                                  width={75}
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{
                                    fontSize: 11,
                                    fill: "var(--color-text-secondary)",
                                  }}
                                />
                                <ChartTooltip
                                  cursor={false}
                                  content={
                                    <ChartTooltipContent
                                      hideLabel
                                      valueFormatter={(value) => {
                                        const numeric = Number(value);
                                        if (!Number.isFinite(numeric))
                                          return String(value);
                                        return numeric.toLocaleString("pt-BR", {
                                          minimumFractionDigits: 1,
                                          maximumFractionDigits: 1,
                                        });
                                      }}
                                    />
                                  }
                                />
                                <Bar
                                  dataKey="media_nota_num"
                                  name="Media da nota"
                                  radius={[8, 8, 8, 8]}
                                  barSize={18}
                                >
                                  {npsPorAtendenteData.map((item) => (
                                    <Cell
                                      key={`nps-${item.usuario_id}`}
                                      fill={
                                        item.media_nota_num >= 8
                                          ? dashboardChartPalette.dark
                                          : item.media_nota_num >= 6
                                            ? dashboardChartPalette.base
                                            : dashboardChartPalette.light
                                      }
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </ChartContainer>
                        </CardContent>
                      </Card>
                    )}

                  {finalVisibility.atendimento &&
                    chat.nps.notasUltimos5PorPergunta.length > 0 && (
                      <div className="chart-card side-chart">
                        <div className="chart-header">
                          <h4>
                            <FiTag /> NPS: Notas dos Últimos 5 Atendimentos
                          </h4>
                        </div>
                        <div className="chart-wrapper">
                          <div className="dashboard-compact-table-wrap">
                            <table className="dashboard-compact-table">
                              <thead>
                                <tr>
                                  <th>Atendimento</th>
                                  <th>Pergunta</th>
                                  <th>Nota</th>
                                </tr>
                              </thead>
                              <tbody>
                                {chat.nps.notasUltimos5PorPergunta.map(
                                  (item, idx) => (
                                    <tr
                                      key={`${item.atendimento_id}-${item.pergunta_id}-${idx}`}
                                    >
                                      <td>
                                        #{item.atendimento_id} -{" "}
                                        {item.atendente_nome || "Sem atendente"}
                                      </td>
                                      <td>{item.pergunta || "Pergunta"}</td>
                                      <td>{item.nota}</td>
                                    </tr>
                                  ),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
