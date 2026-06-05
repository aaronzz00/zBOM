# zBOM 测试指引

本文档是当前 zBOM 前端测试的入口，覆盖自动化测试、浏览器 use case、角色标准、证据目录和已知限制。

最后更新：2026-06-05

## 测试目标

当前测试重点不是验证真实后端，而是确保前端原型在不同使用角色下具备稳定、可解释、可回归的使用路径。

重点覆盖：

- Viewer 只读与商业数据保护
- Sourcing 商业字段维护
- Engineer 技术审查和 EBOM draft edit
- Admin 本地管理动作和确定性预览
- Supply Chain 搜索、风险提示和报告入口
- QA/demo chrome 默认隐藏
- 窄屏 shell 可用性
- 图表、弹窗、icon-only 控件和键盘交互稳定性

## 快速命令

### 安装依赖

```bash
npm install
```

### 启动本地服务

```bash
npm run dev
```

访问：

```text
http://localhost:3000/
```

### 显示角色切换器做人工测试

默认角色切换器隐藏。需要人工走不同角色路径时启动：

```bash
VITE_ENABLE_DEMO_ROLE_SWITCHER=true npm run dev
```

QA 标注浮层默认隐藏。如需检查标注功能：

```bash
VITE_ENABLE_FEEDBACK_OVERLAY=true npm run dev
```

### 全量自动化回归

```bash
./node_modules/.bin/vitest run --reporter=verbose
```

当前基线：

- 18 个测试文件通过
- 131 个测试用例通过

### 角色/use-case 聚焦回归

```bash
./node_modules/.bin/vitest run tests/RoleUseCases.test.tsx --reporter=verbose
```

### Shell、导航与可访问性聚焦回归

```bash
./node_modules/.bin/vitest run tests/AppNavigation.test.tsx tests/BOMTable.test.tsx --reporter=verbose
```

### Phase 1 工作流聚焦回归

```bash
./node_modules/.bin/vitest run tests/ProductMatrixCenter.test.tsx tests/PhaseOneWorkflowPages.test.tsx --reporter=verbose
```

### 构建验证

```bash
npm run build
```

当前构建基线：

- 构建通过
- 主入口 chunk 约 21 kB
- 无 Vite 500 kB chunk warning
- 无 Recharts circular chunk warning

## 自动化测试地图

| 文件 | 覆盖重点 |
| --- | --- |
| `tests/RoleUseCases.test.tsx` | 角色 use-case 标准、商业字段保护、Sourcing 维护、Admin 本地动作、Supply Chain 预览、Settings/ERP setup |
| `tests/AppNavigation.test.tsx` | 页面导航、Viewer 可见模块、窄屏 shell 约束 |
| `tests/BOMTable.test.tsx` | BOM 表格、Columns 菜单、键盘关闭与可访问状态 |
| `tests/ProductMatrixCenter.test.tsx` | SKU 生命周期操作与产品矩阵工作流 |
| `tests/PhaseOneWorkflowPages.test.tsx` | Product Matrix -> EBOM Architecture -> MBOM Delta -> Tooling 的跨模块流程 |
| `tests/authStore.test.ts` | 角色切换和权限矩阵 |
| `tests/*Store.test.ts` | 各业务 store 的状态和领域行为 |
| `tests/*Repository.test.ts` | 前端 repository 行为和数据隔离 |
| `tests/*Engine.test.ts` / `tests/*Composition.test.ts` | BOM 公式、EBOM 继承、MBOM 组合等领域逻辑 |

## 浏览器 Use Case 标准

人工测试应只通过前端 UI 执行。需要多角色 walkthrough 时，使用：

```bash
VITE_ENABLE_DEMO_ROLE_SWITCHER=true npm run dev
```

### Admin

| ID | 目标 | 路径 | 通过标准 |
| --- | --- | --- | --- |
| UC-A1 | Dashboard governance review | Admin -> Dashboard | KPI、成本、图表、近期 ECO 可见；图表稳定；QA 浮层默认不遮挡 |
| UC-A2 | BOM workspace entry | Admin -> BOM Editor | Tree/Matrix/Flat 和 EBOM/MBOM 可切换；snapshot/import/export/Add 等入口有可见结果或明确状态 |
| UC-A3 | Add BOM item | Admin -> BOM Editor -> Add Item | 打开真实本地表单，包含 parent、part number、name、quantity、unit、type、save/cancel 和校验 |

### Engineer

| ID | 目标 | 路径 | 通过标准 |
| --- | --- | --- | --- |
| UC-E1 | ECO technical review | Engineer -> Change Orders | 可查看 reason、impact、revision change、workflow history；create action 不再是 inert button |
| UC-E2 | EBOM draft edit entry | Engineer -> EBOM Architecture -> editable item -> Edit | edit form 可打开；draft 操作、publish/reset 权限清晰 |

### Sourcing

