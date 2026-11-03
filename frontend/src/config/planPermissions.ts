/**
 * Map de permissões liberadas por plano.
 * Essas são as permissões que O SISTEMA permite EXISTIR para aquele plano.
 *
 * Não significa que todas podem ser concedidas a usuários comuns.
 */
export const PLAN_PERMISSIONS: Record<number, string[]> = {
  // BASIC
  1: [
    "users.manage",
    "settings.view",
    "subscription.manage",
    "dashboard.view",
    "commercial.view",
    "commercial.manager",
    "contacts.view",
    "contacts.view_all",
    "chat.view",
    "chat.manager",
    "chat.view_all_messages",
    "reports.nps.view",
    "commercial.pipeline",
    "commercial.scheduled_dispatches",
    "commercial.dashbord",
    "commercial.report",
    "settings.quick_messages",
    "settings.tags",
    "settings.branches",
    "settings.categories",
    "meta.view",
    "settings.api_meta",
    "settings.api_meta_ads",
  ],

  // BUSINESS
  2: [
    "users.manage",
    "settings.view",
    "financial.manage",
    "subscription.manage",
    "commercial.view",
    "commercial.manager",
    "contacts.view",
    "contacts.view_all",
    "chat.view",
    "chat.manager",
    "chat.view_all_messages",
    "reports.nps.view",
    "dashboard.view",
    "commercial.pipeline",
    "commercial.scheduled_dispatches",
    "commercial.dashbord",
    "commercial.report",
    "settings.quick_messages",
    "settings.tags",
    "settings.branches",
    "settings.categories",
    "meta.view",
    "meta_ads.view",
    "google_ads.view",
    "settings.api_meta",
    "settings.api_meta_ads",
  ],

  // ENTERPRISE
  3: [
    "users.manage",
    "settings.view",
    "financial.manage",
    "subscription.manage",
    "commercial.view",
    "commercial.manager",
    "contacts.view",
    "contacts.view_all",
    "chat.view",
    "chat.manager",
    "chat.view_all_messages",
    "reports.nps.view",
    "dashboard.view",
    "commercial.pipeline",
    "commercial.scheduled_dispatches",
    "commercial.dashbord",
    "commercial.report",
    "settings.quick_messages",
    "settings.tags",
    "settings.branches",
    "settings.categories",
    "meta.view",
    "meta_ads.view",
    "google_ads.view",
    "settings.api_meta",
    "settings.api_meta_ads",
    "rh.point.register",
    "rh.point.manage",
  ],
};

/**
 * Retorna permissões liberadas para um id_plano (VISUALIZAÇÃO/ACESSO)
 */
export function getPlanPermissions(planId?: number, has_pdv?: boolean): string[] {
  if (!planId) return [];

  const planPermissions = [...(PLAN_PERMISSIONS[planId] ?? [])];

  if (!has_pdv) return planPermissions;

  const pdvPermissions = [
    "sales.view",
    "sales.create",
    "stock.view",
    "stock.products.manage",
    "stock.suppliers.view",
    "stock.orders.view",
    "stock.orders.create",
  ];

  return [...new Set([...planPermissions, ...pdvPermissions])];
}

/**
 * Sanitiza permissões escolhidas, removendo tudo que não está no allowed.
 * (Proteção anti DevTools / request manual)
 */
export function sanitizePermissions(
  selected: string[] | undefined | null,
  allowed: string[] | undefined | null
): string[] {
  const sel = Array.isArray(selected) ? selected : [];
  const allow = Array.isArray(allowed) ? allowed : [];

  const allowedSet = new Set(allow);
  return sel.filter((p) => allowedSet.has(p));
}

/**
 * Regra: o que o admin MASTER pode conceder para usuários NÃO-master.
 *
 * Hoje segue exatamente o teto de permissões do plano do usuário logado.
 */
export function getGrantablePermissionsForUser(user: {
  is_master?: boolean;
  id_plano?: number;
  pdv?: boolean;
}): string[] {
  return getPlanPermissions(user?.id_plano, user?.pdv);
}
