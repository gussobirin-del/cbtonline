import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { cbtStore } from './server/store.ts';
import type {
  ActivityEvent,
  BroadcastNotice,
  CbtStateSnapshot,
  Exam,
  ExamAttempt,
  LiveSession,
  MajorConfig,
  Question,
  SessionRole,
  Student,
  UserAccount,
  UserRole,
  WsServerMessage,
} from './src/types/cbt.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json({ limit: '2mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientConnection {
  ws: WebSocket;
  session: LiveSession;
}

const connectedClients = new Map<string, ClientConnection>();

function listLiveSessions(): LiveSession[] {
  return Array.from(connectedClients.values()).map((c) => c.session);
}

function broadcastWs(message: WsServerMessage) {
  const serialized = JSON.stringify(message);
  for (const { ws } of connectedClients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(serialized);
    }
  }
}

function recordAndBroadcastActivity(
  partial: Omit<ActivityEvent, 'id' | 'timestamp'>
): ActivityEvent {
  const event: ActivityEvent = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...partial,
  };
  cbtStore.pushActivity(event);
  broadcastWs({ type: 'activity:new', payload: event });
  return event;
}

function computeAttemptScore(exam: Exam, attempt: ExamAttempt): { score: number; maxScore: number } {
  let earned = 0;
  let maxScore = 0;

  for (const q of exam.questions) {
    maxScore += q.points;
    if (q.type === 'pg') {
      const chosen = attempt.answers[q.id];
      if (typeof chosen === 'number' && chosen === q.correctIndex) {
        earned += q.points;
      }
    } else if (q.type === 'esai') {
      const manual = attempt.essayScores[q.id];
      if (typeof manual === 'number') {
        earned += Math.max(0, Math.min(q.points, manual));
      }
    }
  }

  return {
    score: maxScore > 0 ? Math.round((earned / maxScore) * 100) : 0,
    maxScore: 100,
  };
}

function buildSnapshot(): CbtStateSnapshot {
  return {
    exams: cbtStore.getExams(),
    students: cbtStore.getStudents(),
    users: cbtStore.getPublicUsers(),
    majors: cbtStore.getMajors(),
    attempts: cbtStore.getAttempts(),
    liveSessions: listLiveSessions(),
    activities: cbtStore.getActivities(),
    latestBroadcast: cbtStore.getLatestBroadcast(),
  };
}

function syncStudentSessionStatus(
  studentId: string,
  updater: (session: LiveSession) => LiveSession
) {
  let changed = false;
  for (const [cid, conn] of connectedClients.entries()) {
    if (conn.session.role === 'siswa' && conn.session.userId === studentId) {
      conn.session = updater(conn.session);
      connectedClients.set(cid, conn);
      changed = true;
    }
  }
  if (changed) {
    broadcastWs({ type: 'presence:update', payload: listLiveSessions() });
  }
}

