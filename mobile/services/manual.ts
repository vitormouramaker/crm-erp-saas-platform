import { Ionicons } from '@expo/vector-icons';

import type { User } from '@/types';
import { postEncrypted } from './apiClient';
import {
  canManageUsers,
  canSeeChat,
  canSeeContatos,
  canSeeDashboard,
  canSeeEstoque,
  canSeeFinanceiro,
  canSeeGoogleAds,
  canSeeMeta,
  canSeePdv,
  canSeeRH,
  canSeeSettings,
} from './permissions';

type IconName = keyof typeof Ionicons.glyphMap;

export interface ManualArticle {
  id: string;
  moduleId: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  steps: string[];
  keywords: string[];
  relatedRoute?: string;
  requiredPermissions: string[];
  minPlanId?: number;
  featured: boolean;
  order: number;
  status: string;
  updatedAt?: string;
}

export async function getManualArticles(user: User): Promise<ManualArticle[]> {
  const { obj } = await postEncrypted<ManualArticle[]>('/manual', '/listar', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export interface ManualGuide {
  slug: string;
  title: string;
  summary: string;
  steps: string[];
  keywords: string[];
  updatedAt: string;
}

const LAST_REVIEWED = '2026-07-01';

export interface ManualModule {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  route?: string;
  showInShortcuts: boolean;
  guides: ManualGuide[];
  visible: (user: User) => boolean;
}

export const MANUAL_MODULES: ManualModule[] = [
  {
    id: 'primeiros-passos',
    label: 'Primeiros passos',
    description: 'Acesso, menu, permissões e visão geral do sistema.',
    icon: 'compass-outline',
    showInShortcuts: false,
    visible: () => true,
    guides: [
      {
        slug: 'primeiros-passos-navegacao',
        title: 'Navegar pelo menu e entender a visão geral do sistema',
        summary: 'Como acessar o sistema, abrir o menu lateral e encontrar os módulos liberados para o seu usuário.',
        steps: [
          'Faça login com seu e-mail e senha cadastrados.',
          'Toque no ícone de menu (☰) para abrir a barra lateral com todos os módulos.',
          'Os módulos exibidos variam de acordo com as permissões do seu usuário.',
          'Use o Manual Operacional sempre que precisar relembrar o passo a passo de um módulo.',
        ],
        keywords: ['inicio', 'primeiros passos', 'menu', 'login', 'permissao', 'visao geral'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Indicadores gerais do negócio.',
    icon: 'grid-outline',
    route: '/(tabs)/dashboard',
    showInShortcuts: true,
    visible: canSeeDashboard,
    guides: [
      {
        slug: 'dashboard-indicadores',
        title: 'Ler e interpretar os indicadores do Dashboard',
        summary: 'Saiba o que cada card, gráfico e ranking representa e como usá-los no dia a dia.',
        steps: [
          'Abra o Dashboard pelo menu lateral.',
          'Use os filtros de período no topo para ajustar o intervalo analisado.',
          'Passe o mouse ou toque em um card para ver o detalhamento do indicador.',
          'Consulte o ranking de vendedores e o gráfico de evolução para acompanhar tendências.',
        ],
        keywords: ['dashboard', 'indicadores', 'grafico', 'ranking', 'filtro', 'periodo'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'atendimentos',
    label: 'Atendimentos',
    description: 'Chat, cliente, IA, mídias e finalização de conversas.',
    icon: 'chatbubble-outline',
    route: '/(tabs)/chat',
    showInShortcuts: true,
    visible: canSeeChat,
    guides: [
      {
        slug: 'atendimentos-iniciar',
        title: 'Iniciar e assumir um atendimento',
        summary: 'Como pegar uma conversa em espera e começar a atender o cliente pelo chat.',
        steps: [
          'Abra Atendimentos e selecione a fila "Em espera".',
          'Toque na conversa desejada e depois em "Assumir atendimento".',
          'Use as mensagens rápidas para agilizar respostas comuns.',
          'Finalize ou transfira a conversa quando o atendimento terminar.',
        ],
        keywords: ['atendimento', 'chat', 'fila', 'conversa', 'mensagem rapida', 'assumir'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'contatos',
    label: 'Contatos',
    description: 'Clientes, histórico, importação e listas de transmissão.',
    icon: 'person-outline',
    route: '/(tabs)/contatos',
    showInShortcuts: true,
    visible: canSeeContatos,
    guides: [
      {
        slug: 'contatos-cadastrar',
        title: 'Cadastrar, editar e excluir contatos',
        summary: 'Como manter a base de clientes atualizada com dados de contato, endereço e informações adicionais.',
        steps: [
          'Abra Contatos e toque no ícone de adicionar (+).',
          'Preencha nome, telefone, e-mail e endereço.',
          'Use tags e categorias para organizar o cadastro.',
          'Para editar ou excluir, abra o contato e toque nos ícones de ação.',
        ],
        keywords: ['contato', 'cadastrar', 'cliente', 'tag', 'categoria', 'endereco'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    description: 'Produtos, fornecedores, pedidos, etiquetas e movimentações.',
    icon: 'cube-outline',
    route: '/(tabs)/estoque',
    showInShortcuts: true,
    visible: canSeeEstoque,
    guides: [
      {
        slug: 'estoque-cadastrar-produto',
        title: 'Cadastrar ou editar produto',
        summary: 'Como criar produtos com SKU, fornecedor, categoria, estoque mínimo, custo e preço de venda.',
        steps: [
          'Abra Estoque e toque em "Novo produto".',
          'Informe nome, SKU, categoria e fornecedor.',
          'Defina estoque mínimo, custo e preço de venda.',
          'Salve para disponibilizar o produto nas vendas e no PDV.',
        ],
        keywords: ['produto', 'cadastrar', 'sku', 'codigo', 'fornecedor', 'categoria', 'estoque', 'preco'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial / Funil',
    description: 'Pipeline, oportunidades, relatórios e configurações comerciais.',
    icon: 'filter-outline',
    showInShortcuts: true,
    visible: () => false,
    guides: [
      {
        slug: 'comercial-kanban',
        title: 'Navegar e usar o pipeline comercial (Kanban)',
        summary: 'Como acompanhar todas as oportunidades em aberto no quadro visual do funil.',
        steps: [],
        keywords: ['funil', 'kanban', 'pipeline', 'oportunidade', 'comercial'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'meta',
    label: 'Integrações Meta',
    description: 'WhatsApp Cloud API, templates, anúncios e Instagram.',
    icon: 'infinite-outline',
    route: '/(tabs)/meta',
    showInShortcuts: false,
    visible: canSeeMeta,
    guides: [
      {
        slug: 'meta-whatsapp-cloud',
        title: 'Conectar o WhatsApp Cloud API e configurar templates',
        summary: 'Como conectar o número do WhatsApp Business, aprovar templates e enviar mensagens oficiais.',
        steps: [
          'Abra Gestão da Meta e siga o passo a passo de conexão do WhatsApp Cloud API.',
          'Cadastre e envie os templates de mensagem para aprovação da Meta.',
          'Após aprovados, os templates ficam disponíveis para uso no Atendimento.',
        ],
        keywords: ['meta', 'whatsapp', 'cloud api', 'template', 'integracao'],
        updatedAt: LAST_REVIEWED,
      },
      {
        slug: 'meta-instagram-anuncios',
        title: 'Conectar Instagram e acompanhar anúncios',
        summary: 'Como vincular a conta do Instagram e acompanhar o desempenho dos anúncios conectados.',
        steps: [
          'Abra Gestão da Meta e conecte sua conta do Instagram.',
          'Acompanhe métricas de anúncios direto na tela de Integrações.',
        ],
        keywords: ['instagram', 'anuncios', 'meta', 'ads', 'integracao'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'googleads',
    label: 'Google Ads',
    description: 'Conexão de conta, campanhas e indicadores de anúncios.',
    icon: 'radio-outline',
    route: '/(tabs)/google_ads',
    showInShortcuts: false,
    visible: canSeeGoogleAds,
    guides: [
      {
        slug: 'googleads-conectar',
        title: 'Conectar a conta do Google Ads e acompanhar campanhas',
        summary: 'Como vincular sua conta do Google Ads e visualizar o desempenho das campanhas ativas.',
        steps: [
          'Abra Google Ads e conecte sua conta pelo botão de integração.',
          'Selecione a conta de anúncios que deseja acompanhar.',
          'Consulte os indicadores de campanhas direto na tela.',
        ],
        keywords: ['google ads', 'campanha', 'anuncio', 'integracao', 'conta'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Contas, lançamentos, categorias, alertas, comissões e assinaturas.',
    icon: 'cash-outline',
    route: '/(tabs)/financeiro',
    showInShortcuts: true,
    visible: canSeeFinanceiro,
    guides: [
      {
        slug: 'financeiro-dashboard',
        title: 'Dashboard financeiro, contas a pagar e a receber',
        summary: 'Como visualizar o resultado financeiro e registrar títulos de entrada e saída.',
        steps: [
          'Abra Financeiro e confira o resumo no Dashboard.',
          'Use as abas "Contas a Pagar" e "Contas a Receber" para lançar títulos.',
          'Marque títulos como pagos ou recebidos ao dar baixa.',
          'Acompanhe alertas de vencimento na aba Alertas.',
        ],
        keywords: ['financeiro', 'dashboard', 'contas a pagar', 'contas a receber', 'titulo', 'baixa'],
        updatedAt: LAST_REVIEWED,
      },
      {
        slug: 'financeiro-lancamentos',
        title: 'Lançamentos, categorias financeiras e alertas',
        summary: 'Como registrar lançamentos avulsos, organizar categorias e configurar alertas de vencimento.',
        steps: [
          'Abra a aba Lançamentos e toque em "Novo lançamento".',
          'Escolha a categoria financeira ou crie uma nova em Categorias.',
          'Configure alertas de vencimento na aba Alertas.',
        ],
        keywords: ['lancamento', 'categoria financeira', 'alerta', 'vencimento'],
        updatedAt: LAST_REVIEWED,
      },
      {
        slug: 'financeiro-comissoes',
        title: 'Comissões de vendedores e assinaturas recorrentes',
        summary: 'Como calcular comissões da equipe de vendas e gerenciar assinaturas recorrentes de clientes.',
        steps: [
          'Abra a aba Comissões e Metas para definir percentuais por vendedor.',
          'Confira o fechamento do período para conferir os valores calculados.',
          'Use a aba Assinaturas para gerenciar cobranças recorrentes.',
        ],
        keywords: ['comissao', 'vendedor', 'meta', 'assinatura', 'recorrente'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'rh',
    label: 'RH / Ponto',
    description: 'Registro de ponto, justificativas, relatórios e gestão de RH.',
    icon: 'time-outline',
    route: '/(tabs)/rh',
    showInShortcuts: false,
    visible: canSeeRH,
    guides: [
      {
        slug: 'rh-ponto',
        title: 'Registrar ponto e consultar o calendário de horas',
        summary: 'Como bater o ponto pelo app e consultar o calendário de horas trabalhadas.',
        steps: [
          'Abra Recursos Humanos e toque em "Bater ponto".',
          'Confirme o registro de entrada, intervalo ou saída.',
          'Consulte o calendário para revisar as horas do período.',
        ],
        keywords: ['ponto', 'calendario', 'horas', 'entrada', 'saida', 'intervalo'],
        updatedAt: LAST_REVIEWED,
      },
      {
        slug: 'rh-justificativas',
        title: 'Enviar justificativas e análise pelo gestor',
        summary: 'Como enviar uma justificativa de ponto e acompanhar a análise do gestor.',
        steps: [
          'Na tela de ponto, toque em "Enviar justificativa".',
          'Selecione o dia, o motivo e anexe um comprovante se necessário.',
          'Acompanhe o status (pendente, aprovada ou recusada) na mesma tela.',
        ],
        keywords: ['justificativa', 'ponto', 'gestor', 'aprovacao', 'comprovante'],
        updatedAt: LAST_REVIEWED,
      },
      {
        slug: 'rh-gestao',
        title: 'Gestão de RH: horários, feriados, férias, day-off e relatórios',
        summary: 'Como configurar horários, feriados, férias, day-off da equipe e gerar relatórios.',
        steps: [
          'Abra RH > Gestão e configure os horários de cada colaborador.',
          'Cadastre feriados, férias e day-offs no calendário da equipe.',
          'Gere relatórios de horas e ausências por período.',
        ],
        keywords: ['rh', 'horario', 'feriado', 'ferias', 'day off', 'relatorio'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'pdv',
    label: 'Transações PDV',
    description: 'Consulta e filtragem de transações do ponto de venda.',
    icon: 'receipt-outline',
    route: '/(tabs)/pdv',
    showInShortcuts: false,
    visible: canSeePdv,
    guides: [
      {
        slug: 'pdv-transacoes',
        title: 'Consultar e filtrar transações do PDV',
        summary: 'Como visualizar o histórico de vendas do PDV e aplicar filtros por período, forma de pagamento ou operador.',
        steps: [
          'Abra Transações PDV.',
          'Use os filtros de data, forma de pagamento e operador.',
          'Toque em uma transação para ver o detalhamento completo.',
        ],
        keywords: ['pdv', 'transacao', 'venda', 'filtro', 'pagamento', 'operador'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    description: 'Mensagens rápidas, tags, filiais, categorias, IA e NPS.',
    icon: 'settings-outline',
    route: '/configuracoes',
    showInShortcuts: true,
    visible: canSeeSettings,
    guides: [
      {
        slug: 'configuracoes-mensagens-tags',
        title: 'Configurar mensagens rápidas e tags',
        summary: 'Como cadastrar respostas padronizadas para o chat e criar classificações para contatos e atendimentos.',
        steps: [
          'Abra Configurações > Mensagens rápidas para cadastrar respostas prontas.',
          'Abra Configurações > Tags para criar classificações de contatos e atendimentos.',
          'Aplique as tags durante o atendimento ou no cadastro do contato.',
        ],
        keywords: ['mensagem rapida', 'tag', 'configuracoes', 'chat', 'classificacao'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'usuarios',
    label: 'Usuários e permissões',
    description: 'Gestão de equipe, limites e permissões por perfil.',
    icon: 'people-outline',
    route: '/(tabs)/usuarios',
    showInShortcuts: true,
    visible: canManageUsers,
    guides: [
      {
        slug: 'usuarios-permissoes',
        title: 'Criar, editar e gerenciar usuários e permissões',
        summary: 'Como adicionar novos colaboradores, configurar o que cada um pode acessar e respeitar o limite do plano.',
        steps: [
          'Abra Gestão de Equipe e toque em "Novo usuário".',
          'Preencha os dados e defina as permissões de acesso.',
          'Salve para enviar o convite de acesso ao colaborador.',
        ],
        keywords: ['usuario', 'permissao', 'colaborador', 'acesso', 'plano'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'nps',
    label: 'NPS',
    description: 'Pesquisa pública de satisfação e gestão das perguntas.',
    icon: 'happy-outline',
    showInShortcuts: false,
    visible: () => true,
    guides: [
      {
        slug: 'nps-responder',
        title: 'Responder a pesquisa de satisfação',
        summary: 'Como a pesquisa de satisfação é enviada ao cliente e onde consultar as respostas recebidas.',
        steps: [
          'A pesquisa de NPS é enviada automaticamente ao final do atendimento.',
          'As perguntas exibidas podem ser configuradas em Configurações > NPS.',
          'Acompanhe as respostas recebidas para medir a satisfação dos clientes.',
        ],
        keywords: ['nps', 'pesquisa', 'satisfacao', 'cliente', 'pergunta'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
  {
    id: 'assinatura',
    label: 'Assinatura e Suporte',
    description: 'Planos, pagamentos, add-ons, suporte e sugestões.',
    icon: 'star-outline',
    route: '/planos',
    showInShortcuts: false,
    visible: () => true,
    guides: [
      {
        slug: 'assinatura-plano',
        title: 'Gerenciar plano, add-ons e pagamentos',
        summary: 'Como consultar seu plano atual, contratar add-ons e acompanhar pagamentos.',
        steps: [
          'Abra Planos e Suporte.',
          'Confira o plano ativo e os add-ons contratados.',
          'Consulte o histórico de pagamentos e faturas.',
        ],
        keywords: ['plano', 'add-on', 'pagamento', 'fatura', 'assinatura'],
        updatedAt: LAST_REVIEWED,
      },
      {
        slug: 'assinatura-suporte',
        title: 'Solicitar suporte técnico ou enviar uma sugestão',
        summary: 'Como abrir um chamado de suporte técnico ou enviar uma sugestão para a equipe Órbita.',
        steps: [
          'Abra Planos e Suporte > Suporte.',
          'Descreva o problema ou a sugestão com o máximo de detalhes.',
          'Acompanhe a resposta da equipe pelo mesmo canal.',
        ],
        keywords: ['suporte', 'chamado', 'sugestao', 'ajuda'],
        updatedAt: LAST_REVIEWED,
      },
    ],
  },
];
