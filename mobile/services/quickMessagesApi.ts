import { postEncrypted, postEncryptedMultipart, type RNFile } from './apiClient';
import type { User } from '@/types';

export interface QuickMessage {
  id: number;
  command: string;
  description: string | null;
  text: string | null;
  use_text_as_image_caption: boolean;
  media_order: string[];
  usuario_id: number | null;
  usuario_nome: string | null;
  can_edit: boolean;
  gallery_image_id: number | null;
  image_url: string | null;
  image_name: string | null;
  image_mime_type: string | null;
  gallery_document_id: number | null;
  document_url: string | null;
  document_name: string | null;
  document_mime_type: string | null;
  gallery_audio_id: number | null;
  audio_url: string | null;
  audio_name: string | null;
  audio_mime_type: string | null;
}

export interface GalleryImage {
  id: number;
  empresa_id: number;
  nome_arquivo: string;
  url: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  origem: string;
  data_criacao: string;
  mensagens_vinculadas: number;
  referencia_nome: string | null;
  produto_descricao: string | null;
  produto_preco_base: number | null;
  permite_exclusao: boolean;
  disponivel_para_mensagem_rapida: boolean;
}

export interface GalleryDocument {
  id: number;
  empresa_id: number;
  nome_arquivo: string;
  url: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  origem: string;
  data_criacao: string;
  mensagens_vinculadas: number;
  referencia_nome: string | null;
  permite_exclusao: boolean;
  disponivel_para_mensagem_rapida: boolean;
}

export interface GalleryAudio {
  id: number;
  empresa_id: number;
  nome_arquivo: string;
  url: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  origem: string;
  data_criacao: string;
  mensagens_vinculadas: number;
  permite_exclusao: boolean;
  disponivel_para_mensagem_rapida: boolean;
}

export async function getMensagensRapidas(user: User, includeAll = false): Promise<QuickMessage[]> {
  const { obj } = await postEncrypted<QuickMessage[]>('/user', '/mensagens_rapidas', {
    empresa_id: user.empresa_id,
    usuario_id: user.id,
    incluir_todas: includeAll,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function deletarMensagemRapida(user: User, id: number): Promise<void> {
  await postEncrypted('/user', '/deletar_mensagens_rapidas', {
    id,
    empresa_id: user.empresa_id,
    usuario_id: user.id,
  });
}

export interface QuickMessagePayload {
  comando: string;
  descricao: string;
  texto: string;
  galeria_imagem_id?: number | null;
  remove_image?: boolean;
  galeria_documento_id?: number | null;
  remove_document?: boolean;
  galeria_audio_id?: number | null;
  remove_audio?: boolean;
  usar_texto_como_legenda?: boolean;
  ordem_midias?: string[];
}

export async function criarMensagemRapida(
  user: User,
  payload: QuickMessagePayload,
  imageFile?: RNFile,
  documentFile?: RNFile,
  audioFile?: RNFile
): Promise<QuickMessage> {
  const { obj } = await postEncryptedMultipart<QuickMessage>(
    '/user',
    '/criar_mensagens_rapidas',
    { empresa_id: user.empresa_id, usuario_id: user.id, ...payload },
    { image: imageFile, document: documentFile, audio: audioFile }
  );
  return obj;
}

export async function alterarMensagemRapida(
  user: User,
  id: number,
  payload: QuickMessagePayload,
  imageFile?: RNFile,
  documentFile?: RNFile,
  audioFile?: RNFile
): Promise<QuickMessage> {
  const { obj } = await postEncryptedMultipart<QuickMessage>(
    '/user',
    '/alterar_mensagens_rapidas',
    { empresa_id: user.empresa_id, usuario_id: user.id, id, ...payload },
    { image: imageFile, document: documentFile, audio: audioFile }
  );
  return obj;
}

export async function getGaleriaImagens(user: User): Promise<GalleryImage[]> {
  const { obj } = await postEncrypted<GalleryImage[]>('/user', '/galeria_empresa_imagens', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function uploadGaleriaImagem(user: User, file: RNFile): Promise<GalleryImage> {
  const { obj } = await postEncryptedMultipart<GalleryImage>(
    '/user',
    '/galeria_empresa_imagens_upload',
    { empresa_id: user.empresa_id },
    { image: file }
  );
  return obj;
}

export async function deletarGaleriaImagem(user: User, id: number): Promise<void> {
  await postEncrypted('/user', '/galeria_empresa_imagens_deletar', {
    id,
    empresa_id: user.empresa_id,
  });
}

export async function getGaleriaDocumentos(user: User): Promise<GalleryDocument[]> {
  const { obj } = await postEncrypted<GalleryDocument[]>('/user', '/galeria_empresa_documentos', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function uploadGaleriaDocumento(user: User, file: RNFile): Promise<GalleryDocument> {
  const { obj } = await postEncryptedMultipart<GalleryDocument>(
    '/user',
    '/galeria_empresa_documentos_upload',
    { empresa_id: user.empresa_id },
    { document: file }
  );
  return obj;
}

export async function deletarGaleriaDocumento(user: User, id: number): Promise<void> {
  await postEncrypted('/user', '/galeria_empresa_documentos_deletar', {
    id,
    empresa_id: user.empresa_id,
  });
}

export async function getGaleriaAudios(user: User): Promise<GalleryAudio[]> {
  const { obj } = await postEncrypted<GalleryAudio[]>('/user', '/galeria_empresa_audios', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function uploadGaleriaAudio(user: User, file: RNFile): Promise<GalleryAudio> {
  const { obj } = await postEncryptedMultipart<GalleryAudio>(
    '/user',
    '/galeria_empresa_audios_upload',
    { empresa_id: user.empresa_id },
    { audio: file }
  );
  return obj;
}

export async function deletarGaleriaAudio(user: User, id: number): Promise<void> {
  await postEncrypted('/user', '/galeria_empresa_audios_deletar', {
    id,
    empresa_id: user.empresa_id,
  });
}
