import type { FormEvent, RefObject } from "react";
import { FaExternalLinkAlt } from "react-icons/fa";
import {
  TEMPLATE_BUTTON_TYPE_OPTIONS,
  TEMPLATE_EMOJI_OPTIONS,
  TEMPLATE_MAX_BUTTONS,
  getPreviewButtonLabel,
  renderWhatsAppFormattedText,
  type TemplateButtonDraft,
  type TemplateMediaSampleType,
} from "./MetaApiManagement.helpers";

type CreateTemplateModalProps = {
  isOpen: boolean;
  isEditing?: boolean;
  onClose: () => void;
  handleCreateTemplate: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  templateName: string;
  setTemplateName: (value: string) => void;
  templateCategory: string;
  setTemplateCategory: (value: string) => void;
  templateLanguage: string;
  setTemplateLanguage: (value: string) => void;
  templateMediaSampleType: TemplateMediaSampleType;
  setTemplateMediaSampleType: (value: TemplateMediaSampleType) => void;
  setTemplateMediaSampleFile: (value: File | null) => void;
  templateHeader: string;
  setTemplateHeader: (value: string) => void;
  templateMediaSamplePreviewUrl: string;
  templateBodyRef: RefObject<HTMLTextAreaElement | null>;
  templateBody: string;
  setTemplateBody: (value: string) => void;
  templateBodyLength: number;
  emojiMenuRef: RefObject<HTMLDivElement | null>;
  isEmojiMenuOpen: boolean;
  setIsEmojiMenuOpen: (updater: (current: boolean) => boolean) => void;
  handleInsertTemplateEmoji: (emoji: string) => void;
  handleInsertBodyTemplateToken: (tokenStart: string, tokenEnd?: string) => void;
  handleInsertVariable: () => void;
  templateVariables: string[];
  hasSubmittedTemplate: boolean;
  templateVariableSamples: Record<string, string>;
  handleTemplateVariableSampleChange: (variableId: string, value: string) => void;
  templateFooter: string;
  setTemplateFooter: (value: string) => void;
  templateFooterLength: number;
  templateButtons: TemplateButtonDraft[];
  handleRemoveTemplateButton: (buttonId: string) => void;
  handleTemplateButtonChange: (
    buttonId: string,
    field: keyof Omit<TemplateButtonDraft, "id">,
    value: string,
  ) => void;
  handleAddTemplateButton: () => void;
  templateAllowCategoryChange: boolean;
  setTemplateAllowCategoryChange: (value: boolean) => void;
  isSubmittingTemplate: boolean;
  previewHeader: string;
  previewBody: string;
  previewFooter: string;
  previewTemplateButtons: Array<Record<string, unknown>>;
  previewPayload: Record<string, unknown>;
};

function normalizeTemplateNameInput(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "");
}

