import logging
from openai import AzureOpenAI
from app.config import get_settings

logger = logging.getLogger("sos.priority")


def get_azure_client():
    settings = get_settings()
    return AzureOpenAI(
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
        azure_endpoint=settings.azure_openai_endpoint,
    )


def get_sos_priority(transcription: str) -> str:
    if not transcription or not transcription.strip():
        return "high"

    settings = get_settings()
    deployment_name = settings.azure_openai_gpt4_1_mini_deployment

    prompt = f"""
You are classifying an elderly patient's SOS voice message.

Return only one word from this list:
low
medium
high

Rules:
- low: non-urgent question or simple request
- medium: discomfort, dizziness, mild issue, but not immediate danger
- high: urgent help needed, fall, serious distress, emergency-like situation

Examples:
"What should I eat?" -> low
"I feel dizzy" -> medium
"I need help, I fell" -> high
"I cannot get up" -> high
"I have chest pain" -> high

Message:
\"\"\"{transcription}\"\"\"
""".strip()

    try:
        client = get_azure_client()

        response = client.chat.completions.create(
            model=deployment_name,
            temperature=0,
            max_tokens=5,
            messages=[
                {
                    "role": "system",
                    "content": "You are an SOS priority classifier. Output exactly one word only: low, medium, or high."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
        )

        result = response.choices[0].message.content.strip().lower()

        if result not in {"low", "medium", "high"}:
            logger.warning(f"[SOS_PRIORITY] invalid model output='{result}', defaulting to high")
            return "high"

        logger.info(f"[SOS_PRIORITY] transcription='{transcription}' priority='{result}'")
        return result

    except Exception as e:
        logger.exception(f"[SOS_PRIORITY] Azure OpenAI call failed: {e}")
        return "high"