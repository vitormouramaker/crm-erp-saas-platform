import type { User } from '@/types';

export function canSeeDashboard(user: User): boolean {
  return user.is_master || user.permissions.includes('commercial.view');
}

export function canSeeComercial(user: User): boolean {
  return user.is_master || user.permissions.includes('commercial.view');
}

export function canSeeScheduledDispatches(user: User): boolean {
  return user.is_master || user.permissions.includes('commercial.scheduled_dispatches');
}

export function canManageVendas(user: User): boolean {
  return user.is_master || user.permissions.includes('commercial.manager');
}

export function canSeeChat(user: User): boolean {
  return (
    user.permissions.includes('chat.view') || user.permissions.includes('contacts.view')
  );
}

export function canManageUsers(user: User): boolean {
  return user.is_master || user.permissions.includes('users.manage');
}

export function canSeeEstoque(user: User): boolean {
  return user.is_master || user.permissions.includes('stock.view');
}

export function canManageProducts(user: User): boolean {
  return user.is_master || user.permissions.includes('stock.products.manage');
}

export function canSeeContatos(user: User): boolean {
  return user.is_master || user.permissions.includes('contacts.view');
}

export function canSeeMeta(user: User): boolean {
  return user.is_master || user.permissions.includes('contacts.view');
}

export function canSeeGoogleAds(user: User): boolean {
  return user.is_master || user.permissions.includes('contacts.view');
}

export function canSeeFinanceiro(user: User): boolean {
  return user.is_master || user.permissions.includes('finance.manage');
}

export function canSeePdv(user: User): boolean {
  return user.is_master || user.pdv;
}

export function canSeeRH(user: User): boolean {
  return (
    user.is_master ||
    user.permissions.includes('hr.timeclock') ||
    user.permissions.includes('hr.manage')
  );
}

export function canSeeSettings(user: User): boolean {
  return (
    user.is_master ||
    user.permissions.includes('settings.view') ||
    user.permissions.includes('settings.quick_messages')
  );
}

export function canManageQuickMessages(user: User): boolean {
  return user.is_master || user.permissions.includes('settings.quick_messages');
}

export function canManageTags(user: User): boolean {
  return user.is_master || user.permissions.includes('settings.tags');
}

export function canManageFiliais(user: User): boolean {
  return user.is_master || user.permissions.includes('settings.branches');
}

export function canManageCategorias(user: User): boolean {
  return user.is_master || user.permissions.includes('settings.categories');
}

export function canManageIA(user: User): boolean {
  return user.is_master || user.permissions.includes('settings.ia');
}

export function canManageNPS(user: User): boolean {
  return user.is_master || user.permissions.includes('settings.nps');
}

export function canSeeNpsReport(user: User): boolean {
  return user.is_master || user.permissions.includes('reports.nps.view');
}

export function canSeeIntegracoes(user: User): boolean {
  return user.is_master || user.permissions.includes('settings.integrations');
}

export function canManageDesenvolvedores(user: User): boolean {
  return user.is_master;
}

export type LandingRoute =
  | '/(tabs)/dashboard'
  | '/(tabs)/comercial'
  | '/(tabs)/chat'
  | '/(tabs)/usuarios'
  | '/(tabs)/estoque'
  | '/(tabs)/contatos'
  | '/(tabs)/rh'
  | '/(tabs)/pdv'
  | '/(tabs)/financeiro'
  | '/(tabs)/meta'
  | '/(tabs)/google_ads';

export function getLandingRoute(user: User): LandingRoute {
  if (canSeeDashboard(user)) return '/(tabs)/dashboard';
  if (canSeeChat(user)) return '/(tabs)/chat';
  return '/(tabs)/dashboard';
}
