# Personal Log - Professional Workspace

A high-performance, private workspace designed for daily planning, task tracking, and historical logging. Built with **Next.js 15**, **Prisma**, and **Postgres**, this application provides a sleek, shared environment for verified users.

## ✨ Core Features

- **Secure Workspace Access**: Hardcoded verification system restricted to authorized personnel ("Keqing" and "Winter").
- **Dynamic Task Management**: Create, delete, and track tasks with real-time status updates.
- **Daily Planning**: Dedicated sections for daily objectives and long-term planning.
- **Historical Records**: Automated archiving of daily logs and task completions for easy review.
- **Premium UI/UX**: Modern aesthetics featuring glassmorphism, smooth animations, and a responsive layout.
- **Multi-Room Architecture**: Automatic workspace assignment based on the user's identity.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database**: [Postgres](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Styling**: Vanilla CSS & Tailwind CSS
- **Icons**: [Lucide React](https://lucide.dev/)
- **Verification**: Name-based hardcoded verification

## 🚀 Getting Started

### 1. Prerequisites

- Node.js 20+ installed
- A running Postgres database (e.g., Vercel Postgres)

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/GREATLOLO/Personal_Log.git
cd Personal_Log

# Install dependencies
npm install
```

### 3. Environment Configuration

Create a `.env` or `.env.local` file in the root directory:

```dotenv
# Prisma connection pooling (recommended for app)
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=your_key"

# Direct connection (required for migrations and db push)
DIRECT_URL="postgres://user:pass@host:5432/db"
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Synchronize schema with database
npx prisma db push

# (Optional) Seed initial data
npx tsx prisma/seed.ts
```

### 5. Running Localy

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## ☁️ Vercel Deployment

This project is optimized for deployment on **Vercel**.

### Deployment Steps

1. Connect your repository to Vercel.
2. In the **Project Settings -> Environment Variables**, add:
   - `DATABASE_URL`: Your pooled database URL.
   - `DIRECT_URL`: Your direct database URL.
3. Vercel will automatically run `next build`, which includes the Prisma client generation.

### Optimization Tips

- Use **Prisma Accelerate** for connection pooling, especially in serverless environments.
- Ensure your Postgres instance is in the same region as your Vercel deployment for minimal latency.

## 📝 Usage

1. **Login**: Enter your authorized name ("Keqing" or "Winter"). No password is required.
2. **Dashboard**: Navigate your daily tasks and plans.
3. **History**: Access the sidebar or navigation to view past logs and completed objectives.

---

Built with pride for high-productivity logging.
