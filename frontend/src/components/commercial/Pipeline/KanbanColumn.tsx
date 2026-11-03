import { useState } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { FiArrowDown, FiArrowUp, FiSearch, FiTrash2 } from "react-icons/fi";
import type {
  CommercialDomainOption,
  CommercialDomainProduct,
  CommercialStage,
  Deal,
} from "../../../service/commercialService";
import { DealCard } from "./DealCard";
import "./KanbanColumn.css";

type KanbanColumnProps = {
  stageId: string;
  title: string;
  deals: Deal[];
  totalDealsCount?: number;
  totalValue?: number;
  countLabel?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: (stageId: string) => void;
  sortDirection: "asc" | "desc";
  onSortDirectionChange: (stageId: string, direction: "asc" | "desc") => void;
  currentUser: { id: number; name: string; isMaster?: boolean };
  products: CommercialDomainProduct[];
  paymentOptions: CommercialDomainOption[];
  lossReasonOptions: CommercialDomainOption[];
  interactionTypes: CommercialDomainOption[];
  stages: CommercialStage[];
  onDealUpdate: (deal: Deal) => void;
  onDealDelete: (dealId: string) => void;
  onDeleteColumn?: (stageId: string, title: string, dealCount: number) => void;
  crmId?: number | null;
  showDeleteColumnButton?: boolean;
  deletingColumn?: boolean;
};

export function KanbanColumn({
  stageId,
  title,
  deals,
  totalDealsCount,
  totalValue,
  countLabel,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  sortDirection,
  onSortDirectionChange,
  currentUser,
  products,
  paymentOptions,
  lossReasonOptions,
  interactionTypes,
  stages,
  onDealUpdate,
  onDealDelete,
  onDeleteColumn,
  crmId,
  showDeleteColumnButton = false,
  deletingColumn = false,
}: KanbanColumnProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const resolvedTotalValue = Number(
    totalValue ?? deals.reduce((acc, deal) => acc + deal.amount, 0)
  );

  const getStageColor = (stage: string) => {
    if (stage === "waiting") return "#4299e1";
    if (stage === "prospect") return "#ecc94b";
    if (stage === "qualificacao") return "#ed8936";
    if (stage === "proposal") return "#805ad5";
    if (stage === "negotiation") return "#d53f8c";
    if (stage === "closed-won") return "#48bb78";
    if (stage === "closed-lost") return "#f56565";
    return "#cbd5e0";
  };

  const filteredDeals = deals.filter((deal) => {
    if (!searchTerm) return true;
    const normalized = searchTerm.toLowerCase();
    return (
      deal.title.toLowerCase().includes(normalized) ||
      deal.companyName.toLowerCase().includes(normalized) ||
      deal.contactName.toLowerCase().includes(normalized) ||
      (deal.tags || []).some((tag) => tag.toLowerCase().includes(normalized))
    );
  });

  return (
    <div className="kanban-column" style={{ borderTop: `4px solid ${getStageColor(stageId)}` }}>
      <div className="kanban-column-header">
        <div className="kanban-column-title-row">
          <h3 className="kanban-column-title">{title}</h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginLeft: "auto",
            }}
          >
            <span className="kanban-column-count">{countLabel || String(totalDealsCount ?? filteredDeals.length)}</span>
            {showDeleteColumnButton ? (
              <button
                type="button"
                className="kanban-column-action kanban-column-action--danger"
                aria-label={`Excluir todos os cards da coluna ${title}`}
                title={
                  (totalDealsCount ?? deals.length) > 0
                    ? `Excluir todos os ${totalDealsCount ?? deals.length} card(s) da coluna`
                    : "Nenhum card para excluir nesta coluna"
                }
                onClick={() => onDeleteColumn?.(stageId, title, totalDealsCount ?? deals.length)}
                disabled={deletingColumn || (totalDealsCount ?? deals.length) === 0}
              >
                <FiTrash2 size={14} />
              </button>
            ) : null}
            <button
              type="button"
              className="kanban-column-action"
              aria-label={`Ordenacao da coluna ${title}: ${
                sortDirection === "desc" ? "mais recente primeiro" : "mais antigo primeiro"
              }`}
              title={
                sortDirection === "desc"
                  ? "Mais recente primeiro"
                  : "Mais antigo primeiro"
              }
              onClick={() =>
                onSortDirectionChange(
                  stageId,
                  sortDirection === "desc" ? "asc" : "desc"
                )
              }
              style={{
                backgroundColor: sortDirection === "desc" ? "#ebf8ff" : "#fffaf0",
                color: sortDirection === "desc" ? "#2b6cb0" : "#c05621",
              }}
            >
              {sortDirection === "desc" ? <FiArrowDown size={14} /> : <FiArrowUp size={14} />}
            </button>
          </div>
        </div>
        <div className="kanban-column-total">
          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(resolvedTotalValue)}
        </div>
        <div className="kanban-column-search">
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Droppable droppableId={stageId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`kanban-column-content ${snapshot.isDraggingOver ? "is-dragging-over" : ""}`}
          >
            {filteredDeals.map((deal, index) => (
              <DealCard
                key={deal.id}
                deal={deal}
                index={index}
                currentUser={currentUser}
                products={products}
                paymentOptions={paymentOptions}
                lossReasonOptions={lossReasonOptions}
                interactionTypes={interactionTypes}
                stages={stages}
                onUpdate={onDealUpdate}
                onDelete={onDealDelete}
                crmId={crmId}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {hasMore || loadingMore ? (
        <div className="kanban-column-footer">
          <button
            type="button"
            className="kanban-column-load-more"
            onClick={() => onLoadMore?.(stageId)}
            disabled={loadingMore}
          >
            {loadingMore ? "Carregando..." : "Carregar mais"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
