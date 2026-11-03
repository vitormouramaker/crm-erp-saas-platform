import { useState, useEffect } from "react";
import { Input } from "../common/Input/Input";
import { PasswordChecklist } from "../common/PasswordChecklist/PasswordChecklist";
import { PERMISSION_GROUPS } from "../../config/permissionCatalog";
import type { MetaIntegrationAccount } from "../../service/metaService";
import { validatePasswordPolicy } from "../../utils/passwordPolicy";
import "./UserForm.css";

export interface UserData {
  id?: number;
  name: string;
  email: string;
  telefone?: string;
  filial_id?: number | null;
  filial_nome?: string | null;
  password?: string;
  permissions: string[];
  is_master?: boolean;
  allowed_meta_param_ids?: number[];
  allowed_meta_numbers?: MetaIntegrationAccount[];
  cor_atendimento?: string | null;
}

type UserBranchOption = {
  id: number;
  name: string;
  isPrimary?: boolean;
};

interface UserFormProps {
  onSave: (data: UserData) => void;
  onCancel: () => void;
  initialData?: UserData | null;
  grantablePermissions?: string[];
  availableMetaNumbers?: MetaIntegrationAccount[];
  availableBranches?: UserBranchOption[];
}

const CONTACTS_VIEW_PERMISSION = "contacts.view";
const CONTACTS_VIEW_ALL_PERMISSION = "contacts.view_all";
const CHAT_VIEW_PERMISSION = "chat.view";
const CHAT_VIEW_ALL_MESSAGES_PERMISSION = "chat.view_all_messages";
const CHAT_MANAGER_PERMISSION = "chat.manager";

