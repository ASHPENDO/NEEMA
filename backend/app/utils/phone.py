import re

# Safaricom Kenya prefixes (07XX series that support M-Pesa)
# 070, 071, 072, 074, 075, 076, 079, 011x
_SAFARICOM_PREFIXES = re.compile(r"^2547[0-9]|^25411[0-9]")


def normalize_ke_phone(phone: str) -> str:
    """
    Normalize Kenyan phone numbers to 254XXXXXXXXX format.
    Only accepts Safaricom numbers (required for M-Pesa STK push).

    Accepted input formats:
        0712345678   → 254712345678
        712345678    → 254712345678
        +254712345678 → 254712345678
        254712345678 → 254712345678

    Raises ValueError for:
        - Empty input
        - Non-digit characters that aren't a leading +
        - Wrong length
        - Non-Safaricom prefixes
    """

    if not phone or not phone.strip():
        raise ValueError("Phone number is required")

    # strip whitespace before processing
    phone = phone.strip()

    # strip leading + only — then allow only digits
    if phone.startswith("+"):
        phone = phone[1:]

    # reject anything with non-digit characters remaining
    if not phone.isdigit():
        raise ValueError(f"Phone number contains invalid characters: {phone!r}")

    # normalize to 254XXXXXXXXX
    if phone.startswith("0") and len(phone) == 10:
        # 07XXXXXXXX → 2547XXXXXXXX
        phone = "254" + phone[1:]
    elif len(phone) == 9:
        # 7XXXXXXXX → 2547XXXXXXXX
        phone = "254" + phone
    elif len(phone) == 12 and phone.startswith("254"):
        # already normalized
        pass
    else:
        raise ValueError(
            f"Invalid Kenyan phone number format: {phone!r} "
            f"(expected 07XXXXXXXX, 7XXXXXXXX, or 254XXXXXXXXX)"
        )

    # final length sanity check
    if len(phone) != 12:
        raise ValueError(f"Invalid phone number length after normalization: {phone!r}")

    # enforce Safaricom-only (M-Pesa requirement)
    if not _SAFARICOM_PREFIXES.match(phone):
        raise ValueError(
            f"Phone number {phone!r} is not a Safaricom number. "
            f"M-Pesa STK push requires a Safaricom line (07XX / 011X)."
        )

    return phone