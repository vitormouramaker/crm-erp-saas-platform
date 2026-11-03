import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';

import { AppDrawer } from '@/components/AppDrawer';
import { DatePickerModal } from '@/components/DatePickerModal';
import { PermissionDeniedState } from '@/components/ScreenState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { canSeeRH } from '@/services/permissions';
import {
  adicionarJustificativa,
  BatidaMetadata,
  DiaRelatorio,
  getJustificativaTipos,
  getRelatorioPonto,
  getStatusLabel,
  getTipoBatidaLabel,
  JustificativaAnexo,
  JustificativaTipo,
  recalcularDia,
  registrarBatida,
} from '@/services/pontoApi';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const POSITIVE = '#22C55E';
const NEGATIVE = '#EF4444';
const REGISTRO_BG = 'rgba(197, 210, 0, 0.18)';

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayKey(): string {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatSaldo(minutos: number): string {
  const abs = Math.abs(minutos);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${minutos < 0 ? '-' : ''}${hh}:${mm}`;
}

function formatDateLong(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${String(day).padStart(2, '0')} de ${MONTH_NAMES[month - 1]} de ${year}`;
}

function formatDateBR(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

function dateKeyToDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatHora(dataHora: string): string {
  const date = new Date(dataHora);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

interface CalendarCell {
  day: number;
  dateKey: string;
  inMonth: boolean;
}

function buildCalendar(year: number, month: number): CalendarCell[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const start = new Date(year, month, 1 - firstWeekday);
  const weeks: CalendarCell[][] = [];
  const cursor = new Date(start);

  for (let w = 0; w < 6; w += 1) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push({
        day: cursor.getDate(),
        dateKey: toDateKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()),
        inMonth: cursor.getMonth() === month,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor.getFullYear() > year || (cursor.getFullYear() === year && cursor.getMonth() > month)) {
      break;
    }
  }

  return weeks;
}

function dayStatusStyle(status: string | undefined): { backgroundColor: string } | null {
  if (!status) return null;
  return { backgroundColor: REGISTRO_BG };
}

async function captureLocation(): Promise<BatidaMetadata> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { geolocalizacao_status: 'negada', geolocalizacao_autorizada: false };
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      precisao_metros: position.coords.accuracy ?? undefined,
      localizacao_capturada_em: new Date(position.timestamp).toISOString(),
      geolocalizacao_status: 'capturada',
      geolocalizacao_autorizada: true,
    };
  } catch {
    return { geolocalizacao_status: 'indisponivel', geolocalizacao_autorizada: false };
  }
}

