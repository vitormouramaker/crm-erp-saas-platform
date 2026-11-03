export interface QuickMessageGalleryImage {
  id: number;
  empresa_id?: number;
  nome_arquivo: string;
  url: string;
  path_bunny?: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  origem: string | null;
  data_criacao: string | null;
  mensagens_vinculadas: number;
  referencia_nome?: string | null;
  produto_descricao?: string | null;
  produto_preco_base?: number | null;
  permite_exclusao?: boolean;
  disponivel_para_mensagem_rapida?: boolean;
}

export interface QuickMessageGalleryDocument {
  id: number;
  empresa_id?: number;
  nome_arquivo: string;
  url: string;
  path_bunny?: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  origem: string | null;
  data_criacao: string | null;
  mensagens_vinculadas: number;
  referencia_nome?: string | null;
  permite_exclusao?: boolean;
  disponivel_para_mensagem_rapida?: boolean;
}

export interface QuickMessageGalleryAudio {
  id: number;
  empresa_id?: number;
  nome_arquivo: string;
  url: string;
  path_bunny?: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  origem: string | null;
  data_criacao: string | null;
  mensagens_vinculadas: number;
  permite_exclusao?: boolean;
  disponivel_para_mensagem_rapida?: boolean;
}
