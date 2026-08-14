import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const repoName = payload.repository?.name || 'GitHub Repo';
    const pusherName = payload.pusher?.name || 'Ai đó';
    const commits = payload.commits || [];
    let commitMessages = commits.map((c: any) => c.message).join('<br> - ');

    const { data, error } = await resend.emails.send({
      from: 'Thesis Tracker <onboarding@resend.dev>', 
      to: ['ngokimthanh1455@gmail.com'], // Vẫn chỉ để 1 mail để không bị lỗi 500
      subject: `[Khóa luận] Cập nhật mới trên ${repoName}`,
      html: `
        <h2>${pusherName} vừa đẩy code mới lên GitHub!</h2>
        <p><strong>Nội dung các thay đổi:</strong></p>
        <p>- ${commitMessages}</p>
        <br/>
        <p>Hãy vào Web Tiến Độ để cập nhật trạng thái công việc nhé!</p>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ message: 'Đã nhận Webhook và gửi mail thành công!' });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xử lý Webhook' }, { status: 500 });
  }
}