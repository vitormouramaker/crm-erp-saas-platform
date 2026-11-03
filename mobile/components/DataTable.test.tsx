import { render } from '@testing-library/react-native';

import { DataTable } from './DataTable';

const columns = [
  { key: 'nome', label: 'Nome', flex: 1.4 },
  { key: 'valor', label: 'Valor' },
];

describe('DataTable', () => {
  it('renderiza os cabeçalhos das colunas', async () => {
    const { getByText } = await render(<DataTable columns={columns} rows={[]} />);
    expect(getByText('Nome')).toBeTruthy();
    expect(getByText('Valor')).toBeTruthy();
  });

  it('renderiza os valores de cada linha', async () => {
    const rows = [
      { nome: 'João', valor: 'R$ 10,00' },
      { nome: 'Maria', valor: 'R$ 20,00' },
    ];
    const { getByText } = await render(<DataTable columns={columns} rows={rows} />);
    expect(getByText('João')).toBeTruthy();
    expect(getByText('R$ 10,00')).toBeTruthy();
    expect(getByText('Maria')).toBeTruthy();
    expect(getByText('R$ 20,00')).toBeTruthy();
  });

  it('mostra a mensagem padrão quando não há linhas', async () => {
    const { getByText } = await render(<DataTable columns={columns} rows={[]} />);
    expect(getByText('Sem dados no período.')).toBeTruthy();
  });

  it('mostra uma mensagem customizada de vazio', async () => {
    const { getByText } = await render(<DataTable columns={columns} rows={[]} emptyLabel="Nada por aqui." />);
    expect(getByText('Nada por aqui.')).toBeTruthy();
  });
});
