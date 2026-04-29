import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
    });
    return socket;
  }

  socket.auth = { token };

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket(): void {
  if (!socket) {
    return;
  }
  socket.disconnect();
  socket = null;
}
