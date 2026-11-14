import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  ExternalLink,
  KeyRound,
  Layers,
  LogOut,
  Menu,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { MedinaLogo } from './components/MedinaLogo.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { useCbtSocket, type SessionRegistration } from './hooks/useCbtSocket.ts';
import { RealtimeMonitorView } from './components/admin/RealtimeMonitorView.tsx';
import { ExamManagerView } from './components/admin/ExamManagerView.tsx';
import { ResultsView } from './components/admin/ResultsView.tsx';
import { StudentsView } from './components/admin/StudentsView.tsx';
import { UsersManagerView } from './components/admin/UsersManagerView.tsx';
import { MajorsSettingsView } from './components/admin/MajorsSettingsView.tsx';
import { StudentPortal } from './components/student/StudentPortal.tsx';
import type {
  ExamAttempt,
  PublicUserAccount,
  Student,
  UserRole,
} from './types/cbt.ts';

type StaffTab = 'monitor' | 'exams' | 'results' | 'users' | 'majors' | 'students';

const SESSION_STORAGE_KEY = 'smk_medina_cbt_user';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin Sistem',
  guru: 'Guru Pengampu',
  siswa: 'Peserta Didik',
  karyawan: 'Karyawan / TU',
};

const ALL_NAV_ITEMS: {
  id: StaffTab;
  label: string;
  icon: typeof Activity;
  roles: UserRole[];
}[] = [
  {
    id: 'monitor',
    label: 'Monitoring Real-Time',
    icon: Activity,
    roles: ['admin', 'guru', 'karyawan'],
  },
  {
    id: 'exams',
    label: 'Ujian PTS & PAS',
    icon: BookOpen,
    roles: ['admin', 'guru', 'karyawan'],
  },
  {
    id: 'results',
    label: 'Hasil & Rekap Nilai',
    icon: Award,
    roles: ['admin', 'guru', 'karyawan'],
  },
  {
    id: 'users',
    label: 'Manajemen User & Password',
    icon: KeyRound,
    roles: ['admin'],
  },
  {
    id: 'majors',
    label: 'Pengaturan Jurusan',
    icon: Layers,
    roles: ['admin'],
  },
  {
    id: 'students',
    label: 'Data Peserta',
    icon: Users,
    roles: ['admin', 'guru', 'karyawan'],
  },
];

function readStoredUser(): PublicUserAccount | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicUserAccount;
  } catch {
    return null;
  }
}

