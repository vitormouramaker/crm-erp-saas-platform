import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { File } from 'expo-file-system';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';

import { cardSurface, type ThemeColors } from '@/constants/theme/tokens';
import { useTheme } from '@/store/themeStore';
import { API_BASE } from '@/services/apiClient';
import {
  CarregarConversaResult,
  ConversaDados,
  Mensagem,
  MensagemCursor,
  MensagemRapida,
  buscarMensagensRapidas,
  carregarConversa,
  enviarAudioGaleria,
  enviarContato,
  enviarDocumentoUrl,
  enviarImagemUrl,
  enviarImagensProdutoComercial,
  enviarLocalizacao,
  enviarMensagem,
  enviarMidia,
  finalizarAtendimento,
  getConversas,
  iniciarAtendimento,
  reagirMensagem,
  transferirAtendimento,
  type MidiaArquivo,
} from '@/services/atendimentoApi';
import { AnaliseIASheet } from '@/components/AnaliseIASheet';
import { AttachMenuSheet } from '@/components/AttachMenuSheet';
import { DetalhesClienteSheet } from '@/components/DetalhesClienteSheet';
import { ManagedUser, getUsuarios } from '@/services/usersApi';
import { getAtendenteColor } from '@/utils/chatHelpers';
import { ReportSheet } from '@/components/ReportSheet';
import {
  apagarMensagem,
  bloquearCliente,
  denunciar,
  desbloquearCliente,
  type MotivoDenuncia,
} from '@/services/moderacaoApi';
import { SendContactModal } from '@/components/SendContactModal';
import { SendDocumentGalleryModal } from '@/components/SendDocumentGalleryModal';
import { SendGalleryModal } from '@/components/SendGalleryModal';
import { SendTemplateSheet } from '@/components/SendTemplateSheet';
import type { GalleryDocument } from '@/services/quickMessagesApi';
import type { Cliente } from '@/services/clientesApi';
import { useAuth } from '@/store/authStore';

