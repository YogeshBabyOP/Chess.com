const express = require('express');
const http = require('http');
const path = require('path');
// yogesh op
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../chess-tactics-trainer/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../chess-tactics-trainer/dist', 'index.html'));
});

const games = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createGame', (chosenColor) => {
    const gameId = uuidv4();
    games[gameId] = {
      creator: socket.id,
      creatorColor: chosenColor,
      players: { [socket.id]: chosenColor },
    };
    socket.join(gameId);
    socket.emit('gameCreated', { gameId, color: chosenColor });
    console.log(`Game ${gameId} created by ${socket.id} as ${chosenColor}`);
  });

  socket.on('joinGame', ({ gameId }) => {
    if (!games[gameId]) {
      socket.emit('errorMessage', 'Game not found.');
      return;
    }
    const game = games[gameId];
    if (Object.keys(game.players).length >= 2) {
      socket.emit('errorMessage', 'Game is already full.');
      return;
    }
    const joinColor = game.creatorColor === 'w' ? 'b' : 'w';
    game.players[socket.id] = joinColor;
    socket.join(gameId);
    socket.emit('gameJoined', { gameId, color: joinColor });
    io.in(gameId).emit('startGame', { gameId, players: game.players });
    console.log(`User ${socket.id} joined game ${gameId} as ${joinColor}`);
  });

  socket.on('move', ({ gameId, move }) => {
    socket.to(gameId).emit('move', move);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const gameId in games) {
      const game = games[gameId];
      if (game.players[socket.id]) {
        socket.to(gameId).emit('opponentDisconnected');
        delete games[gameId];
      }
    }
  });
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
