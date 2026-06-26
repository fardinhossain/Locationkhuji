# <div align="center">LocationKhuji (লোকেশন খুঁজি)</div>

<div align="center">
  <h3>AI-powered, map-first location discovery for Bangladesh</h3>
  <p>
    <strong>LocationKhuji</strong> helps people find nearby hospitals, pharmacies, restaurants,
    rental flats, and local services when they know what they need but not the exact place name.
  </p>

  <p>
    <a href="https://locationkhuji.vercel.app/" target="_blank"><strong>Live Website</strong></a>
    ·
    <a href="https://drive.google.com/drive/folders/1hj7SDbcYCkZraekOtuhhIyLr23nQg0Nj?usp=sharing" target="_blank"><strong>Project Report</strong></a>
  </p>
</div>

<div align="center">

[![Live Website](https://img.shields.io/badge/Live-locationkhuji.vercel.app-00C9A7?logo=vercel&logoColor=white&style=for-the-badge)](https://locationkhuji.vercel.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black&style=for-the-badge)](#tech-stack)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white&style=for-the-badge)](#tech-stack)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white&style=for-the-badge)](#tech-stack)
[![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socket.io&logoColor=white&style=for-the-badge)](#tech-stack)
[![AI Search](https://img.shields.io/badge/AI-Groq%20%2B%20OpenRouter-FF6B6B?style=for-the-badge)](#ai-search-flow)

</div>

---

## Project Overview

LocationKhuji is a full-stack location discovery platform built for Bangladesh. It combines natural language AI search, Bangladesh-only geospatial logic, interactive maps, account-based access control, and owner/admin listing management.

The core idea is simple: people often need something nearby, but they do not always know the exact name of the place.

Example searches:

```text
pharmacy near Mirpur 10
2 bedroom flat in Dhanmondi under 20000
hospital near me
electrician nearby
মিরপুর ১০ এ ফার্মেসি
```

LocationKhuji detects the user's intent, category, location, radius, and filters, then focuses the map around the most relevant Bangladesh location.

---

## Key Features

- AI-powered natural language search for English, Bangla, and Banglish queries.
- Standard search with address suggestions, category filters, and radius control.
- Interactive Leaflet map with markers, clustering, selected radius, and location focus.
- Bangladesh-only geospatial enforcement using local administrative datasets.
- Guest browsing for the map, listing lists, and listing detail pages.
- Login-gated contact information, saved listings, reports, reviews, and ratings.
- User, Owner, and Admin role-based access control.
- Owner dashboard for creating, editing, and removing listings.
- Admin dashboard for user management, listing management, and platform stats.
- Email verification using 6-digit codes.
- Forgot-password flow using 6-digit reset codes.
- Google sign-in and Google registration support through Firebase Auth.
- Cloudinary image uploads with file records and secure image serving.
- Real-time map updates through Socket.io when new listings are added or seeded.
- OSM Overpass fallback seeding when local results need fresh nearby data.
- Fully responsive desktop and mobile map/search experience.

---

## Screenshots

<div align="center">
  <table>
    <tr>
      <td width="50%">
        <p align="center"><strong>Hero & Map-First Experience</strong></p>
        <img src="./screenshots/homepage.png" alt="LocationKhuji homepage and map" width="100%" />
      </td>
      <td width="50%">
        <p align="center"><strong>AI Search</strong></p>
        <img src="./screenshots/ai_search.png" alt="AI search result view" width="100%" />
      </td>
    </tr>
    <tr>
      <td width="50%">
        <p align="center"><strong>Listings Directory</strong></p>
        <img src="./screenshots/listings.png" alt="Listings directory with filters" width="100%" />
      </td>
      <td width="50%">
        <p align="center"><strong>Mobile Responsive UI</strong></p>
        <img src="./screenshots/mobile_ui.png" alt="Mobile responsive LocationKhuji interface" width="100%" />
      </td>
    </tr>
  </table>
</div>

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| Frontend | React 19, CRACO, React Router 7, Zustand, Tailwind CSS, Framer Motion, React Query |
| Maps | Leaflet, React Leaflet, React Leaflet Cluster, OSM tiles, Nominatim |
| UI | Radix UI primitives, Lucide React, React Icons, Sonner, custom responsive components |
| Backend | Node.js, Express.js, Mongoose, MongoDB Atlas, Socket.io |
| Auth | Firebase Auth, Firebase Admin SDK, Google sign-in, HTTP-only auth cookies |
| AI & Search | Groq Llama 3, OpenRouter DeepSeek V3, local regex fallback, OSM Overpass |
| Storage | Cloudinary, Multer memory uploads |
| Infrastructure | Vercel, Render, GitHub Actions, MongoDB Atlas |

---

## AI Search Flow

```text
User query
  |
  v
Normalize English/Bangla/Banglish text
  |
  v
Resolve Bangladesh location from local datasets and geocoding
  |
  v
Parse intent with Groq
  |
  +--> fallback to OpenRouter DeepSeek V3
  |
  +--> fallback to local regex parser
  |
  v
Build MongoDB geospatial query
  |
  v
Apply category, radius, keyword, price, bedroom, and emergency filters
  |
  v
Return listings and map focus data
  |
  v
Fetch/seed fresh OSM Overpass data in the background
  |
  v
Broadcast new listings through Socket.io
```

The AI search endpoint returns structured data such as category, keywords, price range, bedrooms, emergency intent, detected location, search center, and radius.

---

## Bangladesh Location Intelligence

LocationKhuji uses a shared Bangladesh location engine in [`packages/shared-config`](./packages/shared-config) to keep map behavior consistent across frontend and backend.

It supports:

- Division, district, upazila, and thana datasets.
- English and Bangla location aliases.
- Bengali numeral normalization.
- Common Bangladesh-area matching such as Dhaka, Mirpur, Dhanmondi, Uttara, Gulshan, Sylhet, Chittagong, and more.
- Bangladesh coordinate bounds to prevent out-of-country listing placement.
- Dynamic radius behavior for divisions, districts, thanas, and neighborhood-level searches.

---

## User Roles

| Role | Capabilities |
| :--- | :--- |
| Guest | Browse map, search listings, view listing details with protected contact fields hidden |
| User | Save listings, review places, report listings, view dashboard |
| Owner | Add listings, edit own listings, remove own listings, upload listing images, use owner dashboard |
| Admin | Manage users, manage listings, feature listings, remove listings, view platform stats |

---

## API Summary

| Area | Endpoints |
| :--- | :--- |
| Health | `GET /api/`, `GET /api/health` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/google`, `POST /api/auth/logout`, `POST /api/auth/refresh`, `GET /api/auth/me` |
| Verification | `POST /api/auth/verify-email-code`, `POST /api/auth/resend-verification`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` |
| Listings | `GET /api/listings/search`, `GET /api/listings/nearby`, `POST /api/listings/ai-search`, `GET /api/listings/:lid` |
| Owner Listings | `POST /api/listings`, `GET /api/listings/my`, `PUT /api/listings/:lid`, `DELETE /api/listings/:lid` |
| Engagement | `POST /api/listings/:lid/save`, `GET /api/users/me/saved`, `POST /api/listings/:lid/report`, `GET/POST /api/listings/:lid/reviews`, `DELETE /api/reviews/:rid` |
| Files | `POST /api/uploads`, `GET /api/files/:fid` |
| Admin | `GET /api/admin/stats`, `GET /api/admin/users`, `PUT /api/admin/users/:uid`, `GET /api/admin/listings`, `PUT /api/admin/listings/:lid/feature` |

---

## Monorepo Structure

```text
LocationKhuji/
├── apps/
│   ├── backend-api-gateway/
│   │   ├── src/server.js              # Express API, auth, listings, AI search, uploads
│   │   ├── src/locationResolver.js    # Location resolution helpers
│   │   ├── src/seed_osm.js            # OSM seeding script
│   │   ├── src/seed_osm_full.js       # Larger OSM seeding script
│   │   └── render.yaml                # Render deployment config
│   └── frontend-search-hub/
│       ├── src/App.js                 # React routes
│       ├── src/pages/MapPage.jsx      # Standard/AI map search experience
│       ├── src/pages/AuthPages.jsx    # Register, login, Google auth, password reset
│       ├── src/pages/DashboardPages.jsx
│       ├── src/components/MapView.jsx
│       ├── src/components/ListingCard.jsx
│       ├── src/store/index.js         # Zustand stores
│       └── src/locales/               # English and Bangla translations
├── packages/
│   └── shared-config/
│       ├── bd-location-engine.js      # Bangladesh location intelligence
│       └── data/                      # divisions, districts, upazilas
├── screenshots/
├── scripts/
│   ├── locationkhuji_showcase.mp4
│   └── locationkhuji_showcase.srt
└── package.json                       # npm workspaces
```

---

## Local Development

### Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas or a local MongoDB instance
- Firebase project with Email/Password and Google auth enabled
- Optional: Cloudinary account for uploads
- Optional: Groq and OpenRouter API keys for AI search
- Optional: Resend API key for email delivery

### Install

```bash
npm install
```

### Backend Environment

Create `apps/backend-api-gateway/.env`:

```env
PORT=8001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

MONGO_URL=your_mongodb_connection_string
DB_NAME=locationkhuji

FIREBASE_WEB_API_KEY=your_firebase_web_api_key
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_me
ADMIN_NAME=LocationKhuji Admin

GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

RESEND_API_KEY=your_resend_api_key
LOCATION_DEBUG=false
```

### Frontend Environment

Create `apps/frontend-search-hub/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001

REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Run

Start the backend:

```bash
npm run dev:api
```

Start the frontend:

```bash
npm run dev:hub
```

The frontend runs on `http://localhost:3000` and the backend runs on `http://localhost:8001`.

---

## Useful Scripts

```bash
npm run dev:hub          # start React app
npm run dev:api          # start Express API with nodemon
npm run build:hub        # build frontend
npm run build:all        # build workspaces
npm run test:all         # run workspace tests if present
npm run make-admin --workspace=apps/backend-api-gateway -- admin@example.com
npm run seed --workspace=apps/backend-api-gateway
npm run seed:full --workspace=apps/backend-api-gateway
```

---

## Development Notes

- Contact details are hidden from guests on listing detail responses.
- Listing removal is implemented as soft deactivation through `is_active: false`.
- Reviews are restricted so owners cannot review their own listings and users cannot review the same listing twice.
- Image uploads accept common image formats and are limited to 5 MB per file.
- The map listens for `new_listing` Socket.io events and updates active results when the listing matches the current category and radius.
- In development mode, verification/reset codes may be returned or printed to the server console for easier testing.

---

## What I Learned

This project improved my practical experience with full-stack architecture, monorepo organization, AI integration, geospatial search, authentication, role-based access control, real-time updates, and deployment.

The hardest part was keeping AI search, location detection, MongoDB geospatial queries, frontend state, and map focusing synchronized. Small changes in one layer often affected the whole search experience.

Spec-driven development and the Six-File Methodology helped make the project easier to reason about by separating planning, architecture, state, backend logic, UI behavior, and testing.

---

## Roadmap

- Conversational AI map assistant.
- Better owner analytics for listing views and search performance.
- Push notifications for nearby saved searches or emergency services.
- More structured moderation workflow for reports.
- Native mobile app exploration with React Native.

---

## Project Links

- Live Website: https://locationkhuji.vercel.app/
- Full Project Report: https://drive.google.com/drive/folders/1hj7SDbcYCkZraekOtuhhIyLr23nQg0Nj?usp=sharing

---

## Author

Developed by **Fardin Hossain**.

- GitHub: [@fardinhossain](https://github.com/fardinhossain)
- LinkedIn: [Fardin Hossain](https://linkedin.com/in/fardinhossain)
- Email: fardin.hosn@gmail.com
