import mongoose, { Document, Schema } from 'mongoose';

export type GameStatus = 'waiting' | 'inProgress' | 'finished' | 'aborted';
export type GameResult = 'white' | 'black' | 'draw' | null;
export type GameMode = 'multiplayer' | 'bot';

export interface IGame extends Document {
  gameId: string;
  mode: GameMode;
  whitePlayer: mongoose.Types.ObjectId | null;
  blackPlayer: mongoose.Types.ObjectId | null;
  whitePlayerUsername?: string;
  blackPlayerUsername?: string;
  status: GameStatus;
  result: GameResult;
  fen: string;
  pgn: string;
  moves: string[];
  currentTurn: 'white' | 'black';
  timeControl?: {
    initial: number; // seconds
    increment: number; // seconds
  };
  whiteTime?: number; // milliseconds remaining
  blackTime?: number; // milliseconds remaining
  lastMoveTime?: Date;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

const gameSchema = new Schema<IGame>({
  gameId: {
    type: String,
    required: true,
    unique: true,
  },
  mode: {
    type: String,
    enum: ['multiplayer', 'bot'],
    default: 'multiplayer',
  },
  whitePlayer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  blackPlayer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  whitePlayerUsername: String,
  blackPlayerUsername: String,
  status: {
    type: String,
    enum: ['waiting', 'inProgress', 'finished', 'aborted'],
    default: 'waiting',
  },
  result: {
    type: String,
    enum: ['white', 'black', 'draw', null],
    default: null,
  },
  fen: {
    type: String,
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  },
  pgn: {
    type: String,
    default: '',
  },
  moves: {
    type: [String],
    default: [],
  },
  currentTurn: {
    type: String,
    enum: ['white', 'black'],
    default: 'white',
  },
  timeControl: {
    initial: Number,
    increment: Number,
  },
  whiteTime: Number,
  blackTime: Number,
  lastMoveTime: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  startedAt: Date,
  finishedAt: Date,
});

export default mongoose.model<IGame>('Game', gameSchema);