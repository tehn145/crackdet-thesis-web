"use client";
import { useState } from "react";

export default function Home() {
  const [tasks, setTasks] = useState([
    { id: 1, date: "2026-08-14", name: "Tổng quan tài liệu nhận diện vết nứt", assignee: "Thành", location: "Drive/Tài liệu" }
  ]);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], name: "", assignee: "Thành", location: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const handleInputChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const sendEmail = async (taskName: string, status: string, user: string) => {
    await fetch("/api/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskName, newStatus: status, user }),
    });
  };

  const handleAddOrUpdate = async (e: any) => {
    e.preventDefault();
    if (editingId) {
      setTasks(tasks.map(t => t.id === editingId ? { ...formData, id: editingId } : t));
      await sendEmail(formData.name, "Đã chỉnh sửa", formData.assignee);
      setEditingId(null);
    } else {
      const newTask = { id: Date.now(), ...formData };
      setTasks([...tasks, newTask]);
      await sendEmail(formData.name, "Đã thêm mới", formData.assignee);
    }
    setFormData({ date: new Date().toISOString().split('T')[0], name: "", assignee: "Thành", location: "" });
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <aside className="w-64 bg-slate-950 text-white p-6 shadow-2xl">
        <h1 className="text-xl font-bold mb-10 text-blue-400 border-b border-slate-800 pb-4">THESIS TRACKER</h1>
        <nav className="space-y-4">
          <div className="text-blue-500 font-semibold bg-blue-900/30 p-3 rounded-lg border-l-4 border-blue-500">📊 Dashboard</div>
          <div className="text-slate-400 p-3 hover:text-white cursor-pointer transition">📋 Kanban</div>
          <div className="text-slate-400 p-3 hover:text-white cursor-pointer transition">📁 Tài liệu</div>
        </nav>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <h2 className="text-3xl font-extrabold mb-8 text-slate-900">Quản lý Tiến Độ Khóa Luận</h2>
        
        <form onSubmit={handleAddOrUpdate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 grid grid-cols-5 gap-4 items-end">
          <div className="col-span-1"><label className="text-xs font-bold text-slate-500 uppercase">Ngày</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-2.5 mt-1 border rounded-lg" /></div>
          <div className="col-span-1"><label className="text-xs font-bold text-slate-500 uppercase">Tên công việc</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-2.5 mt-1 border rounded-lg" placeholder="Nhập tên..." /></div>
          <div className="col-span-1"><label className="text-xs font-bold text-slate-500 uppercase">Người làm</label><select name="assignee" value={formData.assignee} onChange={handleInputChange} className="w-full p-2.5 mt-1 border rounded-lg"><option>Thành</option><option>Bạn chung nhóm</option></select></div>
          <div className="col-span-1"><label className="text-xs font-bold text-slate-500 uppercase">Nơi lưu trữ</label><input type="text" name="location" value={formData.location} onChange={handleInputChange} className="w-full p-2.5 mt-1 border rounded-lg" placeholder="Link/Folder..." /></div>
          <button type="submit" className="bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 shadow-lg">{editingId ? "Lưu thay đổi" : "Thêm mới"}</button>
        </form>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-500 uppercase text-xs">
              <tr><th className="p-5">STT</th><th className="p-5">Ngày</th><th className="p-5">Công việc</th><th className="p-5">Người làm</th><th className="p-5">Nơi lưu</th><th className="p-5 text-center">Thao tác</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((t, i) => (
                <tr key={t.id} className="hover:bg-slate-50 transition">
                  <td className="p-5 font-bold">{i + 1}</td>
                  <td className="p-5 text-slate-500">{t.date}</td>
                  <td className="p-5 font-semibold text-blue-700">{t.name}</td>
                  <td className="p-5"><span className="bg-slate-100 px-3 py-1 rounded-full text-sm">{t.assignee}</span></td>
                  <td className="p-5 text-slate-500">{t.location}</td>
                  <td className="p-5 text-center relative">
                    <button onClick={() => setOpenDropdown(openDropdown === t.id ? null : t.id)} className="text-slate-400 hover:text-black text-2xl">⋮</button>
                    {openDropdown === t.id && (
                      <div className="absolute right-10 top-10 bg-white shadow-xl border rounded-lg z-10 w-32 py-2">
                        <button onClick={() => { setEditingId(t.id); setFormData(t); setOpenDropdown(null); }} className="block w-full text-left px-4 py-2 hover:bg-slate-100">Sửa</button>
                        <button onClick={async () => { setTasks(tasks.filter(x => x.id !== t.id)); await sendEmail(t.name, "Đã xóa", t.assignee); setOpenDropdown(null); }} className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50">Xóa</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}