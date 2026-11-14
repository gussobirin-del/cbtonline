import { useEffect, useState } from 'react';
import { CheckCircle2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import type { MajorConfig } from '../../types/cbt.ts';

interface MajorsSettingsViewProps {
  majors: MajorConfig[];
}

const DEFAULT_MAJORS: MajorConfig[] = [
  { code: 'TKJ', name: 'Teknik Komputer & Jaringan' },
  { code: 'RPL', name: 'Rekayasa Perangkat Lunak' },
  { code: 'DKV', name: 'Desain Komunikasi Visual' },
  { code: 'AKL', name: 'Akuntansi & Keuangan Lembaga' },
];

export function MajorsSettingsView({ majors }: MajorsSettingsViewProps) {
  const [draftMajors, setDraftMajors] = useState<MajorConfig[]>(() =>
    majors.length > 0 ? majors : DEFAULT_MAJORS
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (majors.length > 0) {
      setDraftMajors(majors);
    }
  }, [majors]);

  const handleFieldChange = (idx: number, field: 'code' | 'name', value: string) => {
    setErrorMsg(null);
    setDraftMajors((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              [field]: field === 'code' ? value.toUpperCase() : value,
            }
          : item
      )
    );
  };

  const handleAddRow = () => {
    setErrorMsg(null);
    setDraftMajors((prev) => [...prev, { code: '', name: '' }]);
  };

  const handleRemoveRow = (idx: number) => {
    if (draftMajors.length <= 1) return;
    setErrorMsg(null);
    setDraftMajors((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleResetDefault = () => {
    setErrorMsg(null);
    setDraftMajors(DEFAULT_MAJORS);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedBanner(null);

    const cleaned = draftMajors.map((m) => ({
      code: m.code.trim().toUpperCase(),
      name: m.name.trim(),
    }));

    if (cleaned.some((m) => !m.code)) {
      setErrorMsg('Semua baris wajib memiliki Kode Jurusan (contoh: TKJ, RPL).');
      return;
    }

    const seen = new Set<string>();
    for (const m of cleaned) {
      if (seen.has(m.code)) {
        setErrorMsg(`Kode jurusan "${m.code}" tidak boleh duplikat.`);
        return;
      }
      seen.add(m.code);
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/majors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ majors: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal menyimpan pengaturan jurusan.');
        return;
      }
      setSavedBanner(
        `Pengaturan ${cleaned.length} jurusan (${cleaned.map((m) => m.code).join(', ')}) berhasil disimpan.`
      );
      setTimeout(() => setSavedBanner(null), 5000);
    } catch {
      setErrorMsg('Gagal menghubungi server.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Pengaturan Jurusan / Program Keahlian
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Atur daftar jurusan SMK Medina Bandung secara manual (misalnya TKJ, RPL, DKV, AKL, atau jurusan tambahan). Perubahan akan langsung berlaku di Ujian PTS/PAS, Data Peserta, dan Manajemen User.
          </p>
        </div>
      </div>

      {savedBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Daftar Jurusan Aktif ({draftMajors.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ubah kode singkatan atau nama lengkap jurusan pada kolom di bawah, lalu klik Simpan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefault}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0F2A52] bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Jurusan</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {draftMajors.map((major, idx) => (
            <div
              key={idx}
              className="p-4 sm:px-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <div className="sm:w-36 shrink-0">
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Kode Jurusan
                </label>
                <input
                  type="text"
                  required
                  value={major.code}
                  onChange={(e) => handleFieldChange(idx, 'code', e.target.value)}
                  placeholder="Contoh: TKJ"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  Nama Lengkap Program Keahlian
                </label>
                <input
                  type="text"
                  value={major.name}
                  onChange={(e) => handleFieldChange(idx, 'name', e.target.value)}
                  placeholder="Contoh: Teknik Komputer & Jaringan"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="sm:pt-5 flex justify-end">
                <button
                  type="button"
                  disabled={draftMajors.length <= 1}
                  onClick={() => handleRemoveRow(idx)}
                  aria-label={`Hapus jurusan ${major.code || idx + 1}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="sm:hidden">Hapus</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500">
            Perubahan tersimpan permanen di server dan langsung disinkronkan.
          </span>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Jurusan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
