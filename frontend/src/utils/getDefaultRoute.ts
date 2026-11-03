// src/utils/getDefaultRoute.ts
import type { User } from "../contexts/AuthContext";

export function getDefaultRouteForUser(user: User): string {
  if (user?.is_master) return "/dashboard";

  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const has = (p: string) => perms.includes(p);
  const isEnterprisePlan = user?.id_plano === 3;

  // Ordem de preferência
  if (isEnterprisePlan) return "/rh/ponto";
  if (has("dashboard.view")) return "/dashboard";
  if (has("chat.view")) return "/chat";
  if (has("contacts.view")) return "/contatos";
  if (has("meta.view") || has("meta_ads.view")) return "/meta-management";
  if (has("stock.view")) return "/estoque";
  if (has("sales.view")) return "/comercial";
  if (has("google_ads.view")) return "/google-ads";
  if (has("users.manage")) return "/usuarios";
  if (has("settings.view")) return "/settings";
  if (has("financial.manage")) return "/financeiro";
  if (has("subscription.manage")) return "/assinatura";

  return "/dashboard";
}

