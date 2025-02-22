import { Env } from '../index';
import { verifyToken } from '../utils/auth';

export const handlePhotos = {
  async list(request: Request, env: Env) {
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
      const albumId = url.pathname.split('/').pop();

      // Verify access
      const hasAccess = await env.DB.prepare(`
        SELECT 1 FROM albums a
        LEFT JOIN album_access aa ON a.id = aa.album_id
        WHERE a.id = ? AND (a.owner_id = ? OR aa.user_id = ?)
      `).bind(albumId, userId, userId).first();

      if (!hasAccess) {
        return new Response(JSON.stringify({ error: 'Album not found or unauthorized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const photos = await env.DB.prepare(
        'SELECT * FROM photos WHERE album_id = ? ORDER BY uploaded_at DESC'
      ).bind(albumId).all();

      interface Photo {
        id: string;
        album_id: string;
        filename: string;
        r2_key: string;
        uploaded_at: string;
      }

      // Generate signed URLs for each photo
      const photosWithUrls = await Promise.all((photos.results as Photo[]).map(async (photo) => {
        const url = await env.PHOTOS.get(photo.r2_key).then(obj => obj.url);
        return { ...photo, url };
      }));

      return new Response(JSON.stringify(photosWithUrls), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      throw error;
    }
  },

  async upload(request: Request, env: Env) {
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
      const { albumId } = request.params;

      // Verify ownership
      const album = await env.DB.prepare(
        'SELECT * FROM albums WHERE id = ? AND owner_id = ?'
      ).bind(albumId, userId).first();

      if (!album) {
        return new Response(JSON.stringify({ error: 'Album not found or unauthorized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const formData = await request.formData();
      const file = formData.get('photo') as File;
      
      if (!file) {
        return new Response(JSON.stringify({ error: 'No photo provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const photoId = crypto.randomUUID();
      const r2Key = `${albumId}/${photoId}-${file.name}`;

      // Upload to R2
      await env.PHOTOS.put(r2Key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });

      // Save to database
      await env.DB.prepare(`
        INSERT INTO photos (id, album_id, filename, r2_key)
        VALUES (?, ?, ?, ?)
      `).bind(photoId, albumId, file.name, r2Key).run();

      return new Response(JSON.stringify({ 
        id: photoId,
        filename: file.name,
        r2_key: r2Key
      }), {
        status: 201,
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
      const { albumId, photoId } = request.params;

      // Verify ownership
      const album = await env.DB.prepare(
        'SELECT * FROM albums WHERE id = ? AND owner_id = ?'
      ).bind(albumId, userId).first();

      if (!album) {
        return new Response(JSON.stringify({ error: 'Album not found or unauthorized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get photo details
      const photo = await env.DB.prepare(
        'SELECT * FROM photos WHERE id = ? AND album_id = ?'
      ).bind(photoId, albumId).first();

      if (!photo) {
        return new Response(JSON.stringify({ error: 'Photo not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Delete from R2
      await env.PHOTOS.delete(photo.r2_key);

      // Delete from database
      await env.DB.prepare(
        'DELETE FROM photos WHERE id = ?'
      ).bind(photoId).run();

      return new Response(null, { status: 204 });
    } catch (error) {
      throw error;
    }
  },
}; 