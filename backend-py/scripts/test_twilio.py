#!/usr/bin/env python3
"""
Test Twilio SMS and voice call notifications.
Sends 3 SMS messages and 1 call to a specified phone number.

Usage:
    python test_twilio.py +94763911998
    python test_twilio.py +18392102874
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from datetime import datetime
from twilio.base.exceptions import TwilioException
from twilio.rest import Client
from app.config import get_settings


def normalize_phone(number: str) -> str:
    """Normalize phone number to international format."""
    raw = str(number).strip()
    raw = ''.join(c for c in raw if c.isdigit() or c == '+')
    
    if raw.startswith("00"):
        raw = f"+{raw[2:]}"
    elif raw and not raw.startswith("+"):
        raw = f"+{raw}"
    
    return raw


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_twilio.py <phone_number>")
        print("Example: python test_twilio.py +94763911998")
        sys.exit(1)
    
    to_number = normalize_phone(sys.argv[1])
    print(f"[TEST] Normalized number: {to_number}")
    
    # Load settings
    settings = get_settings()
    
    if not settings.twilio_account_sid or not settings.twilio_from_number:
        print("[ERROR] Twilio not configured. Check TWILIO_ACCOUNT_SID and TWILIO_FROM_NUMBER in .env")
        sys.exit(1)
    
    # Build client
    if settings.twilio_auth_token:
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        print("[INFO] Using Twilio auth token authentication")
    elif hasattr(settings, 'twilio_api_key_sid') and getattr(settings, 'twilio_api_key_sid'):
        api_key_sid = getattr(settings, 'twilio_api_key_sid')
        api_key_secret = getattr(settings, 'twilio_api_key_secret', '')
        client = Client(api_key_sid, api_key_secret, settings.twilio_account_sid)
        print("[INFO] Using Twilio API key authentication")
    else:
        print("[ERROR] No Twilio auth configured")
        sys.exit(1)
    
    from_number = settings.twilio_from_number
    print(f"[INFO] From: {from_number}")
    print(f"[INFO] To: {to_number}")
    print()
    
    # Send 3 SMS
    print("[SMS] Sending 3 messages...")
    sms_messages = [
        f"[AISLA Test 1/3] Emergency alert system test. Sent at {datetime.now().strftime('%H:%M:%S')}",
        f"[AISLA Test 2/3] Patient monitoring system online. Twilio integration verified.",
        f"[AISLA Test 3/3] All systems nominal. Contact caregivers if needed.",
    ]
    
    sms_sent = 0
    for i, body in enumerate(sms_messages, 1):
        try:
            msg = client.messages.create(
                body=body,
                from_=from_number,
                to=to_number,
            )
            sms_sent += 1
            print(f"  [{i}/3] ✓ SMS sent (SID: {msg.sid})")
        except TwilioException as exc:
            print(f"  [{i}/3] ✗ SMS failed: {exc}")
        except Exception as exc:
            print(f"  [{i}/3] ✗ Unexpected error: {exc}")
    
    print(f"\n[SMS] Sent {sms_sent}/{len(sms_messages)} messages successfully")
    print()
    
    # Make 1 call
    print("[CALL] Initiating voice call...")
    call_text = "This is an emergency alert test from the AISLA care system. Please acknowledge receipt. Thank you."
    twiml = f"<Response><Say>{call_text}</Say></Response>"
    
    try:
        call = client.calls.create(
            from_=from_number,
            to=to_number,
            twiml=twiml,
        )
        print(f"  ✓ Call initiated (SID: {call.sid})")
        print(f"[CALL] Call in progress...")
    except TwilioException as exc:
        print(f"  ✗ Call failed: {exc}")
    except Exception as exc:
        print(f"  ✗ Unexpected error: {exc}")
    
    print()
    print("[SUMMARY]")
    print(f"  SMS Messages: {sms_sent}/3")
    print(f"  Voice Calls: 1 initiated")
    print()
    print("[INFO] Check Twilio Console for delivery status and call recordings.")


if __name__ == "__main__":
    main()
