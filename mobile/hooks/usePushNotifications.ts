import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';

// Título fixo usado pelo back em todo envio de mensagem (templates.js emitChatMessageUpdate).
// Mensagens recebidas nunca usam esse título (nome do cliente ou fallback "Nova mensagem no atendimento").
// Só filtra em foreground: em background/app fechado o SO exibe a notificação antes do JS rodar.
const SENT_MESSAGE_PUSH_TITLE = 'Atendimento atualizado';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isSentMessagePush =
      notification.request.content.title === SENT_MESSAGE_PUSH_TITLE;

    return {
      shouldShowBanner: !isSentMessagePush,
      shouldShowList: !isSentMessagePush,
      shouldPlaySound: !isSentMessagePush,
      shouldSetBadge: false,
    };
  },
});

// Chamado após login/restauração de sessão pra obter o token do device (Android/iOS).
// Retorna null em simulador/emulador ou se o usuário negar a permissão.
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    console.log('[push][debug] Device.isDevice:', Device.isDevice);
    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    console.log('[push][debug] permissao atual:', status);
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
      console.log('[push][debug] permissao apos pedido:', status);
    }
    if (status !== 'granted') return null;

    const { data } = await Notifications.getExpoPushTokenAsync();
    console.log('[push][debug] getExpoPushTokenAsync retornou:', data);
    return data;
  } catch (error) {
    console.log('[push][debug] ERRO em registerForPushNotificationsAsync:', error);
    return null;
  }
}

// Back monta o título como "Nova mensagem de {nome}" (buildPushTitle em realtime.js) quando
// há cliente associado; extrai o nome daqui já que /carregar_conversa não devolve nome do cliente.
function extractNomeFromTitle(title: string | null | undefined): string | undefined {
  const match = typeof title === 'string' ? title.match(/^Nova mensagem de (.+)$/) : null;
  return match ? match[1] : undefined;
}

// `conversa/[id]` é uma Stack.Screen na raiz (app/_layout.tsx), não aninhada nas tabs.
// Se já estamos numa tela de conversa, `push` empilha uma segunda instância por cima
// (parece "duplicar" a tela) e o botão voltar cai na conversa anterior em vez da lista.
// `replace` troca a tela atual no lugar, então usamos ele quando já estamos em `/conversa/*`.
function navigateFromNotificationResponse(
  response: Notifications.NotificationResponse,
  currentPathname: string
) {
  const data = response.notification.request.content.data ?? {};

  // Notificação de venda/carrinho abandonado (useCommercialRealtime): sem
  // conversa associada, leva pra aba Comercial.
  if (data.kind === 'commercial') {
    // Grupos de rota não aparecem na pathname em runtime: a aba resolve como `/comercial`.
    const navigate = currentPathname === '/comercial' ? router.replace : router.push;
    navigate('/(tabs)/comercial');
    return;
  }

  const conversaId = data.conversa_id;
  console.log('[push] navigateFromNotificationResponse conversaId=', conversaId);
  if (!conversaId) return;
  const nome = extractNomeFromTitle(response.notification.request.content.title);
  const navigate = currentPathname.startsWith('/conversa/') ? router.replace : router.push;
  navigate({
    pathname: '/conversa/[id]',
    params: nome ? { id: String(conversaId), nome } : { id: String(conversaId) },
  });
}

// Telas de lista (ex.: abas Aguardando/Finalizados) chamam isso pra recarregar
// assim que uma mensagem nova chega com o app em foreground — sem isso, só
// atualizavam em useFocusEffect/pull-to-refresh. Ignora o push de mensagem
// enviada (mesmo filtro de título usado em setNotificationHandler).
export function usePushMessageReceivedListener(onMessageReceived: () => void) {
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const isSentMessagePush =
        notification.request.content.title === SENT_MESSAGE_PUSH_TITLE;
      if (isSentMessagePush) return;
      // Notificação de venda não é de atendimento — não recarrega listas de chat.
      if (notification.request.content.data?.kind === 'commercial') return;
      onMessageReceived();
    });
    return () => subscription.remove();
  }, [onMessageReceived]);
}

// Monta uma única vez (na raiz do app) o listener de tap na notificação,
// levando o usuário direto pra conversa relacionada.
export function usePushNotificationTapListener() {
  // O listener é inscrito uma única vez (mount), então lê a pathname via ref
  // pra sempre enxergar a tela atual no momento do tap, não a do mount.
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    // Com o app killed, o tap que causa o cold start acontece antes desse
    // listener conseguir se inscrever — por isso também checamos a última
    // resposta pendente uma vez na montagem.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      navigateFromNotificationResponse(response, pathnameRef.current);
      // Sem isso, o mesmo response fica "grudado" e reabre a mesma notificação
      // a cada novo cold start do app, não só na vez em que foi tocada.
      Notifications.clearLastNotificationResponse();
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      navigateFromNotificationResponse(response, pathnameRef.current)
    );
    return () => subscription.remove();
  }, []);
}
