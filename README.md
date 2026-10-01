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
| **Host Site** | See upcoming drop dates at their location, and reserve bundles for people they support |
| **Customers** (no account) | Reserve bundles on the website, then change or cancel them from a private link |

## Ordering by route (in progress)

Square Roots orders by the box from supplier price lists, on three delivery routes. Moving that from
spreadsheets into the portal is planned in phases; **[docs/ORDERING-MODEL.md](docs/ORDERING-MODEL.md)**
describes the model and the questions for the team. Phase 0 is built: routes, suppliers (Ketty
Brow's and Footes), drop-off points with the Fairview hub, and each location's route, shown on the
admin **Routes** screen and set on **Locations**. Which location is on which route is a guess until
the team confirms it.

## Putting it online

It isn't hosted yet. **[HOSTING.md](HOSTING.md)** is the step-by-step plan: production settings,
real email, the three scheduled jobs (reminders, removing old customer details, backups) and a
checklist before real people use it.

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

### Demo mode

Demo mode is on by default. It shows the demo accounts on the login page and a thin banner in the
portal saying the people and numbers are made up. **Turn it off for real use:**

```bash
DEMO_MODE=0 python manage.py runserver
```

### Emails

Nothing is really emailed. Every email (sign-ups, approvals, password reset links, new farm orders,
pickup changes) is printed as readable text in the terminal running `runserver`, so you can copy
links from it. To send real email, change `MAILERS` in `backend/config/settings.py`.

## Loading Square Roots' real data

The demo data is made up. To load Square Roots' real locations, farms, people, drop dates and
history, fill in the spreadsheets in [`data-templates/`](data-templates/) (its README is written for
the Square Roots team), then:

```bash
cd backend
source .venv/bin/activate
export DATABASE_PATH=real.sqlite3 DEMO_MODE=0   # real data gets its own database, demo mode off
python manage.py migrate
python manage.py import_data ../real-data            # checks everything, changes nothing
python manage.py import_data ../real-data --apply    # loads it; all or nothing
```

- Put the filled-in files in `real-data/`. **Git ignores that folder and every `.sqlite3` file**, so
  names, emails and phone numbers can't end up on GitHub.
- Problems come back in plain language with the file and row, e.g. *people.csv, row 4: There's no
  location called "Lower Sackvile". Did you mean "Lower Sackville"?*
- Imported people get no password. Add `--invite` to email each one a link to choose their own.
- Running it again with updated files updates what's there instead of making duplicates.
- `locations.csv` is already filled in from squarerootssmu.ca.

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

## Reserving a bundle (customers)

Customers reserve on the website at `/reserve` (also linked from the home page, the header and each
location on Drop Dates & Locations). No account is needed.

1. They choose a location and drop, how many bundles (up to 4), and a price on the sliding scale.
   All three prices look the same on screen, and the choice is private.
2. They get a **pickup code** (like `K7M4`) and a **private link** to change or cancel until ordering
   closes. Both are emailed if they give an email, and the device remembers the link.
3. The reservation lands in the Community Manager's **Preorders** list, marked **Online**. At the
   drop, the manager types the code and taps once to mark it paid and picked up.

Each location sets aside a number of bundles for reservations (on the Community Manager's Preorders
screen, or the admin Locations screen). Online reservations and ones the manager adds both count.
When they're gone, customers can **join a waitlist**. When someone cancels, the first person in line
whose request fits gets the bundle automatically and is emailed. Cancelling deletes the customer's
details. The Reserve form has a hidden spam trap and a limit of 30 reservations an hour per visitor.

Also on the Reserve page:
- **Pay it forward**: people paying the standard price can add a $2, $5 or $10 gift for a neighbour,
  paid at the drop. It shows on the Community Manager's list, and After Drop suggests it as donations.
  The home page shows how many free bundles neighbours' gifts have covered this year (donations
  logged after drops, plus gifts on reservations not logged yet, divided by the at-cost price).
- **Where does your $10 go?**: the standard price split into what Square Roots paid farms per bundle
  this year (farm purchases divided by bundles sold), the rest of Square Roots' share, and the
  Community Manager's $2.50.
