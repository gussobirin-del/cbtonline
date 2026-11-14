import { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Briefcase,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { MedinaLogo } from './MedinaLogo.tsx';
import type { PublicUserAccount, UserRole } from '../types/cbt.ts';
import type { ConnectionState } from '../hooks/useCbtSocket.ts';

interface LoginPageProps {
  initialRole?: UserRole;
  connectionState: ConnectionState;
  onLoginSuccess: (user: PublicUserAccount) => void;
}

const ROLE_CONFIG: {
  id: UserRole;
  label: string;
  title: string;
  subtitle: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  passwordLabel: string;
  defaultHint: string;
  icon: typeof ShieldCheck;
}[] = [
  {
    id: 'siswa',
    label: 'Siswa',
    title: 'Login Peserta Ujian (Siswa)',
    subtitle: 'Masuk untuk mengikuti ujian online PTS & PAS SMK Medina Bandung.',
    identifierLabel: 'NIS / Username Siswa',
    identifierPlaceholder: 'Contoh: 20241001',
    passwordLabel: 'Password / PIN Ujian',
    defaultHint: 'PIN awal bawaan: 123456',
    icon: GraduationCap,
  },
  {
    id: 'guru',
    label: 'Guru',
    title: 'Login Guru & Pengampu Mapel',
    subtitle: 'Kelola soal PTS/PAS, pantau ujian berlangsung, dan periksa nilai siswa.',
    identifierLabel: 'Username / NIP Guru',
    identifierPlaceholder: 'Contoh: guru.tkj',
    passwordLabel: 'Password Akun',
    defaultHint: 'Password awal bawaan: 123',
    icon: BookOpenCheck,
  },
  {
    id: 'karyawan',
    label: 'Karyawan',
    title: 'Login Karyawan & Tata Usaha',
    subtitle: 'Pantau kehadiran peserta, token ruang ujian, dan rekapitulasi administrasi.',
    identifierLabel: 'Username / Kode Staf',
    identifierPlaceholder: 'Contoh: tu.medina',
    passwordLabel: 'Password Akun',
    defaultHint: 'Password awal bawaan: 123',
    icon: Briefcase,
  },
  {
    id: 'admin',
    label: 'Admin',
    title: 'Login Admin Sistem CBT',
    subtitle: 'Pemantauan aktivitas real-time, manajemen user & password, dan kontrol ujian.',
    identifierLabel: 'Username Admin',
    identifierPlaceholder: 'Contoh: admin',
    passwordLabel: 'Password Admin',
    defaultHint: 'Default: admin / admin123',
    icon: ShieldCheck,
  },
];

export function LoginPage({
  initialRole = 'admin',
  connectionState,
  onLoginSuccess,
}: LoginPageProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole);
  const [identifier, setIdentifier] = useState(initialRole === 'admin' ? 'admin' : '');
  const [password, setPassword] = useState(initialRole === 'admin' ? 'admin123' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeConfig = useMemo(
    () => ROLE_CONFIG.find((r) => r.id === selectedRole) || ROLE_CONFIG[0],
    [selectedRole]
  );

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setIdentifier(role === 'admin' ? 'admin' : '');
    setPassword(role === 'admin' ? 'admin123' : '');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          identifier: identifier.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal masuk ke sistem.');
        return;
      }
      onLoginSuccess(data.user as PublicUserAccount);
    } catch {
      setErrorMsg('Tidak dapat menghubungi server CBT.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ActiveIcon = activeConfig.icon;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Institutional Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <MedinaLogo className="w-9 h-9 shrink-0" />
            <span className="font-display font-bold text-base text-slate-900 whitespace-nowrap">
              SMK Medina Bandung
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                connectionState === 'connected' ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {connectionState === 'connected' ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Server CBT Terhubung</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Menghubungkan...</span>
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Main 2-Column Login Stage */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Institutional Brief */}
          <div className="lg:col-span-5 bg-[#0F2A52] text-white rounded-xl p-8 sm:p-10 flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <div className="text-xs font-medium text-sky-200">
                Sistem Ujian Berbasis Komputer (CBT) &amp; Monitoring Real-Time
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-balance">
                Portal Akademik Ujian Online SMK Medina Bandung
              </h1>
              <p className="text-sm text-slate-200 leading-relaxed">
                Platform terintegrasi untuk pelaksanaan Penilaian Tengah Semester (PTS) dan Penilaian Akhir Semester (PAS) bagi seluruh sivitas SMK Medina Bandung.
              </p>
            </div>

            <div className="space-y-4 border-t border-white/15 pt-6 text-sm text-slate-200">
              <div>
                <div className="font-semibold text-white">Empat Akses Peran Terpisah</div>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Siswa mengerjakan ujian CBT, Guru menyusun bank soal &amp; menilai esai, Karyawan memantau administrasi ruang, dan Admin mengontrol pemantauan real-time serta mengelola akun &amp; password seluruh pengguna.
                </p>
              </div>
              <div className="text-xs text-sky-200">
                Setiap sesi login dan aktivitas ujian dipantau secara langsung oleh Admin Sistem melalui saluran WebSocket.
              </div>
            </div>
          </div>

          {/* Right Multi-Role Login Card */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Role Segmented Tabs */}
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">
                  Pilih Peran Masuk ke Sistem
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  {ROLE_CONFIG.map((rc) => {
                    const Icon = rc.icon;
                    const active = selectedRole === rc.id;
                    return (
                      <button
                        key={rc.id}
                        type="button"
                        onClick={() => handleSelectRole(rc.id)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-white text-[#0F2A52] shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{rc.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Role Title */}
              <div className="flex items-start gap-3 pt-1">
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-[#0F2A52] flex items-center justify-center shrink-0">
                  <ActiveIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{activeConfig.title}</h2>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                    {activeConfig.subtitle}
                  </p>
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {activeConfig.identifierLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={activeConfig.identifierPlaceholder}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-700">
                      {activeConfig.passwordLabel}
                    </label>
                    <span className="text-[11px] text-slate-400">{activeConfig.defaultHint}</span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password..."
                      className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isSubmitting
                    ? 'Memverifikasi Kredensial...'
                    : `Masuk sebagai ${activeConfig.label}`}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-xs text-slate-500">
        SMK Medina Bandung · Portal Ujian PTS &amp; PAS Terpadu
      </footer>
    </div>
  );
}
