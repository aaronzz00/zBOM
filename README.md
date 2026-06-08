# zBOM 前端原型

zBOM 是一个面向复杂消费电子产品的智能 BOM 管理前端原型。当前仓库提供一个可运行、可演示、可测试的 React 单页工作台，用于验证工程、采购、管理员和只读查看者在 BOM、料库、供应链、ECO、SKU 矩阵与 EBOM/MBOM 协同流程中的核心路径。

当前三大生产核心模块（BOM Editor、Part Library、Tooling Hub）已接入统一的 durable core repository，mock 数据仅作为 seed。P0 production foundation 已落地本地 Fastify API、SQLite/Prisma schema、session/RBAC、核心 read/write API、前端 API hydration 开关以及 AI provider 后端代理骨架。系统尚未接入生产远程后端、正式 SSO/OIDC 登录或 ERP 写回链路。

## 当前状态

| 维度 | 状态 |
| --- | --- |
| 运行形态 | React 18 + TypeScript + Vite 单页应用 |
| 数据来源 | 四大核心模块使用 `repositories/core` durable repository；其他预览模块仍以 mock/Zustand 为主 |
| 权限模型 | 已实现角色、字段级权限、商业字段可见性与关键操作 gating |
| 角色覆盖 | `ADMIN`、`ENG_LEAD` , `SOURCING` , `VIEWER` |
| 生产核心模块 | BOM Editor、Part Library、Tooling Hub、BOM Compare |
| Development Preview | Dashboard、Product Matrix、EBOM Architecture、MBOM Delta、ECO、Supply Chain、Settings、ERP Setup |
| 前端测试 | Vitest + Testing Library |
| 构建优化 | 页面级 lazy loading + vendor chunk 拆分 |
| 后端/API | `server/` 已新增 Fastify API、SQLite schema/seed、dev session/RBAC、Projects/Parts/BOM/Tooling read API、核心 mutation API 和审计写入 |
| 前端 API 迁移 | 配置 `VITE_API_BASE_URL` 后，App 启动和项目切换会从后端 hydrate BOM/Parts/Tooling；未配置时保留本地 repository fallback |
| AI 能力 | Settings > AI Provider 支持 OpenAI-compatible 配置；配置后端 API 时保存到 encrypted backend provider store，AI Assistant 走 `/api/ai/chat` proxy；无后端时仅保留前端内存直连模式，key 不再持久化到 localStorage |

## 最近验证状态

最后一次完整验证日期：2026-06-07

- `./node_modules/.bin/vitest run --reporter=verbose`
  - 当前包含 core repository / production core flow / role use-case / navigation / BOM Compare 左右对照以及属性面板 Tab 切换回归
  - 24 个根项目测试文件通过
  - 175 个测试用例通过
  - `.worktrees/**` 已从 Vitest discovery 中排除
  - Recharts 测试环境宽高警告已消除
- `npm run test:api`
  - 5 个 API 测试文件通过
  - 20 个 API/RBAC/session/core mutation/AI proxy 测试用例通过
- `npm run build:api`
  - API TypeScript typecheck 通过
- `npm run prisma:apply` + `npm run prisma:seed`
  - 本地 SQLite schema 建表和 demo seed 通过
  - seed 后核心计数：1 workspace / 4 users / 1 project / 12 parts / 13 BOM nodes / 3 tooling records / 1 AI provider config
- `npm run build`
  - 构建通过
  - 主入口 chunk 约 123 kB
  - 无 Vite 500 kB chunk warning
  - 无 Recharts circular chunk warning
- 本轮限制
  - 由于当前 workspace credit 限制，`tsx` dev server 提权启动被拒绝，未能完成 `VITE_API_BASE_URL` 模式下的本地浏览器联调截图；API 注入测试和前端 build/test 已覆盖主要行为。
- `npm run test:core-browser`
  - 本机 Chrome headless 浏览器 QA 通过
  - 覆盖 1440px desktop 与 390px narrow viewport
  - 覆盖 10 个页面/关键路径检查
  - 证据位于 `docs/user-tests/20260605-core-modules-production-usecase-check/browser-qa.json`
  - `docs/user-tests/20260604-role-usecase-hardening-final/supply-chain.png`

详细测试指引见 [docs/testing-guide.md](docs/testing-guide.md)。

## 本地运行

### 环境要求

- Node.js
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

默认 Vite 端口为 `3000`，本地访问：

```text
http://localhost:3000/
```

### 构建

```bash
npm run build
```

### 自动化测试

仓库当前未在 `package.json` 中定义 `test` script，请直接运行 Vitest：

```bash
./node_modules/.bin/vitest run --reporter=verbose
```

常用聚焦回归：

```bash
./node_modules/.bin/vitest run tests/RoleUseCases.test.tsx tests/AppNavigation.test.tsx tests/BOMTable.test.tsx --reporter=verbose
```

## 环境变量

默认情况下，系统以生产式角色测试状态运行：隐藏 demo 角色切换器和 QA 标注浮层。

