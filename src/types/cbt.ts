export type ExamCategory = 'PTS' | 'PAS';
export type ExamStatus = 'Draf' | 'Terjadwal' | 'Aktif' | 'Selesai';
export type QuestionType = 'pg' | 'esai';

export type UserRole = 'admin' | 'guru' | 'siswa' | 'karyawan';

export interface UserAccount {
  id: string;
  role: UserRole;
  username: string; // NIS for siswa, NIP/username for guru/karyawan/admin
  password: string;
  name: string;
  unit: string; // e.g., 'XII TKJ 1', 'Mapel TKJ', 'Tata Usaha', 'Administrator IT'
  jurusan?: string;
  gradeLevel?: string;
  isActive: boolean;
  createdAt: string;
}

export type PublicUserAccount = Omit<UserAccount, 'password'>;

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
  points: number;
}

export interface Exam {
  id: string;
  title: string;
  category: ExamCategory;
  semester: string;
  academicYear: string;
  subject: string;
  gradeLevel: string;
  majors: string[];
  durationMinutes: number;
  token: string;
  status: ExamStatus;
  maxViolations: number;
  shuffleQuestions: boolean;
  showResultToStudent: boolean;
  scheduledAt: string;
  createdAt: string;
  questions: Question[];
}

export interface Student {
  id: string;
  nis: string;
  name: string;
  kelas: string;
  jurusan: string;
  gradeLevel: string;
  pin: string;
}

export type AttemptStatus =
  | 'Sedang Ujian'
  | 'Terkunci Pelanggaran'
  | 'Selesai'
  | 'Dipaksa Selesai';

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle: string;
  examCategory: ExamCategory;
  studentId: string;
  studentNis: string;
  studentName: string;
  studentKelas: string;
  answers: Record<string, string | number>;
  essayScores: Record<string, number>;
  flaggedQuestionIds: string[];
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
  violations: number;
  maxViolations: number;
  status: AttemptStatus;
  score: number | null;
  maxScore: number;
  startedAt: string;
  submittedAt: string | null;
  lastActivityAt: string;
}

export type SessionRole = UserRole;
export type SessionStatus =
  | 'Online'
  | 'Mengerjakan Ujian'
  | 'Fokus Hilang'
  | 'Terkunci';

export interface LiveSession {
  clientId: string;
  role: SessionRole;
  userId: string;
  userName: string;
  userCode: string;
  kelas: string;
  activeExamId: string | null;
  activeExamTitle: string | null;
  activeAttemptId: string | null;
  currentView: string;
  status: SessionStatus;
  ip: string;
  device: string;
  connectedAt: string;
  lastSeenAt: string;
}

export type ActivityEventType = 'koneksi' | 'ujian' | 'pelanggaran' | 'admin';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: ActivityEventType;
  actorName: string;
  actorRole: SessionRole;
  actorMeta: string;
  message: string;
  examTitle: string | null;
}

export interface BroadcastNotice {
  id: string;
  message: string;
  sentBy: string;
  sentAt: string;
  targetExamId: string | null;
}

export interface MajorConfig {
  code: string;
  name: string;
}

export interface CbtStateSnapshot {
  exams: Exam[];
  students: Student[];
  users: PublicUserAccount[];
  majors: MajorConfig[];
  attempts: ExamAttempt[];
  liveSessions: LiveSession[];
  activities: ActivityEvent[];
  latestBroadcast: BroadcastNotice | null;
}

export type WsServerMessage =
  | { type: 'state:init'; payload: CbtStateSnapshot }
  | { type: 'presence:update'; payload: LiveSession[] }
  | { type: 'activity:new'; payload: ActivityEvent }
  | { type: 'exam:updated'; payload: Exam[] }
  | { type: 'attempt:updated'; payload: ExamAttempt }
  | { type: 'attempts:sync'; payload: ExamAttempt[] }
  | { type: 'students:sync'; payload: Student[] }
  | { type: 'users:sync'; payload: PublicUserAccount[] }
  | { type: 'majors:sync'; payload: MajorConfig[] }
  | { type: 'broadcast:notice'; payload: BroadcastNotice };
