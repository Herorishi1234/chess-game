import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import Game, { IGame } from '../models/Game';
import User from '../models/User';
import { verifySocketToken } from '../middleware/auth';

interface SocketData {
  userId: string;
  username: string;
}

export const setupChessHandlers = (io: Server) => {
  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = verifySocketToken(token);
    if (!decoded) {
      return next(new Error('Invalid token'));
    }

    socket.data = decoded as SocketData;
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.data.username} (${socket.id})`);

    // Join a game room
    socket.on('joinGame', async (gameId: string) => {
      try {
        const game = await Game.findOne({ gameId });
        
        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        socket.join(gameId);
        
        // Update game if it's waiting for a second player
        if (game.status === 'waiting' && !game.blackPlayer) {
          game.blackPlayer = socket.data.userId as any;
          game.blackPlayerUsername = socket.data.username;
          game.status = 'inProgress';
          game.startedAt = new Date();
          
          if (game.timeControl) {
            game.whiteTime = game.timeControl.initial * 1000;
            game.blackTime = game.timeControl.initial * 1000;
            game.lastMoveTime = new Date();
          }
          
          await game.save();
        }

        // Send current game state to the joining player
        socket.emit('gameState', {
          gameId: game.gameId,
          fen: game.fen,
          moves: game.moves,
          status: game.status,
          whitePlayer: game.whitePlayerUsername,
          blackPlayer: game.blackPlayerUsername,
          currentTurn: game.currentTurn,
          timeControl: game.timeControl,
          whiteTime: game.whiteTime,
          blackTime: game.blackTime,
        });

        // Notify all players in the room
        io.to(gameId).emit('playerJoined', {
          username: socket.data.username,
          gameState: {
            status: game.status,
            whitePlayer: game.whitePlayerUsername,
            blackPlayer: game.blackPlayerUsername
          }
        });

      } catch (error) {
        console.error('Error joining game:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    // Handle chess moves
    socket.on('makeMove', async (data: { gameId: string; from: string; to: string; promotion?: string }) => {
      try {
        const { gameId, from, to, promotion } = data;
        const game = await Game.findOne({ gameId });

        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        if (game.status !== 'inProgress') {
          socket.emit('error', { message: 'Game is not in progress' });
          return;
        }

        // Verify it's the player's turn
        const isWhite = game.whitePlayer?.toString() === socket.data.userId;
        const isBlack = game.blackPlayer?.toString() === socket.data.userId;
        
        if ((game.currentTurn === 'white' && !isWhite) || 
            (game.currentTurn === 'black' && !isBlack)) {
          socket.emit('error', { message: 'Not your turn' });
          return;
        }

        // Validate move with chess.js
        const chess = new Chess(game.fen);
        const move = chess.move({ from, to, promotion: promotion as any });

        if (!move) {
          socket.emit('error', { message: 'Invalid move' });
          return;
        }

        // Update time if time control is enabled
        if (game.timeControl && game.lastMoveTime) {
          const elapsed = Date.now() - game.lastMoveTime.getTime();
          
          if (game.currentTurn === 'white' && game.whiteTime) {
            game.whiteTime = Math.max(0, game.whiteTime - elapsed + (game.timeControl.increment * 1000));
          } else if (game.currentTurn === 'black' && game.blackTime) {
            game.blackTime = Math.max(0, game.blackTime - elapsed + (game.timeControl.increment * 1000));
          }
          
          game.lastMoveTime = new Date();
        }

        // Update game state
        game.fen = chess.fen();
        game.pgn = chess.pgn();
        game.moves.push(move.san);
        game.currentTurn = chess.turn() === 'w' ? 'white' : 'black';

        // Check for game end conditions
        if (chess.isGameOver()) {
          game.status = 'finished';
          game.finishedAt = new Date();
          
          if (chess.isCheckmate()) {
            game.result = chess.turn() === 'w' ? 'black' : 'white';
          } else {
            game.result = 'draw';
          }

          // Update player stats
          if (game.result === 'white' && game.whitePlayer) {
            await User.findByIdAndUpdate(game.whitePlayer, {
              $inc: { gamesPlayed: 1, gamesWon: 1 }
            });
            if (game.blackPlayer) {
              await User.findByIdAndUpdate(game.blackPlayer, {
                $inc: { gamesPlayed: 1 }
              });
            }
          } else if (game.result === 'black' && game.blackPlayer) {
            await User.findByIdAndUpdate(game.blackPlayer, {
              $inc: { gamesPlayed: 1, gamesWon: 1 }
            });
            if (game.whitePlayer) {
              await User.findByIdAndUpdate(game.whitePlayer, {
                $inc: { gamesPlayed: 1 }
              });
            }
          } else if (game.result === 'draw') {
            if (game.whitePlayer) {
              await User.findByIdAndUpdate(game.whitePlayer, {
                $inc: { gamesPlayed: 1 }  // we are not maintaining draws separately
              });
            }
            if (game.blackPlayer) {
              await User.findByIdAndUpdate(game.blackPlayer, {
                $inc: { gamesPlayed: 1 }
              });
            }
          }
        }

        await game.save();

        // Broadcast move to all players in the room
        io.to(gameId).emit('moveMade', {
          move: {
            from,
            to,
            promotion,
            san: move.san
          },
          fen: game.fen,
          currentTurn: game.currentTurn,
          status: game.status,
          result: game.result,
          whiteTime: game.whiteTime,
          blackTime: game.blackTime,
          isCheckmate: chess.isCheckmate(),
          isCheck: chess.isCheck(),
          isDraw: chess.isDraw(),
          isStalemate: chess.isStalemate(),
          isThreefoldRepetition: chess.isThreefoldRepetition(),
          isInsufficientMaterial: chess.isInsufficientMaterial()
        });

      } catch (error) {
        console.error('Error making move:', error);
        socket.emit('error', { message: 'Failed to make move' });
      }
    });

    // Handle resignation
    socket.on('resign', async (gameId: string) => {
      try {
        const game = await Game.findOne({ gameId });
        
        if (!game || game.status !== 'inProgress') {
          socket.emit('error', { message: 'Cannot resign this game' });
          return;
        }

        const isWhite = game.whitePlayer?.toString() === socket.data.userId;
        const isBlack = game.blackPlayer?.toString() === socket.data.userId;

        if (!isWhite && !isBlack) {
          socket.emit('error', { message: 'You are not a player in this game' });
          return;
        }

        game.status = 'finished';
        game.result = isWhite ? 'black' : 'white'; //doubt
        game.finishedAt = new Date();
        await game.save();

        // Update stats
        const winner = isWhite ? game.blackPlayer : game.whitePlayer;
        const loser = isWhite ? game.whitePlayer : game.blackPlayer;

        if (winner) {
          await User.findByIdAndUpdate(winner, {
            $inc: { gamesPlayed: 1, gamesWon: 1 }
          });
        }
        if (loser) {
          await User.findByIdAndUpdate(loser, {
            $inc: { gamesPlayed: 1 }
          });
        }

        io.to(gameId).emit('gameEnded', {
          result: game.result,
          reason: 'resignation',
          winner: isWhite ? game.blackPlayerUsername : game.whitePlayerUsername
        });

      } catch (error) {
        console.error('Error resigning:', error);
        socket.emit('error', { message: 'Failed to resign' });
      }
    });

    // Handle draw offers
    socket.on('offerDraw', async (gameId: string) => {
      try {
        const game = await Game.findOne({ gameId });
        
        if (!game || game.status !== 'inProgress') {
          return;
        }

        const isPlayer = game.whitePlayer?.toString() === socket.data.userId ||
                        game.blackPlayer?.toString() === socket.data.userId;

        if (!isPlayer) {
          return;
        }

        // Broadcast draw offer to opponent
        socket.to(gameId).emit('drawOffered', {
          from: socket.data.username
        });

      } catch (error) {
        console.error('Error offering draw:', error);
      }
    });

    socket.on('acceptDraw', async (gameId: string) => {
      try {
        const game = await Game.findOne({ gameId });
        
        if (!game || game.status !== 'inProgress') {
          return;
        }

        game.status = 'finished';
        game.result = 'draw';
        game.finishedAt = new Date();
        await game.save();

        // Update stats
        if (game.whitePlayer) {
          await User.findByIdAndUpdate(game.whitePlayer, {
            $inc: { gamesPlayed: 1 }
          });
        }
        if (game.blackPlayer) {
          await User.findByIdAndUpdate(game.blackPlayer, {
            $inc: { gamesPlayed: 1 }
          });
        }

        io.to(gameId).emit('gameEnded', {
          result: 'draw',
          reason: 'agreement'
        });

      } catch (error) {
        console.error('Error accepting draw:', error);
      }
    });

    // Leave game
    socket.on('leaveGame', (gameId: string) => {
      socket.leave(gameId);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.data.username} (${socket.id})`);
    });
  });
};