export function CreateTemplateModal({
  isOpen,
  isEditing = false,
  onClose,
  handleCreateTemplate,
  templateName,
  setTemplateName,
  templateCategory,
  setTemplateCategory,
  templateLanguage,
  setTemplateLanguage,
  templateMediaSampleType,
  setTemplateMediaSampleType,
  setTemplateMediaSampleFile,
  templateHeader,
  setTemplateHeader,
  templateMediaSamplePreviewUrl,
  templateBodyRef,
  templateBody,
  setTemplateBody,
  templateBodyLength,
  emojiMenuRef,
  isEmojiMenuOpen,
  setIsEmojiMenuOpen,
  handleInsertTemplateEmoji,
  handleInsertBodyTemplateToken,
  handleInsertVariable,
  templateVariables,
  hasSubmittedTemplate,
  templateVariableSamples,
  handleTemplateVariableSampleChange,
  templateFooter,
  setTemplateFooter,
  templateFooterLength,
  templateButtons,
  handleRemoveTemplateButton,
  handleTemplateButtonChange,
  handleAddTemplateButton,
  templateAllowCategoryChange,
  setTemplateAllowCategoryChange,
  isSubmittingTemplate,
  previewHeader,
  previewBody,
  previewFooter,
  previewTemplateButtons,
  previewPayload,
}: CreateTemplateModalProps) {  if (!isOpen) return null;

  return (
              <div
                className="meta-template-create-modal-backdrop"
                onClick={onClose}
              >
                <article
                  className="meta-template-create-modal"
                  onClick={(event) => event.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="template-create-title"
                >
                  <header className="meta-template-create-modal-header">
                    <h4 id="template-create-title">
                      {isEditing ? "Editar template" : "Criar novo template"}
                    </h4>
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={onClose}
                    >
                      Fechar
                    </button>
                  </header>

                  <div className="meta-template-create-modal-content">
                    {isEditing ? (
                      <p className="meta-template-edit-notice">
                        Nome e idioma identificam o template e nao podem ser alterados. As demais
                        mudancas serao enviadas novamente para revisao da Meta.
                      </p>
                    ) : null}
                    <div className="meta-template-layout">
              <form className="meta-template-form" onSubmit={handleCreateTemplate}>
                <div className="meta-template-block">
                  <h4>1. Nome e idioma do modelo</h4>
                  <div className="meta-field-grid meta-field-grid--template-base">
                    <label>
                      Nome do modelo
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) =>
                          setTemplateName(normalizeTemplateNameInput(e.target.value))
                        }
                        placeholder="Ex.: Confirmacao_de_pedido"
                        pattern="[A-Za-z0-9_]+"
                        title="Use apenas letras, numeros e underline. Espacos serao convertidos para underline."
                        maxLength={512}
                        required
                        disabled={isEditing}
                      />
                      {/* <small className="meta-char-counter">{templateNameLength}/512</small> */}
                    </label>
                    <label>
                      Categoria
                      <select
                        value={templateCategory}
                        onChange={(e) => setTemplateCategory(e.target.value)}
                      >
                        <option value="UTILITY">Utilidade</option>
                        <option value="MARKETING">Marketing</option>
                        <option value="AUTHENTICATION">Autenticação</option>
                      </select>
                    </label>
                    <label>
                      Idioma
                      <select
                        value={templateLanguage}
                        onChange={(e) => setTemplateLanguage(e.target.value)}
                        disabled={isEditing}
                      >
                        <option value="en_US">Inglês</option>
                        <option value="pt_BR">Português (Pt_BR)</option>
                        <option value="es_MX">Espanhol (Mexico)</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="meta-template-block">
                  <h4>2. Conteudo</h4>
                  <div className="meta-field-grid meta-field-grid--template-content">
                    {/*  comentado temporariamente  <label>
                      Tipo de variavel
                      <select
                        value={templateVariableType}
                        onChange={(e) =>
                          setTemplateVariableType(e.target.value as TemplateVariableType)
                        }
                      >
                        <option value="NUMBER">Numero</option>
                      </select>
                    </label> */}
             <label>
                      Amostra de midia (opcional)
                      <select
                        value={templateMediaSampleType}
                        onChange={(e) => {
                          setTemplateMediaSampleType(
                            e.target.value as TemplateMediaSampleType,
                          );
                          setTemplateMediaSampleFile(null);
                        }}
                      >
                        <option value="NONE">Nenhum</option>
                        <option value="IMAGE">Imagem</option>
                        <option value="VIDEO">Video</option>
                        <option value="DOCUMENT">Documento</option>
                      </select>
                    </label> 
                    {templateMediaSampleType === "NONE" ? (
                      <label>
                        Cabeçalho (opcional)
                        <input
                          type="text"
                          value={templateHeader}
                          onChange={(e) => setTemplateHeader(e.target.value)}
                          maxLength={60}
                          placeholder="Adicione um cabeçalho..."
                        />
                      </label>
                    ) : (
                      <label>
                        Arquivo de amostra da mídia
                        <input
                          type="file"
                          accept={
                            templateMediaSampleType === "IMAGE"
                              ? "image/*"
                              : templateMediaSampleType === "VIDEO"
                                ? "video/*"
                                : ".pdf,application/pdf"
                          }
                          onChange={(e) =>
                            setTemplateMediaSampleFile(e.target.files?.[0] || null)
                          }
                          required
                        />
                        <small className="meta-helper-text">
                          WhatsApp exige amostra de mídia para aprovar template com header{" "}
                          {templateMediaSampleType.toLowerCase()}.
                        </small>
                      </label>
                    )}
                  </div>

                  {templateMediaSampleType === "IMAGE" && templateMediaSamplePreviewUrl ? (
                    <div className="meta-template-saved-header-preview">
                      <span>Preview da imagem de amostra</span>
                      <img
                        src={templateMediaSamplePreviewUrl}
                        alt="Preview da imagem de amostra do template"
                        className="meta-template-preview-bubble-media-image"
                      />
                    </div>
                  ) : null}

                  <label>
                    Corpo (principal)
                    <textarea
                      ref={templateBodyRef}
                      value={templateBody}
                      onChange={(e) => setTemplateBody(e.target.value)}
                      rows={5}
                      maxLength={1028}
                      placeholder="Digite o texto principal da mensagem"
                      required
                    />
                    <small className="meta-char-counter">{templateBodyLength}/1028</small>
                  </label>

                  <div className="meta-template-toolbar">
                    <div className="meta-template-emoji-menu" ref={emojiMenuRef}>
                      <button
                        type="button"
                        className="meta-secondary-button"
                        onClick={() => setIsEmojiMenuOpen((prev) => !prev)}
                      >
                        Emojis
                      </button>
                      {isEmojiMenuOpen && (
                        <div className="meta-template-emoji-popover">
                          {TEMPLATE_EMOJI_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="meta-template-emoji-button"
                              onClick={() => handleInsertTemplateEmoji(emoji)}
                              title={`Inserir ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={() => handleInsertBodyTemplateToken("*")}
                    >
                      Negrito (B)
                    </button>
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={() => handleInsertBodyTemplateToken("_")}
                    >
                      Italico (I)
                    </button>
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={() => handleInsertBodyTemplateToken("~")}
                    >
                      Tachado (S)
                    </button>
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={() => handleInsertBodyTemplateToken("```", "```")}
                    >
                      Codigo (&lt;/&gt;)
                    </button>
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={handleInsertVariable}
                    >
                      Adicionar variavel
                    </button>
                  </div>
                </div>

                <div className="meta-template-block">
                  <h4>3. Amostras de variaveis</h4>
                  {templateVariables.length === 0 ? (
                    <p>Nenhuma variavel detectada no conteudo.</p>
                  ) : (
                    <div className="meta-variable-samples-list">
                      {templateVariables.map((variableId) => {
                        const hasError =
                          hasSubmittedTemplate &&
                          !templateVariableSamples[variableId]?.trim();

                        return (
                          <label
                            key={variableId}
                            className={
                              hasError
                                ? "meta-variable-sample-field meta-variable-sample-field--error"
                                : "meta-variable-sample-field"
                            }
                          >
                            Campo da variavel: {`{{${variableId}}}`}
                            <input
                              type="text"
                              value={templateVariableSamples[variableId] || ""}
                              onChange={(e) =>
                                handleTemplateVariableSampleChange(
                                  variableId,
                                  e.target.value,
                                )
                              }
                              placeholder={`Insira conteudo para {{${variableId}}}`}
                              required
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {templateVariables.length > 0 && (
                    <small className="meta-helper-text">
                      Adicione texto de amostra para validar o template e gerar preview.
                    </small>
                  )}
                </div>

                <div className="meta-template-block">
                  <h4>4. Rodapé (opcional)</h4>
                  <label>
                    Rodapé
                    <input
                      type="text"
                      value={templateFooter}
                      onChange={(e) => setTemplateFooter(e.target.value)}
                      maxLength={60}
                      placeholder="Adicione uma pequena linha de texto a parte inferior..."
                    />
                    <small className="meta-char-counter">{templateFooterLength}/60</small>
                  </label>
                </div>

                <div className="meta-template-block">
                  <h4>5. Botões (opcional)</h4>
                  <div className="meta-template-buttons-list">
                    {templateButtons.map((button, index) => (
                      <div key={button.id} className="meta-template-button-card">
                        <div className="meta-template-button-card-header">
                          <strong>Botão {index + 1}</strong>
                          <button
                            type="button"
                            className="meta-secondary-button"
                            onClick={() => handleRemoveTemplateButton(button.id)}
                          >
                            Remover
                          </button>
                        </div>

                        <label>
                          Tipo
                          <select
                            value={button.type}
                            onChange={(e) =>
                              handleTemplateButtonChange(
                                button.id,
                                "type",
                                e.target.value,
                              )
                            }
                          >
                            {TEMPLATE_BUTTON_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          Texto
                          <input
                            type="text"
                            value={button.text}
                            onChange={(e) =>
                              handleTemplateButtonChange(
                                button.id,
                                "text",
                                e.target.value,
                              )
                            }
                            placeholder="Texto do botão (text)"
                          />
                        </label>

                        {button.type === "URL" && (
                          <label>
                            URL
                            <input
                              type="text"
                              value={button.url}
                              onChange={(e) =>
                                handleTemplateButtonChange(
                                  button.id,
                                  "url",
                                  e.target.value,
                                )
                              }
                              placeholder="https://exemplo.com/{{1}}"
                            />
                          </label>
                        )}

                        {button.type === "PHONE_NUMBER" && (
                          <label>
                            Número de telefone
                            <input
                              type="text"
                              value={button.phone_number}
                              onChange={(e) =>
                                handleTemplateButtonChange(
                                  button.id,
                                  "phone_number",
                                  e.target.value,
                                )
                              }
                              placeholder="5511999999999"
                            />
                          </label>
                        )}

                        <label>
                          Example (opcional)
                          <input
                            type="text"
                            value={button.example}
                            onChange={(e) =>
                              handleTemplateButtonChange(
                                button.id,
                                "example",
                                e.target.value,
                              )
                            }
                            placeholder='Ex.: ["VALOR"] ou texto simples'
                          />
                        </label>

                        <label>
                          Parâmetros extras em JSON (opcional)
                          <textarea
                            rows={3}
                            value={button.extraParamsJson}
                            onChange={(e) =>
                              handleTemplateButtonChange(
                                button.id,
                                "extraParamsJson",
                                e.target.value,
                              )
                            }
                            placeholder='Ex.: {"otp_type":"COPY_CODE","autofill_text":"Copiar"}'
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="meta-secondary-button meta-template-add-button"
                    onClick={handleAddTemplateButton}
                    disabled={templateButtons.length >= TEMPLATE_MAX_BUTTONS}
                  >
                    Adicionar botão
                  </button>
                </div>

                <label className="meta-template-checkbox">
                  <input
                    type="checkbox"
                    checked={templateAllowCategoryChange}
                    onChange={(e) =>
                      setTemplateAllowCategoryChange(e.target.checked)
                    }
                  />
                  <span>Permitir alteração automática de categoria</span>
                </label>
                <button
                  type="submit"
                  className="add-button"
                  disabled={isSubmittingTemplate}
                >
                  {isSubmittingTemplate
                    ? isEditing
                      ? "Salvando..."
                      : "Criando..."
                    : isEditing
                      ? "Salvar alteracoes"
                      : "Criar template"}
                </button>
              </form>

                      <aside className="meta-template-preview meta-template-preview--aside">
                <h4>Preview da mensagem</h4>
                <article className="meta-template-preview-card meta-template-preview-card--whatsapp">
                  <div className="meta-template-preview-chat-header">
                    <span>Conversa no WhatsApp</span>
                    <small>Agora</small>
                  </div>
                    <div className="meta-template-preview-chat-body">
                      <div className="meta-template-preview-message">
                        <div className="meta-template-preview-bubble meta-template-preview-bubble--outgoing">
                        {templateMediaSampleType === "IMAGE" && templateMediaSamplePreviewUrl ? (
                          <div className="meta-template-preview-bubble-media">
                            <img
                              src={templateMediaSamplePreviewUrl}
                              alt="Preview da imagem do header"
                              className="meta-template-preview-bubble-media-image"
                            />
                          </div>
                        ) : null}
                        {templateMediaSampleType === "NONE" && previewHeader && (
                          <p className="meta-template-preview-bubble-header">
                            {renderWhatsAppFormattedText(previewHeader)}
                          </p>
                        )}
                        <p className="meta-template-preview-bubble-body">
                          {previewBody
                            ? renderWhatsAppFormattedText(previewBody)
                            : "Seu texto principal aparecera aqui."}
                        </p>
                        {previewFooter && (
                          <p className="meta-template-preview-bubble-footer">
                            {renderWhatsAppFormattedText(previewFooter)}
                          </p>
                        )}
                      </div>
                      {previewTemplateButtons.length > 0 && (
                        <div className="meta-template-item-preview-buttons">
                          {previewTemplateButtons.map((button, index) => {
                            const buttonKey =
                              String(button.text || "").trim() ||
                              String(button.url || "").trim() ||
                              String(button.phone_number || "").trim() ||
                              `${String(button.type || "BUTTON")}-${index}`;

                            return (
                              <span
                                key={buttonKey}
                                className="meta-template-item-preview-button"
                              >
                                <FaExternalLinkAlt aria-hidden="true" />
                                <span>{getPreviewButtonLabel(button)}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
                <details>
                  <summary>Payload enviado ao backend</summary>
                  <pre>{JSON.stringify(previewPayload, null, 2)}</pre>
                </details>
              </aside>
                    </div>
                  </div>
                </article>
              </div>  );
}


