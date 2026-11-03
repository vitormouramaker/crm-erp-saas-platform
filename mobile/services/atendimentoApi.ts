import { API_BASE, authFetch, postEncrypted } from './apiClient';
import { decrypt, encrypt } from './security';
import type { User } from '@/types';

export type ConversaStatus = 'waiting' | 'active' | 'finished';

export interface Conversa {
  id: number;
  nome: string | null;
  telefone: string | null;
  utms: any;
  cliente_id: number;
  usuario_id: number | null;
  empresa_meta_param_id: number | null;
  usuario_atribuido_id: number | null;
  nome_usuario_atribuido: string | null;
  nome_atendente?: string | null;
  meta_numero_conta: string;
  meta_nome_conta: string;
  aguardando_resposta_template: boolean;
  status: ConversaStatus;
  data_inicio: string | null;
  fila_desde: string | null;
  fila_mais_24h: boolean;
  data_fim?: string | null;
  ultima_atualizacao: string | null;
  ultima_mensagem_cliente_em: string | null;
  janela_meta_expira_em: string | null;
  janela_meta_aberta: boolean;
  ultima_mensagem: string | null;
  unread_count: number;
}

export interface AtendimentoConfig {
  atendimento_lista_atribuida_adm: boolean;
  atendimento_mensagens_rapidas_ativas: boolean;
  atendimento_disparo_nps_ativo: boolean;
  atendimento_fila_automatica_ativa: boolean;
  atendimento_fila_usuarios: number[];
}

export interface AnaliseAtendimentoIA {
  conversa_id: number;
  cliente: { id: number; nome: string | null; telefone: string | null };
  atendente: { nome: string | null };
  total_mensagens: number;
  analise: {
    precisa_contexto_minimo: boolean;
    solicitacao_contexto: string;
    notas_por_etapa: Record<string, number>;
    nota_final: number;
    kpis_comerciais: string[];
    diagnostico_gargalos: string[];
    risco_perda: string;
    probabilidade_avanco: string;
    proxima_etapa_recomendada: string;
    ajustes_finos: string[];
    boas_praticas_reforcar: string[];
    script_sugestao_imediato: string[];
    script_completo_nota_10: string[];
  };
}

export interface ConversaSearchItem extends Conversa {
  search_match_preview?: string | null;
  search_match_timestamp?: string | null;
}

export interface BuscarConversasParams {
  pesquisa: string;
  status?: ConversaStatus | null;
  selectedAttendantFilter?: string;
  selectedMetaNumberFilter?: string;
  showUnreadOnly?: boolean;
  offset?: number;
}

export interface BuscarConversasResult {
  items: ConversaSearchItem[];
  hasMore: boolean;
  nextOffset: number;
  total: number;
}

export async function buscarConversas(
  user: User,
  params: BuscarConversasParams
): Promise<BuscarConversasResult> {
  const { obj } = await postEncrypted<{
    items: ConversaSearchItem[];
    has_more: boolean;
    next_offset: number;
    limit: number;
    total: number;
  }>('/atendimento', '/buscar_conversas_usuario', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    pesquisa: params.pesquisa,
    status: params.status || undefined,
    selected_attendant_filter: params.selectedAttendantFilter || '',
    selected_meta_number_filter: params.selectedMetaNumberFilter || '',
    show_unread_only: !!params.showUnreadOnly,
    offset: params.offset || 0,
  });
  return {
    items: Array.isArray(obj?.items) ? obj.items : [],
    hasMore: !!obj?.has_more,
    nextOffset: Number(obj?.next_offset || 0),
    total: Number(obj?.total || 0),
  };
}

export async function getConversas(user: User): Promise<Conversa[]> {
  const { obj } = await postEncrypted<Conversa[] | { items: Conversa[] }>(
    '/atendimento',
    '/carregar_conversas_usuario',
    {
      empresa_id: user.empresa_id,
      usuario_id: user.id,
    }
  );
  // Desde 17/08/26 o back embrulha a lista em `{ items, finished_pagination }`
  // (paginacao de finalizados); mantém o formato antigo (array puro) como fallback.
  if (Array.isArray(obj)) return obj;
  return Array.isArray((obj as any)?.items) ? (obj as any).items : [];
}

