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

// ========== Helpers ==========

function escapeHtml(str: string) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEstimated(days: number | null | undefined): string {
  if (days == null || Number.isNaN(Number(days))) return "—";
  const d = Number(days);
  const whole = Math.floor(d);
  const hours = Math.round((d % 1) * 24);
  const parts: string[] = [];
  if (whole > 0) parts.push(`${whole}d`);
  if (hours > 0) parts.push(`${hours}h`);
  return parts.length ? parts.join(" ") : "—";
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

/** Shared task-detail card — same fields as on the web details modal */
function buildTaskDetailsCard(task: {
  taskName?: string;
  description?: string;
  date?: string;
  location?: string;
  status?: string;
  assignee?: string;
  assignedBy?: string;
  estimatedDays?: number | null;
  deadline?: string | null;
  updatedAt?: string;
  newStatus?: string;
}) {
  const name = escapeHtml(task.taskName || "Untitled task");
  const description = task.description?.trim()
    ? escapeHtml(task.description).replace(/\n/g, "<br/>")
    : null;
  const date = escapeHtml(task.date || "—");
  const status = escapeHtml(task.newStatus || task.status || "—");
  const assignee = escapeHtml(task.assignee || "—");
  const assignedBy = escapeHtml(task.assignedBy || "—");
  const estimated = formatEstimated(task.estimatedDays ?? null);
  const deadline = task.deadline ? formatDateTime(task.deadline) : "—";
  const location = task.location?.trim() || "";
  const locationHtml = location
    ? /^https?:\/\//i.test(location)
      ? `<a href="${escapeHtml(location)}" style="color:#D96B1F;text-decoration:underline;word-break:break-all;">${escapeHtml(location)}</a>`
      : escapeHtml(location)
    : "—";
  const updatedAt = task.updatedAt ? formatDateTime(task.updatedAt) : null;

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;width:34%;vertical-align:top;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">${label}</p>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
        <p style="margin:0;font-size:14px;color:#0f172a;line-height:1.45;">${value}</p>
      </td>
    </tr>`;

  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-top:8px;">
      <div style="padding:16px 18px;background:#fff;border-bottom:1px solid #e2e8f0;">
        <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Task</p>
        <p style="margin:0;font-size:17px;font-weight:700;color:#0f172a;line-height:1.35;">${name}</p>
      </div>
      ${
        description
          ? `<div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;background:#fff;">
              <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;">Description</p>
              <p style="margin:0;font-size:14px;color:#334155;line-height:1.55;">${description}</p>
            </div>`
          : ""
      }
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;">
        ${row("Status", status)}
        ${row("Assignee", assignee)}
        ${row("Assigned by", assignedBy)}
        ${row("Date", date)}
        ${row("Estimated", estimated)}
        ${row("Deadline", deadline)}
        ${row("Location / Link", locationHtml)}
        ${updatedAt ? row("Last updated", updatedAt) : ""}
      </table>
    </div>
  `;
}

// ========== Email Template ==========
function buildEmailHtml(options: {
  title: string;
  badge?: string;
  badgeColor?: string;
  intro?: string;
  content: string;
}) {
  const { title, badge, content, intro } = options;

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
              ${
                intro
                  ? `<p style="margin:0 0 18px;font-size:15px;color:#334155;line-height:1.6;">${intro}</p>`
                  : ""
              }
              ${content}
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${WEB_URL}" 
                       style="display:inline-block;padding:12px 28px;background:#D96B1F;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px;">
                      Open Thesis Tracker →
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
          assignee: githubUser,
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

      const commitCards = commits
        .map((c: any) => {
          const githubUser = getGithubUsername(c);
          return buildTaskDetailsCard({
            taskName: (c.message?.split("\n")[0] || "GitHub commit").slice(0, 120),
            description: c.message || "",
            date: new Date().toISOString().split("T")[0],
            location: c.url || payload.repository?.html_url || "",
            status: "Completed",
            assignee: githubUser,
            assignedBy: "GitHub",
            updatedAt: new Date().toISOString(),
          });
        })
        .join('<div style="height:12px;"></div>');

      const html = buildEmailHtml({
        title: "New GitHub Push",
        badge: "GitHub",
        intro: `<strong>${escapeHtml(pusherName)}</strong> vừa push code mới lên repository <strong>${escapeHtml(repoName)}</strong> (branch: <code>${escapeHtml(branch)}</code>). Các task bên dưới đã được tự động thêm vào tracker với trạng thái <strong>Completed</strong>.`,
        content:
          commitCards ||
          `<p style="font-size:13px;color:#94a3b8;">Không có commit message</p>`,
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
      console.log("Status email payload:", JSON.stringify(payload, null, 2));

      const cardStatus =
        newStatus === "Added" || newStatus === "Edited" || newStatus === "Deleted"
          ? payload.status || newStatus
          : newStatus || payload.status;

      const html = buildEmailHtml({
        title: "Task Status Updated",
        badge: newStatus,
        intro: `Thành viên <strong>${escapeHtml(user)}</strong> vừa cập nhật trạng thái công việc thành <strong>${escapeHtml(newStatus)}</strong>.`,
        content: buildTaskDetailsCard({
          taskName: taskName || payload.taskName,
          description: payload.description,
          date: payload.date,
          location: payload.location,
          status: cardStatus,
          newStatus,
          assignee: payload.assignee || user,
          assignedBy: payload.assignedBy || payload.assigned_by,
          estimatedDays: payload.estimatedDays ?? payload.estimated_days ?? null,
          deadline: payload.deadline ?? null,
          updatedAt: payload.updatedAt || payload.updated_at,
        }),
      });

      await sendMail(`[Crack Detection] ${taskName} → ${newStatus}`, html);
      return NextResponse.json({ message: "Status email sent" });
    }

    // ========== 3. Assignment ==========
    if (payload.type === "assignment") {
      const { taskName, assignedTo, assignedBy } = payload;
      console.log("Assignment email payload:", JSON.stringify(payload, null, 2));

      const html = buildEmailHtml({
        title: "New Task Assigned",
        badge: "Assignment",
        intro: `<strong>${escapeHtml(assignedBy)}</strong> vừa giao task cho <strong>${escapeHtml(assignedTo)}</strong>.`,
        content: buildTaskDetailsCard({
          taskName: taskName || payload.taskName,
          description: payload.description,
          date: payload.date,
          location: payload.location,
          status: payload.status,
          assignee: assignedTo || payload.assignee,
          assignedBy: assignedBy || payload.assignedBy,
          estimatedDays: payload.estimatedDays ?? payload.estimated_days ?? null,
          deadline: payload.deadline ?? null,
          updatedAt: payload.updatedAt || payload.updated_at,
        }),
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
      console.log("Deadline warning payload:", JSON.stringify(payload, null, 2));
      const deadlineStr = deadline
        ? new Date(deadline).toLocaleString("vi-VN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—";

      const html = buildEmailHtml({
        title: "Deadline Warning",
        badge: "Urgent",
        intro: `Task của <strong>${escapeHtml(assignee)}</strong> sắp đến hạn (<strong style="color:#dc2626;">${escapeHtml(deadlineStr)}</strong>). Hãy hoàn thành sớm nhé!`,
        content: buildTaskDetailsCard({
          taskName: taskName || payload.taskName,
          description: payload.description,
          date: payload.date,
          location: payload.location,
          status: payload.status,
          assignee: assignee || payload.assignee,
          assignedBy: payload.assignedBy || payload.assigned_by,
          estimatedDays: payload.estimatedDays ?? payload.estimated_days ?? null,
          deadline: deadline ?? payload.deadline,
          updatedAt: payload.updatedAt || payload.updated_at,
        }),
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