| 变量 | 用途 |
| --- | --- |
| `VITE_ENABLE_DEMO_ROLE_SWITCHER=true` | 在侧边栏显示角色切换器，用于人工 walkthrough |
| `VITE_ENABLE_FEEDBACK_OVERLAY=true` | 显示 QA/UI 标注浮层 |
| `VITE_API_BASE_URL=http://localhost:3001` | 启用后端 API hydration 与 AI proxy |
| `VITE_ENABLE_LOCAL_REPOSITORY_FALLBACK=false` | API mode 下关闭本地 repository fallback，用于严格联调 |

AI Assistant 不再通过构建环境变量注入 key。请在应用内进入 `Settings > AI Provider`，配置 OpenAI-compatible base URL、model 和 API key。配置 `VITE_API_BASE_URL` 后，key 会提交到后端 encrypted provider store；未配置后端时，key 仅作为当前浏览器内存态使用，不再写入 `localStorage`。

示例：

```bash
VITE_ENABLE_DEMO_ROLE_SWITCHER=true npm run dev
```

## 业务模块

### Dashboard

项目级运行视图，展示 BOM 成本、最长交期、风险料件、发布就绪度、组件分布、成本 Pareto 和近期 ECO 活动。成本类内容受商业字段权限控制，Viewer 不会看到受保护成本。

### BOM Editor

生产核心 BOM 工作区，支持：

- `EBOM / MBOM` 视图切换
- `Tree / Matrix / Flat` 三种查看模式
- 虚拟滚动 BOM 表格
- **属性侧栏 Tab 面板**：重构为高级 Tab 结构，开发状态已全部封板并接入持久层，聚合展示以下六大部分信息：
  - **用量 (Usage)**: 用量 Qty、单位 Unit、Ref Des、Auxiliary (MBOM 辅助件标定)
  - **属性 (Attributes)**: 基本 Description、重量 Weight、物料单价 Cost、MOQ/SPQ 规则以及类型/项目相关的 Scoped Custom Attributes 动态字段
  - **文件 (Attachments)**: 支持关联设计规范或 3D 文件的上传、移除、在线预览及下载
  - **采购 AML (AML/AVL)**: 从料库主数据自动拉取并呈现关联 concrete part 的替代制造商物料清单
  - **工装 (Tooling)**: 直接调用 `coreRepository.getToolingLinksForPart(partId)` 接口查询并呈现该料件名下关联的模具、寿命进度、Milestones 里程碑节点状态，并提供一键转跳至 Tooling Hub 的链接按钮
  - **历史 (History)**: 展示 BOM 局部审计追踪（Audit Trail）以及快照备份
- CSV 导入/导出
- 快照创建
- Where Used 查询
- 从 Part Library 选择现有料号加入 BOM
- 创建 local/custom BOM item
- 同一 parent 下重复料号校验
- BOM 节点删除确认
- durable snapshot/repository 写入

Flat 视图面向采购审查，展示 MOQ、SPQ、采购数量、采购花费和超采成本等指标。

### Product Matrix

SKU 矩阵与产品配置中心，支持项目/系列/SKU 选择、候选 SKU 激活、冻结、抑制以及工作流上下文选择。生命周期类操作需要 `MANAGE_SKU_LIFECYCLE` 权限，Viewer 只能只读查看。

### EBOM Architecture

面向平台、系列和 PRO 结构的 EBOM 继承工作区，支持查看继承链、局部覆盖、锁定/解锁字段、添加本地子项、发布/重置 draft。修改类操作需要 `EDIT_EBOM_ARCHITECTURE` 权限，Viewer 只能只读查看。

### MBOM Delta

展示 SKU-first 的 MBOM delta，覆盖新增、删除、替换、数量变更、制造项和包装项，便于验证 EBOM 到 MBOM 的试制/量产差异。

### Tooling Hub

生产核心 tooling 工作区，以设计主件为中心展示 tooling 记录、里程碑、Kickoff 到 T1 的 lead time，以及一对多 concrete part 映射。已支持创建设计主件、创建 tooling record、从 Part Library 选择 concrete part，以及按权限更新 milestone 状态、计划/实际日期、owner、notes 和 blocker reason。

### BOM Compare

升级为正式的核心比对模块（BOM Compare），已去除 IN DEV 标示并列入 Production Core。支持：
- **双栏式（Side-by-Side）对比**：左侧 Baseline A 呈现旧版本，右侧 Target B 呈现新版本。
- **行级水平对齐**：新增/删除的料件会自动在其对立侧呈现空白 Placeholder 行，保证即使层级结构发生增删，两侧物料也能水平精确对齐。
- **差异状态图例**：中部呈现清晰的比对状态 Badge (Added, Removed, Changed, Unchanged)。
- **变动智能高亮**：对改动字段以黄色高亮背景标示，对整行增删提供红/绿偏色高亮，变动数值还会标示 delta 差值及升降趋势图标。
- **多项目比对**：支持独立切换左右两侧的项目及 Snapshot 快照，不再局限于单一 BOM 的版本历史比对。
- **导出报告**：提供基于 Markdown 的确定性报告前端预览。Viewer 视角下会自动隐藏和过滤商业/受保护成本字段。

