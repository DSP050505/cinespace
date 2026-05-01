import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import Draggable from 'react-draggable';
import { Mic, MicOff, Maximize, Minimize } from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001/room';

function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role'); 
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [partnerPeerId, setPartnerPeerId] = useState(null);

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPartnerMuted, setIsPartnerMuted] = useState(false);

  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localScreenRef = useRef(null);
  const remoteScreenRef = useRef(null);
  const nodeRef = useRef(null);

  // Use a ref to store the stream so we can access it inside listeners without closures issues
  const currentLocalStreamRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    
    const peer = new Peer(undefined, {
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });
    peerRef.current = peer;

    // 1. Set up call listener IMMEDIATELY
    peer.on('call', (call) => {
      console.log("Incoming call:", call.metadata?.type || 'webcam');
      setPartnerPeerId(call.peer); // Store the peerId of whoever is calling us
      
      if (call.metadata?.type === 'screen') {
        call.answer(); 
      } else {
        call.answer(currentLocalStreamRef.current);
      }

      call.on('stream', (incomingStream) => {
        console.log("Received stream for:", call.metadata?.type || 'webcam');
        if (call.metadata?.type === 'screen') {
          setRemoteScreenStream(incomingStream);
        } else {
          setRemoteStream(incomingStream);
        }
      });
    });

    // 2. Get local stream and THEN join room
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setLocalStream(stream);
        currentLocalStreamRef.current = stream;

        if (peer.open) {
          socketRef.current.emit('join-room', { roomId, role, peerId: peer.id });
        } else {
          peer.on('open', (id) => {
            socketRef.current.emit('join-room', { roomId, role, peerId: id });
          });
        }

        socketRef.current.on('peer:joined', ({ peerId }) => {
          console.log("Calling peer", peerId);
          setPartnerPeerId(peerId); // Store the peerId of the new person
          peer.call(peerId, stream);
        });

      }).catch(err => {
        console.error("Webcam error", err);
        peer.on('open', (id) => {
          socketRef.current.emit('join-room', { roomId, role, peerId: id });
        });
      });

    socketRef.current.on('provide:peerId', ({ requesterId }) => {
      socketRef.current.emit('submit:peerId', { requesterId, peerId: peerRef.current.id });
    });

    socketRef.current.on('peer:left', () => {
      setRemoteStream(null);
      setRemoteScreenStream(null);
      setPartnerPeerId(null);
    });

    return () => {
      socketRef.current.disconnect();
      peer.destroy();
    };
  }, [roomId, role]);

  // Attach streams to video elements
  useEffect(() => {
    if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (screenStream && localScreenRef.current) localScreenRef.current.srcObject = screenStream;
  }, [screenStream]);

  useEffect(() => {
    if (remoteScreenStream && remoteScreenRef.current) remoteScreenRef.current.srcObject = remoteScreenStream;
  }, [remoteScreenStream]);

  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenStream(stream);
      
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
      };

      if (partnerPeerId) {
        peerRef.current.call(partnerPeerId, stream, { metadata: { type: 'screen' } });
      } else {
        socketRef.current.emit('request:peerId', { roomId });
        socketRef.current.once('relay:peerId', ({ peerId }) => {
          peerRef.current.call(peerId, stream, { metadata: { type: 'screen' } });
        });
      }

    } catch (err) {
      console.error("Screen share error", err);
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#fff', overflow: 'hidden' }}>
      
      {/* Share Button */}
      {!screenStream && !remoteScreenStream && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
          <button 
            onClick={shareScreen}
            style={{ padding: '20px 40px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', background: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', boxShadow: '0 4px 15px rgba(39,174,96,0.3)' }}
          >
            Start Screen Sharing
          </button>
        </div>
      )}

      {/* Screen Sharing View */}
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isFullScreen ? '0' : '40px' }}>
        <div style={{ 
          width: isFullScreen ? '100%' : '85%', 
          height: isFullScreen ? '100%' : '85%', 
          background: '#000', 
          borderRadius: isFullScreen ? '0' : '10px', 
          overflow: 'hidden', 
          boxShadow: isFullScreen ? 'none' : '0 10px 30px rgba(0,0,0,0.1)',
          position: 'relative',
          display: (screenStream || remoteScreenStream) ? 'block' : 'none'
        }}>
          {screenStream && (
            <video ref={localScreenRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          )}
          {remoteScreenStream && (
            <video ref={remoteScreenRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          )}
          <button 
            onClick={() => setIsFullScreen(!isFullScreen)}
            style={{ position: 'absolute', bottom: '20px', right: '20px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: '10px', color: 'white', cursor: 'pointer' }}
          >
            {isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          {screenStream && (
            <button 
              onClick={() => { screenStream.getTracks().forEach(t => t.stop()); setScreenStream(null); }}
              style={{ position: 'absolute', top: '20px', right: '20px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '5px', padding: '5px 12px', cursor: 'pointer', fontSize: '12px' }}
            >
              Stop Sharing
            </button>
          )}
        </div>
      </div>

      {/* PIP Webcams */}
      <Draggable nodeRef={nodeRef}>
        <div ref={nodeRef} style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '15px', zIndex: 100, cursor: 'move' }}>
          
          <div style={{ width: '200px', height: '150px', background: '#f0f0f0', borderRadius: '12px', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', position: 'relative' }}>
            <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: '5px', alignItems: 'center' }}>
              <span style={{ color: 'white', fontSize: '11px', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px' }}>You</span>
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '4px', padding: '2px', color: 'white', cursor: 'pointer' }}>
                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>
          </div>

          <div style={{ width: '200px', height: '150px', background: '#f0f0f0', borderRadius: '12px', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', position: 'relative' }}>
            <video ref={remoteVideoRef} autoPlay playsInline muted={isPartnerMuted} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: '5px', alignItems: 'center' }}>
              <span style={{ color: 'white', fontSize: '11px', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px' }}>Partner</span>
              <button onClick={(e) => { e.stopPropagation(); setIsPartnerMuted(!isPartnerMuted); }} style={{ background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '4px', padding: '2px', color: 'white', cursor: 'pointer' }}>
                {isPartnerMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>
          </div>

        </div>
      </Draggable>
    </div>
  );
}

export default Room;
