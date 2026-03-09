from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])


# POST /api/ai/chat – Budii AI chat (rule-based placeholder)
@router.post("/chat")
def ai_chat(body: dict, current_user: dict = Depends(get_current_user)):
    messages = body.get("messages")
    if not messages or not isinstance(messages, list) or len(messages) == 0:
        raise HTTPException(400, "messages array is required")

    last_message = (messages[-1].get("content") or "").lower()

    if "medication" in last_message or "medicine" in last_message:
        reply = "It's important to take your medication on time. Would you like me to set a reminder for you?"
    elif "help" in last_message or "emergency" in last_message:
        reply = "If you're in an emergency, please press the SOS button. I'm here to help with anything else you need."
    elif "lonely" in last_message or "alone" in last_message or "sad" in last_message:
        reply = "I'm sorry you're feeling that way. Remember, your caregivers and family are just a call away. Would you like me to connect you with someone?"
    elif "hello" in last_message or "hi" in last_message or "hey" in last_message:
        reply = "Hello there! How are you feeling today? I'm here to chat and help with anything you need."
    elif "thank" in last_message:
        reply = "You're welcome! I'm always here for you. Is there anything else I can help with?"
    elif "weather" in last_message:
        reply = "I'd love to help with the weather, but I don't have that capability yet. You could try looking out the window or asking your caregiver!"
    elif "food" in last_message or "eat" in last_message or "hungry" in last_message:
        reply = "Eating regular meals is important for your health. Would you like me to remind your caregiver about meal preparation?"
    elif "sleep" in last_message or "tired" in last_message:
        reply = "Getting good sleep is essential. Try to maintain a regular sleep schedule. Would you like me to set a bedtime reminder?"
    elif "exercise" in last_message or "walk" in last_message:
        reply = "Light exercise is great for your health! Even a short walk can make a big difference. Shall I set a reminder for your daily walk?"
    else:
        reply = "I understand. I'm here to support you throughout your day. Feel free to ask me about medications, reminders, or just chat!"

    return {"message": reply}
