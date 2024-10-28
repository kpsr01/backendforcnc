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
  }
});

app.use(express.static('build'));
app.use((req,res,next) => {
  res.sendFile(path.join(__dirname, 'build','index.html'));
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoom', ({ roomId, username }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: [],
        code: `// Default C code
#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}`,
        language: 'c',
        input: '',
        output: ''
      };
    }

    rooms[roomId].users.push({ id: socket.id, username });
    socket.join(roomId);

    socket.emit('roomState', {
      code: rooms[roomId].code,
      language: rooms[roomId].language,
      input: rooms[roomId].input,
      output: rooms[roomId].output
    });

    socket.to(roomId).emit('userJoined', { username });
    
    console.log(`${username} joined room ${roomId}`);
    io.to(roomId).emit('roomUsers', rooms[roomId].users);
  });
socket.on('getRoomState', ({ roomId }) => {
  const room = rooms[roomId];  
  if (room) {
    socket.emit('roomState', {
      code: room.code,
      language: room.language,
      input: room.input,
      output: room.output,
    });
  }
});


  socket.on('languageChange', ({ roomId, language }) => {
    if (rooms[roomId]) {
      rooms[roomId].language = language;
  
      let newCode = '';
      switch (language) {
        case 'c':
          newCode = `// Default C code\n#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}`;
          break;
        case 'cpp':
          newCode = `// Default C++ code\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`;
          break;
        case 'java':
          newCode = `// Default Java code\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`;
          break;
        case 'python':
          newCode = `# Default Python code\nprint("Hello, World!")`;
          break;
        case 'javascript':
          newCode = `// Default JavaScript code\nconsole.log("Hello, World!");`;
          break;
      }
  
      rooms[roomId].code = newCode; 
  
      io.to(roomId).emit('languageUpdate', { language, code: newCode });
    }
  });
  
  socket.on('codeChange', ({ roomId, code }) => {
    if (rooms[roomId]) {
      rooms[roomId].code = code;
      socket.to(roomId).emit('codeUpdate', code); 
    }
  });
  socket.on('roomUsers', (users) => {
    setConnectedUsers(users.map(user => user.username));
  });
  
  
  socket.on('inputChange', ({ roomId, input }) => {
    if (rooms[roomId]) {
      rooms[roomId].input = input;
      socket.to(roomId).emit('inputUpdate', input);
    }
  });

  socket.on('outputChange', ({ roomId, output }) => {
    if (rooms[roomId]) {
      rooms[roomId].output = output;
      socket.to(roomId).emit('outputUpdate', output);
    }
  });

  socket.on('disconnect', () => {
    let roomId;
    let username;

    for (let room in rooms) {
      const userIndex = rooms[room].users.findIndex(user => user.id === socket.id);
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

      console.log(`${username} left room ${roomId}`);

      if (rooms[roomId].users.length === 0) {
        delete rooms[roomId];
      }
    }
  });

  socket.on('leaveRoom', ({ roomId }) => {
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room ${roomId}`);
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