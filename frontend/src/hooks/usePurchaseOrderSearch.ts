import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { encrypt, decrypt } from "../utils/cripto";
import { API_BASE } from "../config/api";
import { useDebounce } from "./useDebounce"; // Importa o hook que criamos
import type { Branch, Product, Supplier } from "../data/mockData"; // Importa os tipos completos

// Tipos simplificados para os RESULTADOS da busca
export type SearchResultSupplier = Pick<Supplier, "id" | "name">;
export type SearchResultProduct = Pick<
  Product,
  "id" | "name" | "sku" | "costPrice"
>;

/**
 * Hook para gerenciar as buscas dinâmicas
 * no modal de Pedido de Compra.
 */
export function usePurchaseOrderSearch() {
  const { user } = useAuth();

  // --- Estados de Termo de Busca ---
  const [supplierSearch, setSupplierSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  // --- Valores com Debounce ---
  const debouncedSupplierSearch = useDebounce(supplierSearch, 300);
  const debouncedProductSearch = useDebounce(productSearch, 400);

  // --- Estados de Resultado ---
  const [branches, setBranches] = useState<Branch[]>([]); // <- Usa o tipo Branch COMPLETO
  const [supplierResults, setSupplierResults] = useState<
    SearchResultSupplier[]
  >([]);
  const [productResults, setProductResults] = useState<SearchResultProduct[]>(
    []
  );

  // --- Estados de Carregamento ---
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // --- Função Genérica de API (corrigida) ---
  const fetchApi = async (endpoint: string, payload: object) => {
    if (!user?.empresa_id) throw new Error("Usuário não autenticado.");

    const encrypted = await encrypt(payload);
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: encrypted }),
    });

    if (!response.ok) {
      throw new Error(`Falha na API: ${response.status}`);
    }

    const respData = await response.json();

    // Verificação de segurança: O backend pode ter falhado
    if (!respData.payload) {
      console.error("Erro na resposta da API (payload vazio):", respData);
      return null;
    }

    const resp = (await decrypt(respData.payload)) as {
      boleano: boolean;
      obj: any;
    };

    if (resp?.boleano) {
      return resp.obj;
    }
    return null;
  };

  // --- 1. Busca de Filiais (Executa 1x ao montar) ---
  useEffect(() => {
    if (!user?.empresa_id) return;

    const fetchBranches = async () => {
      setLoadingBranches(true);
      try {
        // A API /lista_filial retorna o objeto Branch completo
        const data = (await fetchApi("/user/lista_filial", {
          empresa_id: user.empresa_id,
        })) as Branch[]; // <- Faz o cast para o tipo Branch completo
        setBranches(data || []);
      } catch (error) {
        console.error("Erro ao buscar filiais:", error);
        setBranches([]);
      } finally {
        setLoadingBranches(false);
      }
    };
    fetchBranches();
  }, [user?.empresa_id]);

  // --- 2. Busca de Fornecedores (Executa com debounce) ---
  useEffect(() => {
    if (!user?.empresa_id || debouncedSupplierSearch.length < 2) {
      setSupplierResults([]);
      return;
    }

    const fetchSuppliers = async () => {
      setLoadingSuppliers(true);
      try {
        // A API /busca_fabricante retorna o tipo simplificado
        const data = (await fetchApi("/estoque/busca_fabricante", {
          pesquisa: debouncedSupplierSearch,
          empresa_id: user.empresa_id,
        })) as SearchResultSupplier[]; // <- Faz o cast para o tipo simplificado
        setSupplierResults(data || []);
      } catch (error) {
        console.error("Erro ao buscar fornecedores:", error);
      } finally {
        setLoadingSuppliers(false);
      }
    };
    fetchSuppliers();
  }, [debouncedSupplierSearch, user?.empresa_id]);

  // --- 3. Busca de Produtos (Executa com debounce) ---
  useEffect(() => {
    if (!user?.empresa_id || debouncedProductSearch.length < 2) {
      setProductResults([]);
      return;
    }

    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const data = await fetchApi("/estoque/lista_produtos", {
          empresa_id: user.empresa_id,
          pesquisa: debouncedProductSearch,
          pagina: 1,
          limite: 20,
        });
        // A API /lista_produtos retorna { produtos: [...] }
        setProductResults(data?.produtos || []);
      } catch (error) {
        console.error("Erro ao buscar produtos:", error);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, [debouncedProductSearch, user?.empresa_id]);

  return {
    // States de busca (para o input)
    supplierSearch,
    setSupplierSearch,
    productSearch,
    setProductSearch,
    // Listas de Resultados
    branches, // <- Retorna Branch[] (completo)
    supplierResults, // <- Retorna SearchResultSupplier[] (simplificado)
    productResults, // <- Retorna SearchResultProduct[] (simplificado)
    // Estados de Loading
    loadingBranches,
    loadingSuppliers,
    loadingProducts,
  };
}
