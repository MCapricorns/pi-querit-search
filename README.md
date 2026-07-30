# pi-querit-search

English | [中文](./README-zh.md)
A focused [Pi](https://github.com/earendil-works/pi) extension that adds Querit's live web search and page-content APIs as LLM-callable tools.

- `web_search` uses `POST https://api.querit.ai/v1/search`
- `fetch_content` uses `POST https://api.querit.ai/v1/contents`
- `/querit-setup` configures the API key, default workflow, and a fixed Pi model for optional summaries
- No multi-provider routing, browser automation, scraping fallback, or direct access to Pi's `auth.json`

## Install

After the package is published:

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

The command:

1. opens a masked API-key prompt;
2. makes one one-result search request to validate the key;
3. lets you choose `raw` or `summary` as the default workflow;
4. lists Pi's current scoped/available models, with the active model first, and saves one fixed summary model;
5. stores the configuration in Pi's agent directory as `querit-search.json`.

The default path is `~/.pi/agent/querit-search.json`. Pi's configured agent directory is respected, including `PI_CODING_AGENT_DIR`. The file contains:

```json
{
  "apiKey": "your-api-key",
  "defaultWorkflow": "raw",
  "summaryModel": "provider/model-id"
}
```

The extension applies mode `0600` on POSIX systems. On Windows, the file remains protected by the user profile's filesystem ACLs. The key is never included in tool results or logs.

For CI or ephemeral use, set `QUERIT_API_KEY`. The JSON configuration takes precedence when both are present.

## Tools

### `web_search`

Required:

- `query`

Optional:

- `count` (`1..20`, default `5`)
- `include_domains`, `exclude_domains`
- `time_range` (`d7`, `w2`, `m3`, `y1`, or a date range)
- `countries`, `languages`
- `include_content`
- `chunks_per_doc` (`1..3`; plan limits apply)
- `workflow`: `raw` or `summary`; overrides the setup default for one call

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
