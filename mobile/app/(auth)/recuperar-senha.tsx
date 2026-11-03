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
import { router } from 'expo-router';

import { Logo } from '@/components/Logo';
import type { ThemeColors } from '@/constants/theme/tokens';
import { forgotPassword } from '@/services/authApi';
import { useTheme } from '@/store/themeStore';

export default function RecuperarSenhaScreen() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function handleSubmit() {
    if (!email.trim()) {
      Alert.alert('Informe seu email', 'Digite o email cadastrado para continuar.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await forgotPassword(email.trim());
      if (result.success) {
        router.push({ pathname: '/redefinir-senha', params: { email: email.trim() } });
      } else {
        Alert.alert('Erro', result.message);
      }
    } catch (error) {
      console.log('forgot password error', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor.');
    } finally {
      setSubmitting(false);
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
            <Text style={styles.title}>Recuperar Senha</Text>
            <Text style={styles.subtitle}>
              Digite seu e-mail e enviaremos um código com o link para redefinir sua senha.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seuemail@empresa.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
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
                <Text style={styles.buttonText}>Enviar código de recuperação</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.backLink}
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Text style={styles.backLinkText}>Voltar para o Login</Text>
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
  });