export async function getAtendimentoConfig(user: User): Promise<AtendimentoConfig> {
  const { obj } = await postEncrypted<AtendimentoConfig>('/atendimento', '/configuracoes', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
  });
  return obj;
}

export async function salvarAtendimentoConfig(
  user: User,
  config: AtendimentoConfig
): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/salvar_configuracoes', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    ...config,
  });
  return message;
}

export async function iniciarAtendimento(user: User, conversaId: number): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/iniciar_atendimento', {
    conversa_id: conversaId,
    usuario_id: user.id,
    nome_usuario: user.name || user.nome || '',
  });
  return message;
}

export async function finalizarAtendimentoFila(user: User, conversaId: number): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/finalizar_atendimento_fila', {
    conversa_id: conversaId,
    usuario_id: user.id,
  });
  return message;
}

export async function finalizarFilaExpirados(
  user: User
): Promise<{ total_finalizados: number; conversa_ids: number[] }> {
  const { obj } = await postEncrypted<{ total_finalizados: number; conversa_ids: number[] }>(
    '/atendimento',
    '/finalizar_atendimentos_fila_expirados',
    {
      empresa_id: user.empresa_id,
      usuario_id: user.id,
    }
  );
  return obj;
}

export type MensagemSender = 'me' | 'other' | 'system';

export interface Mensagem {
  id: number;
  sort_id: number;
  user_bubble: string | null;
  type: 'text' | 'media' | 'chat' | 'event';
  sender: MensagemSender;
  timestamp: string;
  fileName: string | null;
  mensagem: string | null;
  midia_id: string | null;
  mediaType: string | null;
  messageStatusId: number | null;
  messageStatus: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | null;
  messageStatusLabel: string | null;
  reply: boolean;
  mensagem_reply_id: number | null;
  replyText: string | null;
  replyMediaType: string | null;
  templateData: any;
  apagada?: boolean;
}

export interface ConversaDados {
  cliente_id: number;
  usuario_id: number | null;
  usuario_atribuido_id: number | null;
  empresa_id: number;
  status_id: number;
  empresa_meta_param_id: number | null;
  atendente: string | null;
  nome_usuario_atribuido: string | null;
  meta_numero_conta: string;
  meta_nome_conta: string;
  aguardando_resposta_template: boolean;
  cliente_bloqueado?: boolean;
}

export interface MensagemCursor {
  timestamp: string;
  sort_id: number;
}

export interface CarregarConversaResult {
  mensagens: Mensagem[];
  dados: ConversaDados;
  page: {
    mode: 'initial' | 'before' | 'delta';
    limit: number;
    has_more_before: boolean;
    earliest_cursor: MensagemCursor | null;
    latest_cursor: MensagemCursor | null;
  };
}

export async function carregarConversa(
  user: User,
  conversaId: number,
  cursor?: { before?: MensagemCursor; after?: MensagemCursor; limit?: number }
): Promise<CarregarConversaResult> {
  const { obj } = await postEncrypted<CarregarConversaResult>('/atendimento', '/carregar_conversa', {
    conversa_id: conversaId,
    usuario_id: user.id,
    limit: cursor?.limit ?? 80,
    before_timestamp: cursor?.before?.timestamp ?? null,
    before_sort_id: cursor?.before?.sort_id ?? null,
    after_timestamp: cursor?.after?.timestamp ?? null,
    after_sort_id: cursor?.after?.sort_id ?? null,
  });
  return obj;
}

export interface AdReferralInfo {
  source_url?: string | null;
  source_type?: string | null;
  source_id?: string | null;
  headline?: string | null;
  body?: string | null;
  media_type?: string | null;
  image_url?: string | null;
  video_url?: string | null;
}

