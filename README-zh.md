# pi-querit-search

[![npm version](https://img.shields.io/npm/v/pi-querit-search?color=blue)](https://www.npmjs.com/package/pi-querit-search)
[![downloads](https://img.shields.io/npm/dm/pi-querit-search)](https://www.npmjs.com/package/pi-querit-search)
[![license](https://img.shields.io/npm/l/pi-querit-search)](./LICENSE)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![pi](https://img.shields.io/badge/pi-extension-orange)

[English](./README.md) | 中文

一个专注的 [Pi](https://github.com/earendil-works/pi) 扩展，通过 [Querit](https://www.querit.ai) 为智能体提供实时网页搜索和页面抓取能力。

## 为什么选择 Querit？

LLM 受限于训练数据——面对复杂或实时查询时容易产生幻觉和时效性问题。Querit 是专为生成式 LLM 调用场景设计的检索系统，提供实时、权威的网页搜索结果，无缝集成到 LLM 应用中：

- **内容全面** —— 覆盖近 20 个国家、10 种语言，索引数千亿网页的全球海量索引。
- **能力强大** —— 灵活的检索选项（时间范围、地区、语言、域名过滤），可按场景定制结果。
- **效果出色** —— 准确、权威、高质量的内容覆盖。

在 [Querit.ai](https://www.querit.ai) 注册即可获取 API Key，**每月 1,000 次免费调用**，无需信用卡。

## 快速开始

**1. 安装**

```bash
pi install npm:pi-querit-search
```

**2. 配置**

在 Pi 交互模式中运行配置向导：

```text
/querit-setup
```

向导会依次引导你输入 API Key、设置搜索默认值和可选的摘要模型。除 API Key 外每一步都可跳过。

**3. 搜索**

直接向智能体提问——它会自动调用 `web_search` 和 `fetch_content`：

```text
> Rust 2024 edition 有什么变化？
```

> **注意：** 请勿同时启用其他注册了 `web_search` 或 `fetch_content` 的扩展，Pi 工具名必须唯一。

## 工作原理

```
┌──────────────────────────────────────────────────────────┐
│  Pi Agent                                                │
│                                                          │
│  web_search(query, count?, workflow?)                    │
│      │                                                   │
│      ▼                                                   │
│  ┌─────────────┐    持久化默认值             ┌─────────┐  │
│  │  Querit API  │◄── (timeRange, countries, │ querit-  │  │
│  │  /v1/search  │    languages, domains…)   │ search.  │  │
│  └──────┬──────┘    来自 /querit-setup      │ json     │  │
│         │                                   └─────────┘  │
│         ▼                                                │
│  workflow = raw?──► 返回带引用的结果给外层模型            │
│         │                                                │
│  workflow = summary?                                     │
│         │                                                │
│         ▼                                                │
│  ┌──────────────────┐                                    │
│  │ 固定 Pi 模型      │  嵌套 LLM 调用                    │
│  │ (来自 setup)      │  → 简洁摘要 + 来源列表            │
│  └──────────────────┘  + 关键摘录                        │
│                                                          │
│  fetch_content(url/urls, format?)                        │
│      │                                                   │
│      ▼                                                   │
│  ┌──────────────────┐                                    │
│  │  Querit API       │                                   │
│  │  /v1/contents     │──► markdown / text / HTML         │
│  └──────────────────┘    (每次最多 10 个 URL)            │
└──────────────────────────────────────────────────────────┘
```

扩展注册了两个工具和一个斜杠命令：

| 入口 | 用途 |
|---|---|
| `web_search` | 实时网页搜索，返回带引用的结果；可选由固定 Pi 模型预先摘要 |
| `fetch_content` | 抓取最多 10 个 URL 的完整页面内容（markdown、text 或 HTML） |
| `/querit-setup` | 交互式配置 API Key、持久化搜索默认值、工作流和摘要模型 |

**`raw` 与 `summary` 工作流：**

- **`raw`**（推荐）—— Pi 外层模型直接接收带引用的 Querit 结果并正常回答。
- **`summary`** —— 额外调用一次 `/querit-setup` 中选定的固定 Pi 模型，生成简洁摘要（保留版本号、API 签名、报错信息、原文引用等具体技术细节），再附加 Sources 列表和 `## Key excerpts` 段落（携带前 5 条结果的原始 snippet）。若固定模型缺失、无认证、30 秒超时或返回空内容，自动回退到原始结果并注明原因。

## 配置

在 Pi 交互模式中运行 `/querit-setup`。配置保存于 `~/.pi/agent/querit-search.json`（尊重 `PI_CODING_AGENT_DIR`）。

### 首次配置流程

1. **API Key** —— 遮罩输入框；通过一次单结果搜索请求验证有效性。
2. **搜索默认值** —— 每一步都可跳过（见下表）。
3. **工作流** —— 选择 `raw` 或 `summary` 作为默认值。
4. **摘要模型** *（仅 summary）* —— 交互式模型选择器（每页 5 个、方向键翻页、输入即模糊过滤，活动模型排第一），然后选择思考强度（仅列出该模型支持的档位）。

### 重新配置菜单

已有 Key 时，`/querit-setup` 打开二级菜单：

| 选项 | 效果 |
|---|---|
| **Replace API key (full re-setup)** | 输入并验证新 Key，重走完整流程。旧 Key 仅在本地被覆盖，如需吊销请到 Querit 控制台操作。 |
| **Change search defaults** | 只修改持久化搜索过滤项，不动已保存的 Key。 |
| **Change summary settings** | 修改默认工作流、固定摘要模型及其思考强度。 |

### 搜索默认值选项

这些是应用于每次 `web_search` 调用的持久化默认值，保存于 `querit-search.json` 的 `search` 字段，**不是**单次调用参数。

| 选项 | 可选值 | 默认值 | 说明 |
|---|---|---|---|
| `count` | `1` – `20` | API 默认（`5`） | 每次搜索的结果数量。可通过 `count` 参数单次覆盖。 |
| `timeRange` | `d7` · `w2` · `m3` · `y1` | *（无 — 不限时间）* | 限制结果为过去 7 天、2 周、3 个月或 1 年。 |
| `includeContent` | `yes` / `no` | `no` | 在结果中包含句子级内容摘录，提供更丰富的上下文。 |
| `countries` | `argentina` · `australia` · `brazil` · `canada` · `colombia` · `france` · `germany` · `india` · `indonesia` · `japan` · `mexico` · `nigeria` · `philippines` · `south korea` · `spain` · `united kingdom` · `united states` | *（无 — 全球）* | 将结果偏向特定国家。逗号分隔，可多选。 |
| `languages` | `english` · `japanese` · `korean` · `german` · `french` · `spanish` · `portuguese` | *（无 — 全部）* | 按语言过滤结果。逗号分隔，可多选。 |
| `includeDomains` | 域名列表 | *（无 — 不限制）* | **白名单** —— 只返回这些域名的结果。 |
| `excludeDomains` | 域名列表 | *（无）* | **黑名单** —— 排除这些域名。内置 **噪音屏蔽** 预设：`pinterest.com`、`facebook.com`、`instagram.com`、`tiktok.com`。 |

### 摘要设置

| 选项 | 可选值 | 说明 |
|---|---|---|
| `defaultWorkflow` | `raw` · `summary` | `web_search` 的默认工作流。可通过 `workflow` 参数单次覆盖。 |
| `summaryModel` | 任意 Pi 模型引用 | 用于嵌套摘要调用的固定模型（如 `anthropic/claude-sonnet-4-20250514`）。 |
| `summaryThinkingLevel` | 取决于模型 | 摘要模型的思考强度（如 `off`、`low`、`medium`、`high`）。默认 `medium`；选择器仅显示所选模型支持的档位。 |

### 配置文件示例

```json
{
  "apiKey": "your-api-key",
  "defaultWorkflow": "raw",
  "summaryModel": "provider/model-id",
  "summaryThinkingLevel": "medium",
  "search": {
    "count": 5,
    "timeRange": "m3",
    "includeContent": false,
    "countries": ["united states"],
    "languages": ["english"],
    "includeDomains": ["github.com"],
    "excludeDomains": ["pinterest.com"]
  }
}
```

POSIX 系统上文件权限为 `0600`；Windows 上依赖用户配置文件 ACL 保护。API Key 不会出现在工具结果或日志中。

CI 或临时使用可设置环境变量 `QUERIT_API_KEY`，JSON 配置优先。

## 工具

### `web_search`

必填：

- `query`

可选：

- `count`（`1..20`）—— 单次覆盖已配置的默认值（API 默认 `5`）
- `workflow`：`raw` 或 `summary`，单次覆盖默认值

域名、时间范围、国家、语言、内容摘录是持久化默认值，在 `/querit-setup` 中配置（保存于 `querit-search.json` 的 `search` 字段），不再是单次调用参数。两个域名名单都跳过即完全放开；include 是白名单（只返回这些域名的结果），exclude 是黑名单。

结果包含标题、URL、摘要、来源元数据和可选的句子级内容摘录。重复和非 HTTP(S) 的结果 URL 会被过滤。

### `fetch_content`

传入 `url`、`urls` 或两者（最多 10 个唯一 HTTP(S) URL）。

可选：

- `format`：`markdown`（默认）、`text` 或 `html`
- `crawl_timeout`：`1..60` 秒（默认 `10`）
- `include_metadata`：默认 `true`

两个工具都会标记远程数据为不可信、传播 Pi 取消信号、强制响应大小限制，并将模型可见输出限制在 Pi 的 50KB/2000 行上限内。超出时完整输出写入唯一临时文件并返回路径。

## 开发

需要 Node.js 22.19+。

```bash
npm install
npm run check
npm test
npm run pack:check
```

真实 API 冒烟测试（读取 JSON 配置或 `QUERIT_API_KEY`，不打印 Key 和抓取内容）：

```bash
npm run test:live
```

## 许可证

MIT
