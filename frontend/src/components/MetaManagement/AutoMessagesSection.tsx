import { FiEdit2, FiSave, FiTrash2, FiX } from "react-icons/fi";
import type { QuickMessageGalleryImage } from "../../types/quickMessages";
import {
  AUTO_MESSAGE_TYPES,
  type AutoMessageDraft,
  type AutoMessageTypeId,
} from "./MetaApiManagement.helpers";

type AutoMessagesSectionProps = {
  isLoadingAutoMessages: boolean;
  autoMessageDrafts: Record<AutoMessageTypeId, AutoMessageDraft>;
  selectedMetaParamId: string;
  savingType: AutoMessageTypeId | null;
  deletingType: AutoMessageTypeId | null;
  togglingType: AutoMessageTypeId | null;
  editingType: AutoMessageTypeId | null;
  setEditingType: (value: AutoMessageTypeId | null) => void;
  handleToggleAutoMessage: (tipoId: AutoMessageTypeId, enabled: boolean) => void | Promise<void>;
  handleChangeAutoMessage: (tipoId: AutoMessageTypeId, value: string) => void;
  handleChangeAutoMessageComplementaryText: (tipoId: AutoMessageTypeId, value: string) => void;
  handleUploadAutoMessageGalleryImage: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  isUploadingAutoMessageGalleryImage: boolean;
  isLoadingAutoMessageGalleryImages: boolean;
  autoMessageGalleryImages: QuickMessageGalleryImage[];
  handleSelectAutoMessageImage: (tipoId: AutoMessageTypeId, value: string) => void;
  handleSaveAutoMessage: (tipoId: AutoMessageTypeId) => void | Promise<void>;
  handleDeleteAutoMessage: (tipoId: AutoMessageTypeId) => void | Promise<void>;
};

