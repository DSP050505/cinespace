import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const createRoom = async () => {
    try {
      const res = await fetch(`${API_URL}/api/room/create`, { method: 'POST' });
      const data = await res.json();
      navigate(`/room/${data.roomId}?role=host&token=${data.hostToken}`);
    } catch (e) {
      console.error(e);
      alert('Failed to create room');
    }
  };

  const joinRoom = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`${API_URL}/api/room/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId })
      });
      if (!res.ok) throw new Error('Room not found');
      const data = await res.json();
      navigate(`/room/${roomId}?role=guest&token=${data.guestToken}`);
    } catch (e) {
      console.error(e);
      alert('Failed to join room');
    }
  };

  return (
    <div>
      <h1>CineSync</h1>
      <div>
        <button className="btn" onClick={createRoom}>Create New Room (Host)</button>
      </div>
      <hr />
      <div>
        <input 
          className="input" 
          placeholder="Enter Room ID" 
          value={roomId} 
          onChange={(e) => setRoomId(e.target.value.toUpperCase())} 
        />
        <button className="btn" onClick={joinRoom}>Join Room (Guest)</button>
      </div>
    </div>
  );
}

export default Home;
