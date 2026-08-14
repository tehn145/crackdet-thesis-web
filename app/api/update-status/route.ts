import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { taskName, newStatus, user } = await request.json();

    const { data, error } = await resend.emails.send({
      from: 'Thesis Tracker <onboarding@resend.dev>',
      // Đã thêm email thứ hai vào danh sách nhận
      to: ['ngokimthanh1455@gmail.com', 'trancongthanh040205@gmail.com'], 
      subject: `[Tiến độ] ${taskName} -> ${newStatus}`,
      html: `
        <h2>Cập nhật tiến độ khóa luận!</h2>
        <p>Thành viên <strong>${user}</strong> vừa chuyển công việc <strong>"${taskName}"</strong> sang trạng thái: <span style="color: blue;">${newStatus}</span>.</p>
        <p>Vào web kiểm tra ngay nhé!</p>
      `,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ message: 'Đã cập nhật và gửi mail!' });
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi server' }, { status: 500 });
  }
}