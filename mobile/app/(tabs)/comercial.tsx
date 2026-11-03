import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppDrawer } from '@/components/AppDrawer';
import { ConfiguracoesCrmTab } from '@/components/ConfiguracoesCrmTab';
import { DashboardCrmTab } from '@/components/DashboardCrmTab';
import { FechadasCrmTab } from '@/components/FechadasCrmTab';
import { ReportsCrmTab } from '@/components/ReportsCrmTab';
import { ScheduleDispatchTab } from '@/components/ScheduleDispatchTab';
import { VendasCrmTab } from '@/components/VendasCrmTab';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from '@/components/ScreenState';
import { SelectField } from '@/components/SelectField';
import { getCalendarTheme } from '@/constants/calendarTheme';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { canSeeComercial, canSeeScheduledDispatches } from '@/services/permissions';
import {
  Agendamento,
  createNegocio,
  Crm,
  CrmEtapa,
  CrmFilial,
  CrmHistoricoCliente,
  CrmProduto,
  CrmResponsavel,
  CrmTag,
  deleteNegocio,
  editNegocio,
  getAgendamentos,
  getCrmDominios,
  getCrms,
  getHistoricoCliente,
  getNegociosPaginados,
  moveNegocio,
  Negocio,
  NegociosFiltro,
  registrarInteracao,
} from '@/services/vendasApi';
import { formatCurrency, formatDate, parseCurrencyInput } from '@/utils/format';
import {
  csvEscape,
  formatDayLabel,
  formatTime,
  formatWaiting,
  hoursSince,
  temperatureLabel,
  toISODate,
} from '@/utils/comercialHelpers';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

const SLA_WARNING_HOURS = 48;

// Cards carregados por coluna a cada requisição. O funil deixou de trazer toda a
// massa de negócios de uma vez; cada etapa pagina sob demanda via `Carregar mais`.
const STAGE_PAGE_SIZE = 12;

interface StagePageState {
  items: Negocio[];
  total: number;
  totalValor: number;
  pagina: number;
  totalPaginas: number;
  loading: boolean;
  loaded: boolean;
  countLoaded: boolean;
  error: string;
}

const EMPTY_STAGE: StagePageState = {
  items: [],
  total: 0,
  totalValor: 0,
  pagina: 0,
  totalPaginas: 0,
  loading: false,
  loaded: false,
  countLoaded: false,
  error: '',
};

const TEMPERATURE_OPTIONS: { key: string; label: string }[] = [
  { key: 'frio', label: 'Frio' },
  { key: 'morno', label: 'Morno' },
  { key: 'quente', label: 'Quente' },
];

const INTERACTION_TYPE_OPTIONS: { key: string; label: string }[] = [
  { key: 'call', label: 'Ligação' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'meeting', label: 'Reunião' },
  { key: 'email', label: 'E-mail' },
];

const TEMPERATURE_COLORS: Record<string, string> = {
  quente: '#FF6B6B',
  morno: '#F5A623',
  frio: '#7EA0FF',
};

interface QuoteLine {
  key: string;
  produtoId: number | null;
  nome: string;
  quantidade: string;
  preco: string;
}

let quoteLineSeq = 0;
function nextQuoteLineKey(): string {
  quoteLineSeq += 1;
  return `line-${quoteLineSeq}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Tempo esgotado em: ${label}`)), ms)
    ),
  ]);
}

const AGENDAMENTO_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  call: 'call-outline',
  meeting: 'people-outline',
  whatsapp: 'logo-whatsapp',
  email: 'mail-outline',
};

function agendamentoIcon(type: string): keyof typeof Ionicons.glyphMap {
  return AGENDAMENTO_ICONS[type] || 'calendar-outline';
}

function temperatureColor(temperature: string | null): string {
  if (!temperature) return '#A3A3A3';
  return TEMPERATURE_COLORS[temperature.toLowerCase()] || '#A3A3A3';
}

