"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/* ----------------------------- Types & data ----------------------------- */

type Status = "todo" | "in-progress" | "done";
type ViewMode = "dashboard" | "kanban" | "docs";
type SortKey = "date-asc" | "date-desc" | "status" | "assignee";

interface Task {
  id: number;
  date: string;
  name: string;
  assignee: string;
  location: string;
  status: Status;
  updatedAt: string;
}

const STORAGE_KEY = "thesis-tracker:tasks";
const ASSIGNEES = ["Thành", "Bạn chung nhóm"];

const STATUS_META: Record<Status, { label: string; badge: string; dot: string }> = {
  todo: { label: "Chưa bắt đầu", badge: "bg-slate-100 text-slate-600 border-slate-300", dot: "bg-slate-400" },
  "in-progress": { label: "Đang thực hiện", badge: "bg-amber-50 text-amber-700 border-amber-300", dot: "bg-amber-500" },
  done: { label: "Hoàn thành", badge: "bg-emerald-50 text-emerald-700 border-emerald-300", dot: "bg-emerald-500" },
};

const STATUS_ORDER: Status[] = ["todo", "in-progress", "done"];

const SORT_LABEL: Record<SortKey, string> = {
  "date-asc": "Ngày · cũ nhất trước",
  "date-desc": "Ngày · mới nhất trước",
  status: "Theo trạng thái",
  assignee: "Theo người làm",
};

const nowISO = () => new Date().toISOString();

const seedTasks = (): Task[] => [
  {
    id: 1,
    date: "2026-08-14",
    name: "Tổng quan tài liệu nhận diện vết nứt",
    assignee: "Thành",
    location: "Drive/Tài liệu",
    status: "in-progress",
    updatedAt: nowISO(),
  },
];

const emptyForm = (): Omit<Task, "id" | "updatedAt"> => ({
  date: new Date().toISOString().split("T")[0],
  name: "",
  assignee: ASSIGNEES[0],
  location: "",
  status: "todo",
});

/* --------------------------------- Icons --------------------------------- */

