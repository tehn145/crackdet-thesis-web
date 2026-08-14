"use client";
import { useMemo, useState } from "react";

/* ----------------------------- Types & data ----------------------------- */

type Status = "todo" | "in-progress" | "done";
type ViewMode = "dashboard" | "kanban" | "docs";

interface Task {
  id: number;
  date: string;
  name: string;
  assignee: string;
  location: string;
  status: Status;
}

const ASSIGNEES = ["Thành", "Bạn chung nhóm"];

const STATUS_META: Record<
  Status,
  { label: string; badge: string; dot: string; ring: string }
> = {
  todo: {
    label: "Chưa bắt đầu",
    badge: "bg-slate-800/60 text-slate-300 border-slate-700",
    dot: "bg-slate-500",
    ring: "#64748B",
  },
  "in-progress": {
    label: "Đang thực hiện",
    badge: "bg-amber-500/10 text-amber-300 border-amber-600/40",
    dot: "bg-amber-400",
    ring: "#F0883E",
  },
  done: {
    label: "Hoàn thành",
    badge: "bg-emerald-500/10 text-emerald-300 border-emerald-600/40",
    dot: "bg-emerald-400",
    ring: "#3FB950",
  },
};

const STATUS_ORDER: Status[] = ["todo", "in-progress", "done"];

const INITIAL_TASKS: Task[] = [
  {
    id: 1,
    date: "2026-08-14",
    name: "Tổng quan tài liệu nhận diện vết nứt",
    assignee: "Thành",
    location: "Drive/Tài liệu",
    status: "in-progress",
  },
];

