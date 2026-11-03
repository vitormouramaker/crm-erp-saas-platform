import { postEncrypted } from './apiClient';
import type { User } from '@/types';

export interface ProductCategory {
  id: number;
  name: string;
}

export interface ProductStockFilial {
  id: number;
  filial: string;
  mainStock: number;
  showcaseStock: number;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  supplierName: string | null;
  costPrice: number | null;
  salePrice: number | null;
  promotionPrice: number | null;
  promoStartDate: string | null;
  promoEndDate: string | null;
  offerCreatedBy: string | null;
  isSoldByWeight: boolean;
  categories: ProductCategory[];
  stockByFilial: ProductStockFilial[];
}

export interface ProductPage {
  produtos: Product[];
  totalProdutos: number;
}

export interface Categoria {
  id: number;
  nome: string;
}

export function getProductUnits(product: Product): { main: number; showcase: number; total: number } {
  const main = product.stockByFilial.reduce((acc, item) => acc + Number(item.mainStock || 0), 0);
  const showcase = product.stockByFilial.reduce((acc, item) => acc + Number(item.showcaseStock || 0), 0);
  return { main, showcase, total: main + showcase };
}

export async function getProdutos(
  user: User,
  params: { pagina: number; limite: number; pesquisa?: string }
): Promise<ProductPage> {
  try {
    const { obj } = await postEncrypted<ProductPage>('/estoque', '/lista_produtos', {
      empresa_id: user.empresa_id,
      pagina: params.pagina,
      limite: params.limite,
      pesquisa: params.pesquisa || '',
    });
    return {
      produtos: Array.isArray(obj?.produtos) ? obj.produtos : [],
      totalProdutos: Number(obj?.totalProdutos || 0),
    };
  } catch (err: any) {
    // Back responde boleano=false com "Nenhum produto cadastrado!" para página vazia
    if (String(err?.message || '').toLowerCase().includes('nenhum produto')) {
      return { produtos: [], totalProdutos: 0 };
    }
    throw err;
  }
}

export interface Fornecedor {
  id: number;
  name: string;
  cnpj: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
}

export interface FornecedorPayload {
  name: string;
  contactPerson: string;
  cnpj: string;
  phone: string;
  email: string;
}

