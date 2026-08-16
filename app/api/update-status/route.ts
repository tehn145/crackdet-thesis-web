import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const TO_EMAILS = [
  "ngokimthanh1455@gmail.com",
  "trancongthanh040205@gmail.com",
];

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

// ========== GitHub Webhook ==========
if (payload.repository || payload.pusher || payload.commits) {
  const repoName = payload.repository?.name || "GitHub Repo";
  const pusherName =
    payload.pusher?.name ||
    payload.pusher?.email ||
    payload.sender?.login ||
    "Someone";
  const commits = payload.commits || [];
  const branch = payload.ref?.replace("refs/heads/", "") || "main";

  console.log("Processing GitHub push:", {
    repoName,
    pusherName,
    commitsCount: commits.length,
  });

  // Map tên GitHub → tên trong hệ thống (có thể mở rộng)
  const mapGithubUser = (name: string) => {
    const lower = (name || "").toLowerCase();
    if (lower.includes("kim") || lower.includes("thanh") || lower.includes("ngokim"))
      return "Kim Thanh";
    if (lower.includes("cong") || lower.includes("trancong"))
      return "Cong Thanh";
    return name || "Kim Thanh"; // fallback
  };

  const githubUser = mapGithubUser(pusherName);

  const tasksToInsert = commits.map((c: any) => {
    const authorName = c.author?.name || c.author?.username || pusherName;
    const mappedAuthor = mapGithubUser(authorName);

    return {
      date: new Date().toISOString().split("T")[0],
      name: (c.message?.split("\n")[0] || "GitHub commit").slice(0, 120),
      description: `Commit by ${authorName}\n\n${c.message || ""}\n\nSHA: ${c.id}\nBranch: ${branch}`,
      assignee: mappedAuthor,                    // user trên GitHub
      assigned_by: "GitHub",                     // nguồn = GitHub
      location: c.url || payload.repository?.html_url || "",
      status: "done",                            // ← completed
      updated_at: new Date().toISOString(),
    };
  });

  if (tasksToInsert.length > 0) {
    const { data, error } = await supabase
      .from("tasks")
      .insert(tasksToInsert)
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Supabase insert failed", details: error.message },
        { status: 500 }
      );
    }
    console.log("Inserted tasks:", data?.length);
  }

  const commitMessages = commits
    .map((c: any) => `• ${(c.message || "No message").split("\n")[0]}`)
    .join("<br>");

  await sendMail(
    `[GitHub] ${pusherName} pushed to ${repoName}`,
    `
      <h2>${pusherName} vừa push code mới lên GitHub</h2>
      <p><strong>Repo:</strong> ${repoName} (${branch})</p>
      <p><strong>Các thay đổi:</strong></p>
      <p>${commitMessages || "Không có commit message"}</p>
      <br/>
      <p>Task đã được tự động thêm (status: Completed) vào Thesis Tracker.</p>
    `
  );

  return NextResponse.json({
    ok: true,
    message: "GitHub processed + email sent + tasks created",
    inserted: tasksToInsert.length,
  });
}

    // ========== 2. Status update ==========
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

    // ========== 3. Assignment ==========
    if (type === "assignment") {
      const { taskName, date, location, status, assignedTo, assignedBy } =
        payload;
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

    // ========== 4. Deadline warning ==========
    if (type === "deadline-warning") {
      const { taskName, deadline, assignee } = payload;
      await sendMail(
        `[Cảnh báo Deadline] ${taskName} sắp đến hạn`,
        `
          <h2>⚠️ Deadline sắp đến</h2>
          <p>Task <strong>"${taskName}"</strong> (assignee: ${assignee}) sắp đến hạn vào:</p>
          <p style="font-size:1.2em;font-weight:bold;color:#c53030">${new Date(
            deadline
          ).toLocaleString("vi-VN")}</p>
          <p>Hãy hoàn thành sớm nhé!</p>
        `
      );
      return NextResponse.json({ message: "Deadline warning sent" });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Server error when sending mail / processing" },
      { status: 500 }
    );
  }
}