import { Router } from 'itty-router';
import { handleAlbums } from './handlers/albums';
import { handlePhotos } from './handlers/photos';
import { handleUsers } from './handlers/users';
import { D1Database, R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  SEND_EMAIL: SendEmail;
  SENDER_EMAIL: string;
  ENVIRONMENT: string;
}

interface SendEmail {
  send(message: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void>;
}

const router = Router();

// User routes
router.post('/api/users/register', handleUsers.register);
router.post('/api/users/login', handleUsers.login);

// Album routes
router.get('/api/albums', handleAlbums.list);
router.post('/api/albums', handleAlbums.create);
router.get('/api/albums/:id', handleAlbums.get);
router.delete('/api/albums/:id', handleAlbums.delete);
router.post('/api/albums/:id/share', handleAlbums.share);

// Photo routes
router.get('/api/albums/:albumId/photos', handlePhotos.list);
router.post('/api/albums/:albumId/photos', handlePhotos.upload);
router.delete('/api/albums/:albumId/photos/:photoId', handlePhotos.delete);

// Handle all requests
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      // Add CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Handle OPTIONS requests
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: corsHeaders,
        });
      }

      // Route the request
      const response = await router.handle(request, env, ctx);
      
      // Add CORS headers to the response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
}; 