export async function buscarAnuncioOrigemConversa(
  user: User,
  conversaId: number,
  maxPages = 3
): Promise<AdReferralInfo | null> {
  let cursor: MensagemCursor | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await carregarConversa(user, conversaId, { limit: 100, before: cursor });
    const found = result.mensagens.find((m) => m.mediaType === 'meta_referral');
    if (found?.midia_id) {
      try {
        return JSON.parse(found.midia_id) as AdReferralInfo;
      } catch {
        return null;
      }
    }
    if (!result.page.has_more_before || !result.page.earliest_cursor) break;
    cursor = result.page.earliest_cursor;
  }
  return null;
}

export async function enviarMensagem(
  user: User,
  conversaId: number,
  mensagem: string
): Promise<void> {
  await postEncrypted('/atendimento', '/enviar_mensagem', {
    conversa_id: conversaId,
    usuario_id: user.id,
    nome: user.name || user.nome || '',
    mensagem,
  });
}

export async function reagirMensagem(
  user: User,
  conversaId: number,
  mensagemId: number,
  emoji: string
): Promise<void> {
  await postEncrypted('/atendimento', '/reagir_mensagem', {
    conversa_id: conversaId,
    usuario_id: user.id,
    mensagem_id: mensagemId,
    emoji,
  });
}

export async function finalizarAtendimento(user: User, conversaId: number): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/finalizar_atendimento', {
    conversa_id: conversaId,
    usuario_id: user.id,
  });
  return message;
}

export async function transferirAtendimento(
  user: User,
  conversaId: number,
  novoUsuarioId: number
): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/transferir_atendimento', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    conversa_id: conversaId,
    novo_usuario_id: novoUsuarioId,
  });
  return message;
}

export interface MensagemRapida {
  id: number;
  nome: string;
  descricao: string | null;
  texto: string;
  use_text_as_image_caption: boolean;
  media_order: string[];
  gallery_image_id: number | null;
  image_url: string | null;
  image_name: string | null;
  gallery_document_id: number | null;
  document_url: string | null;
  document_name: string | null;
  gallery_audio_id: number | null;
  audio_url: string | null;
  audio_name: string | null;
}

export async function buscarMensagensRapidas(
  user: User,
  pesquisa: string
): Promise<MensagemRapida[]> {
  const { obj } = await postEncrypted<MensagemRapida[]>('/atendimento', '/mensagem_busca', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    pesquisa,
  });
  return Array.isArray(obj) ? obj : [];
}

export interface ClienteDetalheTag {
  id: number;
  name: string;
}

export interface ClienteDetalheNota {
  content: string;
  author: string | null;
  createdAt: string;
  user_id: number | null;
}

export interface ClienteDetalheInfo {
  cliente_id: number;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  origem: string | null;
  utms: any;
  data_aniversario: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  empresa: string | null;
  cargo: string | null;
  faturamento: string | null;
}

export function formatEnderecoCliente(cliente: ClienteDetalheInfo | null | undefined): string | null {
  if (!cliente) return null;
  const linha1 = [cliente.logradouro, cliente.numero].filter(Boolean).join(', ');
  const linha2 = [cliente.bairro, cliente.cidade && cliente.uf ? `${cliente.cidade}/${cliente.uf}` : cliente.cidade || cliente.uf]
    .filter(Boolean)
    .join(' - ');
  const partes = [linha1, cliente.complemento, linha2, cliente.cep].filter(Boolean);
  return partes.length ? partes.join(' • ') : null;
}

export interface ClienteCrmAtendimento {
  negocio_id: number;
  crm_id: number;
  crm_nome: string;
  etapa_id: number;
  etapa_codigo: string | null;
  etapa_nome: string;
  etapa_fechamento: boolean;
  titulo: string | null;
  valor_estimado: number | null;
  valor_fechamento: number | null;
  data_criacao: string | null;
  data_entrada_pipeline: string | null;
  data_fechamento_real: string | null;
  produto_principal: string | null;
  produtos: any[];
  responsavel_id: number | null;
  responsavel_nome: string | null;
}

