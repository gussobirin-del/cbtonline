import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActivityEvent,
  BroadcastNotice,
  CbtStateSnapshot,
  Exam,
  ExamAttempt,
  LiveSession,
  MajorConfig,
  PublicUserAccount,
  SessionRole,
  SessionStatus,
  Student,
  WsServerMessage,
} from '../types/cbt.ts';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export interface SessionRegistration {
  role: SessionRole;
  userId: string;
  userName: string;
  userCode: string;
  kelas: string;
  activeExamId?: string | null;
  activeExamTitle?: string | null;
  activeAttemptId?: string | null;
  currentView: string;
  status?: SessionStatus;
}

export function useCbtSocket(registration: SessionRegistration) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [users, setUsers] = useState<PublicUserAccount[]>([]);
  const [majors, setMajors] = useState<MajorConfig[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [latestBroadcast, setLatestBroadcast] = useState<BroadcastNotice | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const registrationRef = useRef<SessionRegistration>(registration);
  registrationRef.current = registration;

  const sendRegister = useCallback((reg: SessionRegistration) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'session:register', payload: reg }));
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const applySnapshot = (snap: CbtStateSnapshot) => {
      setExams(snap.exams);
      setStudents(snap.students);
      setUsers(snap.users || []);
      setMajors(snap.majors || []);
      setAttempts(snap.attempts);
      setLiveSessions(snap.liveSessions);
      setActivities(snap.activities);
      setLatestBroadcast(snap.latestBroadcast);
      setIsLoaded(true);
    };

    const connect = () => {
      if (disposed) return;
      setConnectionState('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        setConnectionState('connected');
        ws.send(
          JSON.stringify({
            type: 'session:register',
            payload: registrationRef.current,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsServerMessage;
          switch (msg.type) {
            case 'state:init':
              applySnapshot(msg.payload);
              break;
            case 'presence:update':
              setLiveSessions(msg.payload);
              break;
            case 'activity:new':
              setActivities((prev) => {
                if (prev.some((a) => a.id === msg.payload.id)) return prev;
                return [msg.payload, ...prev].slice(0, 200);
              });
              break;
            case 'exam:updated':
              setExams(msg.payload);
              break;
            case 'attempt:updated':
              setAttempts((prev) => {
                const idx = prev.findIndex((a) => a.id === msg.payload.id);
                if (idx === -1) return [msg.payload, ...prev];
                const next = [...prev];
                next[idx] = msg.payload;
                return next;
              });
              break;
            case 'attempts:sync':
              setAttempts(msg.payload);
              break;
            case 'students:sync':
              setStudents(msg.payload);
              break;
            case 'users:sync':
              setUsers(msg.payload);
              break;
            case 'majors:sync':
              setMajors(msg.payload);
              break;
            case 'broadcast:notice':
              setLatestBroadcast(msg.payload);
              break;
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setConnectionState('disconnected');
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    // Fallback HTTP hydrate in case WS takes a moment
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((snap: CbtStateSnapshot | null) => {
        if (snap && !disposed) {
          applySnapshot(snap);
        }
      })
      .catch(() => {});

    connect();

    heartbeatTimer = setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'session:heartbeat',
            payload: {
              currentView: registrationRef.current.currentView,
              status: registrationRef.current.status,
            },
          })
        );
      }
    }, 15000);

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Re-register whenever active identity/view changes
  useEffect(() => {
    sendRegister(registration);
  }, [
    registration.role,
    registration.userId,
    registration.userName,
    registration.userCode,
    registration.kelas,
    registration.activeExamId,
    registration.activeAttemptId,
    registration.currentView,
    registration.status,
    sendRegister,
  ]);

  return {
    connectionState,
    isLoaded,
    exams,
    students,
    users,
    majors,
    attempts,
    liveSessions,
    activities,
    latestBroadcast,
    setExams,
    setStudents,
    setUsers,
    setAttempts,
    setLatestBroadcast,
  };
}
