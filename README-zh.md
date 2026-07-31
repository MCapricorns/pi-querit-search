# pi-querit-search

[English](./README.md) | 中文

一个专注的 [Pi](https://github.com/earendil-works/pi) 扩展，通过 [Querit](https://www.querit.ai) 为智能体提供实时网页搜索和页面抓取能力。

## Querit 是什么？

Querit 是专为生成式 LLM 调用场景设计的检索系统。LLM 受限于训练数据和本地知识库，在处理复杂或实时查询时容易产生幻觉和时效性问题。Querit 提供实时、权威、准确、高质量的网页搜索结果，无缝集成到 LLM 应用中：

- **内容全面** —— 覆盖近 20 个国家、10 种语言，索引数千亿网页的全球海量索引。
- **能力强大** —— 灵活的检索选项（时间范围、地区、语言、域名过滤），可按场景定制结果。
- **效果出色** —— 准确、权威、高质量的内容覆盖。

在 [Querit.ai](https://www.querit.ai) 注册即可获取 API Key，每月 1,000 次免费调用，无需信用卡。

## 扩展功能

- `web_search` —— 实时网页搜索，返回带引用的结果，可选由固定 Pi 模型预先摘要。
- `fetch_content` —— 抓取最多 10 个 URL 的完整页面内容（markdown、text 或 HTML）。
- `/querit-setup` —— 交互式配置 API Key、持久化搜索默认值、默认工作流和固定 Summary 模型。
- 无多供应商路由、无浏览器自动化、无爬虫回退、不读取 Pi 的 `auth.json`。

## 安装

从 npm 安装：

```bash
pi install npm:pi-querit-search
```

本地开发：

```bash
pi -e .
```

请勿同时启用其他注册了 `web_search` 或 `fetch_content` 的扩展，Pi 工具名必须唯一。

## 配置

在 Pi 交互模式中运行：

```text
/querit-setup
```

没有配置文件时，该命令会：

1. 打开遮罩 API Key 输入框（不记录到聊天历史）；
2. 发起一次单结果搜索请求验证 Key 有效性；
3. 逐项询问持久化搜索默认值（结果数量、时间范围、内容摘录、国家、语言、域名包含/排除名单，排除项内置噪音名单预设），每一项都可跳过；
4. 让你选择默认工作流：`raw`（原始结果）或 `summary`（自动摘要）——选择 `raw` 时跳过模型选择步骤；
5. （仅 `summary`）打开交互式模型选择器——每页 5 个、方向键翻页、输入即模糊过滤，活动模型排第一——选定固定 Summary 模型后，再为该模型选择思考强度（仅列出该模型支持的档位，默认 `medium`）；
6. 将配置保存到 Pi agent 目录下的 `querit-search.json`。

已有 Key 时，该命令改为打开二级菜单：

- **Replace API key (full re-setup)** —— 输入并验证新 Key，重走完整流程。旧 Key 仅在本地被覆盖，如需吊销请到 Querit 控制台操作。
- **Change search defaults** —— 只修改持久化搜索过滤项，不动已保存的 Key。
- **Change summary settings** —— 修改默认工作流、固定 Summary 模型及其思考强度。

默认路径为 `~/.pi/agent/querit-search.json`，尊重 `PI_CODING_AGENT_DIR` 环境变量。文件内容：

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

`raw` 是推荐默认值：Pi 外层模型直接接收带引用的 Querit 结果并正常回答。`summary` 会额外调用一次 `/querit-setup` 中选定的固定 Pi 模型，先压缩为简洁摘要（要求保留版本号、API 签名、报错信息、原文引用等具体技术细节），再附加确定性 Sources 列表和 `## Key excerpts` 段落（携带前 5 条结果的原始 snippet），便于外层模型在信息不足时通过 `fetch_content` 深挖任意来源。嵌套调用的 usage 会报告在工具结果上，计入 Pi 会话 token/cost 统计（不影响主上下文窗口核算）。若固定模型缺失、无认证、30 秒超时或返回空内容，`web_search` 自动回退到原始结果并注明原因。用户取消仍会取消整个工具调用。

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
