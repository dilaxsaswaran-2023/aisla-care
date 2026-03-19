import logging
from openai import AzureOpenAI
from app.config import get_settings

logger = logging.getLogger("sos.priority")


def get_azure_client():
    settings = get_settings()
    return AzureOpenAI(
        api_version=settings.azure_openai_api_version,
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
    )


def get_sos_priority(transcription: str) -> str:
    if not transcription or not transcription.strip():
        return "high"

    settings = get_settings()
    deployment = settings.azure_openai_gpt5_nano_deployment

    try:
        client = get_azure_client()

        response = client.chat.completions.create(
    messages=[
        {
            "role": "system",
            "content": """
You are classifying an elderly patient's SOS voice message for an emergency care system.

Return exactly one lowercase word only:
low
medium
high

Safety rule:
When unsure, choose the HIGHER severity.
This is a safety-critical elderly care context, so avoid false negatives.

Classify as:
low: non-urgent request, general question, casual assistance, no sign of distress or danger
medium: mild discomfort, dizziness, confusion, weakness, feeling unwell, needs help soon but no clear immediate danger
high: any possible emergency, immediate danger, fall, cannot get up, severe pain, chest pain, breathing trouble, fainting, bleeding, severe distress, calling for urgent help, repeated panic wording, or unclear message that may indicate danger

Important rules:
If the patient says they fell, might have fallen, slipped, cannot stand, or cannot get up -> high
If the patient sounds distressed, afraid, panicked, or asks for urgent help -> high
If there is chest pain, breathing difficulty, severe weakness, stroke-like symptoms, or loss of consciousness -> high
If the message is incomplete, hard to understand, or ambiguous but could indicate danger -> high
Polite wording does not reduce severity
Only clear, harmless, non-urgent requests should be low

Examples:
"What should I eat?" -> low
"Can you remind me about my medicine?" -> low
"I feel dizzy" -> medium
"I feel weak and not well" -> medium
"I need help, I fell" -> high
"I cannot get up" -> high
"My chest hurts" -> high
"I can't breathe properly" -> high
"Help me please" -> high
"I don't know what's happening" -> high
""".strip(),
        },
        {
            "role": "user",
            "content": f'Classify this SOS voice message:\n"""{transcription}"""',
        },
    ],
    max_completion_tokens=200,
    model=deployment,
)

        result = (response.choices[0].message.content or "").strip().lower()
        logger.info(f"[SOS_PRIORITY] Azure OpenAI response='{result}'") 
        if result not in {"low", "medium", "high"}:
            logger.warning(f"[SOS_PRIORITY] invalid model output='{result}', defaulting to high")
            return "high"

        logger.info(f"[SOS_PRIORITY] transcription='{transcription}' priority='{result}'")
        return result

    except Exception as e:
        logger.exception(f"[SOS_PRIORITY] Azure OpenAI call failed: {e}")
        return "high"