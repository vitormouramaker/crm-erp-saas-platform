import { API_BASE, authFetch, postEncrypted } from './apiClient';
import { decrypt } from './security';
import type { User } from '@/types';

export interface AllowedMetaNumber {
  id: number;
  display_phone_number: string | null;
  phone_number_id: string | null;
  verified_name: string | null;
  whatsapp_account_id: string | null;
  whatsapp_account_name: string | null;
  ativo: boolean;
}

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  telefone: string | null;
  filial_id: number | null;
  filial_nome: string | null;
  is_master: boolean;
  permissions: string[];
  allowed_meta_numbers: AllowedMetaNumber[];
  allowed_meta_param_ids: number[];
}

export interface Cargo {
  id: number;
  nome: string;
}

export interface Filial {
  id: number;
  name: string;
  address: string | null;
  manager: string | null;
  contact: string | null;
  isPrimary: boolean;
  cnpj: string | null;
  latitude: number | null;
  longitude: number | null;
  toleranceMeters: number | null;
}

export interface FilialPayload {
  name: string;
  address: string;
  manager: string;
  contact: string;
  isPrimary: boolean;
  latitude: number | null;
  longitude: number | null;
  toleranceMeters: number;
}

export interface UserFormPayload {
  name: string;
  email: string;
  telefone: string;
  password?: string;
  cargo_id: number;
  filial_id: number | null;
  permissions: string[];
  allowed_meta_param_ids: number[];
}

export const PERMISSION_LABELS: Record<string, string> = {
  'stock.view': 'Acesso ao módulo',
  'stock.products.manage': 'Criar e editar produtos',
  'stock.suppliers.view': 'Acessar fornecedores',
  'stock.orders.view': 'Acessar pedidos de compra',
  'stock.orders.create': 'Criar pedidos de compra',
  'sales.view': 'Acesso ao módulo',
  'sales.create': 'Registrar venda',
  'chat.view': 'Acesso ao chat',
  'contacts.view': 'Acesso aos contatos',
  'commercial.view': 'Acesso ao módulo',
  'commercial.pipeline': 'Pipeline comercial',
  'commercial.scheduled_dispatches': 'Agendar disparos',
  'commercial.dashboard': 'Dashboard comercial',
  'commercial.reports': 'Relatórios comerciais',
  'settings.view': 'Ver configurações',
  'settings.quick_messages': 'Mensagens rápidas',
  'settings.tags': 'Tags',
  'settings.branches': 'Filiais',
  'settings.categories': 'Categorias',
  'settings.ia': 'Configurar IA',
  'settings.nps': 'NPS',
  'settings.integrations': 'Integrações',
  'settings.meta': 'Configurar Meta',
  'settings.meta_ads': 'Configurar Meta Ads',
  'meta.view': 'Ver módulo Meta',
  'meta_ads.view': 'Ver módulo Meta Ads',
  'google_ads.view': 'Ver módulo Google Ads',
  'users.manage': 'Gerenciar equipe',
  'dashboard.view': 'Ver dashboard',
  'finance.manage': 'Gerenciar financeiro',
  'subscription.manage': 'Gerenciar assinatura',
  'hr.timeclock': 'Registrar ponto',
  'hr.manage': 'Gerenciar RH',
};

