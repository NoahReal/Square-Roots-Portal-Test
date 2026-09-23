"""The emails customers get about their reservations, in English and French.

Each customer gets emails in the language they used on the Reserve page. To change the wording,
edit the TEXT below (keep the {names} in curly brackets). To add a language, add it to
Language in models.py, then add its words here and in frontend/src/i18n.js.

The French was written for this prototype; have a French speaker check it before real use.
"""

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

DAYS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
MONTHS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]


def say_date(day, lang):
    """ "Saturday, October 10" or "samedi 10 octobre"."""
    if lang == "fr":
        return f"{DAYS_FR[day.weekday()]} {day.day} {MONTHS_FR[day.month - 1]}"
    return f"{day:%A, %B} {day.day}"


def say_time(moment, lang):
    """ "11:00 a.m." or "11 h"."""
    if lang == "fr":
        return f"{moment.hour} h" + (f" {moment.minute:02d}" if moment.minute else "")
    hour = moment.hour % 12 or 12
    return f"{hour}:{moment.minute:02d} {'a.m.' if moment.hour < 12 else 'p.m.'}"


def say_moment(when, lang):
    """A date and time in Halifax time: "Tuesday, October 6 at 5:00 p.m." or "mardi 6 octobre à 17 h"."""
    local = timezone.localtime(when)
    return f"{say_date(local.date(), lang)} {'à' if lang == 'fr' else 'at'} {say_time(local, lang)}"


TEXT = {
    "en": {
        "hi": "Hi {name},",
        "signoff": "Square Roots",
        "bundles": lambda n: f"{n} bundle" if n == 1 else f"{n} bundles",
        "when_where": "When: {date}, {starts} to {ends}\nWhere: Square Roots {site}, {address}",
        "reserved_subject": "Your bundle is reserved",
        "updated_subject": "Your reservation was updated",
        "promoted_subject": "Good news: a bundle opened up for you",
        "standing_subject": "We've reserved your next bundle",
        "standing_intro": "You asked us to reserve at every drop, so here's your next one. To stop, use the link at the bottom.",
        "reserved": "You've reserved {bundles} of fresh Nova Scotia produce.",
        "to_pay": "To pay at the drop: ${amount}",
        "delivery": "We'll deliver to {address} with {partner}.",
        "code": "Show this code when you pick up: {code}",
        "change_until": "Need to change or cancel? You can until {cutoff}:\n{link}",
        "see_you": "See you there!",
        "waitlist_subject": "You're on the waitlist",
        "waitlist": "All the bundles set aside at {site} have been reserved, so you're on the waitlist for {bundles}.",
        "waitlist_next": "If a spot opens up before ordering closes, we'll reserve it for you and email you right away.",
        "leave_waitlist": "To leave the waitlist: {link}",
        "your_reservation": "Your reservation: {link}",
        "moved_subject": "Your Square Roots {site} drop has changed",
        "moved": "The {site} drop you reserved for has a new date or time:\n\n{details}\n\n"
        "Your reservation is still held. If the new time doesn't work, you can cancel it using the link below.",
        "cancelled_subject": "Your Square Roots {site} drop is cancelled",
        "cancelled": "We're sorry: the {site} drop on {date} is cancelled, so your reservation is cancelled too. "
        "You won't be charged.\n\nSee the next drops and reserve again at {reserve_link}",
        "message_subject": "A message about your Square Roots {site} drop",
    },
    "fr": {
        "hi": "Bonjour {name},",
        "signoff": "Square Roots",
        "bundles": lambda n: f"{n} panier" if n == 1 else f"{n} paniers",
        "when_where": "Quand : {date}, de {starts} à {ends}\nOù : Square Roots {site}, {address}",
        "reserved_subject": "Votre panier est réservé",
        "updated_subject": "Votre réservation a été modifiée",
        "promoted_subject": "Bonne nouvelle : un panier s'est libéré pour vous",
        "standing_subject": "Nous avons réservé votre prochain panier",
        "standing_intro": "Vous nous avez demandé de réserver à chaque distribution. Voici la prochaine. "
        "Pour arrêter, utilisez le lien plus bas.",
        "reserved": "Vous avez réservé {bundles} de produits frais de la Nouvelle-Écosse.",
        "to_pay": "À payer sur place : {amount} $",
        "delivery": "Nous livrerons au {address} avec {partner}.",
        "code": "Montrez ce code lors de la cueillette : {code}",
        "change_until": "Besoin de modifier ou d'annuler? C'est possible jusqu'au {cutoff} :\n{link}",
        "see_you": "À bientôt!",
        "waitlist_subject": "Vous êtes sur la liste d'attente",
        "waitlist": "Tous les paniers réservés à {site} sont pris, alors vous êtes sur la liste d'attente pour {bundles}.",
        "waitlist_next": "Si une place se libère avant la fin des commandes, nous la réserverons pour vous "
        "et vous écrirons tout de suite.",
        "leave_waitlist": "Pour quitter la liste d'attente : {link}",
        "your_reservation": "Votre réservation : {link}",
        "moved_subject": "Votre distribution Square Roots {site} a changé",
        "moved": "La distribution de {site} pour laquelle vous avez réservé a une nouvelle date ou heure :\n\n{details}\n\n"
        "Votre réservation est maintenue. Si le nouvel horaire ne vous convient pas, vous pouvez l'annuler avec le lien ci-dessous.",
        "cancelled_subject": "Votre distribution Square Roots {site} est annulée",
        "cancelled": "Nous sommes désolés : la distribution de {site} du {date} est annulée, alors votre réservation "
        "l'est aussi. Vous n'aurez rien à payer.\n\nVoyez les prochaines distributions et réservez de nouveau : {reserve_link}",
        "message_subject": "Un message au sujet de votre distribution Square Roots {site}",
    },
}


