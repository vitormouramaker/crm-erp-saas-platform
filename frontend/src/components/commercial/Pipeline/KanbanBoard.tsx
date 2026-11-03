import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useToast } from "../../../contexts/ToastContext";
import {
  deleteCommercialDealsByStage,
  moveCommercialDeal,
  updateCommercialDeal,
  type CommercialDomainOption,
  type CommercialDomainProduct,
  type CommercialStage,
  type Deal,
} from "../../../service/commercialService";
import { FinishServiceModal } from "./FinishServiceModal";
import { DeleteStageDealsModal } from "./DeleteStageDealsModal";
import { KanbanColumn } from "./KanbanColumn";
import "./KanbanBoard.css";

type KanbanBoardProps = {
  deals: Deal[];
  loading?: boolean;
  stages: CommercialStage[];
  stagePaginationMeta?: Record<
    string,
    {
      totalDealsCount: number;
      totalValue: number;
      hasMore: boolean;
      loadingMore: boolean;
    }
  >;
  onLoadMoreStage?: (stageId: string) => void;
  zoomLevel?: number;
  currentUser: { id: number; name: string; isMaster?: boolean };
  products: CommercialDomainProduct[];
  paymentOptions: CommercialDomainOption[];
  lossReasonOptions: CommercialDomainOption[];
  interactionTypes: CommercialDomainOption[];
  crmId?: number | null;
  onDealUpdate: (deal: Deal) => void;
  onDealDelete: (dealId: string) => void;
  onReload: () => void;
};

const FALLBACK_COLUMNS: Array<{ id: string; title: string }> = [
  { id: "waiting", title: "Aguardando Atendimento" },
  { id: "prospect", title: "Prospecção" },
  { id: "qualificacao", title: "Qualificação" },
  { id: "proposal", title: "Proposta" },
  { id: "negotiation", title: "Negociação" },
  { id: "closed-won", title: "Fechado Ganho" },
  { id: "closed-lost", title: "Perdido" },
];

