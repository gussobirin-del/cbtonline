import fs from 'node:fs';
import path from 'node:path';
import type {
  ActivityEvent,
  BroadcastNotice,
  Exam,
  ExamAttempt,
  MajorConfig,
  PublicUserAccount,
  Student,
  UserAccount,
  UserRole,
} from '../src/types/cbt.ts';

export interface PersistedDatabase {
  exams: Exam[];
  students: Student[];
  users: UserAccount[];
  majors: MajorConfig[];
  attempts: ExamAttempt[];
  activities: ActivityEvent[];
  latestBroadcast: BroadcastNotice | null;
}

function buildDefaultMajors(): MajorConfig[] {
  return [
    { code: 'TKJ', name: 'Teknik Komputer & Jaringan' },
    { code: 'RPL', name: 'Rekayasa Perangkat Lunak' },
    { code: 'DKV', name: 'Desain Komunikasi Visual' },
    { code: 'AKL', name: 'Akuntansi & Keuangan Lembaga' },
  ];
}

function buildStaffSeedUsers(nowIso: string): UserAccount[] {
  return [
    {
      id: 'usr-admin-1',
      role: 'admin',
      username: 'admin',
      password: 'admin123',
      name: 'Drs. Hendarman',
      unit: 'Administrator Sistem CBT',
      isActive: true,
      createdAt: nowIso,
    },
    {
      id: 'usr-guru-1',
      role: 'guru',
      username: 'guru.tkj',
      password: '123',
      name: 'Budi Santoso, S.Kom',
      unit: 'Guru Produktif TKJ',
      jurusan: 'TKJ',
      isActive: true,
      createdAt: nowIso,
    },
    {
      id: 'usr-guru-2',
      role: 'guru',
      username: 'guru.rpl',
      password: '123',
      name: 'Rina Wulandari, M.Kom',
      unit: 'Guru Produktif RPL',
      jurusan: 'RPL',
      isActive: true,
      createdAt: nowIso,
    },
    {
      id: 'usr-guru-3',
      role: 'guru',
      username: 'guru.mtk',
      password: '123',
      name: 'Deden Kurniawan, S.Pd',
      unit: 'Guru Matematika Terapan',
      isActive: true,
      createdAt: nowIso,
    },
    {
      id: 'usr-karyawan-1',
      role: 'karyawan',
      username: 'tu.medina',
      password: '123',
      name: 'Siti Aminah',
      unit: 'Staf Tata Usaha Akademik',
      isActive: true,
      createdAt: nowIso,
    },
    {
      id: 'usr-karyawan-2',
      role: 'karyawan',
      username: 'op.lab',
      password: '123',
      name: 'Agus Setiawan',
      unit: 'Teknisi Laboratorium Komputer',
      isActive: true,
      createdAt: nowIso,
    },
  ];
}

