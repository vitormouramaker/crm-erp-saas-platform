import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { connectSocket, disconnectSocket, getSocket, joinEmpresa } from '@/services/socket';
import { useAuth } from '@/store/authStore';

// Canal Android dedicado com importância alta pra a venda aparecer como
// heads-up mesmo com o app em foreground (o canal 'default' do atendimento é
// DEFAULT e só cai na bandeja).
const ANDROID_CHANNEL_ID = 'sales';

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Vendas',
      importance: Notifications.AndroidImportance.HIGH,
    });
  } catch (error) {
    console.log('[commercialRealtime] falha ao criar canal Android', error);
  }
}

// Evento emitido pelo back quando entra uma venda (ou carrinho abandonado)
// pelos webhooks de integração Hotmart/Hubla.
// Ver back/src/server/realtime.js -> notifyCommercialIntegrationUpdate.
const COMMERCIAL_EVENT = 'commercial:integration-update';

type CommercialIntegrationUpdate = {
  event_id?: string;
  tipo?: 'sale' | 'abandoned_cart';
  plataforma?: string;
  empresa_id?: number;
  cliente_nome?: string | null;
  produto_nome?: string | null;
  transacao_id?: string | null;
  emitted_at?: string;
};

// Marca commercial no payload da notificação pra o listener de tap
// (usePushNotificationTapListener) rotear pro comercial em vez do atendimento.
export const COMMERCIAL_NOTIFICATION_KIND = 'commercial';

// dedup: o back propaga o evento entre instâncias via pg_notify e o socket
// pode reconectar/reinscrever — evita notificar o mesmo event_id duas vezes.
const seenEventIds = new Set<string>();
const SEEN_LIMIT = 200;

function rememberEvent(eventId: string): boolean {
  if (seenEventIds.has(eventId)) return false;
  seenEventIds.add(eventId);
  if (seenEventIds.size > SEEN_LIMIT) {
    const oldest = seenEventIds.values().next().value;
    if (oldest !== undefined) seenEventIds.delete(oldest);
  }
  return true;
}

function platformLabel(plataforma?: string): string | null {
  const raw = (plataforma || '').trim().toLowerCase();
  if (!raw || raw === 'integracao') return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function buildNotification(payload: CommercialIntegrationUpdate) {
  const isSale = payload.tipo !== 'abandoned_cart';
  const title = isSale ? 'Nova venda 🎉' : 'Carrinho abandonado';

  const produto = (payload.produto_nome || '').trim();
  const cliente = (payload.cliente_nome || '').trim();
  const loja = platformLabel(payload.plataforma);

  const parts: string[] = [];
  if (produto) parts.push(produto);
  if (cliente) parts.push(cliente);
  let body = parts.join(' — ');
  if (loja) body = body ? `${body} · ${loja}` : loja;
  if (!body) body = isSale ? 'Uma nova venda foi registrada.' : 'Um carrinho foi abandonado.';

  return {
    title,
    body,
    sound: 'default' as const,
    data: {
      kind: COMMERCIAL_NOTIFICATION_KIND,
      tipo: payload.tipo || 'sale',
      transacao_id: payload.transacao_id ?? null,
    },
  };
}

// Mantém o socket conectado enquanto houver usuário logado e dispara uma
// notificação local a cada venda/carrinho abandonado recebido. Só entrega em
// foreground/app aberto — o back não manda push Expo pra esse evento.
export function useCommercialRealtime() {
  const { user } = useAuth();
  const empresaId = user?.empresa_id;

  useEffect(() => {
    console.log('[commercialRealtime] effect run, empresaId=', empresaId);
    if (!empresaId) return;

    void ensureAndroidChannel();

    const socket = getSocket();
    connectSocket();
    joinEmpresa(empresaId);

    const handler = (payload: CommercialIntegrationUpdate) => {
      console.log('[commercialRealtime] evento recebido', JSON.stringify(payload));
      if (!payload || (payload.empresa_id != null && payload.empresa_id !== empresaId)) {
        console.log('[commercialRealtime] descartado: empresa_id', payload?.empresa_id, '!==', empresaId);
        return;
      }
      const eventId = payload.event_id || `${payload.transacao_id ?? ''}-${payload.emitted_at ?? ''}`;
      if (eventId && !rememberEvent(eventId)) {
        console.log('[commercialRealtime] descartado: event_id repetido', eventId);
        return;
      }

      Notifications.scheduleNotificationAsync({
        content: buildNotification(payload),
        // channelId só é aceito no trigger; entrega imediata mesmo assim.
        trigger: Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : null,
      })
        .then((id) => console.log('[commercialRealtime] notificacao agendada', id))
        .catch((error) => {
          console.log('[commercialRealtime] falha ao agendar notificacao', error);
        });
    };

    socket.on(COMMERCIAL_EVENT, handler);

    return () => {
      socket.off(COMMERCIAL_EVENT, handler);
      // Sem usuário logado não faz sentido manter o socket vivo.
      disconnectSocket();
    };
  }, [empresaId]);
}
