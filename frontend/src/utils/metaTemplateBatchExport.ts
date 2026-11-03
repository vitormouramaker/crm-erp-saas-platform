import * as XLSX from "xlsx";
import type {
  BatchDispatchResultItem,
  BatchDispatchTemplateResult,
} from "../service/metaService";

function sanitizeSheetName(value: string) {
  return value.slice(0, 31) || "Planilha";
}

function slugifyFilename(value: string) {
  return (
    String(value || "lote")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "lote"
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

function mapSuccessRow(item: BatchDispatchResultItem) {
  return {
    Cliente: item.contato_nome || "",
    Telefone: item.numero || item.numero_original || "",
    Email: item.email || "",
    "Message ID": item.message_id || "",
    Status: item.message_status || "",
    "Enviado em": formatDateTime(item.enviado_em),
    "Recebido em": formatDateTime(item.recebido_em),
    "Custo unitario USD": Number(item.custo_unitario || 0),
    "Valor cobrado USD": Number(item.valor_cobrado || 0),
  };
}

function mapFailureRow(item: BatchDispatchResultItem) {
  return {
    Cliente: item.contato_nome || "",
    Telefone: item.numero || item.numero_original || "",
    Email: item.email || "",
    "Mensagem de erro": item.error_message || "",
    "Codigo": item.error_code ?? "",
    "Subcodigo": item.error_subcode ?? "",
    "Tipo": item.error_type || "",
    "Falhou em": formatDateTime(item.erro_em),
  };
}

export function exportMetaTemplateBatchReport(params: {
  report: BatchDispatchTemplateResult;
  templateName: string;
}) {
  const workbook = XLSX.utils.book_new();
  const successItems = Array.isArray(params.report.results)
    ? params.report.results.filter((item) => item.success)
    : [];
  const failureItems = Array.isArray(params.report.results)
    ? params.report.results.filter((item) => !item.success)
    : [];

  const summaryRows = [
    {
      "ID do disparo": params.report.dispatch_history_id ?? "",
      "ID do template": params.report.template_id ?? "",
      Template: params.report.template_name || params.templateName || "",
      Categoria: params.report.template_category || "",
      Idioma: params.report.language || "",
      "Lista de transmissao": params.report.lista_transmissao_id ?? "",
      "Total alvo": Number(params.report.total_items || 0),
      Processados: Number(params.report.processed_items || 0),
      Enviados: Number(params.report.success_count || 0),
      Falhas: Number(params.report.error_count || 0),
      "Duracao (ms)": Number(params.report.duration_ms || 0),
      "Inicio do lote": formatDateTime(params.report.started_at),
      "Fim do lote": formatDateTime(params.report.finished_at),
      "Custo unitario USD": Number(params.report.cost_summary?.summary?.unit_cost || 0),
      "Custo total USD": Number(params.report.cost_summary?.summary?.total_cost || 0),
      "Modelo de custo": params.report.cost_summary?.pricing_source || "",
      "Observacao de custo": params.report.cost_summary?.message || "",
    },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(summaryRows),
    sanitizeSheetName("Resumo"),
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      successItems.length ? successItems.map(mapSuccessRow) : [{ Aviso: "Nenhum envio concluido." }],
    ),
    sanitizeSheetName("Enviados"),
  );

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      failureItems.length ? failureItems.map(mapFailureRow) : [{ Aviso: "Nenhuma falha registrada." }],
    ),
    sanitizeSheetName("Falhas"),
  );

  const dateSuffix = new Date().toISOString().slice(0, 10);
  const templateSlug = slugifyFilename(params.report.template_name || params.templateName || "template");
  XLSX.writeFile(
    workbook,
    `meta_template_lote_${templateSlug}_${dateSuffix}.xlsx`,
  );
}
