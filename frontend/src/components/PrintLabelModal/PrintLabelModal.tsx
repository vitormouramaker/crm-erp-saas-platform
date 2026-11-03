import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Modal } from "../common/Modal/Modal";
import type { Product } from "../../data/mockData";
import "./PrintLabelModal.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
};

type LabelType = "EARRING" | "RECT_90x30" | "RECT_90x50";
type LabelField = "name" | "sku" | "price" | "barcode";
type LabelOptions = Record<LabelField, boolean>;

const DEFAULT_OPTIONS: LabelOptions = {
  name: true,
  sku: true,
  price: true,
  barcode: true,
};

const FIELD_LABELS: Array<{ key: LabelField; label: string }> = [
  { key: "name", label: "Nome" },
  { key: "sku", label: "Codigo" },
  { key: "price", label: "Valor" },
  { key: "barcode", label: "Barcode" },
];

const LABEL_TYPES: Record<
  LabelType,
  {
    name: string;
    widthMm: number;
    heightMm: number;
    contentWidthMm?: number;
    tailMm?: number;
    leftMm?: number;
    barcodeWidthMm: number;
  }
> = {
  EARRING: {
    name: "Modelo 95x12 (Largura: 60mm + 35mm)",
    widthMm: 95,
    heightMm: 12,
    contentWidthMm: 60,
    tailMm: 35,
    leftMm: 30,
    barcodeWidthMm: 20,
  },
  RECT_90x30: {
    name: "Modelo 90x30",
    widthMm: 90,
    heightMm: 30,
    barcodeWidthMm: 20,
  },
  RECT_90x50: {
    name: "Modelo 90x50",
    widthMm: 90,
    heightMm: 50,
    barcodeWidthMm: 20,
  },
};

function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parsePriceInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return Number(digits || "0") / 100;
}

function buildPrintCss(cfg: {
  widthMm: number;
  heightMm: number;
  barcodeWidthMm: number;
  contentWidthMm?: number;
  tailMm?: number;
  leftMm?: number;
}) {
  const {
    widthMm,
    heightMm,
    barcodeWidthMm,
    contentWidthMm = widthMm,
    tailMm = 0,
    leftMm = Math.max(10, contentWidthMm - barcodeWidthMm),
  } = cfg;

  return `
    @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: Arial, sans-serif;
    }

    /* papel total */
    .label-print-root { width: ${widthMm}mm; height: ${heightMm}mm; overflow: hidden; }

    /* wrapper horizontal: conteúdo + perninha (quando existir) */
    .label-row { display: flex; width: 100%; height: 100%; }

    /* área útil impressa */
    .label-content {
      width: ${contentWidthMm}mm;
      height: ${heightMm}mm;
      padding: 1mm;
      margin-left: 8mm;
      color: #000;
    }

    /* perninha (vazia) */
    .label-tail {
      width: ${tailMm}mm;
      height: ${heightMm}mm;
    }

    /* EARRING: A (texto) + B (barcode) com medidas fixas */
    .label-earring {
      display: grid;
      grid-template-columns: ${leftMm}mm ${barcodeWidthMm}mm;
      gap: 0;
      align-items: center;
    }

    /* Layout padrão: texto flexível + barcode fixo */
    .label-dual {
      display: grid;
      grid-template-columns: 1fr ${barcodeWidthMm}mm;
      gap: 1.5mm;
      align-items: center;
    }

    .label-left {
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.8mm;
      padding-right: 1mm;
    }

    /* Tipografia para térmica (compacta e legível) */
    .label-name {
      font-size: 7pt;
      text-transform: uppercase;
      font-weight: 700;
      line-height: 1.05;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .label-sku {
      font-size: 6pt;
      line-height: 1.05;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .label-price {
      font-size: 6pt;
      font-weight: 900;
      line-height: 1.05;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .label-right {
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }

    .label-barcode {
      width: ${barcodeWidthMm}mm;
      height: ${Math.max(10, heightMm - 2)}mm;
    }

    /* Template simples */
    .label-simple {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1.2mm;
      padding: 1mm;
      width: ${contentWidthMm}mm;
      height: ${heightMm}mm;
    }

    /* Template preço grande */
    .label-price-only {
      display: flex;
      align-items: center;
      justify-content: center;
      height: ${heightMm}mm;
      width: ${contentWidthMm}mm;
      font-size: 18pt;
      font-weight: 900;
    }
  `;
}

function EarringTypeIcon() {
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" aria-hidden="true" focusable="false" fill="currentColor">
      <rect x="3" y="9" width="32" height="14" rx="3" />
      <rect x="21" y="9" width="1" height="14" />
      <rect x="35" y="15" width="10" height="2" rx="1" />
    </svg>
  );
}

function Rect90x30Icon() {
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" aria-hidden="true" focusable="false" fill="currentColor">
      <rect x="4" y="11" width="40" height="10" rx="2" />
      <rect x="30" y="11" width="1" height="10" />
    </svg>
  );
}

function Rect90x50Icon() {
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" aria-hidden="true" focusable="false" fill="currentColor">
      <rect x="4" y="8" width="40" height="16" rx="2" />
      <rect x="30" y="8" width="1" height="16" />
    </svg>
  );
}

function getTypeIcon(type: LabelType) {
  switch (type) {
    case "EARRING":
      return <EarringTypeIcon />;
    case "RECT_90x30":
      return <Rect90x30Icon />;
    case "RECT_90x50":
      return <Rect90x50Icon />;
    default:
      return null;
  }
}

