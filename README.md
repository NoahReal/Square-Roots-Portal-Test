# Square Roots Partner Portal (prototype)

A mock partner portal for [Square Roots](https://www.squarerootssmu.ca/), the Enactus Saint Mary's
not-for-profit that sells "seconds" produce from Nova Scotia farms as affordable 10 lb bundles
through community sites. This is a demo for the Square Roots team, **not a production system**.

The look matches squarerootssmu.ca: the same colours, Playfair Display headings, square outlined
buttons and the Square Roots logo.

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

Open **http://localhost:5173**. The frontend sends every `/api/...` request on to Django for you.

**If port 8000 is already in use**, run Django on another port and tell the frontend where it is:

```bash
python manage.py runserver 8001
API_URL=http://127.0.0.1:8001 npm run dev
```

## Demo accounts

Every demo password is **`squareroots`**. The login page lists these accounts, and tapping one fills in the form.

| Username | Name | Role |
|---|---|---|
| `admin` | Maya Chen | Admin |
| `cm.dartmouth` | Jordan MacLeod | Community Manager |
| `cm.bedford` | Aisha Rahman | Community Manager |
| `cm.sackville` | Liam Boudreau | Community Manager |
| `farm.gaspereau` | Ruth Eisenhauer | Farm |
| `farm.canard` | Tom Van Dyk | Farm |
| `host.dartmouth` | Grace Oickle | Host Site |

Run `python manage.py seed` again at any time to reset the demo data.

The `admin` account can also open Django's built-in data admin at http://127.0.0.1:8000/django-admin/.

## Testing logins and the API

There are three ways to check that logins work.

**1. Automated tests (run these after any change).** They run in a few seconds and need no browser:

```bash
cd backend
source .venv/bin/activate
python manage.py test
```

They cover correct and wrong passwords, unknown usernames, blank forms, case-sensitive
passwords, switched-off accounts, logging out, CSRF protection, every demo account's role, and
which roles can use which API. They live in `backend/accounts/tests.py` and `backend/config/tests.py`.

**2. The admin API page.** Log in as `admin` and open **API** in the menu (`/admin/api`). It has:
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
  accounts/              users, roles, login/logout API
    models.py            User with a `role` field
    views.py             login, logout, "who am I", and the admin login checker
    permissions.py       IsAdminRole, IsCommunityManager, IsFarm, IsHostSite
    management/commands/seed.py   demo data
frontend/                React (Vite), plain CSS
  public/                Square Roots logo
  src/
    theme.css            colours and fonts from squarerootssmu.ca. Change them here
    styles.css           layout, buttons, forms, blocks
    roles.js             each role's menu. Add a screen here to put it in the menu
    App.jsx              which page shows at which web address
    api.js               talks to Django (handles login cookies and CSRF)
    auth.jsx             who is logged in
    demoAccounts.js      demo usernames (must match the backend seed command)
    components/          header/menu layout, footer, yellow page hero
    pages/               one file per screen
```

### How login works

Django's normal session login is used. React calls `/api/auth/login/`, Django sets a cookie, and
the browser sends it with every request after that. Each API view says which roles may use it, for
example `permission_classes = [IsAdminRole]`.

## Progress

- [x] 1. Auth and roles, with seed users for each role
- [ ] 2. Drop cycles: admin creates cycles with an order cutoff and drop date per site
- [ ] 3. Community Manager ordering: submit and edit bundle counts before the cutoff
- [ ] 4. Admin aggregation: total orders per cycle, turned into a purchase list per farm
- [ ] 5. Farm availability: farms post produce and quantities, admin allocates
- [ ] 6. Impact dashboard: lbs diverted, bundles sold, sites active, CSV export

Not in this prototype: real payments, sending real SMS or email (these are stubbed), and public
customer ordering.
