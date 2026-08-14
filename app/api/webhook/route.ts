import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const repoName = payload.repository?.name || 'GitHub Repo';
    const pusherName = payload.pusher?.name || 'Ai đó';
    const commits = payload.commits || [];
    let commitMessages = commits.map((c: any) => c.message).join('<br> - ');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Thesis Tracker" <${process.env.EMAIL_USER}>`,
      to: ['ngokimthanh1455@gmail.com', 'trancongthanh040205@gmail.com'],
      subject: `[Khóa luận] Cập nhật mới trên ${repoName}`,
      html: `
        <h2>${pusherName} vừa đẩy code mới lên GitHub!</h2>
        <p><strong>Nội dung các thay đổi:</strong></p>
        <p>- ${commitMessages}</p>
        <br/>
        <p>Hãy vào Web Tiến Độ để cập nhật trạng thái công việc nhé!</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'Đã nhận Webhook và gửi mail thành công!' });
  } catch (error) {
    console.error("Lỗi Webhook:", error);
    return NextResponse.json({ error: 'Lỗi xử lý Webhook' }, { status: 500 });
  }
}