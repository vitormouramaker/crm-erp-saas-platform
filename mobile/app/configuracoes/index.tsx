import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '@/constants/theme/tokens';
import { FONT_SIZE, SPACING } from '@/constants/Theme';
import {
  canManageCategorias,
  canManageDesenvolvedores,
  canManageFiliais,
  canManageIA,
  canManageNPS,
  canManageQuickMessages,
  canManageTags,
  canSeeGoogleAds,
  canSeeIntegracoes,
  canSeeMeta,
} from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

type IconName = keyof typeof Ionicons.glyphMap;

interface SectionItem {
  key: string;
  label: string;
  description: string;
  icon: IconName;
  enabled: boolean;
  onPress?: () => void;
}

interface SectionGroup {
  title: string;
  items: SectionItem[];
}

export default function ConfiguracoesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!user) return null;

  const groups: SectionGroup[] = [
    {
      title: 'ATENDIMENTO',
      items: [
        {
          key: 'mensagens_rapidas',
          label: 'Mensagens Rápidas',
          description: 'Respostas prontas com texto, imagem ou documento para o atendimento.',
          icon: 'chatbox-ellipses-outline',
          enabled: canManageQuickMessages(user),
          onPress: () => router.push('/configuracoes/mensagens-rapidas' as never),
        },
        {
          key: 'tags',
          label: 'Tags',
          description: 'Organize seus contatos com etiquetas personalizadas.',
          icon: 'pricetag-outline',
          enabled: canManageTags(user),
          onPress: () => router.push('/configuracoes/tags' as never),
        },
        {
          key: 'bloqueados',
          label: 'Contatos bloqueados',
          description: 'Veja e desbloqueie contatos que você bloqueou.',
          icon: 'ban-outline',
          enabled: true,
          onPress: () => router.push('/configuracoes/bloqueados' as never),
        },
        {
          key: 'ia',
          label: 'IA',
          description: 'Configurações de inteligência artificial no atendimento.',
          icon: 'sparkles-outline',
          enabled: canManageIA(user),
          onPress: () => router.push('/configuracoes/ia' as never),
        },
        {
          key: 'nps',
          label: 'NPS',
          description: 'Pesquisas de satisfação enviadas aos clientes.',
          icon: 'happy-outline',
          enabled: canManageNPS(user),
          onPress: () => router.push('/configuracoes/nps' as never),
        },
      ],
    },
    {
      title: 'CADASTROS',
      items: [
        {
          key: 'filiais',
          label: 'Filiais',
          description: 'Gerencie as unidades da sua empresa.',
          icon: 'business-outline',
          enabled: canManageFiliais(user),
          onPress: () => router.push('/configuracoes/filiais' as never),
        },
        {
          key: 'categorias',
          label: 'Categorias',
          description: 'Categorias de produtos e serviços.',
          icon: 'grid-outline',
          enabled: canManageCategorias(user),
          onPress: () => router.push('/configuracoes/categorias' as never),
        },
      ],
    },
    {
      title: 'MARKETING & INTEGRAÇÕES',
      items: [
        {
          key: 'meta',
          label: 'Configurar Meta',
          description: 'Integração com WhatsApp Business.',
          icon: 'infinite-outline',
          enabled: canSeeMeta(user),
          onPress: () => router.push('/configuracoes/meta' as never),
        },
        {
          key: 'google_ads',
          label: 'Google Ads',
          description: 'Configurações de campanhas e conversões.',
          icon: 'logo-google',
          enabled: canSeeGoogleAds(user),
          onPress: () => router.push('/configuracoes/google-ads' as never),
        },
        {
          key: 'integracoes',
          label: 'Integrações',
          description: 'Conecte outras ferramentas à sua conta.',
          icon: 'git-network-outline',
          enabled: canSeeIntegracoes(user),
          onPress: () => router.push('/configuracoes/integracoes' as never),
        },
      ],
    },
    {
      title: 'AVANÇADO',
      items: [
        {
          key: 'desenvolvedores',
          label: 'Desenvolvedores',
          description: 'Recursos e credenciais para integrações avançadas.',
          icon: 'code-slash-outline',
          enabled: canManageDesenvolvedores(user),
          onPress: () => router.push('/configuracoes/desenvolvedores' as never),
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {groups.map((group, groupIndex) => (
          <View key={group.title}>
            <Text style={[styles.groupHeader, groupIndex === 0 && styles.groupHeaderFirst]}>
              {group.title}
            </Text>
            {group.items.map((section, itemIndex) => (
              <Pressable
                key={section.key}
                style={[
                  styles.row,
                  groupIndex === groups.length - 1 &&
                    itemIndex === group.items.length - 1 &&
                    styles.rowLast,
                  !section.enabled && styles.cardDisabled,
                ]}
                onPress={section.enabled ? section.onPress : undefined}
                disabled={!section.enabled}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={section.icon} size={20} color={colors.accent} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardLabel}>{section.label}</Text>
                  <Text style={styles.cardDescription}>{section.description}</Text>
                </View>
                {section.enabled ? (
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                ) : (
                  <Text style={styles.soonBadge}>EM BREVE</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 20,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    list: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    cardDisabled: {
      opacity: 0.5,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.primarySubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupHeader: {
      fontSize: FONT_SIZE.xs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: SPACING.lg,
      marginBottom: SPACING.sm,
      paddingHorizontal: 4,
    },
    groupHeaderFirst: {
      marginTop: SPACING.md,
    },
    cardInfo: {
      flex: 1,
    },
    cardLabel: {
      fontSize: FONT_SIZE.md,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardDescription: {
      fontSize: FONT_SIZE.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    soonBadge: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.textSecondary,
    },
  });