function studentToUser(stu: Student, nowIso: string): UserAccount {
  return {
    id: stu.id,
    role: 'siswa',
    username: stu.nis,
    password: stu.pin,
    name: stu.name,
    unit: stu.kelas,
    jurusan: stu.jurusan,
    gradeLevel: stu.gradeLevel,
    isActive: true,
    createdAt: nowIso,
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cbt-db.json');

function createInitialSeed(): PersistedDatabase {
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  const exams: Exam[] = [
    {
      id: 'PTS-TKJ-2026',
      title: 'PTS Ganjil — Administrasi Infrastruktur Jaringan',
      category: 'PTS',
      semester: 'Ganjil',
      academicYear: '2026/2027',
      subject: 'Administrasi Infrastruktur Jaringan',
      gradeLevel: 'XII',
      majors: ['TKJ'],
      durationMinutes: 60,
      token: 'MEDINA-TKJ1',
      status: 'Aktif',
      maxViolations: 3,
      shuffleQuestions: false,
      showResultToStudent: true,
      scheduledAt: '2026-11-14T08:00:00',
      createdAt: hoursAgo(48),
      questions: [
        {
          id: 'q-tkj-1',
          type: 'pg',
          prompt:
            'Pada konfigurasi router MikroTik, protokol yang digunakan untuk menerjemahkan alamat IP privat jaringan lokal menjadi alamat IP publik agar dapat mengakses internet adalah...',
          options: [
            'DHCP Server',
            'Source NAT (Masquerade)',
            'ARP Proxy',
            'Static Route',
            'DNS Forwarder',
          ],
          correctIndex: 1,
          points: 20,
        },
        {
          id: 'q-tkj-2',
          type: 'pg',
          prompt:
            'Standar IEEE yang mengatur mekanisme VLAN Tagging (trunking) pada switch manageable adalah...',
          options: [
            'IEEE 802.11ac',
            'IEEE 802.3u',
            'IEEE 802.1Q',
            'IEEE 802.1X',
            'IEEE 802.1D',
          ],
          correctIndex: 2,
          points: 20,
        },
        {
          id: 'q-tkj-3',
          type: 'pg',
          prompt:
            'Sebuah subnet memiliki prefix /27. Berapakah jumlah alamat IP host yang valid dan dapat digunakan oleh perangkat klien pada subnet tersebut?',
          options: ['14 host', '30 host', '32 host', '62 host', '126 host'],
          correctIndex: 1,
          points: 20,
        },
        {
          id: 'q-tkj-4',
          type: 'pg',
          prompt:
            'Perintah pada Cisco IOS untuk melihat tabel routing yang sedang aktif di router adalah...',
          options: [
            'show interfaces brief',
            'show vlan brief',
            'show ip route',
            'show running-config',
            'traceroute ip',
          ],
          correctIndex: 2,
          points: 20,
        },
        {
          id: 'q-tkj-5',
          type: 'pg',
          prompt:
            'Manakah port default yang digunakan oleh layanan SSH (Secure Shell) untuk remote administration perangkat server Linux?',
          options: ['Port 21', 'Port 22', 'Port 23', 'Port 80', 'Port 443'],
          correctIndex: 1,
          points: 20,
        },
      ],
    },
    {
      id: 'PTS-RPL-2026',
      title: 'PTS Ganjil — Pemrograman Web & Basis Data',
      category: 'PTS',
      semester: 'Ganjil',
      academicYear: '2026/2027',
      subject: 'Pemrograman Web & Basis Data',
      gradeLevel: 'XII',
      majors: ['RPL'],
      durationMinutes: 60,
      token: 'MEDINA-RPL1',
      status: 'Aktif',
      maxViolations: 3,
      shuffleQuestions: false,
      showResultToStudent: true,
      scheduledAt: '2026-11-14T08:00:00',
      createdAt: hoursAgo(40),
      questions: [
        {
          id: 'q-rpl-1',
          type: 'pg',
          prompt:
            'Dalam perancangan basis data relasional, constraint yang menjamin setiap nilai pada kolom kunci tamu cocok dengan nilai primary key di tabel induk disebut...',
          options: [
            'Unique Constraint',
            'Check Constraint',
            'Referential Integrity (Foreign Key)',
            'Auto Increment',
            'Composite Index',
          ],
          correctIndex: 2,
          points: 20,
        },
        {
          id: 'q-rpl-2',
          type: 'pg',
          prompt:
            'Kode status HTTP yang tepat dikembalikan oleh REST API ketika permintaan POST berhasil membuat resource baru di server adalah...',
          options: ['200 OK', '201 Created', '204 No Content', '302 Found', '400 Bad Request'],
          correctIndex: 1,
          points: 20,
        },
        {
          id: 'q-rpl-3',
          type: 'pg',
          prompt:
            'Pada React, hook mana yang digunakan untuk menjalankan side-effect seperti berlangganan koneksi WebSocket saat komponen pertama kali dimuat?',
          options: ['useState', 'useMemo', 'useEffect', 'useCallback', 'useReducer'],
          correctIndex: 2,
          points: 20,
        },
        {
          id: 'q-rpl-4',
          type: 'pg',
          prompt:
            'Serangan keamanan web di mana penyerang menyisipkan skrip SQL berbahaya melalui input formulir untuk memanipulasi kueri database disebut...',
          options: [
            'Cross-Site Scripting (XSS)',
            'SQL Injection',
            'CSRF',
            'DDoS Amplification',
            'Clickjacking',
          ],
          correctIndex: 1,
          points: 20,
        },
        {
          id: 'q-rpl-5',
          type: 'esai',
          prompt:
            'Jelaskan perbedaan utama antara protokol HTTP stateless dengan WebSocket dalam membangun sistem pemantauan aktivitas real-time!',
          options: [],
          correctIndex: 0,
          points: 20,
        },
      ],
    },
    {
      id: 'PAS-MTK-2026',
      title: 'PAS Ganjil — Matematika Terapan Kejuruan',
      category: 'PAS',
      semester: 'Ganjil',
      academicYear: '2026/2027',
      subject: 'Matematika Terapan',
      gradeLevel: 'Semua Tingkat',
      majors: ['TKJ', 'RPL', 'DKV', 'AKL'],
      durationMinutes: 90,
      token: 'MEDINA-MTK26',
      status: 'Aktif',
      maxViolations: 3,
      shuffleQuestions: false,
      showResultToStudent: true,
      scheduledAt: '2026-11-14T09:30:00',
      createdAt: hoursAgo(36),
      questions: [
        {
          id: 'q-mtk-1',
          type: 'pg',
          prompt:
            'Diketahui matriks A = [[3, 2], [1, 4]]. Berapakah nilai determinan dari matriks A tersebut?',
          options: ['6', '8', '10', '12', '14'],
          correctIndex: 2,
          points: 25,
        },
        {
          id: 'q-mtk-2',
          type: 'pg',
          prompt:
            'Barisan aritmetika memiliki suku pertama U1 = 5 dan beda b = 4. Berapakah nilai suku ke-10 (U10)?',
          options: ['37', '41', '45', '49', '53'],
          correctIndex: 1,
          points: 25,
        },
        {
          id: 'q-mtk-3',
          type: 'pg',
          prompt:
            'Dalam sebuah laboratorium komputer SMK Medina Bandung terdapat 6 komputer TKJ dan 4 komputer RPL. Jika dipilih 1 komputer secara acak, peluang terpilihnya komputer RPL adalah...',
          options: ['0,20', '0,35', '0,40', '0,50', '0,60'],
          correctIndex: 2,
          points: 25,
        },
        {
          id: 'q-mtk-4',
          type: 'pg',
          prompt:
            'Nilai rata-rata ujian praktik dari 5 siswa adalah 84. Jika 1 siswa susulan bergabung dan rata-ratanya menjadi 85, berapakah nilai siswa susulan tersebut?',
          options: ['86', '88', '90', '92', '95'],
          correctIndex: 2,
          points: 25,
        },
      ],
    },
    {
      id: 'PAS-IND-2026',
      title: 'PAS Ganjil — Bahasa Indonesia & Korespondensi Vokasi',
      category: 'PAS',
      semester: 'Ganjil',
      academicYear: '2026/2027',
      subject: 'Bahasa Indonesia',
      gradeLevel: 'XI',
      majors: ['DKV', 'AKL', 'TKJ', 'RPL'],
      durationMinutes: 75,
      token: 'MEDINA-IND1',
      status: 'Terjadwal',
      maxViolations: 3,
      shuffleQuestions: false,
      showResultToStudent: false,
      scheduledAt: '2026-11-16T08:00:00',
      createdAt: hoursAgo(24),
      questions: [
        {
          id: 'q-ind-1',
          type: 'pg',
          prompt:
            'Bagian pada teks laporan hasil observasi praktik kerja industri yang memuat ringkasan atau manfaat pengamatan disebut...',
          options: [
            'Pernyataan umum',
            'Deskripsi bagian',
            'Deskripsi manfaat / simpulan',
            'Orientasi masalah',
            'Koda argumentasi',
          ],
          correctIndex: 2,
          points: 50,
        },
        {
          id: 'q-ind-2',
          type: 'pg',
          prompt:
            'Penulisan kata baku yang sesuai dengan Pedoman Umum Ejaan Bahasa Indonesia (EYD V) adalah...',
          options: [
            'Aktifitas, praktek, analisa',
            'Aktivitas, praktik, analisis',
            'Aktivitas, praktek, analisa',
            'Aktifitas, praktik, analisis',
            'Aktivita, praktikum, analis',
          ],
          correctIndex: 1,
          points: 50,
        },
      ],
    },
    {
      id: 'PTS-PKK-2026',
      title: 'PTS Ganjil — Produk Kreatif & Kewirausahaan',
      category: 'PTS',
      semester: 'Ganjil',
      academicYear: '2026/2027',
      subject: 'Produk Kreatif & Kewirausahaan',
      gradeLevel: 'XI',
      majors: ['DKV', 'AKL'],
      durationMinutes: 60,
      token: 'MEDINA-PKK9',
      status: 'Selesai',
      maxViolations: 3,
      shuffleQuestions: false,
      showResultToStudent: true,
      scheduledAt: '2026-11-10T10:00:00',
      createdAt: hoursAgo(120),
      questions: [
        {
          id: 'q-pkk-1',
          type: 'pg',
          prompt:
            'Analisis peluang usaha yang memetakan Kekuatan, Kelemahan, Peluang, dan Ancaman dikenal dengan metode...',
          options: ['SMART', 'SWOT', 'PDCA', 'AIDA', 'LEAN'],
          correctIndex: 1,
          points: 50,
        },
        {
          id: 'q-pkk-2',
          type: 'pg',
          prompt:
            'Titik di mana total pendapatan sama persis dengan total biaya produksi sehingga usaha tidak mengalami laba maupun rugi disebut...',
          options: [
            'Return on Investment',
            'Gross Margin',
            'Break Even Point (BEP)',
            'Cash Flow Ratio',
            'Net Profit',
          ],
          correctIndex: 2,
          points: 50,
        },
      ],
    },
  ];

  const students: Student[] = [
    {
      id: 'stu-01',
      nis: '20241001',
      name: 'Rafi Pratama Putra',
      kelas: 'XII TKJ 1',
      jurusan: 'TKJ',
      gradeLevel: 'XII',
      pin: '123456',
    },
    {
      id: 'stu-02',
      nis: '20241002',
      name: 'Nadia Azzahra Putri',
      kelas: 'XII TKJ 1',
      jurusan: 'TKJ',
      gradeLevel: 'XII',
      pin: '123456',
    },
    {
      id: 'stu-03',
      nis: '20241003',
      name: 'Fajar Maulana Sidik',
      kelas: 'XII RPL 1',
      jurusan: 'RPL',
      gradeLevel: 'XII',
      pin: '123456',
    },
    {
      id: 'stu-04',
      nis: '20241004',
      name: 'Siti Nurhaliza Rahma',
      kelas: 'XII RPL 1',
      jurusan: 'RPL',
      gradeLevel: 'XII',
      pin: '123456',
    },
    {
      id: 'stu-05',
      nis: '20252001',
      name: 'Dimas Arya Nugraha',
      kelas: 'XI DKV 1',
      jurusan: 'DKV',
      gradeLevel: 'XI',
      pin: '123456',
    },
    {
      id: 'stu-06',
      nis: '20252002',
      name: 'Alya Kusuma Wardani',
      kelas: 'XI AKL 1',
      jurusan: 'AKL',
      gradeLevel: 'XI',
      pin: '123456',
    },
    {
      id: 'stu-07',
      nis: '20241005',
      name: 'Bagas Kurniawan',
      kelas: 'XII TKJ 2',
      jurusan: 'TKJ',
      gradeLevel: 'XII',
      pin: '123456',
    },
    {
      id: 'stu-08',
      nis: '20241006',
      name: 'Intan Permata Sari',
      kelas: 'XII RPL 1',
      jurusan: 'RPL',
      gradeLevel: 'XII',
      pin: '123456',
    },
  ];

  const attempts: ExamAttempt[] = [
    {
      id: 'att-seed-1',
      examId: 'PTS-PKK-2026',
      examTitle: 'PTS Ganjil — Produk Kreatif & Kewirausahaan',
      examCategory: 'PTS',
      studentId: 'stu-05',
      studentNis: '20252001',
      studentName: 'Dimas Arya Nugraha',
      studentKelas: 'XI DKV 1',
      answers: { 'q-pkk-1': 1, 'q-pkk-2': 2 },
      essayScores: {},
      flaggedQuestionIds: [],
      currentQuestionIndex: 1,
      answeredCount: 2,
      totalQuestions: 2,
      violations: 0,
      maxViolations: 3,
      status: 'Selesai',
      score: 100,
      maxScore: 100,
      startedAt: hoursAgo(96),
      submittedAt: hoursAgo(95),
      lastActivityAt: hoursAgo(95),
    },
    {
      id: 'att-seed-2',
      examId: 'PTS-PKK-2026',
      examTitle: 'PTS Ganjil — Produk Kreatif & Kewirausahaan',
      examCategory: 'PTS',
      studentId: 'stu-06',
      studentNis: '20252002',
      studentName: 'Alya Kusuma Wardani',
      studentKelas: 'XI AKL 1',
      answers: { 'q-pkk-1': 1, 'q-pkk-2': 0 },
      essayScores: {},
      flaggedQuestionIds: [],
      currentQuestionIndex: 1,
      answeredCount: 2,
      totalQuestions: 2,
      violations: 1,
      maxViolations: 3,
      status: 'Selesai',
      score: 50,
      maxScore: 100,
      startedAt: hoursAgo(96),
      submittedAt: hoursAgo(95),
      lastActivityAt: hoursAgo(95),
    },
    {
      id: 'att-seed-3',
      examId: 'PTS-TKJ-2026',
      examTitle: 'PTS Ganjil — Administrasi Infrastruktur Jaringan',
      examCategory: 'PTS',
      studentId: 'stu-07',
      studentNis: '20241005',
      studentName: 'Bagas Kurniawan',
      studentKelas: 'XII TKJ 2',
      answers: {
        'q-tkj-1': 1,
        'q-tkj-2': 2,
        'q-tkj-3': 1,
        'q-tkj-4': 2,
        'q-tkj-5': 1,
      },
      essayScores: {},
      flaggedQuestionIds: [],
      currentQuestionIndex: 4,
      answeredCount: 5,
      totalQuestions: 5,
      violations: 0,
      maxViolations: 3,
      status: 'Selesai',
      score: 100,
      maxScore: 100,
      startedAt: hoursAgo(3),
      submittedAt: hoursAgo(2),
      lastActivityAt: hoursAgo(2),
    },
  ];

  const activities: ActivityEvent[] = [
    {
      id: 'act-seed-1',
      timestamp: hoursAgo(2),
      type: 'ujian',
      actorName: 'Bagas Kurniawan',
      actorRole: 'siswa',
      actorMeta: '20241005 · XII TKJ 2',
      message: 'Menyelesaikan ujian dengan nilai 100/100',
      examTitle: 'PTS Ganjil — Administrasi Infrastruktur Jaringan',
    },
  ];

  const nowIso = now.toISOString();
  const users: UserAccount[] = [
    ...buildStaffSeedUsers(nowIso),
    ...students.map((s) => studentToUser(s, nowIso)),
  ];

  return {
    exams,
    students,
    users,
    majors: buildDefaultMajors(),
    attempts,
    activities,
    latestBroadcast: null,
  };
}

class CbtStore {
  private data: PersistedDatabase;

  constructor() {
    this.data = this.load();
  }

  private load(): PersistedDatabase {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedDatabase;
        if (parsed && Array.isArray(parsed.exams) && Array.isArray(parsed.students)) {
          let dirty = false;
          if (!Array.isArray(parsed.majors) || parsed.majors.length === 0) {
            parsed.majors = buildDefaultMajors();
            dirty = true;
          }
          if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
            const nowIso = new Date().toISOString();
            parsed.users = [
              ...buildStaffSeedUsers(nowIso),
              ...parsed.students.map((s) => studentToUser(s, nowIso)),
            ];
            dirty = true;
          } else {
            const adminIdx = parsed.users.findIndex(
              (u) => u.id === 'usr-admin-1' && u.username === 'admin' && u.password === '123'
            );
            if (adminIdx !== -1) {
              parsed.users[adminIdx] = { ...parsed.users[adminIdx], password: 'admin123' };
              dirty = true;
            }
          }
          if (Array.isArray(parsed.activities)) {
            parsed.activities = parsed.activities.map((a) => {
              if ((a.actorRole as string) === 'student') {
                dirty = true;
                return { ...a, actorRole: 'siswa' };
              }
              return a;
            });
          }
          if (dirty) {
            this.save(parsed);
          }
          return parsed;
        }
      }
    } catch (err) {
      console.error('Gagal membaca database CBT, memuat data awal:', err);
    }
    const seed = createInitialSeed();
    this.save(seed);
    return seed;
  }

  private save(nextData?: PersistedDatabase) {
    if (nextData) {
      this.data = nextData;
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Gagal menyimpan database CBT:', err);
    }
  }

  getExams() {
    return this.data.exams;
  }

  getExamById(id: string) {
    return this.data.exams.find((e) => e.id === id);
  }

  createExam(exam: Exam) {
    this.data.exams.unshift(exam);
    this.save();
    return exam;
  }

  updateExam(id: string, patch: Partial<Exam>) {
    const idx = this.data.exams.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    this.data.exams[idx] = { ...this.data.exams[idx], ...patch };
    this.save();
    return this.data.exams[idx];
  }

  deleteExam(id: string) {
    const before = this.data.exams.length;
    this.data.exams = this.data.exams.filter((e) => e.id !== id);
    if (this.data.exams.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  getStudents() {
    return this.data.students;
  }

  findStudentByNis(nis: string) {
    return this.data.students.find((s) => s.nis.trim() === nis.trim());
  }

  addStudent(student: Student) {
    this.data.students.unshift(student);
    const existingUser = this.data.users.find(
      (u) => u.id === student.id || u.username.toLowerCase() === student.nis.toLowerCase()
    );
    if (!existingUser) {
      this.data.users.unshift(studentToUser(student, new Date().toISOString()));
    }
    this.save();
    return student;
  }

  deleteStudent(id: string) {
    const before = this.data.students.length;
    this.data.students = this.data.students.filter((s) => s.id !== id);
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.students.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  // --- Unified User & Password Management ---

  getUsers(): UserAccount[] {
    return this.data.users;
  }

  getPublicUsers(): PublicUserAccount[] {
    return this.data.users.map(({ password: _pw, ...rest }) => rest);
  }

  findUserById(id: string): UserAccount | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  findUserByUsername(username: string): UserAccount | undefined {
    return this.data.users.find(
      (u) => u.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
  }

  authenticateUser(role: UserRole, identifier: string, password: string): {
    user?: UserAccount;
    error?: string;
  } {
    const cleanId = identifier.trim().toLowerCase();
    const user = this.data.users.find(
      (u) => u.role === role && u.username.trim().toLowerCase() === cleanId
    );
    if (!user) {
      return { error: `Akun ${role} dengan ID "${identifier}" tidak ditemukan.` };
    }
    if (!user.isActive) {
      return { error: 'Akun ini sedang dinonaktifkan oleh Admin Sistem.' };
    }
    if (user.password !== password) {
      return { error: 'Password atau PIN tidak sesuai. Hubungi Admin jika lupa password.' };
    }
    return { user };
  }

  createUser(user: UserAccount): UserAccount {
    this.data.users.unshift(user);
    if (user.role === 'siswa') {
      const stu: Student = {
        id: user.id,
        nis: user.username,
        name: user.name,
        kelas: user.unit || 'XII TKJ 1',
        jurusan: user.jurusan || 'TKJ',
        gradeLevel: user.gradeLevel || 'XII',
        pin: user.password,
      };
      this.data.students.unshift(stu);
    }
    this.save();
    return user;
  }

  updateUser(id: string, patch: Partial<Omit<UserAccount, 'id' | 'createdAt'>>): UserAccount | null {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    const prev = this.data.users[idx];
    const updated: UserAccount = { ...prev, ...patch };
    this.data.users[idx] = updated;

    // Sync student record if role is siswa
    if (updated.role === 'siswa') {
      const sIdx = this.data.students.findIndex((s) => s.id === id);
      const stu: Student = {
        id: updated.id,
        nis: updated.username,
        name: updated.name,
        kelas: updated.unit,
        jurusan: updated.jurusan || 'TKJ',
        gradeLevel: updated.gradeLevel || 'XII',
        pin: updated.password,
      };
      if (sIdx === -1) {
        this.data.students.unshift(stu);
      } else {
        this.data.students[sIdx] = stu;
      }
    } else if (prev.role === 'siswa') {
      this.data.students = this.data.students.filter((s) => s.id !== id);
    }

    this.save();
    return updated;
  }

  updateUserPassword(id: string, newPassword: string): UserAccount | null {
    return this.updateUser(id, { password: newPassword });
  }

  deleteUser(id: string): boolean {
    const before = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    this.data.students = this.data.students.filter((s) => s.id !== id);
    if (this.data.users.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  getAttempts() {
    return this.data.attempts;
  }

  getAttemptById(id: string) {
    return this.data.attempts.find((a) => a.id === id);
  }

  findActiveAttempt(examId: string, studentId: string) {
    return this.data.attempts.find(
      (a) =>
        a.examId === examId &&
        a.studentId === studentId &&
        (a.status === 'Sedang Ujian' || a.status === 'Terkunci Pelanggaran')
    );
  }

  upsertAttempt(attempt: ExamAttempt) {
    const idx = this.data.attempts.findIndex((a) => a.id === attempt.id);
    if (idx === -1) {
      this.data.attempts.unshift(attempt);
    } else {
      this.data.attempts[idx] = attempt;
    }
    this.save();
    return attempt;
  }

  getActivities() {
    return this.data.activities;
  }

  pushActivity(event: ActivityEvent) {
    this.data.activities.unshift(event);
    if (this.data.activities.length > 200) {
      this.data.activities = this.data.activities.slice(0, 200);
    }
    this.save();
    return event;
  }

  getLatestBroadcast() {
    return this.data.latestBroadcast;
  }

  setLatestBroadcast(notice: BroadcastNotice) {
    this.data.latestBroadcast = notice;
    this.save();
    return notice;
  }

  getMajors(): MajorConfig[] {
    return this.data.majors;
  }

  setMajors(majors: MajorConfig[]): MajorConfig[] {
    this.data.majors = majors;
    this.save();
    return this.data.majors;
  }
}

export const cbtStore = new CbtStore();
