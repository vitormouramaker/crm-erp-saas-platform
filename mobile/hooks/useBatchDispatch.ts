import { useEffect, useRef, useState } from 'react';

import type { RNFile } from '@/services/apiClient';
import {
  DispatchBatchItem,
  DispatchBatchProgress,
  dispararTemplateLote,
  statusDisparoLote,
} from '@/services/metaApi';
import type { User } from '@/types';

const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES = ['completed', 'stopped_on_error', 'failed'];

export interface BatchDispatchParams {
  template_name: string;
  language: string;
  meta_param_id: number;
  items: DispatchBatchItem[];
  lista_id?: number;
  stop_on_error?: boolean;
}

export function useBatchDispatch(user: User) {
  const [starting, setStarting] = useState(false);
  const [clientBatchToken, setClientBatchToken] = useState<string | null>(null);
  const [progress, setProgress] = useState<DispatchBatchProgress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!clientBatchToken) return;

    pollRef.current = setInterval(async () => {
      try {
        const data = await statusDisparoLote(user, clientBatchToken);
        setProgress(data);
        if (TERMINAL_STATUSES.includes(data.status) && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // mantém tentando no próximo tick
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [clientBatchToken, user]);

  async function start(params: BatchDispatchParams, headerFile?: RNFile) {
    setStarting(true);
    try {
      const { clientBatchToken: token, progress: initialProgress } = await dispararTemplateLote(
        user,
        params,
        headerFile
      );
      setClientBatchToken(token);
      setProgress(initialProgress);
    } finally {
      setStarting(false);
    }
  }

  function reset() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setClientBatchToken(null);
    setProgress(null);
  }

  return { starting, progress, start, reset };
}
