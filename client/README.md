# Rifa Client

Client web do jogo Rifa construido com Vite + TypeScript + CSS.

## Setup

```bash
npm install
npm run dev
```

## Variaveis de ambiente

Crie `.env` dentro de `client/`:

```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

## Fluxo

1. Criar conta em `POST /auth/register`
2. Fazer login em `POST /auth/login`
3. Conectar no socket e entrar em uma mesa
4. Iniciar rodada e jogar normalmente
