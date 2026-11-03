import { FaExternalLinkAlt } from "react-icons/fa";
import { FiArchive } from "react-icons/fi";
import type { MetaTemplateItem } from "../../service/metaService";
import {
  extractTemplateTexts,
  getPreviewButtonLabel,
  getTemplateSavedHeaderImageUrl,
  normalizeTemplateCategory,
  normalizeTemplateStatus,
  renderWhatsAppFormattedText,
} from "./MetaApiManagement.helpers";

type TemplateListCardProps = {
  template: MetaTemplateItem;
  onOpen: (template: MetaTemplateItem) => void | Promise<void>;
  onEdit: (template: MetaTemplateItem) => void;
  onArchive: (template: MetaTemplateItem) => void;
  isArchiving?: boolean;
};

export function TemplateListCard({
  template,
  onOpen,
  onEdit,
  onArchive,
  isArchiving = false,
}: TemplateListCardProps) {  return (
    <article
                                            className="meta-template-item meta-template-item--interactive"
                      role="button"
                      tabIndex={0}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void onOpen(template)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void onOpen(template);
                        }
                      }}
                    >
                      {(() => {
                        const componentTexts = extractTemplateTexts(template);
                        const savedHeaderImageUrl = getTemplateSavedHeaderImageUrl(template);
                        return (
                          <>
                            <div className="meta-template-item-meta">
                              <p>
                                <strong>Nome: {template.name || "Sem nome"}</strong>
                              </p>
                              <p>
                                <strong>Status:</strong>{" "}
                                {normalizeTemplateStatus(template.status)}
                              </p>
                              <p>
                                <strong>Categoria:</strong>{" "}
                                {normalizeTemplateCategory(template.category)}
                              </p>
                              <p>
                                <strong>Idioma:</strong> {template.language || "-"}
                              </p>
                            </div>

                            <div className="meta-template-item-preview">
                              <article className="meta-template-preview-card meta-template-preview-card--whatsapp meta-template-item-preview-whatsapp">
                                <div className="meta-template-preview-chat-header">
                                  <span>Conversa no WhatsApp</span>
                                  <small>Template</small>
                                </div>
                                <div className="meta-template-preview-chat-body">
                                  <div className="meta-template-preview-message meta-template-item-preview-message">
                                    <div className="meta-template-preview-bubble meta-template-preview-bubble--outgoing">
                                      {savedHeaderImageUrl && (
                                        <div className="meta-template-preview-bubble-media">
                                          <img
                                            src={savedHeaderImageUrl}
                                            alt={`Preview do header do template ${template.name || "template"}`}
                                            className="meta-template-preview-bubble-media-image"
                                            loading="lazy"
                                          />
                                        </div>
                                      )}
                                      {componentTexts.header && (
                                        <p className="meta-template-preview-bubble-header">
                                          {renderWhatsAppFormattedText(componentTexts.header)}
                                        </p>
                                      )}
                                      <p className="meta-template-preview-bubble-body">
                                        {componentTexts.body
                                          ? renderWhatsAppFormattedText(componentTexts.body)
                                          : "Seu texto principal aparecera aqui."}
                                      </p>
                                      {componentTexts.footer && (
                                        <p className="meta-template-preview-bubble-footer">
                                          {renderWhatsAppFormattedText(componentTexts.footer)}
                                        </p>
                                      )}
                                    </div>
                                    {componentTexts.buttons.length > 0 && (
                                      <div className="meta-template-item-preview-buttons">
                                        {componentTexts.buttons.map((button, buttonIndex) => {
                                          const buttonKey =
                                            String(button.text || "").trim() ||
                                            String(button.url || "").trim() ||
                                            String(button.phone_number || "").trim() ||
                                            `${String(button.type || "BUTTON")}-${buttonIndex}`;

                                          return (
                                            <span
                                              key={`${template.id || template.name || "template"}-${buttonKey}`}
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
                            </div>
                            <span className="meta-template-card-footer">
                              <span className="meta-template-card-cta">
                                Abrir template
                              </span>
                              <span className="meta-template-card-actions">
                                <button
                                  type="button"
                                  className="meta-secondary-button meta-template-card-edit-button"
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onEdit(template);
                                  }}
                                  disabled={isArchiving}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="meta-template-card-archive-button"
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onArchive(template);
                                  }}
                                  disabled={isArchiving}
                                  aria-label={`Arquivar template ${template.name || "sem nome"}`}
                                  title="Arquivar template"
                                >
                                  <FiArchive aria-hidden="true" />
                                  {isArchiving ? "Arquivando..." : "Arquivar"}
                                </button>
                              </span>
                            </span>
                          </>
                        );
                      })()}
                    </article>
  );
}




