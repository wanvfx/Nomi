// R13 走查：3D 导演台「出片旅程」（docs/plan/2026-07-20-scene3d-ux-overhaul.md P0）。
// 断言链：5 步引导 → 出片主按钮/默认时间轴 → 选相机后运镜预设第一屏 → 预设落轨迹 →
// 运镜就绪接力 toast → 暂停拖播放头视口更新（demand 回归）→ 出片面板就绪态 →
// 参考视频出片（时长裁到运动终点 ~72 帧）→ 产物卡片 → 离屏 mp4 落 meta.cameraMoveVideo →
// 关编辑器画布看到 take 节点。
// 用法：pnpm run build && node scripts/scene3d-export-journey-walkthrough.mjs
import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const require = createRequire(import.meta.url)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(repoRoot, '.scene3d-ux-lab')
mkdirSync(outDir, { recursive: true })

let failures = 0
const ok = (msg) => console.log('  ✓ ' + msg)
const fail = (msg) => { console.error('  ✗ ' + msg); failures += 1 }

const app = await electron.launch({
  executablePath: require('electron'),
  args: ['.'],
  cwd: repoRoot,
  env: { ...process.env, NOMI_E2E: '1', NOMI_E2E_ALLOW_MULTI_INSTANCE: '1' },
})
try {
  const win = await app.firstWindow()
  const shot = async (name) => { await win.screenshot({ path: path.join(outDir, name) }); console.log('  📸 ' + name) }
  const bw = await app.browserWindow(win)
  await bw.evaluate((w) => w.setBounds({ x: 0, y: 0, width: 1680, height: 1020 })).catch(() => {})
  await win.waitForLoadState('domcontentloaded')
  await win.evaluate(() => {
    window.localStorage.setItem('__nomiE2E', '1')
    window.localStorage.removeItem('nomi.onboarding.scene3dCoach.v1')
  })
  await win.waitForTimeout(1500)

  await win.getByText('新建空白项目', { exact: false }).first().click()
  await win.waitForTimeout(2500)
  await win.getByRole('button', { name: '生成', exact: false }).first().click()
  await win.waitForTimeout(1500)

  // 真实入口加 scene3d 节点：画布工具栏「添加3D场景节点」
  await win.locator('[aria-label="添加3D场景节点"]').first().click()
  await win.waitForTimeout(1000)
  ok('已通过工具栏添加 3D场景 节点')
  await win.locator('[aria-label="适应视图"]').first().click({ timeout: 3000 }).catch(() => {})
  await win.waitForTimeout(800)

  await win.locator('[aria-label="打开 3D 编辑器"]').first().click()
  await win.waitForTimeout(3000) // FencedCanvas 初始化 + coach 测量

  // — 5 步引导（第 4 步兜底锚点也要在场）—
  for (let step = 1; step <= 5; step += 1) {
    const present = await win.getByText(`第 ${step} 步`, { exact: false }).count()
    if (present > 0) ok(`引导第 ${step} 步在场`)
    else fail(`引导第 ${step} 步缺席`)
    await shot(`0${step}-coach-step${step}.png`)
    const next = win.getByRole('button', { name: step < 5 ? '下一步' : '开始使用', exact: true })
    await next.first().click({ timeout: 3000 }).catch(() => fail(`第 ${step} 步点不了「${step < 5 ? '下一步' : '开始使用'}」`))
    await win.waitForTimeout(700)
  }

  // — 重看引导按钮：点 ? → 5 步引导复现 → 跳过 —
  await win.locator('[title="重看新手引导"]').first().click()
  await win.waitForTimeout(700)
  if ((await win.getByText('第 1 步', { exact: false }).count()) > 0) ok('重看引导可用（第 1 步复现）')
  else fail('点重看引导没有复现引导')
  await win.getByRole('button', { name: '跳过', exact: true }).first().click().catch(() => {})
  await win.waitForTimeout(500)

  // — 默认态：出片主按钮在场；时间轴默认收起（否则盖住底部「添加」，2026-07-20 用户真机反馈）—
  const exportBtn = win.locator('[data-coach="export-button"]')
  if ((await exportBtn.count()) > 0) ok('顶栏「出片」主按钮在场')
  else fail('顶栏「出片」主按钮缺席')
  const playheadHandle = win.locator('[title="拖动播放头"]')
  if ((await playheadHandle.count()) === 0) ok('时间轴默认收起（不盖底部添加工具栏）')
  else fail('时间轴默认展开——会盖住底部「添加」，旅程第 1 步被挡')
  const addBtn = win.locator('[data-coach="add-button"]')
  if ((await addBtn.first().isVisible().catch(() => false))) ok('底部「添加」工具栏进门可见')
  else fail('底部「添加」进门不可见')

  // — IA 重排断言：顶栏 10→4（重复入口全删），工具在语义区就位 —
  const headerClutter = await win.locator('header [title="当前视口截图"], header [title*="播放"], header [title*="轨迹模式"], header [title*="操控"], header input[type="range"]').count()
  if (headerClutter === 0) ok('顶栏已瘦身：无截图/播放/轨迹/接控/速度（只剩出片·引导·关闭）')
  else fail(`顶栏还残留 ${headerClutter} 个应迁出的控件`)
  const trajToggleAnywhere = await win.locator('[title="进入轨迹模式"]').count()
  if (trajToggleAnywhere === 0) ok('「轨迹模式」重复入口已全删（收进整运镜>轨迹）')
  else fail('还有「进入轨迹模式」残留入口')
  if ((await win.locator('[title^="移动"]').count()) > 0) ok('变换工具已落视口左上悬浮 pill')
  else fail('视口变换 pill 缺席')
  if ((await win.locator('[title="WASD 飞行速度"]').count()) > 0) ok('速度滑杆已归位视口左下')
  else fail('速度滑杆缺席')
  const hubPresent = await win.getByText('整运镜', { exact: true }).count()
  if (hubPresent > 0) ok('右栏常驻「整运镜」分区在场')
  else fail('整运镜分区缺席')
  await shot('06-editor-default.png')

  // — 真走旅程第 1 步：添加 → 场景模板 → 城市街道（此步之前漏走，正是时间轴冲突漏网的原因）—
  await addBtn.first().click()
  await win.waitForTimeout(600)
  await win.getByText('场景模板', { exact: true }).first().click().catch(() => fail('添加菜单里找不到「场景模板」'))
  await win.waitForTimeout(600)
  await shot('06b-add-menu.png')
  await win.getByText('城市街道', { exact: true }).first().click().catch(() => fail('场景模板里找不到「城市街道」'))
  await win.waitForTimeout(1000)
  ok('已套用「城市街道」场景模板（旅程第 1 步可达）')
  await shot('06c-scene-template.png')

  // — 选中相机 → 整运镜>预设 可用 + 右栏接控条出现 —
  await win.getByText('相机1', { exact: true }).first().click()
  await win.waitForTimeout(900)
  const presetVisible = await win.getByText('运镜预设', { exact: true }).first().isVisible().catch(() => false)
  if (presetVisible) ok('选中相机后「运镜预设」在整运镜区可见')
  else fail('选中相机后「运镜预设」不可见')
  if ((await win.locator('[title^="操控该镜头"]').count()) > 0) ok('接控入口随选中出现在右栏')
  else fail('右栏接控入口没出现')
  // Hub 三 tab 逐个可用
  await win.getByRole('button', { name: '轨迹', exact: true }).first().click()
  await win.waitForTimeout(500)
  if ((await win.getByText('进入视口编辑', { exact: false }).count()) > 0) ok('整运镜>轨迹：列表+进入视口编辑在场')
  else fail('整运镜>轨迹内容缺席')
  await shot('07b-hub-trajectory.png')
  await win.getByRole('button', { name: '录 take', exact: true }).first().click()
  await win.waitForTimeout(500)
  if ((await win.getByText('进入操控', { exact: false }).count()) > 0) ok('整运镜>录take：一键进操控在场')
  else fail('整运镜>录take内容缺席')
  await shot('07c-hub-take.png')

  // — 录 take 链路走到底：一键进操控 → 底部录制条(●REC)就位 → 退出 —
  await win.getByRole('button', { name: /进入操控/ }).first().click()
  await win.waitForTimeout(900)
  const recBtn = await win.locator('[title^="录 take"]').count()
  const exitPossess = await win.locator('[title^="退出操控"]').count()
  if (recBtn > 0 && exitPossess > 0) ok('录take链路通：进操控后底部 ●REC 与退出在场')
  else fail(`录take链路断（REC=${recBtn}, 退出=${exitPossess}）`)
  await shot('07d-take-possess.png')
  await win.locator('[title^="退出操控"]').first().click()
  await win.waitForTimeout(600)

  // — 假人侧接控条：选假人 → 右栏出「操控该角色」 —
  await win.getByText('假人', { exact: true }).first().click()
  await win.waitForTimeout(600)
  if ((await win.locator('[title^="操控该角色"]').count()) > 0) ok('选假人后右栏接控条=操控该角色')
  else fail('假人侧接控条缺席')
  await win.getByText('相机1', { exact: true }).first().click()
  await win.waitForTimeout(600)
  await win.getByRole('button', { name: '预设', exact: true }).first().click()
  await win.waitForTimeout(500)
  await shot('07-camera-selected.png')

  // — 应用预设 → 落轨迹 + 时间轴此刻自动出现 + 500ms 接力 toast —
  await win.getByRole('button', { name: '推近', exact: true }).first().click()
  await win.waitForTimeout(1200)
  const relayToast = await win.getByText('运镜就绪', { exact: false }).count()
  if (relayToast > 0) ok('接力 toast「运镜就绪 → 出片」已出')
  else fail('接力 toast 没出')
  if ((await playheadHandle.count()) > 0) ok('时间轴在第一段运镜诞生时自动出现')
  else fail('落预设后时间轴没自动打开')
  await shot('08-preset-applied-toast.png')

  // — 手动轨迹路：整运镜>轨迹 → 新建 → 列表增行 —
  await win.getByRole('button', { name: '轨迹', exact: true }).first().click()
  await win.waitForTimeout(500)
  const rowsBefore = await win.getByText('轨迹 ', { exact: false }).count()
  await win.getByRole('button', { name: '新建', exact: true }).first().click().catch(() => fail('找不到「新建」轨迹按钮'))
  await win.waitForTimeout(700)
  const rowsAfter = await win.getByText('轨迹 ', { exact: false }).count()
  if (rowsAfter > rowsBefore) ok(`手动轨迹可建（列表 ${rowsBefore}→${rowsAfter}）`)
  else fail('新建轨迹后列表没增行')
  await shot('08b-manual-trajectory.png')
  await win.getByRole('button', { name: '预设', exact: true }).first().click().catch(() => {})
  await win.waitForTimeout(400)

  // — 暂停态拖播放头：3D 视口要跟着更新（frameloop demand 回归检查）—
  const handleBox = await playheadHandle.first().boundingBox().catch(() => null)
  if (handleBox) {
    await shot('09a-before-scrub.png')
    await win.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await win.mouse.down()
    await win.mouse.move(handleBox.x + 260, handleBox.y + handleBox.height / 2, { steps: 12 })
    await win.mouse.up()
    await win.waitForTimeout(600)
    await shot('09b-after-scrub.png')
    ok('播放头已拖动（视口是否跟动 → 人眼比对 09a/09b）')
  } else {
    fail('找不到播放头拖柄')
  }

  // — 出片面板：就绪态 —
  await exportBtn.first().click()
  await win.waitForTimeout(700)
  const readyText = await win.getByText('运镜就绪（', { exact: false }).count()
  if (readyText > 0) ok('出片面板：参考视频显示就绪态（轨迹/绑定计数）')
  else fail('出片面板就绪态缺席')
  await shot('10-export-panel.png')

  // — 出片面板>截图路：视口截图 → toast 证图片节点已建 —
  await win.getByRole('button', { name: '视口截图', exact: true }).first().click()
  await win.waitForTimeout(900)
  if ((await win.getByText('已创建图片节点', { exact: false }).count()) > 0) ok('出片面板>视口截图通（图片节点已建）')
  else fail('视口截图后没见「已创建图片节点」toast')
  await exportBtn.first().click()
  await win.waitForTimeout(700)

  // — 出片：参考视频 → 产物卡片 + take 节点（frameCount 已裁剪）—
  await win.getByRole('button', { name: /参考视频/ }).first().click()
  await win.waitForTimeout(1000)
  const exportingCard = await win.getByText('参考视频生成中', { exact: false }).count()
  if (exportingCard > 0) ok('右下角产物卡片（生成中）已出')
  else fail('产物卡片没出')
  await shot('11-exporting-card.png')

  // 出片后带 flag 的 take 节点使 CameraMoveCaptureHost 挂载 → E2E 桥（__nomiCanvasStore）才可用，重试等它
  let takeInfo = null
  for (let i = 0; i < 12 && !takeInfo; i += 1) {
    takeInfo = await win.evaluate(() => {
      const store = window.__nomiCanvasStore
      const node = store?.getState().nodes.find((n) => n.title === '录制走位参考')
      return node ? { id: node.id, frameCount: node.meta?.cameraMoveAutoCapture?.frameCount ?? null } : null
    }).catch(() => null)
    if (!takeInfo) await win.waitForTimeout(500)
  }
  if (!takeInfo) {
    fail('「录制走位参考」take 节点没建出来')
  } else if (takeInfo.frameCount !== null && takeInfo.frameCount < 240) {
    ok(`take 节点已建（frameCount=${takeInfo.frameCount}，时长已裁到运动终点，非默认时间轴 10s×24=240）`)
  } else if (takeInfo.frameCount === null) {
    ok('take 节点已建（flag 已被捕获宿主消费）')
  } else {
    fail(`take 节点 frameCount=${takeInfo.frameCount}（等于默认 10s×24=240，时长没裁剪？）`)
  }

  // — 等离屏 mp4 落 meta.cameraMoveVideo —
  let videoUrl = null
  const deadline = Date.now() + 120000
  while (Date.now() < deadline && !videoUrl && takeInfo) {
    videoUrl = await win.evaluate((id) => {
      const store = window.__nomiCanvasStore
      const node = store?.getState().nodes.find((n) => n.id === id)
      return node?.meta?.cameraMoveVideo?.url ?? null
    }, takeInfo.id).catch(() => null)
    if (!videoUrl) await win.waitForTimeout(3000)
  }
  if (videoUrl) ok('离屏 mp4 已渲染：' + videoUrl)
  else fail('120s 内没等到 meta.cameraMoveVideo（离屏渲染没完成）')
  await win.waitForTimeout(800)

  // — P3-14：产物卡进完成态（去向 + 回画布按钮）—
  const doneCard = await win.getByText('参考视频已生成', { exact: false }).count()
  if (doneCard > 0) ok('产物卡完成态已出（含去向说明）')
  else fail('渲染完成后产物卡没进完成态')
  await shot('12-after-render.png')

  // — 点「回画布查看」关编辑器 → 画布 fit + take 节点带 mp4 在场（节点卡直接渲染视频，标题不在可见 DOM，用桥断言）—
  const goCanvasBtn = win.getByRole('button', { name: '回画布查看', exact: true })
  if ((await goCanvasBtn.count()) > 0) {
    await goCanvasBtn.first().click()
    ok('产物卡「回画布查看」可点（关编辑器动线）')
  } else {
    fail('产物卡缺「回画布查看」按钮，退回顶栏关闭')
    await win.getByTitle('退出 3D 场景').first().click()
  }
  await win.waitForTimeout(1800)
  const takeOnCanvas = await win.evaluate(() => {
    const store = window.__nomiCanvasStore
    const node = store?.getState().nodes.find((n) => n.title === '录制走位参考')
    return node ? { hasVideo: Boolean(node.meta?.cameraMoveVideo?.url) } : null
  }).catch(() => null)
  const videoEl = await win.locator('video').count()
  if (takeOnCanvas?.hasVideo && videoEl > 0) ok('关编辑器后 take 节点在画布且视频卡可播（fit 已框住）')
  else fail(`关编辑器后 take 节点状态异常（store=${JSON.stringify(takeOnCanvas)}, videoEl=${videoEl}）`)
  await shot('13-canvas-after.png')

  console.log(failures === 0 ? '\n✅ 出片旅程走查全过' : `\n❌ 走查有 ${failures} 项失败`)
  process.exitCode = failures === 0 ? 0 : 1
} catch (error) {
  console.error('✗ 走查中断：', error)
  process.exitCode = 1
} finally {
  await Promise.race([app.close(), new Promise((resolve) => setTimeout(resolve, 3000))]).catch(() => {})
  process.exit(process.exitCode ?? 0)
}
