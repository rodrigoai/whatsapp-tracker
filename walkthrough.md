# Google Ads Conversion Tracking System Walkthrough

I have successfully completed the implementation of the WhatsApp Conversion Tracking system based on your feedback and requirements!

## What was Accomplished

### 1. Next.js + Tailwind CSS Project Setup
- Created a fresh Next.js App Router project in the `/Users/rcslima/projects/Whatsapp Tracking` folder.
- Configured Tailwind CSS and implemented a premium UI featuring glassmorphism, vibrant colors, and smooth animations.
- Set up a SQLite database via Prisma ORM (`dev.db`).
- Installed and configured NextAuth with simple Admin Credentials (`admin`/`password` by default, configurable in `.env`).

### 2. Backoffice Architecture
- **Admin Layout**: Created a shared sidebar layout allowing navigation between Accounts, Configurations, Attendants, and Leads.
- **Account Switcher**: Managed globally via Context API + `localStorage` so the currently selected website configuration persists across navigation.
- **Accounts Dashboard (`/admin`)**: Create/Delete tracking websites.
- **Button Configuration (`/admin/config`)**: Customize the floating button's position, size, text, and color. Includes a quick "Copy Script Tag" button!
- **Attendant Numbers (`/admin/attendants`)**: Manage active/inactive status and add new WhatsApp numbers.
- **Conversion Register (`/admin/leads`)**: View all captured leads with search functionality and a "Export to CSV" button that follows your specified formatting rules!

### 3. Core API Endpoints
- **`GET /api/script.js`**: Generates and serves a stateless Vanilla JS script specifically configured for the `accountId` passed in the query params. It includes CORS support and automatically manages `localStorage` for `gclid` survival.
- **`POST /api/conversion`**: Receives form submissions from the injected script. It implements a robust **Round-Robin** algorithm based on the database state to distribute leads evenly among active attendants, automatically prepends the `+55` country code to Brazilian numbers, and returns the final redirect URLs.

### 4. Testing & Verification
- Implemented `jest` and React Testing Library.
- Written 3 specific test blocks covering the `formatWhatsAppNumber` utility, the `getNextAttendant` Round-Robin algorithm, and the Login Page UI integration.
- **All tests pass successfully.**
- Created the `MEMORY.md` to document the architecture and future states.

## How to Test it Locally

1. Run the development server from the project directory:
   ```bash
   npm run dev
   ```
2. Navigate to `http://localhost:3000/login` and login with `admin` / `password`.
3. Create an Account and set up a Button Configuration.
4. Add at least one Attendant (e.g. `11999999999`).
5. Go back to Configuration, click "Copy Script Tag".
6. You can create a simple `index.html` file on your desktop, paste the script inside the `<body>`, open it in a browser, and click the button to see the modal form and test the WhatsApp redirect!