export interface ClienteCrmInteracao {
  id: number;
  tipo_codigo: string | null;
  tipo_nome: string | null;
  descricao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  em_andamento: boolean | null;
  valor: number | null;
  atendente_nome: string | null;
}

export interface ClienteCrmHistorico {
  id: number;
  tipo: string | null;
  titulo: string | null;
  descricao: string | null;
  criado_em: string | null;
  dados: any;
  atendente_nome: string | null;
}

export interface ClienteDocumento {
  id: number;
  empresa_id: number;
  cliente_id: number;
  usuario_id: number | null;
  nome_arquivo: string;
  url: string;
  path_bunny: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  origem: string | null;
  data_criacao: string | null;
  ativo: boolean;
}

export interface ClienteAtendimentoWhatsapp {
  conversa_id: number;
  status_id: number;
  data_inicio: string | null;
  data_fim: string | null;
  ultima_atualizacao: string | null;
  atendente_nome: string | null;
  meta_numero_conta: string;
}

export interface DetalhesCliente {
  tags: ClienteDetalheTag[];
  notes: ClienteDetalheNota[];
  cliente: ClienteDetalheInfo | null;
  crm: {
    atendimento: ClienteCrmAtendimento | null;
    interacoes: ClienteCrmInteracao[];
    historico: ClienteCrmHistorico[];
  };
  documentos: ClienteDocumento[];
  historico_atendimentos_whatsapp: ClienteAtendimentoWhatsapp[];
}

export async function buscarDetalhesCliente(
  user: User,
  clienteId: number
): Promise<DetalhesCliente> {
  const { obj } = await postEncrypted<DetalhesCliente>('/atendimento', '/buscar_detalhes_cliente', {
    empresa_id: user.empresa_id,
    cliente_id: clienteId,
  });
  return {
    tags: Array.isArray(obj?.tags) ? obj.tags : [],
    notes: Array.isArray(obj?.notes) ? obj.notes : [],
    cliente: obj?.cliente || null,
    crm: {
      atendimento: obj?.crm?.atendimento || null,
      interacoes: Array.isArray(obj?.crm?.interacoes) ? obj.crm.interacoes : [],
      historico: Array.isArray(obj?.crm?.historico) ? obj.crm.historico : [],
    },
    documentos: Array.isArray(obj?.documentos) ? obj.documentos : [],
    historico_atendimentos_whatsapp: Array.isArray(obj?.historico_atendimentos_whatsapp)
      ? obj.historico_atendimentos_whatsapp
      : [],
  };
}

export interface DocumentoClienteArquivo {
  uri: string;
  name: string;
  mimeType?: string;
}

export async function uploadDocumentoCliente(
  user: User,
  clienteId: number,
  arquivo: DocumentoClienteArquivo
): Promise<string> {
  const form = new FormData();
  form.append(
    'payload',
    encrypt({
      empresa_id: user.empresa_id,
      cliente_id: clienteId,
      usuario_id: user.id,
    })
  );
  form.append('document', {
    uri: arquivo.uri,
    name: arquivo.name,
    type: arquivo.mimeType || 'application/octet-stream',
  } as any);

  const response = await authFetch(`${API_BASE}/atendimento/documento_cliente_upload`, {
    method: 'POST',
    body: form,
  });

  const responseData = await response.json();
  const decrypted = decrypt(responseData.payload);

  if (!decrypted?.boleano) {
    throw new Error(decrypted?.mensagem || decrypted?.msg || 'Não foi possível salvar o documento.');
  }
  return decrypted.mensagem || 'Documento salvo com sucesso.';
}

export async function deletarDocumentoCliente(user: User, documentoId: number): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/documento_cliente_deletar', {
    empresa_id: user.empresa_id,
    documento_id: documentoId,
  });
  return message;
}

export async function garantirCrmAtendimento(user: User, conversaId: number): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/garantir_crm_atendimento', {
    conversa_id: conversaId,
    usuario_id: user.id,
  });
  return message;
}

export async function enviarLocalizacao(
  user: User,
  conversaId: number,
  numero: string,
  localizacao: { latitude: number; longitude: number; name?: string; address?: string }
): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/enviar_localizacao', {
    conversa_id: conversaId,
    usuario_id: user.id,
    numero,
    ...localizacao,
  });
  return message;
}

