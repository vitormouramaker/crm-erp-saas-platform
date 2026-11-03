import { useState } from 'react';
import { MobileHeader } from '../../components/common/MobileHeader/MobileHeader';
import { ProductList } from '../../components/ProductList/ProductList';
import { SupplierList } from '../../components/SupplierList/SupplierList';
import { PurchaseOrderList } from '../../components/PurchaseOrderList/PurchaseOrderList';
import './InventoryPage.css';

type InventoryTab = 'stock' | 'suppliers' | 'purchase-orders';

export function InventoryPage() {
  const [activeTab, setActiveTab] = useState<InventoryTab>('stock');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="inventory-page-layout">
      <MobileHeader title="Estoque" />

      <header className="inventory-header">
        <h1>Gerenciamento de Estoque</h1>
      </header>
      
      <nav className="inventory-tabs">
        <button className={`tab-button ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>Estoque</button>
        <button className={`tab-button ${activeTab === 'suppliers' ? 'active' : ''}`} onClick={() => setActiveTab('suppliers')}>Fornecedores</button>
        <button className={`tab-button ${activeTab === 'purchase-orders' ? 'active' : ''}`} onClick={() => setActiveTab('purchase-orders')}>Pedidos de Compra</button>
      </nav>

      <main className="inventory-content">
        <div className="inventory-table-container">
          {activeTab === 'stock' && (
            <ProductList
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
            />
          )}
          {activeTab === 'suppliers' && <SupplierList searchTerm={searchTerm} />}
          {activeTab === 'purchase-orders' && <PurchaseOrderList searchTerm={searchTerm} />}
        </div>
      </main>
    </div>
  );
}
