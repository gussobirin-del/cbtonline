import { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck,
  Search,
  X,
} from 'lucide-react';
import type { Exam, ExamAttempt } from '../../types/cbt.ts';

interface ResultsViewProps {
  exams: Exam[];
  attempts: ExamAttempt[];
}

export function ResultsView({ exams, attempts }: ResultsViewProps) {
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectAttemptId, setInspectAttemptId] = useState<string | null>(null);
  const [essayDraft, setEssayDraft] = useState<Record<string, number>>({});
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  const completedAttempts = useMemo(
    () =>
      attempts.filter(
        (a) => a.status === 'Selesai' || a.status === 'Dipaksa Selesai'
      ),
    [attempts]
  );

  const filteredAttempts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return completedAttempts.filter((a) => {
      if (selectedExamId !== 'all' && a.examId !== selectedExamId) return false;
      if (!q) return true;
      return (
        a.studentName.toLowerCase().includes(q) ||
        a.studentNis.toLowerCase().includes(q) ||
        a.studentKelas.toLowerCase().includes(q) ||
        a.examTitle.toLowerCase().includes(q)
      );
    });
  }, [completedAttempts, selectedExamId, searchQuery]);

  const stats = useMemo(() => {
    if (filteredAttempts.length === 0) {
      return { total: 0, avg: 0, highest: 0, passed: 0 };
    }
    const scores = filteredAttempts.map((a) => a.score ?? 0);
    const sum = scores.reduce((acc, s) => acc + s, 0);
    const passed = scores.filter((s) => s >= 75).length;
    return {
      total: filteredAttempts.length,
      avg: Math.round((sum / filteredAttempts.length) * 10) / 10,
      highest: Math.max(...scores),
      passed,
    };
  }, [filteredAttempts]);

  const inspectAttempt = useMemo(
    () => attempts.find((a) => a.id === inspectAttemptId) || null,
    [attempts, inspectAttemptId]
  );

  const inspectExam = useMemo(
    () =>
      inspectAttempt
        ? exams.find((e) => e.id === inspectAttempt.examId) || null
        : null,
    [exams, inspectAttempt]
  );

  const openInspector = (attempt: ExamAttempt) => {
    setInspectAttemptId(attempt.id);
    setEssayDraft({ ...attempt.essayScores });
  };

  const handleSaveEssayScores = async () => {
    if (!inspectAttempt) return;
    setIsSavingGrade(true);
    try {
      const res = await fetch(`/api/admin/grade-essay/${inspectAttempt.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ essayScores: essayDraft }),
      });
      if (res.ok) {
        setInspectAttemptId(null);
      }
    } finally {
      setIsSavingGrade(false);
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Hasil Ujian &amp; Rekap Nilai PTS / PAS
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Penilaian otomatis pilihan ganda, koreksi jawaban esai, serta ekspor rekap nilai ke CSV untuk rapor.
          </p>
        </div>

        <a
          href={`/api/export/results/${selectedExamId}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] rounded-lg transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Unduh Rekap CSV</span>
        </a>
      </div>

      {/* 4-Column Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Pengumpulan</span>
            <ClipboardList className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-900">
            {stats.total}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Rata-Rata Nilai</span>
            <FileCheck className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-900">
            {stats.avg}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Nilai Tertinggi</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-900">
            {stats.highest}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Tuntas KKM (&ge; 75)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {stats.passed}
            </span>
            <span className="text-xs text-slate-500">
              dari {stats.total} peserta
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama siswa, NIS, atau kelas..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <select
          value={selectedExamId}
          onChange={(e) => setSelectedExamId(e.target.value)}
          className="px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="all">Semua Paket Ujian (PTS &amp; PAS)</option>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.category} · {ex.title}
            </option>
          ))}
        </select>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3.5 px-5">Peserta Didik</th>
                <th className="py-3.5 px-4">Paket Ujian</th>
                <th className="py-3.5 px-4 text-right">Dijawab</th>
                <th className="py-3.5 px-4 text-right">Pelanggaran</th>
                <th className="py-3.5 px-4">Waktu Kumpul</th>
                <th className="py-3.5 px-4 text-right">Nilai Akhir</th>
                <th className="py-3.5 px-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredAttempts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-5 text-center text-slate-500">
                    Belum ada hasil ujian yang dikumpulkan pada filter ini.
                  </td>
                </tr>
              ) : (
                filteredAttempts.map((att) => {
                  const score = att.score ?? 0;
                  return (
                    <tr key={att.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-slate-900">{att.studentName}</div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                          {att.studentNis} · {att.studentKelas}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-slate-500">
                          {att.examCategory} · {att.status}
                        </div>
                        <div className="font-medium text-slate-800">{att.examTitle}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {att.answeredCount}/{att.totalQuestions}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                        <span
                          className={
                            att.violations > 0 ? 'text-red-600 font-medium' : 'text-slate-600'
                          }
                        >
                          {att.violations}/{att.maxViolations}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600">
                        {formatDateTime(att.submittedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`font-mono tabular-nums text-base font-bold ${
                            score >= 75 ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {score}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => openInspector(att)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Periksa Jawaban
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Answer Inspector & Essay Grading Drawer */}
      {inspectAttempt && inspectExam && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-2xl h-full flex flex-col border-l border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  {inspectAttempt.studentNis} · {inspectAttempt.studentKelas} · Nilai Saat Ini:{' '}
                  <strong className="text-slate-900">{inspectAttempt.score ?? 0}</strong>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {inspectAttempt.studentName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectAttemptId(null)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {inspectExam.questions.map((q, idx) => {
                const ans = inspectAttempt.answers[q.id];
                const isPg = q.type === 'pg';
                const isCorrect = isPg && typeof ans === 'number' && ans === q.correctIndex;
                return (
                  <div
                    key={q.id}
                    className="border border-slate-200 rounded-xl p-4 space-y-2.5 bg-white"
                  >
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                      <span>
                        Soal #{idx + 1} · {isPg ? 'Pilihan Ganda' : 'Uraian / Esai'} · Maks{' '}
                        {q.points} poin
                      </span>
                      {isPg && (
                        <span
                          className={
                            isCorrect
                              ? 'text-emerald-700 font-semibold'
                              : 'text-red-600 font-semibold'
                          }
                        >
                          {isCorrect ? 'Benar' : 'Salah / Kosong'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-900">{q.prompt}</p>
                    {isPg ? (
                      <div className="text-xs space-y-1 text-slate-700 bg-slate-50 p-3 rounded-lg">
                        <div>
                          Jawaban Siswa:{' '}
                          <strong>
                            {typeof ans === 'number'
                              ? `${String.fromCharCode(65 + ans)}. ${q.options[ans]}`
                              : 'Tidak Dijawab'}
                          </strong>
                        </div>
                        <div>
                          Kunci Jawaban:{' '}
                          <strong className="text-emerald-700">
                            {String.fromCharCode(65 + q.correctIndex)}. {q.options[q.correctIndex]}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-800 whitespace-pre-wrap">
                          {typeof ans === 'string' && ans.trim()
                            ? ans
                            : 'Siswa tidak mengisi jawaban esai.'}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-medium text-slate-700">
                            Berikan Skor Esai (0 – {q.points}):
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={q.points}
                            value={essayDraft[q.id] ?? 0}
                            onChange={(e) =>
                              setEssayDraft((prev) => ({
                                ...prev,
                                [q.id]: Number(e.target.value),
                              }))
                            }
                            className="w-24 px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono tabular-nums text-right"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {inspectExam.questions.some((q) => q.type === 'esai') && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setInspectAttemptId(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={isSavingGrade}
                  onClick={handleSaveEssayScores}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] disabled:opacity-50 rounded-lg"
                >
                  {isSavingGrade ? 'Menghitung...' : 'Simpan Nilai Esai & Hitung Ulang'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
