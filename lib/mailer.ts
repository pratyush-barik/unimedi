import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendOTP(email: string, otp: string) {
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>UniMedi Verification Code</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 0;">
      <tr>
        <td align="center">
          <table width="100%" max-width="500" style="max-width: 500px; background-color: #ffffff; border-radius: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; overflow: hidden;">
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 32px 24px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">UniMedi</h1>
                <p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 14px;">Unified Smart Healthcare Portal</p>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding: 36px 32px;">
                <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Your Login Verification Code</h2>
                <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 28px 0;">
                  Use the 6-digit one-time password below to authenticate your account. This code is confidential and valid for <strong>5 minutes</strong>.
                </p>
                <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 28px; border: 1px dashed #cbd5e1;">
                  <span style="font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #4338ca;">${otp}</span>
                </div>
                <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
                  If you did not request this OTP, you can safely ignore this email. Do not share this code with anyone.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color: #f8fafc; padding: 18px 32px; text-align: center; border-top: 1px solid #f1f5f9;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} UniMedi Healthcare Systems. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  await transporter.sendMail({
    from: `"UniMedi Health" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `Your UniMedi Verification Code: ${otp}`,
    html: htmlContent,
  });
}