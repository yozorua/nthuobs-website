# NTHU Observatory Website

Official website for the National Tsing Hua University Observatory (國立清華大學天文台).

**Stack:** Next.js 14 (App Router) · TypeScript · PostgreSQL · Prisma · NextAuth.js v5 · Tailwind CSS

---

## Prerequisites

- Node.js 18+ (installed via nvm — see below)
- PostgreSQL 14+

---

## Setup

### 1. Activate Node.js

If using nvm (already installed on this server):

```bash
source "$HOME/.nvm/nvm.sh"
node -v  # should print v20.x.x
```

Add to your shell profile (`~/.bashrc` or `~/.zshrc`) for persistence:

```bash
echo 'source "$HOME/.nvm/nvm.sh"' >> ~/.bashrc
```

---

### 2. Install dependencies

```bash
cd /home/nthuobs/nthuobs-website
npm install
```

---

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in all four values:

```env
DATABASE_URL="postgresql://nthuobs:your_password@localhost:5432/nthuobs"
AUTH_SECRET="<output of: openssl rand -base64 32>"
AUTH_URL="http://localhost:3001"
AUTH_GOOGLE_ID="<your Google OAuth client ID>"
AUTH_GOOGLE_SECRET="<your Google OAuth client secret>"
```

#### Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

---

### 4. Set up PostgreSQL

Install (if not already installed):

```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

Create database and user:

```bash
sudo -u postgres psql
```

Inside the psql shell:

```sql
CREATE USER nthuobs WITH PASSWORD 'your_password';
CREATE DATABASE nthuobs OWNER nthuobs;
\q
```

---

### 5. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or select existing)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add to **Authorized JavaScript origins:**
   - `http://localhost:3001`
7. Add to **Authorized redirect URIs:**
   - `http://localhost:3001/api/auth/callback/google`
8. Copy the **Client ID** and **Client Secret** into `.env`

For production, replace `localhost:3001` with your actual domain.

---

### 6. Push database schema

```bash
npm run db:push
```

To view/edit data in a GUI:

```bash
npm run db:studio
```

---

### 7. Run the development server

```bash
npm run dev
```

The site will be available at **http://localhost:3001**

---

## Build for production

```bash
npm run build
npm run start
```

---

## Project structure

```
src/
├── app/
│   ├── page.tsx              # Home
│   ├── about/page.tsx        # Observatory history & equipment
│   ├── people/page.tsx       # Team members
│   ├── calendar/page.tsx     # Public events calendar
│   ├── visit/page.tsx        # Visit rules & registration
│   ├── dashboard/page.tsx    # Member dashboard (protected)
│   ├── schedule/page.tsx     # Observation schedule (protected)
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── schedule/route.ts
│       └── events/route.ts
├── components/
│   ├── Navbar.tsx
│   └── Footer.tsx
└── lib/
    ├── auth.ts               # NextAuth config
    ├── db.ts                 # Prisma client
    └── utils.ts
```

---

## Useful scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3001 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio (database GUI) |
| `npm run db:generate` | Regenerate Prisma client |

---

## Protected routes

The following routes require Google OAuth login (members only):

- `/dashboard` — Overview and quick links
- `/schedule` — Observation session management

Access control is enforced via `middleware.ts`.

---

## Contact

**Email:** nthuobs@gmail.com
**Location:** Room 801, Physics Building, NTHU, Hsinchu, Taiwan
