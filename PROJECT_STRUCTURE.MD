# Chess.com Clone - Project Structure

```
chess-clone/
├── .gitignore
├── README.md
├── PROJECT_STRUCTURE.md
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts
│       ├── models/
│       │   ├── User.ts
│       │   └── Game.ts
│       ├── middleware/
│       │   └── auth.ts
│       └── sockets/
│           └── chessHandler.ts
│
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── .env.local.example
    ├── public/
    │   └── stockfish.js (placeholder - download from stockfishjs)
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   ├── login/
        │   │   └── page.tsx
        │   ├── register/
        │   │   └── page.tsx
        │   └── game/
        │       └── [gameId]/
        │           └── page.tsx
        ├── components/
        │   ├── ChessBoard.tsx
        │   ├── Navbar.tsx
        │   └── GameLobby.tsx
        ├── hooks/
        │   ├── useStockfish.ts
        │   └── useAuth.ts
        ├── lib/
        │   ├── socket.ts
        │   └── api.ts
        └── types/
            └── index.ts
```