# Square Roots Partner Portal (prototype)

A mock partner portal for [Square Roots](https://www.squarerootssmu.ca/), the Enactus Saint Mary's
not-for-profit that sells "seconds" produce from Nova Scotia farms as affordable 10 lb bundles
through community sites. This is a demo for the Square Roots team, **not a production system**.

It has two parts:

- **The public website**: a recreation of every page of squarerootssmu.ca (Home, About, Drop Dates
  & Locations, For Farms, Become a Community Manager, Events, Contact Us) at the same addresses,
  with the same text, colours and fonts. The partner portal is added to the header, home page and
  footer, and there are sign-up links throughout.
- **The partner portal** at `/portal`, where each kind of partner logs in to their own screens.

Photos come from squarerootssmu.ca and the Square Roots Facebook page. They were chosen so that no
real person's face is visible. Wix stock photos from the live site are not used, because they're
licensed for Wix sites only.

## Who uses it

| Role | What they do |
|---|---|
| **Admin** (Enactus team) | Run drop cycles, turn orders into farm purchase lists, track impact |
| **Community Manager** | Order bundles before the cutoff, track preorders, log sales after a drop |
| **Farm** | Post available produce, confirm orders, see pickups and payment status |
| **Host Site** | See upcoming drop dates at their location (read-only) |

## Setup

You need **Python 3.12+** and **Node 20+**. Run the backend and frontend in two terminal windows.

### 1. Backend (Django)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed              # demo accounts and sample data
python manage.py runserver         # http://127.0.0.1:8000
```

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

Open **http://localhost:5173** for the website, or **http://localhost:5173/portal** for the partner
portal. The frontend sends every `/api/...` request on to Django for you.

**If port 8000 is already in use**, run Django on another port and tell the frontend where it is:

```bash
python manage.py runserver 8001
API_URL=http://127.0.0.1:8001 npm run dev
```

## Demo accounts

Every demo password is **`squareroots`**. The portal login page lists these accounts, and tapping one fills in the form.

| Username | Name | Role |
|---|---|---|
| `admin` | Maya Chen | Admin |
| `cm.dartmouth` | Jordan MacLeod | Community Manager (Dartmouth) |
| `cm.northend` | Aisha Rahman | Community Manager (Halifax - North End) |
| `cm.sackville` | Liam Boudreau | Community Manager (Lower Sackville) |
| `farm.gaspereau` | Ruth Eisenhauer | Farm (Gaspereau Valley Growers) |
| `farm.canard` | Tom Van Dyk | Farm (Canard Creek Farm) |
| `host.dartmouth` | Grace Oickle | Host Site (Dartmouth) |
| `apply.bedford` | Priya Nair | Community Manager, **waiting for approval** |
| `apply.northmountain` | Sam Porter | Farm, **waiting for approval** |
| `apply.windsorhall` | Dana Whynot | Host Site, **waiting for approval** |

The demo data also includes the 11 real Square Roots locations, two fictional Annapolis Valley
farms, and **a full year of drops** (every second Saturday), all worked out from today's date:
past drops with orders, reports and farm purchases (for the Impact screen); this Saturday's drop,
whose ordering has just closed; the drop in two weeks, where about half the sites have ordered
(not Dartmouth, so you can order as `cm.dartmouth`) and only one farm has been bought from; and later
drops open for ordering. The last drop at Dartmouth and the North End is still waiting for its
after-drop report.
Run `python manage.py seed` again at any time to reset everything.

The `admin` account can also open Django's built-in data admin at http://127.0.0.1:8000/django-admin/.

## Signing up

Partners can sign up on the website at `/signup`. From there they choose Community Manager, Farm or
Host Site, or they can use the forms on the For Farms and Become a Community Manager pages.

1. Signing up creates an account that is **waiting for approval**. The person is logged in, but only
   sees an "application received" page.
2. An admin reviews it on the portal's **Sign-ups** screen (`/portal/admin/signups`) and approves
   or declines it.
3. Once approved, the person logs in and gets their role's screens.

Emails (to the team about new sign-ups and contact messages, and to the applicant when they're
approved or declined) aren't really sent. They're printed in the terminal running `runserver`.

## What each role can do

Every bundle is 10 lbs of produce.

**Admin** (`admin`)
- **Sign-ups**: approve or decline people who signed up on the website.
- **Drop Cycles**: create a cycle (drop date, when ordering closes, which locations), change the
  date or cutoff for one location, add or remove locations, and delete cycles nobody has ordered in.
- **Orders**: for one cycle, every site's bundle order, pounds needed compared with pounds bought
  from farms, and the purchase list for each farm. Remove items before pickup, mark farm orders
  paid, and print the purchase lists.
- **Farms**: everything farms have posted. Choose an upcoming cycle and buy from any listing. It
  goes onto that farm's order, comes off their available pounds, and the farm is asked to confirm.
  If the farm had already confirmed, it's asked again.
- **Impact**: pounds diverted, bundles sold, locations active and drops held for a year; a chart
  per drop; totals by location; where leftovers went; and **Download CSV** (one row per site per drop).
- **API**: every endpoint, plus login testing tools.

**Community Manager** (`cm.dartmouth`, `cm.northend`, `cm.sackville`)
- **Order**: a big +/− counter for bundles, with the cutoff countdown, preorder count and how the
  last drop went. Orders lock at the cutoff (the server enforces this too).
- **Preorders**: add customers, then tick **Paid** and **Picked up** at the drop. People still to
  collect stay at the top, and there's a name search for long lists.
- **After Drop**: log bundles sold and left over, and where leftovers went.

**Farm** (`farm.gaspereau`, `farm.canard`)
- **Produce**: post, edit or mark sold out the seconds produce you have.
- **Pickups**: confirm or say you can't fill each order, with pickup times, totals and payment status.

**Host Site** (`host.dartmouth`)
- **Drop Dates**: the next drop at your space, expected bundles, later and recent drops, and who
  to contact.

The public **Drop Dates & Locations** page shows this year's real drop dates from the drop cycles.

Emails (new orders to farms, farm replies, sign-ups, approvals) are printed in the `runserver`
terminal instead of being sent. Farm orders can also be edited in Django's admin at `/django-admin/`.

## Testing logins and the API

There are three ways to check that logins work.

**1. Automated tests (run these after any change).** They run in a few seconds and need no browser:

```bash
cd backend
source .venv/bin/activate
python manage.py test
```

They cover logins (right and wrong passwords, unknown usernames, blank forms, switched-off accounts,
CSRF protection, every demo account's role), sign-ups (pending accounts, weak passwords, taken
usernames, each role's required questions), admin approval, the locations list, the contact form,
and which roles can use which API. They live in `backend/*/tests*.py`.

**2. The admin API page.** Log in as `admin` and open **API** in the menu (`/portal/admin/api`). It has:
- **Endpoints**: every API the portal uses, who can use it and what it does. The server builds this
  list itself, so new APIs show up automatically. Write a one-line docstring on each API view,
  because that's where the description comes from. GET endpoints have a **Try it** button.
- **Test a login**: type any username and password to see whether it would log in, and why
  not if it wouldn't. You stay logged in as admin.
- **Run all login checks**: one button that tries every demo account and the common mistakes.

**3. From a terminal with curl**, to see exactly what the server sends back:

```bash
curl -c jar.txt http://localhost:5173/api/auth/csrf/
TOKEN=$(grep csrftoken jar.txt | awk '{print $7}')
curl -b jar.txt -c jar.txt -H "X-CSRFToken: $TOKEN" -H "Content-Type: application/json" \
     -d '{"username":"cm.dartmouth","password":"squareroots"}' http://localhost:5173/api/auth/login/
curl -b jar.txt http://localhost:5173/api/auth/me/
```

## How the code is organised

```
backend/                 Django + Django REST Framework
  config/                settings and top-level URLs
    api_catalog.py       builds the list of APIs for the admin API page
  accounts/              users, roles, login, sign-ups and approval
    models.py            User (role + approval status) and Application (sign-up answers)
    views.py             login/logout, sign-up, approve/decline, admin login checker
    permissions.py       IsAdminRole, IsCommunityManager, IsFarm, IsHostSite (approved accounts only)
    notifications.py     "emails" (printed to the terminal for now)
    management/commands/seed.py   demo data
  drops/                 locations, drop cycles, site drops, bundle orders, preorders, reports
    views.py             public drop dates and locations, Host Site drops
    views_manager.py     Community Manager: order, preorders, after-drop report
    views_admin.py       Admin: drop cycles, cycle orders overview, impact and CSV
  farms/                 farms, produce listings, farm orders and their pickups
    views.py             Farm: produce and pickups
    views_admin.py       Admin: all produce, buying from farms, marking orders paid
  website/               Contact Us messages
frontend/                React (Vite), plain CSS
  public/photos, logos   images for the public website
  public/square-roots-logo.png
  src/
    theme.css            colours and fonts from squarerootssmu.ca. Change them here
    styles.css           portal layout, buttons, forms, blocks
    public.css           public website pages
    farm.css             farm Produce and Pickups screens
    screens.css          Community Manager, Host Site and Admin screens (and print styles)
    format.js            money, pounds, dates, times and countdowns
    App.jsx              which page shows at which web address
    roles.js             each role's portal menu. Add a screen here to put it in the menu
    signupRoles.js       the three kinds of partner sign-up
    api.js               talks to Django (handles login cookies and CSRF)
    auth.jsx             who is logged in (login, sign-up, logout)
    demoAccounts.js      demo usernames (must match the backend seed command)
    components/          site header/footer, portal layout, sign-up form, shared sections
    pages/site/          the public website, one file per page
    pages/portal/        the partner portal, one file per screen, in admin/, manager/, farm/ and host/
```

### How login works

Django's normal session login is used. React calls `/api/auth/login/`, Django sets a cookie, and
the browser sends it with every request after that. Each API view says which roles may use it, for
example `permission_classes = [IsAdminRole]`.

## Progress

- [x] 1. Auth and roles, with seed users for each role
- [x] Public website recreated, with partner sign-up and admin approval
- [x] 2. Drop cycles: admin creates cycles with an order cutoff and drop date per site
- [x] 3. Community Manager ordering: submit and edit bundle counts before the cutoff
- [x] 4. Admin aggregation: total orders per cycle, turned into a purchase list per farm
- [x] 5. Farm availability: farms post produce and quantities, admin allocates
- [x] 6. Impact dashboard: lbs diverted, bundles sold, sites active, CSV export
- [x] Extras: Community Manager preorders and after-drop reports, Host Site drop dates

Not in this prototype: real payments, sending real SMS or email (these are stubbed), and public
customer ordering.
