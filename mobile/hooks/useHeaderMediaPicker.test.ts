import { act, renderHook } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { useHeaderMediaPicker } from './useHeaderMediaPicker';

jest.mock('expo-image-picker');
jest.mock('expo-document-picker');

const mockLaunchLibrary = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;
const mockGetDocument = DocumentPicker.getDocumentAsync as jest.MockedFunction<
  typeof DocumentPicker.getDocumentAsync
>;

beforeEach(() => {
  mockLaunchLibrary.mockReset();
  mockGetDocument.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useHeaderMediaPicker', () => {
  it('seleciona um documento e guarda nome/mimeType', async () => {
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://a.pdf', name: 'contrato.pdf', mimeType: 'application/pdf' }],
    } as any);

    const { result } = await renderHook(() => useHeaderMediaPicker());

    await act(async () => {
      await result.current.pick('DOCUMENT');
    });

    expect(result.current.asset).toEqual({
      uri: 'file://a.pdf',
      name: 'contrato.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('mantem asset nulo quando cancela a seleção de documento', async () => {
    mockGetDocument.mockResolvedValue({ canceled: true, assets: null } as any);

    const { result } = await renderHook(() => useHeaderMediaPicker());

    await act(async () => {
      await result.current.pick('DOCUMENT');
    });

    expect(result.current.asset).toBeNull();
  });

  it('seleciona uma imagem e usa o fileName retornado', async () => {
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://b.jpg', fileName: 'foto.jpg', mimeType: 'image/jpeg' }],
    } as any);

    const { result } = await renderHook(() => useHeaderMediaPicker());

    await act(async () => {
      await result.current.pick('IMAGE');
    });

    expect(result.current.asset).toEqual({
      uri: 'file://b.jpg',
      name: 'foto.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('gera um nome a partir da uri quando a imagem não tem fileName', async () => {
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/xyz.png', fileName: null, mimeType: 'image/png' }],
    } as any);

    const { result } = await renderHook(() => useHeaderMediaPicker());

    await act(async () => {
      await result.current.pick('IMAGE');
    });

    expect(result.current.asset?.name).toMatch(/^midia_\d+\.png$/);
  });

  it('pede vídeos quando o formato é VIDEO', async () => {
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: null } as any);

    const { result } = await renderHook(() => useHeaderMediaPicker());

    await act(async () => {
      await result.current.pick('VIDEO');
    });

    expect(mockLaunchLibrary).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['videos'] }));
  });

  it('reset limpa o asset selecionado', async () => {
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://a.pdf', name: 'contrato.pdf', mimeType: 'application/pdf' }],
    } as any);

    const { result } = await renderHook(() => useHeaderMediaPicker());

    await act(async () => {
      await result.current.pick('DOCUMENT');
    });
    expect(result.current.asset).not.toBeNull();

    await act(() => {
      result.current.reset();
    });
    expect(result.current.asset).toBeNull();
  });
});
