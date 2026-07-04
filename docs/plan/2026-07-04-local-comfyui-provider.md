# 接入本地 ComfyUI（A 线：当生成后端，窄·稳）

日期：2026-07-04 ｜ 用户拍板「A：先做窄的」｜ 架构调查见本轮两份 Explore 报告

## 背后逻辑（D1）

用户想用**本地** ComfyUI 出图/视频：本地 GPU、自己的模型、不花云端额度、数据不出本地。官方 Comfy MCP 是云端 beta 不碰本地（实查），要接本地最成熟路 = 直接调原生 HTTP `POST /prompt` → 轮询 `GET /history/{id}` → 取图 `GET /view`。

## 关键架构结论（已实查，非凭记忆）

Nomi 生成侧是**声明驱动**：一个 vendor + 一条 `Mapping{create, query}`（带 `{{}}` 模板的 HttpOperation）跑通「提交→轮询→取产物」，runtime/状态机/缓存/素材本地化/付费守卫全是通用层。加供应商基本**只写数据**（新 seed 文件 + `seedBuiltins.ts` 登记一行）。近似先例：`runninghub3d.ts`（云端 ComfyUI 聚合器，POST 提交 + POST /query 轮询）、`kie`。

- ✅ **模板引擎 `renderTemplateValue`（requestPipeline.ts:98）完全递归**：深度遍历嵌套 body 对象/数组、替换里层字符串 `{{}}`；精确 `{{expr}}` 返回**原始值**（数字不转字符串）。→ **整张 workflow 图当 create body、在节点 inputs 里埋 `{{request.prompt}}`/`{{request.params.seed}}` 即可深层注入，不用预处理钩子。**（架构报告说"表达不了"是错的。）
- ✅ **完成态无需 status 字段**：`taskStatusFromResponse`（responseParsing.ts:100）「拿到 assetUrl 即 succeeded」，ComfyUI outputs 一出现就取到图即算成功；未出现则继续轮询。
- ⚠️ **唯一要写代码的地方**：ComfyUI `/history/{id}` 响应 = `{ "<prompt_id>": { outputs: { "<node>": { images: [{filename,subfolder,type}] } } } }`。两处点路径 `response_mapping` 搞不定：① 顶层键是动态 prompt_id；② 取图要从 filename+subfolder+type 拼 `baseUrl/view?filename=..&subfolder=..&type=..`。**没有通用响应变换钩子**（实查确认）。

## 设计：加一个「命名响应变换」通用钩子 + ComfyUI 归一

不在 runtime 里写 ComfyUI 专属分支（那违背数据驱动）。改为：
1. `HttpOperation` 加可选 `response_transform?: string`（命名变换键，types.ts）。
2. `buildProfileTaskResult`（runtime.ts:471）在跑 `response_mapping` 前，若 op 有 `response_transform`，查变换注册表并对 raw response 应用一次。注册表是通用机制（未来别的怪响应也能用），ComfyUI 逻辑只住在自己模块。
3. ComfyUI 变换 `comfyui-history`（住 `electron/catalog/comfyuiLocal.ts`）：unwrap 单键（拿 prompt_id 那层的值）→ 遍历 outputs 找第一个 `images[]` → 用 context.baseUrl 拼出 `/view?...` 完整 URL，塞回一个稳定字段（如 `image_url`）供 response_mapping 直接读。

## 范围（第一刀：本地文生图跑通）

### C1 通用钩子
- `HttpOperation.response_transform?: string` + `buildProfileTaskResult` 应用点 + 变换注册表（`electron/tasks/responseTransforms.ts`）。纯逻辑单测。

### C2 ComfyUI 供应商 + 一个预置 workflow
- `electron/catalog/comfyuiLocal.ts`：vendor seed（key `comfyui-local`，baseUrl `http://127.0.0.1:8188`，auth none）+ `comfyui-history` 变换 + 一个「本地·文生图」workflow 模型：
  - create op：POST `/prompt`，body `{ prompt: <txt2img 图，埋 {{request.prompt}}/{{request.params.*}}>, client_id: "nomi" }`，`response_mapping.task_id = "prompt_id"`。
  - query op：GET `/history/{{providerMeta.task_id}}`，`response_transform: "comfyui-history"`，`response_mapping.image_url = "image_url"`（变换塞好的）。
  - `meta.parameters`：ckpt_name(text，默认常见名)/width/height/seed/steps/cfg/sampler；prompt 走标准槽。动态参数 UI 现成（`parseModelParameterControls`）。
- `seedBuiltins.ts` 登记一行。

### C3 验证
- **纯逻辑单测**：`comfyui-history` 变换（unwrap 动态键 + 拼 /view URL + 多 output 节点取第一张图 + outputs 未出现返回原样 → 继续轮询）。
- **R13 mock-server 走查**：E2E 起一个**假 ComfyUI**（tiny http：/prompt 返 prompt_id、/history/{id} 返 outputs、/view 返测试图），种 comfyui-local vendor，画布加图片节点选「本地·文生图」→ 填 prompt → 生成 → 真走 submit→poll→fetch→落图。抽图人眼判断。**真出图需用户本地 ComfyUI + 模型**（诚实标：mock 证传输链，真像素靠用户环境）。

## ⚠️ 建前需确认的一个产品形状：无 key 本地后端怎么"接入"

调查中发现的真岔路：**ComfyUI 是无 key 的本地服务**，而 Nomi 现在的生成门槛 = `vendor.enabled && hasApiKey`（`modelCatalogCache`/`selectExecutableModel`）。本地无 key 后端过不了这道门。三种形状：

| 形状 | 用户看到 | 代价 | 问题 |
|---|---|---|---|
| ①种占位 key | 开箱即"已接入 本地 ComfyUI" | 最小 | **污染全体**——99% 不用 ComfyUI 的人也多一堆会失败的 workflow |
| ②opt-in 启用开关（推荐） | 「可接入」里默认关，给一个**无需 key 的「启用本地 ComfyUI」开关**（可选：先 GET /system_stats 健康检查再点亮） | 中：门槛放宽 + 一点 onboarding UI | 干净，对未来任何本地/无鉴权后端都通用 |
| ③走向导自定义 | 用户手接 127.0.0.1:8188 | 中 | 向导靠 GET /models 拉模型，ComfyUI 没这端点 → workflow 得 Nomi 预置，配不上向导流 |

**推荐②**：把生成门槛从"必须 hasApiKey"放宽成"无鉴权(authType:'none')供应商 enabled 即算接入"（通用、根因），ComfyUI 种子默认 `enabled:false`，onboarding 在「可接入」给无 key 启用开关。**这动到生成门槛（影响全体）+ 接入向导 UI（用户可见）→ 需样张+拍板再建。**

## 不动项 / 欠账
- runtime 提交/轮询/缓存/付费守卫/素材本地化全复用，不碰。
- 第一刀只做文生图一个 workflow；高清放大/换脸/图生图、`/object_info` 拉 checkpoint 下拉、ws 实时进度 = 后续增量。
- workflow 是 Nomi 预置埋参（窄）；用户导入任意 workflow 自动抽参 = B 线，不做。

## 验收门
五门全过 + 变换纯逻辑单测 + mock-server R13 抽图（submit→poll→fetch 全链落图）。
