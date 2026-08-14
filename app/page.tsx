"use client";
import { useState } from "react";

export default function Home() {
  const [tasks, setTasks] = useState([
    { id: 1, date: "2026-08-14", name: "Tổng quan tài liệu nhận diện vết nứt", assignee: "Thành", location: "Drive/Tài liệu" }
  ]);
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], name: "", assignee: "Thành", location: "" });
  const [editingId, setEditingId] = useState<number | null>(null);

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
      await sendEmail(formData.name, "Đã chỉnh sửa thông tin", formData.assignee);
      setEditingId(null);
    } else {
      const newTask = { id: Date.now(), ...formData };
      setTasks([...tasks, newTask]);
      await sendEmail(formData.name, "Đã thêm mới", formData.assignee);
    }
    setFormData({ date: new Date().toISOString().split('T')[0], name: "", assignee: "Thành", location: "" });
  };

  const startEdit = (task: any) => {
    setEditingId(task.id);
    setFormData(task);
  };

  const handleDelete = async (task: any) => {
    if (!confirm("Xác nhận xóa?")) return;
    setTasks(tasks.filter(t => t.id !== task.id));
    await sendEmail(task.name, "Đã bị XÓA", task.assignee);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-slate-900 text-white p-6">
        <h1 className="text-2xl font-bold text-blue-400">Thesis Tracker</h1>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="bg-white p-6 rounded-xl shadow border mb-8">
          <h3 className="text-xl font-bold mb-4">{editingId ? "Chỉnh sửa công việc" : "Thêm công việc mới"}</h3>
          <form onSubmit={handleAddOrUpdate} className="grid grid-cols-5 gap-4">
            <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="p-2 border rounded" />
            <input type="text" name="name" placeholder="Tên công việc" value={formData.name} onChange={handleInputChange} className="p-2 border rounded" />
            <select name="assignee" value={formData.assignee} onChange={handleInputChange} className="p-2 border rounded"><option>Thành</option><option>Bạn chung nhóm</option></select>
            <input type="text" name="location" placeholder="Nơi lưu trữ" value={formData.location} onChange={handleInputChange} className="p-2 border rounded" />
            <button type="submit" className="bg-blue-600 text-white rounded font-bold">{editingId ? "Lưu thay đổi" : "Thêm vào bảng"}</button>
          </form>
        </div>

        <table className="w-full bg-white rounded-xl shadow border">
          <thead className="bg-slate-100 text-slate-600">
            <tr><th className="p-4">Ngày</th><th className="p-4">Công việc</th><th className="p-4">Người thực hiện</th><th className="p-4">Nơi lưu</th><th className="p-4">Thao tác</th></tr>
          </thead>
          <tbody className="divide-y text-center">
            {tasks.map(t => (
              <tr key={t.id}>
                <td className="p-4">{t.date}</td>
                <td className="p-4 font-semibold text-blue-600">{t.name}</td>
                <td className="p-4">{t.assignee}</td>
                <td className="p-4">{t.location}</td>
                <td className="p-4 space-x-2">
                  <button onClick={() => startEdit(t)} className="text-yellow-600 font-bold hover:underline">Sửa</button>
                  <button onClick={() => handleDelete(t)} className="text-red-600 font-bold hover:underline">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}