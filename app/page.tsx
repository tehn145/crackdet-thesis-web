"use client";

import { useState } from "react";

export default function Home() {
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [tasks, setTasks] = useState([
    { id: Date.now(), date: getTodayDate(), name: "Tổng quan tài liệu nhận diện vết nứt", assignee: "Thành", location: "Thư mục Drive/Tài liệu" }
  ]);

  const [formData, setFormData] = useState({ date: getTodayDate(), name: "", assignee: "Thành", location: "" });

  const handleInputChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // Hàm thêm công việc
  const handleAddTask = async (e: any) => {
    e.preventDefault();
    if (!formData.name) return;

    const newTask = { id: Date.now(), ...formData };
    setTasks([...tasks, newTask]);

    await fetch("/api/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskName: formData.name,
        newStatus: "Được THÊM MỚI",
        user: formData.assignee,
      }),
    });
    setFormData({ date: getTodayDate(), name: "", assignee: "Thành", location: "" });
  };

  // Hàm xóa công việc và gửi mail thông báo
  const handleDeleteTask = async (task: any) => {
    if (!confirm(`Bạn có chắc muốn xóa: ${task.name}?`)) return;

    setTasks(tasks.filter(t => t.id !== task.id));

    await fetch("/api/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskName: task.name,
        newStatus: "Đã BỊ XÓA khỏi hệ thống",
        user: task.assignee,
      }),
    });
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-blue-400">Thesis Tracker</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full text-left p-3 bg-blue-600 rounded-lg font-semibold">📊 Dashboard</button>
        </nav>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <h2 className="text-3xl font-bold text-slate-800 mb-6">Dashboard Báo Cáo Tiến Độ</h2>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <form onSubmit={handleAddTask} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div><label className="block text-sm text-gray-700">Ngày</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-2 border rounded" /></div>
            <div><label className="block text-sm text-gray-700">Tên công việc</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-2 border rounded" /></div>
            <div><label className="block text-sm text-gray-700">Người thực hiện</label><select name="assignee" value={formData.assignee} onChange={handleInputChange} className="w-full p-2 border rounded"><option>Thành</option><option>Bạn chung nhóm</option></select></div>
            <div><label className="block text-sm text-gray-700">Nơi lưu trữ</label><input type="text" name="location" value={formData.location} onChange={handleInputChange} className="w-full p-2 border rounded" /></div>
            <div className="md:col-span-4 flex justify-end"><button type="submit" className="bg-green-600 text-white py-2 px-6 rounded hover:bg-green-700">+ Thêm & Gửi Mail</button></div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="p-4">STT</th>
                <th className="p-4">Tên công việc</th>
                <th className="p-4">Người thực hiện</th>
                <th className="p-4">Nơi lưu trữ</th>
                <th className="p-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map((task, index) => (
                <tr key={task.id} className="hover:bg-slate-50">
                  <td className="p-4">{index + 1}</td>
                  <td className="p-4 font-medium text-blue-600">{task.name}</td>
                  <td className="p-4"><span className="bg-blue-100 py-1 px-3 rounded-full text-sm">{task.assignee}</span></td>
                  <td className="p-4 text-gray-600">{task.location}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleDeleteTask(task)} className="text-red-600 hover:text-red-800 font-semibold underline">Xóa</button>
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