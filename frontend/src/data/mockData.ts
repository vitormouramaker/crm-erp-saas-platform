export type TabType = "active" | "waiting" | "finished";

// Agora, uma 'Message' pode ser uma de duas coisas:
// Uma mensagem de chat normal, com remetente e horário
export interface TemplateMessageButton {
  index: number;
  type: string;
  text?: string | null;
  url?: string | null;
  phoneNumber?: string | null;
}

export interface TemplateMessageData {
  kind: "template";
  templateName?: string | null;
  language?: string | null;
  previewMessage?: string | null;
  header?: {
    type?: string | null;
    text?: string | null;
    mediaType?: string | null;
    mediaUrl?: string | null;
  } | null;
  bodyText?: string | null;
  footerText?: string | null;
  buttons?: TemplateMessageButton[];
}

interface ChatMessage {
  type: "chat" | "text"; // aceita tanto "chat" quanto "text"
  id: number;
  text: string;
  sender: "customer" | "agent";
  timestamp: Date;
  agentName?: string;
  edited?: boolean;
  editedAt?: Date;
  deliveryStatus?: "pending" | "sent" | "delivered" | "read" | "failed";
  deliveryStatusLabel?: string;
  replyTo?: {
    text: string;
    mediaType?: string;
  };
  templateData?: TemplateMessageData;
}

export interface Transaction {
  id: string | number;
  pdv_id: number; // ID interno da venda no PDV
  data_hora: string; // ISO String
  valor_total: number;
  forma_pagamento: "DINHEIRO" | "CREDITO" | "DEBITO" | "PIX";
  valor_recebido?: number; // Apenas se DINHEIRO
  troco?: number; // Apenas se DINHEIRO
  nome_caixa: string; // Nome do funcionário
  numero_caixa: string; // "Caixa 01", "Caixa 02"
}

// Ou um evento do sistema, que é apenas um texto informativo
interface EventMessage {
  type: "event";
  id: number;
  text: string;
}

// Define a estrutura de uma mensagem de mídia
interface MediaMessage {
  type: "media";
  id: number;
  sender: "customer" | "agent";
  timestamp: Date;
  edited?: boolean;
  editedAt?: Date;
  deliveryStatus?: "pending" | "sent" | "delivered" | "read" | "failed";
  deliveryStatusLabel?: string;
  mediaUrl?: string; // URL para o arquivo (ex: S3)
  fileName?: string; // Nome original do arquivo (ex: 'fatura.pdf')
  mediaType:
    | "image"
    | "video"
    | "audio"
    | "document"
    | "sticker"
    | "location"
    | "contacts"
    | "meta_referral"; // Para sabermos como renderizar
  structuredData?: unknown;
  agentName?: string;
  caption?: string; // Legenda opcional para a mídia
  replyTo?: {
    text: string;
    mediaType?: string;
  };
}

// Mock estoque
export interface Product {
  id: number;
  name: string;
  sku: string; // O nome da propriedade continua 'sku', apenas o rótulo na tela mudará
  categories: Category[];
  supplierName: string; // NOVO
  // ATUALIZAÇÃO: O estoque agora é um array para suportar múltiplas filiais
  stockByFilial: StockLocation[];
  costPrice: number;
  salePrice: number;
  movementHistory?: MovementHistory[];
  isSoldByWeight: boolean;
  soldByWeight?: boolean;
  // NOVO: Campos para oferta (Mapeados do Backend)
  promotionPrice?: number; // Backend retorna 'promotionPrice', mas espera 'promoPrice' no payload
  promoStartDate?: string;
  promoEndDate?: string;
  offerCreatedBy?: string; // Nome do usuário que criou a oferta
}

export const categoriesData: Category[] = [
  { id: 1, name: "Eletrônicos" },
  { id: 2, name: "Vestuário" },
  { id: 3, name: "Acessórios" },
  { id: 4, name: "Informática" },
  { id: 5, name: "Games" },
];

export interface MovementHistory {
  date: string;
  type: "Entrada" | "Saída" | "Ajuste" | "Transferência";
  quantity: number;
  user: string;
  reason: string;
  // NOVO: Campos para rastrear transferências
  fromFilial?: string;
  toFilial?: string;
}

