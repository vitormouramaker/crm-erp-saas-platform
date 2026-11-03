// Catalogo unico de permissoes para a tela de usuarios.

export type PermissionItem = { key: string; label: string };
export type PermissionGroup = { label: string; permissions: PermissionItem[] };

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Estoque",
    permissions: [
      { key: "stock.view", label: "Acesso ao modulo" },
      { key: "stock.products.manage", label: "Criar e editar produtos" },
      { key: "stock.suppliers.view", label: "Acessar fornecedores" },
      { key: "stock.orders.view", label: "Acessar pedidos de compra" },
      { key: "stock.orders.create", label: "Criar pedidos de compra" },
    ],
  },
  {
    label: "Vendas",
    permissions: [
      { key: "sales.view", label: "Acesso ao modulo" },
      { key: "sales.create", label: "Registrar venda" },
    ],
  },
  {
    label: "Atendimento",
    permissions: [
      { key: "chat.view", label: "Acesso ao chat" },
      { key: "chat.manager", label: "Gestor de atendimento" },
      {
        key: "chat.view_all_messages",
        label: "Ver mensagens de outros atendentes",
      },
      { key: "reports.nps.view", label: "Relatorio de NPS" },
      { key: "contacts.view", label: "Acesso aos contatos" },
      { key: "contacts.view_all", label: "Ver todos os contatos" },
    ],
  },
  {
    label: "Comercial",
    permissions: [
      { key: "commercial.view", label: "Acesso ao modulo" },
      { key: "commercial.manager", label: "Gerente comercial" },
      { key: "commercial.pipeline", label: "Pipeline comercial" },
      { key: "commercial.scheduled_dispatches", label: "Agendar disparos" },
      { key: "commercial.dashbord", label: "Dashboard comercial" },
      { key: "commercial.report", label: "Relatorios comerciais" },
    ],
  },
  {
    label: "Meta e Ads",
    permissions: [
      { key: "meta.view", label: "Ver modulo Meta" },
      { key: "meta_ads.view", label: "Ver modulo Meta Ads" },
      { key: "google_ads.view", label: "Ver modulo Google Ads" },
    ],
  },
  {
    label: "Configuracoes",
    permissions: [
      { key: "settings.view", label: "Ver configuracoes" },
      { key: "settings.quick_messages", label: "Mensagens rapidas" },
      { key: "settings.tags", label: "Tags" },
      { key: "settings.branches", label: "Filiais" },
      { key: "settings.categories", label: "Categorias" },
      { key: "settings.api_meta", label: "Configurar Meta" },
      { key: "settings.api_meta_ads", label: "Configurar Meta Ads" },
    ],
  },
  {
    label: "Administrativo",
    permissions: [
      { key: "users.manage", label: "Gerenciar equipe" },
      { key: "dashboard.view", label: "Ver dashboard" },
    ],
  },
  {
    label: "Financeiro",
    permissions: [{ key: "financial.manage", label: "Gerenciar financeiro" }],
  },
  {
    label: "Assinatura",
    permissions: [{ key: "subscription.manage", label: "Gerenciar assinatura" }],
  },
  {
    label: "RH",
    permissions: [
      { key: "rh.point.register", label: "Registrar ponto" },
      { key: "rh.point.manage", label: "Gerenciar RH" },
    ],
  },
];