export default function App() {
  const initialLoginRole: UserRole =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mode') === 'ujian'
      ? 'siswa'
      : 'admin';

  const [currentUser, setCurrentUser] = useState<PublicUserAccount | null>(() =>
    readStoredUser()
  );
  const [activeTab, setActiveTab] = useState<StaffTab>('monitor');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);

  const visibleNavItems = useMemo(() => {
    if (!currentUser) return [];
    return ALL_NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role));
  }, [currentUser]);

  // Ensure activeTab stays valid if role changes
  useEffect(() => {
    if (
      currentUser &&
      currentUser.role !== 'siswa' &&
      !visibleNavItems.some((item) => item.id === activeTab)
    ) {
      setActiveTab('monitor');
    }
  }, [currentUser, visibleNavItems, activeTab]);

  const activeViewLabel = useMemo(() => {
    if (!currentUser) return 'Halaman Login';
    if (currentUser.role === 'siswa') {
      return activeAttemptId ? 'Mengerjakan Ujian CBT' : 'Lobi Ujian Siswa';
    }
    const found = ALL_NAV_ITEMS.find((n) => n.id === activeTab);
    return found ? found.label : 'Dashboard';
  }, [currentUser, activeTab, activeAttemptId]);

  const registration: SessionRegistration = useMemo(() => {
    if (!currentUser) {
      return {
        role: 'siswa',
        userId: 'guest-unauthenticated',
        userName: 'Tamu',
        userCode: '-',
        kelas: 'Halaman Login',
        activeAttemptId: null,
        currentView: 'Halaman Login',
        status: 'Online',
      };
    }

    return {
      role: currentUser.role,
      userId: currentUser.id,
      userName: currentUser.name,
      userCode: currentUser.username,
      kelas: currentUser.unit,
      activeAttemptId,
      currentView: activeViewLabel,
      status: activeAttemptId ? 'Mengerjakan Ujian' : 'Online',
    };
  }, [currentUser, activeAttemptId, activeViewLabel]);

  const {
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
    setAttempts,
  } = useCbtSocket(registration);

  // Sync currentUser profile / active status if admin edits or deactivates the account live
  useEffect(() => {
    if (!currentUser || users.length === 0) return;
    const latest = users.find((u) => u.id === currentUser.id);
    if (!latest || !latest.isActive) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setCurrentUser(null);
      setActiveAttemptId(null);
    } else if (
      latest.name !== currentUser.name ||
      latest.role !== currentUser.role ||
      latest.unit !== currentUser.unit ||
      latest.username !== currentUser.username
    ) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(latest));
      setCurrentUser(latest);
    }
  }, [users, currentUser]);

  const handleLoginSuccess = (user: PublicUserAccount) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    setCurrentUser(user);
    setActiveAttemptId(null);
    setActiveTab('monitor');
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setCurrentUser(null);
    setActiveAttemptId(null);
  };

  const handleActiveAttemptChange = (attempt: ExamAttempt | null) => {
    setActiveAttemptId(attempt ? attempt.id : null);
    if (attempt) {
      setAttempts((prev) => {
        const idx = prev.findIndex((a) => a.id === attempt.id);
        if (idx === -1) return [attempt, ...prev];
        const next = [...prev];
        next[idx] = attempt;
        return next;
      });
    }
  };

  // --- UNAUTHENTICATED: UNIFIED 4-ROLE LOGIN SCREEN ---
  if (!currentUser) {
    return (
      <LoginPage
        initialRole={initialLoginRole}
        connectionState={connectionState}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // --- SISWA ROLE: STUDENT CBT EXAM PORTAL ---
  if (currentUser.role === 'siswa') {
    const loggedStudent: Student = students.find(
      (s) => s.id === currentUser.id || s.nis === currentUser.username
    ) || {
      id: currentUser.id,
      nis: currentUser.username,
      name: currentUser.name,
      kelas: currentUser.unit,
      jurusan: currentUser.jurusan || 'TKJ',
      gradeLevel: currentUser.gradeLevel || 'XII',
      pin: '',
    };

    return (
      <StudentPortal
        connectionState={connectionState}
        exams={exams}
        students={students}
        attempts={attempts}
        latestBroadcast={latestBroadcast}
        loggedStudent={loggedStudent}
        activeAttemptId={activeAttemptId}
        onLoginStudent={() => {}}
        onLogoutStudent={handleLogout}
        onActiveAttemptChange={handleActiveAttemptChange}
        onSwitchToAdmin={handleLogout}
      />
    );
  }

  // --- ADMIN / GURU / KARYAWAN PORTAL ---
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar (256px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-3">
          <MedinaLogo className="w-9 h-9 shrink-0" />
          <div className="min-w-0">
            <div className="font-display font-bold text-sm text-slate-900 truncate">
              SMK Medina Bandung
            </div>
            <div className="text-xs text-slate-500 truncate">
              {ROLE_LABELS[currentUser.role]}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Navigasi Portal">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0F2A52] text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="px-1">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {currentUser.name}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {currentUser.username} · {currentUser.unit}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar dari Akun</span>
          </button>

          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>Status Server</span>
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                connectionState === 'connected' ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {connectionState === 'connected' ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Reconnecting</span>
                </>
              )}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-full bg-white h-full border-r border-slate-200 flex flex-col z-10">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MedinaLogo className="w-8 h-8" />
                <span className="font-display font-bold text-sm text-slate-900">
                  SMK Medina Bandung
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg ${
                      active
                        ? 'bg-[#0F2A52] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb Left — Primary Action Right */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">
                {ROLE_LABELS[currentUser.role]}
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">{activeViewLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/?mode=ujian"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Tab Login Siswa</span>
            </a>
            {currentUser.role === 'admin' ? (
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className="px-4 py-2 text-xs font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Kelola User &amp; Password
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('exams')}
                className="px-4 py-2 text-xs font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Jadwal Ujian PTS/PAS
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {!isLoaded ? (
            <div className="space-y-4">
              <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : activeTab === 'monitor' ? (
            <RealtimeMonitorView
              connectionState={connectionState}
              exams={exams}
              attempts={attempts}
              liveSessions={liveSessions}
              activities={activities}
              latestBroadcast={latestBroadcast}
              canIntervene={currentUser.role === 'admin' || currentUser.role === 'guru'}
            />
          ) : activeTab === 'exams' ? (
            <ExamManagerView exams={exams} majorsList={majors} />
          ) : activeTab === 'results' ? (
            <ResultsView exams={exams} attempts={attempts} />
          ) : activeTab === 'users' && currentUser.role === 'admin' ? (
            <UsersManagerView
              currentUser={currentUser}
              syncedPublicUsers={users}
              majorsList={majors}
            />
          ) : activeTab === 'majors' && currentUser.role === 'admin' ? (
            <MajorsSettingsView majors={majors} />
          ) : (
            <StudentsView students={students} majorsList={majors} />
          )}
        </main>
      </div>
    </div>
  );
}
