import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { MetaAccountSelector } from '@/components/MetaAccountSelector';
import { getContasMeta, getTemplates, MetaAccount, MetaTemplate } from '@/services/metaApi';
import {
  alterarStatusMensagemAutomatica,
  getTemplateAutomationConfig,
  salvarTemplateAutomationConfig,
  TemplateAutomationConfig,
  TemplateAutomationType,
} from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

interface AutomationScheduleTabProps {
  user: User;
}

interface AutomationDefinition {
  key: TemplateAutomationType;
  tipoId: number;
  title: string;
  description: string;
  templateLabel: string;
  delayLabel: string | null;
  delayInfo: string | null;
  footerNote: string;
}

const AUTOMATIONS: AutomationDefinition[] = [
  {
    key: 'birthday',
    tipoId: 4,
    title: 'Mensagem automática de aniversário',
    description:
      'Selecione um template da Meta para o cron disparar no aniversário do cliente usando o número da última conversa. Se o cliente ainda não tiver conversa anterior, o sistema usa o número padrão definido abaixo.',
    templateLabel: 'Template de aniversário',
    delayLabel: null,
    delayInfo: null,
    footerNote:
      'O cron considera os contatos aniversariantes que já tiveram conversa vinculada ao número Meta selecionado.',
  },
  {
    key: 'sale_completed',
    tipoId: 6,
    title: 'Follow-up de venda realizada',
    description:
      'Selecione um template da Meta para enviar um follow-up depois de negócios fechados como ganhos. O cron considera o número da última conversa do cliente e pode usar um número padrão quando ainda não existir histórico.',
    templateLabel: 'Template do follow-up ganho',
    delayLabel: 'Dias após a venda realizada',
    delayInfo:
      'O cron procura negócios fechados como ganhos na data calculada pelos dias configurados após a venda.',
    footerNote:
      'O cron procura negócios fechados como ganhos na data calculada pelos dias configurados após a venda.',
  },
  {
    key: 'sale_refused',
    tipoId: 7,
    title: 'Follow-up de venda recusada',
    description:
      'Selecione um template da Meta para enviar um follow-up depois de negócios fechados como perdidos ou recusados. O cron considera o número da última conversa do cliente e pode usar um número padrão quando ainda não existir histórico.',
    templateLabel: 'Template do follow-up recusado',
    delayLabel: 'Dias após a venda recusada',
    delayInfo:
      'O cron procura negócios fechados como perdidos na data calculada pelos dias configurados após a recusa.',
    footerNote:
      'O cron procura negócios fechados como perdidos na data calculada pelos dias configurados após a recusa.',
  },
];