### Part Library

生产核心料库模块是 Part 主数据源，支持搜索、分类筛选、列表/网格切换、详情侧栏编辑、价格阶梯维护、BOM 引用位置查看、Tooling linkage 查看、重复料号校验和 archive/deactivate。工程字段和商业字段分开授权，Sourcing 可以维护成本、交期、供应商、MOQ、SPQ、pricing tiers 等商业字段。

### Supply Chain

供应链模块展示供应商风险、区域分布、平均交期、高风险供应商和单一来源件等指标。搜索已支持供应商名称、国家、区域、类别和状态文本；风险报告和供应商审计按钮提供确定性前端预览。AI 风险提示以 `Simulated insight` 标识，避免误导为实时新闻。

### ECO Manager

工程变更模块提供 ECO 列表、详情、影响料件、审批历史和确定性的 draft 创建动作。当前仍是前端本地 mock 行为。

### Settings 和 ERP Connect

Settings 提供角色权限、阶段流程、全局列表、自定义字段和 AI Provider 的前端配置面板。ERP Connect 仍是确定性的 setup/checklist 页面，用于前端测试和流程澄清，不代表真实 ERP 集成已经落地。

## 角色与权限

当前角色矩阵的测试标准：

- `ADMIN`：拥有全部前端权限，可执行本地创建、报告预览和管理类路径。
- `ENG_LEAD`：可进行工程技术审查、BOM/EBOM 编辑、ECO 创建和 SKU 生命周期管理，不默认拥有商业字段维护权限。
- `SOURCING`：可查看供应链与商业字段，并维护采购/商业字段；不能编辑工程元数据。
- `VIEWER`：可导航到只读业务视图，不能看到受保护成本，不能触发 Product Matrix、EBOM Architecture 或 BOM mutation 类操作。

权限定义位于 `types.ts`，角色矩阵位于 `stores/useAuthStore.ts`。

## 技术结构

```text
.
├── App.tsx                 # 应用入口、页面路由和 lazy loading
├── pages/                  # 业务页面
├── components/             # 复用组件
├── stores/                 # Zustand 状态管理
├── repositories/           # 前端 repository 抽象与 durable core repository
├── services/               # 业务服务与外部接口占位
├── data/                   # mock 业务数据
├── domain/                 # EBOM/MBOM 等领域逻辑
├── utils/                  # CSV、BOM flatten、版本比对等工具
├── tests/                  # 单元、组件和角色 use-case 回归测试
├── docs/                   # 测试证据、计划和交付说明
├── schemas.ts              # Zod 数据校验
└── types.ts                # 核心类型与权限定义
```

## 测试与证据入口

- 当前测试指引：[docs/testing-guide.md](docs/testing-guide.md)
- core production Wave 0 发现与 Wave 1 方案：`docs/user-tests/20260605-core-modules-production-wave0/wave0-discovery-and-wave1-plan.md`
- core production use-case QA：`docs/user-tests/20260605-core-modules-production-usecase-check/`
- 第二轮前端 use-case 标准与原始结果：`docs/user-tests/20260604-frontend-usecase-round2/round2-usecase-frontend-check.md`
- role/use-case hardening wave 计划：`docs/superpowers/plans/2026-06-04-zbom-role-usecase-hardening-subagent-plan.md`
- 最终 pass/fail 报告：`docs/user-tests/20260604-role-usecase-hardening-final/final-pass-fail-report.md`

## 当前边界

- 这是本地生产核心流程原型，不是完整企业生产系统。
- 三大核心模块通过 durable repository 保留本地核心数据；非核心 Development Preview 模块仍可能回到 mock 初始状态。
- ERP Connect、Risk Report、Supplier Audit、Compare Export 等路径提供确定性前端预览或 checklist，不代表真实外部系统联通。
- AI 能力支持 OpenAI-compatible provider；后端 API mode 已具备 encrypted provider store 和 server-side proxy，本地无后端模式仅为原型 fallback。
- 核心 repository 已具备角色策略层，API mode 已新增服务端 RBAC；仍需接正式认证、生产数据库和部署级安全边界。

## 后续演进建议

1. 接入正式 SSO/OIDC、Postgres、生产部署和密钥管理。
2. 将核心 mutation UI 从本地 repository 写入继续迁移到 API command。
3. 为 ERP、供应商审计、报告导出和 ECO 审批接入真实服务。
4. 建立端到端浏览器测试，覆盖 API mode、角色登录、真实 viewport 和跨页面流程。
5. 扩展服务端权限校验到项目 phase transition、CSV import、AVL 和 audit read API。

## 结论

当前 zBOM 适合用于产品方案演示、NPI/工程/采购协同流程验证、BOM 平台需求澄清和企业系统实施前的交互打样。如果以生产系统衡量，下一阶段重点应放在真实数据、权限后端化、持久化和外部系统集成。
