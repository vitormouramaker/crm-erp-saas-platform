import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Logo } from '@/components/Logo';
import type { ThemeColors } from '@/constants/theme/tokens';
import { forgotPassword, resetPassword } from '@/services/authApi';
import { useTheme } from '@/store/themeStore';

export default function RedefinirSenhaScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = String(emailParam || '');
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit() {
    if (!codigo.trim()) {
      Alert.alert('Informe o código', 'Digite o código enviado para seu email.');
      return;
    }
    if (senha.length < 6) {
      Alert.alert('Senha muito curta', 'A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (senha !== confirmarSenha) {
      Alert.alert('Senhas não conferem', 'A confirmação deve ser igual à nova senha.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPassword(email, codigo.trim(), senha);
      if (result.success) {
        Alert.alert('Pronto!', 'Senha alterada com sucesso.', [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') },
        ]);
      } else {
        Alert.alert('Erro ao redefinir senha', result.message);
      }
    } catch (error) {
      console.log('reset password error', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      const result = await forgotPassword(email);
      if (result.success) {
        Alert.alert('Código reenviado', 'Verifique sua caixa de email.');
      } else {
        Alert.alert('Erro', result.message);
      }
    } catch (error) {
      console.log('resend code error', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.brandRow}>
              <Logo size={40} color={colors.accent} />
              <Text style={styles.brandName}>ÓRBITA</Text>
            </View>
            <Text style={styles.brandTagline}>O CENTRO INTELIGENTE DA SUA OPERAÇÃO</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Nova Senha</Text>
            <Text style={styles.subtitle}>
              Digite o código enviado para {email || 'seu email'} e cadastre sua nova senha.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Código de verificação</Text>
              <TextInput
                style={styles.input}
                value={codigo}
                onChangeText={setCodigo}
                placeholder="000000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nova senha</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Digite a nova senha"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.muted}
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Confirmar nova senha</Text>
              <TextInput
                style={styles.input}
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                placeholder="Repita a nova senha"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
              />
            </View>

            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#141414" />
              ) : (
                <Text style={styles.buttonText}>Redefinir senha</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.backLink}
              onPress={handleResend}
              disabled={resending}
              hitSlop={8}
            >
              <Text style={styles.backLinkText}>
                {resending ? 'Reenviando...' : 'Reenviar código'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.backLink}
              onPress={() => router.replace('/(auth)/login')}
              hitSlop={8}
            >
              <Text style={styles.backLinkTextMuted}>Voltar para o Login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 40,
    },
    brand: {
      marginBottom: 48,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    brandName: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    brandTagline: {
      marginTop: 4,
      marginLeft: 50,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 1.2,
      color: colors.accent,
    },
    header: {
      marginBottom: 32,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 14,
      color: colors.muted,
    },
    form: {
      gap: 20,
    },
    field: {
      gap: 8,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    input: {
      height: 52,
      borderRadius: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 15,
    },
    passwordWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    passwordInput: {
      flex: 1,
      height: '100%',
      paddingHorizontal: 16,
      color: colors.textPrimary,
      fontSize: 15,
    },
    eyeButton: {
      paddingHorizontal: 14,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    button: {
      marginTop: 12,
      height: 54,
      borderRadius: 16,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#141414',
    },
    backLink: {
      alignItems: 'center',
      marginTop: 4,
    },
    backLinkText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
    },
    backLinkTextMuted: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
  });
