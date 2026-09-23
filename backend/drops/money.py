"""The money side of a drop, in one place so it's easy to check and change.

Sliding-scale prices (set on the admin Settings screen):
  - standard / pay-it-forward: $10.00
  - at cost:                   $7.50
  - free:                      $0.00 (covered by sponsored pools)

What a Community Manager owes Square Roots is the at-cost price for every bundle they sold at the
standard or at-cost price. So from a $10 bundle they keep $2.50, from a $7.50 bundle they keep
nothing, and free bundles cost them nothing. Donations stay with them ("surplus revenue retention").

At a brand-new location's very first drop, the first-drop price replaces the at-cost price (the first-drop
incentive). Locations only get this if they're marked for it (Site.first_drop_pricing).
"""

from decimal import Decimal

from .models import OperatingSettings, SiteDrop


def is_first_drop(site_drop):
    """True if this is a new location's first drop (the earliest one anyone ordered for).

    Only locations marked for first-drop pricing count, so locations that ran before the
    portal existed don't get the incentive again.
    """
    if not site_drop.site.first_drop_pricing:
        return False
    first = (
        SiteDrop.objects.filter(site_id=site_drop.site_id, order__isnull=False)
        .order_by("drop_date")
        .values_list("id", flat=True)
        .first()
    )
    return first == site_drop.id


def statement(site_drop, settings=None, first_drop=None):
    """What was collected at a drop, what's owed to Square Roots, and what the Community Manager keeps.

    Returns None if the drop hasn't been logged yet.
    """
    report = getattr(site_drop, "report", None)
    if report is None:
        return None
    settings = settings or OperatingSettings.current()
    first_drop = is_first_drop(site_drop) if first_drop is None else first_drop

    paid_bundles = report.bundles_standard + report.bundles_at_cost
    cost_per_bundle = settings.first_drop_cost if first_drop else settings.at_cost_price
    collected = report.bundles_standard * settings.standard_price + report.bundles_at_cost * settings.at_cost_price
    owed = paid_bundles * cost_per_bundle
    deliveries = sum(1 for p in site_drop.preorders.all() if p.delivery)

    return {
        "first_drop": first_drop,
        "cost_per_bundle": cost_per_bundle,
        "collected": collected,
        "owed_to_square_roots": owed,
        "donations": report.donations,
        "manager_keeps": collected - owed + report.donations,
        "delivery_fees": deliveries * settings.delivery_fee,
        "remittance_received_on": report.remittance_received_on,
    }


def for_json(values):
    """Amounts as "7.50"-style strings, like the rest of the API sends money."""
    return {key: f"{value:.2f}" if isinstance(value, Decimal) else value for key, value in values.items()}
