import { countActiveFilters, EMPTY_FILTERS, ProdutoFilters } from './ProductFilterSheet';

describe('countActiveFilters', () => {
  it('retorna 0 quando os filtros estão no padrão', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it('conta ordenação diferente de "padrao"', () => {
    const filters: ProdutoFilters = { ...EMPTY_FILTERS, ordenar: 'valor_desc' };
    expect(countActiveFilters(filters)).toBe(1);
  });

  it('conta estoqueAbaixoDe quando definido', () => {
    const filters: ProdutoFilters = { ...EMPTY_FILTERS, estoqueAbaixoDe: 5 };
    expect(countActiveFilters(filters)).toBe(1);
  });

  it('conta somenteZerado quando true', () => {
    const filters: ProdutoFilters = { ...EMPTY_FILTERS, somenteZerado: true };
    expect(countActiveFilters(filters)).toBe(1);
  });

  it('conta categoriaIds quando não vazio', () => {
    const filters: ProdutoFilters = { ...EMPTY_FILTERS, categoriaIds: [1, 2] };
    expect(countActiveFilters(filters)).toBe(1);
  });

  it('soma todos os filtros ativos ao mesmo tempo', () => {
    const filters: ProdutoFilters = {
      ordenar: 'valor_asc',
      estoqueAbaixoDe: 10,
      somenteZerado: true,
      categoriaIds: [3],
    };
    expect(countActiveFilters(filters)).toBe(4);
  });
});
