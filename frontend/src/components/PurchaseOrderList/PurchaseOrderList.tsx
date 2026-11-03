import React, { useState, useMemo, useEffect } from "react";
import { FiPlus, FiEye, FiCheckCircle, FiCopy } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import type {
  PurchaseOrder,
  Branch, // Importa Branch para a lÃ³gica de "Refazer"
} from "../../data/mockData";
import { Modal } from "../common/Modal/Modal";
import { PurchaseOrderForm } from "../PurchaseOrderForm/PurchaseOrderForm";
import { API_BASE } from "../../config/api";
import { encrypt, decrypt } from "../../utils/cripto";
import "./PurchaseOrderList.css";

interface PurchaseOrderListProps {
  searchTerm: string;
}

// Interface atualizada para incluir os novos campos de rastreabilidade
interface PurchaseOrderComRastreio extends PurchaseOrder {
  solicitado_por: string;
  data_solicitacao: string;
  recebido_por: string | null;
  data_recebimento: string | null;
}

export function PurchaseOrderList({ searchTerm }: PurchaseOrderListProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<
    PurchaseOrderComRastreio[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  // --- Estados para os dados do Modal ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrderData, setEditingOrderData] = useState<Omit<
    PurchaseOrder,
    "id"
  > | null>(null);

  const [isRedoModalOpen, setIsRedoModalOpen] = useState(false);
  const [orderToRedo, setOrderToRedo] = useState<PurchaseOrder | null>(null);
  const [orderIdToReceive, setOrderIdToReceive] = useState<number | null>(null);
  const [pendingOrderToSave, setPendingOrderToSave] = useState<any | null>(null);

  // --- CONTROLE DE ACESSO (ACL) ---
  const { user } = useAuth();
  const { addToast } = useToast();
  const roleId = Number(user?.cargo_id ?? user?.cargo_id ?? 0);
  const isAdm = user?.is_master ?? false;
  const isEstoquista = roleId === 2;
  // ---------------------------------

  // --- BUSCA DE DADOS ---

  // 1. Busca os Pedidos de Compra
  const fetchOrders = async () => {
    if (!user?.empresa_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const encrypted = await encrypt({ empresa_id: user.empresa_id });

      const response = await fetch(
        `${API_BASE}/estoque/listar_pedidos_compra`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        }
      );

      const respData = await response.json();

      if (!respData.payload) {
        console.error(
          "Erro ao carregar pedidos:",
          respData.mensagem || "Resposta invÃ¡lida do servidor"
        );
        setPurchaseOrders([]);
        setLoading(false);
        return;
      }

      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj: PurchaseOrderComRastreio[];
        mensagem?: string;
      };

      if (resp?.boleano && Array.isArray(resp.obj)) {
        setPurchaseOrders(resp.obj);
      } else {
        setPurchaseOrders([]);
        console.error("Erro ao carregar pedidos:", resp?.mensagem);
      }
    } catch (err) {
      console.error(err);
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // 2. Estado de Filiais (APENAS para a função "Refazer Pedido")
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    if (user?.empresa_id) {
      fetchOrders();

      // Carrega filiais apenas para o fallback do "Refazer"
      const fetchBranches = async () => {
        try {
          const encrypted = await encrypt({ empresa_id: user.empresa_id });
          const response = await fetch(`${API_BASE}/user/lista_filial`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: encrypted }),
          });

          const respData = await response.json();
          if (!respData.payload) return; // Falha silenciosa

          const resp = (await decrypt(respData.payload)) as {
            boleano: boolean;
            obj: Branch[];
          };
          if (resp.boleano) setBranches(resp.obj);
        } catch (err) {
          console.error("Erro ao carregar filiais para fallback:", err);
        }
      };
      fetchBranches();
    } else {
      setLoading(false);
    }
  }, [user?.empresa_id]);

  const filteredOrders = useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    if (!lowercasedFilter) return purchaseOrders;
    return purchaseOrders.filter(
      (o) =>
        o.supplierName.toLowerCase().includes(lowercasedFilter) ||
        String(o.id).includes(lowercasedFilter) ||
        (o.solicitado_por || "").toLowerCase().includes(lowercasedFilter) ||
        (o.recebido_por || "").toLowerCase().includes(lowercasedFilter)
    );
  }, [purchaseOrders, searchTerm]);

  // --- LÃ"GICA DE RECEBIMENTO ATUALIZADA ---
  const handleReceiveOrder = (e: React.MouseEvent, orderId: number) => {
    e.stopPropagation();
    setOrderIdToReceive(orderId);
  };

  const confirmReceiveOrder = async () => {
    if (!orderIdToReceive) return;
    const orderId = orderIdToReceive;
    setOrderIdToReceive(null);

    try {
      const encrypted = await encrypt({ pedido_id: orderId, usuario_id: user?.id });

      const response = await fetch(`${API_BASE}/estoque/receber_pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      addToast({ type: "success", title: "Pedido recebido e estoque atualizado!" });
    } catch (err: any) {
      console.error("Erro ao receber pedido:", err);
      addToast({ type: "error", title: "Erro ao receber pedido. Verifique e tente novamente." });
    } finally {
      await fetchOrders();
    }
  };

  const toggleExpandRow = (orderId: number) => {
    setExpandedOrderId((prevId) => (prevId === orderId ? null : orderId));
  };

  const handleOpenNewOrder = () => {
    setEditingOrderData(null);
    setIsFormOpen(true);
  };

  const handleOpenRedoModal = (order: PurchaseOrder) => {
    setOrderToRedo(order);
    setIsRedoModalOpen(true);
  };

  // --- LÃ"GICA DE SALVAR ATUALIZADA ---
  const handleSaveOrder = async (orderData: any) => {
    setPendingOrderToSave(orderData);
  };

  const confirmSaveOrder = async () => {
    if (!pendingOrderToSave) return;

    // Adiciona os dados que o backend espera e que nÃ£o vÃªm do form
    const payload = {
      ...pendingOrderToSave,
      empresa_id: user?.empresa_id,
      usuario_solicitante_id: user?.id, // Envia quem solicitou
      orderDate: new Date().toISOString(), // Garante data fresca
      status: "Pendente", // Garante o status na criação
    };

    try {
      const encrypted = await encrypt(payload);

      const response = await fetch(`${API_BASE}/estoque/cadastro_pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      if (!respData.payload) throw new Error("Resposta invÃ¡lida do servidor");

      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj: PurchaseOrderComRastreio; // Espera o objeto completo de volta
      };

      if (resp?.boleano && resp.obj) {
        setPurchaseOrders((prev) => [
          { ...resp.obj, data_recebimento: null, recebido_por: null },
          ...prev,
        ]);
        setIsFormOpen(false);
        setPendingOrderToSave(null);
        addToast({ type: "success", title: "Pedido de compra criado com sucesso!" });
      } else {
        throw new Error("Falha ao criar pedido no servidor.");
      }
    } catch (err) {
      console.error(err);
      addToast({ type: "error", title: "Erro ao salvar pedido." });
    }
  };

  const handleRedoOrder = (edit: boolean) => {
    if (!orderToRedo) return;

    // Acha a filial_id com base no nome
    const foundBranch = branches.find((b) => b.name === orderToRedo.filial);

    const orderDataToRedo: Omit<PurchaseOrder, "id"> = {
      supplierId: orderToRedo.supplierId,
      supplierName: orderToRedo.supplierName,
      filial: orderToRedo.filial, // MantÃ©m o nome para 'initialData'
      orderDate: new Date().toISOString(),
      status: "Pendente" as const,
      items: orderToRedo.items,
      totalValue: orderToRedo.totalValue,
    };

    if (edit) {
      setEditingOrderData(orderDataToRedo);
      setIsFormOpen(true);
    } else {
      // Recria o payload para salvar
      const payloadToSave = {
        supplierId: orderToRedo.supplierId,
        filial_id: foundBranch?.id, // Envia o ID da filial
        items: orderToRedo.items,
      };

      if (!payloadToSave.filial_id) {
        alert("Erro: Filial do pedido original nÃ£o encontrada.");
        setIsRedoModalOpen(false);
        return;
      }
      handleSaveOrder(payloadToSave);
    }
    setIsRedoModalOpen(false);
  };

  const getItemQuantity = (item: any) =>
    Number(item?.quantity ?? item?.quantidade ?? item?.qtd ?? 0);
  const getItemCostPrice = (item: any) =>
    Number(
      item?.costPrice ??
        item?.custoUnitario ??
        item?.custo_unitario ??
        item?.custo ??
        0
    );
  const getItemName = (item: any) =>
    item?.productName ?? item?.produto_nome ?? item?.nome ?? "Produto";
  const getItemSku = (item: any) =>
    item?.sku ?? item?.codigo_barras ?? item?.codigo ?? "-";

  // Helper de formatação de data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="purchase-order-list-container">
      <div className="list-header-actions">
        <h3>Pedidos de Compra</h3>
        {isAdm && (
          <button className="add-new-button" onClick={handleOpenNewOrder}>
            <FiPlus /> Novo Pedido de Compra
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ padding: "20px", textAlign: "center" }}>
          Carregando pedidos...
        </p>
      ) : (
        <table className="purchase-order-table">
          <thead>
            <tr>
              <th>Pedido ID</th>
              <th>Fornecedor</th>
              <th>Filial</th>
              <th>Solicitado Por</th>
              <th>Data Solic.</th>
              <th>Recebido Por</th>
              <th>Data Receb.</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => {
              const totalItems = (order.items || []).reduce(
                (sum, item) => sum + getItemQuantity(item),
                0
              );

              return (
                <React.Fragment key={order.id}>
                  <tr
                    onClick={() => toggleExpandRow(order.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td data-label="Pedido ID">#{order.id}</td>
                    <td data-label="Fornecedor">{order.supplierName}</td>
                    <td data-label="Filial">{order.filial}</td>

                    <td data-label="Solicitado Por" className="user-cell">
                      {order.solicitado_por}
                    </td>
                    <td data-label="Data Solic.">
                      {formatDate(order.data_solicitacao || (order as any).orderDate || null)}
                    </td>
                    <td data-label="Recebido Por" className="user-cell">
                      {order.recebido_por || "-"}
                    </td>
                    <td data-label="Data Receb.">
                      {formatDate(order.data_recebimento)}
                    </td>

                    <td data-label="Status">
                      <span
                        className={`status-badge status-${
                          order.status ? order.status.toLowerCase() : "pendente"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td data-label="Ações">
                      <div className="action-buttons">
                        <button
                          className="action-button"
                          title="Refazer Pedido"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRedoModal(order);
                          }}
                        >
                          <FiCopy />
                        </button>
                        <button
                          className="action-button"
                          title="Ver Detalhes"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpandRow(order.id);
                          }}
                        >
                          <FiEye />
                        </button>

                        {(isAdm || isEstoquista) &&
                          order.status === "Pendente" && (
                            <button
                              className="action-button receive-button"
                              title="Receber Pedido"
                              onClick={(e) => handleReceiveOrder(e, order.id)}
                            >
                              <FiCheckCircle />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>

                  {expandedOrderId === order.id && (
                    <tr className="order-details-row">
                      <td colSpan={9}>
                        <div className="order-details-content">
                          <div className="details-header">
                            <h4>Detalhes do Pedido #{order.id}</h4>
                            <div className="details-info">
                              <span>
                                <strong>Fornecedor:</strong>{" "}
                                {order.supplierName}
                              </span>
                              <span>
                                <strong>Filial de Entrega:</strong>{" "}
                                {order.filial}
                              </span>
                              <span>
                                <strong>Total Itens:</strong> {totalItems}
                              </span>
                            </div>
                          </div>
                          <div className="details-items-table">
                            <div className="details-items-header">
                              <span>Produto</span>
                              <span>Qtd.</span>
                              <span>Custo Unit.</span>
                              <span>Subtotal</span>
                            </div>
                            {(order.items || []).map((item, index) => (
                              <div
                                className="details-item-row"
                                key={item.productId || index}
                              >
                                <span data-label="Produto">
                                  {getItemName(item)} ({getItemSku(item)})
                                </span>
                                <span data-label="Qtd.">
                                  {getItemQuantity(item)}
                                </span>
                                <span data-label="Custo Unit.">
                                  {getItemCostPrice(item).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}
                                </span>
                                <span data-label="Subtotal">
                                  {(
                                    getItemQuantity(item) * getItemCostPrice(item)
                                  ).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {filteredOrders.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: "center", padding: "20px" }}
                >
                  Nenhum pedido de compra encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Modal de Novo Pedido */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setPendingOrderToSave(null);
        }}
        title={
          editingOrderData ? "Editar Pedido de Compra" : "Novo Pedido de Compra"
        }
        size="lg" // <-- Adicionado para dar mais espaço ao modal
      >
        <PurchaseOrderForm
          onSave={handleSaveOrder}
          onCancel={() => {
            setIsFormOpen(false);
            setPendingOrderToSave(null);
          }}
          initialData={editingOrderData || undefined}
        />
      </Modal>

      <Modal
        isOpen={!!pendingOrderToSave}
        onClose={() => setPendingOrderToSave(null)}
        title="Salvar Pedido de Compra"
      >
        <div className="purchase-confirm-modal">
          <p>
            Confirmar o salvamento deste pedido de compra? Ele será criado com
            status <strong>Pendente</strong>.
          </p>
          <div className="purchase-confirm-actions">
            <button
              className="cancel-button"
              onClick={() => setPendingOrderToSave(null)}
            >
              Cancelar
            </button>
            <button className="save-button" onClick={confirmSaveOrder}>
              Sim, salvar pedido
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!orderIdToReceive}
        onClose={() => setOrderIdToReceive(null)}
        title="Confirmar Recebimento"
      >
        <div className="purchase-confirm-modal">
          <p>
            Tem certeza que deseja marcar o pedido #{orderIdToReceive} como
            recebido? Esta ação atualizará o estoque.
          </p>
          <div className="purchase-confirm-actions">
            <button
              className="cancel-button"
              onClick={() => setOrderIdToReceive(null)}
            >
              Cancelar
            </button>
            <button className="save-button" onClick={confirmReceiveOrder}>
              Sim, receber pedido
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Refazer Pedido */}
      <Modal
        isOpen={isRedoModalOpen}
        onClose={() => setIsRedoModalOpen(false)}
        title="Refazer Pedido de Compra"
      >
        <div className="redo-modal-content" style={{ padding: "10px" }}>
          {" "}
          {/* Estilo inline para modal simples */}
          <p>VocÃª deseja refazer o mesmo pedido selecionado?</p>
          <div
            className="form-actions"
            style={{
              paddingTop: "20px",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <button
              className="cancel-button"
              onClick={() => handleRedoOrder(true)}
            >
              Editar
            </button>
            <button
              className="save-button"
              onClick={() => handleRedoOrder(false)}
            >
              Sim, Refazer Agora
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