export default function RHScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const now = new Date();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [dias, setDias] = useState<Record<string, DiaRelatorio>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(false);

  const [justifyVisible, setJustifyVisible] = useState(false);
  const [tipos, setTipos] = useState<JustificativaTipo[]>([]);
  const [tiposLoading, setTiposLoading] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<number | null>(null);
  const [tipoOpen, setTipoOpen] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState(todayKey());
  const [dataFim, setDataFim] = useState(todayKey());
  const [pickerField, setPickerField] = useState<'inicio' | 'fim' | null>(null);
  const [anexo, setAnexo] = useState<JustificativaAnexo | null>(null);
  const [saving, setSaving] = useState(false);

  const allowed = !!user && canSeeRH(user);

  const load = useCallback(async () => {
    if (!user || !allowed) return;
    setError('');
    try {
      const inicio = toDateKey(viewYear, viewMonth, 1);
      const fim = toDateKey(viewYear, viewMonth, new Date(viewYear, viewMonth + 1, 0).getDate());
      const relatorio = await getRelatorioPonto(user, inicio, fim);
      const map: Record<string, DiaRelatorio> = {};
      for (const dia of relatorio.dias) {
        map[String(dia.data_referencia).slice(0, 10)] = dia;
      }
      setDias(map);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o registro de ponto.');
    }
  }, [user, allowed, viewYear, viewMonth]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const weeks = useMemo(() => buildCalendar(viewYear, viewMonth), [viewYear, viewMonth]);
  const hoje = todayKey();
  const isToday = selectedDate === hoje;
  const diaSelecionado = dias[selectedDate];

  const saldoDia = Number(diaSelecionado?.saldo_minutos || 0);
  const horasTrabalhadas = Number(diaSelecionado?.minutos_trabalhados || 0);
  const saldoMes = useMemo(
    () => Object.values(dias).reduce((acc, dia) => acc + Number(dia.saldo_minutos || 0), 0),
    [dias]
  );
  const registros = diaSelecionado?.registros || [];

  function changeMonth(deltaMonth: number, deltaYear = 0) {
    const target = new Date(viewYear + deltaYear, viewMonth + deltaMonth, 1);
    setViewYear(target.getFullYear());
    setViewMonth(target.getMonth());
  }

  async function handleRegistrar() {
    if (!user || acting) return;
    if (!isToday) {
      Alert.alert('Registrar ponto', 'O ponto é registrado sempre na data e hora atuais. Selecione o dia de hoje.');
      return;
    }
    setActing(true);
    try {
      const metadata = await captureLocation();
      await registrarBatida(user, metadata);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível registrar o ponto.');
    } finally {
      setActing(false);
    }
  }

  async function handleRecalcular() {
    if (!user || acting) return;
    setActing(true);
    try {
      await recalcularDia(user, selectedDate);
      await load();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível recalcular o dia.');
    } finally {
      setActing(false);
    }
  }

  async function openJustify() {
    setTipoSelecionado(null);
    setTipoOpen(false);
    setDescricao('');
    setDataInicio(selectedDate);
    setDataFim(selectedDate);
    setAnexo(null);
    setPickerField(null);
    setJustifyVisible(true);
    if (tipos.length === 0 && user) {
      setTiposLoading(true);
      try {
        setTipos(await getJustificativaTipos(user));
      } catch (err: any) {
        Alert.alert('Erro', err?.message || 'Não foi possível carregar os tipos de justificativa.');
      } finally {
        setTiposLoading(false);
      }
    }
  }

  function handlePickerConfirm(date: Date) {
    const field = pickerField;
    setPickerField(null);
    if (!field) return;
    const key = toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
    if (field === 'inicio') {
      setDataInicio(key);
      if (key > dataFim) setDataFim(key);
    } else {
      setDataFim(key < dataInicio ? dataInicio : key);
    }
  }

  async function handlePickAnexo() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setAnexo({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
  }

  async function handleJustificar() {
    if (!user || saving) return;
    if (!tipoSelecionado) {
      Alert.alert('Justificativa', 'Selecione o tipo de justificativa.');
      return;
    }
    setSaving(true);
    try {
      await adicionarJustificativa(user, tipoSelecionado, dataInicio, dataFim, descricao.trim(), anexo);
      setJustifyVisible(false);
      await load();
      Alert.alert('Justificativa', 'Justificativa enviada para aprovação.');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a justificativa.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Registro de Ponto" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/rh" />

      {!allowed ? (
        <PermissionDeniedState message="Você não tem acesso ao módulo de recursos humanos." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.muted} />}
        >
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.cardTitle}>Calendário</Text>
            </View>

            <View style={styles.calendar}>
              <View style={styles.calendarHeader}>
                <Pressable onPress={() => changeMonth(0, -1)} hitSlop={8} style={styles.navButton}>
                  <Text style={styles.navText}>«</Text>
                </Pressable>
                <Pressable onPress={() => changeMonth(-1)} hitSlop={8} style={styles.navButton}>
                  <Text style={styles.navText}>‹</Text>
                </Pressable>
                <Text style={styles.calendarTitle}>
                  {MONTH_NAMES[viewMonth]} de {viewYear}
                </Text>
                <Pressable onPress={() => changeMonth(1)} hitSlop={8} style={styles.navButton}>
                  <Text style={styles.navText}>›</Text>
                </Pressable>
                <Pressable onPress={() => changeMonth(0, 1)} hitSlop={8} style={styles.navButton}>
                  <Text style={styles.navText}>»</Text>
                </Pressable>
              </View>

              <View style={styles.weekRow}>
                {WEEKDAYS.map((weekday) => (
                  <Text key={weekday} style={styles.weekday}>
                    {weekday}
                  </Text>
                ))}
              </View>

              {loading ? (
                <View style={styles.calendarLoading}>
                  <ActivityIndicator color={colors.muted} />
                </View>
              ) : (
                weeks.map((week, index) => (
                  <View key={index} style={styles.weekRow}>
                    {week.map((cell) => {
                      const info = cell.inMonth ? dias[cell.dateKey] : undefined;
                      const statusStyle = cell.inMonth ? dayStatusStyle(info?.status) : null;
                      const isSelected = cell.inMonth && cell.dateKey === selectedDate;
                      const isHoje = cell.inMonth && cell.dateKey === hoje;
                      return (
                        <Pressable
                          key={cell.dateKey}
                          style={[
                            styles.dayCell,
                            statusStyle,
                            isHoje && styles.dayToday,
                            isSelected && styles.daySelected,
                          ]}
                          disabled={!cell.inMonth}
                          onPress={() => setSelectedDate(cell.dateKey)}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              !cell.inMonth && styles.dayTextMuted,
                              isSelected && styles.dayTextSelected,
                            ]}
                          >
                            {cell.day}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))
              )}
            </View>

            <Text style={styles.selectedLabel}>DATA SELECIONADA</Text>
            <Text style={styles.selectedValue}>{formatDateLong(selectedDate)}</Text>
          </View>

          {error ? (
            <View style={styles.card}>
              <Text style={styles.subtitle}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.saldoLabel}>SALDO DO DIA</Text>
            <Text style={[styles.saldoValue, { color: saldoDia < 0 ? NEGATIVE : POSITIVE }]}>
              {formatSaldo(saldoDia)}
            </Text>

            <Pressable
              style={[styles.primaryButton, (!isToday || acting) && styles.buttonDisabled]}
              onPress={handleRegistrar}
            >
              {acting ? (
                <ActivityIndicator color="#141414" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Registrar ponto</Text>
              )}
            </Pressable>

            <Pressable style={[styles.secondaryButton, acting && styles.buttonDisabled]} onPress={handleRecalcular}>
              <Ionicons name="refresh-outline" size={15} color={colors.textPrimary} />
              <Text style={styles.secondaryButtonText}>Recalcular dia</Text>
            </Pressable>

            <Text style={styles.infoLine}>
              Horas trabalhadas: <Text style={styles.infoStrong}>{formatSaldo(horasTrabalhadas)}</Text>
            </Text>
            <Text style={styles.infoLine}>
              Saldo do mês:{' '}
              <Text style={[styles.infoStrong, { color: saldoMes < 0 ? NEGATIVE : POSITIVE }]}>
                {formatSaldo(saldoMes)}
              </Text>
            </Text>
            <Text style={styles.infoLine}>
              Status: <Text style={styles.infoStrong}>{getStatusLabel(diaSelecionado?.status)}</Text>
            </Text>

            <View style={styles.registrosBox}>
              {registros.length === 0 ? (
                <Text style={styles.emptyText}>Você ainda não registrou nenhum ponto nesta data.</Text>
              ) : (
                registros.map((registro) => (
                  <View key={registro.id} style={styles.registroRow}>
                    <View style={styles.registroDot} />
                    <Text style={styles.registroTipo}>{getTipoBatidaLabel(registro.tipo)}</Text>
                    <Text style={styles.registroHora}>{formatHora(registro.data_hora)}</Text>
                  </View>
                ))
              )}
            </View>

            <Pressable style={styles.justifyButton} onPress={openJustify}>
              <Text style={styles.justifyButtonText}>Justificar este dia</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      <Modal visible={justifyVisible} transparent animationType="fade" onRequestClose={() => setJustifyVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar justificativa</Text>
              <Pressable onPress={() => setJustifyVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Data início</Text>
              <Pressable style={styles.fieldInput} onPress={() => setPickerField('inicio')}>
                <Text style={styles.fieldValue}>{formatDateBR(dataInicio)}</Text>
                <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              </Pressable>

              <Text style={styles.fieldLabel}>Data fim</Text>
              <Pressable style={styles.fieldInput} onPress={() => setPickerField('fim')}>
                <Text style={styles.fieldValue}>{formatDateBR(dataFim)}</Text>
                <Ionicons name="calendar-outline" size={16} color={colors.muted} />
              </Pressable>

              <Text style={styles.fieldLabel}>Tipo</Text>
              <Pressable style={styles.fieldInput} onPress={() => setTipoOpen((prev) => !prev)}>
                <Text style={[styles.fieldValue, !tipoSelecionado && { color: colors.muted }]}>
                  {tipos.find((tipo) => tipo.id === tipoSelecionado)?.descricao || 'Selecione o tipo'}
                </Text>
                <Ionicons name={tipoOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
              </Pressable>

              {tipoOpen &&
                (tiposLoading ? (
                  <ActivityIndicator color={colors.muted} style={{ marginVertical: 12 }} />
                ) : (
                  <View style={styles.tipoDropdown}>
                    {tipos.map((tipo) => {
                      const selected = tipoSelecionado === tipo.id;
                      return (
                        <Pressable
                          key={tipo.id}
                          style={[styles.tipoOption, selected && styles.tipoOptionSelected]}
                          onPress={() => {
                            setTipoSelecionado(tipo.id);
                            setTipoOpen(false);
                          }}
                        >
                          <Text style={[styles.tipoText, selected && styles.tipoTextSelected]}>
                            {tipo.descricao}
                          </Text>
                          {selected && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}

              <Text style={styles.fieldLabel}>Descrição opcional</Text>
              <TextInput
                style={styles.input}
                placeholder="Descrição opcional para complementar a justificativa."
                placeholderTextColor={colors.muted}
                value={descricao}
                onChangeText={setDescricao}
                maxLength={500}
                multiline
              />
              <Text style={styles.charCount}>{descricao.length}/500</Text>

              <Text style={styles.fieldLabel}>Anexo opcional</Text>
              <Pressable style={styles.fieldInput} onPress={handlePickAnexo}>
                <View style={styles.filePickButton}>
                  <Text style={styles.filePickButtonText}>Escolher arquivo</Text>
                </View>
                <Text style={styles.fileName} numberOfLines={1}>
                  {anexo?.name || 'Nenhum arquivo selecionado'}
                </Text>
                {anexo && (
                  <Pressable onPress={() => setAnexo(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.muted} />
                  </Pressable>
                )}
              </Pressable>
              <Text style={styles.fieldHint}>
                Você pode enviar um arquivo para complementar a justificativa.
              </Text>

              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancel} onPress={() => setJustifyVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable style={[styles.modalConfirm, saving && styles.buttonDisabled]} onPress={handleJustificar}>
                  {saving ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Enviar justificativa</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>

        <DatePickerModal
          visible={pickerField !== null}
          value={dateKeyToDate(pickerField === 'fim' ? dataFim : dataInicio)}
          title={pickerField === 'fim' ? 'Data final' : 'Data inicial'}
          onConfirm={handlePickerConfirm}
          onCancel={() => setPickerField(null)}
        />
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
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    ...cardSurface(colors, scheme),
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  calendar: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  calendarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    paddingVertical: 6,
  },
  calendarLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  daySelected: {
    backgroundColor: colors.accent,
    borderWidth: 0,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayTextMuted: {
    color: '#4A4A4F',
  },
  dayTextSelected: {
    color: '#141414',
    fontWeight: '700',
  },
  selectedLabel: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.muted,
  },
  selectedValue: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  saldoLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.muted,
  },
  saldoValue: {
    textAlign: 'center',
    fontSize: 44,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 16,
  },
  primaryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141414',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  infoLine: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted,
    marginBottom: 6,
  },
  infoStrong: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  registrosBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 10,
    marginBottom: 14,
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
  },
  registroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  registroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  registroTipo: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  registroHora: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  justifyButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(197,210,0,0.5)',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  justifyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  fieldInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  fieldValue: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  tipoDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: -8,
    marginBottom: 14,
    overflow: 'hidden',
  },
  tipoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tipoOptionSelected: {
    backgroundColor: colors.surface,
  },
  tipoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  tipoTextSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  input: {
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 14,
    padding: 12,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 14,
  },
  filePickButton: {
    borderRadius: 8,
    backgroundColor: colors.elevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filePickButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    color: colors.muted,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancel: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalConfirm: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  });
