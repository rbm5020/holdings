# Supabase Setup for Portfolio Persistence

The portfolio persistence issue is solved with external database storage. Here's how to set up Supabase:

## 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in and create a new project
3. Choose a region close to your users
4. Wait for project to be ready

## 2. Create Database Table

Run this SQL in the Supabase SQL Editor:

```sql
-- Create portfolios table
CREATE TABLE portfolios (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_portfolios_id ON portfolios(id);

-- Enable Row Level Security (optional, for security)
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust as needed)
CREATE POLICY "Allow all operations on portfolios" ON portfolios
FOR ALL USING (true);
```

## 3. Get Environment Variables

From your Supabase project dashboard:

1. Go to **Settings** > **API**
2. Copy the **Project URL** (this is your `SUPABASE_URL`)
3. Copy the **anon public** key (this is your `SUPABASE_ANON_KEY`)

## 4. Configure Vercel Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add these variables:
   - `SUPABASE_URL`: Your project URL (e.g., `https://abcdefg.supabase.co`)
   - `SUPABASE_ANON_KEY`: Your anon public key

## 5. Test the Setup

After setting up environment variables, the portfolio persistence will automatically work:

- Portfolios created will be saved to Supabase
- Portfolio views will fetch from Supabase when not in memory
- The system gracefully falls back to in-memory storage if Supabase is unavailable

## Current Implementation

The code in `/api/portfolios.js` already has:

✅ Supabase REST API integration
✅ Graceful fallback to in-memory storage
✅ Environment variable configuration
✅ Error handling and logging

Only missing: **Supabase project setup + environment variables**

## Verification

Once configured, you can verify persistence by:

1. Creating a portfolio
2. Waiting 5+ minutes
3. Viewing the portfolio (should still work)

The logs will show:
- `✅ Portfolio {id} saved to Supabase` (on creation)
- `✅ Found portfolio {id} in Supabase` (on retrieval from external DB)