wss.on('connection', (ws, req) => {
  const clientId = `cli-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const rawIp =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';
  const ip = rawIp.replace('::ffff:', '');
  const ua = (req.headers['user-agent'] || 'Browser').slice(0, 60);
  const nowIso = new Date().toISOString();

  const initialSession: LiveSession = {
    clientId,
    role: 'admin',
    userId: 'admin-system',
    userName: 'Admin Sistem',
    userCode: 'ADMIN',
    kelas: 'Ruang Server',
    activeExamId: null,
    activeExamTitle: null,
    activeAttemptId: null,
    currentView: 'Memuat...',
    status: 'Online',
    ip,
    device: ua.includes('Mobile') ? 'Perangkat Mobile' : 'Desktop Browser',
    connectedAt: nowIso,
    lastSeenAt: nowIso,
  };

  connectedClients.set(clientId, { ws, session: initialSession });

  const initMsg: WsServerMessage = {
    type: 'state:init',
    payload: buildSnapshot(),
  };
  ws.send(JSON.stringify(initMsg));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        type: string;
        payload?: Record<string, unknown>;
      };
      const conn = connectedClients.get(clientId);
      if (!conn) return;

      if (msg.type === 'session:register' && msg.payload) {
        const p = msg.payload;
        const validRoles: SessionRole[] = ['admin', 'guru', 'siswa', 'karyawan'];
        const role: SessionRole = validRoles.includes(p.role as SessionRole)
          ? (p.role as SessionRole)
          : 'siswa';
        const prevUserId = conn.session.userId;
        const prevRole = conn.session.role;
        const nextUserId = String(p.userId || clientId);
        const nextName = String(p.userName || 'Pengguna');

        conn.session = {
          ...conn.session,
          role,
          userId: nextUserId,
          userName: nextName,
          userCode: String(p.userCode || '-'),
          kelas: String(p.kelas || '-'),
          activeExamId: p.activeExamId ? String(p.activeExamId) : null,
          activeExamTitle: p.activeExamTitle ? String(p.activeExamTitle) : null,
          activeAttemptId: p.activeAttemptId ? String(p.activeAttemptId) : null,
          currentView: String(p.currentView || 'Portal CBT'),
          status:
            p.status === 'Mengerjakan Ujian' ||
            p.status === 'Fokus Hilang' ||
            p.status === 'Terkunci'
              ? p.status
              : 'Online',
          lastSeenAt: new Date().toISOString(),
        };
        connectedClients.set(clientId, conn);
        broadcastWs({ type: 'presence:update', payload: listLiveSessions() });

        if (
          nextUserId !== 'guest-unauthenticated' &&
          (prevUserId !== nextUserId || prevRole !== role)
        ) {
          recordAndBroadcastActivity({
            type: 'koneksi',
            actorName: conn.session.userName,
            actorRole: conn.session.role,
            actorMeta: `${conn.session.userCode} · ${conn.session.kelas}`,
            message: `Terhubung sebagai ${role.toUpperCase()} (${conn.session.currentView})`,
            examTitle: conn.session.activeExamTitle,
          });
        }
      } else if (msg.type === 'session:heartbeat' && msg.payload) {
        const p = msg.payload;
        conn.session = {
          ...conn.session,
          currentView: p.currentView ? String(p.currentView) : conn.session.currentView,
          status:
            p.status === 'Online' ||
            p.status === 'Mengerjakan Ujian' ||
            p.status === 'Fokus Hilang' ||
            p.status === 'Terkunci'
              ? p.status
              : conn.session.status,
          lastSeenAt: new Date().toISOString(),
        };
        connectedClients.set(clientId, conn);
        broadcastWs({ type: 'presence:update', payload: listLiveSessions() });
      }
    } catch (err) {
      console.error('WebSocket message parse error:', err);
    }
  });

  ws.on('close', () => {
    const conn = connectedClients.get(clientId);
    connectedClients.delete(clientId);
    broadcastWs({ type: 'presence:update', payload: listLiveSessions() });
    if (conn && conn.session.userId !== 'guest-unauthenticated') {
      recordAndBroadcastActivity({
        type: 'koneksi',
        actorName: conn.session.userName,
        actorRole: conn.session.role,
        actorMeta: `${conn.session.userCode} · ${conn.session.kelas}`,
        message: 'Koneksi WebSocket terputus / menutup sesi',
        examTitle: conn.session.activeExamTitle,
      });
    }
  });
});

// --- REST API ---

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, connectedClients: connectedClients.size });
});

app.get('/api/state', (_req, res) => {
  res.json(buildSnapshot());
});

// --- Multi-Role Auth & Admin User/Password Management ---

app.post('/api/auth/login', (req, res) => {
  const { role, identifier, password } = req.body as {
    role?: UserRole;
    identifier?: string;
    password?: string;
  };
  const validRoles: UserRole[] = ['admin', 'guru', 'siswa', 'karyawan'];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: 'Pilih peran pengguna yang valid.' });
    return;
  }
  if (!identifier?.trim() || !password) {
    res.status(400).json({ error: 'Username/NIS dan Password wajib diisi.' });
    return;
  }

  const result = cbtStore.authenticateUser(role, identifier, password);
  if (!result.user) {
    res.status(401).json({ error: result.error || 'Kredensial tidak valid.' });
    return;
  }

  const { password: _pw, ...publicUser } = result.user;

  recordAndBroadcastActivity({
    type: 'koneksi',
    actorName: publicUser.name,
    actorRole: publicUser.role,
    actorMeta: `${publicUser.username} · ${publicUser.unit}`,
    message: `Login berhasil sebagai ${publicUser.role.toUpperCase()}`,
    examTitle: null,
  });

  res.json({ user: publicUser });
});

app.get('/api/admin/users', (_req, res) => {
  res.json({ users: cbtStore.getUsers() });
});

app.post('/api/admin/users', (req, res) => {
  const body = req.body as Partial<UserAccount>;
  const validRoles: UserRole[] = ['admin', 'guru', 'siswa', 'karyawan'];
  if (!body.role || !validRoles.includes(body.role)) {
    res.status(400).json({ error: 'Peran pengguna tidak valid.' });
    return;
  }
  if (!body.username?.trim() || !body.name?.trim() || !body.password) {
    res.status(400).json({ error: 'Username/NIS, Nama Lengkap, dan Password wajib diisi.' });
    return;
  }
  if (cbtStore.findUserByUsername(body.username)) {
    res.status(409).json({ error: 'Username / NIS sudah terdaftar di sistem.' });
    return;
  }

  const user: UserAccount = {
    id: `usr-${body.role}-${Date.now().toString(36)}`,
    role: body.role,
    username: body.username.trim(),
    password: body.password,
    name: body.name.trim(),
    unit: body.unit?.trim() || (body.role === 'siswa' ? 'XII TKJ 1' : body.role.toUpperCase()),
    jurusan: body.jurusan || (body.role === 'siswa' ? 'TKJ' : undefined),
    gradeLevel: body.gradeLevel || (body.role === 'siswa' ? 'XII' : undefined),
    isActive: body.isActive !== false,
    createdAt: new Date().toISOString(),
  };

  cbtStore.createUser(user);
  broadcastWs({ type: 'users:sync', payload: cbtStore.getPublicUsers() });
  broadcastWs({ type: 'students:sync', payload: cbtStore.getStudents() });
  recordAndBroadcastActivity({
    type: 'admin',
    actorName: 'Admin Sistem',
    actorRole: 'admin',
    actorMeta: 'Manajemen User',
    message: `Membuat akun ${user.role.toUpperCase()} baru: ${user.name} (${user.username})`,
    examTitle: null,
  });

  res.status(201).json({ user });
});

app.patch('/api/admin/users/:id', (req, res) => {
  const body = req.body as Partial<UserAccount>;
  const existing = cbtStore.findUserById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }

  if (
    body.username &&
    body.username.trim().toLowerCase() !== existing.username.toLowerCase() &&
    cbtStore.findUserByUsername(body.username)
  ) {
    res.status(409).json({ error: 'Username / NIS tersebut sudah dipakai pengguna lain.' });
    return;
  }

  const updated = cbtStore.updateUser(req.params.id, {
    role: body.role ?? existing.role,
    username: body.username?.trim() ?? existing.username,
    name: body.name?.trim() ?? existing.name,
    unit: body.unit?.trim() ?? existing.unit,
    jurusan: body.jurusan ?? existing.jurusan,
    gradeLevel: body.gradeLevel ?? existing.gradeLevel,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : existing.isActive,
  });

  if (!updated) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }

  broadcastWs({ type: 'users:sync', payload: cbtStore.getPublicUsers() });
  broadcastWs({ type: 'students:sync', payload: cbtStore.getStudents() });
  recordAndBroadcastActivity({
    type: 'admin',
    actorName: 'Admin Sistem',
    actorRole: 'admin',
    actorMeta: 'Manajemen User',
    message: `Memperbarui data akun ${updated.name} (${updated.role.toUpperCase()} · ${updated.isActive ? 'Aktif' : 'Nonaktif'})`,
    examTitle: null,
  });

  res.json({ user: updated });
});

app.patch('/api/admin/users/:id/password', (req, res) => {
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 3) {
    res.status(400).json({ error: 'Password baru minimal 3 karakter.' });
    return;
  }

  const updated = cbtStore.updateUserPassword(req.params.id, newPassword);
  if (!updated) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }

  broadcastWs({ type: 'users:sync', payload: cbtStore.getPublicUsers() });
  broadcastWs({ type: 'students:sync', payload: cbtStore.getStudents() });
  recordAndBroadcastActivity({
    type: 'admin',
    actorName: 'Admin Sistem',
    actorRole: 'admin',
    actorMeta: 'Keamanan Akun',
    message: `Mengubah password untuk ${updated.name} (${updated.role.toUpperCase()} · ${updated.username})`,
    examTitle: null,
  });

  res.json({ user: updated });
});

app.delete('/api/admin/users/:id', (req, res) => {
  const existing = cbtStore.findUserById(req.params.id);
  const ok = cbtStore.deleteUser(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    return;
  }

  broadcastWs({ type: 'users:sync', payload: cbtStore.getPublicUsers() });
  broadcastWs({ type: 'students:sync', payload: cbtStore.getStudents() });
  if (existing) {
    recordAndBroadcastActivity({
      type: 'admin',
      actorName: 'Admin Sistem',
      actorRole: 'admin',
      actorMeta: 'Manajemen User',
      message: `Menghapus akun ${existing.name} (${existing.role.toUpperCase()})`,
      examTitle: null,
    });
  }
  res.json({ deleted: true });
});

app.put('/api/admin/majors', (req, res) => {
  const { majors } = req.body as { majors?: MajorConfig[] };
  if (!Array.isArray(majors) || majors.length === 0) {
    res.status(400).json({ error: 'Minimal harus terdapat satu jurusan aktif.' });
    return;
  }

  const normalized: MajorConfig[] = [];
  const seen = new Set<string>();
  for (const m of majors) {
    const code = (m.code || '').trim().toUpperCase();
    const name = (m.name || '').trim();
    if (!code) {
      res.status(400).json({ error: 'Kode singkatan jurusan tidak boleh kosong.' });
      return;
    }
    if (seen.has(code)) {
      res.status(400).json({ error: `Kode jurusan "${code}" terduplikasi.` });
      return;
    }
    seen.add(code);
    normalized.push({ code, name: name || code });
  }

  const saved = cbtStore.setMajors(normalized);
  broadcastWs({ type: 'majors:sync', payload: saved });
  recordAndBroadcastActivity({
    type: 'admin',
    actorName: 'Admin Sistem',
    actorRole: 'admin',
    actorMeta: 'Pengaturan Jurusan',
    message: `Menyimpan daftar jurusan: ${saved.map((m) => m.code).join(', ')}`,
    examTitle: null,
  });
  res.json({ majors: saved });
});

app.post('/api/exams', (req, res) => {
  const body = req.body as Partial<Exam>;
  if (!body.title || !body.subject) {
    res.status(400).json({ error: 'Judul ujian dan mata pelajaran wajib diisi.' });
    return;
  }

  const category = body.category === 'PAS' ? 'PAS' : 'PTS';
  const generatedToken =
    body.token?.trim().toUpperCase() ||
    `MEDINA-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const exam: Exam = {
    id: `${category}-${Date.now().toString(36).toUpperCase()}`,
    title: body.title.trim(),
    category,
    semester: body.semester || 'Ganjil',
    academicYear: body.academicYear || '2026/2027',
    subject: body.subject.trim(),
    gradeLevel: body.gradeLevel || 'XII',
    majors: Array.isArray(body.majors) && body.majors.length > 0 ? body.majors : ['TKJ', 'RPL'],
    durationMinutes: Number(body.durationMinutes) || 60,
    token: generatedToken,
    status: body.status || 'Aktif',
    maxViolations: Number(body.maxViolations) || 3,
    shuffleQuestions: Boolean(body.shuffleQuestions),
    showResultToStudent: body.showResultToStudent !== false,
    scheduledAt: body.scheduledAt || new Date().toISOString().slice(0, 16),
    createdAt: new Date().toISOString(),
    questions: Array.isArray(body.questions) ? body.questions : [],
  };

  cbtStore.createExam(exam);
  broadcastWs({ type: 'exam:updated', payload: cbtStore.getExams() });
  recordAndBroadcastActivity({
    type: 'admin',
    actorName: 'Admin Sistem',
    actorRole: 'admin',
    actorMeta: 'Manajemen Ujian',
    message: `Membuat ujian ${exam.category}: ${exam.title} (Token: ${exam.token})`,
    examTitle: exam.title,
  });

  res.status(201).json(exam);
});

