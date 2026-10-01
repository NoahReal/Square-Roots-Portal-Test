"""Reading price lists, and what changed since the last one.

Suppliers send their lists as spreadsheets. Rather than needing a package to open Excel files,
the team copies the rows straight out of Excel or Google Sheets and pastes them in (that pastes as
tab-separated text), or uploads a CSV. Either way, read_rows() turns it into items.
"""

import csv
import io
from decimal import Decimal, InvalidOperation

# Header words we recognise for each column (lower case). They're checked in this order, so
# "Price per box" counts as the price and "Boxes available" as the number available.
COLUMNS = {
    "price": ["price", "cost", "$"],
    "available": ["available", "qty", "quantity", "boxes", "stock", "avail"],
    "product": ["product", "item", "produce", "description", "name"],
    "box_size": ["box", "size", "unit", "pack", "case"],
    "notes": ["note", "comment"],
}
# Without a header row, columns are read in this order.
DEFAULT_ORDER = ["product", "box_size", "price", "available", "notes"]


def money(text):
    cleaned = (text or "").replace("$", "").replace(",", "").strip()
    return Decimal(cleaned).quantize(Decimal("0.01"))


def whole_number(text):
    cleaned = (text or "").replace(",", "").strip()
    return int(Decimal(cleaned)) if cleaned else None


def column_map(header):
    """Which column holds which field, if `header` looks like a header row; otherwise None."""
    found = {}
    for index, cell in enumerate(header):
        cell = cell.strip().lower()
        for field, words in COLUMNS.items():
            if field not in found and any(word in cell for word in words):
                found[field] = index
                break
    return found if "product" in found and "price" in found else None


def read_rows(text):
    """Turns pasted rows or CSV text into (items, problems).

    Each item is {product, box_size, price, available, notes}. Each problem says which row and why,
    in plain words. Rows with nothing in them are skipped.
    """
    text = (text or "").strip()
    if not text:
        return [], ["Paste the price list, or choose a CSV file."]
    delimiter = "\t" if "\t" in text.splitlines()[0] else ","
    rows = [row for row in csv.reader(io.StringIO(text), delimiter=delimiter) if any(cell.strip() for cell in row)]

    columns = column_map(rows[0]) if rows else None
    first_data_row = 2 if columns else 1
    if columns is None:
        columns = {field: index for index, field in enumerate(DEFAULT_ORDER)}
    else:
        rows = rows[1:]

    def cell(row, field):
        index = columns.get(field)
        return row[index].strip() if index is not None and index < len(row) else ""

    items, problems = [], []
    for number, row in enumerate(rows, start=first_data_row):
        product = cell(row, "product")
        if not product:
            problems.append(f"Row {number}: there's no product name.")
            continue
        try:
            price = money(cell(row, "price"))
        except InvalidOperation:
            problems.append(f"Row {number} ({product}): “{cell(row, 'price')}” isn't a price. Use a number like 22.50.")
            continue
        try:
            available = whole_number(cell(row, "available"))
        except InvalidOperation:
            problems.append(f"Row {number} ({product}): “{cell(row, 'available')}” isn't a number of boxes.")
            continue
        items.append(
            {
                "product": product[:120],
                "box_size": cell(row, "box_size")[:60],
                "price": price,
                "available": available,
                "notes": cell(row, "notes")[:200],
            }
        )
    if not items and not problems:
        problems.append("We couldn't find any rows with a product and a price.")
    return items, problems


def key(product):
    return " ".join(product.lower().split())


def changes(items, previous_items):
    """What changed since the supplier's last list: each item gets a "change" and the old price,
    and items that have gone are listed separately."""
    before = {key(item.product): item for item in previous_items}
    now = []
    for item in items:
        old = before.pop(key(item.product), None)
        if old is None:
            change = "new" if previous_items else ""
        elif item.price > old.price:
            change = "up"
        elif item.price < old.price:
            change = "down"
        else:
            change = "same"
        now.append((item, change, old.price if old else None))
    gone = sorted(before.values(), key=lambda i: i.product)
    return now, gone
