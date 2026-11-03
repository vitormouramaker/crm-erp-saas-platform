import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { getCalendarTheme } from '@/constants/calendarTheme';
import type { ThemeColors } from '@/constants/theme/tokens';
import { cardSurface } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { getListasTransmissao, type ListaTransmissao } from '@/services/clientesApi';
import {
  getContasMeta,
  getTemplateHeaderFormat,
  getTemplates,
  MetaAccount,
  MetaTemplate,
  templateHasVariables,
} from '@/services/metaApi';
import {
  cancelScheduledDispatch,
  createScheduledDispatch,
  CrmEtapa,
  getScheduledDispatches,
  ScheduledDispatch,
  ScheduledDispatchAudienceType,
} from '@/services/vendasApi';
import { formatDate } from '@/utils/format';
import type { User } from '@/types';

interface ScheduleDispatchTabProps {
  user: User;
  crmId: number | null;
  crmNome: string | null;
  etapas: CrmEtapa[];
}

const AUDIENCE_OPTIONS: { key: ScheduledDispatchAudienceType; label: string }[] = [
  { key: 'lista_transmissao', label: 'Lista de transmissão' },
  { key: 'crm', label: 'Etapa do funil (CRM)' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  completed: 'Concluído',
  completed_with_errors: 'Concluído com erros',
  failed: 'Falhou',
  canceled: 'Cancelado',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function ScheduleDispatchTab({ user, crmId, crmNome, etapas }: ScheduleDispatchTabProps) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const [numeros, setNumeros] = useState<MetaAccount[]>([]);
  const [metaParamId, setMetaParamId] = useState<number | null>(null);
  const [numeroPickerOpen, setNumeroPickerOpen] = useState(false);

  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const [audienceType, setAudienceType] = useState<ScheduledDispatchAudienceType>('lista_transmissao');
  const [audiencePickerOpen, setAudiencePickerOpen] = useState(false);

  const [listas, setListas] = useState<ListaTransmissao[]>([]);
  const [loadingListas, setLoadingListas] = useState(false);
  const [listaId, setListaId] = useState<number | null>(null);
  const [listaPickerOpen, setListaPickerOpen] = useState(false);

  const [etapaId, setEtapaId] = useState<number | null>(null);
  const [etapaPickerOpen, setEtapaPickerOpen] = useState(false);

  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarSelected, setCalendarSelected] = useState(toISODate(new Date()));

  const [scheduledHour, setScheduledHour] = useState<string | null>(null);
  const [hourPickerOpen, setHourPickerOpen] = useState(false);
  const [hourSelected, setHourSelected] = useState<Date>(() => {
    const date = new Date();
    date.setHours(19, 0, 0, 0);
    return date;
  });

  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [schedules, setSchedules] = useState<ScheduledDispatch[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [schedulesError, setSchedulesError] = useState('');
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  useEffect(() => {
    getContasMeta(user)
      .then((data) => {
        setNumeros(data);
        setMetaParamId(data.length > 0 ? data[0].id : null);
      })
      .catch(() => setNumeros([]));
  }, [user]);

  useEffect(() => {
    setSelectedTemplate(null);
    if (!metaParamId) {
      setTemplates([]);
      return;
    }
    setLoadingTemplates(true);
    getTemplates(user, metaParamId)
      .then((data) =>
        setTemplates(data.filter((template) => String(template.status || '').toUpperCase() === 'APPROVED'))
      )
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, [user, metaParamId]);

  useEffect(() => {
    setListaId(null);
    if (!metaParamId || audienceType !== 'lista_transmissao') {
      setListas([]);
      return;
    }
    setLoadingListas(true);
    getListasTransmissao(user, metaParamId)
      .then(setListas)
      .catch(() => setListas([]))
      .finally(() => setLoadingListas(false));
  }, [user, metaParamId, audienceType]);

  useEffect(() => {
    setEtapaId(null);
  }, [audienceType, crmId]);

  const loadSchedules = useCallback(() => {
    setLoadingSchedules(true);
    setSchedulesError('');
    getScheduledDispatches(user)
      .then(setSchedules)
      .catch((err: any) => {
        setSchedules([]);
        setSchedulesError(err?.message || 'Não foi possível carregar a fila de agendamentos.');
      })
      .finally(() => setLoadingSchedules(false));
  }, [user]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const selectedNumero = numeros.find((numero) => numero.id === metaParamId) || null;
  const selectedHasVariables = useMemo(
    () => (selectedTemplate ? templateHasVariables(selectedTemplate) : false),
    [selectedTemplate]
  );
  const selectedHeaderFormat = useMemo(
    () => (selectedTemplate ? getTemplateHeaderFormat(selectedTemplate) : null),
    [selectedTemplate]
  );

  useEffect(() => {
    setHeaderMediaUrl('');
  }, [selectedTemplate]);

  const canSubmit =
    !!metaParamId &&
    !!selectedTemplate &&
    (audienceType === 'lista_transmissao' ? !!listaId : !!crmId && !!etapaId) &&
    !!scheduledDate &&
    !!scheduledHour &&
    (!selectedHeaderFormat || headerMediaUrl.trim().length > 0);

  async function handleCreate() {
    if (!metaParamId || !selectedTemplate || !scheduledDate || !scheduledHour) return;
    if (audienceType === 'lista_transmissao' && !listaId) {
      Alert.alert('Atenção', 'Selecione uma lista de transmissão.');
      return;
    }
    if (audienceType === 'crm' && (!crmId || !etapaId)) {
      Alert.alert('Atenção', 'Selecione o funil e a etapa no topo da tela.');
      return;
    }
    if (selectedHeaderFormat && !headerMediaUrl.trim()) {
      Alert.alert('Atenção', 'Este template exige uma URL de mídia no cabeçalho.');
      return;
    }

    setCreating(true);
    try {
      await createScheduledDispatch(user, {
        empresaMetaParamId: metaParamId,
        templateName: selectedTemplate.name,
        templateLanguage: selectedTemplate.language || 'pt_BR',
        audienceType,
        listaTransmissaoId: audienceType === 'lista_transmissao' ? listaId ?? undefined : undefined,
        crmId: audienceType === 'crm' ? crmId ?? undefined : undefined,
        etapaId: audienceType === 'crm' ? etapaId ?? undefined : undefined,
        scheduledDate,
        scheduledHour: Number(scheduledHour.slice(0, 2)),
        headerMediaType: selectedHeaderFormat,
        headerMediaUrl: selectedHeaderFormat ? headerMediaUrl.trim() : null,
      });
      setSelectedTemplate(null);
      setListaId(null);
      setEtapaId(null);
      setScheduledDate(null);
      setScheduledHour(null);
      setHeaderMediaUrl('');
      loadSchedules();
      Alert.alert('Agendado', 'Disparo agendado com sucesso.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível agendar o disparo.');
    } finally {
      setCreating(false);
    }
  }

  async function handleCancel(schedule: ScheduledDispatch) {
    Alert.alert('Cancelar agendamento', 'Deseja cancelar este disparo agendado?', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar disparo',
        style: 'destructive',
        onPress: async () => {
          setCancelingId(schedule.id);
          try {
            await cancelScheduledDispatch(user, schedule.id);
            loadSchedules();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível cancelar o agendamento.');
          } finally {
            setCancelingId(null);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Agendar disparos</Text>
      <Text style={styles.subtitle}>
        Escolha número, template, público, data e hora. O cron processa os envios no horário de São Paulo.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Número Meta</Text>
        {numeros.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum número da Meta disponível.</Text>
        ) : (
          <>
            <Pressable style={styles.select} onPress={() => setNumeroPickerOpen((prev) => !prev)}>
              <Text style={selectedNumero ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
                {selectedNumero?.display_phone_number || 'Selecione um número'}
              </Text>
              <Ionicons name={numeroPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
            </Pressable>
            {numeroPickerOpen && (
              <View style={styles.optionsBox}>
                {numeros.map((numero) => (
                  <Pressable
                    key={numero.id}
                    style={styles.optionRow}
                    onPress={() => {
                      setMetaParamId(numero.id);
                      setTimeout(() => setNumeroPickerOpen(false), 0);
                    }}
                  >
                    <Text style={[styles.optionText, numero.id === metaParamId && styles.optionActive]}>
                      {numero.display_phone_number || `#${numero.id}`}
                    </Text>
                    {!!numero.verified_name && <Text style={styles.optionSub}>{numero.verified_name}</Text>}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Template</Text>
        {!metaParamId ? (
          <Text style={styles.emptyText}>Selecione um número Meta primeiro.</Text>
        ) : loadingTemplates ? (
          <ActivityIndicator color={colors.muted} style={styles.loading} />
        ) : templates.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum template aprovado neste número.</Text>
        ) : (
          <>
            <Pressable style={styles.select} onPress={() => setTemplatePickerOpen((prev) => !prev)}>
              <Text style={selectedTemplate ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
                {selectedTemplate ? `${selectedTemplate.name} (${selectedTemplate.language})` : 'Selecione um template'}
              </Text>
              <Ionicons name={templatePickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
            </Pressable>
            {templatePickerOpen && (
              <View style={styles.optionsBox}>
                {templates.map((template) => (
                  <Pressable
                    key={`${template.name}-${template.language}`}
                    style={styles.optionRow}
                    onPress={() => {
                      setSelectedTemplate(template);
                      setTimeout(() => setTemplatePickerOpen(false), 0);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        template.name === selectedTemplate?.name &&
                          template.language === selectedTemplate?.language &&
                          styles.optionActive,
                      ]}
                    >
                      {template.name}
                    </Text>
                    <Text style={styles.optionSub}>
                      {template.language}
                      {template.category ? ` • ${template.category}` : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Público</Text>
        <Pressable style={styles.select} onPress={() => setAudiencePickerOpen((prev) => !prev)}>
          <Text style={styles.selectValue}>
            {AUDIENCE_OPTIONS.find((option) => option.key === audienceType)?.label}
          </Text>
          <Ionicons name={audiencePickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
        </Pressable>
        {audiencePickerOpen && (
          <View style={styles.optionsBox}>
            {AUDIENCE_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={styles.optionRow}
                onPress={() => {
                  setAudienceType(option.key);
                  setTimeout(() => setAudiencePickerOpen(false), 0);
                }}
              >
                <Text style={[styles.optionText, option.key === audienceType && styles.optionActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {audienceType === 'lista_transmissao' ? (
        <View style={styles.field}>
          <Text style={styles.label}>Lista</Text>
          {!metaParamId ? (
            <Text style={styles.emptyText}>Selecione um número Meta primeiro.</Text>
          ) : loadingListas ? (
            <ActivityIndicator color={colors.muted} style={styles.loading} />
          ) : listas.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma lista de transmissão para este número.</Text>
          ) : (
            <>
              <Pressable style={styles.select} onPress={() => setListaPickerOpen((prev) => !prev)}>
                <Text style={listaId ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
                  {listas.find((lista) => lista.id === listaId)?.nome || 'Selecione uma lista'}
                </Text>
                <Ionicons name={listaPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
              </Pressable>
              {listaPickerOpen && (
                <View style={styles.optionsBox}>
                  {listas.map((lista) => (
                    <Pressable
                      key={lista.id}
                      style={styles.optionRow}
                      onPress={() => {
                        setListaId(lista.id);
                        setTimeout(() => setListaPickerOpen(false), 0);
                      }}
                    >
                      <Text style={[styles.optionText, lista.id === listaId && styles.optionActive]}>
                        {lista.nome}
                      </Text>
                      <Text style={styles.optionSub}>{lista.total_contatos} contato(s)</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>Etapa do funil</Text>
          {!crmId ? (
            <Text style={styles.emptyText}>Selecione um funil no topo da tela.</Text>
          ) : etapas.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma etapa configurada para este funil.</Text>
          ) : (
            <>
              <Pressable style={styles.select} onPress={() => setEtapaPickerOpen((prev) => !prev)}>
                <Text style={etapaId ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
                  {etapas.find((etapa) => etapa.id === etapaId)?.nome || `Selecione uma etapa de ${crmNome || 'funil'}`}
                </Text>
                <Ionicons name={etapaPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
              </Pressable>
              {etapaPickerOpen && (
                <View style={styles.optionsBox}>
                  {etapas.map((etapa) => (
                    <Pressable
                      key={etapa.id}
                      style={styles.optionRow}
                      onPress={() => {
                        setEtapaId(etapa.id);
                        setTimeout(() => setEtapaPickerOpen(false), 0);
                      }}
                    >
                      <Text style={[styles.optionText, etapa.id === etapaId && styles.optionActive]}>
                        {etapa.nome}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Data</Text>
          <Pressable
            style={styles.select}
            onPress={() => {
              setCalendarSelected(scheduledDate || toISODate(new Date()));
              setCalendarOpen(true);
            }}
          >
            <Ionicons name="calendar-outline" size={15} color={colors.accent} />
            <Text style={scheduledDate ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
              {scheduledDate ? formatDate(scheduledDate) : 'Selecionar'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Hora</Text>
          <Pressable
            style={styles.select}
            onPress={() => {
              if (scheduledHour) {
                const date = new Date();
                date.setHours(Number(scheduledHour.slice(0, 2)), 0, 0, 0);
                setHourSelected(date);
              }
              setHourPickerOpen(true);
            }}
          >
            <Ionicons name="time-outline" size={15} color={colors.accent} />
            <Text style={scheduledHour ? styles.selectValue : styles.selectPlaceholder}>
              {scheduledHour || 'Selecionar'}
            </Text>
          </Pressable>
        </View>
      </View>

      {!!selectedNumero && (
        <View style={styles.previewChip}>
          <Ionicons name="paper-plane-outline" size={13} color={colors.accent} />
          <Text style={styles.previewChipText} numberOfLines={1}>
            {selectedNumero.display_phone_number}
            {selectedNumero.verified_name ? ` • ${selectedNumero.verified_name}` : ''}
          </Text>
        </View>
      )}

      {selectedHasVariables && (
        <View style={styles.warnBox}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.accent} />
          <Text style={styles.warnText}>
            Este template possui variáveis. O sistema tentará preenchê-las automaticamente para cada
            destinatário no momento do disparo.
          </Text>
        </View>
      )}

      {!!selectedHeaderFormat && (
        <View style={styles.mediaBox}>
          <Text style={styles.mediaTitle}>Header com mídia obrigatória</Text>
          <Text style={styles.label}>URL pública da {selectedHeaderFormat.toLowerCase()}</Text>
          <TextInput
            style={styles.input}
            value={headerMediaUrl}
            onChangeText={setHeaderMediaUrl}
            placeholder="https://..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {!!selectedTemplate && (
        <Pressable style={styles.previewLinkButton} onPress={() => setPreviewOpen(true)}>
          <Ionicons name="eye-outline" size={15} color={colors.accent} />
          <Text style={styles.previewLinkText}>Ver preview do template</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.submitButton, (!canSubmit || creating) && styles.submitDisabled]}
        onPress={handleCreate}
        disabled={!canSubmit || creating}
      >
        {creating ? (
          <ActivityIndicator color="#141414" />
        ) : (
          <Text style={styles.submitText}>Agendar disparo</Text>
        )}
      </Pressable>
      <Text style={styles.limitNote}>
        Limite ativo: a empresa não pode ter dois agendamentos na mesma data e hora.
      </Text>

      <View style={styles.queueSection}>
        <Text style={styles.title}>Fila de agendamentos</Text>
        <Text style={styles.subtitle}>Histórico dos disparos criados pela empresa nesta tela.</Text>

        {loadingSchedules ? (
          <ActivityIndicator color={colors.muted} style={styles.loading} />
        ) : schedulesError ? (
          <Text style={styles.errorText}>{schedulesError}</Text>
        ) : schedules.length === 0 ? (
          <View style={styles.emptyQueueBox}>
            <Text style={styles.emptyText}>Nenhum disparo agendado encontrado até agora.</Text>
          </View>
        ) : (
          schedules.map((schedule) => (
            <View key={schedule.id} style={styles.scheduleCard}>
              <View style={styles.scheduleHeader}>
                <Text style={styles.scheduleTemplate} numberOfLines={1}>
                  {schedule.template_name}
                </Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{STATUS_LABELS[schedule.status] || schedule.status}</Text>
                </View>
              </View>
              <Text style={styles.scheduleSub}>
                {formatDate(schedule.scheduled_date)} às {schedule.scheduled_time} •{' '}
                {schedule.display_phone_number || 'número indisponível'}
              </Text>
              <Text style={styles.scheduleSub}>
                {schedule.audience_type === 'crm'
                  ? `${schedule.crm_nome || 'Funil'} • ${schedule.etapa_nome || 'Etapa'}`
                  : schedule.lista_nome || 'Lista de transmissão'}
              </Text>
              {schedule.total_recipients > 0 && (
                <Text style={styles.scheduleSub}>
                  {schedule.processed_recipients}/{schedule.total_recipients} processados •{' '}
                  {schedule.sent_recipients} enviados • {schedule.error_recipients} erros
                </Text>
              )}
              {!!schedule.last_error_message && (
                <Text style={styles.errorText}>{schedule.last_error_message}</Text>
              )}
              {schedule.status === 'pending' && (
                <Pressable
                  style={styles.cancelScheduleButton}
                  disabled={cancelingId === schedule.id}
                  onPress={() => handleCancel(schedule)}
                >
                  {cancelingId === schedule.id ? (
                    <ActivityIndicator size="small" color={colors.muted} />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={14} color="#FF6B6B" />
                      <Text style={styles.cancelScheduleText}>Cancelar</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          ))
        )}
      </View>

      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.previewScreen}>
          <View style={styles.previewScreenHeader}>
            <Text style={styles.mediaTitle}>Preview do template agendado</Text>
            <Pressable onPress={() => setPreviewOpen(false)} hitSlop={12} style={styles.previewCloseButton}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.previewScreenBody} showsVerticalScrollIndicator={false}>
            {!!selectedTemplate && (
              <View style={styles.previewCard}>
                <View style={styles.previewHeaderBar}>
                  <Text style={styles.previewHeaderBarText}>Conversa no WhatsApp</Text>
                  <Text style={styles.previewHeaderBarLang}>{selectedTemplate.language}</Text>
                </View>

                <View style={styles.previewBody}>
                  <View style={styles.previewBubble}>
                    {selectedHeaderFormat === 'IMAGE' ? (
                      headerMediaUrl.trim() ? (
                        <Image
                          source={{ uri: headerMediaUrl.trim() }}
                          style={styles.previewImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.previewImagePlaceholder}>
                          <Ionicons name="image-outline" size={22} color={colors.muted} />
                          <Text style={styles.previewImagePlaceholderText}>
                            Selecione uma imagem para visualizar o header.
                          </Text>
                        </View>
                      )
                    ) : !!selectedHeaderFormat ? (
                      <View style={styles.previewImagePlaceholder}>
                        <Ionicons
                          name={selectedHeaderFormat === 'VIDEO' ? 'videocam-outline' : 'document-outline'}
                          size={22}
                          color={colors.muted}
                        />
                        <Text style={styles.previewImagePlaceholderText} numberOfLines={2}>
                          {headerMediaUrl.trim() || `Informe a URL do ${selectedHeaderFormat.toLowerCase()} para visualizar o header.`}
                        </Text>
                      </View>
                    ) : null}

                    {!!selectedTemplate.components?.body?.text && (
                      <Text style={styles.previewBubbleText}>{selectedTemplate.components.body.text}</Text>
                    )}
                    {!!selectedTemplate.components?.footer?.text && (
                      <Text style={styles.previewFooterText}>{selectedTemplate.components.footer.text}</Text>
                    )}
                  </View>

                  {!!selectedTemplate.components?.buttons?.length && (
                    <View style={styles.previewButtonsBox}>
                      {selectedTemplate.components.buttons.map((button: any, index: number) => (
                        <View key={index} style={styles.previewButtonRow}>
                          <Text style={styles.previewButtonText}>{button.text || button.type}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {selectedHasVariables && (
              <View style={styles.warnBox}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.accent} />
                <Text style={styles.warnText}>
                  As variáveis ({'{{n}}'}) são preenchidas automaticamente para cada destinatário no
                  momento do disparo agendado.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
        <View style={styles.calendarOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCalendarOpen(false)} />
          <View style={styles.calendarSheet}>
            <View style={styles.calendarHeader}>
              <Text style={styles.mediaTitle}>Data do agendamento</Text>
              <Pressable onPress={() => setCalendarOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
            <Calendar
              current={calendarSelected}
              minDate={toISODate(new Date())}
              onDayPress={(day) => setCalendarSelected(day.dateString)}
              markedDates={{
                [calendarSelected]: { selected: true, selectedColor: colors.accent, selectedTextColor: '#141414' },
              }}
              firstDay={0}
              enableSwipeMonths
              theme={getCalendarTheme(colors)}
            />
            <Pressable
              style={styles.submitButton}
              onPress={() => {
                setScheduledDate(calendarSelected);
                setCalendarOpen(false);
              }}
            >
              <Text style={styles.submitText}>Confirmar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {Platform.OS === 'android' && hourPickerOpen && (
        <DateTimePicker
          value={hourSelected}
          mode="time"
          is24Hour
          minuteInterval={60}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setHourPickerOpen(false);
            if (event.type === 'set' && date) {
              setHourSelected(date);
              setScheduledHour(`${pad(date.getHours())}:00`);
            }
          }}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={hourPickerOpen} transparent animationType="fade" onRequestClose={() => setHourPickerOpen(false)}>
          <View style={styles.calendarOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setHourPickerOpen(false)} />
            <View style={[styles.calendarSheet, styles.hourSheet]}>
              <View style={styles.calendarHeader}>
                <Text style={styles.mediaTitle}>Horário do agendamento</Text>
                <Pressable onPress={() => setHourPickerOpen(false)} hitSlop={12}>
                  <Ionicons name="close" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>
              <DateTimePicker
                value={hourSelected}
                mode="time"
                is24Hour
                display="spinner"
                minuteInterval={60}
                textColor={colors.textPrimary}
                onChange={(_: DateTimePickerEvent, date?: Date) => date && setHourSelected(date)}
              />
              <Pressable
                style={styles.submitButton}
                onPress={() => {
                  setScheduledHour(`${pad(hourSelected.getHours())}:00`);
                  setHourPickerOpen(false);
                }}
              >
                <Text style={styles.submitText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  field: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowItem: {
    flex: 1,
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  select: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    maxHeight: 240,
  },
  optionRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.elevated,
  },
  optionText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  optionActive: {
    color: colors.accent,
  },
  optionSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    color: colors.muted,
  },
  loading: {
    paddingVertical: 12,
  },
  hourSheet: {
    alignSelf: 'stretch',
  },
  previewChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  previewChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  warnBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(197,210,0,0.08)',
    borderRadius: 12,
    padding: 12,
  },
  warnText: {
    flex: 1,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  mediaBox: {
    borderRadius: 14,
    padding: 14,
    gap: 8,
    ...cardSurface(colors, scheme),
  },
  mediaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 13,
  },
  submitButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141414',
  },
  limitNote: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
  queueSection: {
    marginTop: 12,
    gap: 10,
  },
  emptyQueueBox: {
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: 'center',
    ...cardSurface(colors, scheme),
  },
  scheduleCard: {
    borderRadius: 14,
    padding: 12,
    gap: 4,
    ...cardSurface(colors, scheme),
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  scheduleTemplate: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
  },
  scheduleSub: {
    fontSize: 12,
    color: colors.muted,
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
  },
  cancelScheduleButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,107,107,0.1)',
  },
  cancelScheduleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  calendarOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    padding: 24,
  },
  calendarSheet: {
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewLinkButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  previewScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  previewScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  previewCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewScreenBody: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 14,
  },
  previewCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0E4D45',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  previewHeaderBarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewHeaderBarLang: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  previewBody: {
    backgroundColor: '#EDEAE3',
    padding: 14,
    gap: 10,
  },
  previewBubble: {
    backgroundColor: '#D9F2CE',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    alignSelf: 'flex-end',
    maxWidth: '90%',
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    backgroundColor: '#C9C9C9',
  },
  previewImagePlaceholder: {
    width: '100%',
    minHeight: 100,
    borderRadius: 8,
    backgroundColor: '#DEDEDE',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  previewImagePlaceholderText: {
    fontSize: 11,
    color: '#5A5A5A',
    textAlign: 'center',
  },
  previewBubbleText: {
    fontSize: 13,
    color: '#1A1A1A',
    lineHeight: 18,
  },
  previewFooterText: {
    fontSize: 11,
    color: '#5A5A5A',
  },
  previewButtonsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewButtonRow: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  previewButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7CF6',
  },
});
