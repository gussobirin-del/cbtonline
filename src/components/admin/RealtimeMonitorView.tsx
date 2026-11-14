import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Lock,
  Megaphone,
  MonitorCheck,
  Radio,
  Search,
  Send,
  ShieldAlert,
  Unlock,
  Users,
  Wifi,
  XCircle,
} from 'lucide-react';
import type {
  ActivityEvent,
  ActivityEventType,
  BroadcastNotice,
  Exam,
  ExamAttempt,
  LiveSession,
} from '../../types/cbt.ts';
import type { ConnectionState } from '../../hooks/useCbtSocket.ts';

interface RealtimeMonitorViewProps {
  connectionState: ConnectionState;
  exams: Exam[];
  attempts: ExamAttempt[];
  liveSessions: LiveSession[];
  activities: ActivityEvent[];
  latestBroadcast: BroadcastNotice | null;
  canIntervene?: boolean;
}

type SessionFilter = 'all' | 'exam' | 'alert';
type ActivityFilter = 'all' | ActivityEventType;

export function RealtimeMonitorView({
  connectionState,
  exams,
  attempts,
  liveSessions,
  activities,
  latestBroadcast,
  canIntervene = true,
}: RealtimeMonitorViewProps) {
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcastInput, setBroadcastInput] = useState('');
  const [broadcastExamId, setBroadcastExamId] = useState<string>('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [confirmForceAttempt, setConfirmForceAttempt] = useState<ExamAttempt | null>(null);
  const [busyAttemptId, setBusyAttemptId] = useState<string | null>(null);

  const activeExams = useMemo(
    () => exams.filter((e) => e.status === 'Aktif'),
    [exams]
  );

  const activeAttempts = useMemo(
    () =>
      attempts.filter(
        (a) => a.status === 'Sedang Ujian' || a.status === 'Terkunci Pelanggaran'
      ),
    [attempts]
  );

  const totalViolations = useMemo(
    () => activeAttempts.reduce((sum, a) => sum + a.violations, 0),
    [activeAttempts]
  );

  // Merge live WebSocket sessions with active exam attempts so admin sees both connected clients and ongoing attempts
  const monitoredRows = useMemo(() => {
    const attemptByStudentId = new Map<string, ExamAttempt>();
    for (const att of activeAttempts) {
      attemptByStudentId.set(att.studentId, att);
    }

    const q = searchQuery.trim().toLowerCase();

    return liveSessions
      .map((session) => {
        const attempt =
          (session.activeAttemptId
            ? activeAttempts.find((a) => a.id === session.activeAttemptId)
            : undefined) || attemptByStudentId.get(session.userId);
        return { session, attempt };
      })
      .filter(({ session, attempt }) => {
        if (sessionFilter === 'exam' && !attempt && session.role !== 'siswa') {
          return false;
        }
        if (
          sessionFilter === 'alert' &&
          session.status !== 'Fokus Hilang' &&
          session.status !== 'Terkunci' &&
          (!attempt || attempt.violations === 0)
        ) {
          return false;
        }
        if (!q) return true;
        return (
          session.userName.toLowerCase().includes(q) ||
          session.userCode.toLowerCase().includes(q) ||
          session.kelas.toLowerCase().includes(q) ||
          (attempt?.examTitle.toLowerCase().includes(q) ?? false)
        );
      });
  }, [liveSessions, activeAttempts, sessionFilter, searchQuery]);

  const filteredActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activities.filter((act) => {
      if (activityFilter !== 'all' && act.type !== activityFilter) return false;
      if (!q) return true;
      return (
        act.actorName.toLowerCase().includes(q) ||
        act.actorMeta.toLowerCase().includes(q) ||
        act.message.toLowerCase().includes(q) ||
        (act.examTitle?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [activities, activityFilter, searchQuery]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim()) return;
    setIsSendingBroadcast(true);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: broadcastInput.trim(),
          targetExamId: broadcastExamId || null,
        }),
      });
      if (res.ok) {
        setBroadcastInput('');
        setFeedbackMsg('Pengumuman live terkirim ke semua sesi ujian aktif.');
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleForceSubmit = async (attempt: ExamAttempt) => {
    setBusyAttemptId(attempt.id);
    try {
      await fetch(`/api/admin/force-submit/${attempt.id}`, { method: 'POST' });
      setConfirmForceAttempt(null);
    } finally {
      setBusyAttemptId(null);
    }
  };

  const handleUnlockViolation = async (attempt: ExamAttempt) => {
    setBusyAttemptId(attempt.id);
    try {
      await fetch(`/api/admin/unlock-violation/${attempt.id}`, { method: 'POST' });
    } finally {
      setBusyAttemptId(null);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return '--:--:--';
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Portal Quick Access & Broadcast Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Radio
              className={`w-3.5 h-3.5 ${
                connectionState === 'connected' ? 'text-emerald-600' : 'text-amber-600'
              }`}
            />
            <span>
              {connectionState === 'connected'
                ? 'Saluran WebSocket Live Terhubung'
                : connectionState === 'connecting'
                  ? 'Menghubungkan Saluran Live...'
                  : 'Koneksi Terputus — Menyambung Ulang'}
            </span>
            <span aria-hidden="true">·</span>
            <span>SMK Medina Bandung</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            Pemantauan Aktivitas Pengguna &amp; Ruang Ujian Real-Time
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            Setiap koneksi siswa, progres jawaban soal, dan perpindahan tab terdeteksi seketika dari server. Buka tab Portal Siswa untuk menguji sesi ujian secara langsung.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <a
            href="/?mode=ujian"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Buka Tab Login Siswa</span>
          </a>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Buka Tab Login Staf</span>
          </a>
        </div>
      </div>

      {/* 4-Column Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Pengguna Terkoneksi Live</span>
            <Wifi className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {liveSessions.length}
            </span>
            <span className="text-xs text-slate-500">sesi WebSocket aktif</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Siswa Sedang Ujian</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {activeAttempts.length}
            </span>
            <span className="text-xs text-slate-500">peserta mengerjakan PTS/PAS</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Ujian PTS &amp; PAS Aktif</span>
            <MonitorCheck className="w-4 h-4 text-[#0F2A52]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {activeExams.length}
            </span>
            <span className="text-xs text-slate-500">dari {exams.length} paket ujian</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Peringatan Pindah Tab</span>
            <ShieldAlert
              className={`w-4 h-4 ${totalViolations > 0 ? 'text-red-600' : 'text-slate-400'}`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${
                totalViolations > 0 ? 'text-red-600' : 'text-slate-900'
              }`}
            >
              {totalViolations}
            </span>
            <span className="text-xs text-slate-500">insiden fokus layar aktif</span>
          </div>
        </div>
      </div>

      {/* Live Broadcast Strip */}
      <form
        onSubmit={handleSendBroadcast}
        className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 shrink-0">
          <Megaphone className="w-4 h-4 text-[#0F2A52]" />
          <span>Pengumuman Live:</span>
        </div>
        <select
          value={broadcastExamId}
          onChange={(e) => setBroadcastExamId(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="Target ujian pengumuman"
        >
          <option value="">Semua Peserta Ujian</option>
          {activeExams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.category} · {ex.subject}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={broadcastInput}
          onChange={(e) => setBroadcastInput(e.target.value)}
          placeholder="Ketik instruksi pengawas (contoh: Waktu tersisa 10 menit, periksa kembali jawaban Anda)..."
          className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={isSendingBroadcast || !broadcastInput.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Send className="w-4 h-4" />
          <span>Kirim ke Layar Siswa</span>
        </button>
      </form>

      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {latestBroadcast && !feedbackMsg && (
        <div className="bg-slate-100 border border-slate-200 text-slate-700 rounded-lg px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <span>
            Pengumuman terakhir ({formatTime(latestBroadcast.sentAt)}):{' '}
            <strong className="text-slate-900">{latestBroadcast.message}</strong>
          </span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama siswa, NIS, kelas, atau mata pelajaran..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {(
            [
              { id: 'all', label: 'Semua Koneksi' },
              { id: 'exam', label: 'Peserta Ujian' },
              { id: 'alert', label: 'Ada Pelanggaran' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSessionFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                sessionFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Panel Real-Time Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Live Sessions Table */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Pengguna Aktif &amp; Progres Ujian Langsung
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Diperbarui otomatis melalui WebSocket tanpa muat ulang halaman
              </p>
            </div>
            <span className="font-mono tabular-nums text-xs text-slate-600">
              {monitoredRows.length} sesi tampil
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Aktivitas / Ujian</th>
                  <th className="py-3 px-4 text-right">Progres</th>
                  <th className="py-3 px-4 text-right">Fokus</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {monitoredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 px-4 text-center text-slate-500 text-sm">
                      Tidak ada sesi yang cocok dengan filter saat ini. Buka tab Portal Siswa untuk melihat sesi peserta masuk secara real-time.
                    </td>
                  </tr>
                ) : (
                  monitoredRows.map(({ session, attempt }) => {
                    const progressPct = attempt
                      ? Math.round((attempt.answeredCount / Math.max(1, attempt.totalQuestions)) * 100)
                      : 0;
                    const isLocked =
                      session.status === 'Terkunci' ||
                      attempt?.status === 'Terkunci Pelanggaran';
                    const isWarning =
                      !isLocked &&
                      (session.status === 'Fokus Hilang' || (attempt?.violations ?? 0) > 0);

                    return (
                      <tr key={session.clientId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 align-top">
                          <div className="font-medium text-slate-900">
                            {session.userName}{' '}
                            <span className="text-xs font-normal text-sky-700 capitalize">
                              ({session.role})
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                            {session.userCode} · {session.kelas}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top">
                          <div className="text-slate-800 font-medium line-clamp-1">
                            {attempt ? attempt.examTitle : session.currentView}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                            {session.ip} · {session.device} · Masuk {formatTime(session.connectedAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4 align-top text-right">
                          {attempt ? (
                            <div className="inline-flex flex-col items-end gap-1 min-w-[76px]">
                              <span className="font-mono tabular-nums text-xs font-medium text-slate-900">
                                {attempt.answeredCount}/{attempt.totalQuestions} soal
                              </span>
                              <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-sky-600 transition-all"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top text-right font-mono tabular-nums text-xs">
                          {attempt ? (
                            <span
                              className={
                                attempt.violations > 0 ? 'text-red-600 font-semibold' : 'text-slate-600'
                              }
                            >
                              {attempt.violations}/{attempt.maxViolations}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span>Terkunci</span>
                            </span>
                          ) : isWarning ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>Fokus Hilang</span>
                            </span>
                          ) : session.status === 'Mengerjakan Ujian' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 whitespace-nowrap">
                              <Activity className="w-3.5 h-3.5 shrink-0" />
                              <span>Mengerjakan</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Online</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 align-top text-right">
                          {attempt && canIntervene ? (
                            <div className="inline-flex items-center gap-1.5">
                              {attempt.status === 'Terkunci Pelanggaran' && (
                                <button
                                  type="button"
                                  disabled={busyAttemptId === attempt.id}
                                  onClick={() => handleUnlockViolation(attempt)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap"
                                >
                                  <Unlock className="w-3.5 h-3.5" />
                                  <span>Buka Blokir</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busyAttemptId === attempt.id}
                                onClick={() => setConfirmForceAttempt(attempt)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors whitespace-nowrap"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Paksa Selesai</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {attempt ? 'Terpantau' : 'Standby'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Activity Stream */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Log Aktivitas Real-Time
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rekam jejak peristiwa pengguna secara kronologis
                </p>
              </div>
              <span className="font-mono tabular-nums text-xs text-slate-500">
                {filteredActivities.length} entri
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'ujian', label: 'Ujian' },
                  { id: 'pelanggaran', label: 'Pelanggaran' },
                  { id: 'koneksi', label: 'Koneksi' },
                  { id: 'admin', label: 'Admin' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActivityFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activityFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {filteredActivities.length === 0 ? (
              <div className="py-10 px-5 text-center text-sm text-slate-500">
                Belum ada aktivitas pada kategori ini.
              </div>
            ) : (
              filteredActivities.map((act) => (
                <div key={act.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-900">
                      {act.actorName}{' '}
                      <span className="font-normal text-slate-500">· {act.actorMeta}</span>
                    </span>
                    <span className="font-mono tabular-nums text-slate-400 shrink-0">
                      {formatTime(act.timestamp)}
                    </span>
                  </div>
                  <p
                    className={`mt-1 text-sm ${
                      act.type === 'pelanggaran'
                        ? 'text-red-700 font-medium'
                        : 'text-slate-700'
                    }`}
                  >
                    {act.message}
                  </p>
                  {act.examTitle && (
                    <div className="mt-1 text-xs text-slate-500 truncate">{act.examTitle}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* In-app Force Submit Confirmation Modal */}
      {confirmForceAttempt && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Konfirmasi Paksa Selesai Ujian
            </h3>
            <p className="text-sm text-slate-600">
              Apakah Anda yakin ingin menghentikan sesi ujian{' '}
              <strong className="text-slate-900">{confirmForceAttempt.studentName}</strong> (
              {confirmForceAttempt.studentKelas})? Jawaban yang sudah tersimpan (
              {confirmForceAttempt.answeredCount}/{confirmForceAttempt.totalQuestions} soal) akan
              langsung dinilai oleh sistem.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmForceAttempt(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busyAttemptId === confirmForceAttempt.id}
                onClick={() => handleForceSubmit(confirmForceAttempt)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                Ya, Hentikan &amp; Nilai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