// NOVO: Interface para os itens de um pedido de compra
export interface PurchaseOrderItem {
  // CORREÇÃO: Permitir que productId seja nulo (para linhas novas)
  productId: number | null;
  productName: string;
  sku: string;
  quantity: number;
  costPrice: number;
}

// NOVO: Interface para o Pedido de Compra
export interface PurchaseOrder {
  id: number;
  supplierId: number;
  supplierName: string;
  orderDate: string;
  filial: string;
  status: "Pendente" | "Recebido" | "Cancelado";
  items: PurchaseOrderItem[];
  totalValue: number;
}

// NOVO: Array de pedidos de compra mockados
export const purchaseOrdersData: PurchaseOrder[] = [
  {
    id: 2024001,
    supplierId: 1,
    supplierName: "TechDistribuidora Ltda.",
    orderDate: "2025-09-20T10:30:00",
    filial: "Matriz SP",
    status: "Recebido",
    items: [
      {
        productId: 1,
        productName: "Smartphone Pro X",
        sku: "SPX-001",
        quantity: 10,
        costPrice: 2500,
      },
      {
        productId: 4,
        productName: "Fone de Ouvido Bluetooth T5",
        sku: "FBT-004",
        quantity: 50,
        costPrice: 80,
      },
    ],
    totalValue: 29000,
  },
  {
    id: 2024002,
    supplierId: 2,
    supplierName: "Importa Eletrônicos S.A.",
    orderDate: "2025-09-22T14:00:00",
    filial: "Matriz SP",
    status: "Pendente",
    items: [
      {
        productId: 2,
        productName: "Notebook Gamer Fire",
        sku: "NGF-002",
        quantity: 5,
        costPrice: 5000,
      },
      {
        productId: 6,
        productName: "Teclado Mecânico RGB",
        sku: "TMR-006",
        quantity: 20,
        costPrice: 220,
      },
    ],
    totalValue: 29400,
  },
  {
    id: 2024003,
    supplierId: 3,
    supplierName: "Malhas & Fios Confecções",
    orderDate: "2025-09-25",
    filial: "Matriz SP",
    status: "Pendente",
    items: [
      {
        productId: 3,
        productName: "Camiseta Básica Algodão",
        sku: "CBA-003-P",
        quantity: 100,
        costPrice: 30,
      },
    ],
    totalValue: 3000,
  },
  {
    id: 2024004,
    supplierId: 1,
    supplierName: "TechDistribuidora Ltda.",
    orderDate: "2025-09-15",
    filial: "Matriz SP",
    status: "Cancelado",
    items: [
      {
        productId: 5,
        productName: "Mouse Óptico Sem Fio",
        sku: "MSF-005",
        quantity: 100,
        costPrice: 45,
      },
    ],
    totalValue: 4500,
  },
];

// Mock fornecedores
export interface Supplier {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  cnpj?: string; // Campo opcional que você já adicionou no formulário
}

// Array de fornecedores mockados
export const suppliersData: Supplier[] = [
  {
    id: 1,
    name: "TechDistribuidora Ltda.",
    contactPerson: "Carlos Silva",
    phone: "(11) 98765-4321",
    email: "contato@techdist.example.com",
    cnpj: "12.345.678/0001-99",
  },
  {
    id: 2,
    name: "Importa Eletrônicos S.A.",
    contactPerson: "Ana Pereira",
    phone: "(21) 91234-5678",
    email: "ana.p@importaeletron.example.com",
    cnpj: "98.765.432/0001-11",
  },
  {
    id: 3,
    name: "Malhas & Fios Confecções",
    contactPerson: "Juliana Costa",
    phone: "(11) 95555-1234",
    email: "vendas@malhasefios.example.com",
    cnpj: "11.222.333/0001-44",
  },
  {
    id: 4,
    name: "Acessórios Premium BR",
    contactPerson: "Marcos Rocha",
    phone: "(41) 98877-6655",
    email: "marcos@apbr.example.com",
    cnpj: "55.666.777/0001-88",
  },
];

