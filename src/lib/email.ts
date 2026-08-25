import { Resend } from "resend";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM =
  process.env.EMAIL_FROM ?? "Tab <onboarding@resend.dev>";

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!resend) {
    console.log(
      `[email:dev] to=${message.to} subject=${message.subject}\n${message.text}`,
    );
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
