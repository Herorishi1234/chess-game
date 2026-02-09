export interface User {
  id: string;
  username: string;
  rating: number;
  gamesPlayed: number;
  gamesWon: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type GameStatus = 'waiting' | 'inProgress' | 'finished' | 'aborted';
export type GameResult = 'white' | 'black' | 'draw' | null;
export type GameMode = 'multiplayer' | 'bot';

export interface Game {
  _id: string;
  gameId: string;
  mode: GameMode;
  whitePlayer?: string;
  blackPlayer?: string;
  whitePlayerUsername?: string;
  blackPlayerUsername?: string;
  status: GameStatus;
  result: GameResult;
  fen: string;
  pgn: string;
  moves: string[];
  currentTurn: 'white' | 'black';
  timeControl?: {
    initial: number;
    increment: number;
  };
  whiteTime?: number;
  blackTime?: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface Move {
  from: string;
  to: string;
  promotion?: string;
  san?: string;
}

export interface GameState {
  gameId: string;
  fen: string;
  moves: string[];
  status: GameStatus;
  whitePlayer?: string;
  blackPlayer?: string;
  currentTurn: 'white' | 'black';
  result?: GameResult;
  timeControl?: {
    initial: number;
    increment: number;
  };
  whiteTime?: number;
  blackTime?: number;
}