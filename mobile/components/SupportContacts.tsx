import { useMemo } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '@/constants/support';
import type { ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';

async function abrir(url: string, falha: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Não foi possível abrir', falha);
  }
}

export function SupportContacts() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Pressable
        style={styles.button}
        onPress={() =>
          abrir(`mailto:${SUPPORT_EMAIL}`, `Escreva para ${SUPPORT_EMAIL} pelo seu app de e-mail.`)
        }
      >
        <Ionicons name="mail-outline" size={16} color={colors.textPrimary} />
        <Text style={styles.text}>{SUPPORT_EMAIL}</Text>
      </Pressable>
      {!!SUPPORT_WHATSAPP && (
        <Pressable
          style={styles.button}
          onPress={() =>
            abrir(`https://wa.me/${SUPPORT_WHATSAPP}`, 'Verifique se o WhatsApp está instalado.')
          }
        >
          <Ionicons name="logo-whatsapp" size={16} color={colors.textPrimary} />
          <Text style={styles.text}>Falar no WhatsApp</Text>
        </Pressable>
      )}
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
