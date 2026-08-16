"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ----------------------------- Types & data ----------------------------- */

type Status = "todo" | "in-progress" | "done";
type ViewMode = "dashboard" | "kanban" | "docs";
type SortKey = "date-asc" | "date-desc" | "status" | "assignee";

interface Task {
  id: number;
  date: string;
  name: string;
  description: string;
  assignee: string;
  assignedBy: string;
  location: string;
  status: Status;
  updatedAt: string;
  estimatedDays?: number;
  deadline?: string;
  deadlineWarnedAt?: string;
}

type TaskFormData = {
  date: string;
  name: string;
  description: string;
  assignee: string;
  location: string;
  status: Status;
  estimatedDays: string;
  estimatedHours: string;
};

type DeadlineLevel = "none" | "done" | "safe" | "warning" | "urgent" | "overdue";

interface ProjectDeadlineItem {
  id: string;
  name: string;
  deadline: string;
}

const CURRENT_USER_KEY = "thesis-tracker:current-user";
const UNLOCKED_KEY = "thesis-tracker:unlocked";
const ASSIGNEES = ["Kim Thanh", "Cong Thanh"];

const THESIS_TITLE =
  "Deep Learning-Based Surface Damage Detection and Classification for Civil Infrastructure";

const VALID_ACCESS_CODES = ["23521447", "23521463"];

const ACCESS_CODE_TO_USER: Record<string, string> = {
  "23521447": "Kim Thanh",
  "23521463": "Cong Thanh",
};

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const SESSION_CHECK_INTERVAL_MS = 60 * 1000;
const CLOCK_TICK_INTERVAL_MS = 1000;

const STATUS_META: Record<Status, { label: string; badge: string; dot: string }> = {
  todo: { label: "Not Started", badge: "bg-slate-100 text-slate-600 border-slate-300", dot: "bg-slate-400" },
  "in-progress": { label: "In Progress", badge: "bg-amber-50 text-amber-700 border-amber-300", dot: "bg-amber-500" },
  done: { label: "Completed", badge: "bg-emerald-50 text-emerald-700 border-emerald-300", dot: "bg-emerald-500" },
};

const STATUS_ORDER: Status[] = ["todo", "in-progress", "done"];

const SORT_LABEL: Record<SortKey, string> = {
  "date-asc": "Date · Oldest first",
  "date-desc": "Date · Newest first",
  status: "By status",
  assignee: "By assignee",
};

const nowISO = () => new Date().toISOString();

const otherAssignee = (name: string) => ASSIGNEES.find((a) => a !== name) ?? ASSIGNEES[0];

/** days may be fractional (e.g. 0.25 = 6 hours). Adds the exact duration to the start of dateStr. */
const computeDeadline = (dateStr: string, days: number): string => {
  const base = new Date(`${dateStr}T00:00:00`);
  const target = base.getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(target).toISOString();
};

