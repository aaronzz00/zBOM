# zBOM 前端原型

zBOM 是一个面向复杂消费电子产品的智能 BOM 管理前端原型。当前仓库提供一个可运行、可演示、可测试的 React 单页工作台，用于验证工程、采购、管理员和只读查看者在 BOM、料库、供应链、ECO、SKU 矩阵与 EBOM/MBOM 协同流程中的核心路径。

当前三大生产核心模块（BOM Editor、Part Library、Tooling Hub）已接入统一的 durable core repository，mock 数据仅作为 seed。系统仍未接入真实远程后端、数据库服务、登录系统或 ERP 写回链路。

## 当前状态

| 维度 | 状态 |
| --- | --- |
| 运行形态 | React 18 + TypeScript + Vite 单页应用 |
| 数据来源 | 三大核心模块使用 `repositories/core` durable repository；其他预览模块仍以 mock/Zustand 为主 |
| 权限模型 | 已实现角色、字段级权限、商业字段可见性与关键操作 gating |
| 角色覆盖 | `ADMIN`、`ENG_LEAD`、`SOURCING`、`VIEWER` |
| 生产核心模块 | BOM Editor、Part Library、Tooling Hub |
| Development Preview | Dashboard、Product Matrix、EBOM Architecture、MBOM Delta、ECO、Compare、Supply Chain、Settings、ERP Setup |
| 前端测试 | Vitest + Testing Library |
| 构建优化 | 页面级 lazy loading + vendor chunk 拆分 |
| 后端/API | `services/ApiInterface.ts` 已代理核心 repository；真实远程服务未接入 |
| AI 能力 | Gemini 调用代码存在，需要 `GEMINI_API_KEY`，当前适合演示/预研 |

## 最近验证状态

最后一次完整验证日期：2026-06-05

- `./node_modules/.bin/vitest run --reporter=verbose`
  - 当前包含 core repository / production core flow / role use-case / navigation 回归
  - 20 个测试文件通过
  - 150 个测试用例通过
  - Recharts 测试环境宽高警告已消除
- `npm run build`
  - 构建通过
  - 主入口 chunk 约 22 kB
  - 无 Vite 500 kB chunk warning
  - 无 Recharts circular chunk warning
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
| `GEMINI_API_KEY=...` | 启用 Gemini AI 分析调用 |

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
- BOM 节点属性侧栏
- 自定义属性维护
- 附件添加与移除
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

### Compare Revisions

对当前 BOM 与历史快照做差异分析，识别新增、删除、修改和替代关系。Export Report 当前提供确定性的前端报告预览；Viewer 视角会屏蔽受保护成本。

### Part Library

生产核心料库模块是 Part 主数据源，支持搜索、分类筛选、列表/网格切换、详情侧栏编辑、价格阶梯维护、BOM 引用位置查看、Tooling linkage 查看、重复料号校验和 archive/deactivate。工程字段和商业字段分开授权，Sourcing 可以维护成本、交期、供应商、MOQ、SPQ、pricing tiers 等商业字段。

### Supply Chain

供应链模块展示供应商风险、区域分布、平均交期、高风险供应商和单一来源件等指标。搜索已支持供应商名称、国家、区域、类别和状态文本；风险报告和供应商审计按钮提供确定性前端预览。AI 风险提示以 `Simulated insight` 标识，避免误导为实时新闻。

### ECO Manager

工程变更模块提供 ECO 列表、详情、影响料件、审批历史和确定性的 draft 创建动作。当前仍是前端本地 mock 行为。

### Settings 和 ERP Connect

这两个入口现在路由到确定性的 setup/checklist 页面，用于前端测试和流程澄清，不代表真实配置或 ERP 集成已经落地。

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
- Settings、ERP Connect、Risk Report、Supplier Audit、Compare Export 等路径提供确定性前端预览或 checklist，不代表真实外部系统联通。
- AI 能力依赖外部 Gemini API key，缺少 key 时应视为演示能力不可用。
- 核心 repository 已具备角色策略层；仍不等同于真实服务端授权或安全边界。

## 后续演进建议

1. 接入真实认证、后端 API、数据库和审计日志。
2. 将 Zustand mock 写入迁移为可恢复的异步数据流。
3. 为 ERP、供应商审计、报告导出和 ECO 审批接入真实服务。
4. 建立端到端浏览器测试，覆盖角色登录、真实 viewport 和跨页面流程。
5. 补充后端级权限校验，确保前端权限和服务端授权一致。

## 结论

当前 zBOM 适合用于产品方案演示、NPI/工程/采购协同流程验证、BOM 平台需求澄清和企业系统实施前的交互打样。如果以生产系统衡量，下一阶段重点应放在真实数据、权限后端化、持久化和外部系统集成。
