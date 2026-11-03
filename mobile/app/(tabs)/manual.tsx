import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppDrawer } from '@/components/AppDrawer';
import { ManualArticleModal } from '@/components/ManualArticleModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { MANUAL_MODULES, type ManualGuide, type ManualModule } from '@/services/manual';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

interface OpenGuide {
  module: ManualModule;
  guide: ManualGuide;
}

export default function ManualScreen() {
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const { width } = useWindowDimensions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<OpenGuide | null>(null);

  const modules = useMemo(
    () => (user ? MANUAL_MODULES.filter((module) => module.visible(user)) : []),
    [user]
  );

  const searchLower = search.trim().toLowerCase();

  const filteredModules = useMemo(() => {
    if (!searchLower) return modules;
    return modules
      .map((module) => ({
        ...module,
        guides: module.guides.filter(
          (guide) =>
            guide.title.toLowerCase().includes(searchLower) ||
            guide.summary.toLowerCase().includes(searchLower) ||
            module.label.toLowerCase().includes(searchLower) ||
            guide.keywords.some((keyword) => keyword.toLowerCase().includes(searchLower))
        ),
      }))
      .filter((module) => module.guides.length > 0);
  }, [modules, searchLower]);

  const shortcutModules = useMemo(
    () => modules.filter((module) => module.showInShortcuts),
    [modules]
  );

  const columns = width >= 1000 ? 4 : width >= 680 ? 2 : 1;
  const gridGap = 12;
  const availableWidth = Math.min(width, 1200) - 48;
  const cardWidth = (availableWidth - gridGap * (columns - 1)) / columns;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Manual Operacional" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/manual" />

      {!user ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Sem sessão ativa</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>Manual</Text>
          <Text style={styles.pageSubtitle}>Guias operacionais por módulo</Text>

          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="book-outline" size={22} color={colors.accent} />
            </View>
            <Text style={styles.heroEyebrow}>MANUAL OPERACIONAL</Text>
            <Text style={styles.heroTitle}>Encontre o passo a passo de cada módulo do sistema.</Text>
            <Text style={styles.heroSubtitle}>
              Use a busca ou navegue pelos módulos abaixo. Os artigos exibidos são filtrados conforme as permissões
              do seu usuário.
            </Text>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Pesquisar no manual..."
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {searchLower ? (
            filteredModules.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum artigo encontrado para "{search}".</Text>
            ) : (
              <View style={styles.index}>
                <Text style={styles.resultsTitle}>Resultados da busca</Text>
                {filteredModules.map((module) => (
                  <View key={module.id} style={styles.indexSection}>
                    <Text style={styles.indexSectionTitle}>{module.label.toUpperCase()}</Text>
                    {module.guides.map((guide) => {
                      const isOpen = open?.guide.slug === guide.slug;
                      return (
                        <Pressable
                          key={guide.slug}
                          onPress={() => setOpen({ module, guide })}
                          style={[styles.indexRow, isOpen && styles.indexRowActive]}
                        >
                          <Text style={[styles.indexRowText, isOpen && styles.indexRowTextActive]}>
                            {guide.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            )
          ) : (
            <>
              <View style={styles.shortcutsHeader}>
                <Ionicons name="star" size={16} color={colors.accent} />
                <Text style={styles.shortcutsTitle}>Atalhos rápidos</Text>
              </View>

              <View style={styles.grid}>
                {shortcutModules.map((module) => {
                  const guide = module.guides[0];
                  const enabled = !!guide && module.visible(user);
                  return (
                    <View key={module.id} style={[styles.card, { width: cardWidth }]}>
                      <Text style={styles.cardEyebrow}>{module.label}</Text>
                      <Text style={styles.cardTitle}>{guide?.title ?? module.label}</Text>
                      <Text style={styles.cardSummary} numberOfLines={3}>
                        {guide?.summary ?? 'Guia em preparação.'}
                      </Text>
                      {enabled ? (
                        <Pressable onPress={() => setOpen({ module, guide })} hitSlop={8}>
                          <Text style={styles.cardLink}>Abrir guia →</Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.cardLinkDisabled}>Em breve</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              <Text style={styles.modulesTitle}>Módulos disponíveis para você</Text>

              <View style={styles.grid}>
                {modules.map((module) => {
                  const firstGuide = module.guides[0];
                  const count = module.guides.length;
                  return (
                    <Pressable
                      key={module.id}
                      disabled={!firstGuide}
                      onPress={() => firstGuide && setOpen({ module, guide: firstGuide })}
                      style={[styles.moduleCard, { width: cardWidth }]}
                    >
                      <Text style={styles.moduleCardTitle}>{module.label}</Text>
                      <Text style={styles.moduleCardDescription} numberOfLines={3}>
                        {module.description}
                      </Text>
                      <Text style={styles.moduleCardCount}>
                        {count} artigo{count === 1 ? '' : 's'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      <ManualArticleModal
        visible={!!open}
        moduleLabel={open?.module.label ?? ''}
        moduleRoute={open?.module.route}
        guide={open?.guide ?? null}
        onClose={() => setOpen(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      gap: 8,
    },
    pageTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    pageSubtitle: {
      fontSize: 13,
      color: colors.accent,
      marginBottom: 16,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
    },
    emptyText: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 20,
    },
    index: {
      gap: 18,
      marginBottom: 28,
    },
    resultsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    indexSection: {
      gap: 2,
    },
    indexSectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.muted,
      marginBottom: 6,
    },
    indexRow: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    indexRowActive: {
      backgroundColor: colors.surface,
    },
    indexRowText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    indexRowTextActive: {
      color: colors.accent,
      fontWeight: '700',
    },
    hero: {
      borderRadius: 16,
      padding: 20,
      gap: 8,
      marginBottom: 24,
      ...cardSurface(colors, scheme),
    },
    heroIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: 'rgba(197,210,0,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: colors.accent,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    heroSubtitle: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.muted,
    },
    shortcutsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    shortcutsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    card: {
      borderRadius: 16,
      padding: 16,
      gap: 6,
      ...cardSurface(colors, scheme),
    },
    cardEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: colors.accent,
      textTransform: 'uppercase',
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardSummary: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.muted,
      marginBottom: 6,
    },
    cardLink: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
    },
    cardLinkDisabled: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.muted,
      opacity: 0.6,
    },
    modulesTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 28,
      marginBottom: 14,
    },
    moduleCard: {
      borderRadius: 16,
      padding: 16,
      gap: 6,
      ...cardSurface(colors, scheme),
    },
    moduleCardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    moduleCardDescription: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.muted,
      marginBottom: 6,
    },
    moduleCardCount: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
    },
  });