export async function enviarContato(
  user: User,
  conversaId: number,
  numero: string,
  contato: { name: string; phone?: string; email?: string }
): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/enviar_contato', {
    conversa_id: conversaId,
    usuario_id: user.id,
    numero,
    ...contato,
  });
  return message;
}

export async function enviarImagensProdutoComercial(
  user: User,
  conversaId: number,
  numero: string,
  imageIds: number[],
  caption?: string
): Promise<{ message: string; total: number }> {
  const { obj, message } = await postEncrypted<{ total: number }>('/atendimento', '/enviar_imagens_produto_comercial', {
    conversa_id: conversaId,
    usuario_id: user.id,
    numero,
    image_ids: imageIds,
    caption: caption || '',
  });
  return { message, total: obj?.total || 0 };
}

export async function enviarAudioGaleria(
  user: User,
  conversaId: number,
  numero: string,
  galeriaAudioId: number
): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/enviar_audio_url', {
    conversa_id: conversaId,
    usuario_id: user.id,
    numero,
    galeria_audio_id: galeriaAudioId,
  });
  return message;
}

export interface MidiaArquivo {
  /**
   * `file://` URI normal, ou `data:<mime>;base64,<...>` quando o Content-Type
   * real precisa ser forcado (o RN's FormData ignora o `type` abaixo pra
   * URIs `file://` no iOS: RCTFileRequestHandler sniffa o MIME pela extensao
   * do arquivo em disco, nao pelo campo `type`. Ja `data:` URIs sao lidas
   * pelo RCTDataRequestHandler, que usa o MIME declarado na propria URI).
   */
  uri: string;
  name: string;
  mimeType?: string;
}

export async function enviarMidia(
  user: User,
  conversaId: number,
  numero: string,
  arquivos: MidiaArquivo[],
  caption?: string
): Promise<string> {
  const form = new FormData();
  form.append('conversa_id', String(conversaId));
  form.append('usuario_id', String(user.id));
  form.append('numero', numero);
  if (caption) form.append('caption', caption);
  arquivos.forEach((arquivo) => {
    form.append('file', {
      uri: arquivo.uri,
      name: arquivo.name,
      type: arquivo.mimeType || 'application/octet-stream',
    } as any);
  });

  const response = await authFetch(`${API_BASE}/atendimento/upload_media`, {
    method: 'POST',
    body: form,
  });

  const responseData = await response.json();
  const decrypted = decrypt(responseData.payload);
  if (!decrypted?.boleano) {
    throw new Error(decrypted?.mensagem || decrypted?.msg || 'Não foi possível enviar o arquivo.');
  }
  return decrypted.mensagem || 'Arquivo enviado com sucesso.';
}

export async function enviarImagemUrl(
  user: User,
  conversaId: number,
  numero: string,
  imageUrl: string,
  caption?: string
): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/enviar_imagem_url', {
    conversa_id: conversaId,
    usuario_id: user.id,
    numero,
    image_url: imageUrl,
    caption: caption || '',
  });
  return message;
}

export async function enviarDocumentoUrl(
  user: User,
  conversaId: number,
  numero: string,
  documentUrl: string,
  filename?: string,
  caption?: string
): Promise<string> {
  const { message } = await postEncrypted('/atendimento', '/enviar_documento_url', {
    conversa_id: conversaId,
    usuario_id: user.id,
    numero,
    document_url: documentUrl,
    filename: filename || '',
    caption: caption || '',
  });
  return message;
}

export async function analisarAtendimentoIA(
  user: User,
  conversaId: number
): Promise<AnaliseAtendimentoIA> {
  const { obj } = await postEncrypted<AnaliseAtendimentoIA>(
    '/atendimento',
    '/analisar_atendimento_ia',
    {
      empresa_id: user.empresa_id,
      usuario_id: user.id,
      conversa_id: conversaId,
    }
  );
  return obj;
}
