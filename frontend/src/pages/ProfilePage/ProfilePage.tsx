import { useEffect, useRef, useState } from "react";
import { FiCamera, FiEdit2, FiEye, FiEyeOff, FiSave, FiShield, FiTrash2 } from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Input } from "../../components/common/Input/Input";
import { PasswordChecklist } from "../../components/common/PasswordChecklist/PasswordChecklist";
import { Avatar } from "../../components/common/Avatar/Avatar";
import { Modal } from "../../components/common/Modal/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  changeMyPassword,
  deleteMyAccount,
  fetchMyProfile,
  removeMyProfilePhoto,
  saveMyProfile,
  uploadMyProfilePhoto,
  type MyProfile,
} from "../../service/profileService";
import { validatePasswordPolicy } from "../../utils/passwordPolicy";
import "./ProfilePage.css";

export function ProfilePage() {
  const { user, login, logout } = useAuth();
  const { addToast } = useToast();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isRemovePhotoModalOpen, setIsRemovePhotoModalOpen] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [photoDraftFile, setPhotoDraftFile] = useState<File | null>(null);
  const [photoDraftUrl, setPhotoDraftUrl] = useState<string | null>(null);
  const [photoOffsetX, setPhotoOffsetX] = useState(0);
  const [photoOffsetY, setPhotoOffsetY] = useState(0);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoImageSize, setPhotoImageSize] = useState({ width: 1, height: 1 });
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    return () => {
      if (photoDraftUrl) {
        URL.revokeObjectURL(photoDraftUrl);
      }
    };
  }, [photoDraftUrl]);

  const applyPhoneMask = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatEmpty = (value?: string | number | null) => {
    const normalized = String(value ?? "").trim();
    return normalized || "Nao informado";
  };

  const isProfileChanged =
    name.trim() !== (profile?.name || "").trim() ||
    email.trim() !== (profile?.email || "").trim() ||
    telefone.trim() !== (profile?.telefone || "").trim();

  const accessProfile = user?.is_master ? "Administrador" : "Usuario";
  const planName = user?.nome_plano || "Nao informado";

  const loadProfile = async () => {
    try {
      const nextProfile = await fetchMyProfile();
      setProfile(nextProfile);
      setName(nextProfile.name || "");
      setEmail(nextProfile.email || "");
      setTelefone(nextProfile.telefone || "");
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar perfil",
        description:
          error instanceof Error ? error.message : "Nao foi possivel carregar o perfil.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const refreshSessionAndProfile = async (sessionToken: string) => {
    await login(sessionToken);
    await loadProfile();
  };

  const openProfileModal = () => {
    setName(profile?.name || "");
    setEmail(profile?.email || "");
    setTelefone(profile?.telefone || "");
    setIsProfileModalOpen(true);
  };

  const closeProfileModal = () => {
    setName(profile?.name || "");
    setEmail(profile?.email || "");
    setTelefone(profile?.telefone || "");
    setIsProfileModalOpen(false);
  };

  const closePasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsPasswordModalOpen(false);
  };

  const closePhotoEditor = () => {
    if (photoDraftUrl) {
      URL.revokeObjectURL(photoDraftUrl);
    }
    photoDragRef.current = null;
    setPhotoDraftFile(null);
    setPhotoDraftUrl(null);
    setPhotoOffsetX(0);
    setPhotoOffsetY(0);
    setPhotoZoom(1);
    setPhotoImageSize({ width: 1, height: 1 });
    setIsPhotoDragging(false);
  };

  const getPhotoOffsetBounds = (zoom = photoZoom) => {
    const aspectRatio = photoImageSize.width / photoImageSize.height;
    const coverWidth = aspectRatio >= 1 ? aspectRatio : 1;
    const coverHeight = aspectRatio >= 1 ? 1 : 1 / aspectRatio;

    return {
      x: Math.max(0, ((coverWidth * zoom - 1) / 2) * 100),
      y: Math.max(0, ((coverHeight * zoom - 1) / 2) * 100),
    };
  };

  const clampPhotoOffset = (value: number, maxOffset: number) => {
    return Math.min(maxOffset, Math.max(-maxOffset, value));
  };

  const handlePhotoDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!photoDraftUrl || isUploadingPhoto) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    photoDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: photoOffsetX,
      originY: photoOffsetY,
    };
    setIsPhotoDragging(true);
  };

  const handlePhotoDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = photoDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const deltaX = ((event.clientX - dragState.startX) / rect.width) * 100;
    const deltaY = ((event.clientY - dragState.startY) / rect.height) * 100;
    const bounds = getPhotoOffsetBounds();

    setPhotoOffsetX(clampPhotoOffset(dragState.originX + deltaX, bounds.x));
    setPhotoOffsetY(clampPhotoOffset(dragState.originY + deltaY, bounds.y));
  };

  const handlePhotoDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (photoDragRef.current?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      photoDragRef.current = null;
      setIsPhotoDragging(false);
    }
  };

  const createAdjustedPhotoFile = async () => {
    if (!photoDraftFile || !photoDraftUrl) {
      throw new Error("Selecione uma foto antes de confirmar.");
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Nao foi possivel preparar a imagem selecionada."));
      nextImage.src = photoDraftUrl;
    });

    const outputSize = 512;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Nao foi possivel processar a imagem.");
    }

    const coverScale = Math.max(outputSize / image.naturalWidth, outputSize / image.naturalHeight);
    const adjustedScale = coverScale * photoZoom;
    const drawWidth = image.naturalWidth * adjustedScale;
    const drawHeight = image.naturalHeight * adjustedScale;
    const drawX = (outputSize - drawWidth) / 2 + outputSize * (photoOffsetX / 100);
    const drawY = (outputSize - drawHeight) / 2 + outputSize * (photoOffsetY / 100);

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputSize, outputSize);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      throw new Error("Nao foi possivel gerar a imagem ajustada.");
    }

    return new File([blob], "foto-perfil.jpg", { type: "image/jpeg" });
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isProfileChanged) return;

    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      addToast({
        type: "warning",
        title: "E-mail invalido",
        description: "Informe um e-mail valido para salvar o perfil.",
      });
      return;
    }

    setIsSavingProfile(true);

    try {
      const result = await saveMyProfile({
        name: name.trim(),
        email: normalizedEmail,
        telefone,
      });

      await refreshSessionAndProfile(result.sessionToken);
      setIsProfileModalOpen(false);
      addToast({
        type: "success",
        title: "Perfil atualizado",
        description: result.message,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao salvar perfil",
        description:
          error instanceof Error ? error.message : "Nao foi possivel salvar o perfil.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentPassword.trim()) {
      addToast({
        type: "warning",
        title: "Senha atual obrigatoria",
        description: "Informe sua senha atual para definir uma nova senha.",
      });
      return;
    }

    if (!newPassword.trim()) {
      addToast({
        type: "warning",
        title: "Nova senha obrigatoria",
        description: "Informe a nova senha desejada.",
      });
      return;
    }

    const passwordValidationMessage = validatePasswordPolicy(newPassword);
    if (passwordValidationMessage) {
      addToast({
        type: "warning",
        title: "Senha invalida",
        description: passwordValidationMessage,
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast({
        type: "warning",
        title: "Confirmacao diferente",
        description: "A confirmacao da nova senha precisa ser igual a senha informada.",
      });
      return;
    }

    setIsSavingPassword(true);

    try {
      const result = await changeMyPassword({
        currentPassword,
        newPassword,
      });

      await refreshSessionAndProfile(result.sessionToken);
      closePasswordModal();
      addToast({
        type: "success",
        title: "Senha atualizada",
        description: result.message,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao atualizar senha",
        description:
          error instanceof Error ? error.message : "Nao foi possivel atualizar a senha.",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast({
        type: "warning",
        title: "Arquivo invalido",
        description: "Selecione uma imagem para usar como foto de perfil.",
      });
      event.target.value = "";
      return;
    }

    if (photoDraftUrl) {
      URL.revokeObjectURL(photoDraftUrl);
    }

    setPhotoDraftFile(file);
    setPhotoDraftUrl(URL.createObjectURL(file));
    setPhotoOffsetX(0);
    setPhotoOffsetY(0);
    setPhotoZoom(1);
    setPhotoImageSize({ width: 1, height: 1 });
    event.target.value = "";
  };

  const handlePhotoZoomChange = (nextZoom: number) => {
    const bounds = getPhotoOffsetBounds(nextZoom);
    setPhotoZoom(nextZoom);
    setPhotoOffsetX((current) => clampPhotoOffset(current, bounds.x));
    setPhotoOffsetY((current) => clampPhotoOffset(current, bounds.y));
  };

  const handleConfirmPhoto = async () => {
    if (!photoDraftFile) return;

    setIsUploadingPhoto(true);
    try {
      const adjustedFile = await createAdjustedPhotoFile();
      const result = await uploadMyProfilePhoto(adjustedFile);
      await refreshSessionAndProfile(result.sessionToken);
      closePhotoEditor();
      addToast({
        type: "success",
        title: "Foto atualizada",
        description: result.message,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao enviar foto",
        description:
          error instanceof Error ? error.message : "Nao foi possivel enviar a foto de perfil.",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploadingPhoto(true);
    try {
      const result = await removeMyProfilePhoto();
      await refreshSessionAndProfile(result.sessionToken);
      setIsRemovePhotoModalOpen(false);
      addToast({
        type: "success",
        title: "Foto removida",
        description: result.message,
      });
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao remover foto",
        description:
          error instanceof Error ? error.message : "Nao foi possivel remover a foto de perfil.",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const closeDeleteAccountModal = () => {
    if (isDeletingAccount) return;
    setDeleteAccountPassword("");
    setIsDeleteAccountModalOpen(false);
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountPassword.trim()) {
      addToast({
        type: "error",
        title: "Informe sua senha",
        description: "A senha atual e obrigatoria para confirmar a exclusao.",
      });
      return;
    }
    setIsDeletingAccount(true);
    try {
      const result = await deleteMyAccount(deleteAccountPassword);
      addToast({ type: "success", title: "Conta excluida", description: result.message });
      logout();
    } catch (error) {
      addToast({
        type: "error",
        title: "Nao foi possivel excluir",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde.",
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const avatarName = profile?.name || user?.name || "Perfil";
  const avatarUrl = profile?.foto_perfil_url || user?.foto_perfil_url || null;
  const personalInfo = [
    { label: "Nome", value: profile?.name || user?.name },
    { label: "E-mail", value: profile?.email || user?.email },
    { label: "Telefone", value: profile?.telefone || user?.telefone },
    { label: "Perfil de acesso", value: accessProfile },
    { label: "Plano", value: planName },
    { label: "Empresa", value: null },
  ];

  return (
    <div className="profile-page">
      <MobileHeader title="Perfil" />

      <header className="profile-page__header desktop-only">
        <div className="profile-page__header-content">
          <h1>Meu perfil</h1>
          <p>Gerencie suas informações pessoais e configurações de segurança.</p>
        </div>
      </header>

      <div className="profile-page__container">
        <section className="profile-page__identity-card">
          <div className="profile-page__identity-main">
            <Avatar
              name={avatarName}
              imageUrl={avatarUrl}
              size="medium"
              className="profile-page__avatar"
            />

            <div className="profile-page__identity-text">
              <h2>{formatEmpty(profile?.name || user?.name)}</h2>
              <p>{accessProfile}</p>
              <span>{formatEmpty(profile?.email || user?.email)}</span>
            </div>
          </div>

          <div className="profile-page__photo-menu">
            <button
              type="button"
              className="profile-page__secondary-button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploadingPhoto}
            >
              <FiCamera size={16} />
              {isUploadingPhoto ? "Enviando..." : "Alterar foto"}
            </button>

            {avatarUrl ? (
              <button
                type="button"
                className="profile-page__text-danger-button"
                onClick={() => setIsRemovePhotoModalOpen(true)}
                disabled={isUploadingPhoto}
              >
                <FiTrash2 size={16} />
                Remover
              </button>
            ) : null}
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="profile-page__file-input"
            onChange={(event) => void handlePhotoSelect(event)}
          />
        </section>

      <main className="profile-page__content">
        <section className="profile-page__card">
          <div className="profile-page__card-header">
            <h2>Informações pessoais</h2>
            <button
              type="button"
              className="profile-page__secondary-button"
              onClick={openProfileModal}
              disabled={isLoading}
            >
              <FiEdit2 size={16} />
              Editar
            </button>
          </div>

          {isLoading ? (
            <p className="profile-page__loading">Carregando perfil...</p>
          ) : (
            <div className="profile-page__info-grid">
              {personalInfo.map((item) => (
                <div className="profile-page__info-item" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{formatEmpty(item.value)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="profile-page__card">
          <div className="profile-page__card-header">
            <h2>Segurança</h2>
            <button
              type="button"
              className="profile-page__secondary-button"
              onClick={() => setIsPasswordModalOpen(true)}
            >
              <FiShield size={16} />
              Alterar senha
            </button>
          </div>

          <div className="profile-page__security-list">
            <div className="profile-page__info-item">
              <span>Senha</span>
              <strong>Proteja sua conta utilizando uma senha segura.</strong>
            </div>
            <div className="profile-page__info-item">
              <span>Ultima alteração</span>
              <strong>Data da ultima alteração indisponivel.</strong>
            </div>
          </div>
        </section>

        <section className="profile-page__card profile-page__danger-zone">
          <div className="profile-page__card-header">
            <div>
              <h2>Excluir minha conta</h2>
              <p className="profile-page__helper-text">
                Esta acao desativa seu acesso e anonimiza permanentemente seus dados pessoais.
              </p>
            </div>
            <button
              type="button"
              className="profile-page__danger-button"
              onClick={() => setIsDeleteAccountModalOpen(true)}
            >
              <FiTrash2 size={16} />
              Excluir conta
            </button>
          </div>
        </section>
      </main>
      </div>

      <Modal
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        title="Editar informações pessoais"
        size="sm"
      >
        <form className="profile-page__modal-form" onSubmit={handleSaveProfile}>
          <Input
            label="Nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            label="Telefone"
            type="tel"
            value={telefone}
            onChange={(event) => setTelefone(applyPhoneMask(event.target.value))}
          />

          <div className="profile-page__modal-actions">
            <button
              type="button"
              className="profile-page__secondary-button"
              onClick={closeProfileModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="profile-page__primary-button"
              disabled={isSavingProfile || !isProfileChanged}
            >
              <FiSave size={16} />
              {isSavingProfile ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isPasswordModalOpen}
        onClose={closePasswordModal}
        title="Alterar senha"
        size="sm"
      >
        <form className="profile-page__modal-form" onSubmit={handleSavePassword}>
          <p className="profile-page__helper-text">
            Por segurança, informe sua senha atual antes de definir uma nova senha.
          </p>

          <label className="profile-page__password-field">
            <span>Senha atual</span>
            <div>
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((value) => !value)}
                aria-label={showCurrentPassword ? "Ocultar senha atual" : "Mostrar senha atual"}
              >
                {showCurrentPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </label>

          <label className="profile-page__password-field">
            <span>Nova senha</span>
            <div>
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((value) => !value)}
                aria-label={showNewPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
              >
                {showNewPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </label>

          <label className="profile-page__password-field">
            <span>Confirmar nova senha</span>
            <div>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={showConfirmPassword ? "Ocultar confirmacao" : "Mostrar confirmacao"}
              >
                {showConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </label>

          {newPassword ? <PasswordChecklist password={newPassword} /> : null}

          {confirmPassword && newPassword !== confirmPassword ? (
            <p className="profile-page__field-error">A confirmacao precisa ser igual a nova senha.</p>
          ) : null}

          <div className="profile-page__modal-actions">
            <button
              type="button"
              className="profile-page__secondary-button"
              onClick={closePasswordModal}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="profile-page__primary-button"
              disabled={isSavingPassword}
            >
              <FiShield size={16} />
              {isSavingPassword ? "Atualizando..." : "Atualizar senha"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(photoDraftUrl)}
        onClose={closePhotoEditor}
        title="Ajustar foto de perfil"
        size="sm"
      >
        <div className="profile-page__photo-editor">
          <div
            className={`profile-page__photo-preview-frame${isPhotoDragging ? " is-dragging" : ""}`}
            aria-label="Previa da foto ajustada"
            onPointerDown={handlePhotoDragStart}
            onPointerMove={handlePhotoDragMove}
            onPointerUp={handlePhotoDragEnd}
            onPointerCancel={handlePhotoDragEnd}
          >
            {photoDraftUrl ? (
              <img
                src={photoDraftUrl}
                alt="Previa da foto selecionada"
                draggable={false}
                onLoad={(event) => {
                  setPhotoImageSize({
                    width: event.currentTarget.naturalWidth || 1,
                    height: event.currentTarget.naturalHeight || 1,
                  });
                }}
                style={{
                  transform: `translate(${photoOffsetX}%, ${photoOffsetY}%) scale(${photoZoom})`,
                }}
              />
            ) : null}
          </div>
          <p className="profile-page__photo-drag-hint">Arraste a foto para ajustar o enquadramento.</p>

          <div className="profile-page__photo-controls">
            <label>
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.05"
                value={photoZoom}
                onChange={(event) => handlePhotoZoomChange(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="profile-page__modal-actions">
            <button
              type="button"
              className="profile-page__secondary-button"
              onClick={() => {
                setPhotoOffsetX(0);
                setPhotoOffsetY(0);
                setPhotoZoom(1);
              }}
              disabled={isUploadingPhoto}
            >
              Centralizar
            </button>
            <button
              type="button"
              className="profile-page__secondary-button"
              onClick={closePhotoEditor}
              disabled={isUploadingPhoto}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="profile-page__primary-button"
              onClick={() => void handleConfirmPhoto()}
              disabled={isUploadingPhoto}
            >
              <FiSave size={16} />
              {isUploadingPhoto ? "Aplicando..." : "Aplicar foto"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteAccountModalOpen}
        onClose={closeDeleteAccountModal}
        title="Excluir minha conta?"
        size="sm"
      >
        <div className="profile-page__confirm">
          <p>
            Seus dados pessoais serao anonimizados e esta acao nao podera ser desfeita.
            Informe sua senha atual para continuar.
          </p>
          <Input
            label="Senha atual"
            type="password"
            value={deleteAccountPassword}
            onChange={(event) => setDeleteAccountPassword(event.target.value)}
            autoComplete="current-password"
          />
          <div className="profile-page__modal-actions">
            <button type="button" className="profile-page__secondary-button" onClick={closeDeleteAccountModal}>
              Voltar
            </button>
            <button
              type="button"
              className="profile-page__danger-button"
              onClick={() => void handleDeleteAccount()}
              disabled={isDeletingAccount || !deleteAccountPassword.trim()}
            >
              <FiTrash2 size={16} />
              {isDeletingAccount ? "Excluindo..." : "Excluir definitivamente"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isRemovePhotoModalOpen}
        onClose={() => setIsRemovePhotoModalOpen(false)}
        title="Remover foto de perfil?"
        size="sm"
      >
        <div className="profile-page__confirm">
          <p>Sua foto atual sera substituida pelo avatar padrao.</p>
          <div className="profile-page__modal-actions">
            <button
              type="button"
              className="profile-page__secondary-button"
              onClick={() => setIsRemovePhotoModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="profile-page__danger-button"
              onClick={() => void handleRemovePhoto()}
              disabled={isUploadingPhoto}
            >
              <FiTrash2 size={16} />
              {isUploadingPhoto ? "Removendo..." : "Remover foto"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
