"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface StockfishMove {
  from: string;
  to: string;
  promotion?: string;
}

// this will check if the stockfish.js file exists in the public folder before trying to initialize the worker, which will prevent errors if the file is missing
const stockfishExists = async () => {
  try {
    const res = await fetch("/stockfish-17.1-single-a496a04.js", { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
};

export const useStockfish = () => {
  const [isReady, setIsReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const resolveRef = useRef<((move: StockfishMove | null) => void) | null>(
    null,
  );

  useEffect(() => {
    // Initialize Stockfish worker

    const initStockfish = async () => {
      if (typeof window !== "undefined" && !workerRef.current) {
        const exists = await stockfishExists();
        if (!exists) {
          console.error("stockfish.js not found in public folder");
          return;
        }

        try {
          // workerRef.current = new Worker("/stockfish.js");


          workerRef.current = new Worker('/stockfish-17.1-single-a496a04.js');

          // workerRef.current = new Worker(
          //   new URL("/stockfish-17.1-single-a496a04.js", window.location.origin),
          //   { type: "classic" },
          // );

          // this is added to counter worker error
          workerRef.current.onerror = (error) => {
            console.error("CRITICAL: Stockfish worker failed to load.", {
              message: error?.message,
              filename: error?.filename,
              lineno: error?.lineno,
            });
            setIsReady(false);
          };

          console.log('Stockfish worker created. Waiting for readyok...');

          workerRef.current.onmessage = (event) => {
            const message = event.data;
            console.log('Stockfish says:', message);

            if (message === "readyok") {
              console.log('Stockfish is READY');
              setIsReady(true);
            } else if (
              typeof message === "string" &&
              message.startsWith("bestmove")
            ) {
              setIsThinking(false);
              const moveMatch = message.match(
                /bestmove ([a-h][1-8])([a-h][1-8])([qrbn])?/,
              );

              console.log('Stockfish debug: bestmove received. Match:', moveMatch ? 'Yes' : 'No', 'ResolveRef:', !!resolveRef.current);

              if (moveMatch && resolveRef.current) {
                const move: StockfishMove = {
                  from: moveMatch[1],
                  to: moveMatch[2],
                  promotion: moveMatch[3] as "q" | "r" | "b" | "n" | undefined,
                };
                console.log('Stockfish debug: Resolving with move:', move);
                resolveRef.current(move);
                resolveRef.current = null;
              } else if (resolveRef.current) {
                console.log('Stockfish debug: Resolving with null (no match)');
                resolveRef.current(null);
                resolveRef.current = null;
              } else {
                console.log('Stockfish debug: No resolve function available!');
              }
            }
          };

          // Initialize UCI mode
          workerRef.current.postMessage("uci");
          workerRef.current.postMessage("isready");
        } catch (error) {
          console.error("Failed to initialize Stockfish:", error);
        }
      }
    };

    initStockfish();

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const getBestMove = useCallback(
    (fen: string, skillLevel: number = 10): Promise<StockfishMove | null> => {
      return new Promise((resolve) => {
        if (!workerRef.current || !isReady) {
          resolve(null);
          return;
        }

        setIsThinking(true);
        resolveRef.current = resolve;

        // Set skill level (0-20, where 20 is strongest)
        workerRef.current.postMessage(
          `setoption name Skill Level value ${skillLevel}`,
        );

        // Set position
        workerRef.current.postMessage(`position fen ${fen}`);

        // Start searching with time limit
        workerRef.current.postMessage("go movetime 1000");

        // Timeout after 5 seconds
        const timerCallback = () => {
          if (resolveRef.current) {
            console.log('Stockfish debug: Timeout fired, clearing resolveRef');
            setIsThinking(false);
            resolveRef.current(null);
            resolveRef.current = null;
          }
        };

        const timerId = setTimeout(timerCallback, 5000);

        // Wrap the resolve function to clear timeout
        const originalResolve = resolve;
        resolveRef.current = (move: StockfishMove | null) => {
          clearTimeout(timerId);
          originalResolve(move);
        };
      });
    },
    [isReady],
  );

  const setDifficulty = useCallback(
    (level: number) => {
      if (workerRef.current && isReady) {
        // level: 1-20 (1 is easiest, 20 is hardest)
        workerRef.current.postMessage(
          `setoption name Skill Level value ${level}`,
        );
      }
    },
    [isReady],
  );

  return {
    isReady,
    isThinking,
    getBestMove,
    setDifficulty,
  };
};

