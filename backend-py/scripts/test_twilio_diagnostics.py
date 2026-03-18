#!/usr/bin/env python3
"""
Twilio Account Diagnostics - Check account status, balance, and settings.

Usage:
    python test_twilio_diagnostics.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from twilio.rest import Client
from app.config import get_settings


def main():
    settings = get_settings()
    
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        print("[ERROR] Twilio credentials not configured in .env")
        print("Required: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN")
        sys.exit(1)
    
    print("[INFO] Connecting to Twilio...")
    try:
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    except Exception as e:
        print(f"[ERROR] Failed to create Twilio client: {e}")
        sys.exit(1)
    
    # Get account info
    print("\n" + "="*70)
    print("TWILIO ACCOUNT INFORMATION")
    print("="*70)
    
    try:
        account = client.api.accounts(settings.twilio_account_sid).fetch()
        print(f"Account SID: {account.sid}")
        print(f"Status: {account.status}")
        print(f"Account Type: {account.type}")
        print(f"Friendly Name: {account.friendly_name}")
        print(f"Date Created: {account.date_created}")
        print(f"Date Updated: {account.date_updated}")
    except Exception as e:
        print(f"[ERROR] Failed to fetch account info: {e}")
    
    # Get phone numbers
    print("\n" + "="*70)
    print("VERIFIED PHONE NUMBERS (can receive calls/SMS)")
    print("="*70)
    
    try:
        incoming_phone_numbers = client.incoming_phone_numbers.stream(limit=20)
        phone_list = list(incoming_phone_numbers)
        
        if not phone_list:
            print("[WARNING] No incoming phone numbers found!")
            print("To send SMS/calls, you need at least one verified number.")
        else:
            for i, number in enumerate(phone_list, 1):
                print(f"\n  [{i}] {number.phone_number}")
                print(f"      Friendly Name: {number.friendly_name}")
                print(f"      SMS Enabled: {number.sms_enabled if hasattr(number, 'sms_enabled') else 'Unknown'}")
                print(f"      Voice Enabled: {number.voice_enabled if hasattr(number, 'voice_enabled') else 'Unknown'}")
    except Exception as e:
        print(f"[ERROR] Failed to fetch phone numbers: {e}")
    
    # Get "From" number status
    print("\n" + "="*70)
    print("CONFIGURED FROM NUMBER")
    print("="*70)
    print(f"From Number: {settings.twilio_from_number}")
    print(f"Status: {'✓ Set' if settings.twilio_from_number else '✗ Not configured'}")
    
    if settings.twilio_from_number:
        try:
            # Try to find it in the list
            for number in phone_list:
                if number.phone_number == settings.twilio_from_number:
                    print(f"Status: ✓ Found in account")
                    break
            else:
                print(f"Status: ✗ NOT FOUND - This number may not be verified in your account!")
        except Exception as e:
            print(f"[WARNING] Could not verify number: {e}")
    
    # Check trial account
    print("\n" + "="*70)
    print("TRIAL ACCOUNT STATUS")
    print("="*70)
    
    try:
        # Trial accounts have specific restrictions
        if account.status == "suspended":
            print("[ERROR] Your account is SUSPENDED!")
            print("Action needed: Check Twilio console for violation details")
        elif account.status == "closed":
            print("[ERROR] Your account is CLOSED!")
        else:
            print(f"Account Status: {account.status}")
            print("\n[INFO] Trial account restrictions:")
            print("  • Can only send to verified phone numbers")
            print("  • Destination numbers must be verified in Twilio Console")
            print("  • SMS and Calls have limited throughput")
            print("  • Some features may be disabled")
    except Exception as e:
        print(f"[WARNING] Could not determine trial status: {e}")
    
    # Check recent messages
    print("\n" + "="*70)
    print("RECENT MESSAGES (last 5)")
    print("="*70)
    
    try:
        messages = client.messages.stream(limit=5)
        msg_list = list(messages)
        
        if not msg_list:
            print("[INFO] No messages sent yet")
        else:
            for i, msg in enumerate(msg_list, 1):
                status_icon = "✓" if msg.status in ["sent", "delivered"] else "✗" if msg.status in ["failed", "undelivered"] else "⏳"
                print(f"\n  [{i}] {status_icon} {msg.status.upper()}")
                print(f"      To: {msg.to}")
                print(f"      From: {msg.from_}")
                print(f"      SID: {msg.sid}")
                print(f"      Date: {msg.date_sent}")
                if msg.error_code:
                    print(f"      Error: ({msg.error_code}) {msg.error_message}")
    except Exception as e:
        print(f"[WARNING] Could not fetch messages: {e}")
    
    # Check recent calls
    print("\n" + "="*70)
    print("RECENT CALLS (last 5)")
    print("="*70)
    
    try:
        calls = client.calls.stream(limit=5)
        call_list = list(calls)
        
        if not call_list:
            print("[INFO] No calls made yet")
        else:
            for i, call in enumerate(call_list, 1):
                status_icon = "✓" if call.status in ["completed"] else "✗" if call.status in ["failed", "no-answer"] else "⏳"
                print(f"\n  [{i}] {status_icon} {call.status.upper()}")
                print(f"      To: {call.to}")
                print(f"      From: {call.from_}")
                print(f"      SID: {call.sid}")
                print(f"      Duration: {call.duration}s")
                print(f"      Date: {call.date_created}")
    except Exception as e:
        print(f"[WARNING] Could not fetch calls: {e}")
    
    print("\n" + "="*70)
    print("TROUBLESHOOTING TIPS")
    print("="*70)
    print("""
1. VERIFY YOUR PHONE NUMBER in Twilio Console:
   - Go to https://console.twilio.com
   - Phone Numbers > Verified Caller IDs
   - Add your destination number (+94763911998)
   - Complete the verification (you'll get a call or SMS)

2. CHECK SMS/VOICE LOGS in Twilio Console:
   - Monitor > Message Logs (for SMS)
   - Monitor > Call Logs (for calls)
   - Look for your test messages/calls and see the status

3. IF USING A TRIAL ACCOUNT:
   - Only verified numbers can receive messages
   - Check if your account has credits
   - Verify the "From" number is in your verified numbers list

4. TRY UPGRADING ACCOUNT:
   - Trial accounts have many restrictions
   - Upgrade to production account for full features

5. VERIFY CREDENTIALS:
   - Double-check your SID and Auth Token
   - Try the alternative credentials if you have them
    """)
    
    print("\n" + "="*70)
    print("NEXT STEPS")
    print("="*70)
    print("""
1. Verify your destination phone number in Twilio Console
2. Check the Message/Call logs to see what's happening
3. If it's a trial account, upgrade or verify all numbers
4. Re-run this script after making changes to confirm status
    """)


if __name__ == "__main__":
    main()