// Array de produtos mockados para teste
export const productsData: Product[] = [
  {
    id: 1,
    name: "Smartphone Pro X",
    sku: "7890123456789",
    categories: [{ id: 1, name: "Eletrônicos" }],
    supplierName: "TechDistribuidora Ltda.", // NOVO
    stockByFilial: [
      { id: 1, filial: "Matriz SP", mainStock: 30, showcaseStock: 5 }, // ATUALIZADO
      { id: 1, filial: "Filial RJ", mainStock: 15, showcaseStock: 0 }, // ATUALIZADO
    ],
    isSoldByWeight: false,
    costPrice: 2500,
    salePrice: 4500,
    movementHistory: [
      {
        date: "2025-09-26 10:00:00",
        type: "Entrada",
        quantity: 100,
        user: "Admin",
        reason: "Pedido de Compra #2024001",
      },
      {
        date: "2025-09-28 11:00:00",
        type: "Transferência",
        quantity: -50,
        user: "Logistica",
        reason: "Abastecimento Filial RJ",
        fromFilial: "Matriz SP",
        toFilial: "Filial RJ",
      },
      {
        date: "2025-09-29 15:00:00",
        type: "Saída",
        quantity: -15,
        user: "Vendas SP",
        reason: "Venda #V003",
      },
    ],
  },
  {
    id: 2,
    name: "Notebook Gamer Fire",
    sku: "4532123456789",
    categories: [{ id: 1, name: "Eletrônicos" }],
    supplierName: "Distribuidora Exemplo Ltda.", // NOVO
    stockByFilial: [
      { id: 1, filial: "Matriz SP", mainStock: 30, showcaseStock: 5 }, // ATUALIZADO
      { id: 1, filial: "Filial RJ", mainStock: 15, showcaseStock: 0 }, // ATUALIZADO
    ],
    isSoldByWeight: false,
    costPrice: 2500,
    salePrice: 4500,
    movementHistory: [
      {
        date: "2025-09-26 10:00:00",
        type: "Entrada",
        quantity: 100,
        user: "Admin",
        reason: "Pedido de Compra #2024001",
      },
      {
        date: "2025-09-28 11:00:00",
        type: "Transferência",
        quantity: -50,
        user: "Logistica",
        reason: "Abastecimento Filial RJ",
        fromFilial: "Matriz SP",
        toFilial: "Filial RJ",
      },
      {
        date: "2025-09-29 15:00:00",
        type: "Saída",
        quantity: -15,
        user: "Vendas SP",
        reason: "Venda #V003",
      },
    ],
  },
  {
    id: 3,
    name: "Notebook Gamer Fire",
    sku: "4532123456789",
    categories: [{ id: 1, name: "Eletrônicos" }],
    supplierName: "TechDistribuidora Ltda.", // NOVO
    stockByFilial: [
      { id: 1, filial: "Matriz SP", mainStock: 30, showcaseStock: 5 }, // ATUALIZADO
      { id: 1, filial: "Filial RJ", mainStock: 15, showcaseStock: 0 }, // ATUALIZADO
    ],
    isSoldByWeight: false,
    costPrice: 2500,
    salePrice: 4500,
    movementHistory: [
      {
        date: "2025-09-26 10:00:00",
        type: "Entrada",
        quantity: 100,
        user: "Admin",
        reason: "Pedido de Compra #2024001",
      },
      {
        date: "2025-09-28 11:00:00",
        type: "Transferência",
        quantity: -50,
        user: "Logistica",
        reason: "Abastecimento Filial RJ",
        fromFilial: "Matriz SP",
        toFilial: "Filial RJ",
      },
      {
        date: "2025-09-29 15:00:00",
        type: "Saída",
        quantity: -15,
        user: "Vendas SP",
        reason: "Venda #V003",
      },
    ],
  },
  {
    id: 4,
    name: "Notebook Gamer Fire",
    sku: "4532123456789",
    categories: [{ id: 1, name: "Eletrônicos" }],
    supplierName: "TechDistribuidora Ltda.", // NOVO
    stockByFilial: [
      { id: 1, filial: "Matriz SP", mainStock: 30, showcaseStock: 5 }, // ATUALIZADO
      { id: 1, filial: "Filial RJ", mainStock: 15, showcaseStock: 0 }, // ATUALIZADO
    ],
    isSoldByWeight: false,
    costPrice: 2500,
    salePrice: 4500,
    movementHistory: [
      {
        date: "2025-09-26 10:00:00",
        type: "Entrada",
        quantity: 100,
        user: "Admin",
        reason: "Pedido de Compra #2024001",
      },
      {
        date: "2025-09-28 11:00:00",
        type: "Transferência",
        quantity: -50,
        user: "Logistica",
        reason: "Abastecimento Filial RJ",
        fromFilial: "Matriz SP",
        toFilial: "Filial RJ",
      },
      {
        date: "2025-09-29 15:00:00",
        type: "Saída",
        quantity: -15,
        user: "Vendas SP",
        reason: "Venda #V003",
      },
    ],
  },
  {
    id: 5,
    name: "Notebook Gamer Fire",
    sku: "4532123456789",
    categories: [{ id: 1, name: "Eletrônicos" }],
    supplierName: "TechDistribuidora Ltda.", // NOVO
    stockByFilial: [
      { id: 1, filial: "Matriz SP", mainStock: 30, showcaseStock: 5 }, // ATUALIZADO
      { id: 1, filial: "Filial RJ", mainStock: 15, showcaseStock: 0 }, // ATUALIZADO
    ],
    isSoldByWeight: false,
    costPrice: 2500,
    salePrice: 4500,
    movementHistory: [
      {
        date: "2025-09-26 10:00:00",
        type: "Entrada",
        quantity: 100,
        user: "Admin",
        reason: "Pedido de Compra #2024001",
      },
      {
        date: "2025-09-28 11:00:00",
        type: "Transferência",
        quantity: -50,
        user: "Logistica",
        reason: "Abastecimento Filial RJ",
        fromFilial: "Matriz SP",
        toFilial: "Filial RJ",
      },
      {
        date: "2025-09-29 15:00:00",
        type: "Saída",
        quantity: -15,
        user: "Vendas SP",
        reason: "Venda #V003",
      },
    ],
  },
  {
    id: 6,
    name: "Notebook Gamer Fire",
    sku: "4532123456789",
    categories: [{ id: 1, name: "Eletrônicos" }],
    supplierName: "TechDistribuidora Ltda.", // NOVO
    stockByFilial: [
      { id: 1, filial: "Matriz SP", mainStock: 30, showcaseStock: 5 }, // ATUALIZADO
      { id: 1, filial: "Filial RJ", mainStock: 15, showcaseStock: 0 }, // ATUALIZADO
    ],
    isSoldByWeight: false,
    costPrice: 2500,
    salePrice: 4500,
    movementHistory: [
      {
        date: "2025-09-26 10:00:00",
        type: "Entrada",
        quantity: 100,
        user: "Admin",
        reason: "Pedido de Compra #2024001",
      },
      {
        date: "2025-09-28 11:00:00",
        type: "Transferência",
        quantity: -50,
        user: "Logistica",
        reason: "Abastecimento Filial RJ",
        fromFilial: "Matriz SP",
        toFilial: "Filial RJ",
      },
      {
        date: "2025-09-29 15:00:00",
        type: "Saída",
        quantity: -15,
        user: "Vendas SP",
        reason: "Venda #V003",
      },
    ],
  },
];

