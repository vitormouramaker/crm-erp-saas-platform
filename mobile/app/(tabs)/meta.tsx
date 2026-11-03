import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppDrawer } from '@/components/AppDrawer';
import { AutomationScheduleTab } from '@/components/AutomationScheduleTab';
import { AutoMessagesTab } from '@/components/AutoMessagesTab';
import { DispatchCostTab } from '@/components/DispatchCostTab';
import { DispatchReportTab } from '@/components/DispatchReportTab';
import { InstagramIntegrationTab } from '@/components/InstagramIntegrationTab';
import { MetaAdsIntegrationTab } from '@/components/MetaAdsIntegrationTab';
import { MetaTemplatesTab } from '@/components/MetaTemplatesTab';
import { WhatsAppProfileTab } from '@/components/WhatsAppProfileTab';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PermissionDeniedState } from '@/components/ScreenState';
import type { ThemeColors } from '@/constants/theme/tokens';
import { canSeeMeta } from '@/services/permissions';
import { useAuth } from '@/store/authStore';
import { useTheme } from '@/store/themeStore';

type MetaSection = 'api_meta' | 'relatorio_envios' | 'meta_ads' | 'instagram';
type ApiMetaTab = 'perfil' | 'templates' | 'custos' | 'automaticas' | 'agendamento';

const SECTIONS: { key: MetaSection; label: string; enabled: boolean }[] = [
  { key: 'api_meta', label: 'API Meta', enabled: true },
  { key: 'relatorio_envios', label: 'Relatorio de envios', enabled: true },
  { key: 'meta_ads', label: 'Meta Ads', enabled: true },
  { key: 'instagram', label: 'Instagram', enabled: true },
];

const API_META_TABS: { key: ApiMetaTab; label: string; enabled: boolean }[] = [
  { key: 'perfil', label: 'Perfil do WhatsApp', enabled: true },
  { key: 'templates', label: 'Templates da Meta', enabled: true },
  { key: 'custos', label: 'Custos de disparo', enabled: true },
  { key: 'automaticas', label: 'Mensagens automáticas', enabled: true },
  { key: 'agendamento', label: 'Agendamento de automação', enabled: true },
];

export default function GestaoMetaScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [section, setSection] = useState<MetaSection>('api_meta');
  const [apiMetaTab, setApiMetaTab] = useState<ApiMetaTab>('templates');

  const allowed = !!user && canSeeMeta(user);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Gestão da Meta" onMenuPress={() => setDrawerOpen(true)} />
      <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/(tabs)/meta" />

      {!allowed ? (
        <PermissionDeniedState message="Você não tem acesso à Gestão da Meta." />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scrollShrink}
            contentContainerStyle={styles.sectionsRow}
          >
            {SECTIONS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => item.enabled && setSection(item.key)}
                style={[styles.sectionItem, item.key === section && styles.sectionItemActive]}
              >
                <Text
                  style={[
                    styles.sectionText,
                    item.key === section && styles.sectionTextActive,
                    !item.enabled && styles.disabledText,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {section === 'api_meta' && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.scrollShrink}
                contentContainerStyle={styles.tabsRow}
              >
                {API_META_TABS.map((tab) => (
                  <Pressable
                    key={tab.key}
                    onPress={() => tab.enabled && setApiMetaTab(tab.key)}
                    style={[styles.tabChip, tab.key === apiMetaTab && styles.tabChipActive]}
                  >
                    <Text
                      style={[
                        styles.tabChipText,
                        tab.key === apiMetaTab && styles.tabChipTextActive,
                        !tab.enabled && styles.disabledText,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {apiMetaTab === 'perfil' && user && <WhatsAppProfileTab user={user} />}
              {apiMetaTab === 'templates' && user && <MetaTemplatesTab user={user} />}
              {apiMetaTab === 'custos' && user && <DispatchCostTab user={user} />}
              {apiMetaTab === 'automaticas' && user && <AutoMessagesTab user={user} />}
              {apiMetaTab === 'agendamento' && user && <AutomationScheduleTab user={user} />}
            </>
          )}

          {section === 'relatorio_envios' && user && <DispatchReportTab user={user} />}
          {section === 'meta_ads' && user && <MetaAdsIntegrationTab user={user} />}
          {section === 'instagram' && user && <InstagramIntegrationTab user={user} />}
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollShrink: {
      flexGrow: 0,
      flexShrink: 0,
    },
    sectionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      gap: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 10,
      marginBottom: 14,
    },
    sectionItem: {
      paddingBottom: 4,
    },
    sectionItemActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.accent,
    },
    sectionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
    sectionTextActive: {
      color: colors.accent,
    },
    tabsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      gap: 8,
      marginBottom: 14,
    },
    tabChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    tabChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.muted,
    },
    tabChipTextActive: {
      color: '#141414',
    },
    disabledText: {
      opacity: 0.5,
    },
  });
