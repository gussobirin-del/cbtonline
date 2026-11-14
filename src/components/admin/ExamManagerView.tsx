import { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Exam,
  ExamCategory,
  ExamStatus,
  MajorConfig,
  QuestionType,
} from '../../types/cbt.ts';

interface ExamManagerViewProps {
  exams: Exam[];
  majorsList: MajorConfig[];
  openCreateModalTrigger?: number;
}

export function ExamManagerView({ exams, majorsList }: ExamManagerViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | ExamCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ExamStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [confirmDeleteExam, setConfirmDeleteExam] = useState<Exam | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Create Exam Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExamCategory>('PTS');
  const [semester, setSemester] = useState('Ganjil');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('XII');
  const [majors, setMajors] = useState<string[]>(() =>
    majorsList.length > 0 ? [majorsList[0].code] : ['TKJ']
  );
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [maxViolations, setMaxViolations] = useState(3);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<ExamStatus>('Aktif');
  const [showResultToStudent, setShowResultToStudent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Add Question Form State (inside Question Drawer)
  const [qType, setQType] = useState<QuestionType>('pg');
  const [qPrompt, setQPrompt] = useState('');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '', '']);
  const [qCorrectIndex, setQCorrectIndex] = useState(0);
  const [qPoints, setQPoints] = useState(20);
  const [qSaving, setQSaving] = useState(false);

  const editingExam = useMemo(
    () => exams.find((e) => e.id === editingExamId) || null,
    [exams, editingExamId]
  );

  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });
  }, [exams, categoryFilter, statusFilter]);

  const toggleMajor = (m: string) => {
    setMajors((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]
    );
  };

  const generateRandomToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return `MEDINA-${code}`;
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim() || !subject.trim()) {
      setFormError('Judul ujian dan mata pelajaran wajib diisi.');
      return;
    }
    if (majors.length === 0) {
      setFormError('Pilih minimal satu jurusan peserta.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          semester,
          academicYear,
          subject: subject.trim(),
          gradeLevel,
          majors,
          durationMinutes: Number(durationMinutes) || 60,
          maxViolations: Number(maxViolations) || 3,
          token: token.trim() || generateRandomToken(),
          status,
          showResultToStudent,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || 'Gagal membuat ujian.');
        return;
      }
      const created = (await res.json()) as Exam;
      setShowCreateModal(false);
      setTitle('');
      setSubject('');
      setToken('');
      setEditingExamId(created.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (exam: Exam) => {
    const nextStatus: ExamStatus = exam.status === 'Aktif' ? 'Selesai' : 'Aktif';
    await fetch(`/api/exams/${exam.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
  };

  const handleRotateToken = async (exam: Exam) => {
    const nextToken = generateRandomToken();
    await fetch(`/api/exams/${exam.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: nextToken }),
    });
  };

  const handleDeleteExam = async (exam: Exam) => {
    await fetch(`/api/exams/${exam.id}`, { method: 'DELETE' });
    if (editingExamId === exam.id) setEditingExamId(null);
    setConfirmDeleteExam(null);
  };

  const handleCopyToken = (exam: Exam) => {
    navigator.clipboard?.writeText(exam.token).catch(() => {});
    setCopiedTokenId(exam.id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam || !qPrompt.trim()) return;
    setQSaving(true);
    try {
      const cleanedOptions =
        qType === 'pg'
          ? qOptions.map((o, idx) => o.trim() || `Opsi ${String.fromCharCode(65 + idx)}`)
          : [];
      const res = await fetch(`/api/exams/${editingExam.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: qType,
          prompt: qPrompt.trim(),
          options: cleanedOptions,
          correctIndex: qCorrectIndex,
          points: Number(qPoints) || 10,
        }),
      });
      if (res.ok) {
        setQPrompt('');
        setQOptions(['', '', '', '', '']);
        setQCorrectIndex(0);
      }
    } finally {
      setQSaving(false);
    }
  };

  const handleDeleteQuestion = async (examId: string, qid: string) => {
    await fetch(`/api/exams/${examId}/questions/${qid}`, { method: 'DELETE' });
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Manajemen Ujian Online (PTS &amp; PAS)
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Kelola jadwal ujian mid semester (PTS) dan semesteran (PAS), token akses peserta, serta bank soal SMK Medina Bandung.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setToken(generateRandomToken());
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] rounded-lg transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Ujian PTS / PAS</span>
        </button>
      </div>

      {/* Segmented Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'all', label: 'Semua Ujian' },
              { id: 'PTS', label: 'PTS (Mid Semester)' },
              { id: 'PAS', label: 'PAS (Semesteran)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['all', 'Aktif', 'Terjadwal', 'Draf', 'Selesai'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === 'all' ? 'Semua Status' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Exam List Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3.5 px-5">Paket Ujian &amp; Mapel</th>
                <th className="py-3.5 px-4">Target Kelas</th>
                <th className="py-3.5 px-4 text-right">Soal</th>
                <th className="py-3.5 px-4 text-right">Durasi</th>
                <th className="py-3.5 px-4">Token Akses</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-5 text-center text-slate-500">
                    Belum ada ujian pada kategori ini. Klik tombol "Buat Ujian PTS / PAS" untuk menambahkan.
                  </td>
                </tr>
              ) : (
                filteredExams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-5 align-top">
                      <div className="text-xs font-medium text-slate-500">
                        {exam.category === 'PTS'
                          ? 'PTS (Mid Semester)'
                          : 'PAS (Semesteran)'}{' '}
                        · {exam.semester} {exam.academicYear}
                      </div>
                      <div className="font-semibold text-slate-900 mt-0.5">{exam.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{exam.subject}</div>
                    </td>
                    <td className="py-4 px-4 align-top text-slate-700">
                      <div className="font-medium">Kelas {exam.gradeLevel}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {exam.majors.join(', ')}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums text-slate-900">
                      {exam.questions.length} butir
                    </td>
                    <td className="py-4 px-4 align-top text-right font-mono tabular-nums text-slate-700">
                      {exam.durationMinutes} mnt
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="inline-flex items-center gap-1.5">
                        <code className="font-mono text-xs font-semibold text-[#0F2A52] bg-slate-100 px-2 py-1 rounded">
                          {exam.token}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyToken(exam)}
                          title="Salin Token"
                          className="p-1 text-slate-500 hover:text-slate-900 rounded"
                        >
                          {copiedTokenId === exam.id ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRotateToken(exam)}
                          title="Putar Token Baru"
                          className="p-1 text-slate-500 hover:text-slate-900 rounded"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      {exam.status === 'Aktif' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Aktif</span>
                        </span>
                      ) : exam.status === 'Terjadwal' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Terjadwal</span>
                        </span>
                      ) : exam.status === 'Selesai' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selesai</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Draf</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5 align-top text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingExamId(exam.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Bank Soal</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(exam)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                            exam.status === 'Aktif'
                              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {exam.status === 'Aktif' ? (
                            <>
                              <PauseCircle className="w-3.5 h-3.5" />
                              <span>Tutup</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Aktifkan</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteExam(exam)}
                          aria-label={`Hapus ${exam.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Exam Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Buat Paket Ujian Baru
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  SMK Medina Bandung — Penilaian Tengah Semester (PTS) atau Akhir Semester (PAS)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Jenis Ujian
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExamCategory)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="PTS">PTS — Penilaian Tengah Semester (Mid)</option>
                    <option value="PAS">PAS — Penilaian Akhir Semester</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Semester &amp; Tahun Ajaran
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900"
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                    <input
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Judul Ujian
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: PTS Ganjil — Sistem Operasi Jaringan"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Contoh: Administrasi Sistem Jaringan"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Tingkat Kelas
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900"
                  >
                    <option value="X">Kelas X</option>
                    <option value="XI">Kelas XI</option>
                    <option value="XII">Kelas XII</option>
                    <option value="Semua Tingkat">Semua Tingkat (X, XI, XII)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Program Keahlian / Jurusan Peserta
                </label>
                <div className="flex flex-wrap gap-2">
                  {majorsList.map((m) => {
                    const selected = majors.includes(m.code);
                    return (
                      <button
                        key={m.code}
                        type="button"
                        onClick={() => toggleMajor(m.code)}
                        title={m.name}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          selected
                            ? 'bg-[#0F2A52] text-white border-[#0F2A52]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {m.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Durasi (Menit)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Batas Pindah Tab
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxViolations}
                    onChange={(e) => setMaxViolations(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Status Awal
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ExamStatus)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Aktif">Langsung Aktif</option>
                    <option value="Terjadwal">Terjadwal</option>
                    <option value="Draf">Simpan Draf</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Token Ujian
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value.toUpperCase())}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg font-mono uppercase"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setToken(generateRandomToken())}
                      className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                    >
                      Acak
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 text-sm text-slate-700 pb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResultToStudent}
                    onChange={(e) => setShowResultToStudent(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#0F2A52]"
                  />
                  <span>Tampilkan nilai otomatis ke siswa setelah selesai</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] disabled:opacity-50 rounded-lg"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan & Lanjut ke Bank Soal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Question Bank Editor Drawer */}
      {editingExam && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-3xl h-full flex flex-col border-l border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Bank Soal · {editingExam.category} · Token:{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    {editingExam.token}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{editingExam.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingExamId(null)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Add New Question Form */}
              <form
                onSubmit={handleAddQuestion}
                className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Tambah Soal Baru
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setQType('pg')}
                        className={`px-3 py-1 text-xs font-medium rounded-md ${
                          qType === 'pg'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Pilihan Ganda
                      </button>
                      <button
                        type="button"
                        onClick={() => setQType('esai')}
                        className={`px-3 py-1 text-xs font-medium rounded-md ${
                          qType === 'esai'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600'
                        }`}
                      >
                        Uraian / Esai
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span>Bobot:</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={qPoints}
                        onChange={(e) => setQPoints(Number(e.target.value))}
                        className="w-16 px-2 py-1 border border-slate-200 rounded bg-white font-mono tabular-nums text-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pertanyaan
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={qPrompt}
                    onChange={(e) => setQPrompt(e.target.value)}
                    placeholder="Tulis butir soal ujian di sini..."
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {qType === 'pg' && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-700">
                      Pilihan Jawaban (pilih radio button untuk kunci jawaban benar)
                    </div>
                    {qOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="correct-option"
                          checked={qCorrectIndex === idx}
                          onChange={() => setQCorrectIndex(idx)}
                          className="w-4 h-4 text-emerald-600"
                          aria-label={`Kunci jawaban ${String.fromCharCode(65 + idx)}`}
                        />
                        <span className="font-mono text-xs font-semibold text-slate-500 w-5">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...qOptions];
                            next[idx] = e.target.value;
                            setQOptions(next);
                          }}
                          placeholder={`Isi pilihan ${String.fromCharCode(65 + idx)}`}
                          className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={qSaving || !qPrompt.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] disabled:opacity-50 rounded-lg"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{qSaving ? 'Menyimpan...' : 'Tambahkan ke Bank Soal'}</span>
                  </button>
                </div>
              </form>

              {/* Existing Questions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Daftar Soal Tersimpan ({editingExam.questions.length} butir)
                  </h4>
                </div>

                {editingExam.questions.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
                    Belum ada soal pada paket ujian ini. Tambahkan soal Pilihan Ganda atau Esai menggunakan formulir di atas.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
                    {editingExam.questions.map((q, idx) => (
                      <div key={q.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="text-xs font-medium text-slate-500 font-mono tabular-nums">
                            Soal #{idx + 1} · {q.type === 'pg' ? 'Pilihan Ganda' : 'Esai'} ·{' '}
                            {q.points} poin
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(editingExam.id, q.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded"
                            aria-label={`Hapus soal ${idx + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-slate-900 leading-relaxed">{q.prompt}</p>
                        {q.type === 'pg' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {q.options.map((opt, oIdx) => (
                              <div
                                key={oIdx}
                                className={`text-xs px-2.5 py-1.5 rounded border ${
                                  oIdx === q.correctIndex
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="font-mono mr-1.5">
                                  {String.fromCharCode(65 + oIdx)}.
                                </span>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Exam Confirmation Modal */}
      {confirmDeleteExam && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Hapus Paket Ujian</h3>
            <p className="text-sm text-slate-600">
              Yakin ingin menghapus{' '}
              <strong className="text-slate-900">{confirmDeleteExam.title}</strong>? Seluruh bank
              soal di dalamnya akan terhapus permanen.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteExam(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteExam(confirmDeleteExam)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Hapus Ujian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