| ID | 目标 | 路径 | 通过标准 |
| --- | --- | --- | --- |
| UC-S1 | Supplier risk triage | Sourcing -> Supply Chain -> search/filter -> expand supplier | 搜索会过滤行；无结果有 empty state；风险 insight 有 `Simulated insight` 和静态时间 |
| UC-S2 | Commercial part maintenance | Sourcing -> Part Library -> search part -> Edit | cost、lead time、supplier、MOQ、SPQ、pricing tiers 等商业字段可编辑；工程元数据可保持受限 |
| UC-S3 | Procurement flat BOM review | Sourcing -> BOM Editor -> Flat | 可审查 MOQ、SPQ、required/buy quantity、spend、excess inventory；导出/报告入口有可见结果或明确状态 |

### Viewer

| ID | 目标 | 路径 | 通过标准 |
| --- | --- | --- | --- |
| UC-V1 | Dashboard read-only review | Viewer -> Dashboard | 成本和成本图表受保护；非成本风险、就绪度和 ECO summary 仍可用 |
| UC-V2 | BOM read-only review | Viewer -> BOM Editor | Add/import/edit 等 mutation 控制不可用；成本不泄露；读导航可用 |
| UC-V3 | Product Matrix read-only review | Viewer -> Product Matrix | Select Workflow、Activate、Freeze、Suppress 等 lifecycle 控制禁用或隐藏 |
| UC-V4 | EBOM Architecture read-only review | Viewer -> EBOM Architecture | Edit、Add Local Item、Apply Override、Lock/Unlock、Publish、Reset Draft 等 mutation 控制禁用或隐藏 |

### Cross-Role

| ID | 目标 | 路径 | 通过标准 |
| --- | --- | --- | --- |
| UC-C1 | Narrow viewport usability | 390 x 844 viewport -> Dashboard | sidebar 收窄为 rail；main content 不被固定 sidebar 挤掉；核心内容可读 |
| UC-C2 | QA/demo chrome gating | 默认环境 -> 任意页面 | Feedback overlay 和 demo role switcher 默认隐藏；仅显式 env flag 开启 |

## 最终通过状态

本轮 hardening 后的最终结果：

- P0 role/security use cases 通过。
- Viewer 不再看到 Part Library 和 Compare 中的受保护成本。
- Viewer 在 Product Matrix 和 EBOM Architecture 中没有可用 mutation 控制。
- Sourcing 可以维护商业字段。
- Supply Chain 搜索和 no-match empty state 可用。
- Admin Add Item、ECO draft、Risk Report、Supplier Audit、Compare Export、Part Library Create Part、Settings、ERP Connect 均有确定性前端行为。
- Header identity 绑定当前用户。
- Feedback overlay 默认隐藏。
- 窄屏 shell 已由响应式回归测试和浏览器 smoke 覆盖。

## 证据目录

| 路径 | 内容 |
| --- | --- |
| `docs/user-tests/20260604-role-frontend-audit/role-frontend-audit.md` | 第一轮多角色前端审计 |
| `docs/user-tests/20260604-frontend-usecase-round2/round2-usecase-frontend-check.md` | 第二轮 use-case 标准和原始失败结果 |
| `docs/superpowers/plans/2026-06-04-zbom-role-usecase-hardening-subagent-plan.md` | sub-agent driven wave 修改计划和完成状态 |
| `docs/user-tests/20260604-role-usecase-hardening-final/final-pass-fail-report.md` | 最终 pass/fail 报告 |
| `docs/user-tests/20260604-role-usecase-hardening-final/dashboard.png` | Dashboard 最终截图 |
| `docs/user-tests/20260604-role-usecase-hardening-final/supply-chain.png` | Supply Chain 最终截图 |

## 已知限制

- 当前权限 hardening 仅发生在前端，不能替代后端授权。
- 数据是 mock/in-memory，刷新后不会保留业务变更。
- Settings、ERP Connect、Risk Report、Supplier Audit、Compare Export 等是确定性前端预览或 checklist，不代表真实外部服务已接通。
- AI 分析依赖 `GEMINI_API_KEY`，缺少 key 时应视为不可用。
- in-app Browser 工具曾阻止 synthetic `data:` 390px viewport harness，因此窄屏证据采用响应式回归测试和直接浏览器 smoke，而不是保存的 synthetic 390px 截图。

## 回归前检查清单

- [ ] `npm install` 已完成，依赖版本与 lockfile 一致。
- [ ] `./node_modules/.bin/vitest run --reporter=verbose` 通过。
- [ ] `npm run build` 通过。
- [ ] 默认启动时 QA/demo chrome 隐藏。
- [ ] 需要人工角色 walkthrough 时已显式开启 `VITE_ENABLE_DEMO_ROLE_SWITCHER=true`。
- [ ] 新增或修改的 use case 已映射到 `tests/RoleUseCases.test.tsx` 或本文件的浏览器 use-case 表。
