const express = require('express');
const http = require('http');
const path = require('path');

const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (e.g., your frontend build)
// app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '../chess-tactics-trainer/dist')));

// Catch-all: For any request not handled above, send back the frontend's index.html.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../chess-tactics-trainer/dist', 'index.html'));
});

const games = {}; // Object to hold ongoing games

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create Game: Creator sends chosen color ('w' for white, 'b' for black)
  socket.on('createGame', (chosenColor) => {
    const gameId = uuidv4();
    games[gameId] = {
      creator: socket.id,
      creatorColor: chosenColor,
      players: { [socket.id]: chosenColor },
      // Optionally, you can include more game state (e.g., current FEN, move history)
    };
    socket.join(gameId);
    socket.emit('gameCreated', { gameId, color: chosenColor });
    console.log(`Game ${gameId} created by ${socket.id} as ${chosenColor}`);
  });

  // Join Game: Player sends the gameId they want to join
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
    // Assign the opposite color to the joining player
    const joinColor = game.creatorColor === 'w' ? 'b' : 'w';
    game.players[socket.id] = joinColor;
    socket.join(gameId);
    socket.emit('gameJoined', { gameId, color: joinColor });
    // Notify both players that the game is ready
    io.in(gameId).emit('startGame', { gameId, players: game.players });
    console.log(`User ${socket.id} joined game ${gameId} as ${joinColor}`);
  });

  // When a move is made by a player, broadcast it to the other player
  socket.on('move', ({ gameId, move }) => {
    // Optionally, you can validate the move using chess.js here
    socket.to(gameId).emit('move', move);
  });

  // Handle disconnects: Clean up game if a player leaves
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Loop through games to see if this socket was part of any
    for (const gameId in games) {
      const game = games[gameId];
      if (game.players[socket.id]) {
        // Notify the other player, if any, that their opponent disconnected
        socket.to(gameId).emit('opponentDisconnected');
        // Remove the game – in a more robust system you might want to handle reconnection logic
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
