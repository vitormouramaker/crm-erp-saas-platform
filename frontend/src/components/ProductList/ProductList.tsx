import { useState, useMemo, useEffect } from "react";
import {
  FiEdit,
  FiClock,
  FiPlus,
  FiDownload,
  FiSearch,
  FiMapPin,
  FiShuffle,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiTag,
  FiPrinter,
  FiBox,
  FiHash,
  FiUser,
  FiShoppingBag,
  FiDollarSign,
  FiMoreHorizontal,
} from "react-icons/fi";
import { Tooltip } from "react-tooltip";
import type {
  Product,
  MovementHistory,
  Branch,
  StockLocation,
  Category,
  Supplier,
} from "../../data/mockData";
import { Modal } from "../common/Modal/Modal";
import { ProductForm } from "../ProductForm/ProductForm";
import { TransferStockModal } from "../TransferStockModal/TransferStockModal";
import { OfferModal } from "../OfferModal/OfferModal";
import { API_BASE } from "../../config/api";
import { encrypt, decrypt } from "../../utils/cripto";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { PrintLabelModal } from "../PrintLabelModal/PrintLabelModal";
import { ImportProductsModal } from "../ImportProductsModal/ImportProductsModal";
import { exportStockWorkbook } from "../../utils/stockExport";
import type { ImportedProductPayload } from "../../utils/importProductsFromXlsx";
import "./ProductList.css";

function escapeTooltipHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeStockSearchTerm(value: string) {
  return String(value || "")
    .normalize("NFKC")
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim();
}

// Componente Timer para atualização em tempo real
const OfferTimer = ({
  endDate,
  onExpire,
}: {
  endDate: string;
  onExpire?: () => void;
}) => {
  const [items, setItems] = useState<string | null>(null);

  useEffect(() => {
    const calculate = () => {
      const difference = +new Date(endDate) - +new Date();
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
      } else {
        // Se expirar, chama o callback e retorna null
        if (onExpire) onExpire();
        return null;
      }
    };

    const initial = calculate();
    if (!initial) return; // Se já expirou no mount, o calculate acima já chamou o onExpire (cuidado com loop infinito se onExpire mudar state, melhor checar dentro do effect ou usar ref para garantir chamada única)

    setItems(initial);

    const interval = setInterval(() => {
      const res = calculate();
      if (!res) {
        clearInterval(interval);
        setItems(null);
      } else {
        setItems(res);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endDate]); // Removido dependency onExpire que pode causar loops se não memoizado

  if (!items) return null;
  return <div className="promo-timer">{items}</div>;
};

// Quantidade de itens por página
const ITEMS_PER_PAGE = 20;
const VISIBLE_CATEGORY_FILTERS_LIMIT = 20;

// --- HELPER DE PAGINAÇÃO ---
// Cria um array de páginas com elipses "..."
const getPaginationPages = (
  currentPage: number,
  totalPages: number,
  pageWindow: number = 2 // Quantos vizinhos mostrar
) => {
  const pages: (number | string)[] = [];
  const ELLIPSIS = "...";

  // Se houver apenas 1 página, retorne [1]
  if (totalPages <= 1) return [1];

  // Sempre mostrar a primeira página
  pages.push(1);

  // Calcular o início e o fim da janela
  let start = Math.max(2, currentPage - pageWindow);
  let end = Math.min(totalPages - 1, currentPage + pageWindow);

  // Adicionar "..." se a janela não começar logo após a página 1
  if (start > 2) {
    pages.push(ELLIPSIS);
  }

  // Adicionar páginas da janela
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  // Adicionar "..." se a janela não terminar logo antes da última página
  if (end < totalPages - 1) {
    pages.push(ELLIPSIS);
  }

  // Sempre mostrar a última página
  pages.push(totalPages);

  // Remove duplicados (ex: se totalPages for 5, pode gerar [1, 2, 3, 4, 5, 5])
  return [...new Set(pages)];
};
// --- FIM DO HELPER ---

function getProductTotalUnits(product: Product) {
  return (product.stockByFilial || []).reduce(
    (sum, item) => sum + (Number(item.mainStock) || 0) + (Number(item.showcaseStock) || 0),
    0
  );
}

interface ProductListProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
}

type ExportColumn = {
  key: string;
  label: string;
  getValue: (product: Product) => string | number | boolean;
};

type ExportMode = "all" | "filtered";

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "name", label: "Produto", getValue: (product) => product.name || "" },
  { key: "sku", label: "Codigo de barras", getValue: (product) => product.sku || "" },
  {
    key: "categories",
    label: "Categorias",
    getValue: (product) => (product.categories || []).map((category) => category.name).join(", "),
  },
  {
    key: "supplierName",
    label: "Fornecedor",
    getValue: (product) => product.supplierName || "",
  },
  {
    key: "mainStock",
    label: "Estoque comum",
    getValue: (product) =>
      (product.stockByFilial || []).reduce((sum, item) => sum + (Number(item.mainStock) || 0), 0),
  },
  {
    key: "showcaseStock",
    label: "Estoque vitrine",
    getValue: (product) =>
      (product.stockByFilial || []).reduce(
        (sum, item) => sum + (Number(item.showcaseStock) || 0),
        0
      ),
  },
  {
    key: "totalStock",
    label: "Estoque total",
    getValue: (product) =>
      (product.stockByFilial || []).reduce(
        (sum, item) =>
          sum + (Number(item.mainStock) || 0) + (Number(item.showcaseStock) || 0),
        0
      ),
  },
  {
    key: "stockByFilial",
    label: "Estoque por filial",
    getValue: (product) =>
      (product.stockByFilial || [])
        .map(
          (item) =>
            `${item.filial}: comum ${Number(item.mainStock) || 0}, vitrine ${
              Number(item.showcaseStock) || 0
            }`
        )
        .join(" | "),
  },
  {
    key: "costPrice",
    label: "Preco de custo",
    getValue: (product) => Number(product.costPrice) || 0,
  },
  {
    key: "salePrice",
    label: "Preco de venda",
    getValue: (product) => Number(product.salePrice) || 0,
  },
  {
    key: "totalCostValue",
    label: "Valor total em custo",
    getValue: (product) => {
      const totalStock = (product.stockByFilial || []).reduce(
        (sum, item) => sum + (Number(item.mainStock) || 0) + (Number(item.showcaseStock) || 0),
        0
      );
      return totalStock * (Number(product.costPrice) || 0);
    },
  },
  {
    key: "totalSaleValue",
    label: "Valor total em venda",
    getValue: (product) => {
      const totalStock = (product.stockByFilial || []).reduce(
        (sum, item) => sum + (Number(item.mainStock) || 0) + (Number(item.showcaseStock) || 0),
        0
      );
      return totalStock * (Number(product.salePrice) || 0);
    },
  },
  {
    key: "isSoldByWeight",
    label: "Vendido por peso",
    getValue: (product) => (product.isSoldByWeight || product.soldByWeight ? "Sim" : "Nao"),
  },
  {
    key: "promotionPrice",
    label: "Preco promocional",
    getValue: (product) => Number(product.promotionPrice) || 0,
  },
  {
    key: "promoStartDate",
    label: "Inicio da promocao",
    getValue: (product) => product.promoStartDate || "",
  },
  {
    key: "promoEndDate",
    label: "Fim da promocao",
    getValue: (product) => product.promoEndDate || "",
  },
  {
    key: "offerCreatedBy",
    label: "Oferta criada por",
    getValue: (product) => product.offerCreatedBy || "",
  },
];

