"""
Grok (xAI) API client for Nexa.
"""

import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


class NexaClient:
    """Client for interacting with the Grok API via the OpenAI-compatible interface."""

    BASE_URL = "https://api.x.ai/v1"
    DEFAULT_MODEL = "grok-3-mini"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        resolved_key = api_key or os.environ.get("XAI_API_KEY")
        if not resolved_key:
            raise ValueError(
                "No API key provided. Set the XAI_API_KEY environment variable or pass api_key to NexaClient."
            )
        self.api_key = resolved_key
        self.model = model or self.DEFAULT_MODEL
        self._client = OpenAI(api_key=self.api_key, base_url=self.BASE_URL)

    def chat(self, messages: list[dict], **kwargs) -> str:
        """Send a chat request to Grok and return the response text."""
        response = self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            **kwargs,
        )
        return response.choices[0].message.content