app.patch('/api/exams/:id', (req, res) => {
  const { id } = req.params;
  const patch = req.body as Partial<Exam>;
  const updated = cbtStore.updateExam(id, patch);
  if (!updated) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }

  broadcastWs({ type: 'exam:updated', payload: cbtStore.getExams() });
  recordAndBroadcastActivity({
    type: 'admin',
    actorName: 'Admin Sistem',
    actorRole: 'admin',
    actorMeta: 'Manajemen Ujian',
    message: `Memperbarui pengaturan ujian (${updated.status} · Token: ${updated.token})`,
    examTitle: updated.title,
  });
  res.json(updated);
});

app.delete('/api/exams/:id', (req, res) => {
  const existing = cbtStore.getExamById(req.params.id);
  const removed = cbtStore.deleteExam(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }

  broadcastWs({ type: 'exam:updated', payload: cbtStore.getExams() });
  if (existing) {
    recordAndBroadcastActivity({
      type: 'admin',
      actorName: 'Admin Sistem',
      actorRole: 'admin',
      actorMeta: 'Manajemen Ujian',
      message: `Menghapus ujian ${existing.title}`,
      examTitle: existing.title,
    });
  }
  res.json({ deleted: true });
});

app.post('/api/exams/:id/questions', (req, res) => {
  const exam = cbtStore.getExamById(req.params.id);
  if (!exam) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }

  const body = req.body as Partial<Question>;
  if (!body.prompt?.trim()) {
    res.status(400).json({ error: 'Teks soal wajib diisi.' });
    return;
  }

  const question: Question = {
    id: `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    type: body.type === 'esai' ? 'esai' : 'pg',
    prompt: body.prompt.trim(),
    options:
      body.type === 'esai'
        ? []
        : Array.isArray(body.options) && body.options.length >= 2
          ? body.options
          : ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E'],
    correctIndex: Number(body.correctIndex) || 0,
    points: Number(body.points) || 10,
  };

  const nextQuestions = [...exam.questions, question];
  const updated = cbtStore.updateExam(exam.id, { questions: nextQuestions });
  broadcastWs({ type: 'exam:updated', payload: cbtStore.getExams() });
  res.status(201).json(updated);
});

app.delete('/api/exams/:id/questions/:qid', (req, res) => {
  const exam = cbtStore.getExamById(req.params.id);
  if (!exam) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }

  const nextQuestions = exam.questions.filter((q) => q.id !== req.params.qid);
  const updated = cbtStore.updateExam(exam.id, { questions: nextQuestions });
  broadcastWs({ type: 'exam:updated', payload: cbtStore.getExams() });
  res.json(updated);
});

app.post('/api/students', (req, res) => {
  const body = req.body as Partial<Student>;
  if (!body.nis || !body.name || !body.kelas) {
    res.status(400).json({ error: 'NIS, Nama Lengkap, dan Kelas wajib diisi.' });
    return;
  }
  if (cbtStore.findStudentByNis(body.nis)) {
    res.status(409).json({ error: 'NIS sudah terdaftar di sistem.' });
    return;
  }

  const student: Student = {
    id: `stu-${Date.now().toString(36)}`,
    nis: body.nis.trim(),
    name: body.name.trim(),
    kelas: body.kelas.trim(),
    jurusan: body.jurusan || 'TKJ',
    gradeLevel: body.gradeLevel || 'XII',
    pin: body.pin?.trim() || '123456',
  };

  cbtStore.addStudent(student);
  broadcastWs({ type: 'students:sync', payload: cbtStore.getStudents() });
  recordAndBroadcastActivity({
    type: 'admin',
    actorName: 'Admin Sistem',
    actorRole: 'admin',
    actorMeta: 'Data Peserta',
    message: `Menambahkan peserta baru: ${student.name} (${student.kelas})`,
    examTitle: null,
  });
  res.status(201).json(student);
});

app.delete('/api/students/:id', (req, res) => {
  const ok = cbtStore.deleteStudent(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Siswa tidak ditemukan.' });
    return;
  }
  broadcastWs({ type: 'students:sync', payload: cbtStore.getStudents() });
  res.json({ deleted: true });
});

// --- Student CBT Exam Flow ---

app.post('/api/student/login', (req, res) => {
  const { nis, pin } = req.body as { nis?: string; pin?: string };
  if (!nis || !pin) {
    res.status(400).json({ error: 'Masukkan NIS dan PIN Ujian.' });
    return;
  }
  const student = cbtStore.findStudentByNis(nis);
  if (!student || student.pin !== pin.trim()) {
    res.status(401).json({ error: 'NIS atau PIN tidak valid. Periksa kembali kartu peserta.' });
    return;
  }

  recordAndBroadcastActivity({
    type: 'koneksi',
    actorName: student.name,
    actorRole: 'siswa',
    actorMeta: `${student.nis} · ${student.kelas}`,
    message: 'Login berhasil ke Portal Ujian Siswa SMK Medina Bandung',
    examTitle: null,
  });

  res.json({ student });
});

app.post('/api/student/start-exam', (req, res) => {
  const { examId, studentId, token } = req.body as {
    examId?: string;
    studentId?: string;
    token?: string;
  };
  const exam = examId ? cbtStore.getExamById(examId) : undefined;
  const student = cbtStore.getStudents().find((s) => s.id === studentId);

  if (!exam || !student) {
    res.status(404).json({ error: 'Ujian atau data siswa tidak ditemukan.' });
    return;
  }
  if (exam.status !== 'Aktif') {
    res.status(403).json({ error: `Ujian berstatus "${exam.status}" dan belum dibuka.` });
    return;
  }
  if (!token || token.trim().toUpperCase() !== exam.token.toUpperCase()) {
    res.status(401).json({ error: 'Token ujian tidak sesuai. Hubungi pengawas ruang.' });
    return;
  }
  if (exam.questions.length === 0) {
    res.status(400).json({ error: 'Bank soal ujian ini masih kosong.' });
    return;
  }

  let attempt = cbtStore.findActiveAttempt(exam.id, student.id);
  const isResumed = Boolean(attempt);
  if (!attempt) {
    attempt = {
      id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      examId: exam.id,
      examTitle: exam.title,
      examCategory: exam.category,
      studentId: student.id,
      studentNis: student.nis,
      studentName: student.name,
      studentKelas: student.kelas,
      answers: {},
      essayScores: {},
      flaggedQuestionIds: [],
      currentQuestionIndex: 0,
      answeredCount: 0,
      totalQuestions: exam.questions.length,
      violations: 0,
      maxViolations: exam.maxViolations,
      status: 'Sedang Ujian',
      score: null,
      maxScore: 100,
      startedAt: new Date().toISOString(),
      submittedAt: null,
      lastActivityAt: new Date().toISOString(),
    };
    cbtStore.upsertAttempt(attempt);
  }

  syncStudentSessionStatus(student.id, (s) => ({
    ...s,
    activeExamId: exam.id,
    activeExamTitle: exam.title,
    activeAttemptId: attempt!.id,
    currentView: `Mengerjakan ${exam.category}`,
    status: attempt!.status === 'Terkunci Pelanggaran' ? 'Terkunci' : 'Mengerjakan Ujian',
    lastSeenAt: new Date().toISOString(),
  }));

  broadcastWs({ type: 'attempt:updated', payload: attempt });
  recordAndBroadcastActivity({
    type: 'ujian',
    actorName: student.name,
    actorRole: 'siswa',
    actorMeta: `${student.nis} · ${student.kelas}`,
    message: isResumed ? 'Melanjutkan sesi ujian aktif' : 'Memulai sesi ujian dengan token valid',
    examTitle: exam.title,
  });

  res.json({ attempt, exam });
});

app.post('/api/student/answer', (req, res) => {
  const { attemptId, questionId, answer, flagged, currentQuestionIndex } = req.body as {
    attemptId?: string;
    questionId?: string;
    answer?: string | number;
    flagged?: boolean;
    currentQuestionIndex?: number;
  };

  const attempt = attemptId ? cbtStore.getAttemptById(attemptId) : undefined;
  if (!attempt) {
    res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });
    return;
  }
  if (attempt.status !== 'Sedang Ujian') {
    res.status(403).json({ error: `Sesi ujian berstatus ${attempt.status}.` });
    return;
  }

  const nextAnswers = { ...attempt.answers };
  if (questionId && answer !== undefined) {
    if (answer === '' || answer === null) {
      delete nextAnswers[questionId];
    } else {
      nextAnswers[questionId] = answer;
    }
  }

  let nextFlagged = [...attempt.flaggedQuestionIds];
  if (questionId && typeof flagged === 'boolean') {
    if (flagged && !nextFlagged.includes(questionId)) {
      nextFlagged.push(questionId);
    } else if (!flagged) {
      nextFlagged = nextFlagged.filter((id) => id !== questionId);
    }
  }

  const answeredCount = Object.keys(nextAnswers).filter((k) => {
    const v = nextAnswers[k];
    return v !== '' && v !== null && v !== undefined;
  }).length;

  const updated: ExamAttempt = {
    ...attempt,
    answers: nextAnswers,
    flaggedQuestionIds: nextFlagged,
    currentQuestionIndex:
      typeof currentQuestionIndex === 'number'
        ? currentQuestionIndex
        : attempt.currentQuestionIndex,
    answeredCount,
    lastActivityAt: new Date().toISOString(),
  };

  cbtStore.upsertAttempt(updated);
  broadcastWs({ type: 'attempt:updated', payload: updated });

  if (questionId && answer !== undefined) {
    const qNum =
      typeof currentQuestionIndex === 'number' ? currentQuestionIndex + 1 : updated.answeredCount;
    recordAndBroadcastActivity({
      type: 'ujian',
      actorName: attempt.studentName,
      actorRole: 'siswa',
      actorMeta: `${attempt.studentNis} · ${attempt.studentKelas}`,
      message: `Menyimpan jawaban soal #${qNum} (Progres: ${updated.answeredCount}/${updated.totalQuestions})`,
      examTitle: attempt.examTitle,
    });
  }

  res.json({ attempt: updated });
});

