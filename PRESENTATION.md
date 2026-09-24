# Presenting the Square Roots Partner Portal

Your notes for showing this to Square Roots: what it is, how to demo it in about 5 minutes, what to
say, and what to be upfront about. The developer details are in [README.md](README.md).

---

## 1. The one-minute version

**What it is:** a working prototype of a partner portal for Square Roots, built into a recreation of
their current website (same pages, text, colours, fonts and logo).

**The problem it solves:** today, Community Managers order through a form, the form goes to farms,
and the team pulls everything together by hand to track orders and plan deliveries. The portal puts
that whole loop in one place:

1. Community Managers order bundles on their phone before the cutoff.
2. The team buys from farms based on what each farm has spare, and sends each farm **one order once
   ordering closes**.
3. A packing sheet tells volunteers what goes in each 10 lb bundle and where everything goes,
   including BayRides home deliveries.
4. After each drop, Community Managers log sales on the **sliding scale ($10 / $7.50 / free)**, and
   everyone sees what's owed, what was paid, and the impact (pounds diverted, free bundles given).

**How to pitch it:** a proposal and a conversation starter, not a finished product.

---

## 2. Before you show it

- [ ] **Reset the demo data** so the dates and numbers are fresh: in `backend/`, run `python manage.py seed`
- [ ] Start both servers (see section 3) and open http://localhost:5173
- [ ] Click through the demo script once on your own
- [ ] Make your browser window phone-sized for the Community Manager part (or use your phone's
      view in the browser's developer tools)
- [ ] Have a backup: a 3–5 minute screen recording (QuickTime: File → New Screen Recording)
- [ ] Be ready to say how it was built (section 7)
- [ ] Read the open questions (section 6). They're good things to ask them.

---

## 3. Running it

**First time on a computer:** follow *Setup* in [README.md](README.md).

**Every time after that:** two terminal windows.

```bash
# Terminal 1: the backend
cd backend
source .venv/bin/activate
python manage.py runserver

# Terminal 2: the frontend
cd frontend
npm run dev
```

Then open **http://localhost:5173** (website) or **http://localhost:5173/portal** (portal).

- **Port 8000 already in use?** Run `python manage.py runserver 8001` and start the frontend with
  `API_URL=http://127.0.0.1:8001 npm run dev`.
- **Every demo password is `squareroots`.** The login page lists the accounts; tap one to fill it in.
- **"Emails"** (invites, farm orders, password resets) appear in Terminal 1, not in a real inbox.

---

## 4. The 5-minute demo script

Show three flows. Keep everything else for questions.

### Flow 1: a Community Manager on their phone (about 90 seconds)

Log in as **Jordan MacLeod** (`cm.dartmouth`), phone-sized window.

1. **Home** shows a to-do list: *order for the next drop*, *drops to log*, *what you owe Square
   Roots*. Point out: "Everything Jordan needs is on one screen."
2. **Order**: tap + and −, then **Place order**. Mention the countdown to the cutoff and the hint
   about how the last drop went.
3. **Preorders**: add a customer, pick a price (standard / at cost / free), then tap **Paid** and
   **Picked up**. Point out: "Built for use at the drop, with big buttons."
4. **After Drop**: enter bundles at each price and a donation, then save. The **statement** shows
   collected, owed to Square Roots, and what Jordan keeps: the $2.50 split, worked out automatically.

### Flow 2: the team runs a drop (about 2 minutes)

Log out, then log in as **Maya Chen** (`admin`), full-size window.

1. **Home**: the to-do list (sign-ups waiting, sites that haven't ordered, produce still to buy,
   payments not received) and the next drop at a glance.
2. **Orders** → pick the **October** drop (the one two weeks out): every site's bundles, pounds
   needed compared with pounds bought.
3. Click **Buy … more from farms**. That opens Farms on the October drop. Buy from Canard Creek
   Farm. Point out: "This is a draft; the farm doesn't see it yet."
4. Back on **Orders** → **Send orders to farms**. Point out: "Farms get one order with final
   numbers, once ordering closes."
5. **More → Packing & Delivery** → pick **this Saturday's** drop: what arrives from each farm, how
   many pounds of each item go in each bundle, what goes to each location, and the BayRides
   deliveries with a CSV. Point out: "This can be printed for the volunteers."

*(Optional: log in as `farm.canard` to show the farm's side, where it confirms the order.)*

### Flow 3: the numbers funders care about (about 1 minute)

Still as Maya:

1. **Impact**: pounds diverted from waste, bundles sold, **free bundles given**, donations, money
   paid to local farms, a chart per drop, and **Download CSV**.
2. **More → Money**: what each drop owes, **Mark received**, and a CSV for the treasurer.
3. Open the public **Drop Dates & Locations** page: each location's next drop date and hours,
   "Pay what works for you", and home delivery.

**Close with:** "What would you want changed? And which of these problems matters most to you?"

---

## 5. What's real and what's made up

| Real (from Square Roots) | Made up for the demo |
|---|---|
| The 11 locations, addresses and social links | The Community Managers (Jordan, Aisha, Liam), Maya, Grace |
| Prices: $10, $7.50 and free bundles; the $2.50 split | The two farms (Gaspereau Valley Growers, Canard Creek Farm) |
| BayRides delivery in the St. Margaret's Bay area, $1.99 | Every order, sale, donation and payment |
| Their website's text, pages and photos | The year of drop history behind Impact and Money |
| How ordering, farms, sorting and delivery work | Customers on preorder lists |

The portal shows a **"Demo" banner** saying the people and numbers are made up. **Don't quote the
Impact numbers as theirs.**

**Their real data can be loaded.** Send them the spreadsheets in [`data-templates/`](data-templates/)
(with its guide). Once they're filled in, loading them is one command. See *Loading Square Roots'
real data* in [README.md](README.md).

---

## 6. Open questions to ask them

These are assumptions built into the prototype. Asking about them shows you've thought it through.

1. **What's the real first-drop price** for a new location? (The portal uses a sample $3.75 per paid bundle.)
2. **What do Community Managers owe per bundle?** We assumed $7.50 per paid bundle and nothing for free ones.
3. **Who pays for leftover bundles**, the Community Manager or Square Roots? (Statements ignore leftovers for now.)
4. **What year was the Saint Mary's / NSCC Ivany event?** We guessed 2024.
5. **Where's the sorting space**, and who does farm pickups?
6. **Do they want customers to order online** eventually? Their answers mention web checkouts; it's not built.

---

## 7. Be upfront about these

**How it was built.** You built it with an AI coding assistant (Claude Code). Say so plainly. Most
teams are fine with it; finding out later is what damages trust. Before presenting, go through the
code and README until you can explain the main flows and where things live.

**It's a prototype.** It isn't online yet. What's ready and what isn't:
- **Ready:** a draft privacy policy (for Square Roots to review), customer details removed 60 days
  after each drop, limits on login attempts and public forms, two-step login for admins, a
  "something went wrong" screen, reminder emails, production settings, and a hosting guide
  ([HOSTING.md](HOSTING.md)).
- **Still needed:** hosting and the domain, an email sending service, Square Roots' review of the
  privacy policy, a French speaker checking the French, testing on real phones, and someone
  responsible for the site each year.

**Keeping it private.** It uses their name, logo and photos, which is fine for showing *them*.
Don't post it publicly or host it where it could be mistaken for their real site.

---

## 8. Options to offer them

They're on Wix today, which is cheap and needs no developer. A custom portal is a bigger commitment,
so offer sizes:

| Option | What it is | Ongoing cost and effort |
|---|---|---|
| **Small** | Improve their current Wix site: fix broken buttons, stale dates, page titles, mobile layout and contrast | Just their existing Wix plan |
| **Medium** | Keep the website on Wix; add the portal for ordering, farms, packing and money | Hosting roughly $10–30/month, plus someone to look after it |
| **Full** | Everything in this prototype: website and portal together | Same hosting, plus they manage the website in the portal |

**Expect the question "what happens when you leave?"** Honest answer: the code is written to be
readable, and the README and templates are meant for the next student team. But someone needs to own
it each year, or they should choose the Small option.

---

## 9. Likely questions and short answers

- **"Can we see it without you?"** Not as a clickable app unless it's hosted. You can send a
  screen recording, or a private link to a walkthrough page.
- **"Is our data safe?"** Real data goes in its own database, never in the code on GitHub. People
  choose their own passwords. It still needs the items in section 7 before real use.
- **"Can our Community Managers use it on their phones?"** Yes. It was designed phone-first.
- **"Can we change prices?"** Yes, on the Settings screen, without a developer.
- **"How long to go live?"** Depends on the option: days for Small; a few weeks for Medium or Full,
  including the items in section 7 and testing with a couple of Community Managers.
- **"What do you need from us?"** Answers to section 6, the filled-in spreadsheets, and a decision
  on which option.

---

## 10. Where things are

- **All the work is on the `portal-mvp` branch.** `main` only has the first commit, and **nothing
  has been pushed to GitHub**.
- **README.md** is the developer guide: setup, demo accounts, every screen, tests and code layout.
- **data-templates/** has the spreadsheets and a guide for Square Roots to fill in.
- **Tests:** in `backend/`, run `python manage.py test` (171 tests, about 25 seconds). In `frontend/`,
  run `npm test` (10 website tests).
