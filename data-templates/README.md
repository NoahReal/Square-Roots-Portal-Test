# Filling in your data for the Square Roots partner portal

These spreadsheets load Square Roots' real information into the partner portal. You don't need to
fill in all of them: send whichever ones you have, and we'll load those.

**How to fill them in**

1. Open each `.csv` file in Excel, Google Sheets or Numbers.
2. Keep the first row (the column names) as it is.
3. Replace the example rows with your own. Example rows start with `EXAMPLE`; any you leave in are
   skipped automatically.
4. Save or download as **CSV** (in Google Sheets: File → Download → Comma-separated values).
5. Send the files back. Please don't post them anywhere public, because they include people's
   contact details.

**Writing dates, times and money**

- Dates: `2026-10-10` or `October 10, 2026`
- Times: `17:00` or `5:00 pm`
- Money: `7.50` (a `$` is fine too)
- Yes/no columns: `yes` or `no`

If something can't be read, we'll send back a list like *"people.csv, row 4: There's no location
called Lower Sackvile. Did you mean Lower Sackville?"* so it's quick to fix.

---

## settings.csv: prices and where produce is sorted

One row only.

| Column | What to put |
|---|---|
| standard_price | Standard / pay-it-forward price per 10 lb bundle (we have **10.00**) |
| at_cost_price | At-cost price (we have **7.50**). This is also what a Community Manager pays Square Roots for each paid bundle. |
| first_drop_cost | What a **brand-new** location pays per paid bundle at its very first drop. **We don't know this yet; please fill it in.** |
| delivery_fee | Home delivery fee (we have **1.99**) |
| staging_location | Where farm produce is dropped off and packed into bundles |

## locations.csv: Square Roots locations

**We've filled this in from your website.** Please check it and correct anything that's out of date.

| Column | What to put |
|---|---|
| name | The location's name, e.g. `Lower Sackville` |
| address | Street address |
| instagram_url, facebook_url | Full links, or leave blank |
| delivery_partner | Who does home delivery there (e.g. `BayRides`), or blank if there's no delivery |
| first_drop_pricing | `yes` only for a brand-new location whose first drop hasn't happened yet |
| highlight | A short line for the website, or blank |
| active | `no` to hide a location that has closed |

## farms.csv: partner farms

| Column | What to put |
|---|---|
| name | Farm name |
| location | Town or county |
| pickup_notes | How pickup works, e.g. "Load from the cold storage barn" |

## people.csv: everyone who'll log in

Community Managers, farm contacts, host sites and the student team.

| Column | What to put |
|---|---|
| first_name, last_name | Their name |
| email | Their email. **Each person needs a different email**; it's how they get their login. |
| phone | Optional |
| role | `Community Manager`, `Farm`, `Host Site` or `Admin` (the student team) |
| location | For Community Managers and Host Sites: which location, exactly as in locations.csv |
| farm | For farm contacts: which farm, exactly as in farms.csv |
| username | Optional. If blank, we make one from their email. |

Nobody is given a shared password. Each person gets an email with a link to choose their own.

## drop_dates.csv: upcoming drops

| Column | What to put |
|---|---|
| drop_date | The drop day |
| cutoff_date, cutoff_time | When ordering closes. If blank, it's the Tuesday before at 5 pm. |
| starts_at, ends_at | Drop hours, e.g. `11:00 am` and `1:00 pm` |
| locations | `all`, or the locations taking part, separated by `;` |

## past_drops.csv: how past drops went (optional)

One row per location per drop. This fills the Impact and Money screens with your real history.

| Column | What to put |
|---|---|
| drop_date, location | Which drop |
| bundles_ordered | How many bundles the location ordered |
| bundles_standard, bundles_at_cost, bundles_free | How many sold at each price |
| bundles_left_over | How many weren't sold |
| leftovers_went_to | `donated`, `kept`, `composted`, `other`, or blank |
| donations | Donations collected, in dollars |
| payment_received_on | When the Community Manager paid Square Roots for this drop, or blank if not yet |
| notes | Optional |

## farm_purchases.csv: what was bought from farms (optional)

One row per kind of produce per farm per drop. This is where "pounds diverted from waste" comes from.

| Column | What to put |
|---|---|
| drop_date | Which drop it was for |
| farm | Farm name, exactly as in farms.csv |
| produce | e.g. `Carrots` |
| pounds | How many pounds |
| price_per_pound | e.g. `0.35` |
| paid | `yes` if the farm has been paid |

---

## For whoever loads the data

1. Put the filled-in files in a folder called `real-data` at the top of the project. That folder is
   ignored by git, so personal details can't end up on GitHub.
2. Use a separate database for real data, and turn demo mode off:

   ```bash
   cd backend
   source .venv/bin/activate
   export DATABASE_PATH=real.sqlite3 DEMO_MODE=0
   python manage.py migrate
   python manage.py import_data ../real-data            # checks everything, changes nothing
   python manage.py import_data ../real-data --apply    # loads it (all or nothing)
   python manage.py import_data ../real-data --apply --invite --site-url http://localhost:5173
   python manage.py runserver
   ```

   `--invite` emails each new person a "choose your password" link. Emails are still only printed in
   the terminal, so for real use, set up real email first (see `MAILERS` in `backend/config/settings.py`).
3. Running the import again with updated files updates what's there, without making duplicates.
4. To go back to the demo, open a new terminal (or `unset DATABASE_PATH DEMO_MODE`) and run the
   server as usual.