const emptyForm = (): Omit<Task, "id"> => ({
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
  Arrow: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ------------------------------- Component ------------------------------- */

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [view, setView] = useState<ViewMode>("dashboard");
  const [formData, setFormData] = useState<Omit<Task, "id">>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  const sendEmail = async (taskName: string, status: string, user: string) => {
    try {
      await fetch("/api/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName, newStatus: status, user }),
      });
    } catch {
      /* silent — email hook is best-effort */
    }
  };

  const handleInputChange = (e: any) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingId(null);
    setFormOpen(false);
  };

  const handleAddOrUpdate = async (e: any) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 350));
    if (editingId) {
      setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...formData, id: editingId } : t)));
      await sendEmail(formData.name, "Đã chỉnh sửa", formData.assignee);
      showToast(`Đã lưu thay đổi cho "${formData.name}"`);
    } else {
      const newTask: Task = { id: Date.now(), ...formData };
      setTasks((prev) => [...prev, newTask]);
      await sendEmail(formData.name, "Đã thêm mới", formData.assignee);
      showToast(`Đã thêm "${formData.name}" vào tiến độ`);
    }
    setSubmitting(false);
    resetForm();
  };

  const handleEdit = (t: Task) => {
    setEditingId(t.id);
    setFormData({ date: t.date, name: t.name, assignee: t.assignee, location: t.location, status: t.status });
    setOpenDropdown(null);
    setFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    const t = tasks.find((x) => x.id === confirmDeleteId);
    if (!t) return;
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    await sendEmail(t.name, "Đã xóa", t.assignee);
    showToast(`Đã xóa "${t.name}"`);
    setConfirmDeleteId(null);
  };

  const handleStatusChange = async (t: Task, status: Status) => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status } : x)));
    await sendEmail(t.name, STATUS_META[status].label, t.assignee);
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
      .filter((t) => t.name.toLowerCase().includes(query.toLowerCase()) || t.assignee.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [tasks, statusFilter, query]);

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
      className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F0883E] ${
        view === id
          ? "text-[#F0883E] bg-[#F0883E]/10 border-l-2 border-[#F0883E]"
          : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border-l-2 border-transparent"
      }`}
    >
      <IconCmp className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-[#0D1117] text-slate-200 font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-[#0A0D12] border-r border-[#1E2530] p-5">
        <div className="mb-8 pb-4 border-b border-[#1E2530]">
          <p className="font-mono text-[11px] tracking-widest text-slate-500 uppercase">Đồ án tốt nghiệp</p>
          <h1 className="text-lg font-bold text-slate-50 font-mono">thesis<span className="text-[#F0883E]">/</span>tracker</h1>
        </div>
        <nav className="space-y-1">
          {navItem("dashboard", "Dashboard", Icon.Dashboard)}
          {navItem("kanban", "Kanban", Icon.Kanban)}
          {navItem("docs", "Tài liệu", Icon.Docs)}
        </nav>
        <div className="mt-auto pt-4 border-t border-[#1E2530] font-mono text-[11px] text-slate-600">
          {tasks.length} công việc · nhánh <span className="text-slate-400">main</span>
        </div>
      </aside>

      {/* Mobile top nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-[#0A0D12] border-t border-[#1E2530] flex justify-around py-2">
        {(["dashboard", "kanban", "docs"] as ViewMode[]).map((id) => {
          const IconCmp = id === "dashboard" ? Icon.Dashboard : id === "kanban" ? Icon.Kanban : Icon.Docs;
          return (
            <button key={id} onClick={() => setView(id)} className={`p-2 rounded-lg ${view === id ? "text-[#F0883E]" : "text-slate-500"}`}>
              <IconCmp className="w-5 h-5" />
            </button>
          );
        })}
      </nav>

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10 overflow-y-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-xs text-slate-500 uppercase tracking-wider mb-1">
              {view === "dashboard" ? "Tổng quan" : view === "kanban" ? "Bảng công việc" : "Kho tài liệu"}
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-50">Quản lý tiến độ khóa luận</h2>
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 bg-[#F0883E] text-[#0D1117] font-semibold px-4 py-2.5 rounded-lg hover:bg-[#f59a5a] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F0883E]"
          >
            <Icon.Plus className="w-4 h-4" /> Thêm công việc
          </button>
        </div>

        {/* Stats hero */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 mb-8">
          <div className="bg-[#161B22] border border-[#262C36] rounded-2xl p-6 flex items-center gap-5">
            <div
              className="relative w-20 h-20 rounded-full grid place-items-center shrink-0"
              style={{ background: `conic-gradient(#3FB950 ${stats.pct * 3.6}deg, #262C36 0deg)` }}
            >
              <div className="w-14 h-14 rounded-full bg-[#161B22] grid place-items-center font-mono">
                <span className="text-sm font-bold text-slate-50">{stats.pct}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-400">Tiến độ hoàn thành</p>
              <p className="font-mono text-xs text-slate-600">{stats.done}/{stats.total} công việc đã xong</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {([
              ["Chưa bắt đầu", stats.todo, "text-slate-300"],
              ["Đang thực hiện", stats.inProgress, "text-amber-300"],
              ["Hoàn thành", stats.done, "text-emerald-300"],
            ] as const).map(([label, val, cls]) => (
              <div key={label} className="bg-[#161B22] border border-[#262C36] rounded-2xl p-5 flex flex-col justify-between">
                <span className="text-xs text-slate-500">{label}</span>
                <span className={`font-mono text-2xl font-bold mt-2 ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Icon.Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm công việc hoặc người làm..."
              className="w-full bg-[#161B22] border border-[#262C36] rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#F0883E]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
            className="bg-[#161B22] border border-[#262C36] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#F0883E]"
          >
            <option value="all">Tất cả trạng thái</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>

        {/* Dashboard: git-log style list */}
        {view === "dashboard" && (
          <div className="bg-[#161B22] border border-[#262C36] rounded-2xl overflow-hidden">
            {filteredTasks.length === 0 ? (
              <EmptyState onAdd={() => setFormOpen(true)} />
            ) : (
              <ul className="divide-y divide-[#1E2530]">
                {filteredTasks.map((t, i) => (
                  <li key={t.id} className="flex gap-4 px-5 py-4 hover:bg-white/[0.02] transition group">
                    <div className="relative w-4 shrink-0 flex justify-center">
                      {i !== 0 && <span className="absolute top-0 h-1/2 w-px bg-[#30363D]" />}
                      {i !== filteredTasks.length - 1 && <span className="absolute bottom-0 h-1/2 w-px bg-[#30363D]" />}
                      <span
                        className={`relative mt-4 w-2.5 h-2.5 rounded-full ring-4 ring-[#161B22] ${STATUS_META[t.status].dot}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[90px_1fr_auto_auto] gap-x-4 gap-y-1 items-center">
                      <span className="font-mono text-xs text-slate-500">{t.date}</span>
                      <span className="font-semibold text-slate-100 truncate">{t.name}</span>
                      <span className="text-xs bg-white/5 border border-[#262C36] px-2.5 py-1 rounded-full text-slate-300 w-fit">{t.assignee}</span>
                      <span className={`text-xs border px-2.5 py-1 rounded-full w-fit ${STATUS_META[t.status].badge}`}>{STATUS_META[t.status].label}</span>
                      {t.location && <span className="md:col-span-4 text-xs text-slate-500 font-mono truncate">↳ {t.location}</span>}
                    </div>
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === t.id ? null : t.id)}
                        className="text-slate-500 hover:text-slate-100 p-1.5 rounded-md hover:bg-white/5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
                        aria-label="Thao tác"
                      >
                        <Icon.Dots className="w-4 h-4" />
                      </button>
                      {openDropdown === t.id && (
                        <div className="absolute right-0 top-9 bg-[#1C2330] border border-[#262C36] shadow-xl rounded-lg z-10 w-36 py-1.5 text-sm">
                          <button onClick={() => handleEdit(t)} className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-white/5 text-slate-200">
                            <Icon.Pencil className="w-3.5 h-3.5" /> Sửa
                          </button>
                          <button
                            onClick={() => { setConfirmDeleteId(t.id); setOpenDropdown(null); }}
                            className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-red-500/10 text-red-400"
                          >
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
                <div key={status} className="bg-[#161B22] border border-[#262C36] rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`w-2 h-2 rounded-full ${STATUS_META[status].dot}`} />
                    <h3 className="text-sm font-semibold text-slate-200">{STATUS_META[status].label}</h3>
                    <span className="ml-auto font-mono text-xs text-slate-600">{items.length}</span>
                  </div>
                  <div className="space-y-3 min-h-[60px]">
                    {items.length === 0 && <p className="text-xs text-slate-600 italic px-1">Không có công việc</p>}
                    {items.map((t) => {
                      const nextIdx = STATUS_ORDER.indexOf(status) + 1;
                      const next = STATUS_ORDER[nextIdx];
                      return (
                        <div key={t.id} className="bg-[#0D1117] border border-[#262C36] rounded-xl p-3">
                          <p className="text-sm font-medium text-slate-100 mb-1.5">{t.name}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono text-slate-500">{t.date} · {t.assignee}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleEdit(t)} className="p-1 text-slate-500 hover:text-slate-200" aria-label="Sửa">
                                <Icon.Pencil className="w-3.5 h-3.5" />
                              </button>
                              {next && (
                                <button
                                  onClick={() => handleStatusChange(t, next)}
                                  className="p-1 text-slate-500 hover:text-[#F0883E]"
                                  aria-label={`Chuyển sang ${STATUS_META[next].label}`}
                                >
                                  <Icon.Arrow className="w-3.5 h-3.5" />
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
          <div className="bg-[#161B22] border border-[#262C36] rounded-2xl divide-y divide-[#1E2530]">
            {filteredTasks.filter((t) => t.location).length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">Chưa có tài liệu nào được liên kết.</p>
            ) : (
              filteredTasks
                .filter((t) => t.location)
                .map((t) => (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-4">
                    <Icon.Docs className="w-5 h-5 text-slate-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-100 truncate">{t.name}</p>
                      <p className="text-xs font-mono text-slate-500 truncate">{t.location}</p>
                    </div>
                    <span className={`text-xs border px-2.5 py-1 rounded-full shrink-0 ${STATUS_META[t.status].badge}`}>{STATUS_META[t.status].label}</span>
                  </div>
                ))
            )}
          </div>
        )}
      </main>

      {/* Add/Edit form drawer */}
      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={resetForm}>
          <form
            onSubmit={handleAddOrUpdate}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#161B22] border border-[#262C36] rounded-2xl shadow-2xl w-full max-w-md p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-50">{editingId ? "Chỉnh sửa công việc" : "Thêm công việc mới"}</h3>
              <button type="button" onClick={resetForm} className="text-slate-500 hover:text-slate-200" aria-label="Đóng">
                <Icon.X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <Field label="Tên công việc">
                <input
                  autoFocus
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Nhập tên công việc..."
                  className="input"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ngày">
                  <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="input" />
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
              <button type="button" onClick={resetForm} className="flex-1 py-2.5 rounded-lg border border-[#262C36] text-slate-300 hover:bg-white/5 text-sm font-medium">
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg bg-[#F0883E] text-[#0D1117] font-semibold hover:bg-[#f59a5a] disabled:opacity-60 text-sm"
              >
                {submitting ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm mới"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmDeleteId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-[#161B22] border border-[#262C36] rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-50 mb-2">Xóa công việc?</h3>
            <p className="text-sm text-slate-400 mb-6">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2.5 rounded-lg border border-[#262C36] text-slate-300 hover:bg-white/5 text-sm font-medium">
                Hủy
              </button>
              <button onClick={handleDeleteConfirm} className="flex-1 py-2.5 rounded-lg bg-red-500/90 text-white font-semibold hover:bg-red-500 text-sm">
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1C2330] border border-[#262C36] text-slate-100 text-sm px-4 py-3 rounded-xl shadow-2xl font-mono">
          {toast}
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          background: #0d1117;
          border: 1px solid #262c36;
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          color: #e6edf3;
        }
        .input:focus {
          outline: none;
          border-color: #f0883e;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="font-mono text-sm text-slate-600 mb-1">// chưa có commit nào</p>
      <p className="text-slate-400 mb-5">Chưa có công việc phù hợp với bộ lọc hiện tại.</p>
      <button onClick={onAdd} className="text-sm font-medium text-[#F0883E] hover:underline">
        + Thêm công việc đầu tiên
      </button>
    </div>
  );
}