# Json schema

```json
{
  "rule": "<string>",
  "status": "pass|fail",
  "evidence": "<string - one sentence with page number>",
  "reasoning": "<short reasoning>",
  "confidence": "<number 0-100>"
}

{
  "rule": "Document must mention a date.",
  "status": "pass",
  "evidence": "Found on page 1: 'Published 2024-07-01'.",
  "reasoning": "Document explicitly contains a date string.",
  "confidence": 95
}
```

# System Instruction

SYSTEM: You are a precise rule-checker. Output STRICT valid JSON only, no commentary.

USER: Below is the extracted text from document pages:
---DOC_START---
<page 1 header>
[PAGE 1 TEXT]
---PAGE_BREAK---
[PAGE 2 TEXT]
---DOC_END---

RULE_TO_CHECK: "<the rule here>"

INSTRUCTIONS:

1. Decide PASS or FAIL whether the document satisfies the rule.
2. Provide one short evidence sentence that includes page number.
3. Provide a 1–2 sentence reasoning.
4. Output an integer confidence 0–100 (higher = more sure).
5. Return ONLY this exact JSON object matching schema:
   { "rule":"", "status":"pass|fail", "evidence":"", "reasoning":"", "confidence":0 }

Return exactly one JSON object and nothing else.

# required packges

```bash
sudo apt update
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev \
libjpeg-dev libgif-dev librsvg2-dev

# node packages
pnpm add pdfjs-dist canvas formdata-node
```
