# Nexa
Nexa is an automated lead generation software powered by [Grok](https://x.ai/) (xAI).

## Features

- Generate targeted leads using Grok AI
- Qualify and score leads automatically
- Simple Python API

## Setup

1. **Install dependencies**
   ```bash
   pip install -e .
   ```

2. **Configure API key**
   ```bash
   cp .env.example .env
   # Edit .env and add your XAI_API_KEY
   ```

## Quick Start

```python
from nexa import NexaClient, LeadGenerator

gen = LeadGenerator()
leads = gen.generate("B2B SaaS companies with 50-200 employees", count=5)
for lead in leads:
    print(f"{lead.name} @ {lead.company} — score: {lead.score}")
```

## Running Tests

```bash
pip install -e ".[dev]"
pytest
```