export function ProductList({ searchTerm, onSearchTermChange }: ProductListProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const normalizedSearchTerm = useMemo(
    () => normalizeStockSearchTerm(searchTerm),
    [searchTerm]
  );

  // Dados principais
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [importReferenceProducts, setImportReferenceProducts] = useState<Product[]>([]);
  const [loadingImportReferenceProducts, setLoadingImportReferenceProducts] =
    useState(false);

  // Dados de suporte (para os modais)
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Estados dos modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<MovementHistory[]>([]);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockByFilialData, setStockByFilialData] = useState<StockLocation[]>(
    []
  );
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferringProduct, setTransferringProduct] =
    useState<Product | null>(null);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerProduct, setOfferProduct] = useState<Product | null>(null);

  // Modal de impressão
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printingProduct, setPrintingProduct] = useState<Product | null>(null);

  // Modal de importação
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingStockProductId, setEditingStockProductId] = useState<number | null>(null);
  const [editingStockMain, setEditingStockMain] = useState(0);
  const [editingStockShowcase, setEditingStockShowcase] = useState(0);
  const [savingStockProductId, setSavingStockProductId] = useState<number | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("all");
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(
    () => EXPORT_COLUMNS.map((column) => column.key)
  );
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([]);
  const [priceSort, setPriceSort] = useState<"default" | "highest" | "lowest">("default");
  const [showZeroStockOnly, setShowZeroStockOnly] = useState(false);
  const [maxStockThreshold, setMaxStockThreshold] = useState("");
  const [showAllCategoryFilters, setShowAllCategoryFilters] = useState(false);


  // --- CARREGAMENTO DE DADOS ---

  const carregarFiliais = async () => {
    try {
      const encrypted = await encrypt({ empresa_id: user?.empresa_id });
      const response = await fetch(`${API_BASE}/user/lista_filial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj: Branch[];
      };
      if (resp?.boleano) setBranches(resp.obj);
    } catch (err) {
      console.error("Erro ao carregar filiais:", err);
    }
  };

  const carregarCategorias = async () => {
    try {
      const encrypted = await encrypt({ empresa_id: user?.empresa_id });
      const response = await fetch(`${API_BASE}/user/listar_categoria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj: Category[];
      };
      if (resp?.boleano) setCategories(resp.obj);
    } catch (err) {
      console.error("Erro ao carregar categorias:", err);
    }
  };

  const carregarFornecedores = async () => {
    try {
      const encrypted = await encrypt({ empresa_id: user?.empresa_id });
      const response = await fetch(`${API_BASE}/estoque/lista_fabricante`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj: Supplier[];
      };
      if (resp?.boleano) setSuppliers(resp.obj);
    } catch (err) {
      console.error("Erro ao carregar fornecedores:", err);
    }
  };

  // Função para buscar produtos paginados
  const fetchProductsPage = async (
    page: number,
    limit: number,
    pesquisa: string = normalizedSearchTerm
  ) => {
    if (!user?.empresa_id) {
      return {
        produtos: [],
        totalProdutos: 0,
      };
    }

    const encrypted = await encrypt({
      empresa_id: user.empresa_id,
      pagina: page,
      limite: limit,
      pesquisa,
    });

    const response = await fetch(`${API_BASE}/estoque/lista_produtos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });

    const respData = await response.json();
    const resp = (await decrypt(respData.payload)) as {
      boleano: boolean;
      obj: {
        produtos: Product[];
        totalProdutos: number;
      };
    };

    if (!resp?.boleano) {
      return {
        produtos: [],
        totalProdutos: 0,
      };
    }

    return {
      produtos: resp.obj.produtos || [],
      totalProdutos: Number(resp.obj.totalProdutos) || 0,
    };
  };

  const fetchAllProducts = async (pesquisa: string = searchTerm) => {
    const fetchLimit = 200;
    const firstPage = await fetchProductsPage(1, fetchLimit, pesquisa);
    let allProducts = [...firstPage.produtos];
    const totalPagesToFetch = Math.ceil(firstPage.totalProdutos / fetchLimit);

    for (let page = 2; page <= totalPagesToFetch; page += 1) {
      const nextPage = await fetchProductsPage(page, fetchLimit, pesquisa);
      allProducts = allProducts.concat(nextPage.produtos);
    }

    return allProducts;
  };

  const fetchProducts = async () => {
    if (!user?.empresa_id) return;

    try {
      setLoading(true);
      const allProducts = await fetchAllProducts();
      setProducts(allProducts);
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
      setProducts([]); // Limpa produtos em caso de erro
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  // Efeito para resetar a página quando a busca mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [maxStockThreshold, normalizedSearchTerm, priceSort, selectedCategoryFilters, showZeroStockOnly]);

  // Busca produtos quando a página ou o filtro mudam
  useEffect(() => {
    fetchProducts();
  }, [normalizedSearchTerm, user?.empresa_id]);

  // Busca dados de suporte (para os modais) apenas uma vez
  useEffect(() => {
    if (user?.empresa_id) {
      carregarFiliais();
      carregarCategorias();
      carregarFornecedores();
    }
  }, [user?.empresa_id]);

  const categoryFilterOptions = useMemo(() => {
    const unique = new Map<string, string>();

    categories.forEach((category) => {
      if (category?.name) unique.set(category.name, category.name);
    });

    products.forEach((product) => {
      (product.categories || []).forEach((category) => {
        if (category?.name) unique.set(category.name, category.name);
      });
    });

    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [categories, products]);

  const visibleCategoryFilterOptions = useMemo(
    () =>
      showAllCategoryFilters
        ? categoryFilterOptions
        : categoryFilterOptions.slice(0, VISIBLE_CATEGORY_FILTERS_LIMIT),
    [categoryFilterOptions, showAllCategoryFilters]
  );

  const hasMoreCategoryFilters = categoryFilterOptions.length > VISIBLE_CATEGORY_FILTERS_LIMIT;

  const filteredProducts = useMemo(() => {
    let nextProducts = [...products];
    const parsedMaxStockThreshold = Number(maxStockThreshold);

    if (selectedCategoryFilters.length) {
      nextProducts = nextProducts.filter((product) =>
        (product.categories || []).some((category) =>
          selectedCategoryFilters.includes(category.name)
        )
      );
    }

    if (showZeroStockOnly) {
      nextProducts = nextProducts.filter((product) => getProductTotalUnits(product) === 0);
    }

    if (maxStockThreshold !== "" && Number.isFinite(parsedMaxStockThreshold)) {
      nextProducts = nextProducts.filter(
        (product) => getProductTotalUnits(product) < parsedMaxStockThreshold
      );
    }

    if (priceSort === "highest") {
      nextProducts.sort((a, b) => (Number(b.salePrice) || 0) - (Number(a.salePrice) || 0));
    } else if (priceSort === "lowest") {
      nextProducts.sort((a, b) => (Number(a.salePrice) || 0) - (Number(b.salePrice) || 0));
    }

    return nextProducts;
  }, [maxStockThreshold, priceSort, products, selectedCategoryFilters, showZeroStockOnly]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredProducts]);

  useEffect(() => {
    setTotalPages(Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  }, [filteredProducts]);

  useEffect(() => {
    if (currentPage > 1 && totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Este cálculo agora é apenas dos itens visíveis (da página)
  // Para um valor total real, o backend deve prover isso (ex: no Dashboard)
  const totalStockValue = useMemo(() => {
    return paginatedProducts.reduce((total, product) => {
      return total + getProductTotalUnits(product) * product.salePrice;
    }, 0);
  }, [paginatedProducts]);


  const totalCostValue = useMemo(() => {
    return paginatedProducts.reduce((total, product) => {
      return total + getProductTotalUnits(product) * product.costPrice;
    }, 0);
  }, [paginatedProducts]);

  // --- FUNÇÕES DE NAVEGAÇÃO ---
  const handlePageChange = (page: number | string) => {
    if (typeof page === "number" && page !== currentPage) {
      setCurrentPage(page);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const paginationPages = getPaginationPages(currentPage, totalPages);
  const selectedExportColumnsData = useMemo(
    () => EXPORT_COLUMNS.filter((column) => selectedExportColumns.includes(column.key)),
    [selectedExportColumns]
  );
  const hasActiveInventoryFilters =
    normalizedSearchTerm.length > 0 ||
    maxStockThreshold.trim().length > 0 ||
    selectedCategoryFilters.length > 0 ||
    showZeroStockOnly ||
    priceSort !== "default";

  // --- FUNÇÕES DE MODAIS (CRUD) ---

  const handleOpenModal = () => {
    setEditingProduct(null);
    setIsFormModalOpen(true);
  };
  const handleToggleCategoryFilter = (categoryName: string) => {
    setSelectedCategoryFilters((prev) =>
      prev.includes(categoryName)
        ? prev.filter((item) => item !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleClearInventoryFilters = () => {
    onSearchTermChange("");
    setMaxStockThreshold("");
    setSelectedCategoryFilters([]);
    setPriceSort("default");
    setShowZeroStockOnly(false);
  };
  const handleToggleExportColumn = (columnKey: string) => {
    setSelectedExportColumns((prev) =>
      prev.includes(columnKey)
        ? prev.filter((item) => item !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleSelectAllExportColumns = () => {
    setSelectedExportColumns(EXPORT_COLUMNS.map((column) => column.key));
  };

  const handleClearExportColumns = () => {
    setSelectedExportColumns([]);
  };

  const loadImportReferenceProducts = async () => {
    if (!user?.empresa_id) return;

    try {
      setLoadingImportReferenceProducts(true);
      const allProducts = await fetchAllProducts("");
      setImportReferenceProducts(allProducts);
    } catch (err) {
      console.error("Erro ao carregar produtos para importação:", err);
      addToast({
        type: "error",
        title: "Erro na importação",
        description: "Nao foi possivel validar os produtos existentes para importar.",
      });
    } finally {
      setLoadingImportReferenceProducts(false);
    }
  };

  const fetchCategoriesList = async () => {
    const encrypted = await encrypt({ empresa_id: user?.empresa_id });
    const response = await fetch(`${API_BASE}/user/listar_categoria`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });
    const respData = await response.json();
    const resp = (await decrypt(respData.payload)) as {
      boleano: boolean;
      obj: Category[];
      msg?: string;
      mensagem?: string;
    };

    if (!resp?.boleano) {
      throw new Error(
        typeof resp?.msg === "string"
          ? resp.msg
          : typeof resp?.mensagem === "string"
          ? resp.mensagem
          : "Nao foi possivel listar categorias."
      );
    }

    return resp.obj || [];
  };

  const fetchSuppliersList = async () => {
    const encrypted = await encrypt({ empresa_id: user?.empresa_id });
    const response = await fetch(`${API_BASE}/estoque/lista_fabricante`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });
    const respData = await response.json();
    const resp = (await decrypt(respData.payload)) as {
      boleano: boolean;
      obj: Supplier[];
      msg?: string;
      mensagem?: string;
    };

    if (!resp?.boleano) {
      throw new Error(
        typeof resp?.msg === "string"
          ? resp.msg
          : typeof resp?.mensagem === "string"
          ? resp.mensagem
          : "Nao foi possivel listar fornecedores."
      );
    }

    return resp.obj || [];
  };

  const ensureCategoriesFromNames = async (names: string[]) => {
    const uniqueNames = [...new Set(names.map((name) => String(name || "").trim()).filter(Boolean))];
    if (!uniqueNames.length) {
      return categories;
    }

    for (const name of uniqueNames) {
      const encrypted = await encrypt({
        empresa_id: user?.empresa_id,
        name,
      });

      const response = await fetch(`${API_BASE}/user/cadastro_categoria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj?: { id?: number; name?: string };
        msg?: string;
        mensagem?: string;
      };

      if (!resp?.boleano) {
        throw new Error(
          typeof resp?.msg === "string"
            ? resp.msg
            : typeof resp?.mensagem === "string"
            ? resp.mensagem
            : `Nao foi possivel criar a categoria "${name}".`
        );
      }
    }

    const nextCategories = await fetchCategoriesList();
    setCategories(nextCategories);
    return nextCategories;
  };

  const ensureSupplierByName = async (name: string) => {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      return null;
    }

    const existingSupplier = suppliers.find(
      (supplier) => supplier.name.toLowerCase() === normalizedName.toLowerCase()
    );
    if (existingSupplier) {
      return existingSupplier;
    }

    const encrypted = await encrypt({
      empresa_id: user?.empresa_id,
      name: normalizedName,
      cnpj: "",
      phone: "",
      email: "",
      contactPerson: "",
    });

    const response = await fetch(`${API_BASE}/estoque/cadastro_fabricante`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });

    const respData = await response.json();
    const resp = (await decrypt(respData.payload)) as {
      boleano: boolean;
      obj?: Supplier;
      msg?: string;
      mensagem?: string;
    };

    if (!resp?.boleano || !resp.obj) {
      throw new Error(
        typeof resp?.msg === "string"
          ? resp.msg
          : typeof resp?.mensagem === "string"
          ? resp.mensagem
          : `Nao foi possivel criar o fornecedor "${normalizedName}".`
      );
    }

    const nextSuppliers = await fetchSuppliersList();
    setSuppliers(nextSuppliers);

    return (
      nextSuppliers.find((supplier) => supplier.id === resp.obj?.id) ||
      nextSuppliers.find(
        (supplier) => supplier.name.toLowerCase() === normalizedName.toLowerCase()
      ) ||
      resp.obj
    );
  };

  const handleImportOne = async (params: {
    product: ImportedProductPayload;
    existingProduct: Product | null;
    conflictMode: "create" | "update" | "skip";
  }) => {
    if (!user?.empresa_id) {
      throw new Error("Faca login novamente para importar produtos.");
    }

    if (params.existingProduct && params.conflictMode === "skip") {
      return;
    }

    let resolvedCategories = params.product.categories || [];
    const missingCategoryNames = params.product.missingCategoryNames || [];
    let resolvedSupplierName = params.product.supplierName || "";
    const missingSupplierName = String(params.product.missingSupplierName || "").trim();

    if (missingCategoryNames.length) {
      const availableCategories = await ensureCategoriesFromNames(missingCategoryNames);
      const createdCategories = missingCategoryNames
        .map((name) =>
          availableCategories.find(
            (category) => category.name.toLowerCase() === String(name).trim().toLowerCase()
          )
        )
        .filter((category): category is Category => Boolean(category));

      resolvedCategories = [...resolvedCategories, ...createdCategories].filter(
        (category, index, array) =>
          array.findIndex((item) => item.id === category.id) === index
        );
    }

    if (missingSupplierName) {
      const supplier = await ensureSupplierByName(missingSupplierName);
      resolvedSupplierName = supplier?.name || missingSupplierName;
    }

    const normalizedProduct = {
      ...params.product,
      categories: resolvedCategories,
      supplierName: resolvedSupplierName,
    };
    delete (normalizedProduct as { missingCategoryNames?: string[] }).missingCategoryNames;
    delete (normalizedProduct as { missingSupplierName?: string }).missingSupplierName;

    const payload =
      params.existingProduct && params.conflictMode === "update"
        ? {
            ...params.existingProduct,
            ...normalizedProduct,
            id: params.existingProduct.id,
          }
        : normalizedProduct;

    const finalPayload = {
      empresa_id: user.empresa_id,
      ...payload,
    };

    const endpoint =
      params.existingProduct && params.conflictMode === "update"
        ? "/estoque/editar_produto"
        : "/estoque/cadastro_produto";

    const encrypted = await encrypt(finalPayload);
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });

    if (!res.ok) {
      let msg = "Falha ao importar produto.";
      try {
        const data = await res.json();
        msg = data?.mensagem || data?.message || msg;
      } catch {}
      throw new Error(msg);
    }

    try {
      const data = await res.json();
      if (data?.payload) {
        const resp = await decrypt(data.payload);
        if (resp?.boleano === false) {
          const responseMessage =
            typeof resp?.msg === "string"
              ? resp.msg
              : typeof resp?.mensagem === "string"
              ? resp.mensagem
              : "Falha ao importar produto.";
          throw new Error(responseMessage);
        }
      }
    } catch (err) {
      if (err instanceof Error) throw err;
    }
  };

  const handleOpenExportModal = (mode: ExportMode) => {
    setExportMode(mode);
    setIsExportModalOpen(true);
  };

  const handleExportStock = async () => {
    if (!user?.empresa_id) {
      addToast({
        type: "error",
        title: "Sessao invalida",
        description: "Faca login novamente para exportar o estoque.",
      });
      return;
    }

    if (!selectedExportColumnsData.length) {
      addToast({
        type: "error",
        title: "Selecione colunas",
        description: "Escolha ao menos uma coluna para exportar.",
      });
      return;
    }

    try {
      setIsExporting(true);
      const exportSource = exportMode === "filtered" ? filteredProducts : products;
      const rows = exportSource.map((product) => {
        const row: Record<string, string | number | boolean> = {};

        selectedExportColumnsData.forEach((column) => {
          row[column.label] = column.getValue(product);
        });

        return row;
      });

      exportStockWorkbook(rows, "estoque_produtos");
      setIsExportModalOpen(false);

      addToast({
        type: "success",
        title: "Exportação concluida",
        description: `${rows.length} produto(s) exportado(s) com sucesso.`,
      });
    } catch (err) {
      console.error("Erro ao exportar estoque:", err);
      addToast({
        type: "error",
        title: "Erro na exportação",
        description: "Não foi possível exportar os produtos do estoque.",
      });
    } finally {
      setIsExporting(false);
    }
  };
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormModalOpen(true);
  };

  const handleDelete = async (productId: number) => {
    if (
      !window.confirm(
        "Tem certeza que deseja remover este produto? Esta ação não pode ser desfeita."
      )
    )
      return;

    try {
      const encrypted = await encrypt({ produto_id: productId });
      await fetch(`${API_BASE}/estoque/deletar_produto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      // Recarrega a lista após a exclusão
      fetchProducts();
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Produto excluído com sucesso!",
      });
    } catch (err) {
      console.error("Erro ao deletar produto:", err);
      addToast({
        type: "error",
        title: "Erro ao Excluir",
        description: "Não foi possível deletar o produto.",
      });
    }
  };

  const handleSave = async (
    productData:
      | Omit<Product, "id" | "movementHistory">
      | Omit<Product, "movementHistory">
  ) => {
    if (!user?.empresa_id) {
      addToast({
        type: "error",
        title: "Sessao invalida",
        description: "Faca login novamente para salvar o produto.",
      });
      return;
    }

    try {
      
      

      const payload = {
        empresa_id: user.empresa_id,
        ...productData,
      };

      const endpoint =
        "id" in productData
          ? "/estoque/editar_produto"
          : "/estoque/cadastro_produto";
      const encrypted = await encrypt(payload);

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      let responseData: any = null;

      try {
        responseData = await res.json();
      } catch { }

      if (!res.ok) {
        let msg = "Falha ao salvar produto.";
        msg = responseData?.mensagem || responseData?.message || msg;
        throw new Error(msg);
      }

      if (responseData?.payload) {
        const resp = (await decrypt(responseData.payload)) as {
          boleano?: boolean;
          msg?: string;
          mensagem?: string;
        };
        if (!resp?.boleano) {
          throw new Error(
            resp?.msg || resp?.mensagem || "Falha ao salvar produto."
          );
        }
      }

      setIsFormModalOpen(false);
      fetchProducts(); // Recarrega a lista
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Produto salvo com sucesso!",
      });
    } catch (err) {
      console.error("Erro ao salvar produto:", err);
      addToast({
        type: "error",
        title: "Erro ao Salvar",
        description:
          err instanceof Error
            ? err.message
            : "Não foi possível salvar o produto.",
      });
    }
  };

  const handleHistory = async (product: Product) => {
    // Busca o histórico mais recente toda vez que o modal é aberto
    try {
      const encrypted = await encrypt({ produto_id: product.id });
      const response = await fetch(`${API_BASE}/estoque/listar_movimentacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });
      const respData = await response.json();
      const resp = (await decrypt(respData.payload)) as {
        boleano: boolean;
        obj: MovementHistory[];
      };

      if (resp.boleano) {
        setHistoryData(resp.obj || []);
      } else {
        setHistoryData([]);
      }
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
      setHistoryData([]);
    }
    setSelectedProductName(product.name);
    setIsHistoryModalOpen(true);
  };

  const handleStockByFilial = (product: Product) => {
    // Os dados de estoque por filial já vêm da query principal
    setStockByFilialData(product.stockByFilial || []);
    setSelectedProductName(product.name);
    setIsStockModalOpen(true);
  };

  const handleOpenTransferModal = (product: Product) => {
    setTransferringProduct(product);
    setIsTransferModalOpen(true);
  };

  const handleTransfer = async (
    fromFilial: { id: number; name: string },
    toFilial: { id: number; name: string },
    quantity: number
  ) => {
    if (!transferringProduct || !user?.id) return;

    try {
      const payload = {
        productId: transferringProduct.id,
        fromFilial,
        toFilial,
        quantity,
        usuario_id: user.id,
      };
      const encrypted = await encrypt(payload);

      // Chamada à API de transferência
      await fetch(`${API_BASE}/estoque/cadastro_movimentacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      setIsTransferModalOpen(false);
      fetchProducts(); // Recarrega a lista para ver o estoque atualizado
      addToast({
        type: "success",
        title: "Sucesso",
        description: "Estoque transferido com sucesso!",
      });
    } catch (err) {
      console.error("Erro ao transferir estoque:", err);
      addToast({
        type: "error",
        title: "Erro na Transferência",
        description: "Não foi possível transferir o estoque.",
      });
    }
  };

  const handleOpenOfferModal = (product: Product) => {
    setOfferProduct(product);
    setIsOfferModalOpen(true);
  };

  const handleSaveOffer = async (
    productId: number,
    offerData: {
      promoPrice: number;
      promoStartDate: string;
      promoEndDate: string;
    }
  ) => {
    if (!user?.empresa_id) {
      addToast({
        type: "error",
        title: "Sessao invalida",
        description: "Faca login novamente para atualizar a oferta.",
      });
      return;
    }

    try {

      // Prepara o payload com os dados da oferta e os dados existentes do produto
      // Nota: Idealmente, o backend teria um endpoint específico para atualizar oferta,
      // mas vamos usar o de edição de produto conforme o plano.
      // Precisamos garantir que estamos enviando todos os campos necessários para a edição.

      const productToUpdate = products.find((p) => p.id === productId);
      if (!productToUpdate) return;

      const payload = {
        empresa_id: user.empresa_id,
        ...productToUpdate,
        ...offerData,
        ...offerData,
        offerCreatedBy: user?.name || "Usuário", // Apenas para exibição local imediata
      };

      // Remover campos que podem causar problemas se o backend não esperar
      const { movementHistory, stockByFilial, ...payloadToSend } = payload;

      // Garante que enviamos o ID do usuário para persistência correta no backend
      const finalPayload = {
        ...payloadToSend,
        offerCreatedBy: user?.id,
      };

      const encrypted = await encrypt(finalPayload);

      await fetch(`${API_BASE}/estoque/editar_produto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      setIsOfferModalOpen(false);

      // ATUALIZAÇÃO MANUAL DO ESTADO LOCAL
      // Como o backend ainda não retorna o 'offerCreatedBy', atualizamos localmente
      // para que a UI mostre a mudança imediatamente sem perdê-la num refetch.
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
              ...p,
              ...offerData,
              // Garante que os campos de oferta estejam presentes e corretos
              promotionPrice: offerData.promoPrice,
              promoStartDate: offerData.promoStartDate,
              promoEndDate: offerData.promoEndDate,
              offerCreatedBy: user?.name || "Usuário",
            }
            : p
        )
      );

      // fetchProducts(); // Comentado para não sobrescrever o dado local temporário
    } catch (err) {
      console.error("Erro ao salvar oferta:", err);
      addToast({
        type: "error",
        title: "Erro ao Salvar",
        description: "Não foi possível atualizar o produto.",
      });
    }
  };

  const handleDeleteOffer = async (productId: number) => {
    try {

      const productToUpdate = products.find((p) => p.id === productId);
      if (!productToUpdate) return;

      // Use dedicated endpoint for removing promotion
      const encrypted = await encrypt({ productId: productToUpdate.id });

      await fetch(`${API_BASE}/estoque/remover_promocao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: encrypted }),
      });

      // Atualiza localmente
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
              ...p,
              promotionPrice: undefined,
              promoStartDate: undefined,
              promoEndDate: undefined,
            }
            : p
        )
      );

      addToast({
        type: "success",
        title: "Sucesso",
        description: "Promoção excluída com sucesso!",
      });
    } catch (err) {
      console.error(err);
      addToast({
        type: "error",
        title: "Erro",
        description: "Erro ao excluir oferta.",
      });
    }
  };

  const handleExpireOffer = (productId: number) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
            ...p,
            promotionPrice: undefined,
            promoStartDate: undefined,
            promoEndDate: undefined,
          }
          : p
      )
    );
  };


  const handleOpenPrintModal = (product: Product) => {
    setPrintingProduct(product);
    setIsPrintModalOpen(true);
  };

  const handleClosePrintModal = () => {
    setIsPrintModalOpen(false);
    setPrintingProduct(null);
  };

  const handleStartInlineStockEdit = (product: Product) => {
    const main = (product.stockByFilial || []).reduce(
      (sum, item) => sum + (Number(item.mainStock) || 0),
      0
    );
    const showcase = (product.stockByFilial || []).reduce(
      (sum, item) => sum + (Number(item.showcaseStock) || 0),
      0
    );
    setEditingStockProductId(product.id);
    setEditingStockMain(main);
    setEditingStockShowcase(showcase);
  };

  const handleCancelInlineStockEdit = () => {
    setEditingStockProductId(null);
    setEditingStockMain(0);
    setEditingStockShowcase(0);
  };

  const distributeStockByRatio = (
    locations: StockLocation[],
    field: "mainStock" | "showcaseStock",
    newTotal: number
  ) => {
    const sanitizedTotal = Math.max(0, Math.floor(Number(newTotal) || 0));
    if (!locations.length) return locations;

    const currentTotal = locations.reduce(
      (sum, item) => sum + (Number(item[field]) || 0),
      0
    );

    if (currentTotal <= 0) {
      return locations.map((item, index) => ({
        ...item,
        [field]: index === 0 ? sanitizedTotal : 0,
      }));
    }

    const distributed = locations.map((item) => {
      const current = Number(item[field]) || 0;
      const proportional = Math.floor((current / currentTotal) * sanitizedTotal);
      return {
        ...item,
        [field]: proportional,
      };
    });

    const distributedTotal = distributed.reduce(
      (sum, item) => sum + (Number(item[field]) || 0),
      0
    );
    const diff = sanitizedTotal - distributedTotal;

    if (diff !== 0) {
      distributed[0] = {
        ...distributed[0],
        [field]: Math.max(0, (Number(distributed[0][field]) || 0) + diff),
      };
    }

    return distributed;
  };

  const handleSaveInlineStock = async (product: Product) => {
    if (savingStockProductId) return;
    setSavingStockProductId(product.id);

    try {
      const mainTotal = Math.max(0, Math.floor(Number(editingStockMain) || 0));
      const showcaseTotal = Math.max(
        0,
        Math.floor(Number(editingStockShowcase) || 0)
      );

      const baseLocations = (product.stockByFilial || [])
        .filter((item) => Number.isFinite(Number(item.id)) && Number(item.id) > 0)
        .map((item) => ({
          ...item,
          id: Number(item.id),
          mainStock: Number(item.mainStock) || 0,
          showcaseStock: Number(item.showcaseStock) || 0,
        }));

      if (!baseLocations.length) {
        throw new Error("Produto sem filial cadastrada para atualizar estoque.");
      }

      const withMain = distributeStockByRatio(baseLocations, "mainStock", mainTotal);
      const withShowcase = distributeStockByRatio(
        withMain,
        "showcaseStock",
        showcaseTotal
      );

      await handleSave({
        ...product,
        stockByFilial: withShowcase,
      });

      handleCancelInlineStockEdit();
    } catch (err) {
      console.error("Erro ao editar estoque no card:", err);
      addToast({
        type: "error",
        title: "Erro ao editar estoque",
        description: "Nao foi possivel atualizar o estoque deste produto.",
      });
    } finally {
      setSavingStockProductId(null);
    }
  };

  // --- RENDERIZAÇÃO ---
  return (
    <div className="product-list-container">
      <div className="list-header-actions">
        <h3>Produtos Cadastrados</h3>

        <div className="total-stock-values-container">
          <div className="total-stock-value">
            <strong>Valor Total (Página): </strong>
            <span>
              {totalStockValue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </div>

          <div className="total-stock-value">
            <strong>Valor Custo Total (Página): </strong>
            <span>
              {totalCostValue.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </div>

        </div>

        <div className="product-list-header-buttons">
          <button
            className="secondary-header-button"
            onClick={() => handleOpenExportModal("all")}
          >
            <FiDownload /> Exportar estoque
          </button>
          <button
            className="secondary-header-button"
            onClick={() => handleOpenExportModal("filtered")}
          >
            <FiDownload /> Exportar filtro
          </button>
          <button className="add-new-button" onClick={handleOpenModal}>
            <FiPlus /> Novo Produto
          </button>
        </div>
      </div>

      <div className="inventory-filters-panel">
        <div className="inventory-filters-top">
          <label className="inventory-filter-field inventory-search-field">
            <span>Buscar produto</span>
            <div className="inventory-search-wrapper">
              <FiSearch className="inventory-search-icon" />
              <input
                type="text"
                placeholder="Buscar por nome, codigo ou fornecedor..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(normalizeStockSearchTerm(e.target.value))}
              />
            </div>
          </label>

          <label className="inventory-filter-field">
            <span>Ordenar por valor</span>
            <select
              value={priceSort}
              onChange={(e) =>
                setPriceSort(e.target.value as "default" | "highest" | "lowest")
              }
            >
              <option value="default">Padrão</option>
              <option value="highest">Maior valor</option>
              <option value="lowest">Menor valor</option>
            </select>
          </label>

          <label className="inventory-filter-field inventory-stock-threshold-field">
            <span>Estoque abaixo de</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Ex.: 10"
              value={maxStockThreshold}
              onChange={(e) =>
                setMaxStockThreshold(
                  e.target.value === ""
                    ? ""
                    : String(Math.max(0, Number(e.target.value) || 0))
                )
              }
            />
          </label>

          <label className="inventory-filter-checkbox">
            <input
              type="checkbox"
              checked={showZeroStockOnly}
              onChange={(e) => setShowZeroStockOnly(e.target.checked)}
            />
            <span>Somente estoque zerado</span>
          </label>

          <button
            type="button"
            className={`secondary-header-button inventory-clear-filters ${
              hasActiveInventoryFilters ? "active" : ""
            }`}
            onClick={handleClearInventoryFilters}
          >
            Limpar filtros
          </button>
        </div>

        <div className="inventory-tags-filter">
          <span className="inventory-tags-label">Tags</span>
          <div className="inventory-tags-list">
            {visibleCategoryFilterOptions.map((categoryName) => (
              <button
                key={categoryName}
                type="button"
                className={`inventory-tag-chip ${
                  selectedCategoryFilters.includes(categoryName) ? "active" : ""
                }`}
                onClick={() => handleToggleCategoryFilter(categoryName)}
              >
                {categoryName}
              </button>
            ))}
          </div>
          {hasMoreCategoryFilters ? (
            <button
              type="button"
              className="inventory-tags-toggle"
              onClick={() => setShowAllCategoryFilters((prev) => !prev)}
            >
              {showAllCategoryFilters ? "Ver menos" : `Ver mais (${categoryFilterOptions.length - VISIBLE_CATEGORY_FILTERS_LIMIT})`}
            </button>
          ) : null}
        </div>

        <div className="inventory-filter-summary">
          Exibindo {paginatedProducts.length} de {filteredProducts.length} produto(s)
          {selectedCategoryFilters.length ||
          showZeroStockOnly ||
          priceSort !== "default" ||
          maxStockThreshold.trim().length > 0
            ? " com filtros ativos"
            : ""}
          .
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", padding: "20px" }}>
          Carregando produtos...
        </p>
      ) : (
        <>
          <div className="product-grid">
            {paginatedProducts.length === 0 && (
              <p style={{ textAlign: "center", gridColumn: "1 / -1" }}>
                Nenhum produto encontrado com os filtros atuais.
              </p>
            )}

            {paginatedProducts.map((product) => {
              const isEditingStock = editingStockProductId === product.id;
              const isSavingStock = savingStockProductId === product.id;
              const totalStock = (product.stockByFilial || []).reduce(
                (sum, item) => sum + item.mainStock,
                0
              );
              const totalShowcaseStock = (product.stockByFilial || []).reduce(
                (sum, item) => sum + item.showcaseStock,
                0
              );
              const totalSaleValue =
                (totalStock + totalShowcaseStock) * (product.salePrice || 0);


              const totalCostValue =
                (totalStock + totalShowcaseStock) * (product.costPrice || 0);

              const categoriesSafe = product.categories || [];
              const visibleCategories = categoriesSafe.slice(0, 3);
              const hiddenCategories = categoriesSafe.slice(3);
              const tooltipId = `tooltip-product-${product.id}`;

              const hasOffer = (() => {
                if (!product.promotionPrice || product.promotionPrice <= 0)
                  return false;
                if (!product.promoEndDate) return false;

                const now = new Date();
                const end = new Date(product.promoEndDate);

                // Se o input de data não tiver hora (apenas YYYY-MM-DD), assume fim do dia
                if (product.promoEndDate.length <= 10) {
                  end.setHours(23, 59, 59, 999);
                }

                return end > now;
              })();

              return (
                <div
                  key={product.id}
                  className={`product-card ${hasOffer ? "promo-active" : ""}`}
                >
                  {hasOffer && (
                    <div className="promo-badge-container">
                      {product.promoEndDate && (
                        <OfferTimer
                          endDate={product.promoEndDate}
                          onExpire={() => handleExpireOffer(product.id)}
                        />
                      )}
                      <div className="promo-badge">OFERTA</div>
                    </div>
                  )}
                  
                  <div className="card-top-bar">
                    <div className="card-categories">
                      {visibleCategories.map((cat) => (
                        <span key={cat.id} className="category-pill">
                          <FiTag /> {cat.name}
                        </span>
                      ))}
                      {hiddenCategories.length > 0 && (
                        <>
                          <span
                            className="more-pill"
                            data-tooltip-id={tooltipId}
                            data-tooltip-html={hiddenCategories
                              .map(
                                (c) =>
                                  `<span class="product-category-tooltip-item">${escapeTooltipHtml(c.name)}</span>`
                              )
                              .join("")}
                          >
                            +{hiddenCategories.length}
                          </span>
                          <Tooltip
                            id={tooltipId}
                            className="product-category-tooltip"
                            place="top"
                          />
                        </>
                      )}
                    </div>
                    <button
                      className="print-button"
                      title="
                      "
                      onClick={() => handleOpenPrintModal(product)}
                    >
                      <FiPrinter />
                    </button>
                  </div>
                  
                  <div className="card-header">
                    <h4 className="product-name">{product.name}</h4>
                  </div>

                  <div className="card-body">
                    <div className="info-row">
                      <div className="info-label"><FiHash /> Código de Barras</div>
                      <div className="info-value">{product.sku}</div>
                    </div>
                    <div className="info-row">
                      <div className="info-label"><FiUser /> Fornecedor</div>
                      <div className="info-value">{product.supplierName}</div>
                    </div>
                    <div className="info-row">
                      <div className="info-label"><FiBox /> Estoque Comum</div>
                      <div className="info-value">
                        {isEditingStock ? (
                          <input
                            type="number"
                            min={0}
                            className="inline-stock-input"
                            value={editingStockMain}
                            onChange={(e) =>
                              setEditingStockMain(Math.max(0, Number(e.target.value) || 0))
                            }
                          />
                        ) : (
                          <span
                            className={totalStock < 50 ? "stock-low" : "stock-ok"}
                          >
                            {totalStock} un.
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="info-row">
                      <div className="info-label"><FiShoppingBag /> Estoque Vitrine</div>
                      <div className="info-value">
                        {isEditingStock ? (
                          <input
                            type="number"
                            min={0}
                            className="inline-stock-input"
                            value={editingStockShowcase}
                            onChange={(e) =>
                              setEditingStockShowcase(
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                          />
                        ) : (
                          <span className="stock-vitrine">{totalShowcaseStock} un.</span>
                        )}
                      </div>
                    </div>
                    <div className="info-row">
                      <div className="info-label"><FiDollarSign /> Valor Venda Total</div>
                      <div className="info-value">
                        {totalSaleValue.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </div>
                    </div>
                    <div className="info-row">
                      <div className="info-label"><FiTag /> Valor Custo Total</div>
                      <div className="info-value">
                        {totalCostValue.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="card-footer">
                    <div className="price-row-box">
                      <span className="price-label">
                        Custo:{" "}
                        {(product.costPrice || 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                      <span className="price-value">
                        {(product.salePrice || 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </div>

                    {hasOffer && (
                      <div className="promo-info-row">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span className="price-original">
                            {product.salePrice.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                          <span className="price-promo">
                            {Number(product.promotionPrice).toLocaleString(
                              "pt-BR",
                              {
                                style: "currency",
                                currency: "BRL",
                              }
                            )}
                          </span>
                        </div>
                        <div className="promo-dates">
                          <span>
                            De:{" "}
                            {new Date(
                              product.promoStartDate || ""
                            ).toLocaleDateString("pt-BR")}
                          </span>
                          <span>
                            Até:{" "}
                            {new Date(
                              product.promoEndDate || ""
                            ).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {product.offerCreatedBy && (
                          <div className="promo-creator">
                            Oferta criada por: {product.offerCreatedBy}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="action-buttons-grid">
                      {isEditingStock ? (
                        <div className="inline-stock-actions">
                          <button
                            className="action-btn-primary"
                            onClick={() => handleSaveInlineStock(product)}
                            disabled={isSavingStock}
                          >
                            {isSavingStock ? "Salvando..." : "Salvar"}
                          </button>
                          <button
                            className="action-btn-secondary"
                            onClick={handleCancelInlineStockEdit}
                            disabled={isSavingStock}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            className="action-btn-primary"
                            onClick={() => handleEdit(product)}
                          >
                            <FiEdit /> Editar
                          </button>
                          <button
                            className="action-btn-secondary"
                            onClick={() => handleOpenTransferModal(product)}
                          >
                            <FiShuffle /> Movimentar
                          </button>
                          <div className="action-dropdown" tabIndex={0}>
                            <button className="action-btn-icon">
                              <FiMoreHorizontal />
                            </button>
                            <div className="action-dropdown-menu">
                              <button onClick={() => handleStartInlineStockEdit(product)}>
                                <FiBox /> Qtd. Estoque
                              </button>
                              <button onClick={() => handleOpenOfferModal(product)}>
                                <FiTag /> Oferta
                              </button>
                              <button onClick={() => handleStockByFilial(product)}>
                                <FiMapPin /> Localização
                              </button>
                              <button onClick={() => handleHistory(product)}>
                                <FiClock /> Histórico
                              </button>
                              <button className="danger" onClick={() => handleDelete(product.id)}>
                                <FiTrash2 /> Excluir
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* --- COMPONENTE DE PAGINAÇÃO ATUALIZADO --- */}
          {totalPages > 1 && (
            <div className="pagination-container">
              <button
                className="page-button nav-button"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <FiChevronLeft />
              </button>

              {paginationPages.map((page, index) => (
                <button
                  key={`${page}-${index}`}
                  className={`page-button ${currentPage === page ? "active" : ""
                    } ${page === "..." ? "ellipsis" : ""}`}
                  onClick={() => handlePageChange(page)}
                  disabled={page === "..."}
                >
                  {page}
                </button>
              ))}

              <button
                className="page-button nav-button"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <FiChevronRight />
              </button>
            </div>
          )}
          {/* --- FIM DA PAGINAÇÃO --- */}
        </>
      )}

      {/* --- Modais --- */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingProduct ? "Editar Produto" : "Adicionar Novo Produto"}
      >
        <ProductForm
          onSave={handleSave}
          onCancel={() => setIsFormModalOpen(false)}
          initialData={editingProduct}
          branches={branches}
          categories={categories}
          suppliers={suppliers}
          onOpenImport={() => {
            setIsFormModalOpen(false);     // fecha modal de adicionar
            loadImportReferenceProducts();
            setIsImportModalOpen(true);    // abre import
          }}
        />
      </Modal>

      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Histórico - ${selectedProductName}`}
      >
        <div className="history-modal-content">
          {historyData.length > 0 ? (
            historyData.map((entry, index) => (
              <div key={index} className="history-card">
                <div className="history-card-header">
                  <strong>{entry.type}</strong>
                  <span
                    className={
                      entry.quantity > 0 ? "quantity-in" : "quantity-out"
                    }
                  >
                    {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                  </span>
                </div>
                <div className="history-card-body">
                  <span>
                    Data: {new Date(entry.date).toLocaleString("pt-BR")}
                  </span>
                  <span>Usuário: {entry.user}</span>
                  {entry.type === "Transferência" ? (
                    <span>
                      De: {entry.fromFilial} → Para: {entry.toFilial}
                    </span>
                  ) : (
                    <span>Motivo: {entry.reason}</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p style={{ textAlign: "center" }}>Nenhum histórico encontrado.</p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        title={`Estoque por Filial - ${selectedProductName}`}
      >
        <div className="stock-by-filial-list">
          <div className="stock-filial-item header">
            <span>Filial</span>
            <div className="stock-quantities">
              <span>Vitrine</span>
              <span>Comum</span>
            </div>
          </div>
          {stockByFilialData.map((item, index) => (
            <div key={index} className="stock-filial-item">
              <span>{item.filial}</span>
              <div className="stock-quantities">
                <span className="stock-quantity">{item.showcaseStock} un.</span>
                <span className="stock-quantity">{item.mainStock} un.</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {transferringProduct && (
        <Modal
          isOpen={isTransferModalOpen}
          onClose={() => setIsTransferModalOpen(false)}
          title="Transferir Estoque"
        >
          <TransferStockModal
            product={transferringProduct}
            branches={branches}
            onTransfer={handleTransfer}
            onClose={() => setIsTransferModalOpen(false)}
          />
        </Modal>
      )}

      <OfferModal
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        onSave={handleSaveOffer}
        onDelete={handleDeleteOffer}
        product={offerProduct}
      />

      <PrintLabelModal
        isOpen={isPrintModalOpen}
        onClose={handleClosePrintModal}
        product={printingProduct}
      />

      <ImportProductsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        branches={branches}
        categories={categories}
        suppliers={suppliers}
        existingProducts={importReferenceProducts}
        existingProductsLoading={loadingImportReferenceProducts}
        onImportOne={handleImportOne}
        onDone={() => {
          fetchProducts();
          setIsImportModalOpen(false);
        }}
      />

      <Modal
        isOpen={isExportModalOpen}
        onClose={() => !isExporting && setIsExportModalOpen(false)}
        title={exportMode === "filtered" ? "Exportar produtos filtrados" : "Exportar produtos do estoque"}
      >
        <div className="export-columns-modal">
          <p className="export-columns-description">
            Selecione as colunas que deseja incluir no arquivo.{" "}
            {exportMode === "filtered"
              ? "A exportação considera apenas os produtos visíveis no resultado atual dos filtros."
              : "A exportação considera todos os produtos carregados do estoque, independentemente dos filtros locais."}
          </p>

          <div className="export-columns-toolbar">
            <button
              type="button"
              className="action-btn-secondary export-columns-toolbar-button"
              onClick={handleSelectAllExportColumns}
              disabled={isExporting}
            >
              Marcar todas
            </button>
            <button
              type="button"
              className="action-btn-secondary export-columns-toolbar-button"
              onClick={handleClearExportColumns}
              disabled={isExporting}
            >
              Limpar
            </button>
          </div>

          <div className="export-columns-grid">
            {EXPORT_COLUMNS.map((column) => (
              <label key={column.key} className="export-column-option">
                <input
                  type="checkbox"
                  checked={selectedExportColumns.includes(column.key)}
                  onChange={() => handleToggleExportColumn(column.key)}
                  disabled={isExporting}
                />
                <span>{column.label}</span>
              </label>
            ))}
          </div>

          <div className="export-columns-footer">
            <button
              type="button"
              className="action-btn-secondary"
              onClick={() => setIsExportModalOpen(false)}
              disabled={isExporting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="action-btn-primary"
              onClick={handleExportStock}
              disabled={isExporting || selectedExportColumns.length === 0}
            >
              {isExporting ? "Exportando..." : "Exportar"}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
