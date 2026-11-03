import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {
  Cliente,
  ClienteFiltro,
  ClienteFiltrosCompostos,
  getClientes,
  importarClientes,
} from '@/services/clientesApi';
import { buildContatosWorkbookBase64, parseContatosWorkbookBase64 } from '@/utils/contactsSpreadsheet';
import type { User } from '@/types';

const EXPORT_PAGE_SIZE = 200;

const PICKER_TIMEOUT_MS = 60000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error('O seletor de arquivos não respondeu. Feche e reabra o app e tente novamente.')),
        ms
      );
    }),
  ]);
}

export function useContactsImportExport(user: User | null) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const pickingRef = useRef(false);

  async function exportContacts(params: {
    busca?: string;
    filtro?: ClienteFiltro;
    filtros_compostos?: ClienteFiltrosCompostos;
  }) {
    if (!user) return;
    setExporting(true);
    try {
      const clientes: Cliente[] = [];
      let pagina = 1;
      let total = Infinity;

      while (clientes.length < total) {
        const page = await getClientes(user, { pagina, limite: EXPORT_PAGE_SIZE, ...params });
        clientes.push(...page.items);
        total = page.total;
        if (page.items.length === 0) break;
        pagina += 1;
      }

      if (clientes.length === 0) {
        Alert.alert('Exportar contatos', 'Nenhum contato encontrado para exportar.');
        return;
      }

      const base64 = buildContatosWorkbookBase64(clientes);
      const file = new File(Paths.cache, `contatos-${Date.now()}.xlsx`);
      file.create({ overwrite: true });
      file.write(base64, { encoding: 'base64' });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Exportar contatos',
        });
      } else {
        Alert.alert('Exportar contatos', `Arquivo salvo em: ${file.uri}`);
      }
    } catch (err: any) {
      Alert.alert('Erro ao exportar', err?.message || 'Não foi possível exportar os contatos.');
    } finally {
      setExporting(false);
    }
  }

  async function importContacts(onFinished: () => void) {
    if (!user || pickingRef.current) return;
    pickingRef.current = true;
    setImporting(true);
    try {
      const picked = await withTimeout(
        DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true }),
        PICKER_TIMEOUT_MS
      );
      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];
      const extension = asset.name.split('.').pop()?.toLowerCase();
      if (!extension || !['csv', 'xlsx', 'xls'].includes(extension)) {
        Alert.alert('Importar contatos', 'Selecione um arquivo .csv, .xlsx ou .xls.');
        return;
      }

      const file = new File(asset.uri);
      const base64 = await file.base64();
      const rows = parseContatosWorkbookBase64(base64);
      const validRows = rows.filter((row) => row.telefone);

      if (validRows.length === 0) {
        Alert.alert('Importar contatos', 'Nenhuma linha com telefone válido foi encontrada na planilha.');
        return;
      }

      const resultado = await importarClientes(user, validRows);
      const resumo = [
        `Criados: ${resultado.criados}`,
        `Atualizados: ${resultado.atualizados}`,
        `Tags adicionadas: ${resultado.tags_adicionadas}`,
      ];
      if (resultado.erros.length > 0) {
        resumo.push(`Erros: ${resultado.erros.length}`);
      }
      Alert.alert('Importação concluída', resumo.join('\n'));
      onFinished();
    } catch (err: any) {
      Alert.alert('Erro ao importar', err?.message || 'Não foi possível importar a planilha.');
    } finally {
      pickingRef.current = false;
      setImporting(false);
    }
  }

  return { exporting, importing, exportContacts, importContacts };
}
