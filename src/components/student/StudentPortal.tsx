import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flag,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { MedinaLogo } from '../MedinaLogo.tsx';
import type {
  BroadcastNotice,
  Exam,
  ExamAttempt,
  Student,
} from '../../types/cbt.ts';
import type { ConnectionState } from '../../hooks/useCbtSocket.ts';

interface StudentPortalProps {
  connectionState: ConnectionState;
  exams: Exam[];
  students: Student[];
  attempts: ExamAttempt[];
  latestBroadcast: BroadcastNotice | null;
  loggedStudent: Student | null;
  activeAttemptId: string | null;
  onLoginStudent: (student: Student) => void;
  onLogoutStudent: () => void;
  onActiveAttemptChange: (attempt: ExamAttempt | null) => void;
  onSwitchToAdmin: () => void;
}

export function StudentPortal({
  connectionState,
  exams,
  students,
  attempts,
  latestBroadcast,
  loggedStudent,
  activeAttemptId,
  onLoginStudent,
  onLogoutStudent,
  onActiveAttemptChange,
  onSwitchToAdmin,
}: StudentPortalProps) {
  const [nis, setNis] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Token Gate State
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isStartingExam, setIsStartingExam] = useState(false);

  // Exam Workspace State
  const [currentIdx, setCurrentIdx] = useState(0);
  const [essayText, setEssayText] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(3600);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);
  const [violationAlert, setViolationAlert] = useState<string | null>(null);
  const [dismissedBroadcastId, setDismissedBroadcastId] = useState<string | null>(null);
  const [completedAttemptId, setCompletedAttemptId] = useState<string | null>(null);

  const lastViolationAtRef = useRef<number>(0);

  const activeAttempt = useMemo(
    () => (activeAttemptId ? attempts.find((a) => a.id === activeAttemptId) || null : null),
    [attempts, activeAttemptId]
  );

  const completedAttempt = useMemo(
    () => (completedAttemptId ? attempts.find((a) => a.id === completedAttemptId) || null : null),
    [attempts, completedAttemptId]
  );

  const activeExam = useMemo(
    () =>
      activeAttempt
        ? exams.find((e) => e.id === activeAttempt.examId) || null
        : null,
    [exams, activeAttempt]
  );

  // Sync if admin force-submits the active attempt remotely
  useEffect(() => {
    if (
      activeAttempt &&
      (activeAttempt.status === 'Selesai' || activeAttempt.status === 'Dipaksa Selesai')
    ) {
      setCompletedAttemptId(activeAttempt.id);
      onActiveAttemptChange(null);
    }
  }, [activeAttempt, onActiveAttemptChange]);

  // Countdown timer synced to attempt.startedAt + exam.durationMinutes
  useEffect(() => {
    if (!activeAttempt || !activeExam || activeAttempt.status !== 'Sedang Ujian') return;
    const endMs =
      new Date(activeAttempt.startedAt).getTime() + activeExam.durationMinutes * 60 * 1000;

    const tick = () => {
      const diff = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff === 0) {
        handleFinalSubmit();
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAttempt?.id, activeAttempt?.status, activeExam?.durationMinutes]);

  // Keep essay textarea synced with current question
  useEffect(() => {
    if (!activeExam || !activeAttempt) return;
    const q = activeExam.questions[currentIdx];
    if (q && q.type === 'esai') {
      const saved = activeAttempt.answers[q.id];
      setEssayText(typeof saved === 'string' ? saved : '');
    }
  }, [currentIdx, activeExam, activeAttempt]);

  // Real Anti-Cheat Focus / Visibility Detection
  useEffect(() => {
    if (!activeAttempt || activeAttempt.status !== 'Sedang Ujian') return;

    const reportViolation = (reason: string) => {
      const now = Date.now();
      if (now - lastViolationAtRef.current < 1500) return;
      lastViolationAtRef.current = now;

      fetch('/api/student/violation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: activeAttempt.id, reason }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { attempt: ExamAttempt } | null) => {
          if (data?.attempt) {
            onActiveAttemptChange(data.attempt);
            setViolationAlert(
              `${reason}. Pelanggaran tercatat: ${data.attempt.violations}/${data.attempt.maxViolations}.`
            );
          }
        })
        .catch(() => {});
    };

    const handleVisibility = () => {
      if (document.hidden) {
        reportViolation('Berpindah tab atau meminimalkan browser');
      }
    };

    const handleBlur = () => {
      reportViolation('Jendela ujian kehilangan fokus layar');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [activeAttempt, onActiveAttemptChange]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nis, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Gagal masuk.');
        return;
      }
      onLoginStudent(data.student);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam || !loggedStudent) return;
    setTokenError(null);
    setIsStartingExam(true);
    try {
      const res = await fetch('/api/student/start-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: selectedExam.id,
          studentId: loggedStudent.id,
          token: tokenInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTokenError(data.error || 'Token ujian tidak valid.');
        return;
      }
      setSelectedExam(null);
      setTokenInput('');
      setCompletedAttemptId(null);
      setCurrentIdx(data.attempt.currentQuestionIndex || 0);
      onActiveAttemptChange(data.attempt);
    } finally {
      setIsStartingExam(false);
    }
  };

  const saveAnswer = async (
    questionId: string,
    answer?: string | number,
    flagged?: boolean,
    nextIdx?: number
  ) => {
    if (!activeAttempt) return;
    const res = await fetch('/api/student/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId: activeAttempt.id,
        questionId,
        answer,
        flagged,
        currentQuestionIndex: nextIdx ?? currentIdx,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      onActiveAttemptChange(data.attempt);
    }
  };

  const handleFinalSubmit = async () => {
    if (!activeAttempt) return;
    setIsSubmittingExam(true);
    try {
      const res = await fetch('/api/student/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: activeAttempt.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowSubmitConfirm(false);
        setCompletedAttemptId(data.attempt.id);
        onActiveAttemptChange(null);
      }
    } finally {
      setIsSubmittingExam(false);
    }
  };

  const formatTimer = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const showBroadcast =
    latestBroadcast &&
    latestBroadcast.id !== dismissedBroadcastId &&
    (!latestBroadcast.targetExamId || latestBroadcast.targetExamId === activeExam?.id);

  // --- VIEW 1: ACTIVE EXAM WORKSPACE ---
  if (loggedStudent && activeAttempt && activeExam) {
    const questions = activeExam.questions;
    const currentQ = questions[currentIdx] || questions[0];
    const isFlagged = activeAttempt.flaggedQuestionIds.includes(currentQ.id);
    const currentAnswer = activeAttempt.answers[currentQ.id];
    const isLocked = activeAttempt.status === 'Terkunci Pelanggaran';

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Compact Sticky Exam Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <MedinaLogo className="w-8 h-8 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-slate-500 truncate">
                  {activeExam.category} · {activeExam.subject} · {loggedStudent.name} ({loggedStudent.kelas})
                </div>
                <h1 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                  {activeExam.title}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="text-[11px] font-medium text-slate-500">Sisa Waktu</div>
                <div
                  className={`font-mono tabular-nums text-lg font-bold ${
                    remainingSeconds < 300 ? 'text-red-600' : 'text-[#0F2A52]'
                  }`}
                >
                  {formatTimer(remainingSeconds)}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Live Admin Broadcast Banner */}
        {showBroadcast && (
          <div className="bg-[#0F2A52] text-white px-4 sm:px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2.5">
                <Megaphone className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  <strong className="font-semibold">Pengumuman Pengawas:</strong>{' '}
                  {latestBroadcast.message}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDismissedBroadcastId(latestBroadcast.id)}
                className="text-xs text-slate-300 hover:text-white underline shrink-0"
              >
                Tutup
              </button>
            </div>
          </div>
        )}

        {/* Violation Lockout Overlay */}
        {isLocked ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-white border border-red-200 rounded-xl max-w-lg w-full p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Sesi Ujian Terkunci Sementara</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sistem mendeteksi Anda meninggalkan layar ujian sebanyak{' '}
                <strong className="font-mono text-red-600">
                  {activeAttempt.violations}/{activeAttempt.maxViolations}
                </strong>{' '}
                kali. Hubungi pengawas ruang atau Admin Sistem SMK Medina Bandung untuk membuka blokir secara langsung.
              </p>
              <div className="text-xs text-slate-500 pt-2">
                Halaman ini akan terbuka otomatis begitu Admin menekan tombol Buka Blokir.
              </div>
            </div>
          </div>
        ) : (
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Stage: Question Canvas (65-70%) */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="text-xs font-mono tabular-nums text-slate-500">
                  Soal Nomor <strong className="text-slate-900 text-sm">{currentIdx + 1}</strong> dari{' '}
                  {questions.length} · {currentQ.type === 'pg' ? 'Pilihan Ganda' : 'Uraian'} ·{' '}
                  {currentQ.points} poin
                </div>

                <button
                  type="button"
                  onClick={() => saveAnswer(currentQ.id, undefined, !isFlagged)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    isFlagged
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{isFlagged ? 'Ditandai Ragu' : 'Ragu-ragu'}</span>
                </button>
              </div>

              <div className="text-base sm:text-lg text-slate-900 leading-relaxed font-normal">
                {currentQ.prompt}
              </div>

              {currentQ.type === 'pg' ? (
                <div className="space-y-3">
                  {currentQ.options.map((opt, oIdx) => {
                    const selected = currentAnswer === oIdx;
                    const letter = String.fromCharCode(65 + oIdx);
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => saveAnswer(currentQ.id, oIdx)}
                        className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start gap-3.5 ${
                          selected
                            ? 'bg-sky-50 border-sky-500 text-slate-900'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg font-mono text-xs font-semibold flex items-center justify-center shrink-0 border ${
                            selected
                              ? 'bg-[#0F2A52] text-white border-[#0F2A52]'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="text-sm sm:text-base pt-0.5">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Jawaban Uraian Anda:
                  </label>
                  <textarea
                    rows={6}
                    value={essayText}
                    onChange={(e) => setEssayText(e.target.value)}
                    onBlur={() => saveAnswer(currentQ.id, essayText)}
                    placeholder="Ketik jawaban uraian Anda secara jelas dan terstruktur..."
                    className="w-full p-4 text-sm sm:text-base bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => saveAnswer(currentQ.id, essayText)}
                      className="px-3.5 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg"
                    >
                      Simpan Jawaban Esai
                    </button>
                  </div>
                </div>
              )}

              {/* Prev / Next Navigation */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => {
                    const nextIdx = Math.max(0, currentIdx - 1);
                    setCurrentIdx(nextIdx);
                    saveAnswer(currentQ.id, currentQ.type === 'esai' ? essayText : undefined, undefined, nextIdx);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Sebelumnya</span>
                </button>

                {currentIdx < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = Math.min(questions.length - 1, currentIdx + 1);
                      setCurrentIdx(nextIdx);
                      saveAnswer(currentQ.id, currentQ.type === 'esai' ? essayText : undefined, undefined, nextIdx);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] rounded-lg transition-colors"
                  >
                    <span>Selanjutnya</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selesai &amp; Kumpulkan</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Control Deck: Navigator & Status (30-35%) */}
            <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Navigasi Nomor Soal</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                  Terjawab {activeAttempt.answeredCount} dari {questions.length} butir
                </p>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const answered =
                    activeAttempt.answers[q.id] !== undefined &&
                    activeAttempt.answers[q.id] !== '';
                  const flagged = activeAttempt.flaggedQuestionIds.includes(q.id);
                  const isCurrent = idx === currentIdx;

                  let style = 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100';
                  if (flagged) {
                    style = 'bg-amber-50 text-amber-800 border-amber-300';
                  } else if (answered) {
                    style = 'bg-[#0F2A52] text-white border-[#0F2A52]';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIdx(idx);
                        saveAnswer(currentQ.id, undefined, undefined, idx);
                      }}
                      className={`h-10 rounded-lg border font-mono tabular-nums text-xs font-semibold transition-all ${style} ${
                        isCurrent ? 'ring-2 ring-sky-500 ring-offset-1' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-[#0F2A52] inline-block" />
                    <span>Sudah Dijawab</span>
                  </span>
                  <span className="font-mono tabular-nums font-medium">
                    {activeAttempt.answeredCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-amber-300 inline-block" />
                    <span>Ragu-ragu</span>
                  </span>
                  <span className="font-mono tabular-nums font-medium">
                    {activeAttempt.flaggedQuestionIds.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                    <span>Pelanggaran Fokus Layar</span>
                  </span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      activeAttempt.violations > 0 ? 'text-red-600' : 'text-slate-700'
                    }`}
                  >
                    {activeAttempt.violations}/{activeAttempt.maxViolations}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Kumpulkan Ujian Sekarang
              </button>
            </aside>
          </main>
        )}

        {/* Violation Alert Modal */}
        {violationAlert && !isLocked && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white border border-amber-300 rounded-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-3 text-amber-700">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="text-lg font-semibold text-slate-900">
                  Peringatan Pengawas Otomatis
                </h3>
              </div>
              <p className="text-sm text-slate-600">{violationAlert}</p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setViolationAlert(null)}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] rounded-lg"
                >
                  Saya Mengerti &amp; Kembali Ujian
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Confirmation Modal */}
        {showSubmitConfirm && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Konfirmasi Pengumpulan Ujian
              </h3>
              <p className="text-sm text-slate-600">
                Anda telah menjawab{' '}
                <strong className="font-mono text-slate-900">
                  {activeAttempt.answeredCount} dari {questions.length}
                </strong>{' '}
                soal. Setelah dikumpulkan, jawaban tidak dapat diubah lagi.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Periksa Kembali
                </button>
                <button
                  type="button"
                  disabled={isSubmittingExam}
                  onClick={handleFinalSubmit}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg"
                >
                  {isSubmittingExam ? 'Mengumpulkan...' : 'Ya, Kumpulkan Ujian'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VIEW 2: COMPLETION RECEIPT ---
  if (loggedStudent && completedAttempt) {
    const examObj = exams.find((e) => e.id === completedAttempt.examId);
    const canSeeScore = examObj?.showResultToStudent !== false;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-8 space-y-6 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">
              SMK Medina Bandung · {completedAttempt.examCategory}
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {completedAttempt.status === 'Dipaksa Selesai'
                ? 'Sesi Ujian Dihentikan Pengawas'
                : 'Ujian Berhasil Dikumpulkan'}
            </h1>
            <p className="text-sm text-slate-600">{completedAttempt.examTitle}</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-slate-500">Terjawab</div>
              <div className="mt-1 font-mono tabular-nums font-bold text-slate-900">
                {completedAttempt.answeredCount}/{completedAttempt.totalQuestions}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Pelanggaran</div>
              <div className="mt-1 font-mono tabular-nums font-bold text-slate-900">
                {completedAttempt.violations}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Nilai Sementara</div>
              <div className="mt-1 font-mono tabular-nums font-bold text-emerald-700 text-lg">
                {canSeeScore ? completedAttempt.score ?? 0 : 'Tersimpan'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCompletedAttemptId(null)}
            className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] rounded-lg"
          >
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW 3: STUDENT LOBBY (EXAM SELECTION) ---
  if (loggedStudent) {
    const myAttempts = attempts.filter((a) => a.studentId === loggedStudent.id);

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <MedinaLogo className="w-9 h-9" />
              <div>
                <div className="text-sm font-bold text-slate-900">
                  SMK Medina Bandung — Portal Ujian CBT
                </div>
                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  {loggedStudent.name} · NIS {loggedStudent.nis} · {loggedStudent.kelas}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs text-emerald-700 font-medium">
                {connectionState === 'connected' ? 'Terhubung Live' : 'Menyambungkan...'}
              </span>
              <button
                type="button"
                onClick={onLogoutStudent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl w-full mx-auto p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Jadwal Ujian Online (PTS &amp; PAS)
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Pilih ujian aktif yang sesuai dengan jadwal kelas Anda dan masukkan token dari pengawas ruang.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams
              .filter((e) => e.status === 'Aktif' || e.status === 'Terjadwal')
              .map((exam) => {
                const existing = myAttempts.find((a) => a.examId === exam.id);
                const isDone =
                  existing &&
                  (existing.status === 'Selesai' || existing.status === 'Dipaksa Selesai');
                const isInProgress =
                  existing &&
                  (existing.status === 'Sedang Ujian' ||
                    existing.status === 'Terkunci Pelanggaran');

                return (
                  <div
                    key={exam.id}
                    className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {exam.category === 'PTS'
                            ? 'PTS (Mid Semester)'
                            : 'PAS (Semesteran)'}{' '}
                          · {exam.semester}
                        </span>
                        <span
                          className={`font-medium ${
                            exam.status === 'Aktif' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {exam.status}
                        </span>
                      </div>
                      <h2 className="text-lg font-semibold text-slate-900">{exam.title}</h2>
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                        <span>Kelas {exam.gradeLevel}</span>
                        <span aria-hidden="true">·</span>
                        <span>Jurusan {exam.majors.join(', ')}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {exam.questions.length} soal
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {exam.durationMinutes} menit
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      {isDone ? (
                        <div className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            Sudah Dikerjakan
                            {exam.showResultToStudent ? ` · Nilai: ${existing.score ?? 0}` : ''}
                          </span>
                        </div>
                      ) : exam.status !== 'Aktif' ? (
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>Belum Dibuka Pengawas</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExam(exam);
                            setTokenError(null);
                            setTokenInput('');
                          }}
                          className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] rounded-lg transition-colors"
                        >
                          {isInProgress ? 'Lanjutkan Sesi Ujian' : 'Mulai Kerjakan Ujian'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </main>

        {/* Token Verification Modal */}
        {selectedExam && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
              <div>
                <div className="text-xs text-slate-500">
                  {selectedExam.category} · {selectedExam.subject}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                  Verifikasi Token Ujian
                </h3>
              </div>

              <p className="text-sm text-slate-600">
                Masukkan token ujian untuk memulai{' '}
                <strong className="text-slate-900">{selectedExam.title}</strong>. Dilarang
                berpindah tab selama ujian berlangsung (batas {selectedExam.maxViolations}x).
              </p>

              <form onSubmit={handleStartExam} className="space-y-4">
                {tokenError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                    {tokenError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Token Ujian (diperoleh dari Admin / Pengawas)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                      placeholder="Contoh: MEDINA-TKJ1"
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedExam(null)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isStartingExam}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] disabled:opacity-50 rounded-lg"
                  >
                    {isStartingExam ? 'Memverifikasi...' : 'Masuk Ruang Ujian'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VIEW 4: STUDENT LOGIN SCREEN ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-6">
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MedinaLogo className="w-9 h-9" />
          <span className="font-display font-bold text-slate-900">SMK Medina Bandung</span>
        </div>
        <button
          type="button"
          onClick={onSwitchToAdmin}
          className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Kembali ke Dashboard Admin
        </button>
      </div>

      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch my-8">
        <div className="lg:col-span-6 bg-[#0F2A52] text-white rounded-xl p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="text-xs font-medium text-sky-200">
              Portal Ujian Berbasis Komputer (CBT)
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-balance">
              Penilaian Tengah Semester &amp; Akhir Semester SMK Medina Bandung
            </h1>
            <p className="text-sm text-slate-200 leading-relaxed">
              Masuk menggunakan NIS dan PIN peserta yang tertera pada kartu ujian. Seluruh aktivitas pengerjaan tersinkronisasi real-time dengan pengawas ruang.
            </p>
          </div>

          <div className="border-t border-white/15 pt-5 space-y-2 text-xs text-slate-200">
            <div>1. Pastikan koneksi stabil sebelum memasukkan token ujian.</div>
            <div>2. Sistem mendeteksi perpindahan tab secara otomatis selama sesi berlangsung.</div>
            <div>3. Jawaban tersimpan langsung ke server setiap kali memilih opsi.</div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Login Peserta Ujian</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Masukkan Nomor Induk Siswa (NIS) dan PIN Anda
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">NIS</label>
              <input
                type="text"
                required
                value={nis}
                onChange={(e) => setNis(e.target.value)}
                placeholder="Contoh: 20241001"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                PIN Peserta
              </label>
              <input
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="6 digit PIN"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] disabled:opacity-50 rounded-lg transition-colors"
            >
              {isLoggingIn ? 'Memeriksa...' : 'Masuk ke Portal Ujian'}
            </button>
          </form>

          {/* Quick-Select Student Roster for Testing Live Monitoring */}
          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Pilih cepat akun siswa terdaftar (PIN: 123456):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
              {students.slice(0, 6).map((stu) => (
                <button
                  key={stu.id}
                  type="button"
                  onClick={() => {
                    setNis(stu.nis);
                    setPin(stu.pin);
                  }}
                  className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-900 truncate">
                    <UserCheck className="w-3.5 h-3.5 text-[#0F2A52] shrink-0" />
                    <span className="truncate">{stu.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                    {stu.nis} · {stu.kelas}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl w-full mx-auto text-center text-xs text-slate-500">
        SMK Medina Bandung · Sistem Computer-Based Test &amp; Monitoring Akademik
      </div>
    </div>
  );
}
