# Running Brilla Operations System on your computer

This guide is written for someone who has **never run code before**. Follow it
step by step. You only do steps 1–3 once.

---

## What you need (one-time setup)

### 1. Install Node.js
Node.js is the engine that runs this app.

1. Go to **https://nodejs.org**
2. Download the version that says **LTS** (it will say something like "20.x" or "22.x").
3. Open the downloaded file and click through the installer (keep clicking "Next" / "Continue").

To check it worked, open a **terminal**:
- **Windows:** press the Start button, type `cmd`, press Enter.
- **Mac:** press `Cmd + Space`, type `Terminal`, press Enter.

Type this and press Enter:
```
node --version
```
If you see a number (like `v22.22.2`), you're good.

### 2. Open the project folder in the terminal
In the terminal, type `cd ` (with a space), then drag the **BrillaFullSystem**
folder into the terminal window and press Enter. Example:
```
cd /Users/you/Downloads/BrillaFullSystem
```

### 3. Install and set up the app
Copy and paste these commands **one at a time**, pressing Enter after each:

```
npm install
```
(Downloads everything the app needs. Takes a couple of minutes the first time.)

```
npx prisma migrate dev
```
(Creates the local database.)

```
npm run db:seed
```
(Adds the starter data and demo logins.)

---

## Starting the app (every time)

In the terminal, in the project folder, run:
```
npm run dev
```
Then open your web browser and go to:
```
http://localhost:3000
```

To **stop** the app, click on the terminal and press `Ctrl + C`.

---

## Logging in

The seed creates two demo accounts:

| Role    | Email                 | Password    | What they see                       |
|---------|-----------------------|-------------|-------------------------------------|
| Admin   | admin@brilla.local    | admin123    | Everything (full system)            |
| Cleaner | cleaner@brilla.local  | cleaner123  | Only their own tasks (mobile view)  |

> Change these passwords before using the system for real (create new staff in
> the **Staff** section and stop using the demo accounts).

---

## A 5-minute tour (do this in order as the Admin)

1. **Settings** — see the global VAT setting. This is the *only* place VAT lives.
   Add a Service Category or Client Type to prove the lists are configurable.
2. **Service Builder** — open "Standard Cleaning". Notice the pricing is
   *hours × rate × manpower*. Change anything and Save — it creates **version 2**
   while old work orders keep version 1. Try **Clone this service**.
3. **Clients** → open "Acme Holdings" → it has a property already.
4. **Properties** → open the property → see the admin-defined attributes
   (bedrooms, pools, sqm) — none of these are hardcoded.
5. **Work Orders** → New → pick the client + property → create.
   - Add a **Service Line** (pick Standard Cleaning, enter hours + manpower) —
     the price is calculated for you.
   - **Assign** the cleaner. Try assigning someone *not eligible* — the system
     blocks it.
   - The cleaner's **Tasks** are generated automatically.
6. Log out, log in as the **Cleaner** → you only see **My Tasks**. Open a task,
   Start it, tick the checklist, upload a photo, and Complete it. On a phone the
   buttons are large and finger-friendly.
7. Back as Admin → open the Work Order → **Generate invoice** (VAT comes from the
   global setting) → open the invoice → **Print / Save PDF** → **Record payment**.

---

## Common questions

**"Command not found" / "npm is not recognized"** — Node.js isn't installed or the
terminal needs reopening. Redo step 1, then close and reopen the terminal.

**I want to start over with fresh data** — run `npm run db:reset` (this wipes the
local database and re-seeds it).

**Where is my data stored?** — In a single file `prisma/dev.db` inside the project.
It never leaves your computer.

**Is anything sent to the internet?** — No. Everything runs locally. There are no
accounts, API keys, or external services in this version.

When you're ready to put this online so staff can use it from anywhere, see
**docs/DEPLOYMENT.md**.