export function UserForm({
  onSave,
  onCancel,
  initialData,
  grantablePermissions,
  availableMetaNumbers = [],
  availableBranches = [],
}: UserFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [filialId, setFilialId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedMetaParamIds, setSelectedMetaParamIds] = useState<number[]>([]);
  const [useCustomAttendanceColor, setUseCustomAttendanceColor] = useState(false);
  const [attendanceColor, setAttendanceColor] = useState("#2563EB");

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) => {
      if (key === CONTACTS_VIEW_PERMISSION) {
        if (prev.includes(key)) {
          return prev.filter(
            (permission) =>
              permission !== CONTACTS_VIEW_PERMISSION &&
              permission !== CONTACTS_VIEW_ALL_PERMISSION
          );
        }

        return [...prev, key];
      }

      if (key === CONTACTS_VIEW_ALL_PERMISSION) {
        if (!prev.includes(CONTACTS_VIEW_PERMISSION)) {
          return prev;
        }

        return prev.includes(key)
          ? prev.filter((permission) => permission !== key)
          : [...prev, key];
      }

      if (key === CHAT_VIEW_PERMISSION) {
        if (prev.includes(key)) {
          return prev.filter(
            (permission) =>
              permission !== CHAT_VIEW_PERMISSION &&
              permission !== CHAT_VIEW_ALL_MESSAGES_PERMISSION &&
              permission !== CHAT_MANAGER_PERMISSION
          );
        }

        return [...prev, key];
      }

      if (key === CHAT_VIEW_ALL_MESSAGES_PERMISSION) {
        if (!prev.includes(CHAT_VIEW_PERMISSION)) {
          return prev;
        }

        return prev.includes(key)
          ? prev.filter((permission) => permission !== key)
          : [...prev, key];
      }

      if (key === CHAT_MANAGER_PERMISSION) {
        if (prev.includes(key)) {
          return prev.filter((permission) => permission !== key);
        }

        const nextPermissions = new Set(prev);
        nextPermissions.add(CHAT_VIEW_PERMISSION);
        nextPermissions.add(CHAT_VIEW_ALL_MESSAGES_PERMISSION);
        nextPermissions.add(CHAT_MANAGER_PERMISSION);
        return Array.from(nextPermissions);
      }

      return prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key];
    });
  };

  const toggleMetaNumber = (metaParamId: number) => {
    setSelectedMetaParamIds((prev) =>
      prev.includes(metaParamId)
        ? prev.filter((item) => item !== metaParamId)
        : [...prev, metaParamId]
    );
  };

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setEmail(initialData.email);
      setTelefone(initialData.telefone || "");
      setFilialId(
        initialData.filial_id ? String(initialData.filial_id) : ""
      );
      setSelectedPermissions(initialData.permissions || []);
      setSelectedMetaParamIds(initialData.allowed_meta_param_ids || []);
      setUseCustomAttendanceColor(Boolean(initialData.cor_atendimento));
      setAttendanceColor(initialData.cor_atendimento || "#2563EB");
      setPassword("");
      setPasswordError("");
    } else {
      setName("");
      setEmail("");
      setTelefone("");
      setFilialId("");
      setPassword("");
      setPasswordError("");
      setSelectedPermissions([]);
      setSelectedMetaParamIds([]);
      setUseCustomAttendanceColor(false);
      setAttendanceColor("#2563EB");
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password) {
      const validationMessage = validatePasswordPolicy(password);
      if (validationMessage) {
        setPasswordError(validationMessage);
        return;
      }
    }

    setPasswordError("");

    const payload: UserData = {
      name,
      email,
      telefone,
      filial_id: filialId ? Number(filialId) : null,
      permissions: selectedPermissions,
      allowed_meta_param_ids: initialData?.is_master ? [] : selectedMetaParamIds,
      cor_atendimento: useCustomAttendanceColor ? attendanceColor : null,
    };

    if (password) payload.password = password;
    if (initialData?.id) payload.id = initialData.id;

    onSave(payload);
  };

  const grantableSet = grantablePermissions ? new Set(grantablePermissions) : null;

  const visibleGroups = PERMISSION_GROUPS
    .map((group) => {
      const perms = grantableSet
        ? group.permissions.filter((p) => grantableSet.has(p.key))
        : group.permissions;

      return { ...group, permissions: perms };
    })
    .filter((g) => g.permissions.length > 0);

  const outOfScopePermissions =
    grantableSet && initialData?.permissions?.length
      ? initialData.permissions.filter((p) => !grantableSet.has(p))
      : [];

  const isMasterUser = Boolean(initialData?.is_master);
  const hasContactsAccess = selectedPermissions.includes(CONTACTS_VIEW_PERMISSION);
  const canViewAllContacts = selectedPermissions.includes(CONTACTS_VIEW_ALL_PERMISSION);
  const hasChatAccess = selectedPermissions.includes(CHAT_VIEW_PERMISSION);
  const hasChatManager = selectedPermissions.includes(CHAT_MANAGER_PERMISSION);
  const canViewAllChatMessages =
    hasChatManager || selectedPermissions.includes(CHAT_VIEW_ALL_MESSAGES_PERMISSION);

  return (
    <form onSubmit={handleSubmit} className="user-form">
      <Input
        label="Nome Completo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <Input
        label="E-mail de Acesso"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <Input
        label="Telefone"
        type="tel"
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
      />

      <div className="input-wrapper">
        <label htmlFor="user-filial-select">Filial vinculada</label>
        <select
          id="user-filial-select"
          className="input-field"
          value={filialId}
          onChange={(event) => setFilialId(event.target.value)}
        >
          <option value="">Sem filial vinculada</option>
          {availableBranches.map((branch) => (
            <option key={branch.id} value={String(branch.id)}>
              {branch.name}
              {branch.isPrimary ? " (Principal)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="attendance-color-field">
        <div className="attendance-color-field__copy">
          <label htmlFor="user-custom-attendance-color">Cor do atendente no chat</label>
          <span>
            Identifica este atendente nos cards em atendimento. Sem uma cor definida,
            o sistema gera uma cor automaticamente pelo ID do usuario.
          </span>
        </div>
        <label className="attendance-color-field__toggle" htmlFor="user-custom-attendance-color">
          <input
            id="user-custom-attendance-color"
            type="checkbox"
            checked={useCustomAttendanceColor}
            onChange={(event) => setUseCustomAttendanceColor(event.target.checked)}
          />
          Usar cor personalizada
        </label>
        {useCustomAttendanceColor && (
          <div className="attendance-color-field__picker">
            <input
              type="color"
              value={attendanceColor}
              onChange={(event) => setAttendanceColor(event.target.value.toUpperCase())}
              aria-label="Escolher cor do atendente"
            />
            <code>{attendanceColor.toUpperCase()}</code>
          </div>
        )}
      </div>

      <Input
        label={initialData ? "Nova Senha (opcional)" : "Senha"}
        type="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (passwordError) setPasswordError("");
        }}
        required={!initialData}
        minLength={8}
      />
      <PasswordChecklist
        password={password}
        error={passwordError}
        helperText={
          initialData
            ? "Preencha apenas se quiser trocar a senha atual deste usuario."
            : "A senha sera validada em tempo real conforme voce digita."
        }
      />

      <div className="permissions-section">
        <h3>Permissoes de Acesso</h3>

        {grantableSet && outOfScopePermissions.length > 0 && (
          <div className="permissions-warning">
            <strong>Atenção:</strong> este usuário possui{" "}
            {outOfScopePermissions.length} permissao(oes) fora do seu plano.
            <br />
            Ao salvar, essas permissoes serao removidas.
          </div>
        )}

        <div className="permissions-grid">
          {visibleGroups.map((group) => (
            <div key={group.label} className="permission-group">
              <h4>{group.label}</h4>
              {group.permissions
                .filter(
                  (perm) =>
                    perm.key !== CONTACTS_VIEW_ALL_PERMISSION &&
                    perm.key !== CHAT_VIEW_ALL_MESSAGES_PERMISSION
                )
                .map((perm) => (
                  <div key={perm.key} className="permission-checkbox">
                    <input
                      type="checkbox"
                      id={perm.key}
                      checked={selectedPermissions.includes(perm.key)}
                      onChange={() => togglePermission(perm.key)}
                    />
                    <label htmlFor={perm.key}>{perm.label}</label>
                  </div>
                ))}

              {group.permissions.some(
                (perm) => perm.key === CHAT_VIEW_ALL_MESSAGES_PERMISSION
              ) &&
                !isMasterUser && (
                  <div
                    className={`permission-toggle-card${
                      !hasChatAccess ? " is-disabled" : ""
                    }`}
                  >
                    <div className="permission-toggle-card__content">
                      <strong>Ver historico completo da conversa</strong>
                      <span>
                        Desativado: ve apenas mensagens em que participou.
                        Ativado: libera mensagens antigas de outros atendentes na mesma conversa.
                      </span>
                    </div>

                    <label
                      className="permission-toggle-switch"
                      htmlFor="chat-view-all-messages-toggle"
                    >
                      <input
                        id="chat-view-all-messages-toggle"
                        type="checkbox"
                        checked={canViewAllChatMessages}
                        disabled={!hasChatAccess || hasChatManager}
                        onChange={() =>
                          togglePermission(CHAT_VIEW_ALL_MESSAGES_PERMISSION)
                        }
                      />
                      <span className="permission-toggle-switch__slider" />
                    </label>
                  </div>
                )}

              {group.permissions.some(
                (perm) => perm.key === CONTACTS_VIEW_ALL_PERMISSION
              ) &&
                !isMasterUser && (
                  <div
                    className={`permission-toggle-card${
                      !hasContactsAccess ? " is-disabled" : ""
                    }`}
                  >
                    <div className="permission-toggle-card__content">
                      <strong>Ver todos os contatos</strong>
                      <span>
                        Desativado: ve apenas contatos com interacoes anteriores.
                        Ativado: libera toda a base de contatos.
                      </span>
                    </div>

                    <label
                      className="permission-toggle-switch"
                      htmlFor="contacts-view-all-toggle"
                    >
                      <input
                        id="contacts-view-all-toggle"
                        type="checkbox"
                        checked={canViewAllContacts}
                        disabled={!hasContactsAccess}
                        onChange={() =>
                          togglePermission(CONTACTS_VIEW_ALL_PERMISSION)
                        }
                      />
                      <span className="permission-toggle-switch__slider" />
                    </label>
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>

      <div className="permissions-section">
        <h3>Números da Meta para atendimento</h3>

        {isMasterUser ? (
          <div className="meta-number-info-box">
            Esta conta master pode atender todos os números ativos da Meta.
          </div>
        ) : availableMetaNumbers.length === 0 ? (
          <div className="meta-number-info-box">
            Nenhum número ativo da Meta foi encontrado para vincular.
          </div>
        ) : (
          <div className="meta-number-grid">
            {availableMetaNumbers.map((account) => {
              const accountId = Number(account.id || 0);
              const displayName =
                account.display_phone_number ||
                account.phone_number_id ||
                "Número sem identificação";
              const subtitle =
                account.verified_name ||
                account.whatsapp_account_name ||
                account.whatsapp_account_id ||
                "Conta Meta";

              return (
                <label key={accountId} className="meta-number-option">
                  <input
                    type="checkbox"
                    checked={selectedMetaParamIds.includes(accountId)}
                    onChange={() => toggleMetaNumber(accountId)}
                  />
                  <span>
                    <strong>{displayName}</strong>
                    <small>{subtitle}</small>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="save-button">
          Salvar Usuário
        </button>
      </div>
    </form>
  );
}
