import { fireEvent, render } from '@testing-library/react-native';

import { EmptyState, ErrorState, LoadingState, PermissionDeniedState } from './ScreenState';

describe('LoadingState', () => {
  it('renderiza sem quebrar', async () => {
    const { toJSON } = await render(<LoadingState />);
    expect(toJSON()).not.toBeNull();
  });
});

describe('ErrorState', () => {
  it('mostra o título padrão "Erro" e a mensagem', async () => {
    const { getByText } = await render(<ErrorState message="Falha ao carregar dados." />);
    expect(getByText('Erro')).toBeTruthy();
    expect(getByText('Falha ao carregar dados.')).toBeTruthy();
  });

  it('não mostra botão de retry quando onRetry não é passado', async () => {
    const { queryByText } = await render(<ErrorState message="Falha." />);
    expect(queryByText('Tentar novamente')).toBeNull();
  });

  it('mostra botão de retry e chama onRetry ao tocar', async () => {
    const onRetry = jest.fn();
    const { getByText } = await render(<ErrorState message="Falha." onRetry={onRetry} />);

    await fireEvent.press(getByText('Tentar novamente'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('aceita título customizado', async () => {
    const { getByText, queryByText } = await render(
      <ErrorState message="Configure as colunas." title="Erro ao carregar" />
    );
    expect(getByText('Erro ao carregar')).toBeTruthy();
    expect(queryByText('Erro')).toBeNull();
  });
});

describe('EmptyState', () => {
  it('mostra a mensagem', async () => {
    const { getByText } = await render(<EmptyState message="Nenhum item encontrado." />);
    expect(getByText('Nenhum item encontrado.')).toBeTruthy();
  });

  it('mostra título e mensagem quando ambos são passados', async () => {
    const { getByText } = await render(
      <EmptyState title="Nenhuma etapa configurada" message="Configure as colunas deste funil na versão web." />
    );
    expect(getByText('Nenhuma etapa configurada')).toBeTruthy();
    expect(getByText('Configure as colunas deste funil na versão web.')).toBeTruthy();
  });
});

describe('PermissionDeniedState', () => {
  it('usa "Sem permissão" como título padrão', async () => {
    const { getByText } = await render(<PermissionDeniedState message="Você não tem acesso a este módulo." />);
    expect(getByText('Sem permissão')).toBeTruthy();
    expect(getByText('Você não tem acesso a este módulo.')).toBeTruthy();
  });

  it('aceita título customizado', async () => {
    const { getByText, queryByText } = await render(
      <PermissionDeniedState title="Sem sessão ativa" message="Faça login novamente." />
    );
    expect(getByText('Sem sessão ativa')).toBeTruthy();
    expect(queryByText('Sem permissão')).toBeNull();
  });
});
