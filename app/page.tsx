"use client";

import { useState } from "react";

export default function Home() {
  // Hàm lấy ngày hôm nay theo chuẩn YYYY-MM-DD
  const getTodayDate = () => {
    const today = new Date();
    // Điều chỉnh múi giờ cục bộ để tránh bị lùi ngày do giờ quốc tế
    const offset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(today.getTime() - offset)).toISOString().slice(0, -1);
    return localISOTime.split('T')[0];
  };

  // Dữ liệu mẫu của bảng
  const [tasks, setTasks] = useState([
    { id: 1, date: getTodayDate(), name: "Tổng quan tài liệu nhận diện vết nứt", assignee: "Thành", location: "Thư mục Drive/Tài liệu" }
  ]);

  // Lưu trữ dữ liệu người dùng đang nhập vào form, tự động điền ngày hôm nay
  const [formData, setFormData] = useState({
    date: getTodayDate(), 
    name: "",
    assignee: "Thành",
    location: ""
  });

  // Hàm xử lý khi người dùng gõ vào form
  const handleInputChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Hàm xử lý khi bấm nút "Thêm vào bảng & Gửi Mail"
  const handleAddTask = async (e: any) => {
    e.preventDefault(); // Ngăn trang web bị reload
    
    if (!formData.name || !formData.date) {
      alert("Vui lòng nhập ít nhất Tên công việc và Ngày!");
      return;
    }

    // 1. Thêm dữ liệu mới vào Bảng trên web
    const newTask = {
      id: tasks.length + 1,
      ...formData
    };
    setTasks([...tasks, newTask]);

    // 2. Tận dụng API cũ để gửi mail thông báo
    try {
      await fetch("/api/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Ghép thông tin lại để tận dụng form mail cũ
          taskName: `${formData.name} (Lưu tại: ${formData.location || 'Không có'})`,
          newStatus: "Được THÊM MỚI vào hệ thống",
          user: formData.assignee,
        }),
      });
      alert("Đã thêm thành công và gửi thông báo qua Email!");
      
      // Xóa trắng form sau khi thêm xong nhưng vẫn giữ nguyên ngày hôm nay
      setFormData({ date: getTodayDate(), name: "", assignee: "Thành", location: "" });
    } catch (error) {
      alert("Lỗi khi gửi email!");
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* ================= BAR DỌC BÊN TRÁI (SIDEBAR) ================= */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-blue-400">Thesis Tracker</h1>
          <p className="text-sm text-slate-400 mt-1">Quản lý khóa luận</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full text-left p-3 bg-blue-600 rounded-lg font-semibold shadow">
            📊 Dashboard
          </button>
          <button className="w-full text-left p-3 hover:bg-slate-800 rounded-lg text-slate-300 transition">
            📋 Kanban (Đang phát triển)
          </button>
          <button className="w-full text-left p-3 hover:bg-slate-800 rounded-lg text-slate-300 transition">
            📁 Tài nguyên chung
          </button>
        </nav>
      </aside>

      {/* ================= NỘI DUNG CHÍNH (MAIN CONTENT) ================= */}
      <main className="flex-1 p-8 overflow-y-auto">
        <h2 className="text-3xl font-bold text-slate-800 mb-6">Dashboard Báo Cáo Tiến Độ</h2>

        {/* --- KHU VỰC 1: FORM NHẬP LIỆU --- */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <h3 className="text-xl font-semibold text-slate-700 mb-4">Thêm công việc mới</h3>
          <form onSubmit={handleAddTask} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày cập nhật</label>
              <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium text-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên công việc</label>
              <input type="text" name="name" placeholder="Vd: Code thuật toán YOLO" value={formData.name} onChange={handleInputChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Người thực hiện</label>
              <select name="assignee" value={formData.assignee} onChange={handleInputChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="Thành">Thành</option>
                <option value="Bạn chung nhóm">Bạn chung nhóm</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nơi lưu trữ (Link/Thư mục)</label>
              <input type="text" name="location" placeholder="Vd: Thư mục Github / Drive" value={formData.location} onChange={handleInputChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            
            <div className="md:col-span-4 flex justify-end mt-2">
              <button type="submit" className="bg-green-600 text-white font-bold py-2 px-6 rounded hover:bg-green-700 shadow-md transition">
                + Thêm vào bảng & Gửi Mail
              </button>
            </div>
          </form>
        </div>

        {/* --- KHU VỰC 2: BẢNG (TABLE) HIỂN THỊ --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 border-b border-gray-200 text-slate-600">
              <tr>
                <th className="p-4 font-semibold w-16 text-center">STT</th>
                <th className="p-4 font-semibold w-32">Ngày</th>
                <th className="p-4 font-semibold">Tên công việc</th>
                <th className="p-4 font-semibold w-40">Người thực hiện</th>
                <th className="p-4 font-semibold">Nơi lưu trữ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasks.map((task, index) => (
                <tr key={task.id} className="hover:bg-slate-50 transition">
                  <td className="p-4 text-center font-medium text-gray-500">{index + 1}</td>
                  <td className="p-4 text-gray-600">{task.date}</td>
                  <td className="p-4 font-medium text-blue-600">{task.name}</td>
                  <td className="p-4 text-gray-800">
                    <span className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full text-sm">{task.assignee}</span>
                  </td>
                  <td className="p-4 text-gray-500">{task.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tasks.length === 0 && (
            <div className="p-8 text-center text-gray-500">Chưa có công việc nào. Hãy thêm ở form phía trên nhé!</div>
          )}
        </div>

      </main>
    </div>
  );
}