app.post('/api/student/violation', (req, res) => {
  const { attemptId, reason } = req.body as { attemptId?: string; reason?: string };
  const attempt = attemptId ? cbtStore.getAttemptById(attemptId) : undefined;
  if (!attempt || attempt.status === 'Selesai' || attempt.status === 'Dipaksa Selesai') {
    res.status(404).json({ error: 'Sesi aktif tidak ditemukan.' });
    return;
  }

  const nextViolations = attempt.violations + 1;
  const locked = nextViolations >= attempt.maxViolations;

  const updated: ExamAttempt = {
    ...attempt,
    violations: nextViolations,
    status: locked ? 'Terkunci Pelanggaran' : 'Sedang Ujian',
    lastActivityAt: new Date().toISOString(),
  };

  cbtStore.upsertAttempt(updated);
  syncStudentSessionStatus(attempt.studentId, (s) => ({
    ...s,
    status: locked ? 'Terkunci' : 'Fokus Hilang',
    lastSeenAt: new Date().toISOString(),
  }));

  broadcastWs({ type: 'attempt:updated', payload: updated });
  recordAndBroadcastActivity({
    type: 'pelanggaran',
    actorName: attempt.studentName,
    actorRole: 'siswa',
    actorMeta: `${attempt.studentNis} · ${attempt.studentKelas}`,
    message: `${reason || 'Berpindah tab / kehilangan fokus layar ujian'} (${nextViolations}/${attempt.maxViolations})${locked ? ' — SESI TERKUNCI' : ''}`,
    examTitle: attempt.examTitle,
  });

  res.json({ attempt: updated });
});