def words(person):
    return TEXT.get(getattr(person, "language", "en"), TEXT["en"])


def manage_link(token, site_url):
    return f"{site_url.rstrip('/')}/reserve/manage/{token}"


def drop_details(site_drop, lang):
    site = site_drop.site
    return TEXT[lang]["when_where"].format(
        date=say_date(site_drop.drop_date, lang), starts=say_time(site_drop.starts_at, lang),
        ends=say_time(site_drop.ends_at, lang), site=site.name, address=site.address,
    )


def send(person, subject, *paragraphs):
    """Emails one customer: a greeting, the paragraphs, and the sign-off. Customers without an email are skipped."""
    if not person.email:
        return False
    w = words(person)
    body = "\n\n".join([w["hi"].format(name=person.customer_name), *[p for p in paragraphs if p], w["signoff"]])
    send_mail(f"[Square Roots] {subject}", body, settings.DEFAULT_FROM_EMAIL, [person.email])
    return True


def confirmation(preorder, site_url, amount, kind="reserved"):
    """Sent when a reservation is made, changed, taken off the waitlist, or made from "reserve every drop"."""
    w = words(preorder)
    lang = preorder.language
    site = preorder.site_drop.site
    how = (
        w["delivery"].format(address=preorder.delivery_address, partner=site.delivery_partner)
        if preorder.delivery
        else w["code"].format(code=preorder.pickup_code)
    )
    money = f"{amount:.2f}".replace(".", ",") if lang == "fr" else f"{amount:.2f}"
    send(
        preorder,
        w[f"{kind}_subject"],
        w["standing_intro"] if kind == "standing" else "",
        w["reserved"].format(bundles=w["bundles"](preorder.bundles)),
        drop_details(preorder.site_drop, lang) + "\n" + w["to_pay"].format(amount=money),
        how,
        w["change_until"].format(
            cutoff=say_moment(preorder.site_drop.order_cutoff, lang), link=manage_link(preorder.manage_token, site_url)
        ),
        w["see_you"],
    )


def waitlist_joined(entry, site_url):
    w = words(entry)
    send(
        entry,
        w["waitlist_subject"],
        w["waitlist"].format(site=entry.site_drop.site.name, bundles=w["bundles"](entry.bundles)),
        drop_details(entry.site_drop, entry.language),
        w["waitlist_next"] + "\n" + w["leave_waitlist"].format(link=manage_link(entry.manage_token, site_url)),
    )


def notice(person, site_url, subject_key, message_key=None, message=None, **values):
    """A notice about a drop (moved, cancelled, or a message from the Community Manager), with the reservation link."""
    w = words(person)
    link = w["your_reservation"].format(link=manage_link(person.manage_token, site_url)) if person.manage_token else ""
    return send(person, w[subject_key].format(**values), message or w[message_key].format(**values), link)
