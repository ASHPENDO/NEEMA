# app/services/facebook_adapter.py

class FacebookErrorType:
    ACCOUNT_RESTRICTED = "ACCOUNT_RESTRICTED"
    TOKEN_INVALID = "TOKEN_INVALID"
    UNKNOWN = "UNKNOWN"


def classify_facebook_error(error: dict) -> str:
    code = error.get("code")

    if code == 368:
        return FacebookErrorType.ACCOUNT_RESTRICTED
    elif code == 190:
        return FacebookErrorType.TOKEN_INVALID
    return FacebookErrorType.UNKNOWN