app.post('/api/student/submit', (req, res) => {
  const { attemptId } = req.body as { attemptId?: string };
  const attempt = attemptId ? cbtStore.getAttemptById(attemptId) : undefined;
  if (!attempt) {
    res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });
    return;
  }

  const exam = cbtStore.getExamById(attempt.examId);
  const { score, maxScore } = exam
    ? computeAttemptScore(exam, attempt)
    : { score: 0, maxScore: 100 };

  const updated: ExamAttempt = {
    ...attempt,
    status: 'Selesai',
    score,
    maxScore,
    submittedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  };

  cbtStore.upsertAttempt(updated);
  syncStudentSessionStatus(attempt.studentId, (s) => ({
    ...s,
    activeExamId: null,
    activeExamTitle: null,
    activeAttemptId: null,
    currentView: 'Selesai Ujian',
    status: 'Online',
    lastSeenAt: new Date().toISOString(),
  }));

  broadcastWs({ type: 'attempt:updated', payload: updated });
  recordAndBroadcastActivity({
    type: 'ujian',
    actorName: attempt.studentName,
    actorRole: 'siswa',
    actorMeta: `${attempt.studentNis} · ${attempt.studentKelas}`,
    message: `Mengumpulkan ujian (Skor otomatis: ${score}/${maxScore})`,
    examTitle: attempt.examTitle,
  });

  res.json({ attempt: updated });
});