export interface Branch {
  id: number;
  name: string;
  address: string;
  manager: string;
  contact: string;
  isPrimary: boolean;
  cnpj: string;
  latitude?: number | null;
  longitude?: number | null;
  toleranceMeters?: number | null;
}

export interface StockLocation {
  id: number;
  filial: string;
  mainStock: number; // Estoque principal/comum
  showcaseStock: number; // Estoque de vitrine
}

// NOVO: Array de filiais mockadas
export const branchesData: Branch[] = [
  {
    id: 1,
    name: "Matriz SP",
    address: "Av. Paulista, 1000, São Paulo - SP",
    manager: "João Gerente",
    contact: "(11) 99999-0001",
    isPrimary: true,
    cnpj: "",
  },
  {
    id: 2,
    name: "Filial RJ",
    address: "Av. Copacabana, 200, Rio de Janeiro - RJ",
    manager: "Maria Supervisora",
    contact: "(21) 99999-0002",
    isPrimary: false,
    cnpj: "",
  },
  {
    id: 3,
    name: "Depósito Campinas",
    address: "Rua das Indústrias, 300, Campinas - SP",
    manager: "Carlos Logística",
    contact: "(19) 99999-0003",
    isPrimary: false,
    cnpj: "",
  },
];

// Nosso tipo Message agora é uma união dos dois tipos acima
export type Message = ChatMessage | EventMessage | MediaMessage;

