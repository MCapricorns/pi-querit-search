# pi-querit-search

English | [中文](./README-zh.md)
A focused [Pi](https://github.com/earendil-works/pi) extension that gives your agent live web search and page fetching through [Querit](https://www.querit.ai).

## What is Querit?

Querit is a retrieval system built specifically for generative LLM invocation scenarios. LLMs are limited by their training data and local knowledge bases, which leads to hallucinations and stale answers for complex or real-time queries. Querit delivers real-time, authoritative, and high-quality web search results that integrate directly into LLM applications:

- **Comprehensive content** — a massive global index spanning nearly 20 countries and 10 languages with hundreds of billions of web pages.
- **Strong capabilities** — flexible retrieval options (time range, region, language, and domain filters) so results can be tuned for specific scenarios.
- **Excellent results** — accurate, authoritative, high-quality content coverage.

Sign up on [Querit.ai](https://www.querit.ai) to get an API key with 1,000 free API calls per month — no credit card required.

## What this extension does

- `web_search` — live web search with cited results, optionally pre-summarized by a fixed Pi model.
- `fetch_content` — full page content (markdown, text, or HTML) for up to 10 URLs per call.
- `/querit-setup` — interactive configuration of the API key, persistent search defaults, the default workflow, and a fixed Pi model for optional summaries.
- No multi-provider routing, browser automation, scraping fallback, or direct access to Pi's `auth.json`.

## Install

Install from npm:

```bash
pi install npm:pi-querit-search
```

For local development:

```bash
pi -e .
```

Do not enable this package together with another extension that also registers `web_search` or `fetch_content`; Pi tool names must be unique.

## Configure

Start Pi interactively and run:

```text
/querit-setup
```

When no configuration exists yet, the command:

1. opens a masked API-key prompt;
2. makes one one-result search request to validate the key;
3. walks through persistent search defaults (result count, time range, content excerpts, chunks per result, countries, languages, included/excluded domains) — each step can be skipped;
4. lets you choose `raw` or `summary` as the default workflow;
5. lists Pi's current scoped/available models, with the active model first, and saves one fixed summary model;
6. stores the configuration in Pi's agent directory as `querit-search.json`.

When a key is already configured, the command opens a menu instead:

- **Replace API key (full re-setup)** — prompts for a new key, validates it, and re-runs the full flow. The old key is overwritten locally; revoke it in the Querit dashboard if needed.
- **Change search defaults** — edits the persistent search filters without touching the saved key.
- **Change summary settings** — edits the default workflow and the fixed summary model.

The default path is `~/.pi/agent/querit-search.json`. Pi's configured agent directory is respected, including `PI_CODING_AGENT_DIR`. The file contains:

```json
{
  "apiKey": "your-api-key",
  "defaultWorkflow": "raw",
  "summaryModel": "provider/model-id",
  "search": {
    "count": 5,
    "timeRange": "m3",
    "includeContent": false,
    "chunksPerDoc": 1,
    "countries": ["united states"],
    "languages": ["english"],
    "includeDomains": ["github.com"],
    "excludeDomains": ["pinterest.com"]
  }
}
```

The extension applies mode `0600` on POSIX systems. On Windows, the file remains protected by the user profile's filesystem ACLs. The key is never included in tool results or logs.

For CI or ephemeral use, set `QUERIT_API_KEY`. The JSON configuration takes precedence when both are present.

## Tools

### `web_search`

Required:

- `query`

Optional:

- `count` (`1..20`) — overrides the configured default for one call (API default: `5`)
- `workflow`: `raw` or `summary`; overrides the setup default for one call

Domains, time range, countries, languages, content excerpts, and chunks per result are persistent defaults configured in `/querit-setup` (stored under `search` in `querit-search.json`), not per-call parameters.

Results include explicit title, URL, snippet, source metadata, and optional sentence excerpts. Duplicate and non-HTTP(S) result URLs are removed.

`raw` is the recommended default: Pi's outer model receives the cited Querit results and answers normally. `summary` performs one additional nested LLM call using the fixed model selected in `/querit-setup`, then returns a concise summary plus a deterministic Sources list. The nested call's usage is reported on the tool result and contributes to Pi's session token and cost totals (it is not part of main-context window accounting). If the fixed model is missing, unauthenticated, times out after 30 seconds, or returns empty output, `web_search` falls back to raw results and reports the reason. User cancellation still cancels the tool.

### `fetch_content`

Pass `url`, `urls`, or both (at most 10 unique HTTP(S) URLs).

Optional:

- `format`: `markdown` (default), `text`, or `html`
- `crawl_timeout`: `1..60` seconds (default `10`)
- `include_metadata`: default `true`

Both tools mark remote data as untrusted, propagate Pi cancellation, enforce response-size limits, and cap model-visible output at Pi's 50KB/2000-line limit. If formatted output is truncated, the complete output is written to a unique temporary file and its path is returned.

## Development

Requires Node.js 22.19 or newer.

```bash
npm install
npm run check
npm test
npm run pack:check
```

A live smoke test reads the same JSON configuration (or `QUERIT_API_KEY`) and exercises both APIs without printing the key or fetched content:

```bash
npm run test:live
```

## License

MIT
