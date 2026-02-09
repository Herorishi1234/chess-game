'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Game } from '@/types';

export default function GameLobby() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showTimeControl, setShowTimeControl] = useState(false);
  const [timeControl, setTimeControl] = useState({ initial: 600, increment: 5 });
  const router = useRouter();

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchGames = async () => {
    try {
      const response = await api.get('/games');
      setGames(response.data.games);
    } catch (error) {
      console.error('Failed to fetch games:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGame = async (mode: 'multiplayer' | 'bot') => {
    setCreating(true);
    try {
      const payload: any = { mode };
      if (showTimeControl) {
        payload.timeControl = timeControl;
      }
      
      const response = await api.post('/games/create', payload);
      const gameId = response.data.game.gameId;
      router.push(`/game/${gameId}`);
    } catch (error) {
      console.error('Failed to create game:', error);
      alert('Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  const joinGame = (gameId: string) => {
    router.push(`/game/${gameId}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Game Lobby</h1>

      {/* Create New Game Section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Create New Game</h2>
        
        {/* Time Control Toggle */}
        <div className="mb-4">
          <label className="flex items-center text-white cursor-pointer">
            <input
              type="checkbox"
              checked={showTimeControl}
              onChange={(e) => setShowTimeControl(e.target.checked)}
              className="mr-2 w-4 h-4"
            />
            Enable Time Control
          </label>
        </div>

        {/* Time Control Settings */}
        {showTimeControl && (
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Initial Time (seconds)
              </label>
              <input
                type="number"
                value={timeControl.initial}
                onChange={(e) => setTimeControl({ ...timeControl, initial: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                min="60"
                max="3600"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Increment (seconds)
              </label>
              <input
                type="number"
                value={timeControl.increment}
                onChange={(e) => setTimeControl({ ...timeControl, increment: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                min="0"
                max="60"
              />
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => createGame('multiplayer')}
            disabled={creating}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Multiplayer Game'}
          </button>
          <button
            onClick={() => createGame('bot')}
            disabled={creating}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Play vs Bot'}
          </button>
        </div>
      </div>

      {/* Available Games Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">
          Available Games ({games.length})
        </h2>
        
        {loading ? (
          <p className="text-gray-400">Loading games...</p>
        ) : games.length === 0 ? (
          <p className="text-gray-400">No games available. Create one to get started!</p>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game.gameId}
                className="flex items-center justify-between bg-gray-700 p-4 rounded-lg hover:bg-gray-600 transition"
              >
                <div className="flex-1">
                  <p className="text-white font-semibold">
                    {game.whitePlayerUsername || 'Anonymous'} waiting for opponent
                  </p>
                  {game.timeControl && (
                    <p className="text-sm text-gray-400">
                      Time: {game.timeControl.initial}s + {game.timeControl.increment}s
                    </p>
                  )}
                </div>
                <button
                  onClick={() => joinGame(game.gameId)}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Join Game
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}