const formatDuration = (ms: number): string => {
  const totalMinutes = Math.max(0, Math.floor(Math.abs(ms) / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

/** Precise "1d 06:30:25" style countdown, ticking down to the second. */
const formatCountdownClock = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const DEADLINE_LEVEL_STYLE: Record<DeadlineLevel, string> = {
  none: "bg-slate-50 text-slate-400 border-slate-200",
  done: "bg-emerald-50 text-emerald-600 border-emerald-200",
  safe: "bg-slate-100 text-slate-600 border-slate-200",
  warning: "bg-amber-50 text-amber-700 border-amber-300",
  urgent: "bg-red-50 text-red-700 border-red-300 animate-pulse",
  overdue: "bg-red-100 text-red-800 border-red-400",
};

const getTaskDeadlineInfo = (t: Task, now: number): { level: DeadlineLevel; text: string } => {
  if (t.status === "done") return { level: "done", text: "Completed" };
  if (!t.deadline) return { level: "none", text: "No deadline set" };
  const diff = new Date(t.deadline).getTime() - now;
  if (diff <= 0) return { level: "overdue", text: `Overdue by ${formatDuration(diff)}` };
  if (diff <= 6 * 60 * 60 * 1000) return { level: "urgent", text: `${formatDuration(diff)} left` };
  if (diff <= 24 * 60 * 60 * 1000) return { level: "warning", text: `${formatDuration(diff)} left` };
  return { level: "safe", text: `${formatDuration(diff)} left` };
};

const toDatetimeLocal = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromDatetimeLocal = (value: string): string | undefined =>
  value ? new Date(value).toISOString() : undefined;

const readUnlockSession = (): boolean => {
  try {
    const raw = window.sessionStorage.getItem(UNLOCKED_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { unlockedAt: number };
    if (!parsed?.unlockedAt) return false;
    const expired = Date.now() - parsed.unlockedAt > SESSION_DURATION_MS;
    if (expired) {
      window.sessionStorage.removeItem(UNLOCKED_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

/** DB (snake_case) → frontend (camelCase) */
const fromDb = (row: any): Task => ({
  id: row.id,
  date: row.date,
  name: row.name,
  description: row.description ?? "",
  assignee: row.assignee,
  assignedBy: row.assigned_by,
  location: row.location ?? "",
  status: row.status,
  updatedAt: row.updated_at,
  estimatedDays: row.estimated_days ?? undefined,
  deadline: row.deadline ?? undefined,
  deadlineWarnedAt: row.deadline_warned_at ?? undefined,
});

/** Frontend → DB */
const toDb = (t: Partial<Task>) => ({
  date: t.date,
  name: t.name,
  description: t.description,
  assignee: t.assignee,
  assigned_by: t.assignedBy,
  location: t.location,
  status: t.status,
  estimated_days: t.estimatedDays ?? null,
  deadline: t.deadline ?? null,
  deadline_warned_at: t.deadlineWarnedAt ?? null,
  updated_at: t.updatedAt ?? nowISO(),
});

const emptyForm = (currentUser: string): TaskFormData => ({
  date: new Date().toISOString().split("T")[0],
  name: "",
  description: "",
  assignee: currentUser,
  location: "",
  status: "todo",
  estimatedDays: "",
  estimatedHours: "",
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
      <path
        d="M5 2.5h7l3.5 3.5V17a1 1 0 01-1 1H5a1 1 0 01-1-1V3.5a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
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
      <circle cx="10" cy="4" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <circle cx="10" cy="16" r="1.5" />
    </svg>
  ),
  Pencil: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path
        d="M13.5 3.5l3 3L6 17H3v-3l10.5-10.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Trash: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m-6.5 0l.6 10a1 1 0 001 1h4.8a1 1 0 001-1l.6-10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  X: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  ArrowRight: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path
        d="M4 10h11M10 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  ArrowLeft: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path
        d="M16 10H5M10 5l-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Undo: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path
        d="M5 8h7a3.5 3.5 0 010 7H9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 4.5L5 8l3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Mail: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 5.5l7 5.5 7-5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Swap: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <path
        d="M4 7h10.5M14.5 7L11.5 4M16 13H5.5M5.5 13l3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Lock: (p: { className?: string }) => (
    <svg viewBox="0 0 20 20" fill="none" className={p.className}>
      <rect x="4" y="9" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 9V6.5a3.5 3.5 0 017 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="13" r="1.2" fill="currentColor" />
    </svg>
  ),
};

/* ------------------------------- Component ------------------------------- */

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<ViewMode>("dashboard");
  const [currentUser, setCurrentUser] = useState<string>(ASSIGNEES[0]);
  const [formData, setFormData] = useState<TaskFormData>(emptyForm(ASSIGNEES[0]));
  const [errors, setErrors] = useState<{ name?: string; date?: string }>({});
  const [deadlines, setDeadlines] = useState<ProjectDeadlineItem[]>([]);
  const [deadlineForm, setDeadlineForm] = useState<ProjectDeadlineItem[]>([]);
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date-desc"); // ← newest first
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* Load from supabase */
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("*")
          .order("updated_at", { ascending: false });

        if (tasksError) throw tasksError;
        setTasks((tasksData ?? []).map(fromDb));

        const { data: deadlinesData, error: deadlinesError } = await supabase
          .from("project_deadlines")
          .select("*");

        if (deadlinesError) throw deadlinesError;
        setDeadlines(
          (deadlinesData ?? []).map((d: any) => ({
            id: d.id,
            name: d.name,
            deadline: d.deadline,
          }))
        );

        const savedUser = window.localStorage.getItem(CURRENT_USER_KEY);
        const user = savedUser && ASSIGNEES.includes(savedUser) ? savedUser : ASSIGNEES[0];
        setCurrentUser(user);
        setFormData(emptyForm(user));
        setUnlocked(readUnlockSession());
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        setHydrated(true);
      }
    };

    loadData();
  }, []);

  /* Realtime */
  useEffect(() => {
    if (!hydrated) return;

    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        async () => {
          const { data } = await supabase
            .from("tasks")
            .select("*")
            .order("updated_at", { ascending: false });
          if (data) setTasks(data.map(fromDb));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_deadlines" },
        async () => {
          const { data } = await supabase.from("project_deadlines").select("*");
          if (data) {
            setDeadlines(
              data.map((d: any) => ({
                id: d.id,
                name: d.name,
                deadline: d.deadline,
              }))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hydrated]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), CLOCK_TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CURRENT_USER_KEY, currentUser);
    } catch {}
  }, [currentUser, hydrated]);

  useEffect(() => {
    if (!unlocked) return;
    const id = window.setInterval(() => {
      if (!readUnlockSession()) {
        setUnlocked(false);
        setOpenDropdown(null);
      }
    }, SESSION_CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [unlocked]);

  /* Deadline warning email */
  useEffect(() => {
    if (!hydrated) return;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const checkDeadlines = () => {
      const now = Date.now();
      tasks.forEach((t) => {
        if (!t.deadline || t.status === "done" || t.deadlineWarnedAt) return;
        const deadlineMs = new Date(t.deadline).getTime();
        const diff = deadlineMs - now;
        const totalDurationMs = deadlineMs - new Date(`${t.date}T00:00:00`).getTime();
        const warnThreshold = totalDurationMs < ONE_DAY_MS ? 30 * 60 * 1000 : 6 * 60 * 60 * 1000;
        if (diff > 0 && diff <= warnThreshold) {
          sendDeadlineWarningEmail(t.name, t.deadline, t.assignee).then(async (ok) => {
            if (ok) {
              const warnedAt = nowISO();
              await supabase.from("tasks").update({ deadline_warned_at: warnedAt }).eq("id", t.id);
              setTasks((prev) =>
                prev.map((x) => (x.id === t.id ? { ...x, deadlineWarnedAt: warnedAt } : x))
              );
            }
          });
        }
      });
    };
    checkDeadlines();
    const id = window.setInterval(checkDeadlines, 60 * 1000);
    return () => window.clearInterval(id);
  }, [tasks, hydrated]);

  useEffect(() => {
    if (openDropdown === null) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenDropdown(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openDropdown]);

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

  const handleUnlock = (e: any) => {
    e.preventDefault();
    const code = accessCode.trim();
    const user = ACCESS_CODE_TO_USER[code];

    if (user) {
      setUnlocked(true);
      setCurrentUser(user);
      setFormData(emptyForm(user));
      setAccessError("");
      setAccessCode("");
      try {
        window.sessionStorage.setItem(UNLOCKED_KEY, JSON.stringify({ unlockedAt: Date.now() }));
        window.localStorage.setItem(CURRENT_USER_KEY, user);
      } catch {}
    } else {
      setAccessError("Incorrect Password. Please try again.");
    }
  };

  const handleLock = () => {
    setUnlocked(false);
    setOpenDropdown(null);
    try {
      window.sessionStorage.removeItem(UNLOCKED_KEY);
    } catch {}
  };

  const sendStatusEmail = async (taskName: string, status: string, user: string) => {
    try {
      await fetch("/api/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "status", taskName, newStatus: status, user }),
      });
    } catch {}
  };

  const sendDeadlineWarningEmail = async (
    taskName: string,
    deadline: string,
    assignee: string
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "deadline-warning", taskName, deadline, assignee }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const notifyAssignment = async (task: Task, previousAssignee?: string): Promise<boolean> => {
    const assigneeChanged = previousAssignee === undefined || previousAssignee !== task.assignee;
    const assignedToSomeoneElse = task.assignee !== currentUser;
    if (!assigneeChanged || !assignedToSomeoneElse) return false;

    try {
      const res = await fetch("/api/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "assignment",
          taskName: task.name,
          date: task.date,
          location: task.location,
          status: task.status,
          assignedTo: task.assignee,
          assignedBy: currentUser,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleInputChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const resetForm = () => {
    setFormData(emptyForm(currentUser));
    setErrors({});
    setEditingId(null);
    setFormOpen(false);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!formData.name.trim()) next.name = "Please enter a task name";
    if (!formData.date) next.date = "Please select a date";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAddOrUpdate = async (e: any) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const estDaysTrim = formData.estimatedDays.trim();
    const estHoursTrim = formData.estimatedHours.trim();
    const estDaysNum = estDaysTrim === "" ? 0 : Number(estDaysTrim);
    const estHoursNum = estHoursTrim === "" ? 0 : Number(estHoursTrim);
    const safeDays = !Number.isNaN(estDaysNum) && estDaysNum > 0 ? estDaysNum : 0;
    const safeHours = !Number.isNaN(estHoursNum) && estHoursNum > 0 ? estHoursNum : 0;
    const totalEstDays = safeDays + safeHours / 24;
    const validEstDays = totalEstDays > 0 ? totalEstDays : undefined;
    const computedDeadline =
      validEstDays !== undefined ? computeDeadline(formData.date, validEstDays) : undefined;

    const cleaned = {
      date: formData.date,
      name: formData.name.trim(),
      description: formData.description.trim(),
      location: formData.location.trim(),
      assignee: formData.assignee,
      status: formData.status,
    };

    try {
      if (editingId) {
        const prevTask = tasks.find((t) => t.id === editingId);
        const deadlineChanged = prevTask?.deadline !== computedDeadline;

        const updated: Task = {
          ...(prevTask as Task),
          ...cleaned,
          estimatedDays: validEstDays,
          deadline: computedDeadline,
          deadlineWarnedAt: deadlineChanged ? undefined : prevTask?.deadlineWarnedAt,
          assignedBy:
            prevTask && prevTask.assignee === cleaned.assignee ? prevTask.assignedBy : currentUser,
          updatedAt: nowISO(),
        };

        const { error } = await supabase.from("tasks").update(toDb(updated)).eq("id", editingId);
        if (error) throw error;

        setTasks((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
        await sendStatusEmail(cleaned.name, "Edited", cleaned.assignee);
        const emailed = await notifyAssignment(updated, prevTask?.assignee);
        showToast(
          emailed
            ? `Saved and sent assignment email to ${updated.assignee}`
            : `Saved changes to "${cleaned.name}"`
        );
      } else {
        const newTaskData = {
          ...cleaned,
          estimatedDays: validEstDays,
          deadline: computedDeadline,
          assignedBy: currentUser,
          updatedAt: nowISO(),
        };

        const { data, error } = await supabase
          .from("tasks")
          .insert(toDb(newTaskData))
          .select()
          .single();

        if (error) throw error;

        const newTask = fromDb(data);
        setTasks((prev) => [newTask, ...prev]);
        await sendStatusEmail(cleaned.name, "Added", cleaned.assignee);
        const emailed = await notifyAssignment(newTask, undefined);
        showToast(
          emailed
            ? `Added "${cleaned.name}" and sent email to ${newTask.assignee}`
            : `Added "${cleaned.name}" to the tracker`
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Error saving task");
    } finally {
      setSubmitting(false);
      resetForm();
    }
  };

  const handleEdit = (t: Task) => {
    setEditingId(t.id);
    let estimatedDaysStr = "";
    let estimatedHoursStr = "";
    if (t.estimatedDays !== undefined) {
      const wholeDays = Math.floor(t.estimatedDays);
      const remHours = Math.round((t.estimatedDays - wholeDays) * 24);
      estimatedDaysStr = wholeDays > 0 ? String(wholeDays) : "";
      estimatedHoursStr = remHours > 0 ? String(remHours) : "";
    }
    setFormData({
      date: t.date,
      name: t.name,
      description: t.description,
      assignee: t.assignee,
      location: t.location,
      status: t.status,
      estimatedDays: estimatedDaysStr,
      estimatedHours: estimatedHoursStr,
    });
    setErrors({});
    setOpenDropdown(null);
    setFormOpen(true);
  };

  const estimatedDeadlinePreview = useMemo(() => {
    if (!formData.date) return null;
    const daysTrim = formData.estimatedDays.trim();
    const hoursTrim = formData.estimatedHours.trim();
    const daysNum = daysTrim === "" ? 0 : Number(daysTrim);
    const hoursNum = hoursTrim === "" ? 0 : Number(hoursTrim);
    if (Number.isNaN(daysNum) || Number.isNaN(hoursNum)) return null;
    const totalDays = daysNum + hoursNum / 24;
    if (totalDays <= 0) return null;
    const iso = computeDeadline(formData.date, totalDays);
    return new Date(iso).toLocaleString("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [formData.date, formData.estimatedDays, formData.estimatedHours]);

  const nearestDeadline = useMemo(() => {
    const entries = deadlines
      .filter((d) => d.name.trim() && d.deadline)
      .map((d) => ({ ...d, diff: new Date(d.deadline).getTime() - nowTick }));
    if (entries.length === 0) return null;
    const upcoming = entries.filter((e) => e.diff > 0).sort((a, b) => a.diff - b.diff);
    if (upcoming.length > 0) return upcoming[0];
    return entries.sort((a, b) => b.diff - a.diff)[0];
  }, [deadlines, nowTick]);

  const blinkOn = Math.floor(nowTick / 1000) % 2 === 0;

  const handleDelete = async (t: Task) => {
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) {
      console.error(error);
      showToast("Error deleting task");
      return;
    }

    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    setOpenDropdown(null);
    sendStatusEmail(t.name, "Deleted", t.assignee);
    showToast(`Deleted "${t.name}"`, async () => {
      const { data } = await supabase.from("tasks").insert(toDb(t)).select().single();
      if (data) setTasks((prev) => [fromDb(data), ...prev]);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      setToast(null);
    });
  };

  const handleStatusChange = async (t: Task, status: Status) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status, updated_at: nowISO() })
      .eq("id", t.id);

    if (error) {
      console.error(error);
      return;
    }

    setTasks((prev) =>
      prev.map((x) => (x.id === t.id ? { ...x, status, updatedAt: nowISO() } : x))
    );
    await sendStatusEmail(t.name, STATUS_META[status].label, t.assignee);
  };

  const handleReassign = async (t: Task) => {
    const nextAssignee = otherAssignee(t.assignee);
    const updated: Task = {
      ...t,
      assignee: nextAssignee,
      assignedBy: currentUser,
      updatedAt: nowISO(),
    };

    const { error } = await supabase.from("tasks").update(toDb(updated)).eq("id", t.id);
    if (error) {
      console.error(error);
      showToast("Error reassigning task");
      return;
    }

    setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
    setOpenDropdown(null);
    const emailed = await notifyAssignment(updated, t.assignee);
    showToast(
      emailed
        ? `Assigned "${t.name}" to ${nextAssignee} · email sent`
        : `Assigned "${t.name}" to ${nextAssignee}`
    );
  };

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tasks
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
      .filter((t) => (onlyMine ? t.assignee === currentUser : true))
      .filter(
        (t) =>
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q)
      );

    const byStatus = (a: Task, b: Task) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);

    switch (sortKey) {
      case "date-asc":
        return list.sort((a, b) => a.date.localeCompare(b.date));
      case "status":
        return list.sort(byStatus);
      case "assignee":
        return list.sort((a, b) => a.assignee.localeCompare(b.assignee));
      case "date-desc":
      default:
        // Newest first (by updatedAt)
        return list.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.date).getTime();
          const timeB = new Date(b.updatedAt || b.date).getTime();
          return timeB - timeA;
        });
    }
  }, [tasks, statusFilter, onlyMine, currentUser, query, sortKey]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const mine = tasks.filter((t) => t.assignee === currentUser).length;
    return { total, done, inProgress, todo, pct, mine };
  }, [tasks, currentUser]);

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
    return (
      <div className="min-h-screen bg-white grid place-items-center text-slate-400 text-sm">
        Loading data...
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-5">
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center"
        >
          <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-[#FDF1E7] grid place-items-center text-[#D96B1F]">
            <Icon.Lock className="w-6 h-6" />
          </div>
          <p className="font-mono text-[11px] tracking-widest text-slate-400 uppercase mb-1">
            Undergraduate Thesis
          </p>
          <h1 className="text-xl font-extrabold text-slate-900 mb-2">Welcome to thesis/tracker</h1>
          <p className="text-sm text-slate-500 mb-6 leading-snug">{THESIS_TITLE}</p>
          <label className="block text-left mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
              Password
            </span>
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              value={accessCode}
              onChange={(e) => {
                setAccessCode(e.target.value);
                setAccessError("");
              }}
              placeholder="Enter your Password..."
              className={`input text-center tracking-widest ${accessError ? "input-error" : ""}`}
            />
            {accessError && <span className="text-xs text-red-600 mt-1.5 block">{accessError}</span>}
          </label>
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-[#D96B1F] text-white font-semibold hover:bg-[#c25f1a] transition text-sm"
          >
            Unlock
          </button>
          <p className="text-[11px] text-slate-400 mt-4">
            Only Kim Thanh and Cong Thanh can access this tracker.
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-white border-r border-slate-200 p-5">
        <div className="mb-6 pb-4 border-b border-slate-200">
          <p className="font-mono text-[11px] tracking-widest text-slate-400 uppercase">
            Undergraduate Thesis
          </p>
          <h1 className="text-lg font-bold text-slate-900 font-mono">
            thesis<span className="text-[#D96B1F]">/</span>tracker
          </h1>
          <p className="text-[11px] text-slate-400 mt-2 leading-snug line-clamp-3" title={THESIS_TITLE}>
            {THESIS_TITLE}
          </p>
        </div>

        <div className="mb-6 pb-4 border-b border-slate-200">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
            You are
          </p>
          <p className="text-sm font-semibold text-slate-800">{currentUser}</p>
        </div>

        <nav className="space-y-1">
          {navItem("dashboard", "Dashboard", Icon.Dashboard)}
          {navItem("kanban", "Kanban", Icon.Kanban)}
          {navItem("docs", "Docs", Icon.Docs)}
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-200">
          <p className="font-mono text-[11px] text-slate-400 mb-3">
            {tasks.length} tasks · {stats.mine} yours · synced with supabase
          </p>
          <button
            onClick={handleLock}
            className="w-full flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-[#B85A17] hover:bg-[#FDF1E7] px-2.5 py-2 rounded-lg transition"
          >
            <Icon.Lock className="w-3.5 h-3.5" /> Lock tracker
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex justify-around py-2 shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
        {(["dashboard", "kanban", "docs"] as ViewMode[]).map((id) => {
          const IconCmp =
            id === "dashboard" ? Icon.Dashboard : id === "kanban" ? Icon.Kanban : Icon.Docs;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`p-2 rounded-lg ${view === id ? "text-[#D96B1F]" : "text-slate-400"}`}
            >
              <IconCmp className="w-5 h-5" />
            </button>
          );
        })}
      </nav>

      <main className="flex-1 p-5 md:p-10 pb-24 md:pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-2">
          <div>
            <p className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-1">
              {view === "dashboard"
                ? "Overview"
                : view === "kanban"
                ? "Task Board"
                : "Document Library"}
            </p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900">
              Thesis Progress Tracker
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium">
              {currentUser}
            </div>
            <button
              onClick={handleLock}
              className="md:hidden text-slate-400 hover:text-[#B85A17] p-2.5 rounded-lg border border-slate-200 hover:bg-[#FDF1E7]"
              aria-label="Lock tracker"
            >
              <Icon.Lock className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setDeadlineForm(deadlines);
                setDeadlineModalOpen(true);
              }}
              className={`flex flex-col justify-center min-w-[140px] px-3 py-1.5 rounded-md border text-left transition-colors ${
                nearestDeadline
                  ? "bg-red-600 border-red-700 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-400 hover:border-[#D96B1F]"
              }`}
            >
              <span
                className={`text-[9px] font-mono uppercase tracking-wide ${
                  nearestDeadline ? "opacity-90" : "opacity-70"
                }`}
              >
                Deadline
              </span>
              {nearestDeadline ? (
                <>
                  <span
                    className={`text-xs font-semibold leading-tight truncate transition-opacity duration-150 ${
                      blinkOn ? "opacity-100" : "opacity-25"
                    }`}
                  >
                    {nearestDeadline.name}
                  </span>
                  <span className="font-mono font-bold tracking-wide text-xs">
                    {nearestDeadline.diff <= 0
                      ? `Overdue ${formatCountdownClock(nearestDeadline.diff)}`
                      : `${formatCountdownClock(nearestDeadline.diff)} left`}
                  </span>
                </>
              ) : (
                <span className="text-xs font-medium">+ Add deadline</span>
              )}
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-500 italic mb-6 max-w-2xl">{THESIS_TITLE}</p>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-5 shadow-sm">
            <div
              className="relative w-20 h-20 rounded-full grid place-items-center shrink-0"
              style={{
                background: `conic-gradient(#10B981 ${stats.pct * 3.6}deg, #E5E7EB 0deg)`,
              }}
            >
              <div className="w-14 h-14 rounded-full bg-white grid place-items-center font-mono">
                <span className="text-sm font-bold text-slate-900">{stats.pct}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-600">Completion Progress</p>
              <p className="font-mono text-xs text-slate-400">
                {stats.done}/{stats.total} tasks completed
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {(
              [
                ["Not Started", stats.todo, "text-slate-700"],
                ["In Progress", stats.inProgress, "text-amber-600"],
                ["Completed", stats.done, "text-emerald-600"],
              ] as const
            ).map(([label, val, cls]) => (
              <div
                key={label}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm"
              >
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
              placeholder="Search tasks or assignee..."
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#D96B1F] focus:ring-2 focus:ring-[#D96B1F]/15"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-[#D96B1F]"
          >
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-[#D96B1F]"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
          <button
            onClick={() => setOnlyMine((v) => !v)}
            className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition ${
              onlyMine
                ? "bg-[#FDF1E7] border-[#D96B1F] text-[#B85A17]"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Only mine
          </button>
        </div>

        {/* Dashboard */}
        {view === "dashboard" && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
            {filteredTasks.length === 0 ? (
              <EmptyState onAdd={() => setFormOpen(true)} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredTasks.map((t, i) => {
                  const deadlineInfo = getTaskDeadlineInfo(t, nowTick);
                  const isGithub = t.assignedBy === "GitHub";
                  return (
                    <li
                      key={t.id}
                      className={`flex gap-4 px-5 py-4 hover:bg-slate-50/70 transition group ${
                        i === 0 ? "rounded-t-2xl" : ""
                      } ${i === filteredTasks.length - 1 ? "rounded-b-2xl" : ""} ${
                        t.assignee === currentUser ? "bg-[#FFFBF6]" : ""
                      }`}
                    >
                      <div className="relative w-4 shrink-0 flex justify-center">
                        {i !== 0 && <span className="absolute top-0 h-1/2 w-px bg-slate-200" />}
                        {i !== filteredTasks.length - 1 && (
                          <span className="absolute bottom-0 h-1/2 w-px bg-slate-200" />
                        )}
                        <span
                          className={`relative mt-4 w-2.5 h-2.5 rounded-full ring-4 ring-white ${STATUS_META[t.status].dot}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[90px_1fr_auto_auto_auto] gap-x-4 gap-y-1 items-center">
                        <span
                          className="font-mono text-xs text-slate-400"
                          title={`Updated: ${new Date(t.updatedAt).toLocaleString("en-US")}`}
                        >
                          {t.date}
                        </span>
                        <span className="font-semibold text-slate-900 truncate">{t.name}</span>
                        <span className="text-xs bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full text-slate-600 w-fit flex items-center gap-1">
                          {t.assignee}
                          {t.assignee === currentUser && (
                            <span className="text-[#D96B1F] font-semibold">· you</span>
                          )}
                        </span>
                        <span
                          className={`text-xs border px-2.5 py-1 rounded-full w-fit ${STATUS_META[t.status].badge}`}
                        >
                          {STATUS_META[t.status].label}
                        </span>
                        {t.status !== "done" && (
                          <span
                            className={`text-xs border px-2.5 py-1 rounded-full w-fit ${DEADLINE_LEVEL_STYLE[deadlineInfo.level]}`}
                          >
                            {deadlineInfo.text}
                          </span>
                        )}
                        <span className="md:col-span-5 text-[11px] text-slate-400 font-mono truncate flex items-center gap-2 flex-wrap">
                          {t.location && <span>↳ {t.location}</span>}
                          <span>· Assigned by {t.assignedBy}</span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                              isGithub
                                ? "bg-slate-800 text-white border-slate-700"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {isGithub ? "GitHub" : "Web"}
                          </span>
                        </span>
                      </div>
                      <div
                        className="relative shrink-0 flex items-center gap-1"
                        ref={openDropdown === t.id ? menuRef : undefined}
                      >
                        <button
                          onClick={() => handleReassign(t)}
                          title={`Reassign this task to ${otherAssignee(t.assignee)} and send an email`}
                          className="text-slate-400 hover:text-[#D96B1F] p-1.5 rounded-md hover:bg-[#FDF1E7] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
                        >
                          <Icon.Swap className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setOpenDropdown(openDropdown === t.id ? null : t.id)}
                          className="text-slate-400 hover:text-slate-900 p-1.5 rounded-md hover:bg-slate-100 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
                          aria-label="Actions"
                        >
                          <Icon.Dots className="w-4 h-4" />
                        </button>
                        {openDropdown === t.id && (
                          <div className="absolute right-0 top-9 bg-white border border-slate-200 shadow-lg rounded-lg z-10 w-44 py-1.5 text-sm">
                            <button
                              onClick={() => handleEdit(t)}
                              className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700"
                            >
                              <Icon.Pencil className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(t)}
                              className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-red-50 text-red-600"
                            >
                              <Icon.Trash className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
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
                    <h3 className="text-sm font-semibold text-slate-700">
                      {STATUS_META[status].label}
                    </h3>
                    <span className="ml-auto font-mono text-xs text-slate-400">{items.length}</span>
                  </div>
                  <div className="space-y-3 min-h-[60px]">
                    {items.length === 0 && (
                      <p className="text-xs text-slate-400 italic px-1">No tasks</p>
                    )}
                    {items.map((t) => {
                      const idx = STATUS_ORDER.indexOf(status);
                      const prev = STATUS_ORDER[idx - 1];
                      const next = STATUS_ORDER[idx + 1];
                      const deadlineInfo = getTaskDeadlineInfo(t, nowTick);
                      const isGithub = t.assignedBy === "GitHub";
                      return (
                        <div
                          key={t.id}
                          className={`bg-white border rounded-xl p-3 shadow-sm ${
                            t.assignee === currentUser ? "border-[#F0C39A]" : "border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-sm font-medium text-slate-900">{t.name}</p>
                            <span
                              className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                isGithub
                                  ? "bg-slate-800 text-white border-slate-700"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {isGithub ? "GitHub" : "Web"}
                            </span>
                          </div>
                          {t.status !== "done" && deadlineInfo.level !== "none" && (
                            <span
                              className={`inline-block text-[10px] border px-2 py-0.5 rounded-full mb-1.5 ${DEADLINE_LEVEL_STYLE[deadlineInfo.level]}`}
                            >
                              {deadlineInfo.text}
                            </span>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono text-slate-400">
                              {t.date} · {t.assignee}
                            </span>
                            <div className="flex items-center gap-1">
                              {prev && (
                                <button
                                  onClick={() => handleStatusChange(t, prev)}
                                  className="p-1 text-slate-400 hover:text-[#D96B1F]"
                                  aria-label={`Move back to ${STATUS_META[prev].label}`}
                                >
                                  <Icon.ArrowLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleReassign(t)}
                                className="p-1 text-slate-400 hover:text-[#D96B1F]"
                                aria-label={`Assign to ${otherAssignee(t.assignee)}`}
                                title={`Assign to ${otherAssignee(t.assignee)}`}
                              >
                                <Icon.Swap className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleEdit(t)}
                                className="p-1 text-slate-400 hover:text-slate-700"
                                aria-label="Edit"
                              >
                                <Icon.Pencil className="w-3.5 h-3.5" />
                              </button>
                              {next && (
                                <button
                                  onClick={() => handleStatusChange(t, next)}
                                  className="p-1 text-slate-400 hover:text-[#D96B1F]"
                                  aria-label={`Move forward to ${STATUS_META[next].label}`}
                                >
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

        {/* Docs */}
        {view === "docs" && (
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm">
            {filteredTasks.filter((t) => t.location).length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">No documents linked yet.</p>
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
                    <span
                      className={`text-xs border px-2.5 py-1 rounded-full shrink-0 ${STATUS_META[t.status].badge}`}
                    >
                      {STATUS_META[t.status].label}
                    </span>
                  </div>
                ))
            )}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-2 bg-[#D96B1F] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-[#c25f1a] transition shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D96B1F]"
          >
            <Icon.Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </main>

      {/* Deadline modal */}
      {deadlineModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setDeadlineModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-900">Project Deadlines</h3>
              <button
                type="button"
                onClick={() => setDeadlineModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <Icon.X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {deadlineForm.length === 0 && (
                <p className="text-sm text-slate-400 italic">
                  No deadlines yet. Add your first one below.
                </p>
              )}
              {deadlineForm.map((item) => (
                <div key={item.id} className="flex items-end gap-2 border border-slate-200 rounded-lg p-3">
                  <div className="flex-1 space-y-2">
                    <Field label="Name">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          setDeadlineForm((prev) =>
                            prev.map((d) => (d.id === item.id ? { ...d, name: e.target.value } : d))
                          )
                        }
                        placeholder="e.g. Thesis, Report, Paper..."
                        className="input"
                      />
                    </Field>
                    <Field label="Deadline date & time">
                      <input
                        type="datetime-local"
                        value={toDatetimeLocal(item.deadline)}
                        onChange={(e) =>
                          setDeadlineForm((prev) =>
                            prev.map((d) =>
                              d.id === item.id
                                ? { ...d, deadline: fromDatetimeLocal(e.target.value) ?? "" }
                                : d
                            )
                          )
                        }
                        className="input"
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeadlineForm((prev) => prev.filter((d) => d.id !== item.id))}
                    className="text-slate-400 hover:text-red-600 p-2 rounded-md hover:bg-red-50 shrink-0"
                    aria-label="Delete deadline"
                  >
                    <Icon.Trash className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setDeadlineForm((prev) => [
                    ...prev,
                    { id: `${Date.now()}-${prev.length}`, name: "", deadline: "" },
                  ])
                }
                className="flex items-center gap-2 text-sm font-medium text-[#D96B1F] hover:underline"
              >
                <Icon.Plus className="w-3.5 h-3.5" /> Add deadline
              </button>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeadlineModalOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cleaned = deadlineForm.filter((d) => d.name.trim() && d.deadline);
                  await supabase.from("project_deadlines").delete().neq("id", "");
                  if (cleaned.length > 0) {
                    await supabase.from("project_deadlines").insert(cleaned);
                  }
                  setDeadlines(cleaned);
                  setDeadlineModalOpen(false);
                }}
                className="flex-1 py-2.5 rounded-lg bg-[#D96B1F] text-white font-semibold hover:bg-[#c25f1a] text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit form modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={resetForm}
        >
          <form
            onSubmit={handleAddOrUpdate}
            onClick={(e) => e.stopPropagation()}
            noValidate
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-900">
                {editingId ? "Edit Task" : "Add New Task"}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <Icon.X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <Field label="Task name" error={errors.name}>
                <input
                  autoFocus
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter task name..."
                  className={`input ${errors.name ? "input-error" : ""}`}
                />
              </Field>
              <Field label="Description">
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Add details, scope, or notes about this task..."
                  rows={4}
                  className="input resize-y min-h-[96px]"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Date" error={errors.date}>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className={`input ${errors.date ? "input-error" : ""}`}
                  />
                </Field>
                <Field label="Assignee">
                  <select
                    name="assignee"
                    value={formData.assignee}
                    onChange={handleInputChange}
                    className="input"
                  >
                    {ASSIGNEES.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Estimated days">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    name="estimatedDays"
                    value={formData.estimatedDays}
                    onChange={handleInputChange}
                    placeholder="e.g. 0"
                    className="input"
                  />
                </Field>
                <Field label="Estimated hours">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    step={1}
                    name="estimatedHours"
                    value={formData.estimatedHours}
                    onChange={handleInputChange}
                    placeholder="e.g. 6"
                    className="input"
                  />
                </Field>
              </div>
              {estimatedDeadlinePreview && (
                <p className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  Estimated deadline:{" "}
                  <span className="font-semibold text-slate-800">{estimatedDeadlinePreview}</span>
                </p>
              )}
              {formData.assignee !== currentUser && (
                <p className="flex items-center gap-1.5 text-xs text-[#B85A17] bg-[#FDF1E7] border border-[#F0C39A] rounded-lg px-3 py-2">
                  <Icon.Mail className="w-3.5 h-3.5 shrink-0" />
                  When you save, the system will email {formData.assignee} to let them know you just
                  assigned this task to them.
                </p>
              )}
              <Field label="Status">
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="input"
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Storage location">
                <input
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Link/Folder..."
                  className="input"
                />
              </Field>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-lg bg-[#D96B1F] text-white font-semibold hover:bg-[#c25f1a] disabled:opacity-60 text-sm"
              >
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Add Task"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm pl-4 pr-2 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm">
          <span className="font-mono">{toast.message}</span>
          {toast.onUndo && (
            <button
              onClick={toast.onUndo}
              className="flex items-center gap-1 text-[#F4A662] hover:text-[#ffb877] font-medium px-2 py-1 rounded-md hover:bg-white/10 shrink-0"
            >
              <Icon.Undo className="w-3.5 h-3.5" /> Undo
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
        {label}
      </span>
      {children}
      {error && <span className="text-xs text-red-600 mt-1 block">{error}</span>}
    </label>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-16 text-center">
      <p className="font-mono text-sm text-slate-400 mb-1">// no commits yet</p>
      <p className="text-slate-500 mb-5">No tasks match the current filters.</p>
      <button onClick={onAdd} className="text-sm font-medium text-[#D96B1F] hover:underline">
        + Add your first task
      </button>
    </div>
  );
}