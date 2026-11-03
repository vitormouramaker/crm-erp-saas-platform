import { countActiveContactFilters, EMPTY_CONTACT_FILTERS, ContactFilters } from './ContactFilterSheet';

describe('countActiveContactFilters', () => {
  it('retorna 0 quando os filtros estão no padrão', () => {
    expect(countActiveContactFilters(EMPTY_CONTACT_FILTERS)).toBe(0);
  });

  it('conta filtro diferente de "all"', () => {
    const filters: ContactFilters = { ...EMPTY_CONTACT_FILTERS, filtro: 'with_crm' };
    expect(countActiveContactFilters(filters)).toBe(1);
  });

  it('conta origem preenchida', () => {
    const filters: ContactFilters = {
      ...EMPTY_CONTACT_FILTERS,
      compostos: { ...EMPTY_CONTACT_FILTERS.compostos, origem: 'facebook' },
    };
    expect(countActiveContactFilters(filters)).toBe(1);
  });

  it('conta utm preenchida, ignorando espaços em branco', () => {
    const emUtmVazia: ContactFilters = {
      ...EMPTY_CONTACT_FILTERS,
      compostos: { ...EMPTY_CONTACT_FILTERS.compostos, utm: '   ' },
    };
    expect(countActiveContactFilters(emUtmVazia)).toBe(0);

    const comUtm: ContactFilters = {
      ...EMPTY_CONTACT_FILTERS,
      compostos: { ...EMPTY_CONTACT_FILTERS.compostos, utm: 'campanha-julho' },
    };
    expect(countActiveContactFilters(comUtm)).toBe(1);
  });

  it('conta tag_ids quando não vazio', () => {
    const filters: ContactFilters = {
      ...EMPTY_CONTACT_FILTERS,
      compostos: { ...EMPTY_CONTACT_FILTERS.compostos, tag_ids: [7] },
    };
    expect(countActiveContactFilters(filters)).toBe(1);
  });

  it('conta como 1 filtro mesmo com as duas datas preenchidas', () => {
    const filters: ContactFilters = {
      ...EMPTY_CONTACT_FILTERS,
      compostos: {
        ...EMPTY_CONTACT_FILTERS.compostos,
        data_entrada_inicial: '2026-07-01',
        data_entrada_final: '2026-07-25',
      },
    };
    expect(countActiveContactFilters(filters)).toBe(1);
  });

  it('soma todos os filtros ativos ao mesmo tempo', () => {
    const filters: ContactFilters = {
      filtro: 'birthday_5_days',
      compostos: {
        utm: 'campanha',
        origem: 'instagram',
        tag_ids: [1, 2],
        data_entrada_inicial: '2026-07-01',
        data_entrada_final: '',
      },
    };
    expect(countActiveContactFilters(filters)).toBe(5);
  });
});
