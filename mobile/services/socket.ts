import { io, type Socket } from 'socket.io-client';

import { API_BASE, getSessionToken } from './apiClient';

// Mesmo host da API. O back monta o socket.io no path padrão (/socket.io) e
// exige o token de sessão em `auth.token` no handshake (sem ele: connect_error
// "Sessao invalida ou expirada."). A sala da empresa vem do token; o
// `empresa_id` do join_empresa é ignorado pelo back.
// Ver back/src/server/realtime.js (configureRealtime).
let socket: Socket | null = null;
let joinedEmpresaId: number | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      // Função: relida a cada (re)conexão, pega o token renovado após relogin.
      auth: (cb) => cb({ token: getSessionToken() ?? '' }),
    });
    // Reentra na sala após qualquer reconexão — o back não guarda estado de
    // sala por socket, então cada nova conexão precisa refazer o join.
    socket.on('connect', () => {
      console.log('[socket] connect id=', socket?.id, 'joinedEmpresaId=', joinedEmpresaId);
      if (joinedEmpresaId != null) {
        socket?.emit('join_empresa', { empresa_id: joinedEmpresaId });
        console.log('[socket] join_empresa emitido', joinedEmpresaId);
      }
    });
    socket.on('connect_error', (error) => {
      console.log('[socket] connect_error', error?.message, error);
    });
    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnect', reason);
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function joinEmpresa(empresaId: number): void {
  if (!empresaId) return;
  joinedEmpresaId = empresaId;
  const s = connectSocket();
  if (s.connected) s.emit('join_empresa', { empresa_id: empresaId });
  // Se ainda não conectou, o handler de `connect` faz o join.
}

export function leaveEmpresa(): void {
  if (socket && socket.connected && joinedEmpresaId != null) {
    socket.emit('leave_empresa', { empresa_id: joinedEmpresaId });
  }
  joinedEmpresaId = null;
}

export function disconnectSocket(): void {
  leaveEmpresa();
  socket?.disconnect();
}
