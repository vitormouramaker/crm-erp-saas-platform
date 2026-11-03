import { useEffect, useMemo, useState } from "react";
import type { CommercialDomainOption } from "../../../service/commercialService";
import "./RegisterInteractionModal.css";

type RegisterInteractionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  interactionTypes: CommercialDomainOption[];
  onConfirm: (payload: {
    type: string;
    description: string;
    date?: string;
    endDate?: string;
    isCurrent?: boolean;
    value?: number;
  }) => Promise<void>;
};

function toLocalDateTimeInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoIfValid(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function RegisterInteractionModal({
  isOpen,
  onClose,
  interactionTypes,
  onConfirm,
}: RegisterInteractionModalProps) {
  const typeOptions = useMemo(
    () =>
      interactionTypes.filter(
        (item) =>
          item.ativo !== false &&
          (item.categoria || "interacao") === "interacao"
      ),
    [interactionTypes]
  );
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [dateStart, setDateStart] = useState(toLocalDateTimeInputValue());
  const [dateEnd, setDateEnd] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [value, setValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setType(typeOptions[0]?.codigo || "");
    setDescription("");
    setDateStart(toLocalDateTimeInputValue());
    setDateEnd("");
    setIsCurrent(false);
    setValue("");
  }, [isOpen, typeOptions]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content register-interaction-modal">
        <div className="modal-header">
          <h3>Registrar interacao</h3>
          <button className="close-btn" onClick={onClose} disabled={saving}>
            &times;
          </button>
        </div>

        <form
          className="modal-body"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!type || !description.trim()) return;

            setSaving(true);
            try {
              await onConfirm({
                type,
                description: description.trim(),
                date: toIsoIfValid(dateStart),
                endDate: isCurrent ? undefined : toIsoIfValid(dateEnd),
                isCurrent,
                value: value.trim() ? Number(value) : undefined,
              });
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="form-group">
            <label>Tipo da interacao *</label>
            <select required value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Selecione...</option>
              {typeOptions.map((item) => (
                <option key={item.id} value={item.codigo}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Data inicio *</label>
              <input
                type="datetime-local"
                required
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Data fim</label>
              <input
                type="datetime-local"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                disabled={isCurrent}
              />
            </div>
          </div>

          <label className="interaction-checkbox">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
            />
            Interacao em andamento
          </label>

          <div className="form-group">
            <label>Valor (opcional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="form-group">
            <label>Descricao *</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva a troca de mensagens, ligacao ou acao realizada..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn-confirm" disabled={saving}>
              {saving ? "Salvando..." : "Salvar interacao"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegisterInteractionModal;
