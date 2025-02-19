import { Env } from '../index';

interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function generateMagicLinkEmail(
  email: string, 
  token: string, 
  albumTitle?: string
): EmailTemplate {
  const baseUrl = 'https://your-app-domain.com'; // Replace with your domain
  const magicLink = `${baseUrl}/auth/verify?token=${token}`;
  
  const subject = albumTitle 
    ? `Access to photo album: ${albumTitle}`
    : 'Access your photo sharing account';

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${subject}</h2>
      <p>Hello,</p>
      ${albumTitle 
        ? `<p>You've been invited to view the photo album "${albumTitle}".</p>`
        : '<p>Click the link below to access your photo sharing account.</p>'
      }
      <p>
        <a href="${magicLink}" 
           style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">
          ${albumTitle ? 'View Album' : 'Access Account'}
        </a>
      </p>
      <p style="color: #666; font-size: 0.9em;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        ${magicLink}
      </p>
      <p style="color: #666; font-size: 0.8em;">
        This link will expire in 24 hours.
      </p>
    </div>
  `;

  const text = `
${subject}

Hello,

${albumTitle 
  ? `You've been invited to view the photo album "${albumTitle}".`
  : 'Click the link below to access your photo sharing account.'
}

Access link: ${magicLink}

This link will expire in 24 hours.
  `;

  return {
    to: email,
    subject,
    html,
    text,
  };
}

export async function sendEmail(env: Env, template: EmailTemplate) {
  try {
    await env.SEND_EMAIL.send({
      from: env.SENDER_EMAIL,
      to: template.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
} 