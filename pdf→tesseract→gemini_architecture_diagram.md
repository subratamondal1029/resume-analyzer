# PDF → Tesseract (self-host) → Gemini (LLM) Architecture

This document shows a clear, production-ready architecture for your flow: per-page text extraction, selective OCR (image pages), per-page metadata storage, and rule-checking via Google Gemini. It includes component responsibilities, data flow, endpoints, caching, scaling, security, retries, and a simple diagram.

---

## Goal
For each uploaded PDF: split pages → extract text if present → if insufficient text render page image and send to self-hosted Tesseract server → collect page-level text + metadata → send aggregated pages to Gemini for rule evaluation → return structured JSON results.

---

## Components

1. **Client (Web/Frontend)**
   - Upload PDF to backend `/upload` endpoint (multipart/form-data).
   - Shows progress and results.

2. **API / Backend (MERN Node.js service)**
   - Endpoint: `POST /analyze` accepts PDF.
   - Responsibilities:
     - Validate upload, stream to temporary memory buffer or storage.
     - Compute document hash for caching.
     - Use `pdfjs-dist` to open PDF and iterate pages.
     - For each page: extract text layer; if `charCount >= TEXT_THRESHOLD` use text; else render page to PNG buffer.
     - For pages needing OCR: POST PNG buffer to `TESSERACT_SERVER_HOST:/tesseract` (multipart file).
     - Collect per-page objects `{ pageNumber, source:text|ocr, text, charCount, ocrConfidence?, pageHash }` into `pagesMeta[]`.
     - Call Gemini per-rule or batch rules with a strict JSON schema prompt.
     - Store results (DB), return response to client.

3. **Tesseract OCR Server (self-hosted)**
   - Dockerized `tesseract-server` listening on internal network (e.g., `http://ocr:8000/tesseract`).
   - Accepts image via multipart `file` field and `options` JSON; returns JSON `{ text, stdout, stderr }` or `{ text, confidence }` if extended.
   - Scale: run multiple replicas behind a small load-balancer if heavy load.

4. **LLM: Google Gemini (external API)**
   - Calls to Gemini use short, deterministic prompts, `temperature=0`, `maxTokens` limit, and strict JSON schema instructions.
   - Endpoint secured with API key token; requests should be rate-limited and retried with backoff.

5. **Optional: Cache Layer & Storage**
   - Document/page-level cache keyed by `sha256(document)` or `sha256(pageBuffer)` for page reuse.
   - Redis for short-term cache; S3 or file storage for long-term artifacts.

6. **Database / Audit Log**
   - Store `pagesMeta`, `ruleResults`, input hashes, timestamps, raw LLM outputs for audits.

---

## Data model (per-page)
```json
{
  "pageNumber": 3,
  "source": "ocr",
  "text": "...extracted text...",
  "charCount": 24,
  "ocrConfidence": 82,
  "pageHash": "<sha256>"
}
```

## Example API endpoints
- `POST /analyze` — file upload; returns `{ docHash, pagesMeta, ruleResults }`.
- `GET /status/:docHash` — progress and cached results.
- `POST /rules/check` — submit rules + docHash to run checks (async preferred).

---

## Sequence Diagram (mermaid)
```mermaid
sequenceDiagram
  participant Client
  participant Backend
  participant OCR as Tesseract-Server
  participant Gemini
  Client->>Backend: POST /analyze (PDF)
  Backend->>Backend: compute docHash; check cache
  alt cache hit
    Backend-->>Client: cached result
  else cache miss
    Backend->>Backend: open PDF via pdfjs
    loop page in pages
      Backend->>Backend: extract text layer
      alt text sufficient
        Backend-->>Backend: pagesMeta.push(text)
      else
        Backend->>Backend: render page -> PNG buffer
        Backend->>OCR: POST /tesseract (file=png)
        OCR-->>Backend: {text, confidence}
        Backend-->>Backend: pagesMeta.push(ocr result)
      end
    end
    Backend->>Gemini: POST rule-check prompt (pagesMeta)
    Gemini-->>Backend: JSON rule results
    Backend->>DB: store pagesMeta + ruleResults + raw LLM output
    Backend-->>Client: { pagesMeta, ruleResults }
  end
```

---

## Operational / Deployment Notes
- **Docker Compose**: run `backend` + `tesseract-server` + `redis` as services on same VPC. Expose backend externally; keep OCR internal.
- **Resource sizing**: OCR is CPU-bound. For moderate load (few concurrent users) 2–4 vCPUs per OCR replica is fine. Gemini is external — watch rate limits.
- **Timeouts**: OCR calls may take seconds per page. Set per-call timeouts (e.g., 2 minutes) and fail-fast with retries/backoff.
- **Concurrency**: Limit concurrent OCR jobs per backend instance (worker pool size = CPU cores or less).
- **Security**: encrypt files at rest; remove PII before sending to Gemini if required by policy; use HTTPS for Gemini calls and internal TLS for services.
- **Observability**: log request/response sizes, per-page OCR duration, Gemini latency, and keep raw LLM outputs for debugging (hashed in DB).

---

## Failure modes & mitigations
- **Large PDF with many images**: enforce max pages or queue for background processing; stream progress to client.
- **OCR timeout**: fallback to reduce render scale or return partial text and mark low confidence.
- **LLM parsing error (non-JSON)**: retry with `temperature:0` and an explicit `ONLY_RETURN_JSON` directive; as fallback, return safe `fail` responses with `confidence: 30`.
- **Stale cache**: invalidate cache on re-upload if file size or metadata differ.

---

## Security checklist
- Authenticate and authorize `/analyze` and `/rules/check` endpoints.
- Sanitize user-supplied rules before sending to LLM (avoid injection-like prompts).
- Apply rate limits and quotas (prevent abuse and cost spikes on Gemini).
- Audit logging for compliance.

---

## Next steps I can deliver
- An Express microservice `POST /analyze` implementing the full pipeline (ready-to-run).  
- Docker Compose YAML to run `backend` + `tesseract-server` + `redis`.  
- Sample Gemini prompt templates (single-rule and batch rules).  

Tell me which artifact you want next and I'll produce it.

