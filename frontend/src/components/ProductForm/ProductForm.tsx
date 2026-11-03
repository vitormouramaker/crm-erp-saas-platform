import { useState, useEffect, useMemo } from "react";
import { Input } from "../common/Input/Input";
import type { Product, Branch, Category, Supplier } from "../../data/mockData";
import { suppliersData } from "../../data/mockData"; // Fallback de dados
import { FiPlusCircle, FiMinusCircle, FiX } from "react-icons/fi";
import "./ProductForm.css";
import { API_BASE } from "../../config/api";
import { encrypt, decrypt } from "../../utils/cripto";
import { useAuth } from "../../contexts/AuthContext";

type ProductCreationData = Omit<Product, "id" | "movementHistory">;

interface ProductFormProps {
  onSave: (
    productData: ProductCreationData | Omit<Product, "movementHistory">
  ) => void;
  onCancel: () => void;
  onOpenImport?: () => void;   // Ã¢Å“â€¦ NOVO
  initialData?: Product | null;
  branches: Branch[];
  categories: Category[];
  suppliers: Supplier[];
}

export function ProductForm({
  onSave,
  onCancel,
  onOpenImport,
  initialData,
  branches,
  categories,
  suppliers,
}: ProductFormProps) {
  const { user } = useAuth();
  // --- MUDANÃƒâ€¡A 1: PreÃƒÂ§os agora sÃƒÂ£o strings no estado ---
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    costPrice: "0,00", // Armazenado como string formatada
    salePrice: "0,00", // Armazenado como string formatada
  });
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState("");

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  );
  const [supplierSearch, setSupplierSearch] = useState("");
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);

  const [showSecondary, setShowSecondary] = useState(false);
  const [secondaryStocks, setSecondaryStocks] = useState<
    { branchId: string; quantity: number }[]
  >([]);
  const [showShowcaseStock, setShowShowcaseStock] = useState(false);
  const [showcaseStocks, setShowcaseStocks] = useState<
    { branchId: string; quantity: number }[]
  >([]);
  const [isSoldByWeight, setIsSoldByWeight] = useState(false);
  const [lastRegisteredSku, setLastRegisteredSku] = useState("");


  const isEditing = !!initialData;

  useEffect(() => {
    const fetchLastRegisteredSku = async () => {
      if (isEditing || !user?.empresa_id) {
        setLastRegisteredSku("");
        return;
      }

      try {
        const encrypted = await encrypt({ empresa_id: user.empresa_id });
        const response = await fetch(`${API_BASE}/estoque/ultimo_produto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });

        const respData = await response.json();
        const resp = (await decrypt(respData.payload)) as {
          obj?: {
            sku?: string | number | null;
            cd_barra?: string | number | null;
          } | null;
        };
        const sku = resp?.obj?.sku ?? resp?.obj?.cd_barra;
        setLastRegisteredSku(sku != null ? String(sku) : "");
      } catch {
        setLastRegisteredSku("");
      }
    };

    fetchLastRegisteredSku();
  }, [isEditing, user?.empresa_id]);

  // --- EFEITO PRINCIPAL DE INICIALIZAÃƒâ€¡ÃƒÆ’O ---
  useEffect(() => {
    if (initialData) {
      const resolveBranchId = (stock: { id: number; filial: string }) => {
        if (Number.isFinite(Number(stock?.id))) {
          const byId = branches.find((b) => b.id === Number(stock.id));
          if (byId) return String(byId.id);
        }

        const byName = branches.find((b) => b.name === stock.filial);
        return byName ? String(byName.id) : "";
      };

      const secondaries = initialData.stockByFilial
        .filter((s) => s.mainStock > 0)
        .map((s) => {
          return {
            branchId: resolveBranchId(s),
            quantity: s.mainStock,
          };
        })
        .filter((s) => s.branchId !== "");

      const showcases = initialData.stockByFilial
        .filter((s) => s.showcaseStock > 0)
        .map((s) => {
          return {
            branchId: resolveBranchId(s),
            quantity: s.showcaseStock,
          };
        })
        .filter((s) => s.branchId !== "");

      // --- MUDANÃƒâ€¡A 2: Converte nÃƒÂºmeros para string formatada com vÃƒÂ­rgula ---
      setFormData({
        name: initialData.name,
        sku: initialData.sku,
        costPrice: (initialData.costPrice || 0).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
        salePrice: (initialData.salePrice || 0).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      });

      setSelectedCategories(initialData.categories || []);

      const foundSupplier = suppliers.find(
        (s) => s.name === initialData.supplierName
      );
      const supplierToSet =
        foundSupplier ||
        (initialData.supplierName
          ? {
            id: 0,
            name: initialData.supplierName,
            contactPerson: "",
            phone: "",
            email: "",
            cnpj: "",
          }
          : null);

      setSelectedSupplier(supplierToSet);
      setSupplierSearch(supplierToSet?.name || "");

      setSecondaryStocks(secondaries);
      setShowSecondary(secondaries.length > 0);
      setShowcaseStocks(showcases);
      setShowShowcaseStock(showcases.length > 0);
      setIsSoldByWeight(initialData.isSoldByWeight === true);
    } else {
      // Reset para criaÃƒÂ§ÃƒÂ£o
      // --- MUDANÃƒâ€¡A 3: Reseta preÃƒÂ§os como string ---
      setFormData({ name: "", sku: "", costPrice: "0,00", salePrice: "0,00" });
      setSelectedCategories([]);
      setSelectedSupplier(null);
      setSupplierSearch("");
      setShowSecondary(false);
      setSecondaryStocks([]);
      setShowShowcaseStock(false);
      setShowcaseStocks([]);
      setIsSoldByWeight(false);
    }
  }, [initialData, branches, suppliers]);

  // Filtro de categorias
  const suggestedCategories = useMemo(() => {
    if (categorySearch.length < 1) return [];
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(categorySearch.toLowerCase()) &&
        !selectedCategories.some((sc) => sc.id === c.id)
    );
  }, [categorySearch, categories, selectedCategories]);

  // Busca dinÃƒÂ¢mica de fornecedores
  useEffect(() => {
    if (supplierSearch.trim().length < 1) {
      setFilteredSuppliers([]);
      return;
    }
    if (selectedSupplier && selectedSupplier.name === supplierSearch) {
      return;
    }

    const fetchSuppliers = async () => {
      try {
        if (!user?.empresa_id) return;

        const encrypted = await encrypt({ empresa_id: user.empresa_id });

        const response = await fetch(`${API_BASE}/estoque/lista_fabricante`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: encrypted }),
        });

        const respData = await response.json();
        const resp = await decrypt(respData.payload);

        const data: Supplier[] = Array.isArray(resp?.obj) ? resp.obj : [];

        setFilteredSuppliers(
          data.filter((s) =>
            s.name.toLowerCase().includes(supplierSearch.toLowerCase())
          )
        );
      } catch (error) {
        setFilteredSuppliers(
          suppliersData.filter((s) =>
            s.name.toLowerCase().includes(supplierSearch.toLowerCase())
          )
        );
      }
    };

    const timeoutId = setTimeout(() => {
      fetchSuppliers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [supplierSearch, selectedSupplier, user?.empresa_id]);

  const handleAddCategory = (category: Category) => {
    setSelectedCategories((prev) => [...prev, category]);
    setCategorySearch("");
  };

  const handleRemoveCategory = (categoryId: number) => {
    setSelectedCategories((prev) => prev.filter((c) => c.id !== categoryId));
  };

  // --- MUDANÃƒâ€¡A 4: Nova lÃƒÂ³gica de handleChange para preÃƒÂ§os ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "costPrice" || name === "salePrice") {
      // 1. Limpa o valor, mantendo apenas dÃƒÂ­gitos
      let v = value.replace(/\D/g, "");

      // 2. Remove zeros ÃƒÂ  esquerda (ex: "0050" -> "50")
      v = String(parseInt(v, 10) || 0);

      // 3. Adiciona zeros ÃƒÂ  esquerda se necessÃƒÂ¡rio (ex: "1" -> "001", "12" -> "012")
      v = v.padStart(3, "0");

      // 4. Separa parte inteira e decimal
      const integerPart = v.slice(0, -2);
      const decimalPart = v.slice(-2);

      // 5. Formata a parte inteira com pontos (milhares)
      const formattedInteger = integerPart.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        "."
      );

      // 6. Junta tudo e salva no estado
      setFormData((prev) => ({
        ...prev,
        [name]: `${formattedInteger},${decimalPart}`,
      }));
    } else {
      // LÃƒÂ³gica para outros campos (name, sku, etc.)
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSupplierSearch(supplier.name);
    setFilteredSuppliers([]);
  };

  const handleDynamicChange = (
    index: number,
    field: "branchId" | "quantity",
    value: string,
    type: "secondary" | "showcase"
  ) => {
    const list = type === "secondary" ? secondaryStocks : showcaseStocks;
    const setter =
      type === "secondary" ? setSecondaryStocks : setShowcaseStocks;
    const updated = [...list];
    updated[index] = {
      ...updated[index],
      [field]: field === "quantity" ? parseInt(value) || 0 : value,
    };
    setter(updated);
  };

  const addDynamicRow = (type: "secondary" | "showcase") => {
    const setter =
      type === "secondary" ? setSecondaryStocks : setShowcaseStocks;
    setter((prev) => [...prev, { branchId: "", quantity: 0 }]);
  };

  const removeDynamicRow = (index: number, type: "secondary" | "showcase") => {
    const setter =
      type === "secondary" ? setSecondaryStocks : setShowcaseStocks;
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStockToggle = (
    checked: boolean,
    type: "secondary" | "showcase"
  ) => {
    const stocks = type === "secondary" ? secondaryStocks : showcaseStocks;
    const setVisible =
      type === "secondary" ? setShowSecondary : setShowShowcaseStock;

    setVisible(checked);
    if (checked && stocks.length === 0) {
      addDynamicRow(type);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSupplier) {
      alert("Por favor, selecione um fornecedor válido.");
      return;
    }

    const stockMap = new Map<
      number,
      { filial: string; mainStock: number; showcaseStock: number }
    >();

    branches.forEach((b) => {
      stockMap.set(b.id, { filial: b.name, mainStock: 0, showcaseStock: 0 });
    });

    if (showSecondary) {
      secondaryStocks.forEach((s) => {
        const branchId = Number(s.branchId);
        if (Number.isFinite(branchId) && stockMap.has(branchId)) {
          const existing = stockMap.get(branchId) || {
            filial: "",
            mainStock: 0,
            showcaseStock: 0,
          };
          stockMap.set(branchId, {
            ...existing,
            mainStock: s.quantity,
          });
        }
      });
    }

    if (showShowcaseStock) {
      showcaseStocks.forEach((s) => {
        const branchId = Number(s.branchId);
        if (Number.isFinite(branchId) && stockMap.has(branchId)) {
          const existing = stockMap.get(branchId) || {
            filial: "",
            mainStock: 0,
            showcaseStock: 0,
          };
          stockMap.set(branchId, { ...existing, showcaseStock: s.quantity });
        }
      });
    }

    const selectedStockBranchIds = new Set<number>();
    if (showSecondary) {
      secondaryStocks.forEach((stock) => {
        const branchId = Number(stock.branchId);
        if (Number.isFinite(branchId)) selectedStockBranchIds.add(branchId);
      });
    }
    if (showShowcaseStock) {
      showcaseStocks.forEach((stock) => {
        const branchId = Number(stock.branchId);
        if (Number.isFinite(branchId)) selectedStockBranchIds.add(branchId);
      });
    }

    const stockByFilial = Array.from(stockMap.entries())
      .map(([branchId, stocks]) => ({
        id: branchId,
        filial: stocks.filial,
        mainStock: stocks.mainStock,
        showcaseStock: stocks.showcaseStock,
      }))
      .filter(
        (s) =>
          s.mainStock > 0 ||
          s.showcaseStock > 0 ||
          (isEditing && selectedStockBranchIds.has(s.id))
      );

    // --- MUDANÃƒâ€¡A 5: Converte a string (ex: "16,99") para nÃƒÂºmero (ex: 16.99) ANTES de salvar ---
    const finalCostPrice =
      parseFloat(formData.costPrice.replace(/\./g, "").replace(",", ".")) || 0;
    const finalSalePrice =
      parseFloat(formData.salePrice.replace(/\./g, "").replace(",", ".")) || 0;

    const productToSave = {
      name: formData.name,
      sku: formData.sku,
      costPrice: finalCostPrice, // Sobrescreve com o nÃƒÂºmero
      salePrice: finalSalePrice, // Sobrescreve com o nÃƒÂºmero
      categories: selectedCategories,
      supplierName: selectedSupplier.name,
      isSoldByWeight: isSoldByWeight,
      stockByFilial: stockByFilial,
    };

    if (initialData) {
      onSave({ ...productToSave, id: initialData.id });
    } else {
      onSave(productToSave);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="product-form">
      <Input
        label="Nome do Produto"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
      />
      <Input
        label="Código de Barras"
        name="sku"
        value={formData.sku}
        onChange={handleChange}
        required
      />
      {!isEditing && (
        <div className="last-sku-info">
          Último código de barras cadastrado:{" "}
          <strong>{lastRegisteredSku || "nenhum"}</strong>
        </div>
      )}

      {/* Fornecedor */}
      <div className="dynamic-search-wrapper">
        <Input
          label="Fornecedor"
          name="supplierSearch"
          value={supplierSearch}
          onChange={(e) => {
            setSupplierSearch(e.target.value);
            if (selectedSupplier && e.target.value !== selectedSupplier.name) {
              setSelectedSupplier(null);
            }
          }}
          placeholder="Buscar fornecedor..."
          required
        />
        {filteredSuppliers.length > 0 && (
          <ul className="suggestions-list">
            {filteredSuppliers.map((sup) => (
              <li key={sup.id} onClick={() => handleSelectSupplier(sup)}>
                {sup.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Categorias */}
      <div className="dynamic-search-wrapper">
        <Input
          label="Categorias"
          name="categorySearch"
          value={categorySearch}
          onChange={(e) => setCategorySearch(e.target.value)}
          placeholder="Buscar categorias..."
        />
        {suggestedCategories.length > 0 && (
          <ul className="suggestions-list">
            {suggestedCategories.map((cat) => (
              <li key={cat.id} onClick={() => handleAddCategory(cat)}>
                {cat.name}
              </li>
            ))}
          </ul>
        )}

        {/* Toggle de Peso */}
        <div className="toggle-wrapper full-width">
          <label htmlFor="toggle-sold-by-weight">
            Este produto é vendido por peso (Kg)?
          </label>
          <input
            type="checkbox"
            id="toggle-sold-by-weight"
            className="toggle-switch"
            checked={isSoldByWeight}
            onChange={(e) => setIsSoldByWeight(e.target.checked)}
          />
        </div>

        <div className="selected-pills">
          {selectedCategories.map((cat) => (
            <span key={cat.id} className="pill-item">
              {cat.name}
              <button
                type="button"
                onClick={() => handleRemoveCategory(cat.id)}
              >
                <FiX size={14} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Estoque secundÃƒÂ¡rio */}
      <div className="toggle-wrapper full-width">
        <label htmlFor="toggle-secondary">Adicionar estoque em filiais?</label>
        <input
          type="checkbox"
          id="toggle-secondary"
          className="toggle-switch"
          checked={showSecondary}
          onChange={(e) => handleStockToggle(e.target.checked, "secondary")}
        />
      </div>

      {showSecondary && (
        <div className="secondary-stock-section full-width">
          <h5>Estoque Principal</h5>
          {secondaryStocks.map((stock, index) => (
            <div key={index} className="secondary-stock-row">
              <select
                value={stock.branchId}
                onChange={(e) =>
                  handleDynamicChange(
                    index,
                    "branchId",
                    e.target.value,
                    "secondary"
                  )
                }
                required
              >
                <option value="" disabled>
                  Selecione a filial...
                </option>
                {branches
                  .filter(
                    (b) =>
                      b.id === parseInt(stock.branchId) ||
                      !secondaryStocks.some((s) => s.branchId === String(b.id))
                  )
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min="0"
                placeholder="Qtd."
                value={stock.quantity}
                onChange={(e) =>
                  handleDynamicChange(
                    index,
                    "quantity",
                    e.target.value,
                    "secondary"
                  )
                }
                required
              />
              <button
                type="button"
                className="remove-row-btn"
                onClick={() => removeDynamicRow(index, "secondary")}
              >
                <FiMinusCircle />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="add-row-btn"
            onClick={() => addDynamicRow("secondary")}
          >
            <FiPlusCircle size={16} /> Adicionar filial
          </button>
        </div>
      )}

      {/* Estoque de vitrine */}
      <div className="toggle-wrapper full-width">
        <label htmlFor="toggle-showcase">Adicionar estoque de vitrine?</label>
        <input
          type="checkbox"
          id="toggle-showcase"
          className="toggle-switch"
          checked={showShowcaseStock}
          onChange={(e) => handleStockToggle(e.target.checked, "showcase")}
        />
      </div>

      {showShowcaseStock && (
        <div className="secondary-stock-section full-width">
          <h5>Estoque de Vitrine</h5>
          {showcaseStocks.map((stock, index) => (
            <div key={index} className="secondary-stock-row">
              <select
                value={stock.branchId}
                onChange={(e) =>
                  handleDynamicChange(
                    index,
                    "branchId",
                    e.target.value,
                    "showcase"
                  )
                }
                required
              >
                <option value="" disabled>
                  Selecione a filial...
                </option>
                {branches
                  .filter(
                    (b) =>
                      b.id === parseInt(stock.branchId) ||
                      !showcaseStocks.some((s) => s.branchId === String(b.id))
                  )
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min="0"
                placeholder="Qtd."
                value={stock.quantity}
                onChange={(e) =>
                  handleDynamicChange(
                    index,
                    "quantity",
                    e.target.value,
                    "showcase"
                  )
                }
                required
              />
              <button
                type="button"
                className="remove-row-btn"
                onClick={() => removeDynamicRow(index, "showcase")}
              >
                <FiMinusCircle />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="add-row-btn"
            onClick={() => addDynamicRow("showcase")}
          >
            <FiPlusCircle size={16} /> Adicionar filial de vitrine
          </button>
        </div>
      )}

      {/* --- MUDANÃƒâ€¡A 6: O 'value' agora ÃƒÂ© a string do estado --- */}
      <Input
        label={isSoldByWeight ? "Preço por (Kg)" : "Preço de Custo (R$)"}
        name="costPrice"
        type="text"
        inputMode="tel" // 'tel' abre o teclado numÃƒÂ©rico em celulares
        value={formData.costPrice}
        onChange={handleChange}
        required
      />
      <Input
        label="Preço de Venda (R$)"
        name="salePrice"
        type="text"
        inputMode="tel" // 'tel' abre o teclado numÃƒÂ©rico em celulares
        value={formData.salePrice}
        onChange={handleChange}
        required
      />

      <div className="form-actions">
        {!isEditing && onOpenImport && (
          <button
            type="button"
            className="save-button export-button"
            onClick={onOpenImport}
          >
            Importar Excel
          </button>
        )}
        <button type="button" className="cancel-button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="save-button">
          Salvar
        </button>
      </div>
    </form>
  );
}
