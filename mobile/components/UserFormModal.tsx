import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

import type { ThemeColors } from '@/constants/theme/tokens';
import {
  AllowedMetaNumber,
  Cargo,
  criarUsuario,
  editarUsuario,
  Filial,
  getCargos,
  getFiliais,
  getMetaNumeros,
  getPermissionLabel,
  ManagedUser,
  PERMISSION_LABELS,
  UserFormPayload,
} from '@/services/usersApi';
import { useTheme } from '@/store/themeStore';
import type { User } from '@/types';

const GROUP_ORDER = [
  'Estoque',
  'Vendas',
  'Atendimento',
  'Comercial',
  'Meta e Ads',
  'Configurações',
  'Administrativo',
  'Financeiro',
  'Assinatura',
  'RH',
  'Outros',
];

const GROUP_BY_PREFIX: Record<string, string> = {
  stock: 'Estoque',
  sales: 'Vendas',
  chat: 'Atendimento',
  contacts: 'Atendimento',
  commercial: 'Comercial',
  meta: 'Meta e Ads',
  meta_ads: 'Meta e Ads',
  google_ads: 'Meta e Ads',
  ads: 'Meta e Ads',
  settings: 'Configurações',
  tags: 'Configurações',
  categories: 'Configurações',
  branches: 'Configurações',
  users: 'Administrativo',
  dashboard: 'Administrativo',
  admin: 'Administrativo',
  finance: 'Financeiro',
  financial: 'Financeiro',
  subscription: 'Assinatura',
  billing: 'Assinatura',
  hr: 'RH',
  ponto: 'RH',
};

// Catálogo mínimo caso o token não traga permissoes_plano
const FALLBACK_CATALOG = Object.keys(PERMISSION_LABELS);

const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: 'Pelo menos 8 caracteres', test: (v) => v.length >= 8 },
  { label: 'Pelo menos 1 caractere especial', test: (v) => /[^A-Za-z0-9]/.test(v) },
  { label: 'Pelo menos 1 letra maiuscula', test: (v) => /[A-Z]/.test(v) },
  { label: 'Pelo menos 1 letra minuscula', test: (v) => /[a-z]/.test(v) },
  { label: 'Pelo menos 1 numero', test: (v) => /[0-9]/.test(v) },
];

function getPermissionGroup(key: string): string {
  const prefix = key.split('.')[0];
  return GROUP_BY_PREFIX[prefix] || 'Outros';
}

interface UserFormModalProps {
  visible: boolean;
  authUser: User;
  editing: ManagedUser | null;
  onClose: () => void;
  onSaved: () => void;
}

