# Onboarding 参数抽取：从 curl-only 升级为 schema-first（根治）

> 日期 2026-05-30 · 触发：kie.ai GPT Image-2 文档 onboarding 后，节点参数严重缺失（aspect_ratio 只有 0~1 个选项、resolution 等参数完全没出现）。

## 1. 根因（已实证）

当前 onboarding 的「参数真理源」是**文档里的 curl 示例 body**：
`fetch_raw_docs → 挑 curl → collectFieldSuggestions(curl.body) → suggested_fields（无 options）→ set_fields`。

curl 示例本质是「最小可跑样例」，不是完整参数契约，因此：

- curl 没带的参数（只在参数表/schema 里）→ 第一步就丢。
- 枚举参数在 curl 里只有一个值 → `options` 永远为空 → 下拉框只有 0~1 项。

实测 `https://docs.kie.ai/market/gpt/gpt-image-2-text-to-image`：

- 是 **Apidog 渲染的 SPA**，服务端 HTML **0 个 `<table>`、0 条可用 curl**。
- 完整契约（`POST /api/v1/jobs/createTask`、`input.prompt`、`input.aspect_ratio` 的 16 个枚举、`input.resolution` 的 1K/2K/4K、各 default/required）**以内嵌 OpenAPI 数据存在 HTML 里**，但是 Apidog 去水化形态（字符串驻留 + 数字引用、JSON-in-JSON 转义，如 `\"4:5\",\"16:9\",\"9:16\"`）。
- `htmlToMarkdown` 第一步 `strip <script>` → 这些内嵌数据**全被剥掉**，agent 根本看不到。
- Apidog 私有 `export-openapi` 接口需鉴权、不通用、不可依赖。

> 结论：根治 = 把真理源从「curl body」换成「参数契约」。契约来源按权威度分层：**内嵌/可解析的 OpenAPI（确定性）> 参数表 > curl ∪ 内嵌数据摘要（LLM 补全，Zod+evidence 约束）**。curl 仅用于确认请求路径/鉴权/模板占位。

## 2. 范围（本轮 v1）

**新增** `electron/ai/onboarding/specExtractors.ts`：

- `extractOpenApiOperations(html, pageUrl): DocOperation[]` —— 确定性路径。
  - 发现干净 OpenAPI：`<script type=application/json>` 内 parse 出含 `openapi|swagger` 且有 `paths` 的对象；或从 `{"openapi"` 起做平衡括号扫描。
  - 对每个 path+method 展开 `requestBody.content[application/json].schema`：解析 `$ref`（指向 `components`）、递归 `properties` 并记录点路径（`input.aspect_ratio`）、`required[]`、`enum→options`、`default`、`type`、string `minLength/maxLength`。
  - 产出 `DocParameter[] = { key, path, type, required, options?, default?, description, evidence }`。
  - 命中场景：Swagger UI / Redoc / Stoplight / 任意内嵌干净 spec。
- `extractEmbeddedParameterData(html): { excerpt: string; found: boolean }` —— 去水化兜底。
  - 收集所有 `<script>` 文本，反转义 JSON-in-JSON（`\"`→`"` 等），抽出「短引号 token 连排（疑似枚举数组）+ 参数名样式 token + 说明句」的去重摘要，封顶大小。
  - 这不是完整 parse，是把 `htmlToMarkdown` 丢掉的字面枚举/参数名/说明**重新浮现**给 LLM。

**改 `fetch_raw_docs`（tools.ts）**：结果新增 `openapi_parameters`（确定性字段，附 evidence）+ `embedded_data_excerpt`（封顶）。

**改 `systemPrompt.ts`**：契约来源优先级 + 强制「输出每一个请求参数（含嵌套 `input.*`）、枚举给全 `options`、给 `default/required`、每个带 evidence；`openapi_parameters` 存在时直接照用、不得删减」。

**测试**：specExtractors 单测（干净 OpenAPI fixture：含嵌套对象 + enum + $ref；Apidog 转义 fixture：恢复 16 个 ratio）；扩展 draft/commit 投影测试确认 options 贯通。

## 3. 不动什么

- 不动节点渲染层（`parseModelParameterControls`/`NodeParameterControls`）—— options/嵌套已端到端支持，只是上游没填。
- 不动 mapping 的 v3 形状、async 门禁（PR1/PR2）。
- 不引入 headless 浏览器、不依赖任何平台私有接口。
- 不删 curl-blueprint —— 它仍是请求路径/鉴权/模板的真理源（规则 1：这是增强不是并行版本）。
- 不在父目录操作；所有命令 `cd .../impl-v0.6.0 &&`。

## 4. 回滚策略

纯增量：新模块 + `fetch_raw_docs` 结果加字段 + 提示词改文案。回滚 = revert 该 commit；catalog 数据无 schema 变更，已 onboard 的模型不受影响（meta 在 commit 时重建）。

## 5. 验收门

- `pnpm build` tsc 干净；新老 onboarding 测试全绿。
- specExtractors 单测：干净 OpenAPI fixture 还原全部参数 + enum；Apidog 转义 fixture 的摘要里能搜到全部 16 个 aspect ratio 与 1K/2K/4K。
- 真机：重新 onboard kie GPT Image-2 后，节点上 `aspect_ratio` 下拉框含 16 项、出现 `resolution`（1K/2K/4K），参数数量与文档一致。

## 6. 后续（不在本轮）

- 把 spec-only 参数合并进请求 body 模板（`resolution` 选了能真正发出）。
- R2 增强：跟随链接抓外部 `openapi.json`。
- R3 探针：对仍为空的 enum 发非法值，从 4xx 错误回显补全。
