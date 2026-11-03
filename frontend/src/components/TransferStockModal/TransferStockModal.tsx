import { useState, useMemo } from "react";
import type { Product, Branch } from "../../data/mockData";
import "./TransferStockModal.css";
import { API_BASE } from "../../config/api";
import { encrypt, decrypt } from "../../utils/cripto";
import { useAuth } from "../../contexts/AuthContext";

interface TransferStockModalProps {
  product: Product;
  branches: Branch[];
  onClose: () => void;
  onTransfer: (fromFilial: { id: number; name: string }, toFilial: { id: number; name: string }, quantity: number) => void;
}

export function TransferStockModal({ product, branches, onClose }: TransferStockModalProps) {
  const { user } = useAuth();
  const [fromFilial, setFromFilial] = useState<{ id: number; name: string } | null>(null);
  const [toFilial, setToFilial] = useState<{ id: number; name: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const availableStock = useMemo(() => {
    if (!fromFilial) return 0;
    const stockLocation = product.stockByFilial.find(s => s.filial === fromFilial.name);
    return stockLocation ? stockLocation.mainStock : 0;
  }, [fromFilial, product.stockByFilial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromFilial || !toFilial) {
      alert('Selecione as filiais de origem e destino.');
      return;
    }

    if (quantity > availableStock) {
      alert("A quantidade a transferir nao pode ser maior que o estoque da filial de origem.");
      return;
    }

    try {
      setLoading(true);
      if (!user?.id) {
        alert("Usuario nao encontrado na sessao");
        return;
      }

      const encrypted = await encrypt({
        productId: product.id,
        fromFilial,
        toFilial,
        quantity,
        usuario_id: user.id,
      });

      const response = await fetch(`${API_BASE}/estoque/cadastro_movimentacao`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = await decrypt(respData.payload);

      if (!resp?.boleano) {
        console.error('Falha ao registrar transferencia:', resp?.mensagem);
      } else {
        alert('Registro de transferencia realizada com sucesso!');
        onClose();
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      alert("Erro de comunicacao com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="transfer-stock-form">
      <h4>Transferir estoque de: <strong>{product.name}</strong></h4>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="fromFilial">De</label>
          <select
            id="fromFilial"
            value={fromFilial?.id || ''}
            onChange={e => {
              const selected = branches.find(b => b.id === Number(e.target.value));
              if (selected) setFromFilial({ id: selected.id, name: selected.name });
            }}
            required
          >
            <option value="" disabled>Filial de Origem</option>
            {branches.map(b => {
              const stock = product.stockByFilial.find(s => s.filial === b.name)?.mainStock || 0;
              return (
                <option key={b.id} value={b.id}>
                  {b.name} - {stock} unid.
                </option>
              );
            })}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="toFilial">Para</label>
          <select
            id="toFilial"
            value={toFilial ? toFilial.id : ''}
            onChange={e => {
              const selected = branches.find(b => b.id === Number(e.target.value));
              if (selected) {
                setToFilial({ id: selected.id, name: selected.name });
              }
            }}
            required
          >
            <option value="" disabled>Filial de Destino</option>
            {branches
              .filter(b => !fromFilial || b.name !== fromFilial.name)
              .map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="quantity">Quantidade</label>
        <input
          id="quantity"
          type="number"
          value={quantity}
          onChange={e => setQuantity(Number(e.target.value))}
          min="1"
          max={availableStock}
          required
        />
        {fromFilial && (
          <small>Estoque disponivel para transferir: {availableStock}</small>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-button" onClick={onClose} disabled={loading}>
          Cancelar
        </button>
        <button type="submit" className="save-button" disabled={loading}>
          {loading ? "Transferindo..." : "Transferir"}
        </button>
      </div>
    </form>
  );
}