function parseCommercialDate(value?: string | null) {
  if (!value) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  if (/([zZ]|[+-]\d{2}:\d{2})$/.test(normalized)) {
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parsed = new Date(`${normalized}T00:00:00-03:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const normalizedDateTime = normalized.includes("T")
    ? normalized
    : normalized.replace(" ", "T");
  const parsed = new Date(`${normalizedDateTime}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function KanbanBoard({
  deals: initialDeals,
  loading,
  stages,
  stagePaginationMeta = {},
  onLoadMoreStage,
  zoomLevel = 1,
  currentUser,
  products,
  paymentOptions,
  lossReasonOptions,
  interactionTypes,
  crmId,
  onDealUpdate,
  onDealDelete,
  onReload,
}: KanbanBoardProps) {
  const [localDeals, setLocalDeals] = useState<Deal[]>(initialDeals);
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [pendingDeal, setPendingDeal] = useState<Deal | null>(null);
  const [targetStage, setTargetStage] = useState<string | null>(null);
  const [pendingColumnDelete, setPendingColumnDelete] = useState<{
    stageId: string;
    stageTitle: string;
    stageRecordId: number;
    dealCount: number;
  } | null>(null);
  const [isDeletingColumn, setIsDeletingColumn] = useState(false);
  const [columnSortDirections, setColumnSortDirections] = useState<Record<string, "asc" | "desc">>({});
  const { addToast } = useToast();

  useEffect(() => {
    setLocalDeals(initialDeals);
  }, [initialDeals]);

  const columns = useMemo(() => {
    if (!stages.length) return FALLBACK_COLUMNS;
    return stages
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((stage) => ({ id: stage.codigo, title: stage.nome }));
  }, [stages]);

  const stageMap = useMemo(() => {
    const next = new Map<string, CommercialStage>();
    stages.forEach((stage) => next.set(stage.codigo, stage));
    return next;
  }, [stages]);

  const handleOptimisticUpdate = (updatedDeal: Deal) => {
    setLocalDeals((prev) => prev.map((item) => (item.id === updatedDeal.id ? updatedDeal : item)));
    onDealUpdate(updatedDeal);
  };

  const handleLocalDelete = (dealId: string) => {
    setLocalDeals((prev) => prev.filter((deal) => deal.id !== dealId));
    onDealDelete(dealId);
  };

  const normalizeStageDeals = (
    items: Deal[],
    stage: string,
    direction: "asc" | "desc" = "desc"
  ) =>
    items
      .filter((deal) => deal.stage === stage)
      .sort((a, b) => {
        if (stage === "closed-won" || stage === "closed-lost") {
          const aTime =
            parseCommercialDate(a.saleDate || a.closingDate || a.createdAt || null)?.getTime() ?? 0;
          const bTime =
            parseCommercialDate(b.saleDate || b.closingDate || b.createdAt || null)?.getTime() ?? 0;
          return direction === "asc" ? aTime - bTime : bTime - aTime;
        }

        const aTime =
          parseCommercialDate(a.entryDate || a.createdAt || null)?.getTime() ?? 0;
        const bTime =
          parseCommercialDate(b.entryDate || b.createdAt || null)?.getTime() ?? 0;

        if (stage === "waiting") {
          return direction === "asc" ? aTime - bTime : bTime - aTime;
        }

        const orderDiff = (a.order || 0) - (b.order || 0);
        if (orderDiff !== 0) return direction === "asc" ? orderDiff : -orderDiff;
        return direction === "asc" ? aTime - bTime : bTime - aTime;
      });

  const handleColumnSortDirectionChange = (stageId: string, direction: "asc" | "desc") => {
    setColumnSortDirections((prev) => ({
      ...prev,
      [stageId]: direction,
    }));
  };

  const handleRequestDeleteColumn = (stageId: string, stageTitle: string, dealCount: number) => {
    const stage = stageMap.get(stageId);
    if (!stage?.id || dealCount <= 0) return;
    setPendingColumnDelete({
      stageId,
      stageTitle,
      stageRecordId: Number(stage.id),
      dealCount,
    });
  };

  const handleConfirmDeleteColumn = async () => {
    if (!pendingColumnDelete) return;

    try {
      setIsDeletingColumn(true);
      const result = await deleteCommercialDealsByStage(
        pendingColumnDelete.stageRecordId,
        crmId
      );
      setLocalDeals((prev) =>
        prev.filter((deal) => deal.stage !== pendingColumnDelete.stageId)
      );
      addToast({
        type: "success",
        title: "Coluna esvaziada",
        description:
          Number(result.deletedCount || 0) > 0
            ? `${result.deletedCount} card(s) removido(s) da coluna ${pendingColumnDelete.stageTitle}.`
            : `Nenhum card ativo foi encontrado na coluna ${pendingColumnDelete.stageTitle}.`,
      });
      setPendingColumnDelete(null);
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Nao foi possivel excluir os cards da coluna.",
      });
    } finally {
      setIsDeletingColumn(false);
    }
  };

  if (loading) {
    return <div className="kanban-loading">Carregando pipeline...</div>;
  }

  const isClosedStage = (stageCode: string) =>
    Boolean(stageMap.get(stageCode)?.eh_fechamento) ||
    stageCode === "closed-won" ||
    stageCode === "closed-lost";

  const dealsByStage = localDeals.reduce<Record<string, Deal[]>>((acc, deal) => {
    if (!acc[deal.stage]) acc[deal.stage] = [];
    acc[deal.stage].push(deal);
    return acc;
  }, {});

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const newStage = destination.droppableId;
    const movedAcrossColumns = source.droppableId !== destination.droppableId;
    const targetIndex = movedAcrossColumns && newStage !== "waiting" ? 0 : destination.index;
    const draggedDeal = localDeals.find((deal) => deal.id === draggableId);
    if (!draggedDeal) return;

    if (newStage === "waiting" && source.droppableId !== "waiting") {
      addToast({
        type: "error",
        title: "Acao invalida",
        description: "Nao e permitido retornar para Aguardando Atendimento.",
      });
      return;
    }

    if (
      source.droppableId === "waiting" &&
      destination.droppableId === "waiting" &&
      source.index !== destination.index
    ) {
      addToast({
        type: "info",
        title: "Ordenacao automatica",
        description: "A fila de espera continua organizada por tempo de chegada.",
      });
      return;
    }

    if (isClosedStage(newStage)) {
      setPendingDeal(draggedDeal);
      setTargetStage(newStage);
      setFinishModalOpen(true);
      return;
    }

    const updatedDeals = [...localDeals];
    const dealIndex = updatedDeals.findIndex((deal) => deal.id === draggableId);
    updatedDeals.splice(dealIndex, 1);

    const updatedDeal = { ...draggedDeal, stage: newStage };
    const targetStageDeals = normalizeStageDeals(
      updatedDeals,
      newStage,
      columnSortDirections[newStage] || "desc"
    );
    targetStageDeals.splice(targetIndex, 0, updatedDeal);
    targetStageDeals.forEach((deal, index) => {
      deal.order = index;
    });

    const otherDeals = updatedDeals.filter((deal) => deal.stage !== newStage);
    setLocalDeals([...otherDeals, ...targetStageDeals]);

    try {
      await moveCommercialDeal(
        draggableId,
        newStage,
        targetIndex,
        stageMap.get(newStage)?.id,
        crmId
      );
    } catch (error) {
      addToast({
        type: "error",
        title: "Erro",
        description: error instanceof Error ? error.message : "Nao foi possivel mover o atendimento.",
      });
      onReload();
    }
  };

  return (
    <div className="kanban-board-container">
      <DragDropContext onDragEnd={onDragEnd}>
        <div
          className="kanban-board"
          style={
            {
              "--kanban-zoom": zoomLevel,
            } as CSSProperties
          }
        >
          {columns.map((column) => {
            const sortDirection = columnSortDirections[column.id] || "desc";
            const stageDeals = normalizeStageDeals(dealsByStage[column.id] || [], column.id, sortDirection);
            const columnMeta = stagePaginationMeta[column.id];
            const totalDealsCount = Number(columnMeta?.totalDealsCount || stageDeals.length);
            const totalValue = Number(
              columnMeta?.totalValue ??
                stageDeals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0)
            );
            return (
            <KanbanColumn
              key={column.id}
              stageId={column.id}
              title={column.title}
              deals={stageDeals}
              totalDealsCount={totalDealsCount}
              totalValue={totalValue}
              countLabel={String(totalDealsCount)}
              hasMore={Boolean(columnMeta?.hasMore)}
              loadingMore={Boolean(columnMeta?.loadingMore)}
              onLoadMore={onLoadMoreStage}
              sortDirection={sortDirection}
              onSortDirectionChange={handleColumnSortDirectionChange}
              currentUser={currentUser}
              products={products}
              paymentOptions={paymentOptions}
              lossReasonOptions={lossReasonOptions}
              interactionTypes={interactionTypes}
              stages={stages}
              onDealUpdate={handleOptimisticUpdate}
              onDealDelete={handleLocalDelete}
              onDeleteColumn={handleRequestDeleteColumn}
              crmId={crmId}
              showDeleteColumnButton={Boolean(currentUser.isMaster && stageMap.get(column.id)?.id)}
              deletingColumn={
                isDeletingColumn && pendingColumnDelete?.stageId === column.id
              }
              />
            );
          })}
        </div>
      </DragDropContext>

      {pendingDeal && (
        <FinishServiceModal
          isOpen={finishModalOpen}
          onClose={() => {
            setFinishModalOpen(false);
            setPendingDeal(null);
            setTargetStage(null);
          }}
          deal={pendingDeal}
          initialFinishType={targetStage === "closed-won" ? "won" : targetStage === "closed-lost" ? "lost" : null}
          paymentOptions={paymentOptions}
          lossReasonOptions={lossReasonOptions}
          productCatalog={products}
          onConfirmSale={async (saleData) => {
            try {
              const updated = await updateCommercialDeal(pendingDeal.id, saleData, crmId);
              handleOptimisticUpdate(updated);
              setFinishModalOpen(false);
              setPendingDeal(null);
              setTargetStage(null);
            } catch (error) {
              addToast({
                type: "error",
                title: "Erro",
                description: error instanceof Error ? error.message : "Nao foi possivel finalizar a venda.",
              });
            }
          }}
          onConfirmRefusal={async (refusalData) => {
            try {
              const updated = await updateCommercialDeal(pendingDeal.id, refusalData, crmId);
              handleOptimisticUpdate(updated);
              setFinishModalOpen(false);
              setPendingDeal(null);
              setTargetStage(null);
            } catch (error) {
              addToast({
                type: "error",
                title: "Erro",
                description: error instanceof Error ? error.message : "Nao foi possivel registrar a recusa.",
              });
            }
          }}
        />
      )}

      <DeleteStageDealsModal
        isOpen={Boolean(pendingColumnDelete)}
        stageTitle={pendingColumnDelete?.stageTitle || ""}
        dealCount={pendingColumnDelete?.dealCount || 0}
        loading={isDeletingColumn}
        onClose={() => {
          if (isDeletingColumn) return;
          setPendingColumnDelete(null);
        }}
        onConfirm={() => void handleConfirmDeleteColumn()}
      />
    </div>
  );
}