- **Reserve every drop**: a standing reservation. When the team schedules a new drop at that
  location, the customer is reserved (or waitlisted, if it's full) and emailed. Changes to a
  reservation carry forward, and it can be stopped from any reservation page.

**What's in the bundle** (`/whats-in-the-bundle`, linked from the home page and every reservation):
once the team sends the farm orders for a drop, customers see each item, the farm it came from, and
roughly how many pounds are in a bundle, with storage tips and simple ideas. The tips are in
`frontend/src/recipes.js`, matched to the farm's produce names ("Yukon Gold potatoes" finds potatoes).

**Host sites can reserve for people they support** (Host Site menu, **Reserve for Someone**): a first
name or initials is enough, with no email or phone. Each person gets a pickup code, and the list can
be printed to hand out. These reservations count towards the location's set-aside bundles and show
on the Community Manager's list tagged **Host site**.

**French**: the Reserve page, reservation page, What's in the Bundle and the home page section have
an English / Français switch, and customers get their emails in the language they reserved in. The
words are in `frontend/src/i18n.jsx` and `backend/drops/customer_emails.py`; both say how to add
another language. The French was written for this prototype, so have a French speaker check it
before real use. The rest of the website is English, like the live site. Messages from the server
(like "you already have a reservation") are still English.

**When plans change**, customers hear about it. If the team moves a drop's date or hours, or removes
a drop, everyone who reserved is emailed automatically, and the Drop Cycles screen says how many were
told. Community Managers can also **message their customers** from the Preorders screen (for example
about rain). It tells them who has no email, with their phone number, so they can call.

In the demo, the drop two weeks out has online reservations at most locations. The Halifax North End
is full, with two people on the waitlist (log in as `cm.northend` to see it). Middle Musquodoboit has
online reservations turned off.

## How Square Roots works (and how the portal follows it)

- **Bundles** are 10 lbs of seconds produce, sold on a **sliding scale**: $10 standard (pay it
  forward), $7.50 at cost, or free for people facing food insecurity (covered by sponsored pools).
- **Community Managers** order bundles for their location before the cutoff. From each $10 bundle
  they keep $2.50: they owe Square Roots the at-cost price ($7.50) for every paid bundle, nothing for
  free ones, and keep any donations. A brand-new location can pay a lower **first-drop price**.
- **The student team buys centrally** from partner farms, based on what each farm has spare. Farms
  get **one order per drop, after ordering closes**, so they see final numbers.
- Produce goes to a **central sorting space**, where volunteers pack 10 lb bundles for each location.
  Some locations also offer **home delivery** through a partner (e.g. BayRides in the St. Margaret's
  Bay area, $1.99).

Prices, the first-drop price, the delivery fee and the sorting space are set on the admin **Settings**
screen. **The first-drop price ($3.75) is a sample**; the real one hasn't been confirmed yet.

## What each role can do

**Admin** (`admin`)
- **Home**: a to-do list (sign-ups waiting, sites that haven't ordered, produce still to buy, farms
  that haven't confirmed, unpaid farm orders, missing after-drop reports) and the next drop at a glance.
- **Drop Cycles**: create a cycle (drop date and hours, when ordering closes, which locations),
  change the date, hours or cutoff for one location, add or remove locations, and delete cycles
  nobody has ordered in.
- **Orders**: for one cycle, every site's bundle order (admins can change it, even after the cutoff;
  the Community Manager is emailed), pounds needed compared with pounds bought, and each farm's
  purchase list. **Send orders to farms** once ordering closes (until then they're drafts farms
  can't see). Change a farm's pickup time or instructions (the farm is emailed), remove items
  before pickup, mark orders paid, and print purchase lists.
- **Farms**: everything farms have posted and still have. Expired produce is hidden. Choose an
  upcoming cycle and buy from any listing; it goes onto that farm's draft order.
- **Impact**: pounds diverted, bundles sold, locations active and drops held, with a chart per drop,
  totals by location, where leftovers went, and **Download CSV**.
- Under **More** (or on the home page on a phone):
  - **Packing & Delivery**: for one drop, what arrives from each farm and when, a packing guide
    (about how many pounds of each item go in each bundle), what goes to each location, and the
    home deliveries, with a CSV to send the delivery partner. Printable.
  - **Money**: each logged drop's statement (collected, owed to Square Roots, kept by the Community
    Manager), what's still waiting for payment, **Mark received**, and a CSV.
  - **Sign-ups**: approve or decline people who signed up. Approving a Community Manager or Host
    Site asks which location they'll run, and you can create a new location right there. Declining
    can include a reason for the email.
  - **People**: everyone with an account. Change their location or farm, switch accounts off or on,
    and send a password reset.
  - **Locations**: add and edit the locations shown on the website, or switch one off.
  - **Events**: add, edit, hide or delete events on the public Events page.
  - **Settings**: bundle prices, first-drop price, delivery fee and the sorting space.
- **Developer tools** (linked from the admin home page): every API endpoint, plus login testing tools.

**Community Manager** (`cm.dartmouth`, `cm.northend`, `cm.sackville`)
- **Order**: a big +/− counter for bundles, with the cutoff countdown, preorder count and how the
  last drop went. Orders lock at the cutoff (the server enforces this too).
- **Preorders**: add customers with their price (standard, at cost or free) and, where offered, home
  delivery with an address. Tick **Paid** and **Picked up** at the drop. People still to collect stay
  at the top, and there's a search by name or pickup code for long lists. Type a customer's **pickup
  code** to find them and mark them paid and picked up in one tap. The **waitlist** is shown below
  the list, and **Online reservations** can be switched on or off, with how many bundles to set aside.
- **After Drop**: log bundles sold at each price, donations, and leftovers. Each logged drop shows a
  statement: collected, owed to Square Roots, and what you keep, plus whether payment was received.

**Farm** (`farm.gaspereau`, `farm.canard`)
- **Produce**: post, edit or mark sold out the seconds produce you have.
- **Pickups**: confirm or say you can't fill each order, with pickup times, totals and payment status.

Everyone can open **My account** (top right) to change their name, email, phone or password.
Anyone who forgets their password can use **Forgot your password?** on the login page.
If a login times out, the portal takes the person back to the login page and says why.

**Host Site** (`host.dartmouth`)
- **Drop Dates**: the next drop at your space, expected bundles, later and recent drops, and who
  to contact.
- **Reserve for Someone**: reserve bundles for people your organization supports, with pickup codes
  to hand out and a printable list.

The public **Drop Dates & Locations** page shows this year's real drop dates from the drop cycles,
and each location's next drop date and hours. The **Events** page shows events the team adds; the
live site's Saint Mary's / NSCC Ivany event is included as a past event. **Check its year:** the
live site doesn't say it, so 2024 is a guess from the site's "© 2024" footer.

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

The backend tests (171) cover logins, two-step login and lockouts, sign-ups and approval, ordering,
money, farms, reservations (waitlist, every drop, pickup codes, French emails, reminders, feedback),
host sites, privacy clean-up, backups and which roles can use which API. They live in
`backend/*/tests*.py`.

The website tests run in a pretend browser with the API faked:

```bash
cd frontend
npm test
```

They cover reserving (prices, gifts, missing details, the waitlist, locations without online
reservations), the French switch, the reservation page and feedback, the "something went wrong"
screen and the recipe matching. They live in `frontend/src/test/`.

**2. The admin API page.** Log in as `admin` and open **Developer tools** from the admin home page (`/portal/admin/api`). It has:
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
    views_admin.py       Admin: People (link location/farm, switch off, password reset)
    notifications.py     "emails" (printed to the terminal for now)
    email_backend.py     prints emails as readable text
    management/commands/seed.py   demo data
  drops/                 locations, drop cycles, site drops, bundle orders, preorders, reports
    views.py             public drop dates and locations, Host Site drops
    views_manager.py     Community Manager: order, preorders, pickup codes, reservation settings, after-drop report
    views_reserve.py     public: customers reserving, changing and cancelling bundles
    reservations.py      what's left to reserve, the waitlist, every-drop reservations, bundle contents
    customer_emails.py   the emails customers get, in English and French
    views_admin.py       Admin: drop cycles, orders overview, locations, dashboard, impact and CSV
    views_operations.py  Admin: settings, money (statements and payments), packing and delivery sheet
    money.py             how a drop's money is worked out (sliding scale, $2.50 split, first drop)
  farms/                 farms, produce listings, farm orders and their pickups
    views.py             Farm: produce and pickups
    views_admin.py       Admin: all produce, buying from farms, marking orders paid
  website/               Contact Us messages and public events
  data_import/           loads real data from CSV files (python manage.py import_data)
data-templates/          spreadsheets (and a guide) for Square Roots to fill in with real data
frontend/                React (Vite), plain CSS
  public/photos, logos   images for the public website
  public/square-roots-logo.png
  src/
    theme.css            colours and fonts from squarerootssmu.ca. Change them here
    styles.css           portal layout, buttons, forms, blocks
    public.css           public website pages
    farm.css             farm Produce and Pickups screens
    screens.css          Community Manager, Host Site and Admin screens (and print styles)
    dashboard.css        home dashboards, demo banner, More menu, People/Locations/Events/account
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
- [x] Customer reservations (stage 1): reserve online, pickup codes, waitlist, change or cancel
- [x] Customer reservations (stage 2): pay it forward, where your money goes, reserve every drop,
  notices when drops change
- [x] Customer reservations (stage 3): what's in the bundle with recipes, host sites reserving for
  people, French

Not in this prototype: real payments, and sending real SMS or email (these are stubbed).