export function getPermissionLabel(key: string): string {
  if (PERMISSION_LABELS[key]) return PERMISSION_LABELS[key];
  const raw = key.split('.').slice(1).join(' ') || key;
  const pretty = raw.replace(/[._]/g, ' ').trim();
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

export async function getUsuarios(user: User): Promise<ManagedUser[]> {
  const { obj } = await postEncrypted<ManagedUser[]>('/user', '/lista_usuarios', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function criarUsuario(user: User, payload: UserFormPayload): Promise<void> {
  await postEncrypted('/user', '/criar_usuario', {
    ...payload,
    empresa_id: user.empresa_id,
  });
}

export async function editarUsuario(user: User, id: number, payload: UserFormPayload): Promise<void> {
  await postEncrypted('/user', '/editar_usuario', {
    id,
    ...payload,
    password: payload.password || '',
    empresa_id: user.empresa_id,
  });
}

export async function deletarUsuario(usuarioId: number): Promise<void> {
  await postEncrypted('/user', '/deletar_usuario', { usuario_id: usuarioId });
}

export async function getFiliais(user: User): Promise<Filial[]> {
  const { obj } = await postEncrypted<Filial[]>('/user', '/lista_filial', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function criarFilial(user: User, cnpj: string, payload: FilialPayload): Promise<Filial> {
  const { obj } = await postEncrypted<Filial>('/user', '/cadastro_filial', {
    empresa_id: user.empresa_id,
    cnpj,
    ...payload,
  });
  return obj;
}

export async function editarFilial(filialId: number, payload: FilialPayload): Promise<Filial> {
  const { obj } = await postEncrypted<Filial>('/user', '/editar_filial', {
    id: filialId,
    ...payload,
  });
  return obj;
}

export async function deletarFilial(filialId: number, filialAlvoId: number): Promise<void> {
  await postEncrypted('/user', '/deletar_filial', {
    filial_id: filialId,
    delete_all: false,
    filial_alvo_id: filialAlvoId,
  });
}

export async function getMetaNumeros(user: User): Promise<AllowedMetaNumber[]> {
  const { obj } = await postEncrypted<AllowedMetaNumber[]>(
    '/user',
    '/listar_numeros_meta_lista_transmissao',
    { empresa_id: user.empresa_id, usuario_id: user.id }
  );
  return Array.isArray(obj) ? obj : [];
}

export interface AutoMessage {
  tipo_id: number;
  descricao: string;
  id: number | null;
  texto: string | null;
  mensagem_complementar_texto: string | null;
  galeria_imagem_id: number | null;
  empresa_meta_param_id: number | null;
  galeria_imagem_url: string | null;
  ativo: boolean;
  habilitada: boolean;
}

export async function getMensagensAutomaticas(
  user: User,
  metaParamId?: number
): Promise<AutoMessage[]> {
  const { obj } = await postEncrypted<AutoMessage[]>(
    '/user',
    '/listar_mensagens_automaticas_whatsapp',
    { empresa_id: user.empresa_id, meta_param_id: metaParamId }
  );
  return Array.isArray(obj) ? obj : [];
}

export async function alterarStatusMensagemAutomatica(
  user: User,
  tipoId: number,
  habilitada: boolean,
  metaParamId?: number
): Promise<AutoMessage> {
  const { obj } = await postEncrypted<AutoMessage>(
    '/user',
    '/alterar_status_mensagem_automatica_whatsapp',
    { empresa_id: user.empresa_id, tipo_id: tipoId, habilitada, meta_param_id: metaParamId }
  );
  return obj;
}

const AUTO_MESSAGE_ROUTES: Record<number, { criar: string; editar: string; deletar: string }> = {
  1: {
    criar: '/criar_mensagem_boas_vindas',
    editar: '/editar_mensagem_boas_vindas',
    deletar: '/deletar_mensagem_boas_vindas',
  },
  2: {
    criar: '/criar_mensagem_final_atendimento',
    editar: '/editar_mensagem_final_atendimento',
    deletar: '/deletar_mensagem_final_atendimento',
  },
  3: {
    criar: '/criar_texto_nps',
    editar: '/editar_texto_nps',
    deletar: '/deletar_texto_nps',
  },
  5: {
    criar: '/criar_mensagem_inicio_atendimento',
    editar: '/editar_mensagem_inicio_atendimento',
    deletar: '/deletar_mensagem_inicio_atendimento',
  },
};

export async function salvarMensagemAutomatica(
  user: User,
  params: {
    tipo_id: number;
    id?: number | null;
    texto: string;
    meta_param_id?: number;
    mensagem_complementar_texto?: string;
  }
): Promise<AutoMessage> {
  const routes = AUTO_MESSAGE_ROUTES[params.tipo_id];
  if (!routes) throw new Error('Tipo de mensagem automática não suportado.');

  const payload: Record<string, unknown> = {
    empresa_id: user.empresa_id,
    texto: params.texto,
    meta_param_id: params.meta_param_id,
  };
  if (params.id) payload.id = params.id;
  if (params.tipo_id === 1) {
    payload.mensagem_complementar_texto = params.mensagem_complementar_texto || '';
  }

  const { obj } = await postEncrypted<AutoMessage>(
    '/user',
    params.id ? routes.editar : routes.criar,
    payload
  );
  return obj;
}

export async function deletarMensagemAutomatica(
  user: User,
  tipoId: number,
  id: number,
  metaParamId?: number
): Promise<void> {
  const routes = AUTO_MESSAGE_ROUTES[tipoId];
  if (!routes) throw new Error('Tipo de mensagem automática não suportado.');
  await postEncrypted('/user', routes.deletar, {
    empresa_id: user.empresa_id,
    id,
    meta_param_id: metaParamId,
  });
}

export type TemplateAutomationType = 'birthday' | 'sale_completed' | 'sale_refused';

export interface TemplateAutomationConfig {
  empresa_meta_param_id: number;
  empresa_id: number;
  display_phone_number: string | null;
  habilitada: boolean;
  is_default_dispatch_number: boolean;
  template_name: string | null;
  template_language: string;
  horario: string;
  delay_days: number | null;
  default_dispatch_meta_param_id: number | null;
  default_dispatch_display_phone_number: string | null;
}

export async function getTemplateAutomationConfig(
  user: User,
  automationType: TemplateAutomationType,
  metaParamId?: number
): Promise<TemplateAutomationConfig> {
  const { obj } = await postEncrypted<TemplateAutomationConfig>(
    '/user',
    '/configuracao_template_automacao',
    { empresa_id: user.empresa_id, automation_type: automationType, meta_param_id: metaParamId }
  );
  return obj;
}

export async function salvarTemplateAutomationConfig(
  user: User,
  params: {
    automation_type: TemplateAutomationType;
    meta_param_id?: number;
    template_name: string;
    template_language: string;
    horario: string;
    delay_days?: number;
    is_default_dispatch_number: boolean;
  }
): Promise<TemplateAutomationConfig> {
  const { obj } = await postEncrypted<TemplateAutomationConfig>(
    '/user',
    '/salvar_configuracao_template_automacao',
    {
      empresa_id: user.empresa_id,
      automation_type: params.automation_type,
      meta_param_id: params.meta_param_id,
      template_name: params.template_name,
      template_language: params.template_language,
      horario: params.horario,
      delay_days: params.delay_days,
      is_default_dispatch_number: params.is_default_dispatch_number,
    }
  );
  return obj;
}

export async function getCargos(): Promise<Cargo[]> {
  const response = await authFetch(`${API_BASE}/user/get_cargos`);
  const data = await response.json();
  const decrypted = decrypt(data.payload);

  if (!decrypted?.boleano) {
    throw new Error(decrypted?.mensagem || 'Não foi possível carregar os cargos.');
  }
  return Array.isArray(decrypted.obj) ? decrypted.obj : [];
}
