import type { MetaIntegrationAccount, WhatsAppProfileData } from "../../service/metaService";
import type { WhatsAppProfileDraft } from "./MetaApiManagement.helpers";

type WhatsAppProfileSectionProps = {
  currentWhatsAppProfilePictureUrl: string;
  whatsAppProfileDraft: WhatsAppProfileDraft;
  selectedMetaAccountLabel: string;
  selectedMetaAccount: MetaIntegrationAccount | null;
  fetchWhatsAppProfile: () => void | Promise<void>;
  handleSaveWhatsAppProfile: () => void | Promise<void>;
  isLoadingWhatsAppProfile: boolean;
  isSavingWhatsAppProfile: boolean;
  whatsAppProfileError: string;
  whatsAppProfile: WhatsAppProfileData | null;
  setWhatsAppProfilePictureFile: (file: File | null) => void;
  handleWhatsAppProfileFieldChange: (field: keyof WhatsAppProfileDraft, value: string) => void;
};

export function WhatsAppProfileSection({
  currentWhatsAppProfilePictureUrl,
  whatsAppProfileDraft,
  selectedMetaAccountLabel,
  selectedMetaAccount,
  fetchWhatsAppProfile,
  handleSaveWhatsAppProfile,
  isLoadingWhatsAppProfile,
  isSavingWhatsAppProfile,
  whatsAppProfileError,
  whatsAppProfile,
  setWhatsAppProfilePictureFile,
  handleWhatsAppProfileFieldChange,
}: WhatsAppProfileSectionProps) {  return (
            <section className="meta-config-section">
              <div className="meta-whatsapp-profile-shell">
                <div className="meta-whatsapp-profile-hero">
                  <div className="meta-whatsapp-profile-hero__identity">
                    <div className="meta-whatsapp-profile-avatar">
                      {currentWhatsAppProfilePictureUrl ? (
                        <img
                          src={currentWhatsAppProfilePictureUrl}
                          alt={`Foto de perfil de ${whatsAppProfileDraft.displayName || selectedMetaAccountLabel}`}
                        />
                      ) : (
                        <span>
                          {(whatsAppProfileDraft.displayName || selectedMetaAccountLabel)
                            .trim()
                            .slice(0, 2)
                            .toUpperCase() || "WA"}
                        </span>
                      )}
                    </div>
                    <div className="meta-whatsapp-profile-hero__copy">
                      <span className="api-meta-eyebrow">Perfil comercial do WhatsApp</span>
                      <h3>{whatsAppProfileDraft.displayName || selectedMetaAccountLabel}</h3>
                      <p>
                        Conta atual: <strong>{selectedMetaAccountLabel}</strong>. O nome de
                        exibição continua somente leitura; foto, descrição, site, email e
                        localização podem ser ajustados abaixo.
                      </p>
                      <div className="meta-whatsapp-profile-pill-row">
                        <span>{whatsAppProfileDraft.displayPhoneNumber || "Número não informado"}</span>
                        <span>ID {selectedMetaAccount?.phone_number_id || "-"}</span>
                        <span>WABA {selectedMetaAccount?.whatsapp_account_id || "-"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="meta-template-actions">
                    <button
                      type="button"
                      className="meta-secondary-button"
                      onClick={() => void fetchWhatsAppProfile()}
                      disabled={isLoadingWhatsAppProfile || isSavingWhatsAppProfile}
                    >
                      {isLoadingWhatsAppProfile ? "Atualizando..." : "Recarregar perfil"}
                    </button>
                    <button
                      type="button"
                      className="add-button"
                      onClick={() => void handleSaveWhatsAppProfile()}
                      disabled={isSavingWhatsAppProfile}
                    >
                      {isSavingWhatsAppProfile ? "Salvando..." : "Salvar perfil"}
                    </button>
                  </div>
                </div>

                {whatsAppProfileError ? (
                  <p className="meta-template-metrics-error">{whatsAppProfileError}</p>
                ) : null}

                {isLoadingWhatsAppProfile && !whatsAppProfile ? (
                  <div className="meta-template-block">
                    <p>Carregando perfil comercial do WhatsApp...</p>
                  </div>
                ) : (
                  <div className="meta-whatsapp-profile-layout">
                    <aside className="meta-whatsapp-profile-preview">
                      <div className="meta-whatsapp-profile-preview-card">
                        <div className="meta-whatsapp-profile-preview-card__top">
                          <div className="meta-whatsapp-profile-avatar meta-whatsapp-profile-avatar--small">
                            {currentWhatsAppProfilePictureUrl ? (
                              <img
                                src={currentWhatsAppProfilePictureUrl}
                                alt={`Preview do perfil de ${whatsAppProfileDraft.displayName || selectedMetaAccountLabel}`}
                              />
                            ) : (
                              <span>
                                {(whatsAppProfileDraft.displayName || selectedMetaAccountLabel)
                                  .trim()
                                  .slice(0, 2)
                                  .toUpperCase() || "WA"}
                              </span>
                            )}
                          </div>
                          <div>
                            <strong>{whatsAppProfileDraft.displayName || selectedMetaAccountLabel}</strong>
                            <p>{whatsAppProfileDraft.displayPhoneNumber || "Numero comercial"}</p>
                          </div>
                        </div>

                        <div className="meta-whatsapp-profile-preview-card__section">
                          <span>Sobre</span>
                          <p>{whatsAppProfileDraft.about || "Sem texto configurado."}</p>
                        </div>

                        <div className="meta-whatsapp-profile-preview-card__section">
                          <span>Descrição</span>
                          <p>{whatsAppProfileDraft.description || "Sem descrição configurada."}</p>
                        </div>

                        <div className="meta-whatsapp-profile-preview-card__section">
                          <span>Endereço</span>
                          <p>{whatsAppProfileDraft.address || "Sem endereço configurado."}</p>
                        </div>

                        <div className="meta-whatsapp-profile-preview-card__section">
                          <span>Email</span>
                          <p>{whatsAppProfileDraft.email || "Sem email configurado."}</p>
                        </div>

                        <div className="meta-whatsapp-profile-preview-card__section">
                          <span>Sites</span>
                          {whatsAppProfileDraft.websites.trim() ? (
                            <ul className="meta-whatsapp-profile-links">
                              {whatsAppProfileDraft.websites
                                .split(/\r?\n/)
                                .map((website) => website.trim())
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((website) => (
                                  <li key={website}>{website}</li>
                                ))}
                            </ul>
                          ) : (
                            <p>Sem links configurados.</p>
                          )}
                        </div>
                      </div>
                    </aside>

                    <form
                      className="meta-template-form meta-whatsapp-profile-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleSaveWhatsAppProfile();
                      }}
                    >
                      <div className="meta-template-block">
                        <h4>Identidade da conta</h4>
                        <div className="meta-field-grid meta-field-grid--template-base">
                          <label className="meta-template-ops-field">
                            Nome de exibição
                            <input
                              type="text"
                              value={whatsAppProfileDraft.displayName}
                              readOnly
                              disabled
                            />
                            <small className="meta-helper-text">
                              O nome de exibição e controlado pela Meta e nao pode ser alterado aqui.
                            </small>
                          </label>
                          <label className="meta-template-ops-field">
                            Número exibido
                            <input
                              type="text"
                              value={whatsAppProfileDraft.displayPhoneNumber}
                              readOnly
                              disabled
                            />
                          </label>
                          <label className="meta-template-ops-upload">
                            Foto de perfil
                            <input
                              className="meta-template-ops-file-input"
                              type="file"
                              accept=".jpg,.jpeg,image/jpeg"
                              onChange={(event) =>
                                setWhatsAppProfilePictureFile(event.target.files?.[0] || null)
                              }
                            />
                            <small className="meta-helper-text">
                              Envie uma imagem JPG/JPEG para trocar a foto publica do número.
                            </small>
                          </label>
                        </div>
                      </div>

                      <div className="meta-template-block">
                        <h4>Informações publicas</h4>
                        <div className="meta-field-grid meta-field-grid--template-content">
                          <label className="meta-template-ops-field">
                            Sobre
                            <input
                              type="text"
                              maxLength={139}
                              value={whatsAppProfileDraft.about}
                              onChange={(event) =>
                                handleWhatsAppProfileFieldChange("about", event.target.value)
                              }
                              placeholder="Texto curto abaixo da foto"
                            />
                          </label>
                          <label className="meta-template-ops-field">
                            Categoria / vertical
                            <input
                              type="text"
                              value={whatsAppProfileDraft.vertical}
                              readOnly
                              disabled
                            />
                            <small className="meta-helper-text">
                              A categoria da conta tambem e definida pela Meta e nao pode ser alterada aqui.
                            </small>
                          </label>
                          <label className="meta-template-ops-field">
                            Email
                            <input
                              type="email"
                              value={whatsAppProfileDraft.email}
                              onChange={(event) =>
                                handleWhatsAppProfileFieldChange("email", event.target.value)
                              }
                              placeholder="contato@suaempresa.com"
                            />
                          </label>
                        </div>

                        <label className="meta-template-ops-field">
                          Descrição
                          <textarea
                            className="meta-template-ops-textarea"
                            rows={4}
                            maxLength={512}
                            value={whatsAppProfileDraft.description}
                            onChange={(event) =>
                              handleWhatsAppProfileFieldChange(
                                "description",
                                event.target.value,
                              )
                            }
                            placeholder="Descreva a empresa como no perfil da Meta"
                          />
                        </label>

                        <label className="meta-template-ops-field">
                          Localização / endereço
                          <textarea
                            className="meta-template-ops-textarea"
                            rows={3}
                            maxLength={256}
                            value={whatsAppProfileDraft.address}
                            onChange={(event) =>
                              handleWhatsAppProfileFieldChange("address", event.target.value)
                            }
                            placeholder="Rua, numero, bairro, cidade, estado..."
                          />
                        </label>

                        <label className="meta-template-ops-field">
                          Sites
                          <textarea
                            className="meta-template-ops-textarea"
                            rows={3}
                            value={whatsAppProfileDraft.websites}
                            onChange={(event) =>
                              handleWhatsAppProfileFieldChange("websites", event.target.value)
                            }
                            placeholder={"https://seusite.com\nhttps://instagram.com/suaempresa"}
                          />
                          <small className="meta-helper-text">
                            Informe ate 2 links, um por linha.
                          </small>
                        </label>
                      </div>

                      <div className="meta-template-actions meta-whatsapp-profile-form__actions">
                        <button
                          type="submit"
                          className="add-button"
                          disabled={isSavingWhatsAppProfile}
                        >
                          {isSavingWhatsAppProfile ? "Salvando..." : "Salvar alteracoes"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </section>  );
}

