import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // dùng service role để webhook insert được
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const TO_EMAILS = ["ngokimthanh1455@gmail.com", "trancongthanh040205@gmail.com"];

async function sendMail(subject: string, html: string) {
  await transporter.sendMail({
    from: `"Crack Detection / Thesis Tracker" <${process.env.EMAIL_USER}>`,
    to: TO_EMAILS,
    subject,
    html,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { type } = payload;

    // ========== 1. GitHub Webhook ==========
    if (type === "github" || payload.repository) {
      const repoName = payload.repository?.name || "GitHub Repo";
      const pusherName = payload.pusher?.name || "Someone";
      const commits = payload.commits || [];
      const branch = payload.ref?.replace("refs/heads/", "") || "main";

      // Tạo task tự động từ mỗi commit (hoặc gộp)
      const tasksToInsert = commits.map((c: any) => ({
        date: new Date().toISOString().split("T")[0],
        name: c.message?.split("\n")[0]?.slice(0, 120) || "GitHub commit",
        description: `Commit by ${c.author?.name || pusherName}\n\n${c.message}\n\nSHA: ${c.id}\nBranch: ${branch}`,
        assignee: "Kim Thanh", // hoặc logic map theo author
        assigned_by: "GitHub Webhook",
        location: c.url || payload.repository?.html_url || "",
        status: "todo",
        updated_at: new Date().toISOString(),
      }));

      if (tasksToInsert.length > 0) {
        const { error } = await supabase.from("tasks").insert(tasksToInsert);
        if (error) {
          console.error("Supabase insert error:", error);
          // vẫn gửi mail dù insert lỗi
        }
      }

      const commitMessages = commits
        .map((c: any) => `• ${c.message?.split("\n")[0] || "No message"}`)
        .join("<br>");

      await sendMail(
        `[GitHub] ${pusherName} pushed to ${repoName}`,
        `
          <h2>${pusherName} vừa push code mới lên GitHub</h2>
          <p><strong>Repo:</strong> ${repoName} (${branch})</p>
          <p><strong>Các thay đổi:</strong></p>
          <p>${commitMessages || "Không có commit message"}</p>
          <br/>
          <p>Task đã được tự động thêm vào Thesis Tracker. Vào web kiểm tra và cập nhật trạng thái nhé!</p>
        `
      );

      return NextResponse.json({ message: "GitHub processed + email sent + tasks created" });
    }

    // ========== 2. Status / Assignment / Deadline ==========
    if (type === "status") {
      const { taskName, newStatus, user } = payload;
      await sendMail(
        `[Tiến độ KLTN] ${taskName} → ${newStatus}`,
        `
          <h2>Cập nhật tiến độ khóa luận</h2>
          <p>Thành viên <strong>${user}</strong> vừa chuyển công việc <strong>"${taskName}"</strong> sang trạng thái: <span style="color:#D96B1F;font-weight:bold">${newStatus}</span>.</p>
          <p>Vào web kiểm tra ngay nhé!</p>
        `
      );
      return NextResponse.json({ message: "Status email sent" });
    }

    if (type === "assignment") {
      const { taskName, date, location, status, assignedTo, assignedBy } = payload;
      await sendMail(
        `[Phân công] ${assignedBy} đã giao task cho ${assignedTo}`,
        `
          <h2>Bạn vừa được giao task mới</h2>
          <p><strong>Task:</strong> ${taskName}</p>
          <p><strong>Ngày:</strong> ${date}</p>
          <p><strong>Trạng thái:</strong> ${status}</p>
          <p><strong>Location:</strong> ${location || "—"}</p>
          <p><strong>Người giao:</strong> ${assignedBy}</p>
          <br/>
          <p>Vào Thesis Tracker để xem chi tiết và cập nhật tiến độ.</p>
        `
      );
      return NextResponse.json({ message: "Assignment email sent" });
    }

    if (type === "deadline-warning") {
      const { taskName, deadline, assignee } = payload;
      await sendMail(
        `[Cảnh báo Deadline] ${taskName} sắp đến hạn`,
        `
          <h2>⚠️ Deadline sắp đến</h2>
          <p>Task <strong>"${taskName}"</strong> (assignee: ${assignee}) sắp đến hạn vào:</p>
          <p style="font-size:1.2em;font-weight:bold;color:#c53030">${new Date(deadline).toLocaleString("vi-VN")}</p>
          <p>Hãy hoàn thành sớm nhé!</p>
        `
      );
      return NextResponse.json({ message: "Deadline warning sent" });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error when sending mail / processing" }, { status: 500 });
  }