export interface Note {
  content: string;
  author: string;
  createdAt: string;
  user_id: number;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Sector {
  id: number;
  name: string;
}

export const sectorsData: Sector[] = [
  { id: 1, name: "Financeiro" },
  { id: 2, name: "Suporte Técnico" },
  { id: 3, name: "Vendas" },
  { id: 4, name: "Logística" },
  { id: 5, name: "Reclamações" }
];

export interface Conversation {
  id: number;
  name: string;
  cliente_id: number;
  email: string;
  phone: string;
  cpf?: string | null;
  origem?: string | null;
  utms?: unknown;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  faturamento?: number | string | null;
  attendent: string;
  avatarColor: string;
  messages: Message[];
  status: TabType;
  notes: Note[];
  last_contact: string;
  tags: { id: number; name: string }[];
  birthday?: string | null;
  data_cadastro?: string | null;
  totalPurchases?: number;
  totalSpent?: number;
  averageTicket?: number;
  lastPurchaseAt?: string | null;
  totalInteractions?: number;
  lastInteraction?: string | null;
  totalHistoryEntries?: number;
  totalWhatsappAttendances?: number;
  lastWhatsappAttendance?: string | null;
  crmName?: string | null;
  crmStageName?: string | null;
  crmTitle?: string | null;
  crmResponsibleName?: string | null;
  sector?: Sector | null;
  metaWindowOpen?: boolean;
  metaWindowExpiresAt?: string | null;
  awaitingTemplateReply?: boolean;
  lastCustomerMessageAt?: string | null;
  empresaMetaParamId?: number | null;
  metaAccountDisplayPhoneNumber?: string | null;
  metaAccountName?: string | null;
}

export interface Category {
  id: number;
  name: string;
}

// Interface para os itens de uma venda
export interface SaleItem {
  productId: number;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  filial: string;
  stockType: "mainStock" | "showcaseStock";
}

// Interface para a Venda
export interface Sale {
  id: string; // Usaremos string para IDs de venda mais complexos
  date: string; // Data e hora em formato ISO
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
}

// Array de vendas mockadas (pode começar vazio)
// NOVO: Array de vendas mockadas populado
export const salesData: Sale[] = [
  {
    id: "V2025-0928A",
    date: "2025-09-28T10:45:00",
    customerName: "Cliente Balcão",
    items: [
      {
        productId: 1,
        productName: "Smartphone Pro X",
        sku: "7890123456789",
        quantity: 1,
        unitPrice: 4500,
        filial: "Matriz SP",
        stockType: "showcaseStock",
      },
      {
        productId: 4,
        productName: "Fone de Ouvido Bluetooth T5",
        sku: "FBT-004",
        quantity: 1,
        unitPrice: 199.9,
        filial: "Matriz SP",
        stockType: "mainStock",
      },
    ],
    subtotal: 4699.9,
    discount: 50,
    total: 4649.9,
  },
  {
    id: "V2025-0928B",
    date: "2025-09-28T11:20:00",
    customerName: "Maria Oliveira",
    items: [
      {
        productId: 6,
        productName: "Teclado Mecânico RGB",
        sku: "TMR-006",
        quantity: 2,
        unitPrice: 449.9,
        filial: "Filial RJ",
        stockType: "mainStock",
      },
    ],
    subtotal: 899.8,
    discount: 0,
    total: 899.8,
  },
];

export const conversationsData: Conversation[] = [
  // =================================================================
  // ==                         CLIENTES ATIVOS                      ==
  // =================================================================
  // {
  //   id: 1,
  //   name: 'João Silva',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('João Silva'),
  //   status: 'active',
  //   tags: [],
  //   notes: [
  //     {
  //       content: '<p>Cliente entrou em contato sobre a <strong>fatura de Julho</strong>. Parece que há um valor incorreto.</p>',
  //       author: 'Ana Silva',
  //       createdAt: '21/08/2025 às 14:30',
  //     },
  //     {
  //       content: '<p>Possui interesse no <em>plano premium</em>. Oferecer desconto na próxima interação.</p>',
  //       author: 'Pedro Moura',
  //       createdAt: '21/08/2025 às 16:15',
  //     },
  //   ],
  //   messages: [
  //     { type: 'event', id: 101, text: 'Conversa iniciada em 22/08/2025' },
  //     { type: 'chat', id: 1, text: 'Olá, preciso de ajuda com a minha fatura. Ela veio com um valor incorreto.', sender: 'customer', timestamp: new Date('2025-05-22T17:40:00') },
  //     { type: 'chat', id: 2, text: 'Olá, João! Claro, posso te ajudar. Qual o número da fatura, por favor?', sender: 'agent', timestamp: new Date('2025-05-22T17:41:00') },
  //     { type: 'chat', id: 3, text: 'O número é 123456789.', sender: 'customer', timestamp: new Date('2025-05-22T17:45:00') },
  //   ],
  // },
  // {
  //   id: 2,
  //   name: 'Maria Oliveira',
  //   email: 'maria.oliveira@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Maria Oliveira'),
  //   status: 'active',
  //   tags: ['problema_entrega', 'logistica', 'prioridade_alta', 'cliente_ansioso', 'pedido_atrasado'],
  //   notes: [
  //      {
  //       content: '<p><u>Verificar status do pedido #9876.</u> Cliente parece ansiosa pela entrega. Prioridade alta.</p>',
  //       author: 'Pedro Moura',
  //       createdAt: '21/08/2025 às 11:05',
  //     },
  //   ],
  //   messages: [
  //     { type: 'event', id: 101, text: 'Conversa iniciada em 22/08/2025' },
  //     { type: 'chat', id: 1, text: 'Olá, preciso de ajuda com a minha fatura. Ela veio com um valor incorreto.', sender: 'customer', timestamp: new Date('2025-05-22T17:40:00') },
  //     { type: 'chat', id: 2, text: 'Olá, João! Claro, posso te ajudar. Qual o número da fatura, por favor?', sender: 'agent', timestamp: new Date('2025-05-22T17:41:00') },
  //     { type: 'chat', id: 3, text: 'O número é 123456789.', sender: 'customer', timestamp: new Date('2025-05-22T17:45:00') },
  //   ],
  // },
  // {
  //   id: 5,
  //   name: 'Fernanda Lima',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Fernanda Lima'),
  //   status: 'active',
  //   tags: ['logistica', 'devolucao', 'novo_cliente', 'ecommerce', 'duvida_produto'],
  //   notes: [
  //     {
  //       content: '<p>Solicitou informações sobre a política de devolução. Enviei o link para a documentação: <a href="https://empresa.com/politica" target="_blank" rel="noopener noreferrer">Política de Devolução</a>.</p>',
  //       author: 'Sofia Andrade',
  //       createdAt: '20/08/2025 às 10:20',
  //     },
  //   ],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Como funciona para devolver um produto?', sender: 'customer', timestamp: new Date('2025-05-22T10:18:00') },
  //   ],
  // },
  // {
  //   id: 6,
  //   name: 'Ricardo Alves',
  //   email: 'ricardo.alves@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Ricardo Alves'),
  //   status: 'active',
  //   tags: ['cupom_desconto', 'vendas', 'carrinho_abandonado', 'promocao', 'problema_pagamento'],
  //   notes: [],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Meu cupom de desconto não está funcionando.', sender: 'customer', timestamp: new Date('2025-05-22T17:50:00') },
  //   ],
  // },
  // {
  //   id: 7,
  //   name: 'Beatriz Costa',
  //   email: 'maria.oliveira@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Maria Oliveira'),
  //   status: 'active',
  //   tags: ['cliente_vip', 'novo_pedido', 'recompra', 'feedback_positivo', 'cliente_antigo'],
  //   notes: [
  //     {
  //       content: '<p>Cliente VIP. Sempre muito educada e direta. <strong>Atendimento prioritário.</strong></p>',
  //       author: 'Gerência',
  //       createdAt: '15/07/2025 às 12:00',
  //     },
  //   ],
  //   messages: [
  //     { type: 'event', id: 701, text: 'Conversa finalizada em 19/08/2025' },
  //     { type: 'event', id: 702, text: 'Nova conversa iniciada por Beatriz Costa' },
  //     { type: 'chat', id: 1, text: 'Olá! Gostaria de fazer um novo pedido.', sender: 'customer', timestamp: new Date('2025-08-19T09:30:00') },
  //     { type: 'chat', id: 2, text: 'Bom dia, Beatriz! É um prazer atendê-la novamente. O que deseja hoje?', sender: 'agent', timestamp: new Date('2025-08-19T09:31:00') },
  //   ],
  // },
  // // =================================================================
  // // ==                       CLIENTES AGUARDANDO                     ==
  // // =================================================================
  // {
  //   id: 3,
  //   name: 'Carlos Pereira',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Carlos Pereira'),
  //   status: 'waiting',
  //   tags: ['logistica', 'frete', 'atraso', 'cliente_reclamacao', 'prioridade_media'],
  //   notes: [
  //     {
  //       content: '<p>Consulta sobre frete escalada para o <em>setor de logística</em>. Aguardando retorno deles.</p>',
  //       author: 'Pedro Moura',
  //       createdAt: '21/08/2025 às 11:18',
  //     },
  //   ],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Qual o prazo de entrega para o CEP 12345-678?', sender: 'customer', timestamp: new Date('2025-08-21T11:15:00') },
  //     { type: 'event', id: 301, text: 'Atendente marcou a conversa como "Aguardando"' },
  //   ],
  // },
  // {
  //   id: 8,
  //   name: 'Lucas Martins',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Lucas Martins'),
  //   status: 'waiting',
  //   tags: ['pagamento', 'aguardando_cliente', 'boleto', 'liberacao_pedido', 'financeiro'],
  //   notes: [
  //     {
  //       content: '<p>Aguardando o cliente enviar o <u>comprovante de pagamento</u> para liberar o pedido.</p>',
  //       author: 'Ana Silva',
  //       createdAt: '20/08/2025 às 18:00',
  //     },
  //   ],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Já fiz o pagamento, como envio o comprovante?', sender: 'customer', timestamp: new Date('2025-08-20T17:55:00') },
  //     { type: 'chat', id: 2, text: 'Olá, Lucas! Você pode anexar o comprovante nesta conversa.', sender: 'agent', timestamp: new Date('2025-08-20T17:56:00') },
  //   ],
  // },
  // {
  //   id: 9,
  //   name: 'Juliana Ribeiro',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Juliana Ribeiro'),
  //   status: 'waiting',
  //   tags: ['entrega', 'alteracao_cadastro', 'logistica', 'correcao_dados', 'aguardando_cliente'],
  //   notes: [],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Preciso alterar o endereço de entrega, é possível?', sender: 'customer', timestamp: new Date('2025-08-21T13:40:00') },
  //     { type: 'chat', id: 2, text: 'É possível sim, Juliana. Por favor, confirme o novo endereço completo.', sender: 'agent', timestamp: new Date('2025-08-21T13:41:00') },
  //   ],
  // },
  // {
  //   id: 10,
  //   name: 'Marcos Vinicius',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Marcos Vinicius'),
  //   status: 'waiting',
  //   tags: ['suporte_tecnico', 'login', 'senha_reset', 'app_mobile', 'bug_reportado'],
  //   notes: [
  //      {
  //       content: '<p>Problema técnico no login. Time de T.I. já foi acionado. <strong>Ticket #TI-452</strong>.</p>',
  //       author: 'Sofia Andrade',
  //       createdAt: '19/08/2025 às 15:00',
  //     },
  //   ],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Não consigo acessar minha conta.', sender: 'customer', timestamp: new Date('2025-08-19T14:58:00') },
  //   ],
  // },
  // {
  //   id: 11,
  //   name: 'Patrícia Souza',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Patrícia Souza'),
  //   status: 'waiting',
  //   tags: ['estoque', 'vendas', 'lista_espera', 'produto_indisponivel', 'novo_lead'],
  //   notes: [],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Problema resolvido, muito obrigada!', sender: 'customer', timestamp: new Date('2025-08-21T17:50:00') },
  //     { type: 'event', id: 401, text: 'Conversa finalizada por Pedro Moura' },
  //   ],
  // },
  // // =================================================================
  // // ==                      CLIENTES FINALIZADOS                    ==
  // // =================================================================
  // {
  //   id: 4,
  //   name: 'Ana Costa',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Ana Costa'),
  //   status: 'finished',
  //   tags: ['financeiro', 'resolvido', 'feedback_positivo', 'atendimento_finalizado', 'cliente_satisfeito'],
  //   notes: [
  //     {
  //       content: '<p>Dúvida sobre fatura resolvida. Cliente satisfeita. <em>Ótimo feedback ao final do atendimento.</em></p>',
  //       author: 'Pedro Moura',
  //       createdAt: '18/08/2025 às 17:30',
  //     },
  //   ],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Problema resolvido, muito obrigada!', sender: 'customer', timestamp: new Date('2025-08-21T17:50:00') },
  //     { type: 'event', id: 401, text: 'Conversa finalizada por Pedro Moura' },
  //   ],
  // },
  // {
  //   id: 12,
  //   name: 'Gabriel Nunes',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Gabriel Nunes'),
  //   status: 'finished',
  //   tags: ['troca', 'resolvido', 'logistica_reversa', 'ecommerce', 'atendimento_finalizado'],
  //   notes: [
  //     {
  //       content: '<p>A troca do produto foi autorizada e o <u>novo código de rastreio foi enviado</u>. Cliente ciente dos prazos.</p>',
  //       author: 'Sofia Andrade',
  //       createdAt: '17/08/2025 às 14:00',
  //     },
  //   ],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Problema resolvido, muito obrigada!', sender: 'customer', timestamp: new Date('2025-08-21T17:50:00') },
  //     { type: 'event', id: 401, text: 'Conversa finalizada por Pedro Moura' },
  //   ],
  // },
  // {
  //   id: 13,
  //   name: 'Larissa Ferreira',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Larissa Ferreira'),
  //   status: 'finished',
  //   tags: ['cancelamento', 'resolvido', 'assinatura', 'financeiro', 'potencial_churn'],
  //   notes: [
  //     {
  //       content: '<p>Cancelamento do plano mensal efetuado conforme solicitação. <strong>Nenhum débito futuro.</strong></p>',
  //       author: 'Ana Silva',
  //       createdAt: '16/08/2025 às 11:45',
  //     },
  //   ],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Problema resolvido, muito obrigada!', sender: 'customer', timestamp: new Date('2025-08-21T17:50:00') },
  //     { type: 'event', id: 401, text: 'Conversa finalizada por Pedro Moura' },
  //   ],
  // },
  // {
  //   id: 14,
  //   name: 'Daniel Rocha',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Daniel Rocha'),
  //   status: 'finished',
  //   tags: ['duvida_rapida', 'resolvido', 'autoatendimento', 'faq', 'atendimento_finalizado'],
  //   notes: [],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Problema resolvido, muito obrigada!', sender: 'customer', timestamp: new Date('2025-08-21T17:50:00') },
  //     { type: 'event', id: 401, text: 'Conversa finalizada por Pedro Moura' },
  //   ],
  // },
  // {
  //   id: 15,
  //   name: 'Camila Gomes',
  //   email: 'joao.silva@email.com',
  //   phone: '(11) 98765-4321',
  //   avatarColor: generateColorFromName('Camila Gomes'),
  //   status: 'finished',
  //   tags: ['venda_concluida', 'resolvido', 'novo_cliente', 'plano_anual', 'onboarding'],
  //   notes: [
  //     {
  //       content: '<p>Cliente adquiriu o plano anual com desconto. Venda concluída com sucesso. Mais detalhes no nosso <a href="https://crm.empresa.com/cliente/15" target="_blank" rel="noopener noreferrer">portal do funil</a>.</p>',
  //       author: 'Pedro Moura',
  //       createdAt: '15/08/2025 às 19:00',
  //     },
  //   ],
  //   messages: [
  //     { type: 'chat', id: 1, text: 'Problema resolvido, muito obrigada!', sender: 'customer', timestamp: new Date('2025-08-21T17:50:00') },
  //     { type: 'event', id: 401, text: 'Conversa finalizada por Pedro Moura' },
  //   ],
  // }
];
