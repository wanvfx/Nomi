# 2026-06-14 极底层审计 · 修复执行计划

> 真相源 = `docs/audit/2026-06-14-ultra-deep-mechanism-audit.md`（~80 条发现）。本文是执行计划：分相、排期、验收门、用户决策。
> 纪律：每个逻辑改动 TDD（先红后绿）+ 五门全过（filesize/typecheck/lint≤98/test/build）+ 单独 commit（R11，只 add 指名文件）。
> 范围：修代码根因；存量数据按用户决策处理。不动项：已核实真根治的 06-14A A3/A4/A5/A6、06-13 A2。

## 用户决策（2026-06-14 已拍板，R3）
- **存量 88 项目** → 一键收敛：30 重复示例每种留最新 1 份、删 ≤2 节点零编辑的空壳「未命名」。
- **删除语义** → 真删盘（`fs.rmSync`，UI 名副其实）。
- **导出引擎** → ffmpeg filtergraph 为唯一主路径、WebM 仅无 ffmpeg 降级；预览取景(fitMode/缩放/平移)写入 TimelineState 让导出 1:1 遵守。

## 相位与状态

### 相 1 · harness 主权/可观测（最高优先）
- [x] **P0-1** EventLog 解析器回归（commit 4ad516e，已推送）。
- [x] **P0-7** 多步提议 abort 跑完整补偿（commit 0fcd1fd）：抽 applyCompensationOps 与 undo 同源，abort 倒序应用并截掉失败步假补偿；补 abort+set_prompt+delete 回归。
- [ ] **P1** clientId 全局 Map 切项目不重置 → 跨项目误连/误删：切项目/新会话时 clear registry。
- [~] **gate 锁 `arrange_storyboard_to_timeline`**：经核实**非 bug**——锁语义只禁「改节点」(prompt/删/重生成/入边)，排片是「用节点产物」(等同出边,设计明确放行)且仍走 ask 门。按 receiving-code-review 纪律不盲改。结构性「新写工具默认不进锁判定」的隐患另行评估。
- [ ] **P2** redactDeep 黑名单→白名单加固；seq 单段全损恢复兜底；seedAgentChatV2History 注入 tool 操作摘要。

### 相 2 · 持久化/数据治理
- [x] **P0-2** 真删盘（commit 1ebda46）：新增 deleteWorkspaceProject——native 真删、外部文件夹只解绑（双重边界防误删用户目录）；UI 文案/ toast 按 source 如实区分。
- [ ] **P0-3** 草稿态延迟落盘 + 空壳 GC（退出/启动回收零编辑空项目）。
- [ ] **P0-4 + 存量收敛**：一次性迁移——示例按 name 去重留最新 + 回填 seedKey；删空壳未命名。带 dry-run 日志。
- [ ] **P1** discoverLegacyProjects 移出 list 热路径（只首次/手动同步）。
- [ ] **P1** 外部文件夹 home/系统目录 denylist + 非空二次确认。
- [ ] **P1** 统一 ProjectCreationSpec 单一构造点 + 不变量测试（create 后必含 seedKey/categoryId/workspaceMode）。
- [ ] **P2** 迁移幂等改语义相等（止 revision 漂移 + toast 复弹）；缩略图降级链 + 派生收口单份。

### 相 3 · 创作/流式
- [ ] **P0-6** storyboardPlan 持久化（接入 projectRecordSchema + projectNormalize + workbenchPersistence）。
- [ ] **P1** 流式生命周期收口"turn 控制器"：切项目/新对话/卸载统一 abort + 「已取消」第三态 + 单调 id。
- [ ] **P1** 编辑器外部回灌 setContent 保留 selection。
- [ ] **P2/P3** chatOnly 驱动工具白名单；选区 vs 全文显式化；附件 uploading gate；删死代码 createStoryboardNodeFromContent；md→tiptap 合一。
- [ ] 文本三真相源（片段 ID 绑定）+「方案 vs 源文本」并排——**架构级，需 R7 + 独立 plan + 用户拍板 UX 方向**，本轮不强行。

### 相 4 · 画布/连边/节点控件
- [x] **P1** 手动连线能力校验收口（commit d881cc2）：validateReferenceEdge 进 store.connectToNode 总闸,失败 toast 反馈;补手动路径回归。
- [ ] **P1** 跨分类边可见性与生效性同源 / reassignNodeCategory 同步处理边。
- [ ] **P2/P3** 节点尺寸单一 getNodeSize（回退走 registry）；wheel 横轴命中 + 去热路径 getComputedStyle；弹层翻转/clamp 共用原语；usageCount 改结构化引用。

### 相 5 · runtime/模型接入
- [ ] **P1** 结构化 VendorRequestError 收口三条出口 + extraHeaders 注入三路径统一。
- [ ] **P1** taskCache「正在轮询」保护 / 区分驱逐 vs 不存在；catalog 高版本写保护；findExecutableModel 唯一键。
- [ ] **P2/P3** importCatalog 事务化；代理热更新 + SOCKS 用户可见提示；runtime.ts 资产 I/O 拆出；manual 接入连通性测试。
- [ ] **P0-8** 非文本模型自动接入（archetype 运行期可声明契约）——**架构级，需 R7 + 独立 plan**，本轮不强行。

### 相 6 · 时间轴/导出（按"ffmpeg 为主"决策）
- [ ] **P0-5** 预览 fitMode/缩放/平移写入 TimelineState；导出统一 filtergraph、WebM 仅降级；删 WebM 主路径并行版。
- [ ] **P1** node→clip 对账（删/重生成节点对账时间轴）；before-quit abort ffmpeg；UI 接 exports.cancel；WebM 录制改帧锁定。
- [ ] **P2/P3** 折行纳入 textLayout 单源；duration useMemo 补 textClips；fps derive；排片幂等键；active job 降 per-project；asset 合并键含 result。

### 相 7 · Scene3D / 设计系统
- [ ] **P1** 编辑器 draft/commit 分离 + 父层版本号 diff（替代全场景 stringify）；NodeParameterControls meta 统一走 getState。
- [ ] **P2** Scene3D 叶子 memo + useFrame 脏判断；archetype catalog 兜底控件；image-url 槽改声明；离屏测量加 inert。
- [ ] **P1** Scene3DFullscreen 3860 行拆分（components/panels/controls + 几何并入 scene3dMath）。
- [ ] **P2** Scene3D token 化（128 px + 24 hex）。

### 相 8 · 元修复（防回归）
- [ ] 评测/CI 盲区：补"renderer 真实 sessionKey→trace 落盘→proposalId join approved"端到端断言（相 1 已部分做）；property test 覆盖 abort。
- [ ] 导出禁用态 hover 收口（整条控制条 disabled 随 disabled derive）。

## 验收
每相完成跑五门；UI 可见改动补 R13 走查 + design-fidelity 断言；存量收敛迁移先 dry-run 给用户看清单再执行。
