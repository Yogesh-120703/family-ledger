# Family Income Ledger — installable Android app (PWA)

A family finance app for income, necessary and lifestyle expenses, savings, optional spending-limit alerts, analytics and annual reports. It installs on Android from Chrome, opens full-screen from the home screen, and works offline.

## Android app and UPI detection
This folder is also a native Android app (Capacitor) with optional UPI payment detection from notifications. See **ANDROID.md** for build steps, permissions, device testing and limitations. The web version on Vercel is unchanged and does not include UPI detection.

## Files

| File | What it does |
|---|---|
| `index.html` | App shell (header, screen area, bottom tab bar) |
| `styles.css` | Dark theme, mobile layout, bottom sheets, print/PDF styles |
| `core.js` | All data and calculations: migration, totals, savings, categories, limits and alerts, CSV, validation. No screen code |
| `app.js` | The six screens + Settings, forms, routing (Android back button), install and notifications |
| `sw.js` | Offline support (caches the app after the first visit) |
| `manifest.webmanifest`, `icons/` | App name, icon and full-screen install settings |
| `vercel.json` | Cache and security headers for Vercel |

No build step and no dependencies.

## Deploy to Vercel (5 minutes)

**Option A: drag and drop**
1. Unzip this folder.
2. Sign in at vercel.com → **Add New → Project** → choose to deploy without Git, or use the Vercel CLI:
   ```
   npm i -g vercel
   cd family-ledger-app
   vercel --prod
   ```
3. Vercel gives you a link like `https://family-ledger.vercel.app`.

**Option B: GitHub (best for future updates)**
1. Create a new GitHub repo and upload the contents of this folder.
2. In Vercel: **Add New → Project → Import** the repo → Framework preset **Other** → Deploy.
3. Every push to GitHub redeploys automatically.

The app must be served over **https** (Vercel does this) for install, offline mode and notifications to work.

## Install on an Android phone
1. Open the Vercel link in **Chrome**.
2. Tap **Install app** on the Home screen banner, or Chrome menu ⋮ → **Install app** / **Add to Home screen**.
3. Open **Family Ledger** from the home screen. It opens full-screen, with no browser bar, and works without internet.

## Sample data
On a fresh app, Home shows **Load sample data** (also in ⚙ Settings → Sample data). It adds a realistic family year from January to today: income for 4 people, about 25 expenses a month across necessary and lifestyle categories, monthly savings, and 3 example spending limits. Every sample entry is tagged, so **Remove sample data** deletes only those and keeps anything you entered. Sample entries you edit become your own and are kept.

## Repeating payments and bills
When adding an expense or savings entry, choose **Repeat** (every month, 2, 3 or 6 months, or yearly) and whether the amount is the same each time or changes (bills). Home then lists payments due in the next 7 days, plus late ones from last month, with **Add** (one tap for fixed amounts) and **Skip**. Bills with changing amounts open the form so you type this month's amount. Manage them in ⚙ Settings → Repeating payments and bills (Edit, Pause, Delete). Nothing is added without your tap. Phone notifications for bills due today appear when you open the app; a web app cannot send them while fully closed.

## This month vs last month
Home cards show ▲/▼ changes against last month. For the month in progress the app compares the same days (for example 1–13 Sep against 1–13 Oct), so a half-finished month isn't compared with a full one. A panel lists the categories that changed most.

## Running balance
Each month's leftover (income − expenses − savings) carries into the next month. Home shows **Carried from earlier months** and **Total balance**, and Reports has a **Running** column. Optional: ⚙ Settings → **Starting balance** to enter the cash and bank amount you had at the start of a month. The running balance then begins from that figure.

## Move data from the web version
1. Open the old Family Income Ledger web page → **Income** → **Move to the mobile app** → **Copy my data**.
2. In the app: ⚙ **Settings → Backup and move data** → paste → **Import pasted data**.
3. People keep their IDs. Old category names are mapped to the new ones (Rent → House Rent, etc.), and custom categories are kept. If the app already has data, it asks before replacing, and **Undo last import** restores it.

## Where data lives
- Data is saved on the phone (browser storage for the app, marked persistent where Chrome allows). It survives restarts and works offline.
- **It does not sync between phones.** Each phone has its own copy. Use **Download backup** regularly. Clearing Chrome's site data or uninstalling the app deletes it.
- Shared family data across phones needs a backend with logins (for example Supabase or Firebase). That is a separate piece of work.

## Updating the app later
Change the files, then bump `VERSION` in `sw.js` (for example `fil-v2`) so installed phones fetch the new version. Redeploy.

## Want a Play Store APK later?
This PWA can be wrapped into a signed Android APK/AAB without rewriting it:
- **PWABuilder** (pwabuilder.com): enter your Vercel URL → Android → download the package. It creates a Trusted Web Activity and a signing key. Keep that key safe, because you need it for every update.
- Upload the `.aab` to Google Play Console (one-time US$25 developer fee).
- Add the `assetlinks.json` PWABuilder gives you to `/.well-known/` in this project so the app opens without a browser bar.

## Tested
49 automated checks in a headless browser: income add/edit/no-income, necessary and lifestyle expenses, custom categories and subcategories (from the form and Settings), rename/archive safety, multiple savings per month, savings lowering balance without adding to expenses (₹1,73,000 − ₹1,21,200 − ₹20,000 = ₹31,800), limits off by default, alerts at reached/over shown once, limits off means no warnings, edit/delete recalculation, annual report and CSV, restart persistence, and import from the web version.

Not yet tested on a real Android device. Please check the install flow, keyboard behaviour and notifications on your phone.
