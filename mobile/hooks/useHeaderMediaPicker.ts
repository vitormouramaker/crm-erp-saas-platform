import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import type { TemplateHeaderFormat } from '@/services/metaApi';

export interface HeaderMediaAsset {
  uri: string;
  name: string;
  mimeType?: string;
}

export function useHeaderMediaPicker() {
  const [asset, setAsset] = useState<HeaderMediaAsset | null>(null);

  async function pick(format: TemplateHeaderFormat) {
    if (format === 'DOCUMENT') {
      const resultado = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (resultado.canceled || !resultado.assets?.length) return;
      const picked = resultado.assets[0];
      setAsset({ uri: picked.uri, name: picked.name, mimeType: picked.mimeType || undefined });
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: format === 'VIDEO' ? ['videos'] : ['images'],
      quality: 0.8,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const picked = resultado.assets[0];
    setAsset({
      uri: picked.uri,
      name: picked.fileName || `midia_${Date.now()}.${picked.uri.split('.').pop() || 'jpg'}`,
      mimeType: picked.mimeType,
    });
  }

  function reset() {
    setAsset(null);
  }

  return { asset, pick, reset };
}