export function AutoMessagesSection({
  isLoadingAutoMessages,
  autoMessageDrafts,
  selectedMetaParamId,
  savingType,
  deletingType,
  togglingType,
  editingType,
  setEditingType,
  handleToggleAutoMessage,
  handleChangeAutoMessage,
  handleChangeAutoMessageComplementaryText,
  handleUploadAutoMessageGalleryImage,
  isUploadingAutoMessageGalleryImage,
  isLoadingAutoMessageGalleryImages,
  autoMessageGalleryImages,
  handleSelectAutoMessageImage,
  handleSaveAutoMessage,
  handleDeleteAutoMessage,
}: AutoMessagesSectionProps) {  return (
            <div className="meta-template-list-section">
              <section className="meta-config-section">
                <div className="meta-template-list-header">
                  <div>
                    <h3>Mensagens automaticas do WhatsApp</h3>
                    <p>
                      Configure as mensagens automáticas do número Meta atualmente
                      selecionado na gestão.
                    </p>
                  </div>
                </div>
                {isLoadingAutoMessages ? (
                  <p>Carregando mensagens automaticas...</p>
                ) : (
                  <div className="meta-template-list meta-messages-list">
                    {AUTO_MESSAGE_TYPES.map((item) => {
                      const draft = autoMessageDrafts[item.tipoId];
                      const selectedScopedMetaParamId = Number(
                        selectedMetaParamId || 0,
                      );
                      const isScopedDraft =
                        selectedScopedMetaParamId > 0
                          ? Number(draft.empresaMetaParamId || 0) ===
                            selectedScopedMetaParamId
                          : draft.empresaMetaParamId === null;
                      const isSaving = savingType === item.tipoId;
                      const isDeleting = deletingType === item.tipoId;
                      const isToggling = togglingType === item.tipoId;
                      const isEditing = editingType === item.tipoId;
                      const hasSavedPhrase = Boolean(
                        draft.id && draft.texto.trim(),
                      );
                      const hasComplementaryWelcomeContent =
                        item.tipoId === 1 &&
                        Boolean(
                          draft.mensagemComplementarTexto.trim() ||
                            draft.galeriaImagemUrl,
                        );

                      return (
                        <article
                          key={item.tipoId}
                          className="meta-template-item meta-message-card"
                        >
                          <div className="meta-template-item-meta meta-message-card-content">
                            <div className="meta-message-header">
                              <strong className="meta-message-title">
                                {item.title}
                              </strong>
                              <label className="meta-message-toggle">
                                <input
                                  type="checkbox"
                                  aria-label={
                                    draft.habilitada
                                      ? "Desativar mensagem automatica"
                                      : "Ativar mensagem automatica"
                                  }
                                  checked={draft.habilitada}
                                  onChange={(event) =>
                                    void handleToggleAutoMessage(
                                      item.tipoId,
                                      event.target.checked,
                                    )
                                  }
                                  disabled={isToggling}
                                />
                                <span className="meta-message-toggle__track">
                                  <span className="meta-message-toggle__thumb" />
                                </span>
                              </label>
                            </div>
                            <p className="meta-message-description">
                              {item.description}
                            </p>
                            <p className="meta-message-status">
                              {draft.habilitada
                                ? "Envio automatico habilitado"
                                : "Envio automatico desabilitado"}
                            </p>
                            <p className="meta-message-scope-status">
                              {draft.id
                                ? isScopedDraft
                                  ? draft.ativo
                                    ? "Cadastro: ativo"
                                    : "Cadastro: inativo"
                                  : "Cadastro: herdado do escopo antigo da empresa"
                                : "Cadastro: sem texto salvo"}
                            </p>
                          </div>
                          {isEditing ? (
                            <>
                              <textarea
                                rows={4}
                                value={draft.texto}
                                onChange={(e) =>
                                  handleChangeAutoMessage(
                                    item.tipoId,
                                    e.target.value,
                                  )
                                }
                                placeholder={item.placeholder}
                                className="meta-message-textarea"
                              />
                              {item.tipoId === 5 && (
                                <p className="meta-message-parameter-tip">
                                  Parametro disponivel: <code>{'{{nome_atendente}}'}</code>
                                </p>
                              )}
                              {item.tipoId === 1 && (
                                <div className="meta-message-extra-config">
                                  <div className="meta-message-extra-config-header">
                                    <strong>Conteudo complementar apos as boas-vindas</strong>
                                    <p>
                                      Essa segunda mensagem pode sair com imagem, texto ou ambos
                                      logo depois da mensagem principal.
                                    </p>
                                  </div>
                                  <textarea
                                    rows={3}
                                    value={draft.mensagemComplementarTexto}
                                    onChange={(e) =>
                                      handleChangeAutoMessageComplementaryText(
                                        item.tipoId,
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Ex: Confira nossa promocao da semana ou conheca nossos destaques."
                                    className="meta-message-textarea meta-message-textarea--secondary"
                                  />
                                  <label className="meta-message-field">
                                    <span>Cadastrar nova imagem na galeria</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) =>
                                        void handleUploadAutoMessageGalleryImage(e)
                                      }
                                      className="meta-message-file-input"
                                      disabled={isUploadingAutoMessageGalleryImage}
                                    />
                                  </label>
                                  <label className="meta-message-field">
                                    <span>Imagem complementar da galeria</span>
                                    <select
                                      value={draft.galeriaImagemId || ""}
                                      onChange={(e) =>
                                        handleSelectAutoMessageImage(
                                          item.tipoId,
                                          e.target.value,
                                        )
                                      }
                                      className="meta-message-select"
                                      disabled={
                                        isLoadingAutoMessageGalleryImages ||
                                        isUploadingAutoMessageGalleryImage
                                      }
                                    >
                                      <option value="">
                                        {isLoadingAutoMessageGalleryImages ||
                                        isUploadingAutoMessageGalleryImage
                                          ? "Carregando imagens..."
                                          : "Sem imagem complementar"}
                                      </option>
                                      {autoMessageGalleryImages.map((image) => (
                                        <option key={image.id} value={image.id}>
                                          {image.nome_arquivo}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  {isUploadingAutoMessageGalleryImage ? (
                                    <p className="meta-message-parameter-tip">
                                      Enviando imagem para a galeria da empresa...
                                    </p>
                                  ) : null}
                                  {!isLoadingAutoMessageGalleryImages &&
                                  autoMessageGalleryImages.length === 0 ? (
                                    <p className="meta-message-parameter-tip">
                                      Nenhuma imagem reutilizavel foi encontrada na galeria da
                                      empresa.
                                    </p>
                                  ) : null}
                                  {draft.galeriaImagemUrl ? (
                                    <div className="meta-message-image-preview">
                                      <img
                                        src={draft.galeriaImagemUrl}
                                        alt={draft.galeriaImagemNomeArquivo || "Imagem complementar"}
                                      />
                                      <span>
                                        {draft.galeriaImagemNomeArquivo || "Imagem selecionada"}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                              <div className="meta-message-card-actions">
                                <button
                                  type="button"
                                  title="Salvar"
                                  onClick={() =>
                                    void handleSaveAutoMessage(item.tipoId)
                                  }
                                  disabled={isSaving}
                                >
                                  <FiSave />
                                  <span>
                                    {isSaving ? "Salvando..." : "Salvar"}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  title="Cancelar"
                                  onClick={() => setEditingType(null)}
                                  disabled={isSaving}
                                >
                                  <FiX />
                                  <span>Cancelar</span>
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              {hasSavedPhrase ? (
                                <p className="meta-message-saved-text">
                                  "{draft.texto}"
                                </p>
                              ) : (
                                <p className="meta-message-empty-text">
                                  Nenhuma frase cadastrada.
                                </p>
                              )}
                              {item.tipoId === 1 && (
                                hasComplementaryWelcomeContent ? (
                                  <div className="meta-message-follow-up-card">
                                    <strong>Conteudo complementar enviado em seguida</strong>
                                    {draft.galeriaImagemUrl ? (
                                      <div className="meta-message-image-preview meta-message-image-preview--saved">
                                        <img
                                          src={draft.galeriaImagemUrl}
                                          alt={
                                            draft.galeriaImagemNomeArquivo ||
                                            "Imagem complementar"
                                          }
                                        />
                                        <span>
                                          {draft.galeriaImagemNomeArquivo ||
                                            "Imagem complementar selecionada"}
                                        </span>
                                      </div>
                                    ) : null}
                                    {draft.mensagemComplementarTexto.trim() ? (
                                      <p className="meta-message-saved-text meta-message-saved-text--secondary">
                                        "{draft.mensagemComplementarTexto}"
                                      </p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <p className="meta-message-empty-text meta-message-empty-text--secondary">
                                    Nenhum conteudo complementar configurado para as boas-vindas.
                                  </p>
                                )
                              )}
                              <div className="meta-message-card-actions">
                                <button
                                  type="button"
                                  title={
                                    hasSavedPhrase
                                      ? "Editar"
                                      : "Adicionar frase"
                                  }
                                  onClick={() => setEditingType(item.tipoId)}
                                >
                                  <FiEdit2 />
                                  <span>
                                    {hasSavedPhrase
                                      ? "Editar"
                                      : "Adicionar frase"}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  title="Remover"
                                  onClick={() =>
                                    void handleDeleteAutoMessage(item.tipoId)
                                  }
                                  disabled={isDeleting || !draft.id}
                                >
                                  <FiTrash2 />
                                  <span>
                                    {isDeleting ? "Removendo..." : "Remover"}
                                  </span>
                                </button>
                              </div>
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>  );
}

