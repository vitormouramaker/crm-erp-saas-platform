import * as XLSX from "xlsx";
import type {
  TemplateDispatchHistoryReportDetailResult,
  TemplateDispatchHistoryReportResult,
  TemplateDispatchHistoryReportRow,
} from "../service/metaService";

function sanitizeSheetName(value: string) {
  return value.slice(0, 31) || "Planilha";
}

function slugifyFilename(value: string) {
  return (
    String(value || "relatorio")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "relatorio"
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function getDispatchTypeLabel(value?: string | null) {
  return value === "list" ? "Lista de transmissao" : "Disparo individual";
}

function mapSummaryRow(item: TemplateDispatchHistoryReportRow) {
  return {
    "ID do disparo": item.dispatch_history_id ?? "",
    Tipo: getDispatchTypeLabel(item.dispatch_type),
    Template: item.template_name || "",
    Categoria: item.template_category || "",
    Idioma: item.template_language || "",
    "Lista ID": item.lista_transmissao_id ?? "",
    Lista: item.lista_nome || "",
    "Descricao da lista": item.lista_descricao || "",
    "Total da lista": Number(item.lista_total_contatos || 0),
    "Total alvo": Number(item.total_clientes || 0),
    Processados: Number(item.processados || 0),
    Enviados: Number(item.enviados || 0),
    Recebidos: Number(item.recebidos || 0),
    "Recebidos unicos": Number(item.recebidos_unicos || 0),
    Visualizados: Number(item.visualizados || 0),
    Respondidos: Number(item.respondidos || 0),
    "Respondidos unicos": Number(item.respondidos_unicos || 0),
    Erros: Number(item.erros || 0),
    "Custo unitario": Number(item.custo_unitario || 0),
    "Custo total": Number(item.valor_total || 0),
    Moeda: item.moeda || "USD",
    Status: item.status || "",
    "Numero Meta": item.meta_numero_conta || "",
    "Conta Meta": item.meta_nome_conta || "",
    "Realizado por": item.usuario_nome || "",
    "Iniciado em": formatDateTime(item.data_inicio),
    "Finalizado em": formatDateTime(item.data_fim),
    "Duracao (ms)": Number(item.duracao_ms || 0),
  };
}

export function exportMetaDispatchHistoryReport(params: {
  report: TemplateDispatchHistoryReportResult;
}) {
  const workbook = XLSX.utils.book_new();
  const items = Array.isArray(params.report.items) ? params.report.items : [];

  const filtersRows = [
    {
      "Inicio (unix)": params.report.filters?.start ?? "",
      "Fim (unix)": params.report.filters?.end ?? "",
      Tipo: params.report.filters?.dispatch_type || "all",
      "Numero Meta ID": params.report.filters?.empresa_meta_param_id ?? "",
      "Total de disparos": Number(params.report.summary?.total_disparos || 0),
      "Total de clientes": Number(params.report.summary?.total_clientes || 0),
      "Total enviados": Number(params.report.summary?.total_enviados || 0),
      "Total recebidos": Number(params.report.summary?.total_recebidos || 0),
      "Total recebidos unicos": Number(params.report.summary?.total_recebidos_unicos || 0),
      "Total visualizados": Number(params.report.summary?.total_visualizados || 0),
      "Total respondidos": Number(params.report.summary?.total_respondidos || 0),
      "Total respondidos unicos": Number(params.report.summary?.total_respondidos_unicos || 0),
      "Total erros": Number(params.report.summary?.total_erros || 0),
      "Custo total": Number(params.report.summary?.total_custo || 0),
      "Paginacao total": Number(params.report.pagination?.total || 0),
    },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(filtersRows),
    sanitizeSheetName("Resumo"),
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      items.length ? items.map(mapSummaryRow) : [{ Aviso: "Nenhum disparo encontrado." }],
    ),
    sanitizeSheetName("Disparos"),
  );

  const dateSuffix = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `meta_relatorio_envios_${dateSuffix}.xlsx`);
}

export function exportMetaDispatchHistoryDetail(params: {
  report: TemplateDispatchHistoryReportDetailResult;
}) {
  const workbook = XLSX.utils.book_new();
  const dispatch = params.report.dispatch || null;
  const items = Array.isArray(params.report.items) ? params.report.items : [];

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      dispatch ? [mapSummaryRow(dispatch)] : [{ Aviso: "Disparo nao encontrado." }],
    ),
    sanitizeSheetName("Resumo"),
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      items.length
        ? items.map((item) => ({
            "ID do item": item.item_id ?? "",
            Cliente: item.contato_nome || "",
            Email: item.email || "",
            "Telefone original": item.numero_original || "",
            "Telefone normalizado": item.numero_normalizado || "",
            "Message ID": item.message_id || "",
            Status: item.message_status || "",
            Sucesso: item.sucesso ? "Sim" : "Nao",
            "Enviado em": formatDateTime(item.enviado_em),
            Recebido: item.recebido ? "Sim" : "Nao",
            "Recebido em": formatDateTime(item.recebido_em),
            "Falhou em": formatDateTime(item.erro_em),
            "Mensagem de erro": item.erro_mensagem || "",
            "Codigo erro": item.erro_codigo ?? "",
            "Subcodigo erro": item.erro_subcodigo ?? "",
            "Tipo erro": item.erro_tipo || "",
            "Custo unitario": Number(item.custo_unitario || 0),
            "Valor cobrado": Number(item.valor_cobrado || 0),
          }))
        : [{ Aviso: "Nenhum item encontrado para este disparo." }],
    ),
    sanitizeSheetName("Itens"),
  );

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const dispatchLabel = slugifyFilename(
    dispatch?.lista_nome || dispatch?.template_name || `disparo_${dispatch?.dispatch_history_id || "meta"}`,
  );
  XLSX.writeFile(workbook, `meta_disparo_${dispatchLabel}_${dateSuffix}.xlsx`);
}