const POLL_INTERVAL_MS = 6000;
const JANELA_META_MS = 24 * 60 * 60 * 1000;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMessageTime(value: string | null | undefined): string {
  const date = parseTimestamp(value);
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(2)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function mergeMensagens(prev: Mensagem[], incoming: Mensagem[], position: 'start' | 'end') {
  if (!incoming.length) return prev;
  const prevIds = new Set(prev.map((item) => item.id));
  const incomingMap = new Map(incoming.map((item) => [item.id, item]));
  const atualizados = prev.map((item) => incomingMap.get(item.id) ?? item);
  const novos = incoming.filter((item) => !prevIds.has(item.id));
  if (!novos.length && atualizados.every((item, i) => item === prev[i])) return prev;
  return position === 'start' ? [...novos, ...atualizados] : [...atualizados, ...novos];
}

function computeTileXY(lat: number, lng: number, zoom: number): { x: number; y: number; z: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

function isVisualMediaMensagem(item: Mensagem): boolean {
  if (item.type !== 'media') return false;
  const mediaType = String(item.mediaType || '').toLowerCase();
  if (mediaType.startsWith('image')) return true;
  if (mediaType.startsWith('video')) {
    const isMisclassifiedRecordedAudio = /^audio_\d+\./.test(item.fileName || '');
    return !isMisclassifiedRecordedAudio;
  }
  return false;
}

function formatAudioTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const WAVEFORM_BAR_COUNT = 32;

function generateWaveformBars(seed: string): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  let x = h || 1;
  const bars: number[] = [];
  for (let i = 0; i < WAVEFORM_BAR_COUNT; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    bars.push(3 + (x % 1000) / 1000 * 13);
  }
  return bars;
}

function ImageViewerModal({
  uri,
  onClose,
}: {
  uri: string | null;
  onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const isZoomed = useRef(false);
  const lastTap = useRef(0);

  useEffect(() => {
    if (uri) {
      translateY.setValue(0);
      scale.setValue(1);
      isZoomed.current = false;
    }
  }, [uri, translateY, scale]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 4 || Math.abs(gestureState.dx) > 4,
      onPanResponderMove: Animated.event([null, { dy: translateY }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        const isTap = Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10;
        if (isTap) {
          const now = Date.now();
          if (now - lastTap.current < 280) {
            isZoomed.current = !isZoomed.current;
            Animated.spring(scale, {
              toValue: isZoomed.current ? 2.5 : 1,
              friction: 6,
              useNativeDriver: true,
            }).start();
          }
          lastTap.current = now;
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          return;
        }
        if (Math.abs(gestureState.dy) > 120 || Math.abs(gestureState.vy) > 1.1) {
          const alvo = gestureState.dy > 0 ? Dimensions.get('window').height : -Dimensions.get('window').height;
          Animated.timing(translateY, {
            toValue: alvo,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          Animated.spring(translateY, { toValue: 0, friction: 7, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const backdropOpacity = translateY.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: [0.4, 1, 0.4],
    extrapolate: 'clamp',
  });
  const dragShrink = translateY.interpolate({
    inputRange: [-300, 0, 300],
    outputRange: [0.75, 1, 0.75],
    extrapolate: 'clamp',
  });

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styleViewerBackdrop, { opacity: backdropOpacity }]}>
        <Pressable style={styleViewerCloseButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        {uri && (
          <Animated.View
            {...panResponder.panHandlers}
            style={{
              transform: [{ translateY }, { scale: Animated.multiply(scale, dragShrink) }],
            }}
          >
            <Image source={{ uri }} style={styleViewerImage} resizeMode="contain" />
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styleViewerBackdrop = {
  flex: 1,
  backgroundColor: '#000',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
const styleViewerImage = {
  width: Dimensions.get('window').width,
  height: Dimensions.get('window').height * 0.8,
};
const styleViewerCloseButton = {
  position: 'absolute' as const,
  top: 56,
  right: 20,
  zIndex: 1,
  padding: 8,
};

function VideoViewerModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (uri) {
      player.play();
    } else {
      player.pause();
    }
  }, [uri, player]);

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styleViewerBackdrop}>
        <Pressable style={styleViewerCloseButton} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        {uri && (
          <VideoView
            player={player}
            style={styleViewerImage}
            contentFit="contain"
            nativeControls
          />
        )}
      </View>
    </Modal>
  );
}

function AudioBubble({ uri, isAgent }: { uri: string; isAgent: boolean }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const duration = status.duration || 0;
  const current = status.currentTime || 0;
  const [scrubProgress, setScrubProgress] = useState<number | null>(null);
  const progress = scrubProgress ?? (duration > 0 ? Math.min(current / duration, 1) : 0);
  const tintColor = isAgent ? '#141414' : colors.textPrimary;
  const trackWidthRef = useRef(0);

  const seekToRatio = useCallback(
    (ratio: number) => {
      if (duration <= 0) return;
      const clamped = Math.min(Math.max(ratio, 0), 1);
      player.seekTo(clamped * duration);
    },
    [duration, player]
  );

  const seekGesture = useMemo(() => {
    const ratioFromX = (x: number) => (trackWidthRef.current > 0 ? Math.min(Math.max(x / trackWidthRef.current, 0), 1) : 0);
    return Gesture.Pan()
      .runOnJS(true)
      .enabled(duration > 0)
      .hitSlop({ top: 10, bottom: 10 })
      .onStart((evt) => {
        setScrubProgress(ratioFromX(evt.x));
      })
      .onUpdate((evt) => {
        setScrubProgress(ratioFromX(evt.x));
      })
      .onEnd((evt) => {
        seekToRatio(ratioFromX(evt.x));
        setScrubProgress(null);
      })
      .onFinalize(() => {
        setScrubProgress(null);
      });
  }, [duration, seekToRatio]);

  const bars = useMemo(() => generateWaveformBars(uri), [uri]);
  const playedBars = Math.round(progress * bars.length);
  const mutedColor = isAgent ? 'rgba(255,255,255,0.35)' : 'rgba(20,20,20,0.3)';

  return (
    <View style={styles.audioBubble}>
      <Pressable
        style={[styles.audioPlayButton, { backgroundColor: isAgent ? '#141414' : colors.accent }]}
        onPress={() => {
          if (status.playing) {
            player.pause();
            return;
          }
          if (status.duration > 0 && status.currentTime >= status.duration) {
            player.seekTo(0);
          }
          player.play();
        }}
      >
        <Ionicons
          name={status.playing ? 'pause' : 'play'}
          size={16}
          color={isAgent ? '#FFFFFF' : '#141414'}
        />
      </Pressable>
      <View style={styles.audioWaveformArea}>
        <GestureDetector gesture={seekGesture}>
          <View
            style={styles.audioWaveformRow}
            onLayout={(e) => {
              trackWidthRef.current = e.nativeEvent.layout.width;
            }}
          >
            {bars.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.audioWaveformBar,
                  { height: h, backgroundColor: i < playedBars ? tintColor : mutedColor },
                ]}
              />
            ))}
            <View
              style={[
                styles.audioProgressThumb,
                { left: `${progress * 100}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
        </GestureDetector>
        <View style={styles.audioTimeRow}>
          <Text style={[styles.audioDuration, { color: tintColor }]}>{formatAudioTime(current)}</Text>
          <Text style={[styles.audioDuration, { color: tintColor, opacity: 0.6 }]}>
            {formatAudioTime(duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function VideoThumbBubble({ uri, onPress }: { uri: string; onPress: () => void }) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
  });

  return (
    <Pressable onPress={onPress} style={styles.mediaVideoThumb}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
      />
      <View style={styles.adReferralPlayOverlay} pointerEvents="none">
        <Ionicons name="play-circle" size={40} color="#fff" />
      </View>
    </Pressable>
  );
}

export default function ConversaScreen() {
  const params = useLocalSearchParams<{ id: string; nome?: string; telefone?: string }>();
  const conversaId = Number(params.id);
  const { user } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors, scheme), [colors, scheme]);

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [dados, setDados] = useState<ConversaDados | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [finalizarVisible, setFinalizarVisible] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [transferLoadingUsers, setTransferLoadingUsers] = useState(false);
  const [transferDropdownOpen, setTransferDropdownOpen] = useState(false);
  const [transferSelecionadoId, setTransferSelecionadoId] = useState<number | null>(null);
  const [usuarios, setUsuarios] = useState<ManagedUser[]>([]);
  const [comandos, setComandos] = useState<MensagemRapida[]>([]);
  const [reagindoItem, setReagindoItem] = useState<Mensagem | null>(null);
  const [enviandoReacao, setEnviandoReacao] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  // Alvo da denúncia: { mensagemId } = uma mensagem; {} = o contato.
  const [denuncia, setDenuncia] = useState<{ mensagemId?: number } | null>(null);
  const [denunciando, setDenunciando] = useState(false);
  const [moderando, setModerando] = useState(false);
  const [bloqueadoLocal, setBloqueadoLocal] = useState<boolean | null>(null);
  const [apagadasLocal, setApagadasLocal] = useState<number[]>([]);
  const [templateSheetVisible, setTemplateSheetVisible] = useState(false);
  const [analiseVisible, setAnaliseVisible] = useState(false);
  const [attachMenuVisible, setAttachMenuVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [galleryModalVisible, setGalleryModalVisible] = useState(false);
  const [documentGalleryModalVisible, setDocumentGalleryModalVisible] = useState(false);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [imagemVisualizacao, setImagemVisualizacao] = useState<string | null>(null);
  const [videoVisualizacao, setVideoVisualizacao] = useState<string | null>(null);
  const [clienteInfo, setClienteInfo] = useState<{ nome: string; telefone: string } | null>(null);
  const [resolvendoCliente, setResolvendoCliente] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const earliestCursorRef = useRef<MensagemCursor | null>(null);
  const latestCursorRef = useRef<MensagemCursor | null>(null);
  const pollingRef = useRef(false);
  const mensagensRef = useRef<Mensagem[]>([]);
  const audioModeReadyRef = useRef(false);

  useEffect(() => {
    // iOS silencia playback por padrao se o switch fisico de silencioso estiver
    // ativo, a menos que a sessao de audio seja configurada com playsInSilentMode.
    // Sem isso, quem so escuta audio recebido (nunca grava) nao ouve nada no
    // iPhone -- o player toca normalmente (progresso avanca) mas sem som.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    // Tap de notificação só traz nome quando o título do push bate com
    // "Nova mensagem de {nome}" (ver extractNomeFromTitle em usePushNotifications.ts);
    // fallback do back sem cliente vinculado ou push da própria mensagem enviada
    // chegam sem esse título e caem aqui sem nome/telefone. /carregar_conversa não
    // devolve dado de cliente, então busca na lista de conversas do usuário.
    if (params.nome || !user) return;
    let cancelled = false;
    setResolvendoCliente(true);
    getConversas(user)
      .then((conversas) => {
        if (cancelled) return;
        const encontrada = conversas.find((c) => c.id === conversaId);
        if (encontrada) {
          setClienteInfo({ nome: encontrada.nome || 'Contato', telefone: encontrada.telefone || '' });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResolvendoCliente(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.nome, user, conversaId]);

  // Enquanto resolve o nome real (tap de notificação sem título "Nova mensagem de X"),
  // evita piscar "Contato" antes do nome de fato chegar.
  const nomeCliente = String(
    params.nome || clienteInfo?.nome || (resolvendoCliente ? '' : 'Contato')
  );
  const telefoneCliente = String(params.telefone || clienteInfo?.telefone || '');
  const statusId = dados?.status_id;
  const isActive = statusId === 1;
  const isWaiting = statusId === 0;
  const isFinished = statusId !== undefined && statusId !== 0 && statusId !== 1;

  const ultimaMensagemClienteEm = useMemo(() => {
    for (let i = mensagens.length - 1; i >= 0; i--) {
      if (mensagens[i].sender === 'me') return mensagens[i].timestamp;
    }
    return null;
  }, [mensagens]);

  const janelaExpiraEm = useMemo(() => {
    const data = parseTimestamp(ultimaMensagemClienteEm);
    return data ? new Date(data.getTime() + JANELA_META_MS) : null;
  }, [ultimaMensagemClienteEm]);

  const janelaFechada = !dados?.aguardando_resposta_template && !!janelaExpiraEm && Date.now() > janelaExpiraEm.getTime();

  const clienteParaTemplate = useMemo<Cliente | null>(
    () =>
      dados
        ? ({
            id: dados.cliente_id,
            name: nomeCliente,
            phone: telefoneCliente,
          } as Cliente)
        : null,
    [dados, nomeCliente, telefoneCliente]
  );

  const applyPage = useCallback((result: CarregarConversaResult, mode: 'initial' | 'before' | 'delta') => {
    setDados(result.dados);
    if (mode === 'initial') {
      setMensagens(result.mensagens);
      setHasMoreBefore(result.page.has_more_before);
      earliestCursorRef.current = result.page.earliest_cursor;
      latestCursorRef.current = result.page.latest_cursor;
      return;
    }
    if (mode === 'before') {
      setMensagens((prev) => mergeMensagens(prev, result.mensagens, 'start'));
      setHasMoreBefore(result.page.has_more_before);
      if (result.page.earliest_cursor) earliestCursorRef.current = result.page.earliest_cursor;
      return;
    }
    setMensagens((prev) => mergeMensagens(prev, result.mensagens, 'end'));
    if (result.page.latest_cursor) latestCursorRef.current = result.page.latest_cursor;
  }, []);

  useEffect(() => {
    mensagensRef.current = mensagens;
  }, [mensagens]);

  const loadInitial = useCallback(async () => {
    if (!user || !Number.isInteger(conversaId) || conversaId <= 0) return;
    setError('');
    try {
      const result = await carregarConversa(user, conversaId);
      applyPage(result, 'initial');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar a conversa.');
    }
  }, [user, conversaId, applyPage]);

  useEffect(() => {
    setLoading(true);
    loadInitial().finally(() => setLoading(false));
  }, [loadInitial]);

  // Polling de novas mensagens (delta)
  useEffect(() => {
    if (!user || loading || error) return;
    const timer = setInterval(async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const temStatusPendente = mensagensRef.current.some(
          (item) =>
            item.sender === 'other' &&
            (item.messageStatus === 'pending' ||
              item.messageStatus === 'sent' ||
              item.messageStatus === 'delivered')
        );
        const after = temStatusPendente ? undefined : latestCursorRef.current;
        const result = await carregarConversa(user, conversaId, after ? { after } : undefined);
        applyPage(result, 'delta');
      } catch {
        // Falha de polling não derruba a conversa carregada
      } finally {
        pollingRef.current = false;
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [user, conversaId, loading, error, applyPage]);

  async function handleLoadOlder() {
    if (!user || loadingOlder || !hasMoreBefore || !earliestCursorRef.current) return;
    setLoadingOlder(true);
    try {
      const result = await carregarConversa(user, conversaId, {
        before: earliestCursorRef.current,
      });
      applyPage(result, 'before');
    } catch {
      // Mantém as mensagens já carregadas
    } finally {
      setLoadingOlder(false);
    }
  }

  const refreshMensagens = useCallback(async () => {
    if (!user) return;
    const after = latestCursorRef.current;
    const result = await carregarConversa(user, conversaId, after ? { after } : undefined);
    applyPage(result, after ? 'delta' : 'initial');
  }, [user, conversaId, applyPage]);

  async function handleEnviar() {
    const mensagem = texto.trim();
    if (!user || !mensagem || enviando) return;
    setEnviando(true);
    try {
      await enviarMensagem(user, conversaId, mensagem);
      setTexto('');
      setComandos([]);
      await refreshMensagens();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  async function handleReagir(emoji: string) {
    if (!user || !reagindoItem || enviandoReacao) return;
    const alvo = reagindoItem;
    setEnviandoReacao(true);
    try {
      await reagirMensagem(user, conversaId, alvo.id, emoji);
      setReagindoItem(null);
      await refreshMensagens();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a reação.');
    } finally {
      setEnviandoReacao(false);
    }
  }

  async function handleSelectComando(comando: MensagemRapida) {
    setComandos([]);

    const temMidia = !!(comando.image_url || comando.document_url || comando.audio_url);
    if (!temMidia) {
      setTexto(comando.texto);
      return;
    }

    if (!user || enviandoAnexo) return;
    setTexto('');
    setEnviandoAnexo(true);
    try {
      const ordem = comando.media_order?.length ? comando.media_order : ['image', 'document', 'audio'];
      const texto = comando.texto || '';
      let textoEnviado = false;

      if (texto && !comando.use_text_as_image_caption) {
        await enviarMensagem(user, conversaId, texto);
        textoEnviado = true;
      }

      for (const tipo of ordem) {
        if (tipo === 'image' && comando.image_url) {
          const legenda = !textoEnviado && comando.use_text_as_image_caption ? texto : '';
          await enviarImagemUrl(user, conversaId, telefoneCliente, comando.image_url, legenda);
          if (legenda) textoEnviado = true;
        } else if (tipo === 'document' && comando.document_url) {
          await enviarDocumentoUrl(user, conversaId, telefoneCliente, comando.document_url, comando.document_name || undefined);
        } else if (tipo === 'audio' && comando.gallery_audio_id) {
          await enviarAudioGaleria(user, conversaId, telefoneCliente, comando.gallery_audio_id);
        }
      }

      if (texto && comando.use_text_as_image_caption && !textoEnviado) {
        await enviarMensagem(user, conversaId, texto);
      }

      await refreshMensagens();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a mensagem rápida.');
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function handlePickMedia() {
    if (!user || enviandoAnexo) return;
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (resultado.canceled || !resultado.assets?.length) return;
    const asset = resultado.assets[0];
    setEnviandoAnexo(true);
    try {
      await enviarMidia(user, conversaId, telefoneCliente, [
        {
          uri: asset.uri,
          name: asset.fileName || `midia_${Date.now()}.${asset.uri.split('.').pop() || 'jpg'}`,
          mimeType: asset.mimeType,
        },
      ]);
      await refreshMensagens();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar o arquivo.');
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function handlePickDocument() {
    if (!user || enviandoAnexo) return;
    const resultado = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (resultado.canceled || !resultado.assets?.length) return;
    const asset = resultado.assets[0];
    setEnviandoAnexo(true);
    try {
      await enviarMidia(user, conversaId, telefoneCliente, [
        { uri: asset.uri, name: asset.name, mimeType: asset.mimeType || undefined },
      ]);
      await refreshMensagens();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar o arquivo.');
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function handleShareLocation() {
    if (!user || enviandoAnexo) return;
    const permissao = await Location.requestForegroundPermissionsAsync();
    if (permissao.status !== 'granted') {
      Alert.alert('Permissão necessária', 'Autorize o acesso à localização para enviá-la.');
      return;
    }
    setEnviandoAnexo(true);
    try {
      const posicao = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await enviarLocalizacao(user, conversaId, telefoneCliente, {
        latitude: posicao.coords.latitude,
        longitude: posicao.coords.longitude,
      });
      await refreshMensagens();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a localização.');
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function handleSendContact(contato: { name: string; phone: string; email: string }) {
    if (!user) return;
    await enviarContato(user, conversaId, telefoneCliente, contato);
    await refreshMensagens();
  }

  async function handleSendProductImages(imageIds: number[], caption: string) {
    if (!user) return;
    await enviarImagensProdutoComercial(user, conversaId, telefoneCliente, imageIds, caption);
    await refreshMensagens();
  }

  async function handleSendGalleryImage(imageUrl: string, caption: string) {
    if (!user) return;
    await enviarImagemUrl(user, conversaId, telefoneCliente, imageUrl, caption);
    await refreshMensagens();
  }

  async function handleSendGalleryDocument(document: GalleryDocument, caption: string) {
    if (!user) return;
    await enviarDocumentoUrl(user, conversaId, telefoneCliente, document.url, document.nome_arquivo, caption);
    await refreshMensagens();
  }

  async function handleTirarFoto() {
    if (!user || enviandoAnexo) return;
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Autorize a câmera para tirar fotos.');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (resultado.canceled || !resultado.assets?.length) return;
    const asset = resultado.assets[0];
    setEnviandoAnexo(true);
    try {
      await enviarMidia(user, conversaId, telefoneCliente, [
        {
          uri: asset.uri,
          name: asset.fileName || `foto_${Date.now()}.jpg`,
          mimeType: asset.mimeType,
        },
      ]);
      await refreshMensagens();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a foto.');
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function handleToggleGravacao() {
    if (!user || enviandoAnexo) return;

    if (recorderState.isRecording) {
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri;
      } catch (err: any) {
        Alert.alert('Erro', err?.message || 'Não foi possível parar a gravação.');
        return;
      }
      if (!uri) return;
      setEnviandoAnexo(true);
      try {
        const nomeArquivo = `audio_${Date.now()}.m4a`;
        let arquivoUri = uri;
        if (Platform.OS === 'ios') {
          // iOS ignora o `type` do FormData pra uri `file://` local e usa o
          // MIME que o sistema associa a extensao do arquivo em disco
          // (audio/x-m4a), que a Meta rejeita. Uma uri `data:` e lida por um
          // handler nativo diferente (RCTDataRequestHandler), que usa o MIME
          // declarado na propria uri, contornando essa inferencia por extensao.
          const base64 = await new File(uri).base64();
          arquivoUri = `data:audio/mp4;base64,${base64}`;
        }
        const arquivo: MidiaArquivo = { uri: arquivoUri, name: nomeArquivo, mimeType: 'audio/mp4' };
        await enviarMidia(user, conversaId, telefoneCliente, [arquivo], '[audio]');
        await refreshMensagens();
      } catch (err: any) {
        Alert.alert('Erro', err?.message || 'Não foi possível enviar o áudio.');
      } finally {
        setEnviandoAnexo(false);
      }
      return;
    }

    if (!audioModeReadyRef.current) {
      const permissao = await requestRecordingPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('Permissão necessária', 'Autorize o microfone para gravar áudio.');
        return;
      }
      try {
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      } catch (err: any) {
        Alert.alert('Erro', err?.message || 'Não foi possível iniciar a gravação.');
        return;
      }
      audioModeReadyRef.current = true;
    }
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível iniciar a gravação.');
    }
  }

  // Mensagens rápidas via comando '/'
  useEffect(() => {
    if (!user || !texto.startsWith('/')) {
      setComandos([]);
      return;
    }
    const term = texto.slice(1).trim();
    const timer = setTimeout(() => {
      buscarMensagensRapidas(user, term)
        .then(setComandos)
        .catch(() => setComandos([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [texto, user]);

  const clienteId = dados?.cliente_id ?? null;
  const clienteBloqueado = bloqueadoLocal ?? dados?.cliente_bloqueado ?? false;

  async function handleDenunciar(motivo: MotivoDenuncia, descricao: string) {
    if (!user || !denuncia || clienteId === null || denunciando) return;
    setDenunciando(true);
    try {
      await denunciar(user, {
        conversaId,
        clienteId,
        mensagemId: denuncia.mensagemId,
        motivo,
        descricao,
      });
      setDenuncia(null);
      Alert.alert(
        'Denúncia enviada',
        'Recebemos sua denúncia e nossa equipe vai analisar em até 24 horas.'
      );
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível enviar a denúncia.');
    } finally {
      setDenunciando(false);
    }
  }

  function confirmarBloqueio() {
    if (!user || clienteId === null) return;
    setMenuVisible(false);
    Alert.alert(
      'Bloquear contato',
      `${nomeCliente} não poderá mais receber mensagens da sua empresa por aqui, e o atendimento em andamento será finalizado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            setModerando(true);
            try {
              await bloquearCliente(user, clienteId, conversaId);
              setBloqueadoLocal(true);
              await loadInitial();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível bloquear o contato.');
            } finally {
              setModerando(false);
            }
          },
        },
      ]
    );
  }

  async function handleDesbloquear() {
    if (!user || clienteId === null || moderando) return;
    setMenuVisible(false);
    setModerando(true);
    try {
      await desbloquearCliente(user, clienteId);
      setBloqueadoLocal(false);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível desbloquear o contato.');
    } finally {
      setModerando(false);
    }
  }

  function confirmarApagarMensagem(alvo: Mensagem) {
    if (!user) return;
    setReagindoItem(null);
    Alert.alert(
      'Apagar mensagem',
      'A mensagem some da plataforma para toda a sua empresa. O cliente continua vendo a versão que já recebeu no WhatsApp.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apagarMensagem(user, conversaId, alvo.id);
              setApagadasLocal((prev) => [...prev, alvo.id]);
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível apagar a mensagem.');
            }
          },
        },
      ]
    );
  }

  function abrirDenunciaDaMensagem(alvo: Mensagem) {
    setReagindoItem(null);
    setDenuncia({ mensagemId: alvo.id });
  }

  async function handleFinalizar() {
    if (!user || finalizando) return;
    setFinalizando(true);
    try {
      await finalizarAtendimento(user, conversaId);
      setFinalizarVisible(false);
      await loadInitial();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível finalizar o atendimento.');
    } finally {
      setFinalizando(false);
    }
  }

  async function handleIniciar() {
    if (!user || iniciando) return;
    setIniciando(true);
    try {
      await iniciarAtendimento(user, conversaId);
      await loadInitial();
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível iniciar o atendimento.');
    } finally {
      setIniciando(false);
    }
  }

  function openTransfer() {
    if (!user) return;
    setTransferVisible(true);
    setTransferDropdownOpen(false);
    setTransferSelecionadoId(null);
    setTransferLoadingUsers(true);
    getUsuarios(user)
      .then((lista) => {
        const disponiveis = lista.filter((item) => item.id !== user.id);
        setUsuarios(disponiveis);
        setTransferSelecionadoId(disponiveis[0]?.id ?? null);
      })
      .catch((err: any) => {
        setTransferVisible(false);
        Alert.alert('Erro', err?.message || 'Não foi possível carregar os atendentes.');
      })
      .finally(() => setTransferLoadingUsers(false));
  }

  async function handleTransferir() {
    if (!user || transferindo || transferSelecionadoId === null) return;
    setTransferindo(true);
    try {
      const message = await transferirAtendimento(user, conversaId, transferSelecionadoId);
      setTransferVisible(false);
      Alert.alert('Atendimento transferido', message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível transferir o atendimento.');
    } finally {
      setTransferindo(false);
    }
  }

  const transferSelecionado = usuarios.find((item) => item.id === transferSelecionadoId) || null;

  function mediaUrl(midiaId: string): string {
    return `${API_BASE}/atendimento/download/${dados?.empresa_id || user?.empresa_id}/${midiaId}?conversa_id=${conversaId}`;
  }

  const listData = useMemo(() => [...mensagens].reverse(), [mensagens]);

  function renderStatusTicks(item: Mensagem) {
    if (!item.messageStatus) return null;
    if (item.messageStatus === 'failed') {
      return <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />;
    }
    if (item.messageStatus === 'pending') {
      return <Ionicons name="time-outline" size={12} color="rgba(0,0,0,0.5)" />;
    }
    if (item.messageStatus === 'sent') {
      return <Ionicons name="checkmark" size={13} color="rgba(0,0,0,0.55)" />;
    }
    return (
      <Ionicons
        name="checkmark-done"
        size={13}
        color={item.messageStatus === 'read' ? colors.checkBlue : 'rgba(0,0,0,0.55)'}
      />
    );
  }

  function renderMedia(item: Mensagem, isAgent: boolean) {
    const mediaType = String(item.mediaType || '').toLowerCase();

    if (mediaType === 'location') {
      let coords: { latitude: number; longitude: number; name?: string; address?: string } | null = null;
      try {
        coords = item.midia_id ? JSON.parse(item.midia_id) : null;
      } catch {
        coords = null;
      }
      if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
        const tile = computeTileXY(coords.latitude, coords.longitude, 15);
        const tileUrl = `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;
        const externalUrl = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
        return (
          <Pressable onPress={() => Linking.openURL(externalUrl)} style={styles.locationCard}>
            <View style={styles.locationMapWrap}>
              <Image source={{ uri: tileUrl }} style={styles.locationMap} resizeMode="cover" />
              <View style={styles.locationPinOverlay} pointerEvents="none">
                <Ionicons name="location" size={30} color="#D64545" />
              </View>
            </View>
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={14} color={isAgent ? '#141414' : colors.textPrimary} />
              <Text
                style={[styles.locationText, { color: isAgent ? '#141414' : colors.textPrimary }]}
                numberOfLines={2}
              >
                {coords.address || coords.name || 'Localização compartilhada'}
              </Text>
            </View>
          </Pressable>
        );
      }
    }

    if (mediaType === 'meta_referral') {
      let ref: {
        source_url?: string | null;
        source_type?: string | null;
        source_id?: string | null;
        headline?: string | null;
        body?: string | null;
        media_type?: string | null;
        image_url?: string | null;
        video_url?: string | null;
      } | null = null;
      try {
        ref = item.midia_id ? JSON.parse(item.midia_id) : null;
      } catch {
        ref = null;
      }
      if (ref) {
        const cardColor = isAgent ? '#141414' : colors.textPrimary;
        const isVideo = (ref.media_type || '').toLowerCase().includes('video');
        const thumbUri = ref.image_url || null;
        return (
          <View style={styles.adReferralCard}>
            {!!thumbUri && isVideo && (
              <Pressable
                onPress={() => Linking.openURL(ref!.video_url || ref!.source_url || thumbUri!)}
              >
                <Image source={{ uri: thumbUri }} style={styles.adReferralImage} resizeMode="cover" />
                <View style={styles.adReferralPlayOverlay} pointerEvents="none">
                  <Ionicons name="play-circle" size={40} color="#fff" />
                </View>
              </Pressable>
            )}
            {!!thumbUri && !isVideo && (
              <Pressable onPress={() => setImagemVisualizacao(thumbUri)}>
                <Image source={{ uri: thumbUri }} style={styles.adReferralImage} resizeMode="cover" />
              </Pressable>
            )}
            {!!ref.headline && (
              <Text style={[styles.adReferralHeadline, { color: cardColor }]}>{ref.headline}</Text>
            )}
            {!!ref.body && (
              <Text style={[styles.adReferralBody, { color: cardColor }]}>{ref.body}</Text>
            )}
            {(!!ref.source_type || !!ref.media_type) && (
              <View style={styles.adReferralFooter}>
                {!!ref.source_type && (
                  <Text style={[styles.adReferralMeta, { color: cardColor }]}>Origem: {ref.source_type}</Text>
                )}
                {!!ref.media_type && (
                  <Text style={[styles.adReferralMeta, { color: cardColor }]}>Mídia: {ref.media_type}</Text>
                )}
              </View>
            )}
            {!!ref.source_id && (
              <Text style={[styles.adReferralMeta, styles.adReferralSourceId, { color: cardColor }]}>
                Source ID: {ref.source_id}
              </Text>
            )}
            {!!ref.source_url && (
              <Pressable style={styles.adReferralLink} onPress={() => Linking.openURL(ref!.source_url!)}>
                <Ionicons name="open-outline" size={13} color={colors.accent} />
                <Text style={styles.adReferralLinkText}>Abrir origem do anúncio</Text>
              </Pressable>
            )}
          </View>
        );
      }
    }

    if (mediaType === 'location' || mediaType === 'contacts') {
      return (
        <View style={styles.mediaFile}>
          <Ionicons
            name={mediaType === 'location' ? 'location-outline' : 'person-outline'}
            size={16}
            color={isAgent ? '#141414' : colors.textPrimary}
          />
          <Text
            style={[styles.mediaFileText, { color: isAgent ? '#141414' : colors.textPrimary }]}
            numberOfLines={3}
          >
            {item.mensagem || (mediaType === 'location' ? 'Localização' : 'Contato')}
          </Text>
        </View>
      );
    }

    // Mensagens enviadas via link direto (enviar_imagem_url/enviar_documento_url, sem
    // upload real na Meta) salvam a propria URL externa no lugar do media_id da Meta.
    // Nesse caso usa a URL como esta, em vez do proxy /atendimento/download que so
    // sabe resolver media_id de verdade.
    const isExternalMedia = !!item.midia_id && /^https?:\/\//i.test(item.midia_id);
    const url = item.midia_id
      ? isExternalMedia
        ? item.midia_id
        : mediaUrl(item.midia_id)
      : null;
    if (url && mediaType.startsWith('image')) {
      return (
        <Pressable onPress={() => setImagemVisualizacao(url)}>
          <Image source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />
        </Pressable>
      );
    }
    // Áudios gravados no app antes do fix de MIME no iOS foram salvos com mediaType
    // "video" (Content-Type sniffado errado a partir da extensão .mp4). Esses arquivos
    // continuam sendo áudio de fato — detecta pelo nome (audio_<timestamp>.*) e ainda
    // toca no player em vez de cair no Linking.openURL genérico de arquivo.
    const isMisclassifiedRecordedAudio =
      mediaType.startsWith('video') && /^audio_\d+\./.test(item.fileName || '');
    if (url && (mediaType.startsWith('audio') || isMisclassifiedRecordedAudio)) {
      // Áudio externo (.ogg/Opus do CDN) não toca no iOS (AVPlayer); passa pelo transcode
      // do back. Áudio interno já vem do /download, que aceita &format=mp3.
      const audioUri = isExternalMedia
        ? `${API_BASE}/atendimento/download_external/${dados?.empresa_id || user?.empresa_id}?url=${encodeURIComponent(url)}&format=mp3&conversa_id=${conversaId}`
        : `${url}&format=mp3`;
      return <AudioBubble uri={audioUri} isAgent={isAgent} />;
    }
    if (url && mediaType.startsWith('video')) {
      return <VideoThumbBubble uri={url} onPress={() => setVideoVisualizacao(url)} />;
    }
    return (
      <Pressable
        style={styles.mediaFile}
        onPress={() => url && Linking.openURL(url)}
        disabled={!url}
      >
        <Ionicons name="document-outline" size={16} color={isAgent ? '#141414' : colors.textPrimary} />
        <Text
          style={[styles.mediaFileText, { color: isAgent ? '#141414' : colors.textPrimary }]}
          numberOfLines={1}
        >
          {item.fileName || 'Arquivo'}
        </Text>
      </Pressable>
    );
  }

  function renderMensagem({ item }: { item: Mensagem }) {
    if (item.type === 'event' || item.sender === 'system') {
      return (
        <View style={styles.eventWrap}>
          <Text style={styles.eventText}>{item.mensagem}</Text>
        </View>
      );
    }

    const isAgent = item.sender === 'other';
    const textColor = isAgent ? '#224336' : colors.textPrimary;

    if (item.apagada || apagadasLocal.includes(item.id)) {
      return (
        <View style={[styles.bubbleWrap, isAgent ? styles.bubbleWrapAgent : styles.bubbleWrapClient]}>
          <View style={[styles.bubble, isAgent ? styles.bubbleAgent : styles.bubbleClient]}>
            <Text style={[styles.bubbleText, { color: textColor, fontStyle: 'italic', opacity: 0.7 }]}>
              Mensagem apagada
            </Text>
          </View>
        </View>
      );
    }

    const isVisualMedia = isVisualMediaMensagem(item);

    return (
      <View style={[styles.bubbleWrap, isAgent ? styles.bubbleWrapAgent : styles.bubbleWrapClient]}>
        <Pressable
          onLongPress={() => setReagindoItem(item)}
          delayLongPress={350}
          style={[
            styles.bubble,
            isAgent ? styles.bubbleAgent : styles.bubbleClient,
            isVisualMedia && styles.bubbleMediaTight,
          ]}
        >
          {!!item.templateData && (
            <View style={styles.templateChip}>
              <Text style={styles.templateChipText}>TEMPLATE</Text>
            </View>
          )}
          {isAgent && !!item.user_bubble && (
            <Text style={styles.bubbleAuthor}>{item.user_bubble.toUpperCase()}</Text>
          )}
          {item.reply && !!item.replyText && (
            <View style={[styles.replyBox, isAgent ? styles.replyBoxAgent : styles.replyBoxClient]}>
              <Text style={[styles.replyLabel, { color: textColor }]}>EM RESPOSTA A</Text>
              <Text style={[styles.replyText, { color: textColor }]} numberOfLines={2}>
                {item.replyText}
              </Text>
            </View>
          )}
          {item.type === 'media' && renderMedia(item, isAgent)}
          {!!item.mensagem && item.type !== 'media' && (
            <Text selectable style={[styles.bubbleText, { color: textColor }]}>{item.mensagem}</Text>
          )}
          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, { color: isAgent ? 'rgba(0,0,0,0.55)' : colors.muted }]}>
              {formatMessageTime(item.timestamp)}
            </Text>
            {isAgent && renderStatusTicks(item)}
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="translate-with-padding"
      >
        {/* Header fixo */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{getInitials(nomeCliente)}</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              {isActive && <View style={styles.statusDot} />}
              <Text style={styles.headerName} numberOfLines={1}>
                {nomeCliente}
              </Text>
            </View>
            {!!telefoneCliente && (
              <Text style={styles.headerPhone} numberOfLines={1}>
                {telefoneCliente}
              </Text>
            )}
          </View>
          {isActive && (
            <>
              <Pressable style={styles.headerAction} onPress={openTransfer} hitSlop={6}>
                <Ionicons name="swap-horizontal" size={20} color={colors.textPrimary} />
              </Pressable>
              <Pressable
                style={styles.headerAction}
                onPress={() => setFinalizarVisible(true)}
                hitSlop={6}
              >
                <Ionicons name="checkbox-outline" size={20} color={colors.textPrimary} />
              </Pressable>
            </>
          )}
          <Pressable style={styles.headerAction} onPress={() => setInfoVisible(true)} hitSlop={6}>
            <Ionicons name="information-circle-outline" size={21} color={colors.textPrimary} />
          </Pressable>
          <Pressable style={styles.headerAction} onPress={() => setMenuVisible(true)} hitSlop={6}>
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Lista de mensagens (única área com scroll) */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.muted} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorTitle}>Erro</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                setLoading(true);
                loadInitial().finally(() => setLoading(false));
              }}
            >
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={listData}
            inverted
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMensagem}
            contentContainerStyle={styles.listContent}
            onEndReached={handleLoadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingOlder ? (
                <View style={styles.olderLoading}>
                  <ActivityIndicator size="small" color={colors.muted} />
                </View>
              ) : null
            }
          />
        )}

        {/* Popup de mensagens rápidas */}
        {comandos.length > 0 && isActive && (
          <View style={styles.commandsPopup}>
            <ScrollView style={styles.commandsScroll} keyboardShouldPersistTaps="handled">
              {comandos.map((comando) => (
                <Pressable
                  key={comando.id}
                  style={styles.commandItem}
                  onPress={() => handleSelectComando(comando)}
                >
                  <View style={styles.commandNameRow}>
                    <Text style={styles.commandName}>/{comando.nome}</Text>
                    {!!comando.image_url && <Ionicons name="image-outline" size={13} color={colors.accent} />}
                    {!!comando.document_url && <Ionicons name="document-text-outline" size={13} color={colors.accent} />}
                  </View>
                  <Text style={styles.commandText} numberOfLines={1}>
                    {comando.descricao || comando.texto}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Rodapé fixo */}
        {!loading && !error && (
          clienteBloqueado ? (
            <View style={styles.readonlyFooterColumn}>
              <Text style={styles.readonlyText}>
                Contato bloqueado. Você não pode enviar mensagens para ele.
              </Text>
              <Pressable style={styles.iniciarButton} onPress={handleDesbloquear} disabled={moderando}>
                {moderando ? (
                  <ActivityIndicator size="small" color="#141414" />
                ) : (
                  <Text style={styles.iniciarButtonText}>Desbloquear</Text>
                )}
              </Pressable>
            </View>
          ) : isActive ? (
            dados?.aguardando_resposta_template ? (
              <View style={styles.readonlyFooter}>
                <Ionicons name="hourglass-outline" size={15} color={colors.muted} />
                <Text style={styles.readonlyText}>
                  Aguardando o cliente responder ao template para liberar o envio.
                </Text>
              </View>
            ) : janelaFechada ? (
              <View style={styles.janelaFechadaCard}>
                <Text style={styles.janelaFechadaTitle}>
                  Envio bloqueado pela janela de 24h da Meta
                </Text>
                <Text style={styles.janelaFechadaText}>
                  A janela de 24h da Meta expirou. Reative a conversa com um template antes de
                  enviar novas mensagens.
                </Text>
                {!!janelaExpiraEm && (
                  <Text style={styles.janelaFechadaHint}>
                    Janela encerrada em {formatMessageTime(janelaExpiraEm.toISOString())}.
                  </Text>
                )}
                <Pressable
                  style={styles.janelaFechadaButton}
                  onPress={() => setTemplateSheetVisible(true)}
                >
                  <Text style={styles.janelaFechadaButtonText}>Enviar template</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.inputArea}>
                <Pressable
                  style={styles.attachButton}
                  onPress={() => setAttachMenuVisible(true)}
                  disabled={enviandoAnexo}
                  hitSlop={6}
                >
                  {enviandoAnexo ? (
                    <ActivityIndicator size="small" color={colors.muted} />
                  ) : (
                    <Ionicons name="add" size={22} color={colors.textPrimary} />
                  )}
                </Pressable>
                {recorderState.isRecording ? (
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>
                      Gravando áudio… {formatAudioTime((recorderState.durationMillis || 0) / 1000)}
                    </Text>
                  </View>
                ) : (
                  <TextInput
                    style={styles.input}
                    value={texto}
                    onChangeText={setTexto}
                    placeholder="Mensagem, / para comandos"
                    placeholderTextColor={colors.muted}
                    multiline
                    editable={!enviando}
                  />
                )}
                {!recorderState.isRecording && (
                  <Pressable
                    style={styles.attachButton}
                    onPress={handleTirarFoto}
                    disabled={enviandoAnexo}
                    hitSlop={6}
                  >
                    <Ionicons name="camera-outline" size={21} color={colors.textPrimary} />
                  </Pressable>
                )}
                {texto.trim() ? (
                  <Pressable
                    style={[styles.sendButton, enviando && styles.sendButtonDisabled]}
                    onPress={handleEnviar}
                    disabled={enviando}
                  >
                    {enviando ? (
                      <ActivityIndicator size="small" color="#141414" />
                    ) : (
                      <Ionicons name="send" size={18} color="#141414" />
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.sendButton, recorderState.isRecording && styles.recordButtonActive]}
                    onPress={handleToggleGravacao}
                    disabled={enviandoAnexo}
                  >
                    {enviandoAnexo ? (
                      <ActivityIndicator size="small" color="#141414" />
                    ) : (
                      <Ionicons
                        name={recorderState.isRecording ? 'stop' : 'mic'}
                        size={18}
                        color={recorderState.isRecording ? '#FFFFFF' : '#141414'}
                      />
                    )}
                  </Pressable>
                )}
              </View>
            )
          ) : isWaiting ? (
            <View style={styles.readonlyFooterColumn}>
              <Text style={styles.readonlyText}>Este atendimento está aguardando na fila.</Text>
              <Pressable style={styles.iniciarButton} onPress={handleIniciar} disabled={iniciando}>
                {iniciando ? (
                  <ActivityIndicator size="small" color="#141414" />
                ) : (
                  <Text style={styles.iniciarButtonText}>Iniciar atendimento</Text>
                )}
              </Pressable>
            </View>
          ) : isFinished ? (
            <View style={styles.finalizadoFooter}>
              <Text style={styles.finalizadoTitle}>Atendimento finalizado</Text>
              <Text style={styles.finalizadoSubtitle}>
                O histórico permanece disponível para consulta e revisão.
              </Text>
              <Pressable
                style={styles.finalizadoButton}
                onPress={() => setTemplateSheetVisible(true)}
              >
                <Text style={styles.finalizadoButtonText}>Enviar template</Text>
              </Pressable>
              <Pressable
                style={styles.finalizadoButton}
                onPress={() => setAnaliseVisible(true)}
              >
                <Ionicons name="sparkles-outline" size={15} color={colors.textPrimary} />
                <Text style={styles.finalizadoButtonText}>Analisar atendimento com IA</Text>
              </Pressable>
            </View>
          ) : null
        )}
      </KeyboardAvoidingView>

      {/* Modal finalizar */}
      <Modal
        visible={finalizarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFinalizarVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Finalizar atendimento</Text>
              <Pressable onPress={() => setFinalizarVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
            <Text style={styles.modalText}>Confirme se deseja finalizar este atendimento.</Text>
            <Text style={styles.modalNote}>
              * A conversa sairá da fila ativa e irá para os atendimentos finalizados.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setFinalizarVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={handleFinalizar} disabled={finalizando}>
                {finalizando ? (
                  <ActivityIndicator size="small" color="#141414" />
                ) : (
                  <Text style={styles.modalConfirmText}>Finalizar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal reação de mensagem */}
      <Modal
        visible={!!reagindoItem}
        transparent
        animationType="fade"
        onRequestClose={() => setReagindoItem(null)}
      >
        <Pressable style={styles.reactionOverlay} onPress={() => setReagindoItem(null)}>
          <View style={styles.reactionBar} onStartShouldSetResponder={() => true}>
            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
              <Pressable
                key={emoji}
                style={styles.reactionEmojiButton}
                disabled={enviandoReacao}
                onPress={() => handleReagir(emoji)}
              >
                <Text style={styles.reactionEmojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          {reagindoItem && (
            <View style={styles.messageActions} onStartShouldSetResponder={() => true}>
              <Pressable
                style={styles.messageActionItem}
                onPress={() => abrirDenunciaDaMensagem(reagindoItem)}
              >
                <Ionicons name="flag-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.messageActionText}>Denunciar mensagem</Text>
              </Pressable>
              <Pressable
                style={styles.messageActionItem}
                onPress={() => confirmarApagarMensagem(reagindoItem)}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={[styles.messageActionText, { color: '#ef4444' }]}>Apagar mensagem</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Modal>

      {/* Menu da conversa */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.reactionOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.messageActions} onStartShouldSetResponder={() => true}>
            <Pressable
              style={styles.messageActionItem}
              onPress={() => {
                setMenuVisible(false);
                setDenuncia({});
              }}
            >
              <Ionicons name="flag-outline" size={18} color={colors.textPrimary} />
              <Text style={styles.messageActionText}>Denunciar contato</Text>
            </Pressable>
            <Pressable
              style={styles.messageActionItem}
              onPress={clienteBloqueado ? handleDesbloquear : confirmarBloqueio}
            >
              <Ionicons
                name={clienteBloqueado ? 'checkmark-circle-outline' : 'ban-outline'}
                size={18}
                color={clienteBloqueado ? colors.textPrimary : '#ef4444'}
              />
              <Text
                style={[
                  styles.messageActionText,
                  !clienteBloqueado && { color: '#ef4444' },
                ]}
              >
                {clienteBloqueado ? 'Desbloquear contato' : 'Bloquear contato'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <ReportSheet
        visible={!!denuncia}
        title={denuncia?.mensagemId ? 'Denunciar mensagem' : 'Denunciar contato'}
        submitting={denunciando}
        onClose={() => setDenuncia(null)}
        onSubmit={handleDenunciar}
      />

      {/* Modal trocar atendente */}
      <Modal
        visible={transferVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTransferVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trocar atendente</Text>
              <Pressable onPress={() => setTransferVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>
            <Text style={styles.modalText}>
              Escolha o novo atendente responsável por este chat ativo.
            </Text>
            <Text style={styles.modalNote}>
              * A conversa continuará em andamento e passará a aparecer para o novo usuário.
            </Text>
            {transferLoadingUsers ? (
              <View style={styles.transferLoading}>
                <ActivityIndicator color={colors.muted} />
              </View>
            ) : usuarios.length === 0 ? (
              <Text style={styles.modalText}>Nenhum outro atendente disponível.</Text>
            ) : (
              <>
                <Text style={styles.transferLabel}>Novo atendente</Text>
                <Pressable
                  style={styles.transferSelect}
                  onPress={() => setTransferDropdownOpen((prev) => !prev)}
                  disabled={transferindo}
                >
                  <Text
                    style={transferSelecionado ? styles.transferSelectText : styles.transferSelectPlaceholder}
                    numberOfLines={1}
                  >
                    {transferSelecionado ? transferSelecionado.name : 'Selecione um atendente'}
                  </Text>
                  <Ionicons
                    name={transferDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.muted}
                  />
                </Pressable>
                {transferDropdownOpen && (
                  <View style={styles.transferDropdown}>
                    <ScrollView style={styles.transferDropdownScroll} nestedScrollEnabled>
                      {usuarios.map((item) => (
                        <Pressable
                          key={item.id}
                          style={styles.transferDropdownItem}
                          onPress={() => {
                            setTransferSelecionadoId(item.id);
                            setTransferDropdownOpen(false);
                          }}
                        >
                          <View style={styles.transferDropdownItemRow}>
                            <View
                              style={[styles.atendenteDot, { backgroundColor: getAtendenteColor(item.id) }]}
                            />
                            <Text style={styles.transferDropdownItemText} numberOfLines={1}>
                              {item.name}
                            </Text>
                          </View>
                          {item.is_master && <Text style={styles.transferTag}>Admin</Text>}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setTransferVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalConfirm,
                  (transferSelecionadoId === null || transferindo) && styles.modalConfirmDisabled,
                ]}
                onPress={handleTransferir}
                disabled={transferSelecionadoId === null || transferindo}
              >
                {transferindo ? (
                  <ActivityIndicator size="small" color="#141414" />
                ) : (
                  <Text style={styles.modalConfirmText}>Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sheet de detalhes do cliente */}
      {user && (
        <DetalhesClienteSheet
          visible={infoVisible}
          authUser={user}
          clienteId={dados?.cliente_id ?? null}
          conversaId={conversaId}
          nomeCliente={nomeCliente}
          onClose={() => setInfoVisible(false)}
        />
      )}

      {user && (
        <SendTemplateSheet
          visible={templateSheetVisible}
          authUser={user}
          cliente={clienteParaTemplate}
          onClose={() => setTemplateSheetVisible(false)}
        />
      )}

      {user && (
        <AnaliseIASheet
          visible={analiseVisible}
          authUser={user}
          conversa={{ id: conversaId, nome: nomeCliente }}
          onClose={() => setAnaliseVisible(false)}
        />
      )}

      <AttachMenuSheet
        visible={attachMenuVisible}
        onClose={() => setAttachMenuVisible(false)}
        onPickMedia={handlePickMedia}
        onPickDocument={handlePickDocument}
        onShareLocation={handleShareLocation}
        onSendContact={() => setContactModalVisible(true)}
        onOpenGallery={() => setGalleryModalVisible(true)}
        onOpenDocumentGallery={() => setDocumentGalleryModalVisible(true)}
      />

      <SendContactModal
        visible={contactModalVisible}
        onClose={() => setContactModalVisible(false)}
        onSend={handleSendContact}
      />

      {user && (
        <SendGalleryModal
          visible={galleryModalVisible}
          authUser={user}
          onClose={() => setGalleryModalVisible(false)}
          onSendProductImages={handleSendProductImages}
          onSendGalleryImage={handleSendGalleryImage}
        />
      )}

      {user && (
        <SendDocumentGalleryModal
          visible={documentGalleryModalVisible}
          authUser={user}
          onClose={() => setDocumentGalleryModalVisible(false)}
          onSend={handleSendGalleryDocument}
        />
      )}

      <ImageViewerModal uri={imagemVisualizacao} onClose={() => setImagemVisualizacao(null)} />
      <VideoViewerModal uri={videoVisualizacao} onClose={() => setVideoVisualizacao(null)} />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors, scheme: 'light' | 'dark') =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    errorSubtitle: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    retryText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBack: {
      padding: 4,
    },
    headerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerAvatarText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#141414',
    },
    headerInfo: {
      flex: 1,
      minWidth: 0,
    },
    headerNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#22C55E',
    },
    headerName: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerPhone: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 1,
    },
    headerAction: {
      padding: 6,
    },
    listContent: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    olderLoading: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    eventWrap: {
      alignSelf: 'center',
      maxWidth: '90%',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: 2,
    },
    eventText: {
      fontSize: 11,
      color: colors.muted,
      textAlign: 'center',
    },
    bubbleWrap: {
      flexDirection: 'row',
    },
    bubbleWrapClient: {
      justifyContent: 'flex-start',
    },
    bubbleWrapAgent: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '86%',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 4,
    },
    bubbleMediaTight: {
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    bubbleClient: {
      backgroundColor: colors.elevated,
      borderTopLeftRadius: 4,
    },
    bubbleAgent: {
      backgroundColor: '#E3E898',
      borderTopRightRadius: 4,
    },
    bubbleAuthor: {
      fontSize: 10,
      fontWeight: '700',
      fontStyle: 'italic',
      color: 'rgba(0,0,0,0.6)',
    },
    templateChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: 'rgba(21,21,21,0.9)',
    },
    templateChipText: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: '#7EA0FF',
    },
    replyBox: {
      borderLeftWidth: 3,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 2,
    },
    replyBoxClient: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderLeftColor: colors.accent,
    },
    replyBoxAgent: {
      backgroundColor: 'rgba(0,0,0,0.1)',
      borderLeftColor: 'rgba(0,0,0,0.4)',
    },
    replyLabel: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
      opacity: 0.8,
    },
    replyText: {
      fontSize: 12,
      opacity: 0.9,
    },
    bubbleText: {
      fontSize: 14,
      lineHeight: 20,
    },
    bubbleFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
    },
    bubbleTime: {
      fontSize: 10,
    },
    mediaImage: {
      width: 220,
      height: 220,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.2)',
    },
    mediaVideoThumb: {
      width: 220,
      height: 220,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    mediaFile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    mediaFileText: {
      flexShrink: 1,
      fontSize: 13,
      textDecorationLine: 'underline',
    },
    locationCard: {
      width: 240,
      borderRadius: 10,
      overflow: 'hidden',
    },
    adReferralCard: {
      width: 240,
      borderRadius: 10,
      overflow: 'hidden',
    },
    adReferralImage: {
      width: '100%',
      height: 160,
      borderRadius: 8,
      backgroundColor: colors.border,
    },
    adReferralPlayOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adReferralHeadline: {
      fontSize: 13,
      fontWeight: '700',
      marginTop: 8,
    },
    adReferralBody: {
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
      opacity: 0.9,
    },
    adReferralFooter: {
      marginTop: 8,
      gap: 2,
    },
    adReferralMeta: {
      fontSize: 11,
      opacity: 0.6,
    },
    adReferralSourceId: {
      marginTop: 4,
    },
    adReferralLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
    },
    adReferralLinkText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },
    locationMapWrap: {
      width: '100%',
      height: 130,
      backgroundColor: colors.border,
    },
    locationMap: {
      width: '100%',
      height: '100%',
    },
    locationPinOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
    },
    locationText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
    },
    audioBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      width: 220,
      paddingVertical: 4,
    },
    audioPlayButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audioWaveformArea: {
      flex: 1,
    },
    audioWaveformRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 22,
      position: 'relative' as const,
      gap: 2,
      // Encolhe pra largura real das barras: a bolinha e o gesto de seek usam % dessa
      // largura, então precisa coincidir com o trecho que as barras ocupam de fato.
      alignSelf: 'flex-start' as const,
    },
    audioWaveformBar: {
      width: 2.5,
      borderRadius: 1.5,
    },
    audioProgressThumb: {
      position: 'absolute' as const,
      width: 11,
      height: 11,
      borderRadius: 5.5,
      marginLeft: -5.5,
      top: '50%',
      marginTop: -5.5,
    },
    audioTimeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    audioDuration: {
      fontSize: 11,
      fontWeight: '600',
    },
    commandsPopup: {
      marginHorizontal: 14,
      marginBottom: 6,
      borderRadius: 12,
      padding: 0,
      overflow: 'hidden',
      ...cardSurface(colors, scheme),
    },
    commandsScroll: {
      maxHeight: 180,
    },
    commandItem: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 2,
    },
    commandNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    commandName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.accent,
    },
    commandText: {
      fontSize: 12,
      color: colors.muted,
    },
    inputArea: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    attachButton: {
      width: 40,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.textPrimary,
      fontSize: 14,
    },
    recordingIndicator: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: '#D64545',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#D64545',
    },
    recordingText: {
      color: '#D64545',
      fontSize: 14,
      fontWeight: '600' as const,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    recordButtonActive: {
      backgroundColor: '#D64545',
    },
    readonlyFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    janelaFechadaCard: {
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: '#FBEBEE',
    },
    janelaFechadaTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#6B1220',
    },
    janelaFechadaText: {
      fontSize: 13,
      color: '#7A2A38',
      lineHeight: 18,
    },
    janelaFechadaHint: {
      fontSize: 11,
      color: '#9B5560',
    },
    janelaFechadaButton: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 16,
      height: 38,
      borderRadius: 10,
      backgroundColor: '#7A1B2E',
      alignItems: 'center',
      justifyContent: 'center',
    },
    janelaFechadaButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    finalizadoFooter: {
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    finalizadoTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    finalizadoSubtitle: {
      fontSize: 12,
      color: colors.muted,
      marginBottom: 2,
    },
    finalizadoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    finalizadoButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    readonlyFooterColumn: {
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    readonlyText: {
      flexShrink: 1,
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
    },
    iniciarButton: {
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iniciarButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    modalOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: colors.overlay,
    },
    reactionOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      backgroundColor: colors.overlay,
    },
    reactionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      ...cardSurface(colors, scheme),
      borderRadius: 32,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 4,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    messageActions: {
      marginTop: 12,
      minWidth: 240,
      borderRadius: 16,
      paddingVertical: 6,
      ...cardSurface(colors, scheme),
    },
    messageActionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      height: 48,
    },
    messageActionText: {
      fontSize: 15,
      color: colors.textPrimary,
    },
    reactionEmojiButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionEmojiText: {
      fontSize: 24,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 18,
      padding: 18,
      gap: 12,
      ...cardSurface(colors, scheme),
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalText: {
      fontSize: 14,
      color: colors.muted,
      lineHeight: 20,
    },
    modalNote: {
      fontSize: 12,
      fontStyle: 'italic',
      color: colors.muted,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    modalCancel: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    modalConfirm: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalConfirmText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#141414',
    },
    transferLoading: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    transferLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
    transferSelect: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      height: 44,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    transferSelectText: {
      flexShrink: 1,
      fontSize: 14,
      color: colors.textPrimary,
    },
    transferSelectPlaceholder: {
      flexShrink: 1,
      fontSize: 14,
      color: colors.muted,
    },
    transferDropdown: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    transferDropdownScroll: {
      maxHeight: 180,
    },
    transferDropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    transferDropdownItemText: {
      flexShrink: 1,
      fontSize: 13,
      color: colors.textPrimary,
    },
    transferDropdownItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },
    atendenteDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    transferTag: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.accent,
    },
    modalConfirmDisabled: {
      opacity: 0.6,
    },
  });
