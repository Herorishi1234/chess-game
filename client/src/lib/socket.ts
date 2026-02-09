import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export const getSocket = (token: string): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: {
        token
      },
      autoConnect: false
    });
  } else {  // change the token for the existing socket if it already exists to the latest token. This is important because the token might have changed (e.g., user logged in or out) and we want to ensure the socket uses the correct token for authentication when it connects or reconnects.
    
    // THE FIX: If the socket already exists, 
    // we manually update the token in case it changed.
    socket.auth = { token };
  }
  return socket;
};

export const connectSocket = (token: string): Socket => {
  const sock = getSocket(token);
  if (!sock.connected) {
    sock.connect();
  }
  return sock;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
  socket = null;
};