export default function ComercialScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'pipeline' | 'fechadas' | 'vendas' | 'dispatches' | 'dashboard' | 'reports' | 'settings'
  >('pipeline');

  const [crms, setCrms] = useState<Crm[]>([]);
  const [crmId, setCrmId] = useState<number | null>(null);
  const [crmSelectorOpen, setCrmSelectorOpen] = useState(false);
  const [filiais, setFiliais] = useState<CrmFilial[]>([]);

  const [etapas, setEtapas] = useState<CrmEtapa[]>([]);
  const [responsaveis, setResponsaveis] = useState<CrmResponsavel[]>([]);
  const [produtos, setProdutos] = useState<CrmProduto[]>([]);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [stageData, setStageData] = useState<Record<string, StagePageState>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Chaves `${filtersKey}::${etapaCodigo}` já buscadas — evita refetch em loop
  // quando o usuário só expande/colapsa colunas.
  const loadedRef = useRef<Set<string>>(new Set());
  const countRef = useRef<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOwnerId, setFilterOwnerId] = useState<number | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterDateStart, setFilterDateStart] = useState<Date | null>(null);
  const [filterDateEnd, setFilterDateEnd] = useState<Date | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);
  const [calendarSelected, setCalendarSelected] = useState<string>(toISODate(new Date()));
  const [exporting, setExporting] = useState(false);

  const [agendaOpen, setAgendaOpen] = useState(false);
  const [agendaMonth, setAgendaMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [agendaSelectedDay, setAgendaSelectedDay] = useState(() => toISODate(new Date()));
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState('');

  const [moveTarget, setMoveTarget] = useState<Negocio | null>(null);
  const [moving, setMoving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Negocio | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set());

  const [historicoDeal, setHistoricoDeal] = useState<Negocio | null>(null);
  const [historicoData, setHistoricoData] = useState<CrmHistoricoCliente | null>(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoError, setHistoricoError] = useState('');

  const [interactionDeal, setInteractionDeal] = useState<Negocio | null>(null);
  const [interactionMode, setInteractionMode] = useState<'log' | 'schedule'>('log');
  const [interactionType, setInteractionType] = useState('call');
  const [interactionDescription, setInteractionDescription] = useState('');
  const [interactionDate, setInteractionDate] = useState(() => toISODate(new Date()));
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDocumento, setNewDocumento] = useState('');
  const [newObservacoes, setNewObservacoes] = useState('');
  const [newTemperature, setNewTemperature] = useState('morno');
  const [newEtapaId, setNewEtapaId] = useState<number | null>(null);
  const [newOwnerId, setNewOwnerId] = useState<number | null>(null);
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [productPickerKey, setProductPickerKey] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');

  const allowed = !!user && canSeeComercial(user);

  const loadCrms = useCallback(() => {
    if (!user || !allowed) return;
    getCrms(user)
      .then((data) => {
        setCrms(data);
        let hasValidSelection = true;
        setCrmId((prev) => {
          if (prev && data.some((crm) => crm.id === prev)) return prev;
          hasValidSelection = false;
          const preferred = data.find((crm) => crm.master) || data[0] || null;
          return preferred ? preferred.id : null;
        });
        if (!hasValidSelection && data.length === 0) setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message || 'Não foi possível carregar os funis.');
        setLoading(false);
      });
  }, [user, allowed]);

  useEffect(() => {
    loadCrms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, allowed]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const serverFilters = useMemo<NegociosFiltro>(
    () => ({
      search: debouncedSearch || undefined,
      ownerId: filterOwnerId ?? undefined,
      tag: filterTag ?? undefined,
      dateStart: filterDateStart ? filterDateStart.toISOString() : undefined,
      dateEnd: filterDateEnd ? filterDateEnd.toISOString() : undefined,
    }),
    [debouncedSearch, filterOwnerId, filterTag, filterDateStart, filterDateEnd]
  );
  const filtersKey = useMemo(() => JSON.stringify(serverFilters), [serverFilters]);

  const loadDominios = useCallback(async () => {
    if (!user || !crmId) return;
    setError('');
    try {
      const dominios = await getCrmDominios(user, crmId);
      const stageList = (dominios.etapas || []).slice().sort((a, b) => a.ordem - b.ordem);
      setResponsaveis(dominios.responsaveis || []);
      setProdutos((dominios.produtos || []).filter((produto) => produto.ativo !== false));
      setTags(dominios.tags || []);
      setFiliais(dominios.filiais || []);
      setEtapas(stageList);
      setExpanded((prev) => {
        if (prev.size > 0) return prev;
        const initial = stageList.find((etapa) => etapa.eh_inicial) || stageList[0];
        return initial ? new Set([initial.codigo]) : new Set();
      });
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o funil.');
    }
  }, [user, crmId]);

  const fetchStagePage = useCallback(
    async (codigo: string, pagina: number, mode: 'replace' | 'append') => {
      if (!user || !crmId) return;
      setStageData((prev) => ({
        ...prev,
        [codigo]: { ...(prev[codigo] ?? EMPTY_STAGE), loading: true, error: '' },
      }));
      try {
        const page = await getNegociosPaginados(user, crmId, {
          ...serverFilters,
          stage: codigo,
          pagina,
          limite: STAGE_PAGE_SIZE,
        });
        setStageData((prev) => {
          const existing = prev[codigo] ?? EMPTY_STAGE;
          const items = mode === 'append' ? [...existing.items, ...page.items] : page.items;
          return {
            ...prev,
            [codigo]: {
              items,
              total: page.total,
              totalValor: page.total_valor,
              pagina: page.pagina,
              totalPaginas: page.total_paginas,
              loading: false,
              loaded: true,
              countLoaded: true,
              error: '',
            },
          };
        });
      } catch (err: any) {
        setStageData((prev) => ({
          ...prev,
          [codigo]: {
            ...(prev[codigo] ?? EMPTY_STAGE),
            loading: false,
            error: err?.message || 'Não foi possível carregar esta etapa.',
          },
        }));
      }
    },
    [user, crmId, serverFilters]
  );

  // Contagem/valor por coluna sem expandir: 1 linha só, barato no back.
  const fetchStageCount = useCallback(
    async (codigo: string) => {
      if (!user || !crmId) return;
      try {
        const page = await getNegociosPaginados(user, crmId, {
          ...serverFilters,
          stage: codigo,
          pagina: 1,
          limite: 1,
        });
        setStageData((prev) => {
          const existing = prev[codigo] ?? EMPTY_STAGE;
          if (existing.loaded) return prev; // página real já chegou
          return {
            ...prev,
            [codigo]: {
              ...existing,
              total: page.total,
              totalValor: page.total_valor,
              countLoaded: true,
            },
          };
        });
      } catch {
        // contagem é best-effort; silencia
      }
    },
    [user, crmId, serverFilters]
  );

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    await loadDominios();
    setLoading(false);
  }, [loadDominios]);

  // Troca de CRM / retry: recarrega domínios.
  useEffect(() => {
    if (!crmId) return;
    setLoading(true);
    loadDominios().finally(() => setLoading(false));
  }, [crmId, loadDominios]);

  // Invalida os lotes já carregados quando o CRM ou os filtros mudam.
  useEffect(() => {
    loadedRef.current = new Set();
    countRef.current = new Set();
    setStageData({});
  }, [filtersKey, crmId]);

  // Carrega a 1ª página só das colunas expandidas. Nada de burst de requests.
  useEffect(() => {
    if (!crmId || etapas.length === 0) return;
    etapas.forEach((etapa) => {
      if (!expanded.has(etapa.codigo)) return;
      const pageKey = `${filtersKey}::${etapa.codigo}`;
      if (loadedRef.current.has(pageKey)) return;
      loadedRef.current.add(pageKey);
      countRef.current.add(`count::${filtersKey}::${etapa.codigo}`);
      fetchStagePage(etapa.codigo, 1, 'replace');
    });
  }, [crmId, etapas, expanded, filtersKey, fetchStagePage]);

  // Contagem/valor das colunas colapsadas: trickle sequencial, começa 1s depois
  // do paint pra não competir com a coluna aberta. Cancelável.
  useEffect(() => {
    if (!crmId || etapas.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      for (const etapa of etapas) {
        if (cancelled) return;
        if (expanded.has(etapa.codigo)) continue;
        const countKey = `count::${filtersKey}::${etapa.codigo}`;
        if (countRef.current.has(countKey)) continue;
        countRef.current.add(countKey);
        await fetchStageCount(etapa.codigo);
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [crmId, etapas, expanded, filtersKey, fetchStageCount]);

  const loadMoreStage = useCallback(
    (codigo: string) => {
      const st = stageData[codigo];
      if (!st || st.loading || st.pagina >= st.totalPaginas) return;
      fetchStagePage(codigo, st.pagina + 1, 'append');
    },
    [stageData, fetchStagePage]
  );

  const reloadStages = useCallback(
    (codigos: (string | null | undefined)[]) => {
      const uniq = Array.from(new Set(codigos.filter((c): c is string => !!c)));
      uniq.forEach((codigo) => {
        loadedRef.current.add(`${filtersKey}::${codigo}`);
        fetchStagePage(codigo, 1, 'replace');
      });
    },
    [filtersKey, fetchStagePage]
  );

  useEffect(() => {
    if (!user || !crmId || !agendaOpen) return;
    setAgendaLoading(true);
    setAgendaError('');
    const dateStart = new Date(agendaMonth.getFullYear(), agendaMonth.getMonth(), 1).toISOString();
    const dateEnd = new Date(agendaMonth.getFullYear(), agendaMonth.getMonth() + 1, 1).toISOString();
    getAgendamentos(user, { crmId, dateStart, dateEnd })
      .then(setAgendamentos)
      .catch((err: any) => {
        setAgendamentos([]);
        setAgendaError(err?.message || 'Não foi possível carregar a agenda.');
      })
      .finally(() => setAgendaLoading(false));
  }, [user, crmId, agendaOpen, agendaMonth]);

  async function handleRefresh() {
    setRefreshing(true);
    loadedRef.current = new Set();
    countRef.current = new Set();
    await loadDominios();
    const alvos = etapas.filter((etapa) => expanded.has(etapa.codigo));
    await Promise.all(
      alvos.map((etapa) => {
        loadedRef.current.add(`${filtersKey}::${etapa.codigo}`);
        countRef.current.add(`count::${filtersKey}::${etapa.codigo}`);
        return fetchStagePage(etapa.codigo, 1, 'replace');
      })
    );
    setRefreshing(false);
  }

  async function handleMoveTo(etapa: CrmEtapa) {
    if (!user || !crmId || !moveTarget) return;
    const deal = moveTarget;
    setMoving(true);
    try {
      await moveNegocio(user, { crmId, negocioId: deal.id, etapaId: etapa.id });
      setExpanded((prev) => new Set(prev).add(etapa.codigo));
      setMoveTarget(null);
      reloadStages([deal.stage, etapa.codigo]);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível mover o negócio.');
    } finally {
      setMoving(false);
    }
  }

  function openCreateModal() {
    setEditingDeal(null);
    setNewContactName('');
    setNewCompanyName('');
    setNewPhone('');
    setNewAmount('');
    setNewEmail('');
    setNewDocumento('');
    setNewObservacoes('');
    setNewTemperature('morno');
    const initial = etapas.find((etapa) => etapa.eh_inicial) || etapas[0] || null;
    setNewEtapaId(initial?.id ?? null);
    setNewOwnerId(user ? Number(user.id) : null);
    setQuoteLines([]);
    setProductPickerKey(null);
    setProductSearch('');
    setCreateOpen(true);
  }

  function openEditModal(deal: Negocio) {
    setEditingDeal(deal);
    setNewContactName(deal.contactName || '');
    setNewCompanyName(deal.companyName || '');
    setNewPhone(deal.customerPhone || '');
    setNewAmount(deal.amount ? String(deal.amount) : '');
    setNewEmail(deal.customerEmail || '');
    setNewDocumento(deal.customerDocument || '');
    setNewObservacoes(deal.saleNotes || '');
    setNewTemperature(deal.temperature || 'morno');
    const etapaAtual = etapas.find((etapa) => etapa.codigo === deal.stage);
    setNewEtapaId(etapaAtual?.id ?? null);
    setNewOwnerId(deal.ownerId ? Number(deal.ownerId) : null);
    setQuoteLines(
      (deal.products || []).map((item) => ({
        key: nextQuoteLineKey(),
        produtoId: item.comercialProdutoId ?? null,
        nome: item.name,
        quantidade: String(item.quantity),
        preco: String(item.price),
      }))
    );
    setProductPickerKey(null);
    setProductSearch('');
    setCreateOpen(true);
  }

  function confirmDeleteDeal(deal: Negocio) {
    Alert.alert(
      'Excluir negócio',
      `Excluir "${deal.contactName || deal.title}"? Essa ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setDeletingId(deal.id);
            try {
              await deleteNegocio(user, deal.id);
              reloadStages([deal.stage]);
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível excluir o negócio.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }

  function toggleDealExpanded(dealId: string) {
    setExpandedDeals((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  }

  function openHistorico(deal: Negocio) {
    if (!user) return;
    setHistoricoDeal(deal);
    setHistoricoData(null);
    setHistoricoError('');
    setHistoricoLoading(true);
    getHistoricoCliente(user, deal.id)
      .then(setHistoricoData)
      .catch((err: any) => setHistoricoError(err?.message || 'Não foi possível carregar o histórico.'))
      .finally(() => setHistoricoLoading(false));
  }

  function openInteractionModal(deal: Negocio, mode: 'log' | 'schedule') {
    setInteractionDeal(deal);
    setInteractionMode(mode);
    setInteractionType('call');
    setInteractionDescription('');
    setInteractionDate(toISODate(new Date()));
  }

  async function handleSaveInteraction() {
    if (!user || !interactionDeal) return;
    setSavingInteraction(true);
    try {
      await registrarInteracao(user, {
        negocioId: interactionDeal.id,
        type: interactionType,
        description: interactionDescription.trim() || undefined,
        category: interactionMode === 'schedule' ? 'agendamento' : undefined,
        date: interactionMode === 'schedule' ? new Date(`${interactionDate}T09:00:00`).toISOString() : undefined,
      });
      const dealStage = interactionDeal.stage;
      setInteractionDeal(null);
      reloadStages([dealStage]);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar.');
    } finally {
      setSavingInteraction(false);
    }
  }

  function addQuoteLine() {
    setQuoteLines((prev) => [
      ...prev,
      { key: nextQuoteLineKey(), produtoId: null, nome: '', quantidade: '1', preco: '0' },
    ]);
  }

  function removeQuoteLine(key: string) {
    setTimeout(() => {
      setQuoteLines((prev) => prev.filter((line) => line.key !== key));
    }, 0);
  }

  function updateQuoteLine(key: string, patch: Partial<QuoteLine>) {
    setQuoteLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function pickProductForLine(key: string, produto: CrmProduto) {
    updateQuoteLine(key, {
      produtoId: produto.id,
      nome: produto.nome,
      preco: String(produto.preco_base ?? 0),
    });
    setTimeout(() => {
      setProductPickerKey(null);
      setProductSearch('');
    }, 0);
  }

  const quoteTotals = useMemo(() => {
    let quantidadeTotal = 0;
    let total = 0;
    for (const line of quoteLines) {
      const quantidade = Number(line.quantidade) || 0;
      const preco = parseCurrencyInput(line.preco) ?? 0;
      quantidadeTotal += quantidade;
      total += quantidade * preco;
    }
    return { itemCount: quoteLines.length, quantidadeTotal, total };
  }, [quoteLines]);

  async function handleCreate() {
    if (!user || !crmId) return;
    const contactName = newContactName.trim();
    if (!contactName) {
      Alert.alert('Nome obrigatório', 'Informe o nome do contato.');
      return;
    }
    const customerPhone = newPhone.trim();
    if (!customerPhone) {
      Alert.alert('Telefone obrigatório', 'Informe o telefone do contato.');
      return;
    }
    setCreating(true);
    try {
      const amount = parseCurrencyInput(newAmount) ?? undefined;
      const products = quoteLines
        .filter((line) => line.nome.trim())
        .map((line) => ({
          name: line.nome.trim(),
          quantity: Number(line.quantidade) || 1,
          price: parseCurrencyInput(line.preco) ?? 0,
          comercialProdutoId: line.produtoId ?? undefined,
        }));
      const dealPayload = {
        crmId,
        etapaId: newEtapaId ?? undefined,
        contactName,
        companyName: newCompanyName.trim() || undefined,
        customerPhone,
        customerEmail: newEmail.trim() || undefined,
        customerDocument: newDocumento.trim() || undefined,
        amount,
        temperature: newTemperature,
        ownerId: newOwnerId ?? undefined,
        saleNotes: newObservacoes.trim() || undefined,
        products: products.length ? products : undefined,
      };
      const saved = editingDeal
        ? await editNegocio(user, { negocioId: editingDeal.id, ...dealPayload })
        : await createNegocio(user, dealPayload);
      setExpanded((prev) => new Set(prev).add(saved.stage));
      setCreateOpen(false);
      reloadStages([saved.stage, editingDeal && editingDeal.stage !== saved.stage ? editingDeal.stage : null]);
      setEditingDeal(null);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o negócio.');
    } finally {
      setCreating(false);
    }
  }

  function toggleStage(codigo: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  }

  const agendaByDay = useMemo(() => {
    const groups = new Map<string, Agendamento[]>();
    for (const item of agendamentos) {
      if (!item.startDate) continue;
      const day = toISODate(new Date(item.startDate));
      const list = groups.get(day) || [];
      list.push(item);
      groups.set(day, list);
    }
    return groups;
  }, [agendamentos]);

  const agendaSelectedDayItems = agendaByDay.get(agendaSelectedDay) || [];

  const agendaMarkedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const day of agendaByDay.keys()) {
      marks[day] = { marked: true, dotColor: colors.accent };
    }
    marks[agendaSelectedDay] = {
      ...(marks[agendaSelectedDay] || {}),
      selected: true,
      selectedColor: colors.accent,
      selectedTextColor: '#141414',
    };
    return marks;
  }, [agendaByDay, agendaSelectedDay, colors]);

  const activeFilterCount =
    (filterOwnerId !== null ? 1 : 0) +
    (filterTag !== null ? 1 : 0) +
    (filterDateStart !== null || filterDateEnd !== null ? 1 : 0);

  function clearFilters() {
    setFilterOwnerId(null);
    setFilterTag(null);
    setFilterDateStart(null);
    setFilterDateEnd(null);
  }

  // Busca e filtros agora vão pro servidor (ver `serverFilters`). Cada coluna
  // guarda seu próprio lote paginado em `stageData`.
  const stageGroups = useMemo(() => {
    return etapas.map((etapa) => {
      const st = stageData[etapa.codigo] ?? EMPTY_STAGE;
      return {
        etapa,
        st,
        deals: st.items,
        count: st.total,
        valorTotal: st.totalValor,
        hasCount: st.loaded || st.countLoaded,
      };
    });
  }, [etapas, stageData]);

  const selectedCrm = crms.find((crm) => crm.id === crmId) || null;

  // O funil não mantém mais todos os negócios em memória; para exportar,
  // percorre as páginas de cada etapa aplicando os filtros ativos.
  async function fetchAllForExport(): Promise<Negocio[]> {
    if (!user || !crmId) return [];
    const all: Negocio[] = [];
    for (const etapa of etapas) {
      let pagina = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const page = await getNegociosPaginados(user, crmId, {
          ...serverFilters,
          stage: etapa.codigo,
          pagina,
          limite: 100,
        });
        all.push(...page.items);
        if (page.items.length === 0 || pagina >= page.total_paginas) break;
        pagina += 1;
      }
    }
    return all;
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const deals = await withTimeout(fetchAllForExport(), 60000, 'carregar negócios para exportar');
      if (deals.length === 0) {
        Alert.alert('Nada para exportar', 'Não há negócios na lista atual (confira os filtros).');
        return;
      }
      const header = [
        'Etapa', 'Título', 'Contato', 'Empresa', 'Telefone', 'E-mail',
        'Valor', 'Temperatura', 'Responsável', 'Data de entrada', 'Tags',
      ];
      const rows = deals.map((deal) => {
        const etapa = etapas.find((e) => e.codigo === deal.stage);
        return [
          etapa?.nome || deal.stage,
          deal.title,
          deal.contactName || '',
          deal.companyName || '',
          deal.customerPhone || '',
          deal.customerEmail || '',
          String(deal.amount ?? 0).replace('.', ','),
          deal.temperature || '',
          deal.ownerName || '',
          deal.entryDate ? formatDate(deal.entryDate) : '',
          deal.tags.join('; '),
        ];
      });
      const csvBody = [header, ...rows].map((row) => row.map(csvEscape).join(';')).join('\r\n');
      const csvContent = `﻿${csvBody}`;

      const fileName = `funil-${(selectedCrm?.nome || 'comercial').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${toISODate(new Date())}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await withTimeout(
        FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 }),
        10000,
        'escrever o arquivo'
      );

      const canShare = await withTimeout(Sharing.isAvailableAsync(), 10000, 'verificar compartilhamento');
      if (!canShare) {
        Alert.alert('Exportação pronta', `Arquivo salvo em: ${fileUri}`);
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Exportar funil',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível exportar o funil.');
    } finally {
      setExporting(false);
    }
  }

  if (!user || !allowed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="Comercial" onMenuPress={() => setDrawerOpen(true)} />
        <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/comercial" />
        <PermissionDeniedState message="Você não tem acesso ao funil comercial." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Comercial" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/comercial" />

      <View style={styles.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarScroll}
          contentContainerStyle={styles.tabBar}
        >
          <Pressable style={styles.tabButton} onPress={() => setActiveTab('pipeline')}>
            <Text style={[styles.tabButtonText, activeTab === 'pipeline' && styles.tabButtonTextActive]}>
              Pipeline
            </Text>
            {activeTab === 'pipeline' && <View style={styles.tabUnderline} />}
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => setActiveTab('fechadas')}>
            <Text style={[styles.tabButtonText, activeTab === 'fechadas' && styles.tabButtonTextActive]}>
              Fechadas
            </Text>
            {activeTab === 'fechadas' && <View style={styles.tabUnderline} />}
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => setActiveTab('vendas')}>
            <Text style={[styles.tabButtonText, activeTab === 'vendas' && styles.tabButtonTextActive]}>
              Vendas
            </Text>
            {activeTab === 'vendas' && <View style={styles.tabUnderline} />}
          </Pressable>
          {canSeeScheduledDispatches(user) && (
            <Pressable style={styles.tabButton} onPress={() => setActiveTab('dispatches')}>
              <Text style={[styles.tabButtonText, activeTab === 'dispatches' && styles.tabButtonTextActive]}>
                Agendar disparos
              </Text>
              {activeTab === 'dispatches' && <View style={styles.tabUnderline} />}
            </Pressable>
          )}
          <Pressable style={styles.tabButton} onPress={() => setActiveTab('dashboard')}>
            <Text style={[styles.tabButtonText, activeTab === 'dashboard' && styles.tabButtonTextActive]}>
              Dashboard
            </Text>
            {activeTab === 'dashboard' && <View style={styles.tabUnderline} />}
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => setActiveTab('reports')}>
            <Text style={[styles.tabButtonText, activeTab === 'reports' && styles.tabButtonTextActive]}>
              Relatórios
            </Text>
            {activeTab === 'reports' && <View style={styles.tabUnderline} />}
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => setActiveTab('settings')}>
            <Text style={[styles.tabButtonText, activeTab === 'settings' && styles.tabButtonTextActive]}>
              Configurações
            </Text>
            {activeTab === 'settings' && <View style={styles.tabUnderline} />}
          </Pressable>
        </ScrollView>
        <LinearGradient
          colors={['rgba(20,20,20,0)', colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.tabBarFade}
          pointerEvents="none"
        />
      </View>

      <View style={styles.topBar}>
        <Pressable
          style={styles.crmSelect}
          onPress={() => crms.length > 0 && setCrmSelectorOpen((prev) => !prev)}
          disabled={crms.length === 0}
        >
          <Text style={styles.crmSelectLabel} numberOfLines={1}>
            {selectedCrm?.nome || 'Funil comercial'}
          </Text>
          {crms.length > 0 && (
            <Ionicons name={crmSelectorOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
          )}
        </Pressable>
        {crmSelectorOpen && (
          <View style={styles.crmOptions}>
            {crms.map((crm) => (
              <Pressable
                key={crm.id}
                style={styles.crmOptionRow}
                onPress={() => {
                  setCrmId(crm.id);
                  setExpanded(new Set());
                  setTimeout(() => setCrmSelectorOpen(false), 0);
                }}
              >
                <Text style={[styles.crmOptionText, crm.id === crmId && styles.crmOptionActive]}>
                  {crm.nome}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {activeTab === 'pipeline' && (
          <>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={15} color={colors.muted} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar por nome, empresa ou telefone"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                />
              </View>

              <Pressable style={styles.iconActionButton} onPress={() => setFilterOpen(true)}>
                <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? colors.accent : colors.muted} />
                <Pressable
                  style={[styles.filterBadge, activeFilterCount === 0 && styles.filterBadgeHidden]}
                  onPress={clearFilters}
                  hitSlop={10}
                  pointerEvents={activeFilterCount > 0 ? 'auto' : 'none'}
                >
                  <Ionicons name="close" size={10} color="#141414" />
                </Pressable>
              </Pressable>

              <Pressable style={styles.labeledActionButton} onPress={() => setAgendaOpen(true)}>
                <Ionicons name="calendar-outline" size={16} color={colors.muted} />
                <Text style={styles.labeledActionButtonText}>Agenda</Text>
              </Pressable>

              <Pressable
                style={styles.labeledActionButton}
                disabled={exporting}
                onPress={handleExportExcel}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.muted} />
                ) : (
                  <Ionicons name="download-outline" size={16} color={colors.muted} />
                )}
                <Text style={styles.labeledActionButtonText}>Excel</Text>
              </Pressable>
            </View>

            <Pressable style={styles.newDealButton} onPress={openCreateModal} disabled={etapas.length === 0}>
              <Ionicons name="add" size={16} color="#141414" />
              <Text style={styles.newDealButtonText}>Novo atendimento</Text>
            </Pressable>
          </>
        )}
      </View>

      {activeTab === 'fechadas' ? (
        <FechadasCrmTab user={user} crmId={crmId} crmNome={selectedCrm?.nome || null} responsaveis={responsaveis} />
      ) : activeTab === 'vendas' ? (
        <VendasCrmTab user={user} responsaveis={responsaveis} />
      ) : activeTab === 'dispatches' ? (
        <ScheduleDispatchTab user={user} crmId={crmId} crmNome={selectedCrm?.nome || null} etapas={etapas} />
      ) : activeTab === 'dashboard' ? (
        <DashboardCrmTab user={user} crmId={crmId} responsaveis={responsaveis} filiais={filiais} />
      ) : activeTab === 'reports' ? (
        <ReportsCrmTab
          user={user}
          crmId={crmId}
          crmNome={selectedCrm?.nome || null}
          responsaveis={responsaveis}
          filiais={filiais}
          produtos={produtos}
        />
      ) : activeTab === 'settings' ? (
        <ConfiguracoesCrmTab user={user} crms={crms} filiais={filiais} onCrmsChanged={loadCrms} />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState icon="alert-circle-outline" title="Erro ao carregar" message={error} onRetry={loadPipeline} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        >
          {stageGroups.map(({ etapa, st, deals, count, valorTotal, hasCount }) => {
            const isOpen = expanded.has(etapa.codigo);
            const showInitialLoader = isOpen && st.loading && deals.length === 0;
            const hasMore = st.pagina > 0 && st.pagina < st.totalPaginas;
            return (
              <View key={etapa.id} style={styles.stageCard}>
                <Pressable style={styles.stageHeader} onPress={() => toggleStage(etapa.codigo)}>
                  <View style={styles.stageHeaderLeft}>
                    <View style={[styles.stageDot, { backgroundColor: etapa.cor || colors.accent }]} />
                    <Text style={styles.stageName}>{etapa.nome}</Text>
                    <View style={styles.stageCountBadge}>
                      <Text style={styles.stageCountText}>{hasCount ? count : '…'}</Text>
                    </View>
                  </View>
                  <View style={styles.stageHeaderRight}>
                    <Text style={styles.stageValue}>{hasCount ? formatCurrency(valorTotal) : '—'}</Text>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                  </View>
                </Pressable>

                {isOpen && (
                  <View style={styles.stageBody}>
                    {showInitialLoader ? (
                      <ActivityIndicator color={colors.accent} style={styles.stageLoader} />
                    ) : st.error ? (
                      <Pressable onPress={() => fetchStagePage(etapa.codigo, 1, 'replace')}>
                        <Text style={styles.emptyStageText}>{st.error} Toque para tentar de novo.</Text>
                      </Pressable>
                    ) : deals.length === 0 ? (
                      <Text style={styles.emptyStageText}>Nenhum negócio nesta etapa.</Text>
                    ) : (
                      deals.map((deal) => {
                        const hours = hoursSince(deal.entryDate || deal.createdAt);
                        const isUrgent = !etapa.eh_fechamento && hours !== null && hours >= SLA_WARNING_HOURS;
                        return (
                          <Pressable
                            key={deal.id}
                            style={styles.dealCard}
                            onLongPress={() => setMoveTarget(deal)}
                            delayLongPress={350}
                          >
                            <View style={styles.dealHeader}>
                              <Text style={styles.dealName} numberOfLines={1}>
                                {deal.contactName || deal.title}
                              </Text>
                              <View style={styles.dealBadgeGroup}>
                                {!!deal.hasOpenInteraction && (
                                  <View style={styles.attentionBadge}>
                                    <Text style={styles.attentionBadgeText}>ATENÇÃO</Text>
                                  </View>
                                )}
                                {!!deal.temperature && (
                                  <View
                                    style={[
                                      styles.tempBadge,
                                      { backgroundColor: `${temperatureColor(deal.temperature)}22` },
                                    ]}
                                  >
                                    <Text style={[styles.tempBadgeText, { color: temperatureColor(deal.temperature) }]}>
                                      {temperatureLabel(deal.temperature)}
                                    </Text>
                                  </View>
                                )}
                                <Pressable
                                  hitSlop={6}
                                  style={styles.dealIconButton}
                                  onPress={() => openEditModal(deal)}
                                >
                                  <Ionicons name="pencil-outline" size={13} color={colors.muted} />
                                </Pressable>
                                <Pressable
                                  hitSlop={6}
                                  style={styles.dealIconButton}
                                  disabled={deletingId === deal.id}
                                  onPress={() => confirmDeleteDeal(deal)}
                                >
                                  {deletingId === deal.id ? (
                                    <ActivityIndicator size="small" color="#FF6B6B" />
                                  ) : (
                                    <Ionicons name="trash-outline" size={13} color="#FF6B6B" />
                                  )}
                                </Pressable>
                              </View>
                            </View>

                            {!!deal.companyName && (
                              <Text style={styles.dealSubtitle} numberOfLines={1}>
                                {deal.companyName}
                              </Text>
                            )}

                            <View style={styles.dealBudgetRow}>
                              <Ionicons name="cart-outline" size={12} color={colors.muted} />
                              <Text style={styles.dealBudgetText} numberOfLines={1}>
                                {deal.products?.length || 0} item(ns)
                              </Text>
                              <Text style={styles.dealAmount}>{formatCurrency(deal.amount)}</Text>
                            </View>

                            <View style={styles.dealInfoRow}>
                              <View style={styles.dealInfoItem}>
                                <Ionicons name="call-outline" size={12} color={colors.muted} />
                                <Text style={styles.dealInfoText} numberOfLines={1}>
                                  {deal.customerPhone || '-'}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.dealFooterRow}>
                              <Text style={styles.dealOwner} numberOfLines={1}>
                                {deal.ownerName ? `Aguardando com ${deal.ownerName}` : 'Sem responsável'}
                              </Text>
                              {hours !== null && (
                                <View style={[styles.waitBadge, isUrgent && styles.waitBadgeUrgent]}>
                                  <Ionicons
                                    name="time-outline"
                                    size={11}
                                    color={isUrgent ? '#FF6B6B' : colors.muted}
                                  />
                                  <Text style={[styles.waitText, isUrgent && styles.waitTextUrgent]}>
                                    {formatWaiting(hours)}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {expandedDeals.has(deal.id) && (
                              <View style={styles.dealActionsRow}>
                                <Pressable
                                  style={styles.dealActionButton}
                                  onPress={() => openHistorico(deal)}
                                >
                                  <Ionicons name="time-outline" size={14} color={colors.accent} />
                                  <Text style={styles.dealActionText}>Histórico</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.dealActionButton}
                                  onPress={() => openInteractionModal(deal, 'log')}
                                >
                                  <Ionicons name="chatbubble-outline" size={14} color={colors.accent} />
                                  <Text style={styles.dealActionText}>Registrar</Text>
                                </Pressable>
                                <Pressable
                                  style={styles.dealActionButton}
                                  onPress={() => openInteractionModal(deal, 'schedule')}
                                >
                                  <Ionicons name="calendar-outline" size={14} color={colors.accent} />
                                  <Text style={styles.dealActionText}>Agendar</Text>
                                </Pressable>
                              </View>
                            )}

                            <View style={styles.dealBottomRow}>
                              <Pressable
                                style={styles.seeMoreButton}
                                onPress={() => toggleDealExpanded(deal.id)}
                                hitSlop={6}
                              >
                                <Text style={styles.seeMoreText}>
                                  {expandedDeals.has(deal.id) ? 'Ver menos' : 'Ver mais'}
                                </Text>
                                <Ionicons
                                  name={expandedDeals.has(deal.id) ? 'chevron-up' : 'chevron-down'}
                                  size={12}
                                  color={colors.accent}
                                />
                              </Pressable>

                              <Pressable style={styles.moveButton} onPress={() => setMoveTarget(deal)}>
                                <Text style={styles.moveButtonText}>Mover</Text>
                                <Ionicons name="chevron-down" size={12} color="#141414" />
                              </Pressable>
                            </View>
                          </Pressable>
                        );
                      })
                    )}

                    {hasMore && (
                      <Pressable
                        style={styles.loadMoreButton}
                        onPress={() => loadMoreStage(etapa.codigo)}
                        disabled={st.loading}
                      >
                        {st.loading ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <>
                            <Text style={styles.loadMoreText}>
                              Carregar mais ({Math.max(st.total - deals.length, 0)})
                            </Text>
                            <Ionicons name="chevron-down" size={13} color={colors.accent} />
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {stageGroups.length === 0 && (
            <EmptyState
              icon="funnel-outline"
              title="Nenhuma etapa configurada"
              message="Configure as colunas deste funil na versão web."
            />
          )}
        </ScrollView>
      )}

      <Modal visible={!!moveTarget} transparent animationType="fade" onRequestClose={() => setMoveTarget(null)}>
        <Pressable style={styles.moveOverlay} onPress={() => setMoveTarget(null)}>
          <View style={styles.moveSheet}>
            <Text style={styles.moveSheetTitle} numberOfLines={1}>
              Mover {moveTarget?.contactName || moveTarget?.title}
            </Text>
            {etapas
              .filter((etapa) => etapa.codigo !== moveTarget?.stage)
              .map((etapa) => (
                <Pressable
                  key={etapa.id}
                  style={styles.moveOption}
                  disabled={moving}
                  onPress={() => handleMoveTo(etapa)}
                >
                  <View style={[styles.stageDot, { backgroundColor: etapa.cor || colors.accent }]} />
                  <Text style={styles.moveOptionText}>{etapa.nome}</Text>
                </Pressable>
              ))}
            {moving && <ActivityIndicator color={colors.muted} style={styles.moveLoading} />}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={createOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCreateOpen(false);
          setEditingDeal(null);
        }}
      >
        <View style={styles.createOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (creating) return;
              setCreateOpen(false);
              setEditingDeal(null);
            }}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.createSheet}>
              <View style={styles.createHeader}>
                <Text style={styles.createTitle}>{editingDeal ? 'Editar negócio' : 'Novo atendimento'}</Text>
                <Pressable
                  onPress={() => {
                    setCreateOpen(false);
                    setEditingDeal(null);
                  }}
                  hitSlop={12}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.createForm} keyboardShouldPersistTaps="handled">
                <View style={styles.field}>
                  <Text style={styles.label}>Nome do contato *</Text>
                  <TextInput
                    style={styles.input}
                    value={newContactName}
                    onChangeText={setNewContactName}
                    placeholder="Nome do cliente"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Empresa</Text>
                  <TextInput
                    style={styles.input}
                    value={newCompanyName}
                    onChangeText={setNewCompanyName}
                    placeholder="Opcional"
                    placeholderTextColor={colors.muted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Telefone *</Text>
                  <TextInput
                    style={styles.input}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    placeholder="5599999999999"
                    placeholderTextColor={colors.muted}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>E-mail</Text>
                  <TextInput
                    style={styles.input}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="Opcional"
                    placeholderTextColor={colors.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Documento (CPF/CNPJ)</Text>
                  <TextInput
                    style={styles.input}
                    value={newDocumento}
                    onChangeText={setNewDocumento}
                    placeholder="Opcional"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Valor estimado</Text>
                  <TextInput
                    style={styles.input}
                    value={newAmount}
                    onChangeText={setNewAmount}
                    placeholder="R$ 0,00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Temperatura</Text>
                  <View style={styles.segmentRow}>
                    {TEMPERATURE_OPTIONS.map((option) => {
                      const active = newTemperature === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          style={[styles.segmentOption, active && styles.segmentOptionActive]}
                          onPress={() => setNewTemperature(option.key)}
                        >
                          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Etapa</Text>
                  <View style={styles.segmentRow}>
                    {etapas.map((etapa) => {
                      const active = newEtapaId === etapa.id;
                      return (
                        <Pressable
                          key={etapa.id}
                          style={[styles.segmentOption, active && styles.segmentOptionActive]}
                          onPress={() => setNewEtapaId(etapa.id)}
                        >
                          <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
                            {etapa.nome}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Atendente</Text>
                  <SelectField
                    value={newOwnerId}
                    onChange={(id) => setNewOwnerId(id as number | null)}
                    placeholder="Selecionar responsável"
                    options={responsaveis.map((responsavel) => ({
                      id: responsavel.id,
                      label: responsavel.nome,
                    }))}
                  />
                </View>

                <View style={styles.quoteSection}>
                  <View style={styles.quoteSectionHeader}>
                    <View style={styles.quoteSectionHeaderText}>
                      <Text style={styles.quoteSectionTitle}>Orçamento opcional</Text>
                      <Text style={styles.quoteSectionSubtitle}>
                        Adicione produtos apenas se quiser montar o orçamento agora.
                      </Text>
                    </View>
                    <Pressable style={styles.addLineButton} onPress={addQuoteLine}>
                      <Ionicons name="add" size={14} color={colors.accent} />
                      <Text style={styles.addLineButtonText}>Adicionar linha</Text>
                    </Pressable>
                  </View>

                  {quoteLines.map((line) => (
                    <View key={line.key} style={styles.quoteLine}>
                      <View style={styles.quoteLineTopRow}>
                        <TextInput
                          style={[styles.input, styles.quoteNameInput]}
                          value={line.nome}
                          onChangeText={(value) => updateQuoteLine(line.key, { nome: value, produtoId: null })}
                          placeholder="Nome do item"
                          placeholderTextColor={colors.muted}
                        />
                        <Pressable
                          style={styles.quoteCatalogButton}
                          onPress={() => {
                            setProductPickerKey((prev) => (prev === line.key ? null : line.key));
                            setProductSearch('');
                          }}
                        >
                          <Ionicons name="pricetags-outline" size={16} color={colors.accent} />
                        </Pressable>
                      </View>

                      {productPickerKey === line.key && (
                        <View style={styles.quoteProductBox}>
                          <TextInput
                            style={styles.quoteProductSearchInput}
                            value={productSearch}
                            onChangeText={setProductSearch}
                            placeholder="Buscar produto cadastrado"
                            placeholderTextColor={colors.muted}
                          />
                          {produtos
                            .filter((produto) =>
                              produto.nome.toLowerCase().includes(productSearch.trim().toLowerCase())
                            )
                            .map((produto) => (
                              <Pressable
                                key={produto.id}
                                style={styles.quoteProductOption}
                                onPress={() => pickProductForLine(line.key, produto)}
                              >
                                <Text style={styles.moveOptionText} numberOfLines={1}>
                                  {produto.nome}
                                </Text>
                                <Text style={styles.quoteProductPrice}>
                                  {formatCurrency(Number(produto.preco_base) || 0)}
                                </Text>
                              </Pressable>
                            ))}
                          {produtos.length === 0 && (
                            <Text style={styles.emptyStageText}>Nenhum produto cadastrado no catálogo.</Text>
                          )}
                        </View>
                      )}

                      <View style={styles.quoteLineRow}>
                        <TextInput
                          style={[styles.input, styles.quoteQtyInput]}
                          value={line.quantidade}
                          onChangeText={(value) => updateQuoteLine(line.key, { quantidade: value })}
                          placeholder="1"
                          placeholderTextColor={colors.muted}
                          keyboardType="number-pad"
                        />
                        <TextInput
                          style={[styles.input, styles.quotePriceInput]}
                          value={line.preco}
                          onChangeText={(value) => updateQuoteLine(line.key, { preco: value })}
                          placeholder="0"
                          placeholderTextColor={colors.muted}
                          keyboardType="decimal-pad"
                        />
                        <Pressable style={styles.quoteRemoveButton} onPress={() => removeQuoteLine(line.key)}>
                          <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                        </Pressable>
                      </View>
                    </View>
                  ))}

                  {quoteLines.length > 0 && (
                    <View style={styles.quoteTotalsRow}>
                      <Text style={styles.quoteTotalsText}>{quoteTotals.itemCount} item(ns)</Text>
                      <Text style={styles.quoteTotalsText}>Qtd. total: {quoteTotals.quantidadeTotal}</Text>
                      <Text style={styles.quoteTotalsTextStrong}>{formatCurrency(quoteTotals.total)}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Observações</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={newObservacoes}
                    onChangeText={setNewObservacoes}
                    placeholder="Ex.: prazo de entrega, condições comerciais, observações gerais."
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.footer}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => {
                      setCreateOpen(false);
                      setEditingDeal(null);
                    }}
                    disabled={creating}
                  >
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, creating && styles.submitDisabled]}
                    onPress={handleCreate}
                    disabled={creating}
                  >
                    {creating ? (
                      <ActivityIndicator color="#141414" />
                    ) : (
                      <Text style={styles.submitText}>{editingDeal ? 'Salvar alterações' : 'Criar negócio'}</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => (datePickerTarget ? setDatePickerTarget(null) : setFilterOpen(false))}
      >
        <View style={styles.createOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => (datePickerTarget ? setDatePickerTarget(null) : setFilterOpen(false))}
          />
          <View style={styles.createSheet}>
            {datePickerTarget === null ? (
              <>
                <View style={styles.createHeader}>
                  <Text style={styles.createTitle}>Filtros</Text>
                  <Pressable onPress={() => setFilterOpen(false)} hitSlop={12} style={styles.closeButton}>
                    <Ionicons name="close" size={20} color={colors.textPrimary} />
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.createForm} keyboardShouldPersistTaps="handled">
                  <View style={styles.field}>
                    <Text style={styles.label}>Vendedor</Text>
                    <SelectField
                      value={filterOwnerId}
                      onChange={(id) => setFilterOwnerId(id as number | null)}
                      placeholder="Todos"
                      options={[
                        { id: null, label: 'Todos' },
                        ...responsaveis.map((responsavel) => ({
                          id: responsavel.id,
                          label: responsavel.nome,
                        })),
                      ]}
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Tag</Text>
                    {tags.length === 0 ? (
                      <Text style={styles.emptyStageText}>Nenhuma tag cadastrada.</Text>
                    ) : (
                      <SelectField
                        value={filterTag}
                        onChange={(nome) => setFilterTag(nome as string | null)}
                        placeholder="Todas"
                        options={[
                          { id: null, label: 'Todas' },
                          ...tags.map((tag) => ({ id: tag.nome, label: tag.nome })),
                        ]}
                      />
                    )}
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Período (entrada no funil)</Text>
                    <View style={styles.dateRangeRow}>
                      <Pressable
                        style={styles.dateButton}
                        onPress={() => {
                          setCalendarSelected(toISODate(filterDateStart || new Date()));
                          setTimeout(() => setDatePickerTarget('start'), 0);
                        }}
                      >
                        <Ionicons name="calendar-outline" size={15} color={colors.accent} />
                        <Text style={filterDateStart ? styles.dateValue : styles.datePlaceholder}>
                          {filterDateStart ? formatDate(filterDateStart.toISOString()) : 'Início'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.dateButton}
                        onPress={() => {
                          setCalendarSelected(toISODate(filterDateEnd || new Date()));
                          setTimeout(() => setDatePickerTarget('end'), 0);
                        }}
                      >
                        <Ionicons name="calendar-outline" size={15} color={colors.accent} />
                        <Text style={filterDateEnd ? styles.dateValue : styles.datePlaceholder}>
                          {filterDateEnd ? formatDate(filterDateEnd.toISOString()) : 'Fim'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={!(filterDateStart || filterDateEnd) && styles.filterBadgeHidden}
                        onPress={() => {
                          setFilterDateStart(null);
                          setFilterDateEnd(null);
                        }}
                        hitSlop={8}
                        pointerEvents={filterDateStart || filterDateEnd ? 'auto' : 'none'}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.muted} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.footer}>
                    <Pressable
                      style={styles.cancelButton}
                      onPress={() => {
                        clearFilters();
                        setFilterOpen(false);
                      }}
                    >
                      <Text style={styles.cancelText}>Limpar filtros</Text>
                    </Pressable>
                    <Pressable style={styles.submitButton} onPress={() => setFilterOpen(false)}>
                      <Text style={styles.submitText}>Aplicar</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              </>
            ) : (
              <>
                <View style={styles.createHeader}>
                  <Text style={styles.createTitle}>
                    {datePickerTarget === 'start' ? 'Data inicial' : 'Data final'}
                  </Text>
                  <Pressable
                    onPress={() => setTimeout(() => setDatePickerTarget(null), 0)}
                    hitSlop={12}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={20} color={colors.textPrimary} />
                  </Pressable>
                </View>

                <Calendar
                  key={calendarSelected.slice(0, 7)}
                  current={calendarSelected}
                  onDayPress={(day) => setCalendarSelected(day.dateString)}
                  markedDates={{
                    [calendarSelected]: { selected: true, selectedColor: colors.accent, selectedTextColor: '#141414' },
                  }}
                  firstDay={0}
                  enableSwipeMonths
                  theme={getCalendarTheme(colors)}
                />

                <View style={styles.footer}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => setTimeout(() => setDatePickerTarget(null), 0)}
                  >
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={styles.submitButton}
                    onPress={() => {
                      const [y, m, d] = calendarSelected.split('-').map(Number);
                      const date = new Date(y, m - 1, d);
                      if (datePickerTarget === 'start') setFilterDateStart(date);
                      else setFilterDateEnd(date);
                      setTimeout(() => setDatePickerTarget(null), 0);
                    }}
                  >
                    <Text style={styles.submitText}>Confirmar</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={agendaOpen} animationType="slide" onRequestClose={() => setAgendaOpen(false)}>
        <View style={[styles.safeArea, { paddingTop: insets.top }]}>
          <View style={styles.agendaHeader}>
            <Text style={styles.createTitle}>Agenda</Text>
            <Pressable onPress={() => setAgendaOpen(false)} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.agendaCalendarWrap}>
              <Calendar
                key={toISODate(agendaMonth)}
                current={toISODate(agendaMonth)}
                onMonthChange={(month) => setAgendaMonth(new Date(month.year, month.month - 1, 1))}
                onDayPress={(day) => setAgendaSelectedDay(day.dateString)}
                markedDates={agendaMarkedDates}
                firstDay={0}
                enableSwipeMonths
                theme={getCalendarTheme(colors)}
              />
            </View>

            <View style={styles.agendaDayGroup}>
              <Text style={styles.agendaDayLabel}>{formatDayLabel(agendaSelectedDay)}</Text>

              {agendaLoading ? (
                <ActivityIndicator color={colors.muted} style={styles.loading} />
              ) : agendaError ? (
                <Text style={styles.errorText}>{agendaError}</Text>
              ) : agendaSelectedDayItems.length === 0 ? (
                <Text style={styles.emptyStageText}>Nenhum agendamento para este dia.</Text>
              ) : (
                agendaSelectedDayItems.map((item) => (
                  <View key={item.id} style={styles.agendaCard}>
                    <View style={styles.agendaCardIcon}>
                      <Ionicons name={agendamentoIcon(item.type)} size={16} color={colors.accent} />
                    </View>
                    <View style={styles.agendaCardBody}>
                      <View style={styles.agendaCardHeader}>
                        <Text style={styles.agendaCardTime}>{formatTime(item.startDate)}</Text>
                        <Text style={styles.agendaCardType} numberOfLines={1}>
                          {item.typeName}
                        </Text>
                      </View>
                      <Text style={styles.dealName} numberOfLines={1}>
                        {item.dealTitle || item.customerName}
                      </Text>
                      {!!item.customerName && (
                        <Text style={styles.agendaCardSubtitle} numberOfLines={1}>
                          {item.customerName}
                        </Text>
                      )}
                      {!!item.description && (
                        <Text style={styles.agendaCardDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      )}
                      <Text style={styles.agendaCardOwner}>{item.ownerName}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={!!interactionDeal}
        transparent
        animationType="slide"
        onRequestClose={() => !savingInteraction && setInteractionDeal(null)}
      >
        <View style={styles.createOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !savingInteraction && setInteractionDeal(null)}
          />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.createSheet}>
              <View style={styles.createHeader}>
                <Text style={styles.createTitle}>
                  {interactionMode === 'schedule' ? 'Agendar interação' : 'Registrar interação'}
                </Text>
                <Pressable
                  onPress={() => setInteractionDeal(null)}
                  hitSlop={12}
                  style={styles.closeButton}
                  disabled={savingInteraction}
                >
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.createForm} keyboardShouldPersistTaps="handled">
                <Text style={styles.dealSubtitle} numberOfLines={1}>
                  {interactionDeal?.contactName || interactionDeal?.title}
                </Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Tipo</Text>
                  <View style={styles.segmentRow}>
                    {INTERACTION_TYPE_OPTIONS.map((option) => {
                      const active = interactionType === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          style={[styles.segmentOption, active && styles.segmentOptionActive]}
                          onPress={() => setInteractionType(option.key)}
                        >
                          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {interactionMode === 'schedule' && (
                  <View style={styles.field}>
                    <Text style={styles.label}>Data (AAAA-MM-DD)</Text>
                    <TextInput
                      style={styles.input}
                      value={interactionDate}
                      onChangeText={setInteractionDate}
                      placeholder={toISODate(new Date())}
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.label}>Descrição</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={interactionDescription}
                    onChangeText={setInteractionDescription}
                    placeholder="Ex.: cliente pediu novo orçamento."
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.footer}>
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => setInteractionDeal(null)}
                    disabled={savingInteraction}
                  >
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, savingInteraction && styles.submitDisabled]}
                    onPress={handleSaveInteraction}
                    disabled={savingInteraction}
                  >
                    {savingInteraction ? (
                      <ActivityIndicator color="#141414" />
                    ) : (
                      <Text style={styles.submitText}>
                        {interactionMode === 'schedule' ? 'Agendar' : 'Registrar'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={!!historicoDeal}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoricoDeal(null)}
      >
        <View style={styles.createOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setHistoricoDeal(null)} />
          <View style={styles.createSheet}>
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>Histórico do cliente</Text>
              <Pressable onPress={() => setHistoricoDeal(null)} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.createForm} keyboardShouldPersistTaps="handled">
              {historicoLoading ? (
                <ActivityIndicator color={colors.muted} style={styles.loading} />
              ) : historicoError ? (
                <Text style={styles.errorText}>{historicoError}</Text>
              ) : !historicoData || historicoData.history.length === 0 ? (
                <Text style={styles.emptyStageText}>Nenhum histórico encontrado.</Text>
              ) : (
                historicoData.history.map((item) => (
                  <View key={item.id} style={styles.historicoItem}>
                    <View style={styles.historicoItemHeader}>
                      <Text style={styles.historicoItemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.historicoItemDate}>
                        {item.date ? formatDate(item.date) : ''}
                      </Text>
                    </View>
                    {!!item.description && (
                      <Text style={styles.historicoItemDesc}>{item.description}</Text>
                    )}
                    <Text style={styles.historicoItemAttendant}>{item.attendantName}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBarWrap: {
    position: 'relative',
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabBarScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingRight: 40,
    gap: 20,
  },
  tabBarFade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 28,
  },
  tabButton: {
    paddingBottom: 10,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
  },
  tabButtonTextActive: {
    color: colors.textPrimary,
  },
  tabUnderline: {
    marginTop: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  topBar: {
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 6,
  },
  crmSelect: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  crmSelectLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  crmOptions: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  crmOptionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  crmOptionText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  crmOptionActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labeledActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  labeledActionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeHidden: {
    opacity: 0,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#141414',
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateValue: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  datePlaceholder: {
    fontSize: 14,
    color: colors.muted,
  },
  moveOptionTextDisabled: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  newDealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  newDealButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141414',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 10,
  },
  stageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    ...cardSurface(colors, scheme),
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  stageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  stageCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stageValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  stageBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  emptyStageText: {
    fontSize: 12,
    color: colors.muted,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  stageLoader: {
    paddingVertical: 16,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    marginTop: 4,
  },
  loadMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  dealCard: {
    backgroundColor: colors.elevated,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  dealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dealName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dealSubtitle: {
    fontSize: 12,
    color: colors.muted,
  },
  dealBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dealIconButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  tempBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tempBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  attentionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,107,0.14)',
  },
  attentionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  dealBudgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dealBudgetText: {
    fontSize: 11,
    color: colors.muted,
    flex: 1,
  },
  dealInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dealInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  dealInfoText: {
    fontSize: 12,
    color: colors.muted,
  },
  dealAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  dealFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dealOwner: {
    fontSize: 11,
    color: colors.muted,
    flex: 1,
  },
  waitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.elevated,
  },
  waitBadgeUrgent: {
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  waitText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
  },
  waitTextUrgent: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
  dealActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  dealActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  dealActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  dealBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingRight: 8,
  },
  seeMoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  moveButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#141414',
  },
  historicoItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 3,
  },
  historicoItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historicoItemTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historicoItemDate: {
    fontSize: 11,
    color: colors.muted,
  },
  historicoItemDesc: {
    fontSize: 12,
    color: colors.muted,
  },
  historicoItemAttendant: {
    fontSize: 11,
    color: colors.accent,
  },
  moveOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  moveSheet: {
    marginHorizontal: 14,
    marginBottom: 24,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    ...cardSurface(colors, scheme),
  },
  moveSheetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 8,
  },
  moveOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  moveOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  moveLoading: {
    marginTop: 10,
  },
  createOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  createSheet: {
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createForm: {
    gap: 18,
    paddingBottom: 12,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 15,
  },
  textArea: {
    height: 90,
    paddingTop: 12,
  },
  quoteSection: {
    backgroundColor: colors.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  quoteSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  quoteSectionHeaderText: {
    flex: 1,
    gap: 2,
  },
  quoteSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  quoteSectionSubtitle: {
    fontSize: 11,
    color: colors.muted,
  },
  addLineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addLineButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  quoteLine: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  quoteLineTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quoteNameInput: {
    flex: 1,
  },
  quoteCatalogButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteProductBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 8,
    gap: 6,
    maxHeight: 220,
  },
  quoteProductSearchInput: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.elevated,
    color: colors.textPrimary,
    fontSize: 13,
  },
  quoteProductOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  quoteProductPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  quoteLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quoteQtyInput: {
    flex: 1,
    textAlign: 'center',
  },
  quotePriceInput: {
    flex: 2,
  },
  quoteRemoveButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.1)',
  },
  quoteTotalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  quoteTotalsText: {
    fontSize: 11,
    color: colors.muted,
  },
  quoteTotalsTextStrong: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segmentOptionActive: {
    backgroundColor: colors.primarySubtle,
    borderColor: colors.accent,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.accent,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    height: 50,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  submitButton: {
    flex: 1,
    height: 50,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  agendaCalendarWrap: {
    borderRadius: 16,
    paddingVertical: 8,
    marginBottom: 18,
    ...cardSurface(colors, scheme),
  },
  loading: {
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#FF6B6B',
    paddingVertical: 8,
  },
  agendaDayGroup: {
    marginBottom: 18,
    gap: 8,
  },
  agendaDayLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  agendaCard: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 14,
    padding: 12,
    ...cardSurface(colors, scheme),
  },
  agendaCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaCardBody: {
    flex: 1,
    gap: 3,
  },
  agendaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agendaCardTime: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  agendaCardType: {
    fontSize: 11,
    color: colors.muted,
    flexShrink: 1,
  },
  agendaCardSubtitle: {
    fontSize: 12,
    color: colors.muted,
  },
  agendaCardDescription: {
    fontSize: 12,
    color: colors.muted,
  },
  agendaCardOwner: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  });
