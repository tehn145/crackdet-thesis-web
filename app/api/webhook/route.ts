import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Khởi tạo Resend (API Key sẽ được cấu hình trên Vercel sau)
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    // Nhận cục dữ liệu từ GitHub gửi về
    const payload = await request.json();

    // Lấy thông tin người vừa push code và nội dung code
    const repoName = payload.repository?.name || 'GitHub Repo';
    const pusherName = payload.pusher?.name || 'Ai đó';
    const commits = payload.commits || [];
    let commitMessages = commits.map((c: any) => c.message).join('<br> - ');

    // Gửi email
    const { data, error } = await resend.emails.send({
      from: 'Thesis Tracker <onboarding@resend.dev>', 
      to: ['ngokimthanh1455@gmail.com', '23521463@gm.uit.edu.vn'],
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