export function AutomationScheduleTab({ user }: AutomationScheduleTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [numeros, setNumeros] = useState<MetaAccount[]>([]);
  const [metaParamId, setMetaParamId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);

  useEffect(() => {
    getContasMeta(user)
      .then((data) => {
        setNumeros(data);
        setMetaParamId(data.length > 0 ? data[0].id : null);
      })
      .catch(() => setNumeros([]));
  }, [user]);

  useEffect(() => {
    if (!metaParamId) {
      setTemplates([]);
      return;
    }
    getTemplates(user, metaParamId)
      .then((data) =>
        setTemplates(data.filter((template) => String(template.status || '').toUpperCase() === 'APPROVED'))
      )
      .catch(() => setTemplates([]));
  }, [user, metaParamId]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <MetaAccountSelector numeros={numeros} activeId={metaParamId} onChange={setMetaParamId} />

      <Text style={styles.title}>Agendamento de automação</Text>
      <Text style={styles.subtitle}>
        Configure templates agendados por número Meta para aniversário e follow-ups comerciais.
      </Text>

      {!metaParamId ? (
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Nenhum número da Meta disponível.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {AUTOMATIONS.map((definition) => (
            <AutomationCard
              key={definition.key}
              user={user}
              metaParamId={metaParamId}
              templates={templates}
              definition={definition}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

interface AutomationCardProps {
  user: User;
  metaParamId: number;
  templates: MetaTemplate[];
  definition: AutomationDefinition;
}

function AutomationCard({ user, metaParamId, templates, definition }: AutomationCardProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [config, setConfig] = useState<TemplateAutomationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('pt_BR');
  const [horario, setHorario] = useState('09:00');
  const [delayDays, setDelayDays] = useState('3');
  const [isDefault, setIsDefault] = useState(false);

  const applyConfig = useCallback((data: TemplateAutomationConfig) => {
    setConfig(data);
    setTemplateName(data.template_name || '');
    setTemplateLanguage(data.template_language || 'pt_BR');
    setHorario((data.horario || '09:00:00').slice(0, 5));
    setDelayDays(String(data.delay_days ?? 3));
    setIsDefault(Boolean(data.is_default_dispatch_number));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getTemplateAutomationConfig(user, definition.key, metaParamId)
      .then(applyConfig)
      .catch((err: any) => {
        setConfig(null);
        setError(err?.message || 'Não foi possível carregar a configuração.');
      })
      .finally(() => setLoading(false));
  }, [user, definition.key, metaParamId, applyConfig]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle() {
    if (!config) return;
    setToggling(true);
    try {
      await alterarStatusMensagemAutomatica(user, definition.tipoId, !config.habilitada, metaParamId);
      setConfig((prev) => (prev ? { ...prev, habilitada: !prev.habilitada } : prev));
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível alterar o status.');
    } finally {
      setToggling(false);
    }
  }

  async function persist(overrides?: {
    template_name?: string;
    horario?: string;
    delay_days?: number;
    is_default_dispatch_number?: boolean;
  }) {
    setSaving(true);
    try {
      const data = await salvarTemplateAutomationConfig(user, {
        automation_type: definition.key,
        meta_param_id: metaParamId,
        template_name: overrides?.template_name ?? templateName,
        template_language: templateLanguage,
        horario: overrides?.horario ?? horario,
        delay_days: definition.delayLabel
          ? Number(overrides?.delay_days ?? delayDays) || 0
          : undefined,
        is_default_dispatch_number: overrides?.is_default_dispatch_number ?? isDefault,
      });
      applyConfig(data);
      return true;
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar a automação.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await persist();
  }

  function handleClear() {
    Alert.alert(
      'Limpar configuração',
      'Isso remove o template, o horário e o número padrão salvos para esta automação. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: () =>
            persist({
              template_name: '',
              horario: '09:00',
              delay_days: 3,
              is_default_dispatch_number: false,
            }),
        },
      ]
    );
  }

  function handleSelectTemplate(template: MetaTemplate) {
    setTemplateName(template.name);
    setTemplateLanguage(template.language || 'pt_BR');
    setTemplatePickerOpen(false);
  }

  function handleDefaultInfo() {
    Alert.alert(
      'Número padrão',
      'Quando um cliente ainda não teve conversa vinculada a um número da Meta, o sistema usa o número marcado como padrão para disparar esta automação.'
    );
  }

  function handleDelayInfo() {
    if (definition.delayInfo) {
      Alert.alert(definition.delayLabel || 'Dias', definition.delayInfo);
    }
  }

  function renderDefaultToggle() {
    return (
      <>
        <View style={styles.labelRow}>
          <Text style={styles.toggleLabel} numberOfLines={2}>
            Número padrão para clientes sem conversa
          </Text>
          <Pressable onPress={handleDefaultInfo} hitSlop={8}>
            <Ionicons name="information-circle-outline" size={14} color={colors.muted} />
          </Pressable>
        </View>
        <Switch
          value={isDefault}
          onValueChange={setIsDefault}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#FFFFFF"
        />
      </>
    );
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{definition.title}</Text>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.muted} />
        </View>
      </View>
    );
  }

  if (error || !config) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{definition.title}</Text>
        <Text style={styles.errorText}>{error || 'Não foi possível carregar a configuração.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{definition.title}</Text>
        <Switch
          value={config.habilitada}
          onValueChange={handleToggle}
          disabled={toggling}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#FFFFFF"
        />
      </View>

      <Text style={styles.cardDescription}>{definition.description}</Text>

      {config.habilitada && (
        <View style={styles.enabledBadge}>
          <Text style={styles.enabledBadgeText}>ENVIO AUTOMÁTICO HABILITADO</Text>
        </View>
      )}

      <Text style={styles.infoText}>
        Configuração:{' '}
        {config.template_name
          ? `template "${config.template_name}" salvo para este número`
          : 'nenhum template salvo para este número'}
      </Text>

      {!config.default_dispatch_meta_param_id && (
        <View style={styles.warnBox}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.accent} />
          <Text style={styles.warnText}>
            Nenhum número padrão foi selecionado. Clientes sem última conversa não receberão esta
            automação até você definir um padrão.
          </Text>
        </View>
      )}

      <Text style={styles.label}>{definition.templateLabel}</Text>
      <Pressable style={styles.select} onPress={() => setTemplatePickerOpen((prev) => !prev)}>
        <Text style={templateName ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
          {templateName || 'Selecione um template'}
        </Text>
        <Ionicons name={templatePickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
      </Pressable>
      {templatePickerOpen && (
        <View style={styles.optionsBox}>
          {templates.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum template aprovado neste número.</Text>
          ) : (
            templates.map((template) => (
              <Pressable
                key={`${template.name}-${template.language}`}
                style={styles.optionRow}
                onPress={() => handleSelectTemplate(template)}
              >
                <Text style={[styles.optionText, template.name === templateName && styles.optionActive]}>
                  {template.name}
                </Text>
                <Text style={styles.optionSub}>{template.language}</Text>
              </Pressable>
            ))
          )}
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Idioma do disparo</Text>
          <TextInput
            style={styles.input}
            value={templateLanguage}
            onChangeText={setTemplateLanguage}
            placeholder="pt_BR"
            placeholderTextColor={colors.muted}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <View style={styles.labelSlot}>
            <Text style={styles.label}>Horário do envio</Text>
          </View>
          <TextInput
            style={styles.input}
            value={horario}
            onChangeText={setHorario}
            placeholder="09:00"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={styles.rowItem}>
          {definition.delayLabel ? (
            <>
              <View style={[styles.labelRow, styles.labelSlot]}>
                <Text style={styles.label}>{definition.delayLabel}</Text>
                <Pressable onPress={handleDelayInfo} hitSlop={8}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.muted} />
                </Pressable>
              </View>
              <TextInput
                style={styles.input}
                value={delayDays}
                onChangeText={setDelayDays}
                keyboardType="number-pad"
                placeholder="3"
                placeholderTextColor={colors.muted}
              />
            </>
          ) : (
            renderDefaultToggle()
          )}
        </View>
      </View>

      {!!definition.delayLabel && <View style={styles.toggleRow}>{renderDefaultToggle()}</View>}

      <Text style={styles.cardFooterNote}>{definition.footerNote}</Text>

      <View style={styles.actionsRow}>
        <Pressable style={[styles.saveButton, saving && styles.saveDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#141414" />
          ) : (
            <>
              <Ionicons name="save-outline" size={14} color="#141414" />
              <Text style={styles.saveButtonText}>Salvar automação</Text>
            </>
          )}
        </Pressable>
        <Pressable style={styles.clearButton} onPress={handleClear} disabled={saving}>
          <Ionicons name="trash-outline" size={14} color={colors.muted} />
          <Text style={styles.clearButtonText}>Limpar configuração</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 14,
  },
  card: {
    flexBasis: '31%',
    minWidth: 320,
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    ...cardSurface(colors, scheme),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardDescription: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  enabledBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  enabledBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },
  infoText: {
    fontSize: 12,
    color: '#D0D0D0',
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
  },
  warnBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(197,210,0,0.08)',
    borderRadius: 12,
    padding: 10,
  },
  warnText: {
    flex: 1,
    fontSize: 11,
    color: colors.muted,
    lineHeight: 15,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  labelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  labelSlot: {
    minHeight: 32,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
    gap: 6,
  },
  select: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectValue: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: colors.muted,
  },
  optionsBox: {
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  optionActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  optionSub: {
    fontSize: 11,
    color: colors.muted,
  },
  emptyText: {
    fontSize: 12,
    color: colors.muted,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  input: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 13,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  cardFooterNote: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  saveButton: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#141414',
  },
  clearButton: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  });
