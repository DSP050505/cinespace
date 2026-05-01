const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = {};

app.post('/api/room/create', (req, res) => {
  const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  rooms[roomId] = { hostSocketId: null, hostPeerId: null, videoUrl: '', tmdbId: '', videoTime: 0, lastUpdate: Date.now() };
  res.json({ roomId, hostToken: 'host-' + Date.now() }); 
});

app.post('/api/room/join', (req, res) => {
  const { roomId } = req.body;
  if (!rooms[roomId]) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({ 
    guestToken: 'guest-' + Date.now(), 
    videoUrl: rooms[roomId].videoUrl,
    tmdbId: rooms[roomId].tmdbId,
    videoTime: rooms[roomId].videoTime
  });
});

app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  if (!rooms[roomId]) return res.status(404).json({ error: 'Room not found' });
  res.json(rooms[roomId]);
});

const roomNs = io.of('/room');

roomNs.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', ({ roomId, role, peerId }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = role;
    
    if (role === 'host') {
      if (rooms[roomId]) {
        rooms[roomId].hostSocketId = socket.id;
        rooms[roomId].hostPeerId = peerId;
      }
    }
    
    socket.to(roomId).emit('peer:joined', { role, peerId });
    
    if (role === 'guest' && rooms[roomId]?.hostPeerId) {
      socket.emit('peer:joined', { role: 'host', peerId: rooms[roomId].hostPeerId });
    }
  });

  socket.on('ping', (cb) => {
    if(typeof cb === 'function') cb(Date.now());
  });

  socket.on('sync:play', ({ roomId, videoTime, serverTime }) => {
    if (socket.role === 'host') {
      if(rooms[roomId]) {
        rooms[roomId].videoTime = videoTime;
        rooms[roomId].lastUpdate = Date.now();
      }
      socket.to(roomId).emit('sync:play', { videoTime, serverTime: Date.now() }); // use actual server time
    }
  });

  socket.on('sync:pause', ({ roomId, videoTime }) => {
    if (socket.role === 'host') {
      if(rooms[roomId]) rooms[roomId].videoTime = videoTime;
      socket.to(roomId).emit('sync:pause', { videoTime });
    }
  });

  socket.on('sync:seek', ({ roomId, videoTime }) => {
    if (socket.role === 'host') {
      if(rooms[roomId]) rooms[roomId].videoTime = videoTime;
      socket.to(roomId).emit('sync:seek', { videoTime });
    }
  });

  socket.on('sync:heartbeat', ({ roomId, currentTime }) => {
    if (socket.role === 'host') {
      if (rooms[roomId]) {
        rooms[roomId].videoTime = currentTime;
        rooms[roomId].lastUpdate = Date.now();
      }
    } else {
      if (rooms[roomId]) {
        const expectedTime = rooms[roomId].videoTime + ((Date.now() - rooms[roomId].lastUpdate) / 1000);
        const diff = currentTime - expectedTime;
        if (Math.abs(diff) > 0.5) {
          socket.emit('sync:drift', { delta: diff }); 
        }
      }
    }
  });

  socket.on('set:videoUrl', ({ roomId, videoUrl }) => {
     if (socket.role === 'host') {
         if (rooms[roomId]) {
             rooms[roomId].videoUrl = videoUrl;
             rooms[roomId].tmdbId = ''; // reset tmdbId if manual url is set
         }
         socket.to(roomId).emit('set:videoUrl', { videoUrl });
     }
  });

  socket.on('set:tmdbId', ({ roomId, tmdbId }) => {
     if (socket.role === 'host') {
         if (rooms[roomId]) {
             rooms[roomId].tmdbId = tmdbId;
             rooms[roomId].videoUrl = ''; // reset url if tmdbId is set
         }
         socket.to(roomId).emit('set:tmdbId', { tmdbId });
     }
  });

  socket.on('sync:countdown', ({ roomId }) => {
    if (socket.role === 'host') {
      socket.to(roomId).emit('sync:countdown');
    }
  });

  socket.on('request:peerId', ({ roomId }) => {
    socket.to(roomId).emit('provide:peerId', { requesterId: socket.id });
  });

  socket.on('submit:peerId', ({ requesterId, peerId }) => {
    roomNs.to(requesterId).emit('relay:peerId', { peerId });
  });

  socket.on('disconnect', () => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('peer:left', { role: socket.role, peerId: socket.id });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
