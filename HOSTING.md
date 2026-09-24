# Hosting the Square Roots website

How to put the website and partner portal online. The site is **not** hosted yet; this is the plan
for whenever Square Roots decides to go ahead. It's written for whoever looks after the site, which
might be a student who hasn't done this before.

When it's hosted, one Django server does everything: it serves the website pages, the API, and the
photos and code the pages need. There's no separate server for the React part.

---

## What you need

- **A host that runs Python and keeps files between restarts.** The database is one file
  (`backend/db.sqlite3`), so the host needs a *persistent disk*. Common choices are a small Linux
  server (a "VPS", from about $6 a month) or a Python host such as PythonAnywhere, Render or Railway
  with a disk added (about $5 to $25 a month). Check the host's data centre is in Canada if Square
  Roots wants personal data kept in Canada.
- **The domain** (e.g. squarerootssmu.ca), and access to its DNS settings.
- **An email service** for sending emails (see step 6).
- About two hours the first time.

---

## 1. Get the code onto the server

```bash
git clone <the repository address> square-roots
cd square-roots
```

## 2. Install the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Build the website

This needs Node.js (version 20 or newer) on the server, or build on your own computer and copy
`frontend/dist/` up.

```bash
cd ../frontend
npm install
npm run build        # makes frontend/dist/
```

## 4. Set the environment variables

Set these in your host's dashboard ("environment variables" or "secrets"), or in the service file
on a VPS. **Never put them in git.**

| Variable | What to put | Example |
|---|---|---|
| `DJANGO_DEBUG` | `0` (production mode) | `0` |
| `DJANGO_SECRET_KEY` | A long random secret. Make one with the command below. | |
| `DJANGO_ALLOWED_HOSTS` | The site's addresses, separated by commas | `squarerootssmu.ca,www.squarerootssmu.ca` |
| `DEMO_MODE` | `0`, so no demo accounts or "Demo" banner | `0` |
| `DATABASE_PATH` | The database file name, inside `backend/` | `squareroots.sqlite3` |
| `EMAIL_HOST` | Your email service's SMTP server (step 6) | `smtp.postmarkapp.com` |
| `EMAIL_PORT` | Usually `587` | `587` |
| `EMAIL_USER`, `EMAIL_PASSWORD` | From your email service | |
| `EMAIL_FROM` | Who emails come from | `Square Roots <hello@squarerootssmu.ca>` |

Make a secret key:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

If the host doesn't handle HTTPS in front of Django (most do), set `DJANGO_SSL_REDIRECT=0` only
while testing, never for real use.

## 5. Set up the database

```bash
cd backend
source .venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser        # the first admin account
```

Then load Square Roots' real data if it's ready (see *Loading Square Roots' real data* in
README.md). **Don't run `manage.py seed` on the real site**: it deletes everything and loads demo data.

The first admin logs in at `/portal/login`, and should turn on **two-step login** on My Account.

## 6. Set up email

Emails (reservation confirmations, reminders, password resets) need a sending service. Good options
for a small organization: **Postmark**, **Mailgun**, **Amazon SES** or **Brevo**. Most have a free
or very cheap tier at Square Roots' size.

1. Sign up and add the domain you'll send from.
2. The service gives you a few **DNS records** (SPF and DKIM). Add them in the domain's DNS settings.
   Without them, emails land in spam.
3. Put the SMTP details in the environment variables from step 4.
4. Test it: reserve a bundle on the live site with your own email.

## 7. Start the website

```bash
gunicorn config.wsgi --bind 0.0.0.0:8000 --workers 3
```

Most hosts ask for this as the "start command". On a VPS, run it as a service (systemd) behind
Nginx or Caddy, which also get the HTTPS certificate for you. Caddy is the simplest: two lines
in its config file do both.

## 8. Point the domain at it

In the domain's DNS settings, point the domain at the host (the host tells you the exact records).
Once HTTPS works, check the site at `https://your-domain/`, then run:

```bash
python manage.py check --deploy
```

It should only mention `SECURE_HSTS_INCLUDE_SUBDOMAINS` and `SECURE_HSTS_PRELOAD`. Leave those off
unless every subdomain of the domain is also HTTPS.

## 9. Scheduled jobs

Three commands need to run on a schedule. On a VPS, add them with `crontab -e` (change the paths
and address to yours). Hosting dashboards usually have a "cron jobs" or "scheduled tasks" page.

```
# Reminders and "How was your bundle?" emails: every hour
0 * * * *  cd /home/squareroots/square-roots/backend && .venv/bin/python manage.py send_reminders --site-url https://squarerootssmu.ca
# Remove customers' details 60 days after their drop (the Privacy page promises this): every night
30 2 * * * cd /home/squareroots/square-roots/backend && .venv/bin/python manage.py forget_old_details
# Back up the database: every night
0 3 * * *  cd /home/squareroots/square-roots/backend && .venv/bin/python manage.py backup_database
```

The environment variables from step 4 must be set for these too.

## 10. Backups

`backup_database` keeps two weeks of nightly copies in `backend/backups/`. That protects against
mistakes, but **not** against losing the server. Once a week or so, copy that folder somewhere else
(Square Roots' Google Drive or OneDrive, for example). Some hosts can also back up the whole disk.

To restore: stop the site, copy a backup over the database file, and start it again.

## 11. Updating the site later

```bash
git pull
cd frontend && npm install && npm run build
cd ../backend && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
```

Then restart the website (the host's "restart" button, or `sudo systemctl restart squareroots`).
Run `python manage.py backup_database` first, in case something goes wrong.

---

## Before real people use it

- [ ] `DEMO_MODE=0`, and no demo accounts in the real database
- [ ] Square Roots has reviewed the **Privacy** page, ideally with advice
- [ ] A French speaker has checked the French (`frontend/src/i18n.jsx`, `backend/drops/customer_emails.py`)
- [ ] Prices, the first-drop price and delivery fee are right on the admin **Settings** screen
- [ ] Emails arrive in an inbox (not spam), with working links
- [ ] Scheduled jobs are running (check the log the next morning)
- [ ] Admins have two-step login turned on
- [ ] A backup has been restored once, to check it works
- [ ] Someone is named as responsible for the site this year

## If it gets busy

SQLite handles a site of Square Roots' size comfortably. If it ever gets much busier (hundreds of
people reserving in the same few minutes), move to PostgreSQL. That needs one more package
(`psycopg`) and a change to `DATABASES` in `backend/config/settings.py`.
