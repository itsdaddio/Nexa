"""Tests for the Nexa Grok client."""

import json
from unittest.mock import MagicMock, patch

import pytest

from nexa.client import NexaClient
from nexa.leads import Lead, LeadGenerator, _parse_json


class TestNexaClient:
    def test_default_model(self):
        client = NexaClient(api_key="test-key")
        assert client.model == NexaClient.DEFAULT_MODEL

    def test_custom_model(self):
        client = NexaClient(api_key="test-key", model="grok-3")
        assert client.model == "grok-3"

    def test_raises_without_api_key(self):
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(ValueError, match="XAI_API_KEY"):
                NexaClient()

    def test_chat_returns_content(self):
        client = NexaClient(api_key="test-key")
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "Hello"
        client._client.chat.completions.create = MagicMock(return_value=mock_response)

        result = client.chat([{"role": "user", "content": "Hi"}])
        assert result == "Hello"


class TestParseJson:
    def test_plain_json(self):
        assert _parse_json('[{"a": 1}]') == [{"a": 1}]

    def test_strips_markdown_fences(self):
        raw = "```json\n[{\"a\": 1}]\n```"
        assert _parse_json(raw) == [{"a": 1}]

    def test_strips_plain_fences(self):
        raw = "```\n[{\"a\": 1}]\n```"
        assert _parse_json(raw) == [{"a": 1}]

    def test_raises_on_invalid_json(self):
        with pytest.raises(ValueError, match="non-JSON"):
            _parse_json("not json at all")


class TestLead:
    def test_to_dict(self):
        lead = Lead(name="Jane Doe", company="Acme", email="jane@acme.com", score=80, tags=["enterprise"])
        d = lead.to_dict()
        assert d["name"] == "Jane Doe"
        assert d["score"] == 80
        assert "enterprise" in d["tags"]


class TestLeadGenerator:
    def _make_generator(self, chat_response: str) -> LeadGenerator:
        client = NexaClient(api_key="test-key")
        client.chat = MagicMock(return_value=chat_response)
        return LeadGenerator(client=client)

    def test_generate_returns_leads(self):
        sample = json.dumps([
            {"name": "Alice", "company": "TechCo", "email": "alice@techco.com",
             "phone": "555-1234", "industry": "SaaS", "notes": "", "score": 75, "tags": ["startup"]},
        ])
        gen = self._make_generator(sample)
        leads = gen.generate("SaaS startups", count=1)
        assert len(leads) == 1
        assert leads[0].name == "Alice"
        assert leads[0].score == 75

    def test_qualify_returns_new_lead(self):
        lead = Lead(name="Bob", company="BuildCo", score=50)
        updated = lead.to_dict()
        updated["score"] = 90
        updated["notes"] = "High potential"
        updated["tags"] = ["hot"]
        gen = self._make_generator(json.dumps(updated))
        result = gen.qualify(lead, context="construction industry")
        # Original must not be mutated
        assert lead.score == 50
        assert lead.notes == ""
        # Returned lead has updated values
        assert result.score == 90
        assert result.notes == "High potential"
        assert "hot" in result.tags

    def test_generate_handles_markdown_fenced_json(self):
        sample = json.dumps([
            {"name": "Carol", "company": "HealthPlus", "email": "", "phone": "",
             "industry": "Healthcare", "notes": "", "score": 60, "tags": []},
        ])
        fenced = f"```json\n{sample}\n```"
        gen = self._make_generator(fenced)
        leads = gen.generate("healthcare companies", count=1)
        assert len(leads) == 1
        assert leads[0].name == "Carol"
