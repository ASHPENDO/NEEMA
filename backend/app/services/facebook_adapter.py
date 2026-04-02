# app/services/facebook_adapter.py

class FacebookErrorType:
    ACCOUNT_RESTRICTED = "ACCOUNT_RESTRICTED"      # code 368
    TOKEN_INVALID = "TOKEN_INVALID"                # code 190
    ACCOUNT_VERIFICATION_REQUIRED = "ACCOUNT_VERIFICATION_REQUIRED"  # 🔥 NEW
    UNKNOWN = "UNKNOWN"


def classify_facebook_error(error: dict) -> str:
    """
    Classify Facebook API errors into actionable categories.
    """

    code = error.get("code")
    message = (error.get("message") or "").lower()

    # 🔥 1. Account restricted (policy / violation)
    if code == 368:
        return FacebookErrorType.ACCOUNT_RESTRICTED

    # 🔥 2. Token invalid / expired
    elif code == 190:
        return FacebookErrorType.TOKEN_INVALID

    # 🔥 3. Identity verification required (NEW — critical)
    elif "confirm your identity" in message:
        return FacebookErrorType.ACCOUNT_VERIFICATION_REQUIRED

    # 🔥 4. Fallback
    return FacebookErrorType.UNKNOWN