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

const WEB_URL = "https://crackdet-thesis-web.vercel.app"; // ← đổi nếu domain khác
const THESIS_TITLE =
  "Deep Learning-Based Surface Damage Detection and Classification for Civil Infrastructure";

// ========== Email Template ==========
function buildEmailHtml(options: {
  title: string;
  badge?: string;
  badgeColor?: string;
  content: string;
}) {
  const { title, badge, badgeColor = "#D96B1F", content } = options;

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#D96B1F 0%,#c25f1a 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.85);font-weight:600;">
                Crack Detection
              </p>
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;">
                ${title}
              </h1>
              ${
                badge
                  ? `<span style="display:inline-block;margin-top:12px;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,0.2);color:#fff;font-size:12px;font-weight:600;">${badge}</span>`
                  : ""
              }
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${WEB_URL}" 
                       style="display:inline-block;padding:12px 28px;background:#D96B1F;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px;">
                      Crack-Detection Progress →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;padding:20px 32px;border-top:1px solid #eee;">
              <p style="margin:0 0 6px;font-size:12px;color:#64748b;line-height:1.5;text-align:center;">
                ${THESIS_TITLE}
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
                Undergraduate Thesis Tracker · Only for Kim Thanh & Cong Thanh
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendMail(subject: string, html: string) {
  await transporter.sendMail({
    from: `"Crack Detection" <${process.env.EMAIL_USER}>`,
    to: TO_EMAILS,
    subject,
    html,
  });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log("=== Received payload ===", Object.keys(payload));

// ========== 1. GitHub Webhook ==========
if (payload.repository || payload.pusher || payload.commits) {
  const repoName = payload.repository?.name || "GitHub Repo";
  const pusherName =
    payload.pusher?.name ||
    payload.pusher?.email ||
    payload.sender?.login ||
    "Someone";
  const commits = payload.commits || [];
  const branch = payload.ref?.replace("refs/heads/", "") || "main";

  // Lấy username GitHub thật (không map sang Kim Thanh / Cong Thanh)
  const getGithubUsername = (c: any) => {
    return (
      c.author?.username ||
      c.author?.name ||
      c.committer?.username ||
      c.committer?.name ||
      payload.pusher?.name ||
      payload.sender?.login ||
      "github-user"
    );
  };

  const tasksToInsert = commits.map((c: any) => {
    const githubUser = getGithubUsername(c);

    return {
      date: new Date().toISOString().split("T")[0],
      name: (c.message?.split("\n")[0] || "GitHub commit").slice(0, 120),
      description: `Commit by ${githubUser}\n\n${c.message || ""}\n\nSHA: ${c.id}\nBranch: ${branch}`,
      assignee: githubUser,          // ← hiển thị đúng username GitHub (vd: tehn145)
      assigned_by: "GitHub",
      location: c.url || payload.repository?.html_url || "",
      status: "done",
      updated_at: new Date().toISOString(),
    };
  });

  if (tasksToInsert.length > 0) {
    const { error } = await supabase.from("tasks").insert(tasksToInsert);
    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Supabase insert failed", details: error.message },
        { status: 500 }
      );
    }
  }

  const commitList = commits
    .map(
      (c: any) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;">
            • ${(c.message || "No message").split("\n")[0]}
          </td>
        </tr>`
    )
    .join("");

  const html = buildEmailHtml({
    title: "New GitHub Push",
    badge: "GitHub",
    content: `
      <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
        <strong>${pusherName}</strong> vừa push code mới lên repository <strong>${repoName}</strong> (branch: <code>${branch}</code>).
      </p>
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">
        Commits
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${commitList || "<tr><td style='font-size:13px;color:#94a3b8;'>Không có commit message</td></tr>"}
      </table>
      <p style="margin:20px 0 0;font-size:14px;color:#64748b;">
        Các task đã được tự động thêm vào tracker với trạng thái <strong>Completed</strong>.
      </p>
    `,
  });

  await sendMail(`[Crack Detection] ${pusherName} pushed to ${repoName}`, html);

  return NextResponse.json({
    ok: true,
    message: "GitHub processed + email sent + tasks created",
    inserted: tasksToInsert.length,
  });
}

    // ========== 2. Status update ==========
    if (payload.type === "status") {
      const { taskName, newStatus, user } = payload;

      const html = buildEmailHtml({
        title: "Task Status Updated",
        badge: newStatus,
        content: `
          <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
            Thành viên <strong>${user}</strong> vừa cập nhật trạng thái công việc:
          </p>
          <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:8px;">
            <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Task</p>
            <p style="margin:0;font-size:16px;font-weight:600;color:#0f172a;">${taskName}</p>
          </div>
          <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;">
            <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">New Status</p>
            <p style="margin:0;font-size:16px;font-weight:600;color:#D96B1F;">${newStatus}</p>
          </div>
        `,
      });

      await sendMail(`[Crack Detection] ${taskName} → ${newStatus}`, html);
      return NextResponse.json({ message: "Status email sent" });
    }

    // ========== 3. Assignment ==========
    if (payload.type === "assignment") {
      const { taskName, date, location, status, assignedTo, assignedBy } = payload;

      const html = buildEmailHtml({
        title: "New Task Assigned",
        badge: "Assignment",
        content: `
          <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
            <strong>${assignedBy}</strong> vừa giao task cho <strong>${assignedTo}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;">Task</p>
                <p style="margin:0;font-size:15px;font-weight:600;color:#0f172a;">${taskName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;">Date</p>
                <p style="margin:0;font-size:14px;color:#334155;">${date}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #e2e8f0;">
                <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;">Status</p>
                <p style="margin:0;font-size:14px;color:#334155;">${status}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;">
                <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;">Location</p>
                <p style="margin:0;font-size:14px;color:#334155;">${location || "—"}</p>
              </td>
            </tr>
          </table>
        `,
      });

      await sendMail(
        `[Crack Detection] ${assignedBy} assigned task to ${assignedTo}`,
        html
      );
      return NextResponse.json({ message: "Assignment email sent" });
    }

    // ========== 4. Deadline warning ==========
    if (payload.type === "deadline-warning") {
      const { taskName, deadline, assignee } = payload;
      const deadlineStr = new Date(deadline).toLocaleString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const html = buildEmailHtml({
        title: "Deadline Warning",
        badge: "Urgent",
        badgeColor: "#dc2626",
        content: `
          <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
            Task của <strong>${assignee}</strong> sắp đến hạn. Hãy hoàn thành sớm nhé!
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:20px;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">
              Task
            </p>
            <p style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">
              ${taskName}
            </p>
            <p style="margin:0 0 4px;font-size:12px;color:#b91c1c;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">
              Deadline
            </p>
            <p style="margin:0;font-size:16px;font-weight:600;color:#dc2626;">
              ${deadlineStr}
            </p>
          </div>
        `,
      });

      await sendMail(`[Crack Detection] Deadline sắp đến — ${taskName}`, html);
      return NextResponse.json({ message: "Deadline warning sent" });
    }

    return NextResponse.json(
      { error: "Unknown type", receivedKeys: Object.keys(payload) },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Server error", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}