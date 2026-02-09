import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from './models/User';
import Game from './models/Game';
import { authMiddleware, AuthRequest } from './middleware/auth';
import { setupChessHandlers } from './sockets/chessHandler';
import { randomBytes } from 'crypto';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));


// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Setup Socket.io handlers
setupChessHandlers(io);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const user = new User({ username, password });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        rating: user.rating,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        rating: user.rating,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Game Routes
app.post('/api/games/create', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { mode, timeControl } = req.body;
    const gameId = randomBytes(8).toString('hex');

    const gameData: any = {
      gameId,
      mode: mode || 'multiplayer',
      whitePlayer: req.userId,
      whitePlayerUsername: req.username,
      status: mode === 'bot' ? 'inProgress' : 'waiting'
    };

    if (timeControl) {
      gameData.timeControl = {
        initial: timeControl.initial,
        increment: timeControl.increment
      };
      gameData.whiteTime = timeControl.initial * 1000;
      gameData.blackTime = timeControl.initial * 1000;
    }

    if (mode === 'bot') {
      gameData.blackPlayerUsername = 'Stockfish';
      gameData.startedAt = new Date();
      if (timeControl) {
        gameData.lastMoveTime = new Date();
      }
    }

    const game = new Game(gameData);
    await game.save();

    res.status(201).json({ game });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Get game by ID
app.get('/api/games/:gameId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    console.log(`[API Debug] GET /games/${req.params.gameId} - Returning ${game.moves.length} moves: ${JSON.stringify(game.moves)}`);

    res.json({ game });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Get available games (waiting for players)
app.get('/api/games', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const games = await Game.find({
      status: 'waiting',
      mode: 'multiplayer'
    })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ games });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get user's games
app.get('/api/users/:userId/games', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const games = await Game.find({
      $or: [
        { whitePlayer: req.params.userId },
        { blackPlayer: req.params.userId }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ games });
  } catch (error) {
    console.error('Error fetching user games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ rating: -1 })
      .limit(100);

    res.json({ users });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});