// --- Admin Live Intervention Endpoints ---

app.post('/api/admin/force-submit/:attemptId', (req, res) => {
  const attempt = cbtStore.getAttemptById(req.params.attemptId);
  if (!attempt) {
    res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });
    return;
  }

  const exam = cbtStore.getExamById(attempt.examId);
  const { score, maxScore } = exam
    ? computeAttemptScore(exam, attempt)
    : { score: 0, maxScore: 100 };

  const updated: ExamAttempt = {
    ...attempt,
    status: 'Dipaksa Selesai',
    score,
    maxScore,
    submittedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  };

  cbtStore.upsertAttempt(updated);
  syncStudentSessionStatus(attempt.studentId, (s) => ({
    ...s,
    activeExamId: null,
    activeExamTitle: null,
    activeAttemptId: null,
    currentView: 'Dihentikan Admin',
    status: 'Online',
    lastSeenAt: new Date().toISOString(),
  }));

  broadcastWs({ type: 'attempt:updated', payload: updated });
  recordAndBroadcastActivity({
    type: 'admin',
    actorName: 'Admin Sistem',
    actorRole: 'admin',
    actorMeta: 'Intervensi Live',
    message: `Memaksa selesai ujian ${attempt.studentName} (${attempt.studentKelas}) — Skor: ${score}`,
    examTitle: attempt.examTitle,
  });

  res.json({ attempt: updated });
});

