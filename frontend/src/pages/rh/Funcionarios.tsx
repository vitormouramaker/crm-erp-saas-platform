import { useCallback, useEffect, useMemo, useState } from "react";
import { FiEdit2 } from "react-icons/fi";
import { Avatar } from "../../components/common/Avatar/Avatar";
import { MobileHeader } from "../../components/common/MobileHeader/MobileHeader";
import { Modal } from "../../components/common/Modal/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { EditarPontoUsuario } from "./EditarPontoUsuario";
import { RhPontoService, type EmpresaUsuarioResumo } from "../../service/pontoService";
import { generateColorFromName } from "../../utils/colors";
import "./Funcionarios.css";

export function Funcionarios({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [usuarios, setUsuarios] = useState<EmpresaUsuarioResumo[]>([]);
  const [editingUsuario, setEditingUsuario] = useState<EmpresaUsuarioResumo | null>(null);

  const carregarUsuarios = useCallback(async () => {
    if (!user?.empresa_id) return;

    try {
      setLoading(true);
      const lista = await RhPontoService.listarUsuariosEmpresa(user.empresa_id);
      setUsuarios(lista);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro ao carregar colaboradores",
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde!",
      });
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  }, [addToast, user?.empresa_id]);

  useEffect(() => {
    void carregarUsuarios();
  }, [carregarUsuarios]);

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return usuarios;

    return usuarios.filter((item) => {
      const campos = [item.nome, item.name, item.email, String(item.id)];
      return campos.some((valor) =>
        String(valor || "")
          .toLowerCase()
          .includes(termo),
      );
    });
  }, [busca, usuarios]);

  return (
    <div className={embedded ? "rh-staff rh-staff--embedded" : "rh-staff"}>
      {!embedded && <MobileHeader title="Funcionarios" />}

      <section className="rh-staff__filters">
        <div className="rh-staff__filters-grid">
          {/* <label htmlFor="rh-staff-search">
            <FiSearch size={16} />
            
          </label> */}
          <input
            id="rh-staff-search"
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome, e-mail ou ID..."
            disabled={loading}
          />
        </div>
      </section>

      <div
        className={
          embedded ? "rh-staff-wrapper rh-staff-wrapper--embedded" : "rh-staff-wrapper"
        }
      >
      <section className="rh-staff__list">
        {loading ? (
          <div className="rh-staff__empty">Carregando colaboradores...</div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="rh-staff__empty">Nenhum colaborador encontrado.</div>
        ) : (
          usuariosFiltrados.map((item) => {
            const nome = item.nome || item.name || `Usuario ${item.id}`;
            return (
              <article key={item.id} className="rh-staff__card">
                <div className="rh-staff__card-main">
                  <Avatar
                    name={nome}
                    color={generateColorFromName(nome)}
                  />
                  <div className="rh-staff__info">
                    <strong>{nome}</strong>
                    <span>
                      ID {item.id}
                      {item.email ? ` • ${item.email}` : ""}
                      {typeof item.ativo === "boolean"
                        ? item.ativo
                          ? " • Ativo"
                          : " • Inativo"
                        : ""}
                    </span>
                  </div>
                </div>
                <div className="rh-staff__card-actions">
                  <button
                    className="rh-staff__action-button"
                    type="button"
                    onClick={() => setEditingUsuario(item)}
                  >
                    <FiEdit2 size={16} />
                    Editar ponto
                  </button>
                </div>
              </article>
            );
          })
        )}
        </section>
      </div>

      <Modal
        isOpen={Boolean(editingUsuario)}
        onClose={() => setEditingUsuario(null)}
        title={`Editar ponto${editingUsuario ? ` - ${editingUsuario.nome || editingUsuario.name || `Usuario ${editingUsuario.id}`}` : ""}`}
        size="lg"
      >
        {editingUsuario ? (
          <EditarPontoUsuario
            embedded
            fixedUsuarioId={editingUsuario.id}
            key={String(editingUsuario.id)}
          />
        ) : null}
      </Modal>
    </div>
  );
}
