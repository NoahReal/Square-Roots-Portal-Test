# How ordering works: the model to check with Square Roots

This describes how the partner portal handles Square Roots' weekly ordering by the box. All six
phases are built (see [ORDERING-GUIDE.md](ORDERING-GUIDE.md) for how to use it); the guesses and
questions below still need the team's answers.
It describes what the portal will keep track of, using Square Roots' own words where possible.
**Please check it with the team before anything more is built.** Anything marked *(guess)* is
something we assumed.

## The weekly rhythm (what the team described)

The operation runs on a two-week cycle.

| Day | What happens |
|---|---|
| Friday | Ketty Brow's and Footes send their price lists (what's available, price per box). The director of operations builds the **Cape Breton** order form and sends it out. |
| Monday | The **Halifax** and **Halifax North** order forms go out (they're identical). Cape Breton orders are due. |
| Tuesday | Halifax and Halifax North orders are due. The team collects every order, then emails the farms (to confirm they can fill it) and the transport companies (to confirm they can deliver). |
| Wednesday | Cape Breton trucks deliver. |
| Friday | Halifax and Halifax North trucks deliver. |
| The day after delivery | Locations usually hold their market (each decides). |

## What the portal keeps track of

**Routes.** Cape Breton, Halifax (through the centre) and Halifax North (north of Halifax and
Truro). Each has the day its form goes out, the day orders are due, the day trucks deliver, and the
suppliers it buys from. Halifax North uses the same order form as Halifax.
*Built: see Routes in the admin menu.*

**Suppliers.** Ketty Brow's Wholesale Limited (a wholesaler) and Footes Family Farm (a farm).
A wholesaler is only told *what goes where*: how much goes to each drop-off point. A farm gets the
full, detailed orders. *Built.*

**Drop-off points.** Where a truck leaves produce. Usually a location's own market. A **hub** takes
deliveries for several locations and helps sort them: the Fairview hub does this for five places
and gets 10% of what's bought from Ketty Brow's. *Built, with guesses (below).*

**Locations.** Each belongs to one route and one drop-off point. *Built: set on the
Locations screen.*

**Price lists** *(built).* Each supplier's list for the week: product, box size, price per box,
how many are available. The portal shows what changed since last week.

**Order forms** *(built).* One per route per cycle: the items chosen from the price lists, with
good deals marked. Replaces the spreadsheet with a tab per location.

**Location orders** *(built).* How many boxes of each item a location wants, with the total boxes
and cost worked out. Replaces typing into the highlighted cells.

**Supplier orders and transport runs** *(built).* Made from the location orders when ordering
closes: Ketty Brow's gets totals per drop-off point; farms get the detail; each route's trucks get
their stops. Each is confirmed from a link. Replaces screenshots and confirmation emails.

## Our guesses (please correct)

| Guess | Where to fix it |
|---|---|
| Halifax route: Fairview / Clayton Park, Halifax South End, Halifax North End, Dartmouth, East Dartmouth, Cole Harbour, Upper Tantallon | Locations screen |
| Halifax North route: Lower Sackville, Windsor, Middle Musquodoboit, New Glasgow | Locations screen |
| Cape Breton route: no locations yet. Iona is one, but it isn't in the website's list, so we need its details. | Locations screen (add it) |
| The Fairview hub serves the South End, North End, Dartmouth, East Dartmouth and Cole Harbour (you named the first two) | Locations screen |
| Cape Breton buys only from Ketty Brow's | Django admin for now (Routes shows it) |
| The Fairview hub's 10% is worked out from Ketty Brow's orders for the locations it serves, not its own | `hub_share` in backend/ordering/logic.py |

## Questions for the team

1. **Cape Breton's supplier.** The notes say Cape Breton only orders from Ketty Brow's, and also that it uses Footes. Which is it?
2. **The Fairview hub's 10%.** 10% of Ketty Brow's orders for the five places it serves, or all of them? A discount on the bill, or a payment to Fairview? Which five places?
3. **Boxes and bundles.** Do markets still sell 10 lb bundles at $10, $7.50 or free, made up from the boxes they order?
4. **The cycle.** What does "the first 4 days of each week are a break" mean in a two-week cycle? Does the cycle start on a Friday?
5. **Deadlines.** What time are orders due on Monday (Cape Breton) and Tuesday (Halifax)?
6. **Cape Breton locations.** Which locations are on the Cape Breton route, and their addresses?
7. **Transport.** Which companies drive each route, and who confirms for them?
8. **A real order form and price list.** A copy of each (with any personal details removed) is the most useful thing of all for Phase 1.

## What stays the same

Logins and roles, the customer side (reserving, pickup codes, reminders), money statements,
impact, privacy and hosting all carry over. The current "order a number of bundles" screen keeps
working until a route switches to order forms, so nothing breaks while this is built.
