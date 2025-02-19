import { Env } from '../index';
import { verifyToken } from '../utils/auth';
import { generateMagicLinkEmail, sendEmail } from '../utils/email';

export const handleAlbums = {
  async list(request: Request, env: Env) {
    // Get user from auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const { userId } = await verifyToken(token);

      // Get albums owned by user and shared with user
      const albums = await env.DB.prepare(`
        SELECT DISTINCT a.*, u.email as owner_email 
        FROM albums a
        JOIN users u ON a.owner_id = u.id
        LEFT JOIN album_access aa ON a.id = aa.album_id
        WHERE a.owner_id = ? OR aa.user_id = ?
      `).bind(userId, userId).all();

      return new Response(JSON.stringify(albums.results), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      throw error;
    }
  },

  async create(request: Request, env: Env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const { userId } = await verifyToken(token);
      const { title, expirationDate } = await request.json();

      if (!title) {
        return new Response(JSON.stringify({ error: 'Title is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const albumId = crypto.randomUUID();
      
      await env.DB.prepare(`
        INSERT INTO albums (id, owner_id, title, expiration_date)
        VALUES (?, ?, ?, ?)
      `).bind(albumId, userId, title, expirationDate || null).run();

      return new Response(JSON.stringify({ id: albumId, title, owner_id: userId }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      throw error;
    }
  },

  async get(request: Request, env: Env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const { userId } = await verifyToken(token);
      const url = new URL(request.url);
      const id = url.pathname.split('/').pop();

      const album = await env.DB.prepare(`
        SELECT a.*, u.email as owner_email
        FROM albums a
        JOIN users u ON a.owner_id = u.id
        LEFT JOIN album_access aa ON a.id = aa.album_id
        WHERE a.id = ? AND (a.owner_id = ? OR aa.user_id = ?)
      `).bind(id, userId, userId).first();

      if (!album) {
        return new Response(JSON.stringify({ error: 'Album not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(album), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      throw error;
    }
  },

  async delete(request: Request, env: Env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const { userId } = await verifyToken(token);
      const url = new URL(request.url);
      const id = url.pathname.split('/').pop();

      // Verify ownership
      const album = await env.DB.prepare(
        'SELECT * FROM albums WHERE id = ? AND owner_id = ?'
      ).bind(id, userId).first();

      if (!album) {
        return new Response(JSON.stringify({ error: 'Album not found or unauthorized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Delete photos from R2
      const photos = await env.DB.prepare(
        'SELECT r2_key FROM photos WHERE album_id = ?'
      ).bind(id).all();

      for (const photo of photos.results) {
        await env.PHOTOS.delete(photo.r2_key as string);
      }

      // Delete album and related records
      await env.DB.prepare('DELETE FROM photos WHERE album_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM album_access WHERE album_id = ?').bind(id).run();
      await env.DB.prepare('DELETE FROM albums WHERE id = ?').bind(id).run();

      return new Response(null, { status: 204 });
    } catch (error) {
      throw error;
    }
  },

  async share(request: Request, env: Env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const { userId } = await verifyToken(token);
      const url = new URL(request.url);
      const id = url.pathname.split('/').pop();
      const { email, expirationDate } = await request.json();

      // Verify ownership
      const album = await env.DB.prepare(
        'SELECT * FROM albums WHERE id = ? AND owner_id = ?'
      ).bind(id, userId).first();

      if (!album) {
        return new Response(JSON.stringify({ error: 'Album not found or unauthorized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Find or create user
      let sharedUser = await env.DB.prepare(
        'SELECT * FROM users WHERE email = ?'
      ).bind(email).first();

      if (!sharedUser) {
        const sharedUserId = crypto.randomUUID();
        await env.DB.prepare(
          'INSERT INTO users (id, email) VALUES (?, ?)'
        ).bind(sharedUserId, email).run();
        sharedUser = { id: sharedUserId, email };
      }

      // Create or update access
      const accessToken = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT OR REPLACE INTO album_access (album_id, user_id, access_token, expiration_date)
        VALUES (?, ?, ?, ?)
      `).bind(id, sharedUser.id, accessToken, expirationDate || null).run();

      const emailTemplate = generateMagicLinkEmail(email, accessToken, album.title as string);
      await sendEmail(env, emailTemplate);


      return new Response(JSON.stringify({ message: 'Album shared successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      throw error;
    }
  },
}; 