const Icon = {
  Dashboard: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <rect x="2.5" y="2.5" width="6" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11.5" y="2.5" width="6" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11.5" y="10" width="6" height="7.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="13" width="6" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  Kanban: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <rect x="2.5" y="3" width="4.5" height="14" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="7.75" y="3" width="4.5" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="13" y="3" width="4.5" height="11" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  Docs: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path d="M5 2.5h7l3.5 3.5V17a1 1 0 01-1 1H5a1 1 0 01-1-1V3.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 2.5V6a1 1 0 001 1h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  Search: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M17 17l-3.8-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Plus: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Dots: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="currentColor" className={p.className}>
      <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
    </svg>
  ),
  Pencil: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path d="M13.5 3.5l3 3L6 17H3v-3l10.5-10.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  Trash: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m-6.5 0l.6 10a1 1 0 001 1h4.8a1 1 0 001-1l.6-10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  X: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  ArrowRight: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ArrowLeft: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path d="M16 10H5M10 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Undo: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path d="M5 8h7a3.5 3.5 0 010 7H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 4.5L5 8l3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ------------------------------- Component ------------------------------- */

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<ViewMode>("dashboard");
  const [formData, setFormData] = useState<Omit<Task, "id" | "updatedAt">>(emptyForm());
  const [errors, setErrors] = useState<{ name?: string; date?: string }>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("date-asc");
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* Load / persist */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setTasks(raw ? (JSON.parse(raw) as Task[]) : seedTasks());
    } catch {
      setTasks(seedTasks());
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      /* storage unavailable — state still works in-memory */
    }
  }, [tasks, hydrated]);

  /* Outside click closes the row menu */
  useEffect(() => {
    if (openDropdown === null) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openDropdown]);

  /* Escape closes whatever is open */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setFormOpen(false);
      setOpenDropdown(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const showToast = (message: string, onUndo?: () => void) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, onUndo });
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  };

  const sendEmail = async (taskName: string, status: string, user: string) => {
    try {
      await fetch("/api/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName, newStatus: status, user }),
      });
    } catch {
      /* best-effort notification hook */
    }
  };

  const handleInputChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setErrors({});
    setEditingId(null);
    setFormOpen(false);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!formData.name.trim()) next.name = "Vui lòng nhập tên công việc";
    if (!formData.date) next.date = "Vui lòng chọn ngày";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddOrUpdate = async (e: any) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const cleaned = { ...formData, name: formData.name.trim(), location: formData.location.trim() };
    await new Promise((r) => setTimeout(r, 300));
    if (editingId) {
      setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...cleaned, updatedAt: nowISO() } : t)));
      await sendEmail(cleaned.name, "Đã chỉnh sửa", cleaned.assignee);
      showToast(`Đã lưu thay đổi cho "${cleaned.name}"`);
    } else {
      const newTask: Task = { id: Date.now(), ...cleaned, updatedAt: nowISO() };
      setTasks((prev) => [...prev, newTask]);
      await sendEmail(cleaned.name, "Đã thêm mới", cleaned.assignee);
      showToast(`Đã thêm "${cleaned.name}" vào tiến độ`);
    }
    setSubmitting(false);
    resetForm();
  };

  const handleEdit = (t: Task) => {
    setEditingId(t.id);
    setFormData({ date: t.date, name: t.name, assignee: t.assignee, location: t.location, status: t.status });
    setErrors({});
    setOpenDropdown(null);
    setFormOpen(true);
  };

  const handleDelete = (t: Task) => {
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    setOpenDropdown(null);
    sendEmail(t.name, "Đã xóa", t.assignee);
    showToast(`Đã xóa "${t.name}"`, () => {
      setTasks((prev) => [...prev, t]);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      setToast(null);
    });
  };

  const handleStatusChange = async (t: Task, status: Status) => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status, updatedAt: nowISO() } : x)));
    await sendEmail(t.name, STATUS_META[status].label, t.assignee);
  };

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tasks
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q));
    const byStatus = (a: Task, b: Task) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    switch (sortKey) {
      case "date-desc": return list.sort((a, b) => b.date.localeCompare(a.date));
      case "status": return list.sort(byStatus);
      case "assignee": return list.sort((a, b) => a.assignee.localeCompare(b.assignee));
      default: return list.sort((a, b) => a.date.localeCompare(b.date));
    }
  }, [tasks, statusFilter, query, sortKey]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, todo, pct };
  }, [tasks]);

  const navItem = (id: ViewMode, label: string, IconCmp: any) => (
    <button
      onClick={() => setView(id)}
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D96B1F] ${
        view === id
          ? "text-[#B85A17] bg-[#FDF1E7] border-l-2 border-[#D96B1F]"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 border-l-2 border-transparent"
      }`}
    >
      <IconCmp className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );

  if (!hydrated) {
    return <div className="min-h-screen bg-white grid place-items-center text-slate-400 text-sm">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="flex min-h-screen bg-white text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-white border-r border-slate-200 p-5">
        <div className="mb-8 pb-4 border-b border-slate-200">
          <p className="font-mono text-[11px] tracking-widest text-slate-400 uppercase">Đồ án tốt nghiệp</p>
          <h1 className="text-lg font-bold text-slate-900 font-mono">thesis<span className="text-[#D96B1F]">/</span>tracker</h1>
        </div>
        <nav className="space-y-1">
          {navItem("dashboard", "Dashboard", Icon.Dashboard)}
          {navItem("kanban", "Kanban", Icon.Kanban)}
          {navItem("docs", "Tài liệu", Icon.Docs)}
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-200 font-mono text-[11px] text-slate-400">
          {tasks.length} công việc · lưu cục bộ trên trình duyệt
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex justify-around py-2 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
        {(["dashboard", "kanban", "docs"] as ViewMode[]).map((id) => {
          const IconCmp = id === "dashboard" ? Icon.Dashboard : id === "kanban" ? Icon.Kanban : Icon.Docs;
          return (
            <button key={id} onClick={() => setView(id)} className={`p-2 rounded-lg ${view === id ? "text-[#D96B1F]" : "text-slate-400"}`}>
              <IconCmp className="w-5 h-5" />
            </button>
          );
        })}
      </nav>

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-1">
              {view === "dashboard" ? "Tổng quan" : view === "kanban" ? "Bảng công việc" : "Kho tài liệu"}
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">Quản lý tiến độ khóa luận</h2>
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 bg-[#D96B1F] text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-[#c25f1a] transition shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D96B1F]"
          >
            <Icon.Plus className="w-4 h-4" /> Thêm công việc
          </button>
        </div>

        {/* Stats hero */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-5 shadow-sm">
            <div
              className="relative w-20 h-20 rounded-full grid place-items-center shrink-0"
              style={{ background: `conic-gradient(#10B981 ${stats.pct * 3.6}deg, #E5E7EB 0deg)` }}
            >
              <div className="w-14 h-14 rounded-full bg-white grid place-items-center font-mono">
                <span className="text-sm font-bold text-slate-900">{stats.pct}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-600">Tiến độ hoàn thành</p>
              <p className="font-mono text-xs text-slate-400">{stats.done}/{stats.total} công việc đã xong</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {([
              ["Chưa bắt đầu", stats.todo, "text-slate-700"],
              ["Đang thực hiện", stats.inProgress, "text-amber-600"],
              ["Hoàn thành", stats.done, "text-emerald-600"],
            ] as const).map(([label, val, cls]) => (
              <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                <span className="text-xs text-slate-500">{label}</span>
                <span className={`font-mono text-2xl font-bold mt-2 ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Icon.Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm công việc hoặc người làm..."
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#D96B1F] focus:ring-2 focus:ring-[#D96B1F]/15"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-[#D96B1F]"
          >
            <option value="all">Tất cả trạng thái</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-[#D96B1F]"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
        </div>

        {/* Dashboard: git-log style list */}
        {view === "dashboard" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
            {filteredTasks.length === 0 ? (
              <EmptyState onAdd={() => setFormOpen(true)} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredTasks.map((t, i) => (
                  <li
                    key={t.id}
                    className={`flex gap-4 px-5 py-4 hover:bg-slate-50/70 transition group ${
                      i === 0 ? "rounded-t-2xl" : ""
                    } ${i === filteredTasks.length - 1 ? "rounded-b-2xl" : ""}`}
                  >
                    <div className="relative w-4 shrink-0 flex justify-center">
                      {i !== 0 && <span className="absolute top-0 h-1/2 w-px bg-slate-200" />}
                      {i !== filteredTasks.length - 1 && <span className="absolute bottom-0 h-1/2 w-px bg-slate-200" />}
                      <span className={`relative mt-4 w-2.5 h-2.5 rounded-full ring-4 ring-white ${STATUS_META[t.status].dot}`} />
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[90px_1fr_auto_auto] gap-x-4 gap-y-1 items-center">
                      <span className="font-mono text-xs text-slate-400" title={`Cập nhật: ${new Date(t.updatedAt).toLocaleString("vi-VN")}`}>{t.date}</span>
                      <span className="font-semibold text-slate-900 truncate">{t.name}</span>
                      <span className="text-xs bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full text-slate-600 w-fit">{t.assignee}</span>
                      <span className={`text-xs border px-2.5 py-1 rounded-full w-fit ${STATUS_META[t.status].badge}`}>{STATUS_META[t.status].label}</span>
                      {t.location && <span className="md:col-span-4 text-xs text-slate-400 font-mono truncate">↳ {t.location}</span>}
                    </div>
                    <div className="relative shrink-0" ref={openDropdown === t.id ? menuRef : undefined}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === t.id ? null : t.id)}
                        className="text-slate-400 hover:text-slate-900 p-1.5 rounded-md hover:bg-slate-100 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
                        aria-label="Thao tác"
                      >
                        <Icon.Dots className="w-4 h-4" />
                      </button>
                      {openDropdown === t.id && (
                        <div className="absolute right-0 top-9 bg-white border border-slate-200 shadow-lg rounded-lg z-10 w-36 py-1.5 text-sm">
                          <button onClick={() => handleEdit(t)} className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700">
                            <Icon.Pencil className="w-3.5 h-3.5" /> Sửa
                          </button>
                          <button onClick={() => handleDelete(t)} className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-red-50 text-red-600">
                            <Icon.Trash className="w-3.5 h-3.5" /> Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Kanban */}
        {view === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STATUS_ORDER.map((status) => {
              const items = filteredTasks.filter((t) => t.status === status);
              return (
                <div key={status} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`w-2 h-2 rounded-full ${STATUS_META[status].dot}`} />
                    <h3 className="text-sm font-semibold text-slate-700">{STATUS_META[status].label}</h3>
                    <span className="ml-auto font-mono text-xs text-slate-400">{items.length}</span>
                  </div>
                  <div className="space-y-3 min-h-[60px]">
                    {items.length === 0 && <p className="text-xs text-slate-400 italic px-1">Không có công việc</p>}
                    {items.map((t) => {
                      const idx = STATUS_ORDER.indexOf(status);
                      const prev = STATUS_ORDER[idx - 1];
                      const next = STATUS_ORDER[idx + 1];
                      return (
                        <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                          <p className="text-sm font-medium text-slate-900 mb-1.5">{t.name}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono text-slate-400">{t.date} · {t.assignee}</span>
                            <div className="flex items-center gap-1">
                              {prev && (
                                <button onClick={() => handleStatusChange(t, prev)} className="p-1 text-slate-400 hover:text-[#D96B1F]" aria-label={`Chuyển về ${STATUS_META[prev].label}`}>
                                  <Icon.ArrowLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => handleEdit(t)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Sửa">
                                <Icon.Pencil className="w-3.5 h-3.5" />
                              </button>
                              {next && (
                                <button onClick={() => handleStatusChange(t, next)} className="p-1 text-slate-400 hover:text-[#D96B1F]" aria-label={`Chuyển sang ${STATUS_META[next].label}`}>
                                  <Icon.ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tài liệu */}
        {view === "docs" && (
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm">
            {filteredTasks.filter((t) => t.location).length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">Chưa có tài liệu nào được liên kết.</p>
            ) : (
              filteredTasks
                .filter((t) => t.location)
                .map((t) => (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                    <Icon.Docs className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                      <p className="text-xs font-mono text-slate-400 truncate">{t.location}</p>
                    </div>
                    <span className={`text-xs border px-2.5 py-1 rounded-full shrink-0 ${STATUS_META[t.status].badge}`}>{STATUS_META[t.status].label}</span>
                  </div>
                ))
            )}
          </div>
        )}
      </main>

      {/* Add/Edit form modal */}
      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={resetForm}>
          <form
            onSubmit={handleAddOrUpdate}
            onClick={(e) => e.stopPropagation()}
            noValidate
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-900">{editingId ? "Chỉnh sửa công việc" : "Thêm công việc mới"}</h3>
              <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-700" aria-label="Đóng">
                <Icon.X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <Field label="Tên công việc" error={errors.name}>
                <input
                  autoFocus
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Nhập tên công việc..."
                  className={`input ${errors.name ? "input-error" : ""}`}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ngày" error={errors.date}>
                  <input type="date" name="date" value={formData.date} onChange={handleInputChange} className={`input ${errors.date ? "input-error" : ""}`} />
                </Field>
                <Field label="Người làm">
                  <select name="assignee" value={formData.assignee} onChange={handleInputChange} className="input">
                    {ASSIGNEES.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Trạng thái">
                <select name="status" value={formData.status} onChange={handleInputChange} className="input">
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
              </Field>
              <Field label="Nơi lưu trữ">
                <input name="location" value={formData.location} onChange={handleInputChange} placeholder="Link/Folder..." className="input" />
              </Field>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={resetForm} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium">
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg bg-[#D96B1F] text-white font-semibold hover:bg-[#c25f1a] disabled:opacity-60 text-sm"
              >
                {submitting ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm mới"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm pl-4 pr-2 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <span className="font-mono">{toast.message}</span>
          {toast.onUndo && (
            <button
              onClick={toast.onUndo}
              className="flex items-center gap-1 text-[#F4A662] hover:text-[#ffb877] font-medium px-2 py-1 rounded-md hover:bg-white/10"
            >
              <Icon.Undo className="w-3.5 h-3.5" /> Hoàn tác
            </button>
          )}
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          color: #1e293b;
        }
        .input:focus {
          outline: none;
          border-color: #d96b1f;
          box-shadow: 0 0 0 3px rgba(217, 107, 31, 0.12);
        }
        .input-error {
          border-color: #ef4444;
        }
        .input-error:focus {
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
        }
      `}</style>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600 mt-1 block">{error}</span>}
    </label>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="font-mono text-sm text-slate-400 mb-1">// chưa có commit nào</p>
      <p className="text-slate-500 mb-5">Chưa có công việc phù hợp với bộ lọc hiện tại.</p>
      <button onClick={onAdd} className="text-sm font-medium text-[#D96B1F] hover:underline">
        + Thêm công việc đầu tiên
      </button>
    </div>
  );
}