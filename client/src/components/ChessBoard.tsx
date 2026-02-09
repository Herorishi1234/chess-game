'use client';

import { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Socket } from 'socket.io-client';
import { GameState, Move } from '@/types';
import { useStockfish } from '@/hooks/useStockfish';

interface ChessBoardProps {
  gameId: string;
  initialFen?: string;
  playerColor: 'white' | 'black';
  socket: Socket | null;
  mode: 'multiplayer' | 'bot';
  onGameEnd?: (result: string, reason: string) => void;
}

export default function ChessBoard({
  gameId,
  initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  playerColor,
  socket,
  mode,
  onGameEnd
}: ChessBoardProps) {
  const [game, setGame] = useState(new Chess(initialFen));
  const [fen, setFen] = useState(initialFen);
  const [moveFrom, setMoveFrom] = useState('');
  const [rightClickedSquares, setRightClickedSquares] = useState<{ [key: string]: any }>({});
  const [moveSquares, setMoveSquares] = useState<{ [key: string]: any }>({});
  const [optionSquares, setOptionSquares] = useState<{ [key: string]: any }>({});
  const [gameStatus, setGameStatus] = useState<string>('');
  const [currentTurn, setCurrentTurn] = useState<'white' | 'black'>('white');
  const [isMyTurn, setIsMyTurn] = useState(playerColor === 'white');
  const [whiteTime, setWhiteTime] = useState<number | null>(null);
  const [blackTime, setBlackTime] = useState<number | null>(null);

  const { isReady: stockfishReady, isThinking, getBestMove } = useStockfish();

  // Update turn indicator
  useEffect(() => {
    setIsMyTurn(currentTurn === playerColor);
  }, [currentTurn, playerColor]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('gameState', (state: GameState) => {
      const newGame = new Chess(state.fen);
      setGame(newGame);
      setFen(state.fen);
      setCurrentTurn(state.currentTurn);
      if (state.whiteTime !== undefined) setWhiteTime(state.whiteTime);
      if (state.blackTime !== undefined) setBlackTime(state.blackTime);
      updateGameStatus(newGame);
    });

    socket.on('moveMade', (data: any) => {
      const newGame = new Chess(data.fen);
      setGame(newGame);
      setFen(data.fen);
      setCurrentTurn(data.currentTurn);
      if (data.whiteTime !== undefined) setWhiteTime(data.whiteTime);
      if (data.blackTime !== undefined) setBlackTime(data.blackTime);
      setMoveSquares({
        [data.move.from]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
        [data.move.to]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
      });
      updateGameStatus(newGame, data);

      // If it's bot mode and it's the bot's turn, make a move
      if (mode === 'bot' && data.currentTurn !== playerColor && stockfishReady && !newGame.isGameOver()) {
        setTimeout(() => {
          makeBotMove(data.fen);
        }, 500);
      }
    });

    socket.on('gameEnded', (data: any) => {
      const message = data.reason === 'resignation' 
        ? `${data.winner} wins by resignation!`
        : `Game ended: ${data.result === 'draw' ? 'Draw' : data.result + ' wins'}`;
      setGameStatus(message);
      if (onGameEnd) {
        onGameEnd(data.result, data.reason);
      }
    });

    socket.on('drawOffered', (data: any) => {
      if (confirm(`${data.from} offers a draw. Accept?`)) {
        socket.emit('acceptDraw', gameId);
      }
    });

    socket.on('error', (data: any) => {
      alert(data.message);
    });

    return () => {
      socket.off('gameState');
      socket.off('moveMade');
      socket.off('gameEnded');
      socket.off('drawOffered');
      socket.off('error');
    };
  }, [socket, gameId, mode, playerColor, stockfishReady, onGameEnd]);

  const updateGameStatus = (chessGame: Chess, moveData?: any) => {
    if (chessGame.isCheckmate()) {
      setGameStatus(`Checkmate! ${chessGame.turn() === 'w' ? 'Black' : 'White'} wins!`);
    } else if (chessGame.isDraw()) {
      if (chessGame.isStalemate()) {
        setGameStatus('Draw by stalemate');
      } else if (chessGame.isThreefoldRepetition()) {
        setGameStatus('Draw by threefold repetition');
      } else if (chessGame.isInsufficientMaterial()) {
        setGameStatus('Draw by insufficient material');
      } else {
        setGameStatus('Draw');
      }
    } else if (chessGame.isCheck()) {
      setGameStatus('Check!');
    } else {
      setGameStatus('');
    }
  };

  const makeBotMove = async (currentFen: string) => {
    if (!stockfishReady) return;

    const botMove = await getBestMove(currentFen, 15);
    if (botMove && socket) {
      socket.emit('makeMove', {
        gameId,
        from: botMove.from,
        to: botMove.to,
        promotion: botMove.promotion
      });
    }
  };

  const getMoveOptions = useCallback((square: string) => {
    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    const newSquares: { [key: string]: any } = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to) && game.get(move.to).color !== game.get(square).color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%'
      };
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)'
    };
    setOptionSquares(newSquares);
    return true;
  }, [game]);

  const onSquareClick = useCallback((square: string) => {
    // Ignore clicks if not player's turn or in bot thinking mode
    if (!isMyTurn || isThinking) return;

    // If no piece is selected yet
    if (!moveFrom) {
      const piece = game.get(square);
      if (piece && piece.color === (playerColor === 'white' ? 'w' : 'b')) {
        setMoveFrom(square);
        getMoveOptions(square);
      }
      return;
    }

    // Try to make a move
    const moves = game.moves({ square: moveFrom, verbose: true });
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    if (!foundMove) {
      // If clicking on another piece of the same color, select it instead
      const piece = game.get(square);
      if (piece && piece.color === (playerColor === 'white' ? 'w' : 'b')) {
        setMoveFrom(square);
        getMoveOptions(square);
      } else {
        setMoveFrom('');
        setOptionSquares({});
      }
      return;
    }

    // Handle promotion
    let promotion = undefined;
    if (foundMove.flags.includes('p')) {
      promotion = 'q'; // Auto-promote to queen for simplicity
    }

    // Emit move via socket
    if (socket) {
      socket.emit('makeMove', {
        gameId,
        from: moveFrom,
        to: square,
        promotion
      });
    }

    setMoveFrom('');
    setOptionSquares({});
  }, [moveFrom, game, isMyTurn, socket, gameId, getMoveOptions, playerColor, isThinking]);

  const onSquareRightClick = useCallback((square: string) => {
    const color = 'rgba(0, 0, 255, 0.4)';
    setRightClickedSquares((prev) => {
      const newSquares = { ...prev };
      if (newSquares[square]) {
        delete newSquares[square];
      } else {
        newSquares[square] = { backgroundColor: color };
      }
      return newSquares;
    });
  }, []);

  const handleResign = () => {
    if (socket && confirm('Are you sure you want to resign?')) {
      socket.emit('resign', gameId);
    }
  };

  const handleOfferDraw = () => {
    if (socket) {
      socket.emit('offerDraw', gameId);
    }
  };

  const formatTime = (ms: number | null) => {
    if (ms === null) return null;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-2xl mx-auto">
      {/* Game Info */}
      <div className="w-full bg-gray-800 rounded-lg p-4 text-white">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-400">Playing as: {playerColor}</p>
            {gameStatus && (
              <p className="text-lg font-bold text-yellow-400">{gameStatus}</p>
            )}
            {!gameStatus && (
              <p className="text-sm">
                {isMyTurn ? "Your turn" : (mode === 'bot' ? "Bot thinking..." : "Opponent's turn")}
              </p>
            )}
          </div>
          {whiteTime !== null && blackTime !== null && (
            <div className="text-right">
              <div className={currentTurn === 'white' ? 'text-yellow-400 font-bold' : ''}>
                White: {formatTime(whiteTime)}
              </div>
              <div className={currentTurn === 'black' ? 'text-yellow-400 font-bold' : ''}>
                Black: {formatTime(blackTime)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chessboard */}
      <div className="w-full aspect-square">
        <Chessboard
          position={fen}
          onSquareClick={onSquareClick}
          onSquareRightClick={onSquareRightClick}
          boardOrientation={playerColor}
          customSquareStyles={{
            ...moveSquares,
            ...optionSquares,
            ...rightClickedSquares
          }}
          arePremovesAllowed={false}
          isDraggablePiece={({ piece }) => {
            if (!isMyTurn || isThinking) return false;
            return piece[0] === (playerColor === 'white' ? 'w' : 'b');
          }}
        />
      </div>

      {/* Action Buttons */}
      {mode === 'multiplayer' && (
        <div className="flex gap-4">
          <button
            onClick={handleOfferDraw}
            disabled={!isMyTurn || game.isGameOver()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Offer Draw
          </button>
          <button
            onClick={handleResign}
            disabled={game.isGameOver()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Resign
          </button>
        </div>
      )}
    </div>
  );
}