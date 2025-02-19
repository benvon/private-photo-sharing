# private-photo-sharing
App that uses magic links and Cloudflare tools to create a private photo sharing platform

## Architecture

This app will create nice, but not too fancy photo albums for people to share amongst themselves privately. The photo albums will be laid out 3 across and selecting any given image will show a larger version of the photo in a light-box type presentation. Clicking on the enlarged photo will dismiss the lightbox and show the album page again.

A user will be defined as an email address. User identity will be defined only as the user who has access to the email mailbox associated with the email address. Users can be album owners or album viewers.

An album owner user will be able to create an album, post photos to the album, then send email-based invites to users to view the albums. The email-based links will have magic tokens in the URLs that the sender can configure to expire (or not) after a configurable length of time. Albums can optionally be set to expire and be completely removed from the platform after a configurable date, defaulting to one year after creation. 

An album owner user will be able to upload photos to an album using an easy-to-use web interface.

Once an album is created, the user who created the album will be able to add and remove photos from the album. 
The app will be built using:

An album user will also be able to add and remove album viewer user access to an album.

This app will use Cloudflare R2 for static content and and D1 for durable content storage. 


- Frontend:
  - WebAssembly compiled from Go code
  - Simple HTML/CSS for layout and styling
  - JavaScript for DOM manipulation and WebAssembly interaction

- Backend:
  - Cloudflare Workers (JavaScript/TypeScript)
  - Cloudflare R2 for photo storage
  - Cloudflare D1 (SQLite) for metadata and user management

Key components:

1. Go WebAssembly Module:
   - Photo upload handling and optimization
   - Client-side image processing (resizing, thumbnails)
   - Album management interface
   - Lightbox viewer implementation
   - Magic link token validation

2. Cloudflare Worker API:
   - User authentication and session management
   - Album CRUD operations
   - Photo upload/download coordination with R2
   - Email sending for magic links
   - Access control and token validation

3. Database Schema (D1):
   ```sql
   -- Users table
   CREATE TABLE users (
     id TEXT PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- Albums table
   CREATE TABLE albums (
     id TEXT PRIMARY KEY,
     owner_id TEXT NOT NULL,
     title TEXT NOT NULL,
     expiration_date TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (owner_id) REFERENCES users(id)
   );

   -- Photos table
   CREATE TABLE photos (
     id TEXT PRIMARY KEY,
     album_id TEXT NOT NULL,
     filename TEXT NOT NULL,
     r2_key TEXT NOT NULL,
     uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (album_id) REFERENCES albums(id)
   );

   -- Album access table
   CREATE TABLE album_access (
     album_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     access_token TEXT,
     expiration_date TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (album_id, user_id),
     FOREIGN KEY (album_id) REFERENCES albums(id),
     FOREIGN KEY (user_id) REFERENCES users(id)
   );
   ```

The WebAssembly module will be compiled using the standard Go WebAssembly compiler (GOOS=js GOARCH=wasm). The app will use the syscall/js package for JavaScript interop and will implement a custom API for communicating with the Cloudflare Worker backend.

