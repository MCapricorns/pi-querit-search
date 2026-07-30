# pi-querit-search

[English](./README.md) | 中文

一个专注的 [Pi](https://github.com/earendil-works/pi) 扩展，将 Querit 的实时网页搜索和页面内容 API 注册为 LLM 可调用的工具。

- `web_search` 调用 `POST https://api.querit.ai/v1/search`
- `fetch_content` 调用 `POST https://api.querit.ai/v1/contents`
- `/querit-setup` 交互式配置 API Key、默认工作流和固定 Summary 模型
- 无多供应商路由、无浏览器自动化、无爬虫回退、不读取 Pi 的 `auth.json`

## 安装

发布后：

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

该命令会：

1. 打开遮罩 API Key 输入框（不记录到聊天历史）；
2. 发起一次单结果搜索请求验证 Key 有效性；
3. 让你选择默认工作流：`raw`（原始结果）或 `summary`（自动摘要）；
4. 列出 Pi 当前 scoped/available 模型（活动模型排第一），选择一个固定 Summary 模型；
5. 将配置保存到 Pi agent 目录下的 `querit-search.json`。

默认路径为 `~/.pi/agent/querit-search.json`，尊重 `PI_CODING_AGENT_DIR` 环境变量。文件内容：

```json
{
  "apiKey": "your-api-key",
  "defaultWorkflow": "raw",
  "summaryModel": "provider/model-id"
}
```

POSIX 系统上文件权限为 `0600`；Windows 上依赖用户配置文件 ACL 保护。API Key 不会出现在工具结果或日志中。

CI 或临时使用可设置环境变量 `QUERIT_API_KEY`，JSON 配置优先。

## 工具

### `web_search`

必填：

- `query`

可选：

- `count`（`1..20`，默认 `5`）
- `include_domains`、`exclude_domains`
- `time_range`（`d7`、`w2`、`m3`、`y1` 或日期范围）
- `countries`、`languages`
- `include_content`
- `chunks_per_doc`（`1..3`，受套餐限制）
- `workflow`：`raw` 或 `summary`，单次覆盖默认值

结果包含标题、URL、摘要、来源元数据和可选的句子级内容摘录。重复和非 HTTP(S) 的结果 URL 会被过滤。

`raw` 是推荐默认值：Pi 外层模型直接接收带引用的 Querit 结果并正常回答。`summary` 会额外调用一次 `/querit-setup` 中选定的固定 Pi 模型，先压缩为简洁摘要再附加确定性 Sources 列表。嵌套调用的 usage 会报告在工具结果上，计入 Pi 会话 token/cost 统计（不影响主上下文窗口核算）。若固定模型缺失、无认证、30 秒超时或返回空内容，`web_search` 自动回退到原始结果并注明原因。用户取消仍会取消整个工具调用。

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
