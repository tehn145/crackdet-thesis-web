"use client";

import { useState } from "react";

export default function Home() {
  // Tạo dữ liệu giả lập các công việc khóa luận
  const [tasks, setTasks] = useState([
    { id: 1, name: "Tổng quan tài liệu nhận diện vết nứt", status: "To-do" },
    { id: 2, name: "Thu thập tập dữ liệu ảnh (Dataset)", status: "In Progress" },
    { id: 3, name: "Thiết lập GitHub và Vercel", status: "Done" },
  ]);

  const handleUpdate = async (id: number, taskName: string, newStatus: string) => {
    // 1. Cập nhật giao diện trên web ngay lập tức
    setTasks(tasks.map((task) => (task.id === id ? { ...task, status: newStatus } : task)));

    // 2. Gọi API để gửi email báo cáo
    try {
      await fetch("/api/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: taskName,
          newStatus: newStatus,
          user: "Thành", // Bạn có thể tự đổi tên ở đây
        }),
      });
      alert(`Đã chuyển "${taskName}" thành ${newStatus} và gửi email thành công!`);
    } catch (error) {
      alert("Lỗi khi gửi email!");
    }
  };

  return (
    <main className="min-h-screen p-10 bg-gray-100 font-sans">
      <h1 className="text-3xl font-bold mb-8 text-center text-blue-600">Quản Lý Tiến Độ Khóa Luận</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cột TO-DO */}
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-gray-400">
          <h2 className="text-xl font-bold mb-4 text-gray-700">📋 Cần làm (To-do)</h2>
          {tasks.filter(t => t.status === "To-do").map(task => (
            <div key={task.id} className="bg-gray-50 p-3 mb-3 rounded border">
              <p className="font-semibold text-gray-800 mb-2">{task.name}</p>
              <button onClick={() => handleUpdate(task.id, task.name, "In Progress")} className="bg-blue-500 text-white px-3 py-1 rounded text-sm w-full hover:bg-blue-600">
                Bắt đầu làm 🚀
              </button>
            </div>
          ))}
        </div>

        {/* Cột IN PROGRESS */}
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-blue-500">
          <h2 className="text-xl font-bold mb-4 text-blue-600">⏳ Đang làm (In Progress)</h2>
          {tasks.filter(t => t.status === "In Progress").map(task => (
            <div key={task.id} className="bg-blue-50 p-3 mb-3 rounded border border-blue-100">
              <p className="font-semibold text-gray-800 mb-2">{task.name}</p>
              <button onClick={() => handleUpdate(task.id, task.name, "Done")} className="bg-green-500 text-white px-3 py-1 rounded text-sm w-full hover:bg-green-600">
                Hoàn thành ✅
              </button>
            </div>
          ))}
        </div>

        {/* Cột DONE */}
        <div className="bg-white p-5 rounded-lg shadow-md border-t-4 border-green-500">
          <h2 className="text-xl font-bold mb-4 text-green-600">✅ Đã xong (Done)</h2>
          {tasks.filter(t => t.status === "Done").map(task => (
            <div key={task.id} className="bg-green-50 p-3 mb-3 rounded border border-green-100">
              <p className="font-semibold text-gray-800 mb-2 line-through">{task.name}</p>
              <span className="text-green-600 text-sm font-bold">Hoàn tất tuyệt vời! 🎉</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}