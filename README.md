# Spacyy 📅

**Spacyy** is an intuitive, all-in-one booking platform designed for modern service providers. 
From individual appointments to group sessions, Spacyy provides the tools to manage 
availability and reservations seamlessly across any industry.

### 🚀 Key Features
* **Universal Scheduling:** Flexible enough for any service or session type.
* **Resource Management:** Track and allocate "spaces" or "seats" in real-time.
* **Mobile-First Design:** Optimized for a smooth booking experience on any device.
* **Multi-Tenant Architecture:** Each customer (license holder) has isolated data.
* **Role-Based Access:** Separate interfaces for customers (providers) and clients.

## 🏗️ Project Structure

```
Spacyy/
├── frontend/              # Next.js 14+ PWA Application
│   ├── app/              # Next.js App Router
│   │   ├── api/         # API routes (bookings, clients, spaces, availability)
│   │   ├── (auth)/      # Authentication pages
│   │   ├── dashboard/   # Customer/Provider dashboard
│   │   └── book/        # Client booking interface
│   ├── components/      # Reusable React components
│   ├── lib/             # Utilities, Prisma client, auth config
│   ├── prisma/          # Database schema & migrations
│   └── types/           # TypeScript type definitions
│
└── shared/              # Shared code (for future mobile app)
    ├── types/           # Shared TypeScript types
    ├── lib/             # Business logic (booking, availability)
    └── constants/       # Shared constants
```

## 🛠️ Tech Stack

- **Frontend:** Next.js 14+ (App Router), React, TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL (via Supabase)
- **ORM:** Prisma
- **Authentication:** NextAuth.js
- **Validation:** Zod
- **PWA:** next-pwa
- **Date Handling:** date-fns

## 📋 Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- Git installed

## 🚀 Getting Started

### 1. Clone and Install

```bash
cd frontend
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings → Database
4. Copy the "Connection string" (URI format)

### 3. Configure Environment Variables

Create a `.env` file in the `frontend` directory:

```bash
cp .env.example .env
```

Edit `.env` and add your values:

```env
# Database (from Supabase)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-secret-here"

# Supabase (optional, for future features)
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Email (for invitations - configure later)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="noreply@spacyy.com"
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Set Up Database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Prisma Studio to view data
npm run db:studio
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 PWA Features

The app is configured as a Progressive Web App:
- Installable on mobile devices
- Works offline (with service worker)
- Fast loading and responsive

To test PWA features:
1. Build the app: `npm run build`
2. Serve it: `npm start`
3. Open in Chrome/Edge and use "Install" option

## 🗄️ Database Schema

### Key Models:
- **Organization:** Customer/license holder
- **User:** Can belong to multiple organizations
- **Client:** Belongs to specific organization
- **Space:** Bookable resource (seat, table, mat, etc.)
- **Booking:** Time-slot reservation
- **Invitation:** Email invitations for clients

### Multi-Tenancy:
- All data is isolated by `organizationId`
- Users can belong to multiple organizations
- Clients belong to one organization

## 🔐 Authentication

- **Unified Login:** Same login page for customers and clients
- **Role-Based Routing:** 
  - Owners/Admins → `/dashboard`
  - Clients → `/book`
- **Hybrid Auth:** Email/password with invitation support

## 📡 API Routes

All API routes are in `frontend/app/api/`:

- `GET/POST /api/bookings` - Manage bookings
- `GET /api/availability` - Get available time slots
- `GET/POST /api/clients` - Manage clients
- `GET/POST /api/spaces` - Manage spaces
- `GET/POST /api/auth/[...nextauth]` - Authentication

## 🎨 Components

Reusable components in `frontend/components/ui/`:
- `Button` - Styled button component
- `Input` - Form input component
- `Card` - Card container component

All components use Tailwind CSS and are mobile-responsive.

## 🚧 Next Steps

1. **Create First Organization:**
   - You'll need to manually create an organization in the database or via Prisma Studio
   - Then create a user and link them via `UserOrganization`

2. **Set Up Email:**
   - Configure SMTP settings for invitation emails
   - Or use a service like SendGrid, Resend, etc.

3. **Add More Features:**
   - Client invitation system
   - Booking cancellation
   - Calendar view
   - Notifications

## 📝 Development Commands

```bash
# Development
npm run dev          # Start dev server

# Database
npm run db:generate  # Generate Prisma Client
npm run db:push      # Push schema changes
npm run db:migrate   # Create migration
npm run db:studio    # Open Prisma Studio

# Production
npm run build        # Build for production
npm start            # Start production server
```

## 🔒 Security Notes

- Never commit `.env` files
- Use strong passwords for database
- Rotate `NEXTAUTH_SECRET` regularly
- Implement rate limiting for production
- Use HTTPS in production

## 📄 License

This is a commercial product. All rights reserved.

## 🤝 Support

For issues or questions, please contact the development team.