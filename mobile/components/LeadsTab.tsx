import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import {
  Crm,
  FieldMapping,
  getCrms,
  getFieldMapping,
  getMetaAdsContas,
  getMetaAdsFormularios,
  getMetaAdsLeads,
  importarLeads,
  MetaAdsAccount,
  MetaLead,
  MetaLeadForm,
  saveFieldMapping,
} from '@/services/metaAdsApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

type LeadStatus = 'todos' | 'nao_importados' | 'prontos' | 'revisao' | 'importados';

const STATUS_OPTIONS: { key: LeadStatus; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'nao_importados', label: 'Não importados' },
  { key: 'prontos', label: 'Prontos' },
  { key: 'revisao', label: 'Revisão pendente' },
  { key: 'importados', label: 'Importados' },
];

const COUNT_TILES: { key: Exclude<LeadStatus, 'todos'>; label: string }[] = [
  { key: 'nao_importados', label: 'Não importados' },
  { key: 'prontos', label: 'Prontos' },
  { key: 'revisao', label: 'Revisão pendente' },
  { key: 'importados', label: 'Importados' },
];

function leadStatus(lead: MetaLead): Exclude<LeadStatus, 'todos'> {
  if (lead.imported) return 'importados';
  if (lead.telefone) return 'prontos';
  return 'revisao';
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

interface LeadsTabProps {
  user: User;
}

export function LeadsTab({ user }: LeadsTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [crms, setCrms] = useState<Crm[]>([]);
  const [contas, setContas] = useState<MetaAdsAccount[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [baseError, setBaseError] = useState('');

  const [crmId, setCrmId] = useState<number | null>(null);
  const [crmOpen, setCrmOpen] = useState(false);
  const [contaId, setContaId] = useState<string | null>(null);
  const [contaOpen, setContaOpen] = useState(false);

  const [formularios, setFormularios] = useState<MetaLeadForm[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [formsError, setFormsError] = useState('');
  const [formId, setFormId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadsError, setLeadsError] = useState('');
  const [leadsLoaded, setLeadsLoaded] = useState(false);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus>('todos');
  const [statusOpen, setStatusOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const [campoNome, setCampoNome] = useState<string | null>(null);
  const [campoTelefone, setCampoTelefone] = useState<string | null>(null);
  const [campoEmail, setCampoEmail] = useState<string | null>(null);
  const [nomeFieldOpen, setNomeFieldOpen] = useState(false);
  const [telefoneFieldOpen, setTelefoneFieldOpen] = useState(false);
  const [emailFieldOpen, setEmailFieldOpen] = useState(false);
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);

  useEffect(() => {
    setLoadingBase(true);
    setBaseError('');
    Promise.all([
      getCrms(user).catch(() => [] as Crm[]),
      getMetaAdsContas(user).catch((err: any) => {
        setBaseError(err?.message || 'Não foi possível carregar as contas de anúncios.');
        return [] as MetaAdsAccount[];
      }),
    ])
      .then(([crmsData, contasData]) => {
        setCrms(crmsData);
        setContas(contasData);
        if (crmsData.length === 1) setCrmId(crmsData[0].id);
        if (contasData.length === 1) setContaId(contasData[0].meta_ad_account_id);
      })
      .finally(() => setLoadingBase(false));
  }, [user]);

  const loadFormularios = useCallback(() => {
    if (!contaId) return;
    setLoadingForms(true);
    setFormsError('');
    getMetaAdsFormularios(user, contaId)
      .then(setFormularios)
      .catch((err: any) => {
        setFormularios([]);
        setFormsError(err?.message || 'Não foi possível carregar os formulários.');
      })
      .finally(() => setLoadingForms(false));
  }, [contaId, user]);

  useEffect(() => {
    if (!contaId) {
      setFormularios([]);
      setFormId(null);
      return;
    }
    setFormId(null);
    setLeads([]);
    setLeadsLoaded(false);
    loadFormularios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaId, user]);

  const selectedCrm = crms.find((crm) => crm.id === crmId) || null;
  const selectedConta = contas.find((conta) => conta.meta_ad_account_id === contaId) || null;
  const selectedForm = formularios.find((form) => form.id === formId) || null;

  const loadLeads = useCallback(async () => {
    if (!contaId || !formId) return;
    setLoadingLeads(true);
    setLeadsError('');
    try {
      const data = await getMetaAdsLeads(user, {
        ad_account_id: contaId,
        form_id: formId,
        form_name: selectedForm?.name,
      });
      setLeads(data);
      setLeadsLoaded(true);
    } catch (err: any) {
      setLeads([]);
      setLeadsError(err?.message || 'Não foi possível carregar os leads.');
    } finally {
      setLoadingLeads(false);
    }
  }, [contaId, formId, selectedForm, user]);

  useEffect(() => {
    if (formId) loadLeads();
  }, [formId, loadLeads]);

  useEffect(() => {
    setCampoNome(null);
    setCampoTelefone(null);
    setCampoEmail(null);
    if (!formId) return;
    setLoadingMapping(true);
    getFieldMapping(user, { escopo_tipo: 'form', escopo_id: formId })
      .then((mapping: FieldMapping | null) => {
        setCampoNome(mapping?.campo_nome || null);
        setCampoTelefone(mapping?.campo_telefone || null);
        setCampoEmail(mapping?.campo_email || null);
      })
      .catch(() => {})
      .finally(() => setLoadingMapping(false));
  }, [formId, user]);

  const fieldOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of leads) {
      for (const field of lead.fields || []) {
        if (field.key && !map.has(field.key)) map.set(field.key, field.label || field.key);
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [leads]);

  async function handleSaveMapping() {
    if (!formId) return;
    setSavingMapping(true);
    try {
      await saveFieldMapping(user, {
        escopo_tipo: 'form',
        escopo_id: formId,
        escopo_nome: selectedForm?.name || null,
        campo_nome: campoNome,
        campo_telefone: campoTelefone,
        campo_email: campoEmail,
      });
      Alert.alert('Mapeamento salvo', 'Os campos foram atualizados para este formulário.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o mapeamento.');
    } finally {
      setSavingMapping(false);
    }
  }

  function handleMappingInfo() {
    Alert.alert(
      'Mapeamento de campos',
      'Escolha quais campos do lead alimentam nome, telefone e email para este formulário.'
    );
  }

  const counts = useMemo(() => {
    const base = { nao_importados: 0, prontos: 0, revisao: 0, importados: 0 };
    for (const lead of leads) {
      const st = leadStatus(lead);
      base[st] += 1;
      if (st !== 'importados') base.nao_importados += 1;
    }
    return base;
  }, [leads]);

  const visibleLeads = useMemo(() => {
    let items = leads;
    if (status === 'nao_importados') items = items.filter((lead) => !lead.imported);
    else if (status !== 'todos') items = items.filter((lead) => leadStatus(lead) === status);

    const term = search.trim().toLowerCase();
    if (term) {
      items = items.filter((lead) =>
        [lead.nome, lead.telefone, lead.email, lead.campaign_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    }
    return items;
  }, [leads, status, search]);

  const readyLeads = useMemo(() => leads.filter((lead) => leadStatus(lead) === 'prontos'), [leads]);

  function clearFilters() {
    setSearch('');
    setStatus('todos');
  }

  function handleRefresh() {
    if (contaId) loadFormularios();
    if (formId) loadLeads();
  }

  async function handleImport() {
    if (!contaId || !formId || readyLeads.length === 0) return;
    Alert.alert(
      'Importar leads',
      `Importar ${readyLeads.length} lead(s) prontos para o funil ${selectedCrm?.nome || 'padrão'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          onPress: async () => {
            setImporting(true);
            try {
              const resultado = await importarLeads(user, {
                ad_account_id: contaId,
                crm_id: crmId,
                form_id: formId,
                form_name: selectedForm?.name || null,
                leads: readyLeads,
              });
              Alert.alert(
                'Importação concluída',
                `Criados: ${resultado.criados} • Atualizados: ${resultado.atualizados} • Ignorados: ${resultado.ignorados}` +
                  (resultado.negocios_criados ? `\nNegócios criados: ${resultado.negocios_criados}` : '')
              );
              await loadLeads();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível importar os leads.');
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  }

  if (loadingBase) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  if (contas.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="megaphone-outline" size={28} color={colors.muted} />
        <Text style={styles.title}>Nenhuma conta conectada</Text>
        <Text style={styles.subtitle}>
          {baseError ||
            'Conecte uma conta de anúncios da Meta na versão web para importar leads por aqui.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.label}>Funil de destino</Text>
      <Pressable style={styles.select} onPress={() => setCrmOpen((prev) => !prev)}>
        <Text style={selectedCrm ? styles.selectValue : styles.selectPlaceholder}>
          {selectedCrm ? selectedCrm.nome : 'Selecione...'}
        </Text>
        <Ionicons name={crmOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
      </Pressable>
      {crmOpen && (
        <View style={styles.optionsBox}>
          {crms.map((crm) => (
            <Pressable
              key={crm.id}
              style={styles.optionRow}
              onPress={() => {
                setCrmId(crm.id);
                setCrmOpen(false);
              }}
            >
              <Text style={[styles.optionText, crm.id === crmId && styles.optionActive]}>{crm.nome}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.label}>Conta de anúncios</Text>
      <Pressable style={styles.select} onPress={() => setContaOpen((prev) => !prev)}>
        <Text style={selectedConta ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
          {selectedConta
            ? selectedConta.meta_ad_account_name || selectedConta.meta_ad_account_id
            : 'Nenhuma conta vinculada'}
        </Text>
        <Ionicons name={contaOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
      </Pressable>
      {contaOpen && (
        <View style={styles.optionsBox}>
          {contas.map((conta) => (
            <Pressable
              key={conta.meta_ad_account_id}
              style={styles.optionRow}
              onPress={() => {
                setContaId(conta.meta_ad_account_id);
                setContaOpen(false);
              }}
            >
              <Text
                style={[
                  styles.optionText,
                  conta.meta_ad_account_id === contaId && styles.optionActive,
                ]}
                numberOfLines={1}
              >
                {conta.meta_ad_account_name || conta.meta_ad_account_id}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={handleRefresh} disabled={loadingForms || loadingLeads}>
          <Ionicons name="refresh-outline" size={15} color={colors.textPrimary} />
          <Text style={styles.actionText}>Atualizar</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, (readyLeads.length === 0 || importing) && styles.actionDisabled]}
          onPress={handleImport}
          disabled={readyLeads.length === 0 || importing}
        >
          {importing ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={15} color={colors.textPrimary} />
              <Text style={styles.actionText}>Importar</Text>
            </>
          )}
        </Pressable>
      </View>

      {!!contaId && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selecione um formulário</Text>
          <Text style={styles.cardSubtitle}>
            {loadingForms
              ? 'Carregando formulários...'
              : formsError
                ? formsError
                : `${formularios.length} formulário(s) encontrado(s)`}
          </Text>
          <Pressable
            style={styles.formulariosButton}
            onPress={() => setFormOpen((prev) => !prev)}
            disabled={formularios.length === 0}
          >
            <Ionicons name="list-outline" size={15} color={colors.textPrimary} />
            <Text style={styles.actionText}>Formulários</Text>
          </Pressable>
          {formOpen && formularios.length > 0 && (
            <View style={[styles.optionsBox, styles.formulariosBox]}>
              {formularios.map((form) => (
                <Pressable
                  key={form.id}
                  style={styles.optionRow}
                  onPress={() => {
                    setFormId(form.id);
                    setFormOpen(false);
                  }}
                >
                  <Text
                    style={[styles.optionText, form.id === formId && styles.optionActive]}
                    numberOfLines={1}
                  >
                    {form.name}
                  </Text>
                  {form.leads_count !== undefined && (
                    <Text style={styles.optionSub}>{form.leads_count} lead(s)</Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Leads recuperados da Meta</Text>
        <Text style={styles.cardSubtitle}>
          Selecione um formulário para trazer nome, telefone, email e os campos preenchidos no
          cadastro.
        </Text>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Funil de destino</Text>
          <Text style={styles.summaryValue}>{selectedCrm?.nome || 'Selecione...'}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Conta atual</Text>
          <Text style={styles.summaryValue}>
            {selectedConta?.meta_ad_account_name || selectedConta?.meta_ad_account_id || 'Não selecionada'}
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Formulário atual</Text>
          <Text style={styles.summaryValue}>{selectedForm?.name || 'Nenhum'}</Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryLabel}>Leads selecionados</Text>
          <Text style={styles.summaryValue}>{readyLeads.length}</Text>
        </View>
      </View>

      {!!formId && (
        <View style={styles.card}>
          <View style={styles.mappingHeader}>
            <View style={styles.mappingHeaderText}>
              <Text style={styles.cardTitle}>Mapeamento de campos</Text>
              <Text style={styles.cardSubtitle}>
                Escolha quais campos do lead alimentam nome, telefone e email para este
                formulário.
              </Text>
            </View>
            <View style={styles.mappingHeaderActions}>
              <Pressable
                style={styles.iconButton}
                onPress={handleSaveMapping}
                disabled={savingMapping || loadingMapping}
              >
                {savingMapping ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Ionicons name="save-outline" size={16} color={colors.textPrimary} />
                )}
              </Pressable>
              <Pressable style={styles.iconButton} onPress={handleMappingInfo}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          <Text style={styles.label}>Aplicar em</Text>
          <View style={styles.select}>
            <Text style={styles.selectValue}>Formulário atual</Text>
          </View>

          <Text style={styles.label}>Campo do nome</Text>
          <Pressable style={styles.select} onPress={() => setNomeFieldOpen((prev) => !prev)}>
            <Text style={campoNome ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
              {fieldOptions.find((f) => f.key === campoNome)?.label || 'Selecionar campo'}
            </Text>
            <Ionicons name={nomeFieldOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
          </Pressable>
          {nomeFieldOpen && (
            <View style={styles.optionsBox}>
              {fieldOptions.length === 0 ? (
                <Text style={styles.emptyText}>Carregue os leads do formulário para ver os campos.</Text>
              ) : (
                fieldOptions.map((field) => (
                  <Pressable
                    key={field.key}
                    style={styles.optionRow}
                    onPress={() => {
                      setCampoNome(field.key);
                      setNomeFieldOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, field.key === campoNome && styles.optionActive]}>
                      {field.label}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

          <Text style={styles.label}>Campo do telefone</Text>
          <Pressable style={styles.select} onPress={() => setTelefoneFieldOpen((prev) => !prev)}>
            <Text style={campoTelefone ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
              {fieldOptions.find((f) => f.key === campoTelefone)?.label || 'Selecionar campo'}
            </Text>
            <Ionicons name={telefoneFieldOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
          </Pressable>
          {telefoneFieldOpen && (
            <View style={styles.optionsBox}>
              {fieldOptions.length === 0 ? (
                <Text style={styles.emptyText}>Carregue os leads do formulário para ver os campos.</Text>
              ) : (
                fieldOptions.map((field) => (
                  <Pressable
                    key={field.key}
                    style={styles.optionRow}
                    onPress={() => {
                      setCampoTelefone(field.key);
                      setTelefoneFieldOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, field.key === campoTelefone && styles.optionActive]}>
                      {field.label}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          )}

          <Text style={styles.label}>Campo do email</Text>
          <Pressable style={styles.select} onPress={() => setEmailFieldOpen((prev) => !prev)}>
            <Text style={campoEmail ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
              {fieldOptions.find((f) => f.key === campoEmail)?.label || 'Selecionar campo'}
            </Text>
            <Ionicons name={emailFieldOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
          </Pressable>
          {emailFieldOpen && (
            <View style={styles.optionsBox}>
              {fieldOptions.length === 0 ? (
                <Text style={styles.emptyText}>Carregue os leads do formulário para ver os campos.</Text>
              ) : (
                fieldOptions.map((field) => (
                  <Pressable
                    key={field.key}
                    style={styles.optionRow}
                    onPress={() => {
                      setCampoEmail(field.key);
                      setEmailFieldOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, field.key === campoEmail && styles.optionActive]}>
                      {field.label}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.leadsHeader}>
          <View style={styles.leadsHeaderInfo}>
            <Text style={styles.cardTitle}>Lista de leads</Text>
            <Text style={styles.cardSubtitle}>
              {leads.length} lead(s) carregado(s) do formulário.
            </Text>
          </View>
          <Pressable
            style={[styles.importButton, (readyLeads.length === 0 || importing) && styles.actionDisabled]}
            onPress={handleImport}
            disabled={readyLeads.length === 0 || importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color="#141414" />
            ) : (
              <>
                <Ionicons name="download-outline" size={14} color="#141414" />
                <Text style={styles.importText}>Importar {readyLeads.length}</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={15} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nome, telefone, email ou campanha"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.label}>Status do lead</Text>
        <Pressable style={styles.select} onPress={() => setStatusOpen((prev) => !prev)}>
          <Text style={styles.selectValue}>
            {STATUS_OPTIONS.find((option) => option.key === status)?.label}
          </Text>
          <Ionicons name={statusOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
        </Pressable>
        {statusOpen && (
          <View style={styles.optionsBox}>
            {STATUS_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={styles.optionRow}
                onPress={() => {
                  setStatus(option.key);
                  setStatusOpen(false);
                }}
              >
                <Text style={[styles.optionText, option.key === status && styles.optionActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable style={styles.clearButton} onPress={clearFilters}>
          <Text style={styles.clearButtonText}>Limpar filtros</Text>
        </Pressable>

        <View style={styles.countGrid}>
          {COUNT_TILES.map((tile) => {
            const active = status === tile.key;
            return (
              <Pressable
                key={tile.key}
                style={[styles.countTile, active && styles.countTileActive]}
                onPress={() => setStatus(active ? 'todos' : tile.key)}
              >
                <Text style={styles.countLabel}>{tile.label}</Text>
                <Text style={styles.countValue}>{counts[tile.key]}</Text>
              </Pressable>
            );
          })}
        </View>

        {!formId ? (
          <View style={styles.emptyLeads}>
            <Ionicons name="document-text-outline" size={26} color={colors.muted} />
            <Text style={styles.emptyTitle}>Escolha um formulário</Text>
            <Text style={styles.subtitle}>
              Selecione um formulário na lateral para recuperar os leads.
            </Text>
          </View>
        ) : loadingLeads ? (
          <ActivityIndicator color={colors.muted} style={styles.loading} />
        ) : leadsError ? (
          <Text style={styles.errorText}>{leadsError}</Text>
        ) : visibleLeads.length === 0 ? (
          <View style={styles.emptyLeads}>
            <Ionicons name="people-outline" size={26} color={colors.muted} />
            <Text style={styles.emptyTitle}>
              {leadsLoaded && leads.length === 0 ? 'Nenhum lead retornado' : 'Nenhum lead nesse filtro'}
            </Text>
            <Text style={styles.subtitle}>
              {leadsLoaded && leads.length === 0
                ? 'Esse formulário ainda não retornou leads disponíveis para importação.'
                : 'Ajuste a busca ou o status para ver outros leads.'}
            </Text>
          </View>
        ) : (
          visibleLeads.map((lead) => {
            const st = leadStatus(lead);
            return (
              <View key={lead.id} style={styles.leadCard}>
                <View style={styles.leadHeader}>
                  <Text style={styles.leadName} numberOfLines={1}>
                    {lead.nome || 'Sem nome'}
                  </Text>
                  <View
                    style={[
                      styles.leadBadge,
                      st === 'importados'
                        ? styles.badgeImported
                        : st === 'prontos'
                          ? styles.badgeReady
                          : styles.badgeReview,
                    ]}
                  >
                    <Text
                      style={[
                        styles.leadBadgeText,
                        st === 'importados'
                          ? styles.badgeImportedText
                          : st === 'prontos'
                            ? styles.badgeReadyText
                            : styles.badgeReviewText,
                      ]}
                    >
                      {st === 'importados' ? 'Importado' : st === 'prontos' ? 'Pronto' : 'Revisão'}
                    </Text>
                  </View>
                </View>
                <View style={styles.leadInfo}>
                  <Text style={styles.leadDetail}>
                    <Ionicons name="call-outline" size={11} color={colors.muted} /> {lead.telefone || '-'}
                  </Text>
                  <Text style={styles.leadDetail} numberOfLines={1}>
                    <Ionicons name="mail-outline" size={11} color={colors.muted} /> {lead.email || '-'}
                  </Text>
                  {!!lead.campaign_name && (
                    <Text style={styles.leadDetail} numberOfLines={1}>
                      <Ionicons name="megaphone-outline" size={11} color={colors.muted} /> {lead.campaign_name}
                    </Text>
                  )}
                  <Text style={styles.leadDetail}>
                    <Ionicons name="time-outline" size={11} color={colors.muted} /> {formatDateTime(lead.created_time)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 40,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 24,
      gap: 10,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.muted,
      textTransform: 'uppercase',
      marginTop: 6,
    },
    select: {
      height: 50,
      borderRadius: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    selectValue: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    selectPlaceholder: {
      flex: 1,
      fontSize: 15,
      color: colors.muted,
    },
    optionsBox: {
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    formulariosBox: {
      marginTop: 10,
    },
    optionRow: {
      paddingHorizontal: 16,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    optionText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    optionActive: {
      color: colors.accent,
      fontWeight: '700',
    },
    optionSub: {
      fontSize: 11,
      color: colors.muted,
      marginTop: 2,
    },
    loading: {
      paddingVertical: 20,
    },
    errorText: {
      fontSize: 13,
      color: '#FF6B6B',
      paddingVertical: 8,
    },
    emptyText: {
      fontSize: 13,
      color: colors.muted,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionDisabled: {
      opacity: 0.5,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    card: {
      borderRadius: 16,
      padding: 14,
      gap: 10,
      marginTop: 8,
      ...cardSurface(colors, scheme),
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardSubtitle: {
      fontSize: 12,
      color: colors.muted,
    },
    formulariosButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.elevated,
      alignSelf: 'flex-start',
      paddingHorizontal: 14,
    },
    summaryTile: {
      backgroundColor: colors.elevated,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.muted,
    },
    summaryValue: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    mappingHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    mappingHeaderText: {
      flex: 1,
      gap: 4,
    },
    mappingHeaderActions: {
      flexDirection: 'row',
      gap: 8,
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leadsHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    leadsHeaderInfo: {
      flex: 1,
    },
    importButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 34,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.accent,
    },
    importText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#141414',
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.elevated,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
    },
    clearButton: {
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,107,107,0.1)',
    },
    clearButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FF6B6B',
    },
    countGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    countTile: {
      flexBasis: '47%',
      flexGrow: 1,
      backgroundColor: colors.elevated,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    countTileActive: {
      backgroundColor: colors.primarySubtle,
    },
    countLabel: {
      fontSize: 11,
      color: colors.muted,
    },
    countValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    emptyLeads: {
      alignItems: 'center',
      gap: 6,
      paddingVertical: 24,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    leadCard: {
      backgroundColor: colors.elevated,
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    leadHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    leadName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    leadBadge: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
    },
    badgeReady: {
      backgroundColor: 'rgba(197,210,0,0.12)',
    },
    badgeReadyText: {
      color: colors.accent,
    },
    badgeReview: {
      backgroundColor: 'rgba(255,107,107,0.12)',
    },
    badgeReviewText: {
      color: '#FF6B6B',
    },
    badgeImported: {
      backgroundColor: 'rgba(61,107,255,0.15)',
    },
    badgeImportedText: {
      color: '#7EA0FF',
    },
    leadBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    leadInfo: {
      gap: 4,
    },
    leadDetail: {
      fontSize: 12,
      color: colors.muted,
    },
  });
