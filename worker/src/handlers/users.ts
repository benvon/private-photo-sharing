import { Env } from '../index';
import { generateToken } from '../utils/auth';
import { generateMagicLinkEmail, sendEmail } from '../utils/email';

export const handleUsers = {
  async register(request: Request, env: Env) {
    const { email } = await request.json();

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // Generate a unique ID for the user
      const userId = crypto.randomUUID();

      // Insert the user into the database
      await env.DB.prepare(
        'INSERT INTO users (id, email) VALUES (?, ?)'
      ).bind(userId, email).run();

      // Generate an access token
      const token = await generateToken({ userId, email });

      return new Response(JSON.stringify({ token }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return new Response(JSON.stringify({ error: 'Email already registered' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw error;
    }
  },

  async login(request: Request, env: Env) {
    const { email } = await request.json();

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find or create user
    let user = await env.DB.prepare(
      'SELECT id, email FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      const userId = crypto.randomUUID();
      await env.DB.prepare(
        'INSERT INTO users (id, email) VALUES (?, ?)'
      ).bind(userId, email).run();
      user = { id: userId, email };
    }

    // Generate a magic link token
    const token = await generateToken({ userId: user.id, email: user.email });

    // Send magic link email
    const emailTemplate = generateMagicLinkEmail(email, token);
    const emailSent = await sendEmail(env, emailTemplate);

    if (!emailSent) {
      return new Response(JSON.stringify({ error: 'Failed to send magic link email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      message: 'Magic link sent to your email',
      // Include token in development only
      ...(env.ENVIRONMENT === 'development' && { token })
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
}; 