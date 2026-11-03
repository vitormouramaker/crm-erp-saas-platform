import { useState, useMemo } from 'react';
import { productsData } from '../../data/mockData';
import type { Product, SaleItem } from '../../data/mockData';
import { FiSearch, FiTrash2 } from 'react-icons/fi';
import './RegisterSaleForm.css';

export function RegisterSaleForm() {
  const [searchTerm, setSearchTerm] = useState('');
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [discount, setDiscount] = useState(0);

  const suggestedProducts = useMemo(() => {
    if (searchTerm.length < 2) return [];
    return productsData.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const addProductToCart = (product: Product) => {
    // Adiciona o item ao carrinho com valores padrão
    const newItem: SaleItem = {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: 1,
      unitPrice: product.salePrice,
      filial: product.stockByFilial[0]?.filial || '', // Pega a primeira filial como padrão
      stockType: 'mainStock',
    };
    setCartItems(prev => [...prev, newItem]);
    setSearchTerm(''); // Limpa a busca
  };

  const updateCartItem = (index: number, field: keyof SaleItem, value: any) => {
    const newItems = [...cartItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setCartItems(newItems);
  };
  
  const removeCartItem = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cartItems]);
  const total = subtotal - discount;

  const handleRegisterSale = () => {
    // --- Documentação para o Backend ---
    // 1. A ROTA DEVE SER: POST /vendas
    // 2. O PAYLOAD DEVE CONTER: { customerName: 'Cliente Balcão', discount, items: cartItems }
    // 3. O BACKEND DEVE:
    //    - Criar um registro de venda.
    //    - Para CADA item no array 'items', DECREMENTAR a quantidade do estoque correspondente.
    //      Ex: Se item.stockType === 'mainStock', diminuir de 'mainStock' na 'filial' especificada.
    //    - Retornar sucesso.
    console.log({
      customerName: 'Cliente Balcão', // Adicionar campo para cliente no futuro
      items: cartItems,
      discount,
      total,
    });
    alert('Venda registrada com sucesso (simulação)! O estoque seria deduzido agora.');
    setCartItems([]);
    setDiscount(0);
  };

  return (
    <div className="register-sale-container">
      <div className="search-section">
        <div className="search-input-wrapper">
          <FiSearch />
          <input 
            type="text"
            placeholder="Digite o nome ou código de barras do produto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {suggestedProducts.length > 0 && (
          <ul className="product-suggestions">
            {suggestedProducts.map(p => (
              <li key={p.id} onClick={() => addProductToCart(p)}>
                {p.name} <span>({p.sku})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cart-section">
        <div className="cart-header">
          <span>Produto</span>
          <span>Filial</span>
          <span>Estoque</span>
          <span>Qtd.</span>
          <span>Vlr. Unit.</span>
          <span>Subtotal</span>
          <span></span>
        </div>
        {cartItems.map((item, index) => (
          <div className="cart-item-row" key={index}>
            <span>{item.productName}</span>
            <select value={item.filial} onChange={e => updateCartItem(index, 'filial', e.target.value)}>
              {productsData.find(p => p.id === item.productId)?.stockByFilial.map(s => <option key={s.filial} value={s.filial}>{s.filial}</option>)}
            </select>
            <select value={item.stockType} onChange={e => updateCartItem(index, 'stockType', e.target.value)}>
              <option value="mainStock">Comum</option>
              <option value="showcaseStock">Vitrine</option>
            </select>
            <input type="number" min="1" value={item.quantity} onChange={e => updateCartItem(index, 'quantity', Number(e.target.value))} />
            <input type="number" step="0.01" value={item.unitPrice} onChange={e => updateCartItem(index, 'unitPrice', Number(e.target.value))} />
            <span>{(item.unitPrice * item.quantity).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
            <button onClick={() => removeCartItem(index)}><FiTrash2/></button>
          </div>
        ))}
      </div>

      <div className="summary-section">
        <div className="totals">
          <div className="total-row"><span>Subtotal:</span><span>{subtotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span></div>
          <div className="total-row discount">
            <label>Desconto (R$):</label>
            <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
          </div>
          <div className="total-row grand-total"><span>Total:</span><span>{total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span></div>
        </div>
        <button className="register-sale-btn" onClick={handleRegisterSale} disabled={cartItems.length === 0}>
          Registrar Venda
        </button>
      </div>
    </div>
  );
}