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

## ☁️ Deployment Guide (Free Tier)

This project is separated into a Frontend and Backend (Monorepo Workspace) and is deployed on two different free platforms to maximize performance.

### 1. Backend (Render.com)
1. Push this repository to your GitHub.
2. Go to [Render.com](https://render.com) and create a new **Web Service**.
3. Connect your GitHub repository.
4. Render will automatically detect the `render.yaml` configuration in `apps/backend-api-gateway` and set up the build commands (`npm install`) and start commands (`npm start`).
5. Ensure you add all your `.env` variables (MongoDB URI, Firebase credentials, Cloudinary, etc.) to the Render dashboard.
6. Set `CORS_ORIGIN` to your future Netlify URL.

**Keeping it awake 24/7:**
To prevent the Render free tier from going to sleep (cold starts):
- Create a free account at [UptimeRobot](https://uptimerobot.com).
- Add a new "HTTP(s)" monitor.
- Enter your Render API URL (e.g., `https://your-backend.onrender.com/api`).
- Set the ping interval to **10 minutes**.

### 2. Frontend (Netlify)
1. Go to [Netlify.com](https://netlify.com) and click **Add New Site** -> **Import an existing project** from GitHub.
2. Select your repository.
3. Configure the build settings:
   - **Base directory:** Leave blank (root)
   - **Build command:** `npm run build:hub`
   - **Publish directory:** `apps/frontend-search-hub/build`
4. Add the following Environment Variable in Netlify:
   - `REACT_APP_BACKEND_URL`: `https://your-backend.onrender.com` *(Your Render URL without the /api)*
5. Click **Deploy**. Note: SPA routing is handled by the `_redirects` file automatically included in the `public` folder.

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
