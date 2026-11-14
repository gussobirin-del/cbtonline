import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  MajorConfig,
  PublicUserAccount,
  UserAccount,
  UserRole,
} from '../../types/cbt.ts';

interface UsersManagerViewProps {
  currentUser: PublicUserAccount;
  syncedPublicUsers: PublicUserAccount[];
  majorsList: MajorConfig[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin Sistem',
  guru: 'Guru',
  siswa: 'Siswa',
  karyawan: 'Karyawan',
};

export function UsersManagerView({
  currentUser,
  syncedPublicUsers,
  majorsList,
}: UsersManagerViewProps) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Create / Edit User Modal
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [formRole, setFormRole] = useState<UserRole>('guru');
  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formJurusan, setFormJurusan] = useState('TKJ');
  const [formGradeLevel, setFormGradeLevel] = useState('XII');
  const [formPassword, setFormPassword] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Password Change Modal
  const [passwordTarget, setPasswordTarget] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPw, setIsUpdatingPw] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);

  const fetchFullUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = (await res.json()) as { users: UserAccount[] };
        setUsers(data.users);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFullUsers();
  }, [fetchFullUsers, syncedPublicUsers]);

  const counts = useMemo(() => {
    return {
      total: users.length,
      guru: users.filter((u) => u.role === 'guru').length,
      siswa: users.filter((u) => u.role === 'siswa').length,
      karyawan: users.filter((u) => u.role === 'karyawan').length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.unit.toLowerCase().includes(q) ||
        ROLE_LABELS[u.role].toLowerCase().includes(q)
      );
    });
  }, [users, roleFilter, searchQuery]);

  const showToast = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let out = '';
    for (let i = 0; i < 8; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  };

  const openCreateModal = () => {
    setModalMode('create');
    setEditingUser(null);
    setFormRole('guru');
    setFormUsername('');
    setFormName('');
    setFormUnit('Guru Mata Pelajaran');
    setFormJurusan('TKJ');
    setFormGradeLevel('XII');
    setFormPassword(generatePassword());
    setFormIsActive(true);
    setFormError(null);
  };

  const openEditModal = (u: UserAccount) => {
    setModalMode('edit');
    setEditingUser(u);
    setFormRole(u.role);
    setFormUsername(u.username);
    setFormName(u.name);
    setFormUnit(u.unit);
    setFormJurusan(u.jurusan || 'TKJ');
    setFormGradeLevel(u.gradeLevel || 'XII');
    setFormIsActive(u.isActive);
    setFormError(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      if (modalMode === 'create') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: formRole,
            username: formUsername.trim(),
            name: formName.trim(),
            unit: formUnit.trim(),
            jurusan: formRole === 'siswa' || formRole === 'guru' ? formJurusan : undefined,
            gradeLevel: formRole === 'siswa' ? formGradeLevel : undefined,
            password: formPassword,
            isActive: formIsActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || 'Gagal membuat akun baru.');
          return;
        }
        setModalMode(null);
        await fetchFullUsers();
        showToast(`Akun ${ROLE_LABELS[formRole]} "${formName.trim()}" berhasil dibuat.`);
      } else if (modalMode === 'edit' && editingUser) {
        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: formRole,
            username: formUsername.trim(),
            name: formName.trim(),
            unit: formUnit.trim(),
            jurusan: formRole === 'siswa' || formRole === 'guru' ? formJurusan : undefined,
            gradeLevel: formRole === 'siswa' ? formGradeLevel : undefined,
            isActive: formIsActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setFormError(data.error || 'Gagal memperbarui akun.');
          return;
        }
        setModalMode(null);
        await fetchFullUsers();
        showToast(`Data akun "${formName.trim()}" berhasil diperbarui.`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPasswordModal = (u: UserAccount) => {
    setPasswordTarget(u);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;
    setPasswordError(null);
    if (newPassword.length < 3) {
      setPasswordError('Password baru minimal 3 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password tidak cocok.');
      return;
    }

    setIsUpdatingPw(true);
    try {
      const res = await fetch(`/api/admin/users/${passwordTarget.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || 'Gagal mengubah password.');
        return;
      }
      const targetName = passwordTarget.name;
      setPasswordTarget(null);
      await fetchFullUsers();
      showToast(`Password untuk "${targetName}" telah diperbarui.`);
    } finally {
      setIsUpdatingPw(false);
    }
  };

  const handleToggleActive = async (u: UserAccount) => {
    if (u.id === currentUser.id) return;
    await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    await fetchFullUsers();
    showToast(
      `Akun "${u.name}" kini berstatus ${!u.isActive ? 'Aktif' : 'Nonaktif'}.`
    );
  };

  const handleDeleteUser = async (u: UserAccount) => {
    await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    setDeleteTarget(null);
    await fetchFullUsers();
    showToast(`Akun "${u.name}" telah dihapus.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Manajemen User &amp; Password (Guru, Siswa, Karyawan, Admin)
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Wewenang khusus Admin Sistem untuk membuat akun baru, mengubah peran, menonaktifkan akses, serta mengatur atau mereset password pengguna.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] rounded-lg transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah User Baru</span>
        </button>
      </div>

      {feedbackBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* 4-Column Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Akun Sistem</div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-900">
            {counts.total}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Akun Guru</div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-900">
            {counts.guru}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Akun Siswa</div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-900">
            {counts.siswa}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Akun Karyawan</div>
          <div className="mt-2 text-3xl font-bold font-mono tabular-nums text-slate-900">
            {counts.karyawan}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, username / NIS, atau unit..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto self-start">
          {(
            [
              { id: 'all', label: 'Semua' },
              { id: 'guru', label: 'Guru' },
              { id: 'siswa', label: 'Siswa' },
              { id: 'karyawan', label: 'Karyawan' },
              { id: 'admin', label: 'Admin' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                roleFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3.5 px-5">Nama &amp; Unit / Kelas</th>
                <th className="py-3.5 px-4">Peran</th>
                <th className="py-3.5 px-4">Username / NIS</th>
                <th className="py-3.5 px-4">Password</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 px-5 text-center text-slate-500">
                    Memuat data akun pengguna...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-5 text-center text-slate-500">
                    Tidak ada akun yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const revealed = Boolean(revealedIds[u.id]);
                  const isSelf = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-slate-900">
                          {u.name}
                          {isSelf && (
                            <span className="text-xs font-normal text-sky-700 ml-2">
                              (Anda)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{u.unit}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">
                        {ROLE_LABELS[u.role]}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-800">
                        {u.username}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-2 font-mono text-xs text-slate-700">
                          <span className="min-w-[64px]">
                            {revealed ? u.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedIds((prev) => ({
                                ...prev,
                                [u.id]: !prev[u.id],
                              }))
                            }
                            aria-label={revealed ? 'Sembunyikan password' : 'Lihat password'}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded"
                          >
                            {revealed ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
                            <Ban className="w-3.5 h-3.5" />
                            <span>Nonaktif</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPasswordModal(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#0F2A52] bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Ubah Password</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            aria-label={`Edit ${u.name}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!isSelf && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleActive(u)}
                                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                                  u.isActive
                                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                }`}
                              >
                                {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(u)}
                                aria-label={`Hapus ${u.name}`}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-semibold text-slate-900">
                {modalMode === 'create' ? 'Tambah Akun Pengguna Baru' : 'Edit Profil Pengguna'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Peran Akun
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setFormRole(nextRole);
                      if (modalMode === 'create') {
                        if (nextRole === 'siswa') setFormUnit(`${formGradeLevel} ${formJurusan} 1`);
                        else if (nextRole === 'guru') setFormUnit('Guru Produktif');
                        else if (nextRole === 'karyawan') setFormUnit('Staf Tata Usaha');
                        else setFormUnit('Administrator CBT');
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900"
                  >
                    <option value="guru">Guru</option>
                    <option value="siswa">Siswa</option>
                    <option value="karyawan">Karyawan</option>
                    <option value="admin">Admin Sistem</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {formRole === 'siswa' ? 'NIS Siswa' : 'Username / NIP'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder={formRole === 'siswa' ? '20241099' : 'Contoh: guru.dkv'}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nama lengkap beserta gelar (jika guru)"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              {formRole === 'siswa' ? (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Tingkat
                    </label>
                    <select
                      value={formGradeLevel}
                      onChange={(e) => {
                        const g = e.target.value;
                        setFormGradeLevel(g);
                        setFormUnit(`${g} ${formJurusan} 1`);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="X">X</option>
                      <option value="XI">XI</option>
                      <option value="XII">XII</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Jurusan
                    </label>
                    <select
                      value={formJurusan}
                      onChange={(e) => {
                        const j = e.target.value;
                        setFormJurusan(j);
                        setFormUnit(`${formGradeLevel} ${j} 1`);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      {majorsList.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.code} — {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Kelas
                    </label>
                    <input
                      type="text"
                      required
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Jabatan / Mata Pelajaran / Bagian
                  </label>
                  <input
                    type="text"
                    required
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="Contoh: Guru Bahasa Indonesia / Staf Tata Usaha"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              )}

              {modalMode === 'create' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Password Awal
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-sm border border-slate-200 rounded-lg font-mono text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setFormPassword(generatePassword())}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Acak</span>
                    </button>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#0F2A52]"
                />
                <span>Akun aktif dan diizinkan masuk ke sistem</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] disabled:opacity-50 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Akun'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs text-slate-500">
                  {ROLE_LABELS[passwordTarget.role]} · {passwordTarget.username}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Ubah Password Pengguna
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPasswordTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Atur ulang password login untuk{' '}
              <strong className="text-slate-900">{passwordTarget.name}</strong>. Password baru
              berlaku seketika pada login berikutnya.
            </p>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {passwordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3.5 py-2.5 rounded-lg">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Password Baru
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 3 karakter"
                    className="flex-1 px-3.5 py-2 text-sm border border-slate-200 rounded-lg font-mono text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const pw = generatePassword();
                      setNewPassword(pw);
                      setConfirmPassword(pw);
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="text"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg font-mono text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordTarget(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPw}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2A52] hover:bg-[#173B70] disabled:opacity-50 rounded-lg"
                >
                  {isUpdatingPw ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Hapus Akun Pengguna</h3>
            <p className="text-sm text-slate-600">
              Apakah Anda yakin ingin menghapus akun{' '}
              <strong className="text-slate-900">{deleteTarget.name}</strong> (
              {ROLE_LABELS[deleteTarget.role]} · {deleteTarget.username})? Pengguna tidak lagi dapat
              masuk ke sistem.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(deleteTarget)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
