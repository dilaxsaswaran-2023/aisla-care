import { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';
import { io, Socket } from 'socket.io-client';

interface UseWebRTCProps {
  recipientId: string;
  userId: string;
  onCallStarted?: () => void;
  onCallEnded?: () => void;
}

export const useWebRTC = ({ recipientId, userId, onCallStarted, onCallEnded }: UseWebRTCProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const peerRef = useRef<Peer.Instance | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to Socket.io server for WebRTC signaling
    const apiUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5030';
    const socket = io(apiUrl, {
      auth: { token: localStorage.getItem('aisla_access_token') || '' },
    });

    socket.on('connect', () => {
      socket.emit('join', userId);
    });

    socket.on('webrtc-signal', (payload: { signal: any; from: string; to: string }) => {
      if (payload.to === userId && peerRef.current) {
        peerRef.current.signal(payload.signal);
      }
    });

    socket.on('call-ended', (payload: { from: string; to: string }) => {
      if (payload.to === userId) {
        endCall();
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [userId, recipientId]);

  const startCall = async (initiator: boolean = true) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      
      setStream(mediaStream);
      setIsCallActive(true);
      onCallStarted?.();

      const peer = new Peer({
        initiator,
        stream: mediaStream,
        trickle: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ]
        }
      });

      peer.on('signal', (signal) => {
        socketRef.current?.emit('webrtc-signal', {
          signal,
          to: recipientId,
          from: userId,
        });
      });

      peer.on('stream', (remoteStream) => {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play();
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        endCall();
      });

      peerRef.current = peer;
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  };

  const endCall = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    socketRef.current?.emit('call-end', {
      to: recipientId,
      from: userId,
    });

    setIsCallActive(false);
    setIsMuted(false);
    onCallEnded?.();
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  return {
    stream,
    isCallActive,
    isMuted,
    startCall,
    endCall,
    toggleMute
  };
};
