"""
Lead data model and generation logic.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, replace
from typing import Optional

from nexa.client import NexaClient


@dataclass
class Lead:
    """Represents a potential sales lead."""

    name: str
    company: str
    email: str = ""
    phone: str = ""
    industry: str = ""
    notes: str = ""
    score: int = 0
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "company": self.company,
            "email": self.email,
            "phone": self.phone,
            "industry": self.industry,
            "notes": self.notes,
            "score": self.score,
            "tags": self.tags,
        }


def _parse_json(raw: str) -> object:
    """Parse JSON from a model response, stripping any markdown code fences."""
    stripped = raw.strip()
    # Remove ```json ... ``` or ``` ... ``` wrappers if present
    stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
    stripped = re.sub(r"\s*```$", "", stripped)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Model returned non-JSON response: {raw!r}") from exc


class LeadGenerator:
    """Uses Grok to generate and qualify leads."""

    SYSTEM_PROMPT = (
        "You are an expert lead generation assistant. "
        "When asked to generate leads, respond with a JSON array of lead objects. "
        "Each lead object must have the fields: name, company, email, phone, industry, notes, score (0-100), tags (array)."
    )

    def __init__(self, client: Optional[NexaClient] = None):
        self.client = client or NexaClient()

    def generate(self, criteria: str, count: int = 5) -> list[Lead]:
        """Generate leads matching the given criteria using Grok.

        Args:
            criteria: Description of the target lead profile.
            count: Number of leads to generate.

        Returns:
            A list of Lead objects.
        """
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Generate {count} leads for the following criteria: {criteria}. "
                    "Return only a JSON array with no additional text."
                ),
            },
        ]
        raw = self.client.chat(messages)
        data = _parse_json(raw)
        return [
            Lead(
                name=item.get("name", ""),
                company=item.get("company", ""),
                email=item.get("email", ""),
                phone=item.get("phone", ""),
                industry=item.get("industry", ""),
                notes=item.get("notes", ""),
                score=int(item.get("score", 0)),
                tags=item.get("tags", []),
            )
            for item in data
        ]

    def qualify(self, lead: Lead, context: str = "") -> Lead:
        """Use Grok to score and annotate a lead.

        Returns a new Lead instance with updated score, notes, and tags.
        The original lead object is not modified.

        Args:
            lead: The lead to qualify.
            context: Additional context about the target customer profile.

        Returns:
            A new Lead with updated score, notes, and tags.
        """
        prompt_parts = [f"Qualify the following lead and return updated JSON:\n{json.dumps(lead.to_dict())}"]
        if context:
            prompt_parts.append(f"Target profile context: {context}")
        prompt_parts.append("Return only the updated JSON object with no additional text.")

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": "\n".join(prompt_parts)},
        ]
        raw = self.client.chat(messages)
        item = _parse_json(raw)
        return replace(
            lead,
            score=int(item.get("score", lead.score)),
            notes=item.get("notes", lead.notes),
            tags=item.get("tags", lead.tags),
        )
