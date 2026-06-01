# LocationKhuji (লোকেশন খুঁজি)

LocationKhuji is a premium, Bangladesh-centric location discovery platform focusing on map-first experiences for finding flats, pharmacies, hospitals, and fashion shopping centers.

> **🔗 Live Links:**
> - **Frontend Web App:** [https://YOUR-SITE-NAME.netlify.app](https://YOUR-SITE-NAME.netlify.app) *(Replace with your deployed Netlify URL)*
> - **Backend API:** [https://YOUR-SERVICE.onrender.com/api](https://YOUR-SERVICE.onrender.com/api) *(Replace with your deployed Render URL)*

## 🚀 Key Features
- **Map-First Discovery:** Interactive map view for all categories.
- **Bangladesh-Focused:** Strictly restricted to Bangladesh locations for high accuracy.
- **Premium UI/UX:** Modern, dark-themed design with glowing map visualizations and smooth animations.
- **Real-Time Listings:** Listings appear instantly on the map upon creation (via Socket.io).
- **Multi-Language Support:** Full support for English and Bengali.

## 🛠 Tech Stack
- **Frontend:** React 19, Tailwind CSS, Framer Motion, Zustand, React-Leaflet.
- **Backend:** Node.js, Express, MongoDB (Mongoose), Firebase Auth.

## 🚀 Production Deployment Guide (Best Approach)

Because LocationKhuji is an enterprise-grade monorepo featuring **Socket.io (WebSockets)**, AI proxying, and intensive mapping, deploying it requires platforms that support stable WebSocket connections and monorepo structures. 

Here are the recommended, battle-tested approaches for deploying this stack:

### Option 1: Managed Cloud (Vercel + Railway) - *Recommended for ease*

**1. Frontend (Vercel)**
Vercel is the industry standard for React apps and natively supports npm workspaces out of the box.
1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Import the project. Vercel will automatically detect the monorepo.
3. Configure the project:
   - **Framework Preset:** Create React App
   - **Root Directory:** `apps/frontend-search-hub`
   - **Build Command:** `npm run build` (Vercel handles the workspace context)
   - **Install Command:** `npm install`
4. **Environment Variables:** Add `REACT_APP_BACKEND_URL` pointing to your backend production URL.
5. Vercel handles the SPA routing (`_redirects` not required) and provides global Edge CDN caching automatically.

**2. Backend (Railway.app or Render.com)**
Railway provides excellent, native support for WebSockets (`Socket.io`) without the harsh connection dropping seen on some serverless platforms.
1. Connect your repository to [Railway](https://railway.app).
2. Create a new service from your GitHub repo.
3. Configure the Root Directory to `apps/backend-api-gateway`.
4. Add your **Environment Variables** (see checklist below).
5. Add a custom domain. Railway handles SSL automatically.
*Note: If using Render.com instead, simply use the `render.yaml` blueprint provided in the backend folder.*

---

### Option 2: Self-Hosted VPS (DigitalOcean / AWS EC2 / Hetzner) - *Best for Cost & Scale*

For maximum control, cost-efficiency, and zero WebSocket timeouts, deploying to a Linux VPS using **PM2** and **Nginx** is the professional standard.

**1. Server Preparation**
```bash
# Update server and install dependencies
sudo apt update && sudo apt install -y nodejs npm nginx git
sudo npm install -g pm2
```

**2. Clone & Build**
```bash
git clone https://github.com/your-username/LocationKhuji.git
cd LocationKhuji
npm install

# Build the frontend workspace
npm run build:hub
```

**3. Configure Backend with PM2**
Create an `.env` file in `apps/backend-api-gateway`, then start the API via PM2:
```bash
cd apps/backend-api-gateway
pm2 start src/server.js --name "locationkhuji-api"
pm2 save
pm2 startup
```

**4. Nginx Reverse Proxy & Static Hosting**
Configure Nginx (`/etc/nginx/sites-available/locationkhuji`) to serve the compiled frontend React app and proxy the `/api` and `/socket.io` requests to the local Node.js process:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve Frontend (React SPA)
    root /var/www/LocationKhuji/apps/frontend-search-hub/build;
    index index.html;
    location / {
        try_files $uri /index.html;
    }

    # Proxy Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Proxy Socket.io (WebSocket support)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```
*Run `sudo certbot --nginx` to automatically secure your deployment with free Let's Encrypt SSL.*

---

### 🔑 Essential Production Environment Checklist

Before taking the app live, ensure these keys are secured in your production environment (`.env`):

**Backend Secrets:**
- `PORT` (usually 5000)
- `MONGODB_URI` (Production MongoDB Atlas cluster)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (Auth)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (Media)
- `GROQ_API_KEY` or `OPENROUTER_API_KEY` (AI Intent Parsing)
- `CORS_ORIGIN` (Your exact frontend URL, e.g., `https://locationkhuji.com`)

**Frontend Secrets:**
- `REACT_APP_BACKEND_URL` (Your exact backend URL, e.g., `https://api.locationkhuji.com`)
- `REACT_APP_FIREBASE_API_KEY`, `REACT_APP_FIREBASE_AUTH_DOMAIN` (Client Firebase Auth)

---

## 💻 Local Development Setup

This project uses npm workspaces. You should run all commands from the **root** folder.

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas (or local MongoDB)

### Installation
1. Install dependencies for both frontend and backend from the root:
   ```bash
   npm install
   ```

2. Configure environment variables:
   - Copy `.env.example` in the `apps/backend-api-gateway` to `.env` and fill in your secrets.
   - For the frontend, create a `.env` in `apps/frontend-search-hub` and set `REACT_APP_BACKEND_URL=http://localhost:5000`

3. Start the development servers concurrently:
   - Start Backend: `npm run dev:api`
   - Start Frontend: `npm run dev:hub`

---
Developed by @Fardin_NovoSoft.AI
