# Ask Claude about your Family Ledger

The Family Ledger app can keep a private copy of your ledger on your own Vercel website.
Claude reads it through an MCP connector and can answer questions like
"How much did we spend on groceries this month?". Claude can only read; it cannot change anything.

## One-time setup

1. **Vercel account** – vercel.com → Sign up → Continue with GitHub.
2. **Import this project** – Add New → Project → Import `family-ledger`. Leave the build settings as they are.
   Open **Environment Variables** and add `LEDGER_SECRET` = a secret of at least 12 characters (keep it private). Click **Deploy**.
3. **Database** – in the project: Storage → Create Database → **Upstash for Redis** (free) → connect it to this project.
   Then Deployments → latest → ⋯ → **Redeploy**.
4. **Phone** – Family Ledger → Settings → *Ask Claude about your money* → type the website address
   (e.g. `https://family-ledger-xxxx.vercel.app`) and the same secret → **Connect** → **Copy address**.
5. **Claude** – Settings → Connectors → Add custom connector → name *Family Ledger*, URL = the copied address.

## What Claude can ask (read-only)
monthly_summary · list_expenses · category_trend · year_summary · payments_to · family_income · list_categories

## Privacy
- Only the app (with the secret) can send data. Only the private Claude address can read it. Keep both private.
- The activity log and payment-reading internals stay on the phone.
- Turn it off any time in the app (Settings → Turn off). To delete the online copy, delete the database in Vercel.
