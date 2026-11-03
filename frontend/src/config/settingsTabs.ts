export type SettingsTab =
  | "quick-messages"
  | "tags"
  | "meta"
  | "google-ads"
  | "branches"
  | "categories"
  | "integrations"
  | "developers"
  | "ai"
  | "nps";

export type SettingsTabConfig = {
  key: SettingsTab;
  label: string;
  permission?: string;
  permissionsAny?: string[];
};

export const SETTINGS_TABS: SettingsTabConfig[] = [
  { key: "quick-messages", label: "Mensagens Rapidas", permission: "settings.quick_messages" },
  { key: "tags", label: "Tags", permission: "settings.tags" },
  { key: "meta", label: "META", permissionsAny: ["settings.api_meta", "settings.api_meta_ads"] },
  { key: "google-ads", label: "Google Ads", permission: "google_ads.view" },
  { key: "branches", label: "Filiais", permission: "settings.branches" },
  { key: "categories", label: "Categorias", permission: "settings.categories" },
  { key: "integrations", label: "Integrações", permission: "settings.view" },
  { key: "developers", label: "Desenvolvedores", permission: "settings.view" },
  { key: "ai", label: "IA", permission: "settings.view" },
  { key: "nps", label: "NPS", permission: "settings.view" },
];

export const SETTINGS_ACCESS_PERMISSIONS = Array.from(
  new Set(
    SETTINGS_TABS.flatMap((tab) => [
      ...(tab.permission ? [tab.permission] : []),
      ...(Array.isArray(tab.permissionsAny) ? tab.permissionsAny : []),
    ])
  )
);
