import { useEffect, useState, useCallback } from "react";
import {
  FiUserPlus,
  FiEdit,
  FiTrash2,
  FiShield,
  FiCheckCircle,
  FiUsers,
  FiStar,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Modal } from "../../components/common/Modal/Modal";
import { UserForm, type UserData } from "../../components/UserForm/UserForm";
import { Avatar } from "../../components/common/Avatar/Avatar";
import { encrypt, decrypt } from "../../utils/cripto";
import { API_BASE } from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import { generateColorFromName } from "../../utils/colors";
import { PERMISSION_GROUPS } from "../../config/permissionCatalog";
import {
  getGrantablePermissionsForUser,
  sanitizePermissions,
} from "../../config/planPermissions";
import {
  MetaService,
  type MetaIntegrationAccount,
} from "../../service/metaService";
import type { Branch } from "../../data/mockData";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import "./UsersPage.css";
import { useNavigate } from "react-router-dom";

const PERMISSION_LABELS = new Map(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map(
      (permission) => [permission.key, permission.label] as const,
    ),
  ),
);

function getMetaNumberLabel(account: {
  display_phone_number?: string | null;
  phone_number_id?: string | null;
  verified_name?: string | null;
  whatsapp_account_name?: string | null;
}) {
  return (
    account.display_phone_number ||
    account.phone_number_id ||
    account.verified_name ||
    account.whatsapp_account_name ||
    "Número sem identificação"
  );
}

