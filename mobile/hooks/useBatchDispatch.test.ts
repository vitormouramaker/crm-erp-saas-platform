import { act, renderHook } from '@testing-library/react-native';

import { useBatchDispatch } from './useBatchDispatch';
import { dispararTemplateLote, statusDisparoLote, DispatchBatchProgress } from '@/services/metaApi';
import type { User } from '@/types';

jest.mock('@/services/metaApi');

const mockDispararTemplateLote = dispararTemplateLote as jest.MockedFunction<typeof dispararTemplateLote>;
const mockStatusDisparoLote = statusDisparoLote as jest.MockedFunction<typeof statusDisparoLote>;

const user: User = { id: 1, name: 'Teste', empresa_id: 1, is_master: false, pdv: false, permissions: [] };

function progress(overrides: Partial<DispatchBatchProgress> = {}): DispatchBatchProgress {
  return {
    found: true,
    dispatch_history_id: 1,
    template_id: 'tpl',
    template_name: 'tpl',
    template_category: 'MARKETING',
    lista_transmissao_id: null,
    total_items: 10,
    processed_items: 0,
    success_count: 0,
    error_count: 0,
    remaining_items: 10,
    progress_percent: 0,
    stopped_on_error: false,
    started_at: null,
    finished_at: null,
    duration_ms: 0,
    status: 'running',
    metadata: {},
    cost_summary: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockDispararTemplateLote.mockReset();
  mockStatusDisparoLote.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

const params = { template_name: 'tpl', language: 'pt_BR', meta_param_id: 1, items: [] };

describe('useBatchDispatch', () => {
  it('inicia o disparo e guarda o progresso inicial', async () => {
    mockDispararTemplateLote.mockResolvedValue({ clientBatchToken: 'token-1', progress: progress() });

    const { result } = await renderHook(() => useBatchDispatch(user));

    await act(async () => {
      await result.current.start(params);
    });

    expect(result.current.starting).toBe(false);
    expect(result.current.progress?.status).toBe('running');
    expect(mockDispararTemplateLote).toHaveBeenCalledWith(user, params, undefined);
  });

  it('faz polling do status a cada 4s enquanto não terminal', async () => {
    mockDispararTemplateLote.mockResolvedValue({ clientBatchToken: 'token-1', progress: progress() });
    mockStatusDisparoLote.mockResolvedValue(progress({ processed_items: 5, progress_percent: 50 }));

    const { result } = await renderHook(() => useBatchDispatch(user));
    await act(async () => {
      await result.current.start(params);
    });

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    expect(mockStatusDisparoLote).toHaveBeenCalledWith(user, 'token-1');
    expect(result.current.progress?.processed_items).toBe(5);
  });

  it('para de fazer polling quando o status vira terminal', async () => {
    mockDispararTemplateLote.mockResolvedValue({ clientBatchToken: 'token-1', progress: progress() });
    mockStatusDisparoLote.mockResolvedValue(progress({ status: 'completed', processed_items: 10 }));

    const { result } = await renderHook(() => useBatchDispatch(user));
    await act(async () => {
      await result.current.start(params);
    });

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(mockStatusDisparoLote).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(mockStatusDisparoLote).toHaveBeenCalledTimes(1);
  });

  it('ignora erro de polling e continua tentando no próximo tick', async () => {
    mockDispararTemplateLote.mockResolvedValue({ clientBatchToken: 'token-1', progress: progress() });
    mockStatusDisparoLote
      .mockRejectedValueOnce(new Error('falha de rede'))
      .mockResolvedValueOnce(progress({ processed_items: 3 }));

    const { result } = await renderHook(() => useBatchDispatch(user));
    await act(async () => {
      await result.current.start(params);
    });

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(result.current.progress?.processed_items).toBe(0);

    await act(async () => {
      jest.advanceTimersByTime(4000);
      await Promise.resolve();
    });
    expect(result.current.progress?.processed_items).toBe(3);
  });

  it('reset limpa token/progresso e para o polling', async () => {
    mockDispararTemplateLote.mockResolvedValue({ clientBatchToken: 'token-1', progress: progress() });
    mockStatusDisparoLote.mockResolvedValue(progress({ processed_items: 5 }));

    const { result } = await renderHook(() => useBatchDispatch(user));
    await act(async () => {
      await result.current.start(params);
    });

    await act(() => {
      result.current.reset();
    });
    expect(result.current.progress).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(8000);
      await Promise.resolve();
    });
    expect(mockStatusDisparoLote).not.toHaveBeenCalled();
  });
});
