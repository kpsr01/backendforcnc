const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.static('build'));
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const rooms = {}; 

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoom', ({ roomId, username }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: [],
        code: '', 
        language: 'c', 
        input: '', 
        output: '', 
      };
    }
  
    rooms[roomId].users.push({ id: socket.id, username });
  
    socket.join(roomId);
  
    socket.emit('syncState', {
      code: rooms[roomId].code,
      language: rooms[roomId].language,
      input: rooms[roomId].input,
      output: rooms[roomId].output,
    });
  
    socket.to(roomId).emit('userJoined', { username });
  
    io.to(roomId).emit('roomUsers', rooms[roomId].users);
  
    console.log(`${username} joined room ${roomId}`);
  });
  

  socket.on('codeChange', ({ roomId, code }) => {
    if (rooms[roomId]) {
      rooms[roomId].code = code; 
      socket.to(roomId).emit('codeUpdate', code); 
      io.to(roomId).emit('syncState', { 
        code: rooms[roomId].code,
        language: rooms[roomId].language,
        input: rooms[roomId].input,
        output: rooms[roomId].output,
      });
    }
  });

  socket.on('languageChange', ({ roomId, language }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].language = language;
    socket.to(roomId).emit('languageUpdate', language);
  });

  socket.on('inputChange', ({ roomId, input }) => {
    if (rooms[roomId]) {
      rooms[roomId].input = input; 
      socket.to(roomId).emit('inputUpdate', input); 
      io.to(roomId).emit('syncState', { 
        code: rooms[roomId].code,
        language: rooms[roomId].language,
        input: rooms[roomId].input,
        output: rooms[roomId].output,
      });
    }
  });
  
  socket.on('outputChange', ({ roomId, output }) => {
    if (rooms[roomId]) {
      rooms[roomId].output = output; 
      socket.to(roomId).emit('outputUpdate', output); 
      io.to(roomId).emit('syncState', { 
        code: rooms[roomId].code,
        language: rooms[roomId].language,
        input: rooms[roomId].input,
        output: rooms[roomId].output,
      });
    }
  });

  socket.on('leaveRoom', ({ roomId }) => {
    if (!rooms[roomId]) return;
    const userIndex = rooms[roomId].users.findIndex((user) => user.id === socket.id);
    if (userIndex !== -1) {
      rooms[roomId].users.splice(userIndex, 1);
      io.to(roomId).emit('roomUsers', rooms[roomId].users);
    }

    if (rooms[roomId].users.length === 0) delete rooms[roomId];

    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room ${roomId}`);
  });

  socket.on('disconnect', () => {
    let roomId;
    let username;

    for (let room in rooms) {
      const userIndex = rooms[room].users.findIndex((user) => user.id === socket.id);
      if (userIndex !== -1) {
        username = rooms[room].users[userIndex].username;
        roomId = room;
        rooms[room].users.splice(userIndex, 1);
        break;
      }
    }

    if (roomId) {
      io.to(roomId).emit('userLeft', { username });
      io.to(roomId).emit('roomUsers', rooms[roomId].users);

      if (rooms[roomId].users.length === 0) delete rooms[roomId];
      console.log(`${username} left room ${roomId}`);
    }
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
    socket.emit('errorMessage', { message: 'An error occurred' });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
