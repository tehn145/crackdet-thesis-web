import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

/**
 * IMPORTANT: use the SERVICE ROLE key here (server-side only, never expose to
 * the browser) so this route can insert into `tasks` even if Row Level
 * Security only allows the anon key to read. Add SUPABASE_SERVICE_ROLE_KEY
 * to your server env vars (Vercel/host), separate from the anon key used in
 * lib/supabase.ts on the client.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Map a GitHub username/login to one of the two thesis members so the
// auto-created task is assigned to someone real. Fill in the actual GitHub
// logins here.
const GITHUB_TO_ASSIGNEE: Record<string, string> = {
  // 'kim-thanh-github-username': 'Kim Thanh',
  // 'cong-thanh-github-username': 'Cong Thanh',
};

const DEFAULT_ASSIGNEE = 'Kim Thanh';

function resolveAssignee(login?: string): string {
  if (login && GITHUB_TO_ASSIGNEE[login]) return GITHUB_TO_ASSIGNEE[login];
  return DEFAULT_ASSIGNEE;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const repoName = payload.repository?.name || 'GitHub Repo';
    const pusherName = payload.pusher?.name || 'Ai đó';
    const pusherLogin: string | undefined = payload.sender?.login;
    const commits = payload.commits || [];

    if (commits.length === 0) {
      // e.g. a ping event, branch delete, etc. — nothing to import.
      return NextResponse.json({ message: 'Không có commit nào để tạo task.' });
    }

    const assignee = resolveAssignee(pusherLogin);
    const nowIso = new Date().toISOString();

    // Build one task row per commit.
    const newTaskRows = commits.map((c: any) => ({
      date: c.timestamp ? c.timestamp.split('T')[0] : nowIso.split('T')[0],
      name: (c.message?.split('\n')[0] || 'Commit không tiêu đề').slice(0, 200),
      description: `Tự động import từ GitHub commit ${c.id ? c.id.slice(0, 7) : ''} (tác giả: ${
        c.author?.name || pusherName
      })`,
      assignee,
      assigned_by: 'GitHub',
      location: c.url || '',
      status: 'todo',
      source: 'github', // requires a `source` text column on the `tasks` table (default 'web')
      updated_at: nowIso,
    }));

    // 1) Insert directly into Supabase. The web page is subscribed to
    //    realtime changes on `tasks`, so this makes the task appear on the
    //    tracker automatically — no manual "Add Task" click needed.
    const { data: inserted, error } = await supabaseAdmin
      .from('tasks')
      .insert(newTaskRows)
      .select();

    if (error) throw error;

    // 2) Send exactly ONE summary email for this push (not one per commit,
    //    and the web app's realtime listener never sends its own email —
    //    see the comment above the realtime effect in page.tsx — so this is
    //    the only email that goes out for this GitHub push).
    const commitListHtml = commits
      .map((c: any) => `- ${(c.message || '').split('\n')[0]} (${c.author?.name || pusherName})`)
      .join('<br/>');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const taskCount = inserted?.length ?? commits.length;

    await transporter.sendMail({
      from: `"Crack Detection" <${process.env.EMAIL_USER}>`,
      to: ['ngokimthanh1455@gmail.com', 'trancongthanh040205@gmail.com'],
      subject: `[Tiến độ Github] ${taskCount} task mới được tự động tạo từ ${repoName}`,
      html: `
        <h2>${pusherName} vừa đẩy code mới lên GitHub!</h2>
        <p>Hệ thống đã <strong>tự động tạo ${taskCount} task mới trên Web Tiến Độ</strong> (trạng thái "Not Started", assignee: ${assignee}) từ các commit sau:</p>
        <p>${commitListHtml}</p>
        <br/>
        <p>Vào Web Tiến Độ để xem chi tiết và cập nhật trạng thái nhé!</p>
      `,
    });

    return NextResponse.json({
      message: `Đã tự động tạo ${taskCount} task trên web và gửi mail (1 lần) thành công!`,
    });
  } catch (error) {
    console.error('Lỗi Webhook:', error);
    return NextResponse.json({ error: 'Lỗi xử lý Webhook' }, { status: 500 });
  }
}