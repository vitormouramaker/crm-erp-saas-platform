import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { PRIVACY_URL, TERMS_URL } from '@/constants/legal';
import type { ThemeColors } from '@/constants/theme/tokens';
import { loadCredentials, login } from '@/services/authApi';
import { getLandingRoute } from '@/services/permissions';
import { hasAcceptedCurrentTerms, saveTermsAcceptance } from '@/services/termsAcceptance';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { setSession } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    (async () => {
      const credentials = await loadCredentials();
      if (credentials) {
        setEmail(credentials.email);
        setPassword(credentials.senha);
        setRememberMe(true);
      }
      setAcceptedTerms(await hasAcceptedCurrentTerms());
    })();
  }, []);

  async function handleLogin() {
    if (!acceptedTerms) {
      Alert.alert(
        'Aceite os termos',
        'Para entrar, aceite os Termos de Uso e a Política de Privacidade.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await login(email, password, rememberMe);
      console.log('login result', result);

      if (result.success && result.user && result.token) {
        await saveTermsAcceptance();
        setSession(result.token, result.user);
        router.replace(getLandingRoute(result.user));
      } else {
        Alert.alert('Erro ao entrar', result.message);
      }
    } catch (error) {
      console.log('login error', error);
      Alert.alert('Erro ao entrar', 'Não foi possível conectar ao servidor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior="translate-with-padding">
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Image
              source={
                scheme === 'dark'
                  ? require('@/assets/images/logo-dark.png')
                  : require('@/assets/images/logo-light.png')
              }
              style={styles.brandLogo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Bem-vindo de volta!</Text>
            <Text style={styles.subtitle}>Faça login para acessar a plataforma.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Sua senha"
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

            <View style={styles.optionsRow}>
              <Pressable
                style={styles.rememberRow}
                onPress={() => setRememberMe((prev) => !prev)}
                hitSlop={8}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Lembrar dados</Text>
              </Pressable>

              <Pressable hitSlop={8} onPress={() => router.push('/recuperar-senha')}>
                <Text style={styles.forgotText}>Esqueceu a senha?</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.termsRow}
              onPress={() => setAcceptedTerms((prev) => !prev)}
              hitSlop={8}
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                Li e aceito os{' '}
                <Text style={styles.termsLink} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
                  Termos de Uso
                </Text>{' '}
                e a{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
                >
                  Política de Privacidade
                </Text>
                .
              </Text>
            </Pressable>

            <Pressable
              style={[styles.button, (submitting || !acceptedTerms) && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#141414" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
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
    brandLogo: {
      width: 160,
      height: 44,
    },
    brandTagline: {
      marginTop: 8,
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
    optionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: -4,
    },
    rememberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.checkBlue,
      borderColor: colors.checkBlue,
    },
    checkboxMark: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    rememberText: {
      fontSize: 13,
      color: colors.textPrimary,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    termsText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textPrimary,
    },
    termsLink: {
      fontWeight: '600',
      color: colors.accent,
    },
    forgotText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.accent,
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
  });