app.post('/api/admin/unlock-violation/:attemptId', (req, res) => {
  const attempt = cbtStore.getAttemptById(req.params.attemptId);
  if (!attempt) {
    res.status(404).json({ error: 'Sesi ujian tidak ditemukan.' });
    return;
  }

  const updated: ExamAttempt = {
    ...attempt,
    violations: 0,
    status: 'Sedang Ujian',
    lastActivityAt: new Date().toISOString(),
  };

  cbtStore.upsertAttempt(updated);
  syncStudentSessionStatus(attempt.studentId, (s) => ({
    ...s,
    status: 'Mengerjakan Ujian',
    lastSeenAt: new Date().toISOString(),
  }));

  broadcastWs({ type: 'attempt:updated', payload: updated });
  recordAndBroadcastActivity({
    type: 'admin',
    actorName: 'Admin Sistem',
    actorRole: 'admin',
    actorMeta: 'Intervensi Live',
    message: `Membuka kunci pelanggaran & mereset hitungan pelanggaran ${attempt.studentName}`,
    examTitle: attempt.examTitle,
  });

  res.json({ attempt: updated });
});

app.post('/api/admin/grade-essay/:attemptId', (req, res) => {
  const attempt = cbtStore.getAttemptById(req.params.attemptId);
  if (!attempt) {
    res.status(404).json({ error: 'Hasil ujian tidak ditemukan.' });
    return;
  }
  const exam = cbtStore.getExamById(attempt.examId);
  if (!exam) {
    res.status(404).json({ error: 'Ujian tidak ditemukan.' });
    return;
  }

  const { essayScores } = req.body as { essayScores?: Record<string, number> };
  const mergedAttempt: ExamAttempt = {
    ...attempt,
    essayScores: { ...attempt.essayScores, ...(essayScores || {}) },
  };
  const { score, maxScore } = computeAttemptScore(exam, mergedAttempt);
  mergedAttempt.score = score;
  mergedAttempt.maxScore = maxScore;

  cbtStore.upsertAttempt(mergedAttempt);
  broadcastWs({ type: 'attempt:updated', payload: mergedAttempt });
  res.json({ attempt: mergedAttempt });
});

