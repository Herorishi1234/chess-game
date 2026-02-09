'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import ChessBoard from '@/components/ChessBoard';
import api from '@/lib/api';
import { Socket } from 'socket.io-client';
import { Game as GameType } from '@/types';

export default function GamePage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [game, setGame] = useState<GameType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');

  useEffect(() => {
    if (authLoading) return;

    if (!user || !token) {
      router.push('/login');
      return;
    }

    // Fetch game details
    const fetchGame = async () => {
      try {
        const response = await api.get(`/games/${gameId}`);
        const gameData = response.data.game;
        setGame(gameData);

        // Determine player color
        if (gameData.whitePlayer === user.id) {
          setPlayerColor('white');
        } else if (gameData.blackPlayer === user.id) {
          setPlayerColor('black');
        } else if (gameData.mode === 'bot') {
          setPlayerColor('white');
        } else {
          setPlayerColor('black');
        }

        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch game:', err);
        setError('Game not found');
        setLoading(false);
      }
    };

    fetchGame();

    // Setup socket connection
    const sock = connectSocket(token);
    setSocket(sock);

    sock.on('connect', () => {
      console.log('Socket connected');
      sock.emit('joinGame', gameId);
    });

    sock.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Failed to connect to game server');
    });

    sock.on('gameState', (gameState: GameType) => {
      setGame(gameState);
      setLoading(false);
    });

    sock.on('moveMade', (data: { game: GameType }) => {
      console.log('GamePage received moveMade:', data);
      // The server sends { game, move, fen, ... } but we need to check the structure
      // Based on typical implementation, it might send the whole game object or we need to update it
      // Let's assume data.game is the updated game object, or allow partial updates

      // Actually, looking at server/src/sockets/chessHandler.ts (which we should verify), 
      // it emits 'moveMade' with { gameId, move, fen, currentTurn, whiteTime, blackTime }.
      // It DOES NOT send the full game object with moves array history in the 'moveMade' event usually.
      // We might need to fetch the game again or manually update the moves list.

      // Let's fetch the game state again to be sure we have the full history and sync
      fetchGame();
    });

    return () => {
      if (sock) {
        sock.emit('leaveGame', gameId);
      }
      disconnectSocket();
    };
  }, [gameId, user, token, authLoading, router]);

  const handleGameEnd = (result: string, reason: string) => {
    setTimeout(() => {
      if (confirm('Game ended. Return to lobby?')) {
        router.push('/');
      }
    }, 2000);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-500 text-xl mb-4">{error}</div>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Game not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      {console.log('GamePage Render - Game Object:', game)}
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-4">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            ← Back to Lobby
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Game Area */}
          <div className="flex-1">
            <ChessBoard
              gameId={gameId}
              initialFen={game.fen}
              playerColor={playerColor}
              socket={socket}
              mode={game.mode}
              onGameEnd={handleGameEnd}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:w-80">
            <div className="bg-gray-800 rounded-lg p-6 text-white">
              <h2 className="text-xl font-bold mb-4">Game Info</h2>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-400">Mode</p>
                  <p className="font-semibold capitalize">{game.mode}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-400">White</p>
                  <p className="font-semibold">{game.whitePlayerUsername || 'Waiting...'}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-400">Black</p>
                  <p className="font-semibold">{game.blackPlayerUsername || 'Waiting...'}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <p className="font-semibold capitalize">{game.status.replace(/([A-Z])/g, ' $1')}</p>
                </div>

                {game.result && (
                  <div>
                    <p className="text-sm text-gray-400">Result</p>
                    <p className="font-semibold capitalize">{game.result}</p>
                  </div>
                )}

                {game.timeControl && (
                  <div>
                    <p className="text-sm text-gray-400">Time Control</p>
                    <p className="font-semibold">
                      {game.timeControl.initial}s + {game.timeControl.increment}s
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-400">Moves</p>
                  <p className="font-semibold">{game.moves.length}</p>
                </div>
              </div>

              {game.mode === 'multiplayer' && game.status === 'waiting' && (
                <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500 rounded">
                  <p className="text-sm text-yellow-200">
                    Waiting for an opponent to join...
                  </p>
                </div>
              )}
            </div>

            {/* Move History */}
            {game.moves.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-6 text-white mt-6">
                <h2 className="text-xl font-bold mb-4">Move History</h2>
                <div className="max-h-96 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {game.moves.map((move, index) => (
                      <div
                        key={index}
                        className="text-sm"
                      >
                        <span className="text-gray-400">{Math.floor(index / 2) + 1}.</span>{' '}
                        <span className="font-mono">{move}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}