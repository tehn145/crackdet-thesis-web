import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { taskName, newStatus, user } = await request.json();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Thesis Tracker" <${process.env.EMAIL_USER}>`,
      to: ['ngokimthanh1455@gmail.com', 'trancongthanh040205@gmail.com', '23521447@gm.uit.edu.vn'],
      subject: `[Tiến độ] ${taskName} -> ${newStatus}`,
      html: `
        <h2>Cập nhật tiến độ khóa luận!</h2>
        <p>Thành viên <strong>${user}</strong> vừa chuyển công việc <strong>"${taskName}"</strong> sang trạng thái: <span style="color: blue;">${newStatus}</span>.</p>
        <p>Vào web kiểm tra ngay nhé!</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'Đã cập nhật và gửi mail thành công!' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Lỗi server khi gửi mail' }, { status: 500 });
  }
}