export function UserFormModal({ visible, authUser, editing, onClose, onSaved }: UserFormModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [filialId, setFilialId] = useState<number | null>(null);
  const [filialOpen, setFilialOpen] = useState(false);
  const [cargoId, setCargoId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [allowedMetaIds, setAllowedMetaIds] = useState<number[]>([]);

  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [metaNumeros, setMetaNumeros] = useState<AllowedMetaNumber[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editing;

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
    setEmail(editing?.email ?? '');
    setTelefone(editing?.telefone ?? '');
    setPassword('');
    setFilialId(editing?.filial_id ?? null);
    setFilialOpen(false);
    setCargoId(null);
    setPermissions(editing?.permissions ?? []);
    setAllowedMetaIds(editing?.allowed_meta_param_ids ?? []);
  }, [visible, editing]);

  useEffect(() => {
    if (!visible) return;
    setLoadingData(true);
    Promise.all([
      getFiliais(authUser).catch(() => [] as Filial[]),
      getCargos().catch(() => [] as Cargo[]),
      getMetaNumeros(authUser).catch(() => [] as AllowedMetaNumber[]),
    ])
      .then(([filiaisData, cargosData, numerosData]) => {
        setFiliais(filiaisData);
        setCargos(cargosData);
        setMetaNumeros(numerosData);
      })
      .finally(() => setLoadingData(false));
  }, [visible, authUser]);

  const catalog = useMemo(() => {
    const planPerms = (authUser as any)?.permissoes_plano;
    const base: string[] = Array.isArray(planPerms) && planPerms.length > 0 ? planPerms : FALLBACK_CATALOG;
    // Garante que permissões já atribuídas ao usuário apareçam mesmo fora do plano
    return [...new Set([...base, ...(editing?.permissions ?? [])])];
  }, [authUser, editing]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const key of catalog) {
      const group = getPermissionGroup(key);
      groups.set(group, [...(groups.get(group) ?? []), key]);
    }
    return GROUP_ORDER.filter((group) => groups.has(group)).map((group) => ({
      group,
      keys: groups.get(group)!,
    }));
  }, [catalog]);

  const passwordChecks = PASSWORD_RULES.map((rule) => rule.test(password));
  const passwordScore = passwordChecks.filter(Boolean).length;
  const selectedFilial = filiais.find((filial) => filial.id === filialId) || null;

  function togglePermission(key: string) {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((perm) => perm !== key) : [...prev, key]
    );
  }

  function toggleMetaNumero(id: number) {
    setAllowedMetaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome do usuário.');
    if (!email.trim()) return Alert.alert('Atenção', 'Informe o email do usuário.');
    if (!isEdit && !password.trim()) return Alert.alert('Atenção', 'Informe uma senha para o novo usuário.');
    if (password.trim() && passwordScore < PASSWORD_RULES.length) {
      return Alert.alert('Atenção', 'A senha não atende todos os requisitos.');
    }
    if (!cargoId) return Alert.alert('Atenção', 'Selecione o cargo do usuário.');

    const payload: UserFormPayload = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      telefone: telefone.trim(),
      password: password.trim() || undefined,
      cargo_id: cargoId,
      filial_id: filialId,
      permissions,
      allowed_meta_param_ids: allowedMetaIds,
    };

    setSubmitting(true);
    try {
      if (isEdit && editing) {
        await editarUsuario(authUser, editing.id, payload);
      } else {
        await criarUsuario(authUser, payload);
      }
      onSaved();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível salvar o usuário.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {isEdit ? 'Editar Usuário e Permissões' : 'Novo Usuário'}
              </Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.form}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.field}>
                <Text style={styles.label}>Nome Completo</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nome completo"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>E-mail de Acesso</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@empresa.com"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Filial vinculada</Text>
                <Pressable style={styles.select} onPress={() => setFilialOpen((prev) => !prev)}>
                  <Text style={selectedFilial ? styles.selectValue : styles.selectPlaceholder}>
                    {selectedFilial
                      ? `${selectedFilial.name}${selectedFilial.isPrimary ? ' (Principal)' : ''}`
                      : 'Selecione a filial'}
                  </Text>
                  <Ionicons name={filialOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
                </Pressable>
                {filialOpen && (
                  <View style={styles.selectOptions}>
                    <Pressable
                      style={styles.selectOption}
                      onPress={() => {
                        setFilialId(null);
                        setFilialOpen(false);
                      }}
                    >
                      <Text style={styles.selectOptionText}>Sem filial</Text>
                    </Pressable>
                    {filiais.map((filial) => (
                      <Pressable
                        key={filial.id}
                        style={styles.selectOption}
                        onPress={() => {
                          setFilialId(filial.id);
                          setFilialOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.selectOptionText,
                            filial.id === filialId && styles.selectOptionActive,
                          ]}
                        >
                          {filial.name}
                          {filial.isPrimary ? ' (Principal)' : ''}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{isEdit ? 'Nova Senha (opcional)' : 'Senha'}</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={isEdit ? '' : 'Senha de acesso'}
                  placeholderTextColor={colors.muted}
                  secureTextEntry
                />
              </View>

              <View style={styles.passwordCard}>
                <View style={styles.passwordHeader}>
                  <Text style={styles.passwordTitle}>Sua senha precisa ter:</Text>
                  <Text style={styles.passwordScore}>
                    {passwordScore}/{PASSWORD_RULES.length}
                  </Text>
                </View>
                {isEdit && (
                  <Text style={styles.passwordHint}>
                    Preencha apenas se quiser trocar a senha atual deste usuario.
                  </Text>
                )}
                {PASSWORD_RULES.map((rule, index) => (
                  <View key={rule.label} style={styles.passwordRule}>
                    <View style={[styles.ruleDot, passwordChecks[index] && styles.ruleDotOk]} />
                    <Text style={[styles.ruleText, passwordChecks[index] && styles.ruleTextOk]}>
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Cargo</Text>
                {loadingData ? (
                  <ActivityIndicator color={colors.muted} />
                ) : (
                  <View style={styles.chipsWrap}>
                    {cargos.map((cargo) => {
                      const active = cargo.id === cargoId;
                      return (
                        <Pressable
                          key={cargo.id}
                          onPress={() => setCargoId(cargo.id)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{cargo.nome}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Permissões de Acesso</Text>
              <View style={styles.permissionGrid}>
                {groupedPermissions.map(({ group, keys }) => (
                  <View key={group} style={styles.permissionGroup}>
                    <Text style={styles.groupTitle}>{group}</Text>
                    {keys.map((key) => {
                      const active = permissions.includes(key);
                      return (
                        <Pressable
                          key={key}
                          onPress={() => togglePermission(key)}
                          style={styles.permissionRow}
                        >
                          <View style={[styles.checkbox, active && styles.checkboxActive]}>
                            {active && <Ionicons name="checkmark" size={13} color="#141414" />}
                          </View>
                          <Text style={styles.permissionLabel}>{getPermissionLabel(key)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              {metaNumeros.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Números da Meta para atendimento</Text>
                  <View style={styles.metaList}>
                    {metaNumeros.map((numero) => {
                      const active = allowedMetaIds.includes(numero.id);
                      return (
                        <Pressable
                          key={numero.id}
                          onPress={() => toggleMetaNumero(numero.id)}
                          style={styles.metaCard}
                        >
                          <View style={[styles.checkbox, active && styles.checkboxActive]}>
                            {active && <Ionicons name="checkmark" size={13} color="#141414" />}
                          </View>
                          <View style={styles.metaInfo}>
                            <Text style={styles.metaPhone}>
                              {numero.display_phone_number || `#${numero.id}`}
                            </Text>
                            {(numero.verified_name || numero.whatsapp_account_name) && (
                              <Text style={styles.metaName}>
                                {numero.verified_name || numero.whatsapp_account_name}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <View style={styles.footer}>
                <Pressable style={styles.cancelButton} onPress={onClose} disabled={submitting}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitButton, submitting && styles.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#141414" />
                  ) : (
                    <Text style={styles.submitText}>Salvar Usuário</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '94%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    flex: 1,
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
  form: {
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
  },
  selectValue: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  selectPlaceholder: {
    fontSize: 15,
    color: colors.muted,
  },
  selectOptions: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  selectOptionText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  selectOptionActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  passwordCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  passwordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  passwordScore: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  passwordHint: {
    fontSize: 12,
    color: colors.muted,
  },
  passwordRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 4,
  },
  ruleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  ruleDotOk: {
    backgroundColor: colors.accent,
  },
  ruleText: {
    fontSize: 13,
    color: colors.muted,
  },
  ruleTextOk: {
    color: colors.accent,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: '#141414',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  permissionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  permissionGroup: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 8,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 2,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  permissionLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  metaList: {
    gap: 10,
  },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metaInfo: {
    flex: 1,
  },
  metaPhone: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metaName: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
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
  });
