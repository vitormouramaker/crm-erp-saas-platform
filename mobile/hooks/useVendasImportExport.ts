import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import {
  getVendasConsolidadas,
  importarVendasConsolidadas,
  VendaConsolidada,
  VendaFonte,
} from '@/services/vendasApi';
import {
  buildVendasExportBase64,
  buildVendasModeloBase64,
  parseVendasWorkbookBase64,
} from '@/utils/vendasSpreadsheet';
import type { User } from '@/types';

const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_ROWS = 5000;
const IMPORT_MAX_ROWS = 500;
const PICKER_TIMEOUT_MS = 60000;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

async function shareFile(base64: string, name: string, dialogTitle: string) {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: XLSX_MIME, dialogTitle });
  } else {
    Alert.alert(dialogTitle, `Arquivo salvo em: ${file.uri}`);
  }
}

export interface VendasExportFilters {
  search?: string;
  fonte?: VendaFonte;
  ownerId?: number;
  dateStart?: string;
  dateEnd?: string;
}

export function useVendasImportExport(user: User | null) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingModelo, setDownloadingModelo] = useState(false);
  const pickingRef = useRef(false);

  async function exportVendas(filters: VendasExportFilters) {
    if (!user) return;
    setExporting(true);
    try {
      const vendas: VendaConsolidada[] = [];
      let pagina = 1;
      let total = Infinity;

      while (vendas.length < total && vendas.length < EXPORT_MAX_ROWS) {
        const page = await getVendasConsolidadas(user, {
          ...filters,
          pagina,
          limite: EXPORT_PAGE_SIZE,
        });
        vendas.push(...page.items);
        total = page.total;
        if (page.items.length === 0) break;
        pagina += 1;
      }

      if (vendas.length === 0) {
        Alert.alert('Exportar vendas', 'Nenhuma venda encontrada para os filtros atuais.');
        return;
      }

      await shareFile(
        buildVendasExportBase64(vendas),
        `vendas-${Date.now()}.xlsx`,
        'Exportar vendas'
      );

      if (total > EXPORT_MAX_ROWS) {
        Alert.alert(
          'Exportação parcial',
          `Foram exportadas as primeiras ${EXPORT_MAX_ROWS} de ${total} vendas. Refine os filtros para exportar o restante.`
        );
      }
    } catch (err: any) {
      Alert.alert('Erro ao exportar', err?.message || 'Não foi possível exportar as vendas.');
    } finally {
      setExporting(false);
    }
  }

  async function baixarModelo() {
    setDownloadingModelo(true);
    try {
      await shareFile(buildVendasModeloBase64(), 'modelo-importacao-vendas.xlsx', 'Baixar modelo');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível gerar o modelo.');
    } finally {
      setDownloadingModelo(false);
    }
  }

  async function importVendas(onFinished: () => void) {
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
        Alert.alert('Importar vendas', 'Selecione um arquivo .csv, .xlsx ou .xls.');
        return;
      }

      const base64 = await new File(asset.uri).base64();
      const rows = parseVendasWorkbookBase64(base64);
      const validRows = rows.filter((row) => row.cliente_nome && row.data_venda);

      if (validRows.length === 0) {
        Alert.alert(
          'Importar vendas',
          'Nenhuma linha com cliente e data de venda foi encontrada. Confira o modelo.'
        );
        return;
      }

      if (validRows.length > IMPORT_MAX_ROWS) {
        Alert.alert(
          'Importar vendas',
          `O arquivo tem ${validRows.length} linhas válidas. Serão importadas apenas as primeiras ${IMPORT_MAX_ROWS}.`
        );
      }

      const resultado = await importarVendasConsolidadas(
        user,
        validRows.slice(0, IMPORT_MAX_ROWS).map((row) => ({
          cliente_nome: row.cliente_nome,
          telefone: row.telefone || undefined,
          email: row.email || undefined,
          produto: row.produto || undefined,
          valor: row.valor,
          data_venda: row.data_venda,
          origem: row.origem || undefined,
          observacoes: row.observacoes || undefined,
        }))
      );

      const resumo = [`Importadas: ${resultado.imported}`];
      if (resultado.errors.length > 0) {
        resumo.push(`Com erro: ${resultado.errors.length}`);
        resultado.errors.slice(0, 5).forEach((e) => resumo.push(`Linha ${e.linha}: ${e.mensagem}`));
      }
      Alert.alert('Importação concluída', resumo.join('\n'));
      onFinished();
    } catch (err: any) {
      Alert.alert('Erro ao importar', err?.message || 'Não foi possível importar o arquivo.');
    } finally {
      pickingRef.current = false;
      setImporting(false);
    }
  }

  return {
    exporting,
    importing,
    downloadingModelo,
    exportVendas,
    baixarModelo,
    importVendas,
  };
}