export async function getFornecedores(user: User): Promise<Fornecedor[]> {
  const { obj } = await postEncrypted<Fornecedor[]>('/estoque', '/lista_fabricante', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function criarFornecedor(user: User, payload: FornecedorPayload): Promise<string> {
  const { message } = await postEncrypted('/estoque', '/cadastro_fabricante', {
    ...payload,
    empresa_id: user.empresa_id,
  });
  return message;
}

export async function editarFornecedor(user: User, id: number, payload: FornecedorPayload): Promise<void> {
  await postEncrypted('/estoque', '/editar_fabricante', {
    id,
    name: payload.name,
    contactPerson: payload.contactPerson,
    phone: payload.phone,
    email: payload.email,
    empresa_id: user.empresa_id,
  });
}

export async function deletarFornecedor(fornecedorId: number): Promise<void> {
  await postEncrypted('/estoque', '/deletar_fabricante', {
    fabricante_id: fornecedorId,
    delete_all: false,
  });
}

export interface PedidoItem {
  productId: number;
  productName: string;
  sku: string | null;
  quantidade: number;
  costPrice: number;
}

export interface PedidoCompra {
  id: number;
  supplierName: string | null;
  filial: string | null;
  status: string;
  data_criacao: string;
  solicitado_por: string | null;
  data_recebimento: string | null;
  recebido_por: string | null;
  totalValue: number | null;
  totalItems: number | null;
  items: PedidoItem[];
}

export interface NovoPedidoItem {
  productId: number;
  quantity: number;
  costPrice: number;
}

export async function getPedidosCompra(user: User): Promise<PedidoCompra[]> {
  const { obj } = await postEncrypted<PedidoCompra[]>('/estoque', '/listar_pedidos_compra', {
    empresa_id: user.empresa_id,
  });
  return Array.isArray(obj) ? obj : [];
}

export async function criarPedidoCompra(
  user: User,
  params: { filial_id: number; supplierId: number; items: NovoPedidoItem[] }
): Promise<void> {
  await postEncrypted('/estoque', '/cadastro_pedido', {
    usuario_solicitante_id: user.id,
    filial_id: params.filial_id,
    supplierId: params.supplierId,
    items: params.items,
    status: 'Pendente',
    empresa_id: user.empresa_id,
  });
}

export async function receberPedidoCompra(user: User, pedidoId: number): Promise<void> {
  await postEncrypted('/estoque', '/receber_pedido', {
    pedido_id: pedidoId,
    usuario_id: user.id,
  });
}

export interface ProductStockInput {
  id: number;
  mainStock: number;
  showcaseStock: number;
}

export interface ProductFormPayload {
  name: string;
  sku: string;
  costPrice: number;
  salePrice: number;
  supplierName: string;
  isSoldByWeight: boolean;
  stockByFilial: ProductStockInput[];
  categories: { id: number }[];
}

export async function criarProduto(user: User, payload: ProductFormPayload): Promise<Product> {
  const { obj } = await postEncrypted<Product>('/estoque', '/cadastro_produto', {
    ...payload,
    empresa_id: user.empresa_id,
  });
  return obj;
}

export async function getUltimoProduto(user: User): Promise<{ sku: string | null } | null> {
  try {
    const { obj } = await postEncrypted<{ sku: string | null } | null>('/estoque', '/ultimo_produto', {
      empresa_id: user.empresa_id,
    });
    return obj ?? null;
  } catch {
    return null;
  }
}

export interface EditarProdutoPayload {
  id: number;
  name: string;
  sku: string;
  costPrice: number;
  salePrice: number;
  supplierName: string;
  promoPrice: number | null;
  promoStartDate: string | null;
  promoEndDate: string | null;
  offerCreatedBy: number;
  stockByFilial: ProductStockInput[];
}

export function buildEditarProdutoPayload(product: Product, user: User): EditarProdutoPayload {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku || '',
    costPrice: Number(product.costPrice || 0),
    salePrice: Number(product.salePrice || 0),
    supplierName: product.supplierName || '',
    promoPrice: product.promotionPrice,
    promoStartDate: product.promoStartDate,
    promoEndDate: product.promoEndDate,
    offerCreatedBy: user.id,
    stockByFilial: product.stockByFilial.map((item) => ({
      id: item.id,
      mainStock: item.mainStock,
      showcaseStock: item.showcaseStock,
    })),
  };
}

export async function editarProduto(user: User, payload: EditarProdutoPayload): Promise<void> {
  await postEncrypted('/estoque', '/editar_produto', {
    ...payload,
    empresa_id: user.empresa_id,
  });
}

export async function deletarProduto(produtoId: number): Promise<void> {
  await postEncrypted('/estoque', '/deletar_produto', { produto_id: produtoId });
}

export interface PromocaoPayload {
  productId: number;
  promoPrice: number;
  promoStartDate: string;
  promoEndDate: string;
  offerCreatedBy: number;
}

export async function criarPromocao(payload: PromocaoPayload): Promise<void> {
  await postEncrypted('/estoque', '/cadastro_promocao', { ...payload });
}

export async function removerPromocao(productId: number): Promise<void> {
  await postEncrypted('/estoque', '/remover_promocao', { productId });
}

export async function getCategorias(user: User): Promise<Categoria[]> {
  const { obj } = await postEncrypted<any[]>('/user', '/listar_categoria', {
    empresa_id: user.empresa_id,
  });
  if (!Array.isArray(obj)) return [];
  return obj.map((item) => ({ id: Number(item.id), nome: String(item.nome ?? item.name ?? '') }));
}