app.post('/api/admin/broadcast', (req, res) => {
  const { message, targetExamId } = req.body as { message?: string; targetExamId?: string | null };
  if (!message?.trim()) {
    res.status(400).json({ error: 'Pesan pengumuman tidak boleh kosong.' });
    return;
  }

  const notice: BroadcastNotice = {
    id: `bc-${Date.now()}`,
    message: message.trim(),
    sentBy: 'Admin Sistem — SMK Medina Bandung',
    sentAt: new Date().toISOString(),
    targetExamId: targetExamId || null,
  };

  cbtStore.setLatestBroadcast(notice);
  broadcastWs({ type: 'broadcast:notice', payload: notice });
  recordAndBroadcastActivity({
    type: 'admin',
    actorName: 'Admin Sistem',
    actorRole: 'admin',
    actorMeta: 'Pengumuman Live',
    message: `Mengirim pengumuman ke seluruh peserta aktif: "${notice.message}"`,
    examTitle: null,
  });

  res.status(201).json(notice);
});

app.get('/api/export/results/:examId', (req, res) => {
  const examId = req.params.examId;
  const attempts = cbtStore
    .getAttempts()
    .filter((a) => (examId === 'all' ? true : a.examId === examId));

  const header = ['NIS', 'Nama Siswa', 'Kelas', 'Ujian', 'Kategori', 'Status', 'Dijawab', 'Pelanggaran', 'Nilai', 'Waktu Kumpul'];
  const rows = attempts.map((a) => [
    a.studentNis,
    `"${a.studentName.replace(/"/g, '""')}"`,
    `"${a.studentKelas}"`,
    `"${a.examTitle.replace(/"/g, '""')}"`,
    a.examCategory,
    a.status,
    `${a.answeredCount}/${a.totalQuestions}`,
    `${a.violations}/${a.maxViolations}`,
    a.score ?? 0,
    a.submittedAt || '-',
  ]);

  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="rekap-nilai-cbt-medina-${examId}.csv"`);
  res.send('\uFEFF' + csv);
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SMK Medina Bandung CBT Server aktif di http://localhost:${PORT}`);
  });
}

startServer();