function normalizeUserEmail(email: string) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  // Usuário logado
  const [users, setUsers] = useState<UserData[]>([]);
  const [availableMetaNumbers, setAvailableMetaNumbers] = useState<
    MetaIntegrationAccount[]
  >([]);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [expandedUserCards, setExpandedUserCards] = useState<number[]>([]);
  const [expandedUserPermissions, setExpandedUserPermissions] = useState<number[]>(
    [],
  );

  const planName = (currentUser as any)?.nome_plano as string | undefined;
  const grantable = currentUser
    ? getGrantablePermissionsForUser(currentUser as any)
    : null;
  const grantablePermissions = grantable ?? undefined;
  const currUser = users.filter((u) => !(u as any)?.is_master).length;
  const maxUser = Number((currentUser as any)?.max_user ?? 0);
  const additionalUser = Number((currentUser as any)?.additional_user ?? 0);

  // limite total
  const userLimit = maxUser + additionalUser;
  const remainingUsers = Math.max(userLimit - currUser, 0);
  const canBypassLimit = false; // master também respeita o plano

  // trava se atingiu limite
  const isAtUserLimit =
    !canBypassLimit && userLimit > 0 && currUser >= userLimit;

  // 🔹 Fetch Usuários
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      if (!currentUser?.empresa_id) {
        setUsers([]);
        setAvailableMetaNumbers([]);
        setAvailableBranches([]);
        return;
      }

      const encrypted = await encrypt({ empresa_id: currentUser.empresa_id });
      const [response, metaNumbers, branchesResponse] = await Promise.all([
        fetch(`${API_BASE}/user/lista_usuarios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }),
        MetaService.getIntegrationNumbers(
          currentUser.empresa_id,
          currentUser.id,
        ).catch(() => []),
        fetch(`${API_BASE}/user/lista_filial`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }).catch(() => null),
      ]);

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj: UserData[];
      };

      if (resp?.boleano) {
        setUsers(resp.obj);
      } else {
        setUsers([]);
      }
      setAvailableMetaNumbers(
        (metaNumbers || []).filter((account) => account.ativo !== false),
      );
      if (branchesResponse) {
        const branchRespData = await branchesResponse.json();
        const branchResp = (await decrypt(branchRespData.payload)) as {
          boleano: boolean;
          obj: Branch[];
        };
        setAvailableBranches(branchResp?.boleano ? branchResp.obj || [] : []);
      } else {
        setAvailableBranches([]);
      }
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.empresa_id]);

  useEffect(() => {
    // Só busca quando tiver empresa_id disponível (após login/hidratação do contexto)
    if (currentUser?.empresa_id) fetchUsers();
  }, [currentUser?.empresa_id, fetchUsers]);

  const handleOpenModal = (user: UserData | null) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (userData: UserData) => {
    try {
      const isCreating = !userData.id;
      const normalizedEmail = normalizeUserEmail(userData.email);

      // trava só na criação
      if (isCreating && isAtUserLimit) {
        alert(
          `Você atingiu o limite de usuários do seu plano (${userLimit}). ` +
            `Remova alguém ou compre pacotes extras (em breve).`,
        );
        return;
      }

      if (!currentUser?.empresa_id) {
        alert("Empresa não identificada. Faça login novamente.");
        return;
      }

      if (!normalizedEmail) {
        alert("Informe um e-mail válido para o usuário.");
        return;
      }

      const conflictingUser = users.find(
        (user) =>
          user.id !== userData.id &&
          normalizeUserEmail(user.email) === normalizedEmail,
      );

      if (conflictingUser) {
        alert("Já existe um usuário cadastrado com este e-mail.");
        return;
      }

      const grantable = getGrantablePermissionsForUser(currentUser as any);

      const safePermissions = grantable
        ? sanitizePermissions(userData.permissions, grantable)
        : userData.permissions || [];

      const payload = {
        ...userData,
        email: normalizedEmail,
        empresa_id: currentUser.empresa_id,
        permissions: safePermissions,
      };

      const endpoint = userData.id
        ? "/user/editar_usuario"
        : "/user/criar_usuario";

      const encrypted = await encrypt(payload);

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();

      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        msg?: string;
        mensagem?: string;
        obj?: { usuarios?: string | number };
      };

      if (resp?.boleano) {
        alert(
          userData.id ? "Usuário atualizado!" : "Usuário criado com sucesso!",
        );

        setIsModalOpen(false);

        // sempre refaz lista para garantir consistência
        fetchUsers();
      } else {
        alert(resp?.mensagem || resp?.msg || "Erro ao salvar usuário.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de comunicação.");
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const encrypted = await encrypt({ usuario_id: userToDelete });

      const response = await fetch(`${API_BASE}/user/deletar_usuario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();

      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        msg?: string;
        obj?: { usuarios?: string | number };
      };

      if (resp?.boleano) {
        // refaz lista (evita inconsistência visual)
        fetchUsers();
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
      } else {
        alert(resp?.msg || "Erro ao remover usuário.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro de comunicação.");
    }
  };

  const handleToggleUserCardExpansion = (userId: number) => {
    setExpandedUserCards((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  const handleToggleUserPermissions = (userId: number) => {
    setExpandedUserPermissions((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  return (
    <div className="users-page-layout">
      <MobileHeader title="Gestão de Usuários" />

      <header className="users-header">
        <div className="header-content">
          <h1>Usuários do Sistema</h1>
          <p>
            Gerencie quem tem acesso à plataforma e defina permissões
            específicas.
          </p>
        </div>

        <div className="users-plan-counter">
          <div className="users-plan-info">
            <div className="users-info-badge">
              <div className="users-info-badge-icon">
                <FiStar />
              </div>
              <div className="users-info-badge-content">
                <span className="users-info-badge-label">Plano Atual</span>
                <strong className="users-info-badge-value">
                  {planName || "—"}
                </strong>
              </div>
            </div>

            <div className="users-info-badge">
              <div className="users-info-badge-icon">
                <FiUsers />
              </div>
              <div className="users-info-badge-content">
                <span className="users-info-badge-label">
                  Usuários ({currUser}/{userLimit})
                </span>
                <strong className="users-info-badge-value">
                  Restam {remainingUsers}
                  {additionalUser > 0 ? ` (+${additionalUser} extra)` : ""}
                </strong>
              </div>
            </div>
          </div>

          <div className="users-plan-actions-buttons">
            {!isAtUserLimit && (
              <button
                className="add-user-button"
                onClick={() => handleOpenModal(null)}
                title="Adicionar novo usuário"
              >
                <FiUserPlus /> Novo Usuário
              </button>
            )}

            {isAtUserLimit && (
              <button
                className="buy-more-button"
                type="button"
                onClick={() =>
                  navigate("/assinatura", { state: { section: "usuarios" } })
                }
                title="Comprar mais usuários"
              >
                Comprar mais usuários
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="users-content">
        {loading ? (
          <p style={{ textAlign: "center", padding: "20px" }}>
            Carregando equipe...
          </p>
        ) : (
          <div className="users-grid">
            {users.map((user) => {
              // Lógica visual para os badges
              // is_master vem do backend (booleano)
              // permissions é um array de strings
              const isMaster = (user as any).is_master;
              const permCount = user.permissions ? user.permissions.length : 0;
              const permissionDetails = (user.permissions || [])
                .map((permission) => {
                  const label = PERMISSION_LABELS.get(permission);
                  return label ? { key: permission, label } : null;
                })
                .filter(
                  (
                    permission,
                  ): permission is {
                    key: string;
                    label: string;
                  } => Boolean(permission),
                );
              const permissionLabels = permissionDetails.map(
                (permission) => permission.label,
              );
              const allowedMetaNumbersPreview = Array.isArray(
                user.allowed_meta_numbers,
              )
                ? user.allowed_meta_numbers
                : [];
              const isUserCardExpanded = user.id
                ? expandedUserCards.includes(user.id)
                : false;
              const canEditUser = !isMaster || currentUser?.is_master;
              const isPermissionsExpanded =
                user.id != null && expandedUserPermissions.includes(user.id);
              const canDeleteUser = currentUser?.id !== user.id && !isMaster;
              return (
                <div
                  key={user.id}
                  className={`user-card ${isMaster ? "master-card" : ""} ${isUserCardExpanded ? "user-card--expanded" : ""}`}
                >
                  <div className="user-card-header">
                    <div className="user-card-header__identity">
                      <Avatar
                        name={user.name}
                        color={generateColorFromName(user.name)}
                      />
                      <div className="user-info">
                        <h3>{user.name}</h3>
                        <span>{user.email}</span>
                      </div>
                    </div>

                    <div className="user-card-header__actions">
                      {canEditUser && (
                        <button
                          type="button"
                          className="user-card-header__action"
                          onClick={() => handleOpenModal(user)}
                          title="Editar"
                          aria-label={`Editar ${user.name}`}
                        >
                          <FiEdit />
                        </button>
                      )}

                      {canDeleteUser && (
                        <button
                          type="button"
                          className="user-card-header__action user-card-header__action--danger"
                          onClick={() => {
                            setUserToDelete(user.id!);
                            setIsDeleteModalOpen(true);
                          }}
                          title="Excluir"
                          aria-label={`Excluir ${user.name}`}
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                  </div>

                  {isMobile && (
                    <div className="user-card-expandable">
                      <button
                        type="button"
                        className="user-card-expandable__toggle"
                        onClick={() =>
                          user.id && handleToggleUserCardExpansion(user.id)
                        }
                        aria-expanded={isUserCardExpanded}
                      >
                        <div className="user-card-expandable__toggle-text">
                          <strong>Permissões e vínculos</strong>
                          <span>
                            {isUserCardExpanded
                              ? "Toque para recolher os detalhes"
                              : "Toque para expandir os detalhes"}
                          </span>
                        </div>
                        <span
                          className="user-card-expandable__toggle-icon"
                          aria-hidden="true"
                        >
                          {isUserCardExpanded ? (
                            <FiChevronUp />
                          ) : (
                            <FiChevronDown />
                          )}
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="user-card-body">
                    <div className="role-section">
                      {isMaster ? (
                        <span className="role-badge badge-adm">
                          <FiCheckCircle style={{ marginRight: 4 }} /> Conta
                          Master
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`role-badge ${
                            permCount > 0 ? "badge-stock" : "badge-default"
                          }`}
                          disabled={permCount === 0}
                          onClick={() => {
                            if (user.id != null) {
                              handleToggleUserPermissions(user.id);
                            }
                          }}
                          aria-expanded={isPermissionsExpanded}
                          aria-controls={`user-permissions-${user.id}`}
                          aria-label={`${isPermissionsExpanded ? "Ocultar" : "Mostrar"} acessos de ${user.name}`}
                        >
                          <FiShield style={{ marginRight: 4 }} />
                          {permCount > 0
                            ? `${permCount} Permissões`
                            : "Sem acesso"}
                          {permCount > 0 &&
                            (isPermissionsExpanded ? (
                              <FiChevronUp aria-hidden="true" />
                            ) : (
                              <FiChevronDown aria-hidden="true" />
                            ))}
                        </button>
                      )}
                    </div>


                    {!isMaster && permissionDetails.length > 0 && (
                      <div
                        id={`user-permissions-${user.id}`}
                        className="permissions-preview"
                        hidden={!isPermissionsExpanded}
                      >
                        <small>Acessos:</small>
                        <ul>
                          {permissionDetails.slice(0, 4).map((permission) => (
                            <li key={`${user.id}-${permission.key}`}>
                              {permission.label}
                            </li>
                          ))}
                        </ul>
                        {permissionDetails.length > 4 && (
                          <div className="permissions-more">
                            <span className="permissions-more-text">
                              +{permissionLabels.length - 4} permissões...
                            </span>
                            <div className="permissions-tooltip">
                              <div className="tooltip-title">
                                Todas as permissões:
                              </div>
                              <ul>
                                {permissionDetails.map((permission) => (
                                  <li
                                    key={`tooltip-${user.id}-${permission.key}`}
                                  >
                                    {permission.label}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="user-card-links">
                      <div className="meta-number-preview">
                        <small><strong>Filial vinculada:</strong></small>
                        <p>{user.filial_nome || "Sem filial vinculada"}</p>
                      </div>

                      <div className="meta-number-preview">
                        <small><strong>Números vinculados:</strong></small>
                        {isMaster ? (
                          <p>Todos os números ativos da Meta.</p>
                        ) : allowedMetaNumbersPreview.length > 0 ? (
                          <ul>
                            {allowedMetaNumbersPreview.map((account, index) => (
                              <li
                                key={`${user.id}-${account.id || account.phone_number_id || index}`}
                              >
                                {getMetaNumberLabel(account)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>Nenhum número vinculado.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="user-card-footer">
                    {canEditUser && (
                      <button
                        type="button"
                        onClick={() => handleOpenModal(user)}
                        title="Editar"
                        aria-label={`Editar ${user.name}`}
                      >
                        <FiEdit />
                      </button>
                    )}

                    {canDeleteUser && (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          setUserToDelete(user.id!);
                          setIsDeleteModalOpen(true);
                        }}
                        title="Excluir"
                        aria-label={`Excluir ${user.name}`}
                      >
                        <FiTrash2 />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? "Editar Usuário e Permissões" : "Novo Usuário"}
      >
        <UserForm
          onSave={handleSaveUser}
          onCancel={() => setIsModalOpen(false)}
          initialData={editingUser}
          grantablePermissions={grantablePermissions}
          availableMetaNumbers={availableMetaNumbers}
          availableBranches={availableBranches}
        />
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        title="Excluir Usuário"
      >
        <div style={{ padding: "10px 0 10px" }}>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-text-secondary)",
              marginBottom: "24px",
              lineHeight: 1.5,
            }}
          >
            Tem certeza que deseja excluir este usuário? Ele perderá o acesso à
            plataforma imediatamente. Esta ação não pode ser desfeita.
          </p>
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}
          >
            <button
              onClick={() => {
                setIsDeleteModalOpen(false);
                setUserToDelete(null);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--border-radius-md)",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-background)",
                color: "var(--color-text-primary)",
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmDeleteUser}
              style={{
                padding: "8px 16px",
                borderRadius: "var(--border-radius-md)",
                border: "none",
                backgroundColor: "#dc3545",
                color: "#fff",
                fontWeight: 600,
              }}
            >
              Excluir Usuário
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
