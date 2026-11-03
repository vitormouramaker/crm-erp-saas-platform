import { useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { salesData } from '../../data/mockData';
import type { Sale } from '../../data/mockData';
import './SalesHistory.css';

export function SalesHistory() {
  const [sales, _] = useState<Sale[]>(salesData);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // --- Documentação para o Backend ---
  //
  // ROTA PARA LISTAR VENDAS:
  //    - O backend precisa criar uma rota GET /vendas
  //    - Esta rota deve retornar um array de objetos, onde cada objeto
  //      corresponde à interface 'Sale' definida em 'mockData.ts'.
  //    - useEffect(() => {
  //    -   api.get('/vendas').then(response => setSales(response.data.data));
  //    - }, []);

  const toggleExpandSale = (saleId: string) => {
    setExpandedSaleId(prevId => (prevId === saleId ? null : saleId));
  };

  return (
    <div className="sales-history-container">
      <div className="sales-grid">
        {sales.map(sale => (
          <div key={sale.id} className="sale-card">
            <div className="sale-card-header" onClick={() => toggleExpandSale(sale.id)}>
              <div className="header-info">
                <span className="sale-id">#{sale.id}</span>
                <span className="sale-customer">{sale.customerName}</span>
              </div>
              <div className="header-summary">
                <span className="sale-date">{new Date(sale.date).toLocaleString('pt-BR')}</span>
                <span className="sale-total">{sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                <button className="expand-button">
                  {expandedSaleId === sale.id ? <FiChevronUp /> : <FiChevronDown />}
                </button>
              </div>
            </div>
            {expandedSaleId === sale.id && (
              <div className="sale-card-details">
                <div className="details-items-header">
                  <span>Produto</span>
                  <span>Filial</span>
                  <span>Estoque</span>
                  <span>Qtd.</span>
                  <span>Vlr. Unit.</span>
                  <span>Subtotal</span>
                </div>
                {sale.items.map(item => (
                  <div className="details-item-row" key={item.productId}>
                    <span>{item.productName}</span>
                    <span>{item.filial}</span>
                    <span>{item.stockType === 'mainStock' ? 'Comum' : 'Vitrine'}</span>
                    <span>{item.quantity}</span>
                    <span>{item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span>{(item.quantity * item.unitPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                ))}
                <div className="details-summary">
                  <div>Subtotal: {sale.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  <div>Desconto: - {sale.discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                  <div className="grand-total">Total: {sale.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}