export function PrintLabelModal({ isOpen, onClose, product }: Props) {
  const [labelType, setLabelType] = useState<LabelType>("EARRING");
  const [printName, setPrintName] = useState("");
  const [printSku, setPrintSku] = useState("");
  const [printPriceInput, setPrintPriceInput] = useState("");
  const [options, setOptions] = useState<LabelOptions>(DEFAULT_OPTIONS);

  const printRef = useRef<HTMLDivElement | null>(null);
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  const labelData = useMemo(() => {
    if (!product) return null;

    return {
      name: product.name || "",
      sku: product.sku != null ? String(product.sku) : "",
      salePrice: product.salePrice || 0,
    };
  }, [product]);

  useEffect(() => {
    if (!isOpen) return;

    setPrintName(labelData?.name || "");
    setPrintSku(labelData?.sku || "");
    setPrintPriceInput(formatPrice(labelData?.salePrice || 0));
    setOptions(DEFAULT_OPTIONS);
  }, [isOpen, labelData?.name, labelData?.salePrice, labelData?.sku]);

  const formattedPrintPrice = useMemo(() => {
    return formatPrice(parsePriceInput(printPriceInput));
  }, [printPriceInput]);

  const showBarcode = options.barcode && Boolean(printSku.trim());

  useEffect(() => {
    if (!isOpen) return;
    if (!showBarcode) return;
    if (!barcodeRef.current) return;

    const cfg = LABEL_TYPES[labelType];

    try {
      while (barcodeRef.current.firstChild) {
        barcodeRef.current.removeChild(barcodeRef.current.firstChild);
      }

      const heightPx = Math.round(cfg.heightMm * 2.2);
      JsBarcode(barcodeRef.current, printSku, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height: Math.max(28, Math.min(120, heightPx)),
      });
    } catch (error) {
      console.error("Erro ao gerar barcode:", error);
    }
  }, [isOpen, showBarcode, printSku, labelType]);

  const toggleOption = (field: LabelField) => {
    setOptions((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const renderTextContent = () => (
    <div className="label-left">
      {options.name && <div className="label-name">{printName}</div>}
      {options.sku && <div className="label-sku">Codigo: {printSku}</div>}
      {options.price && <div className="label-price">{formattedPrintPrice}</div>}
    </div>
  );

  const renderPreviewContent = () => {
    const barcodeClassName = `label-barcode ${showBarcode ? "" : "label-barcode-hidden"}`.trim();

    if (labelType === "EARRING") {
      return (
        <div className="label-row">
          <div className="label-content label-earring preview-content">
            {renderTextContent()}
            <div className="label-right">
              <svg ref={barcodeRef} className={barcodeClassName} />
            </div>
          </div>
          <div className="label-tail" />
        </div>
      );
    }

    return (
      <div className="label-content label-dual preview-content">
        {renderTextContent()}
        <div className="label-right">
          <svg ref={barcodeRef} className={barcodeClassName} />
        </div>
      </div>
    );
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const cfg = LABEL_TYPES[labelType];
    const printCss = buildPrintCss(cfg);
    const w = window.open("", "PRINT", "height=600,width=800");

    if (!w) return;

    const html = `
      <html>
        <head><title>Etiqueta</title><style>${printCss}</style></head>
        <body>
          <div class="label-print-root">
            ${printRef.current.innerHTML}
          </div>
          <script>
            window.focus(); window.print(); window.close();
          </script>
        </body>
      </html>
    `;

    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Imprimir etiqueta">
      {!labelData ? (
        <p>Selecione um produto.</p>
      ) : (
        <div className="print-label-modal">
          <div className="label-type-selector">
            {Object.entries(LABEL_TYPES).map(([id, cfg]) => {
              const type = id as LabelType;
              const isActive = labelType === type;

              return (
                <button
                  key={id}
                  type="button"
                  className={`label-type-button ${isActive ? "active" : ""}`}
                  onClick={() => setLabelType(type)}
                  aria-pressed={isActive}
                  title={cfg.name}
                >
                  <div className="label-type-icon">{getTypeIcon(type)}</div>
                  <span className="label-type-name">{cfg.name}</span>
                </button>
              );
            })}
          </div>

          <div className="print-fields">
            <div className="print-name-row">
              <span>Nome produto:</span>
              <div className="print-name-controls">
                <input
                  type="text"
                  value={printName}
                  onChange={(e) => setPrintName(e.target.value)}
                  placeholder="Nome que vai na etiqueta"
                />
                <button type="button" className="btn-secondary" onClick={() => setPrintName(labelData.name)}>
                  Resetar
                </button>
              </div>
            </div>

            <div className="print-name-row">
              <span>Codigo:</span>
              <div className="print-name-controls">
                <input
                  type="text"
                  value={printSku}
                  onChange={(e) => setPrintSku(e.target.value)}
                  placeholder="Codigo que vai na etiqueta"
                />
                <button type="button" className="btn-secondary" onClick={() => setPrintSku(labelData.sku)}>
                  Resetar
                </button>
              </div>
            </div>

            <div className="print-name-row">
              <span>Valor:</span>
              <div className="print-name-controls">
                <input
                  type="text"
                  inputMode="numeric"
                  value={printPriceInput}
                  onChange={(e) => setPrintPriceInput(formatPrice(parsePriceInput(e.target.value)))}
                  placeholder="Valor que vai na etiqueta"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPrintPriceInput(formatPrice(labelData.salePrice))}
                >
                  Resetar
                </button>
              </div>
            </div>
          </div>

          <div className="label-options-section">
            <span className="label-options-title">Compor impressão:</span>
            <div className="label-options-grid">
              {FIELD_LABELS.map((field) => (
                <label
                  key={field.key}
                  className={`label-option-card ${options[field.key] ? "checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={options[field.key]}
                    onChange={() => toggleOption(field.key)}
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="label-preview" ref={printRef}>
            {renderPreviewContent()}
          </div>

          <div className="label-actions">
            <button className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-primary-print" onClick={handlePrint}>
              Imprimir
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
