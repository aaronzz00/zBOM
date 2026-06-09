# Tooling Hub Overhaul — Consolidated Implementation Plan

## Goal

将 Tooling Hub 从"平铺表格"重构为"信息分层清晰、类型可区分、进度一目了然"的工程管理界面。在保持 Mock 模式与 API 模式双重兼容的前提下，打通前后端对 Tooling 增删改查及生命周期的全流程数据同步。

---

## 核心设计决策

### 1. Tooling 数据模型与类型重构

```typescript
// 新增 ToolingCategory，对模具/夹具/检具类型做明确区分
type ToolingCategory =
  | 'injection-mold' | 'stamping-die' | 'die-cast-mold'
  | 'mim-mold' | 'press-mold' | 'gauge'
  | 'fixture' | 'jig' | 'other';

// 新增 ToolingStatus（T1 后的生命周期状态）
type ToolingStatus =
  | 'pending'             // 尚未开始
  | 'in-progress'         // 开模/制作中
  | 't1-complete'         // T1 完成
  | 'in-modify'           // 修模中
  | 'approved'            // 合格
  | 'approved-next-build' // 批准用于下一个 build
  | 'on-hold'             // 暂停
  | 'scrapped';           // 报废

interface Tooling {
  id: string;
  projectId: string;
  designMasterPartId: string;
  toolingNumber: string;   // 自动编号: TL-INJ-001
  name: string;
  type: ToolingCategory;
  status: ToolingStatus;   // 生命周期状态
  supplier?: string;
  cavityCount?: number;
  owner?: string;
  leadTimeDays?: number;   // Kickoff → T1 的天数（固定值）
  milestones: ToolingMilestone[];
}
```

### 2. Milestone 日期与状态的解耦设计

用户反馈：不关心 DFM/Quotation 的具体执行时间，而更关心其自身状态。Kickoff 是核心时间锚点，T1 = Kickoff + L/T。
- **drawingRelease / dfm / quotation**：只跟踪 status（`not-started` | `in-progress` | `done` | `blocked`），前端界面不再展示其 plannedDate 和 actualDate，不强制要求填写日期。
- **kickoff**：跟踪 plannedDate + actualDate，作为核心时间锚点。
- **t1**：plannedDate 变为只读属性，由 `kickoff.plannedDate + leadTimeDays` 自动推算得到；actualDate 由用户手动填写表示实际完成时间。

### 3. 自动编号规则与映射

为所有 Tooling 添加 `toolingNumber`，格式为 `TL-{PREFIX}-{SEQUENTIAL}`（例如：`TL-INJ-001`）。
前缀映射：
- `injection-mold` -> `TL-INJ`
- `stamping-die` -> `TL-STP`
- `die-cast-mold` -> `TL-DCM`
- `mim-mold` -> `TL-MIM`
- `press-mold` -> `TL-PRS`
- `gauge` -> `TL-GAU`
- `fixture` -> `TL-FIX`
- `jig` -> `TL-JIG`
- `other` -> `TL-OTH`

在新增 Tooling 或修改 Tooling 类型时，根据当前 Workspace 中同类型 Tooling 的数量自动进行增量编号。

### 4. API 模式同步机制补全

为了彻底解决 API 模式下创建/修改 Tooling 记录在刷新后丢失的问题，必须补全 Fastify 后端路由与服务：
- **`POST /api/tooling`**：创建 Tooling 记录，入参包括 `designMasterPartId`、`name`、`type`、`leadTimeDays`、`supplier`、`cavityCount`、`owner`。在后台自动派生 `toolingNumber`，并默认生成 5 个未开始的 `ToolingMilestone`。
- **`PATCH /api/tooling/:toolingId`**：更新 Tooling 基础信息，入参包括 `name`、`type`、`status`、`leadTimeDays`、`supplier`、`cavityCount`、`owner`。如果 `type` 发生改变，则同步重新计算 `toolingNumber`。

---

## Affected Files Map

### Domain Layer
| File | Action | Scope |
|------|--------|-------|
| [toolingTypes.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/domain/toolingTypes.ts) | MODIFY | 引入 `ToolingCategory` 和 `ToolingStatus` 枚举值与常量映射，更新 `Tooling` 接口。 |
| [coreTypes.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/domain/coreTypes.ts) | MODIFY | 更新 `ToolingRecord` 和 `CreateToolingRecordInput` 的类型契约。 |

### Shared API Types
| File | Action | Scope |
|------|--------|-------|
| [apiTypes.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/shared/apiTypes.ts) | MODIFY | 更新 `ApiToolingRecord` 的字段，增加 `ApiToolingRecordMutationResponse` 接口契约。 |

### Server (Backend API Mode)
| File | Action | Scope |
|------|--------|-------|
| [schema.prisma](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/server/db/schema.prisma) | MODIFY | 增加 `ToolingRecord` 模型的 `toolingNumber`、`type`、`status`、`leadTimeDays` 字段映射。 |
| [tooling.ts (route)](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/server/routes/tooling.ts) | MODIFY | 补全 `GET /` 映射，增加 `POST /` 及 `PATCH /:toolingId` 接口实现与 Zod 校验。 |
| [seed.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/server/db/seed.ts) | MODIFY | 按照重构后的数据模型，为现有 3 个种子记录填充重构属性。 |
| `server/db/migrations/` | [NEW] | 编写包含 ALTER TABLE 语法的 Raw SQL 迁移文件，确保数据架构就绪。 |

### Client Data Layer
| File | Action | Scope |
|------|--------|-------|
| [mockTooling.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/data/mockTooling.ts) | MODIFY | 更新 3 个 Mock 记录的属性（`type`、`status`、`toolingNumber`、`leadTimeDays`）。 |
| [coreValidation.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/repositories/core/coreValidation.ts) | MODIFY | 增加 `validateToolingRecordInput` 和 `validateToolingRecordUpdates` 工具函数，用于核心存储的校验。 |
| [coreRepository.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/repositories/core/coreRepository.ts) | MODIFY | 调整 `createToolingRecord` 与 `updateToolingRecord` 实现以支持新增字段，引入校验并输出审计事件。 |
| [backendApi.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/services/backendApi.ts) | MODIFY | 封装 `createBackendTooling` 与 `updateBackendTooling`，同步扩展 `toToolingRecord` 映射方法。 |
| [useToolingStore.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/stores/useToolingStore.ts) | MODIFY | 调整 `createTooling` 和 `updateTooling` 逻辑，识别并向后端 API 派发更新请求，编写 T1 计划时间自动生成逻辑。 |

### Frontend Pages
| File | Action | Scope |
|------|--------|-------|
| [ToolingHub.tsx](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/pages/ToolingHub.tsx) | MODIFY | 升级 KPI 栏、新增 Toolbar 过滤/分组状态、重新设计表格列显示（加入里程碑圆点指示器）、重构创建表单及滑出详情面板。 |
| [Dashboard.tsx](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/pages/Dashboard.tsx) | MODIFY | 增加 "Tooling Progress" 概览卡片，点击即可快速导航。 |

---

## Sub-Agent Task Decomposition

### Task 1: Domain Model & Type Definitions
- **Goal**: 定义核心业务类型和底层 structure 契约，为整个重构提供类型支持。
- **Scope**: 修改模型层，不包含业务逻辑和界面开发。
- **Files**:
  - [toolingTypes.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/domain/toolingTypes.ts)
  - [coreTypes.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/domain/coreTypes.ts)
- **Requirements**:
  1. `toolingTypes.ts` 中新增 `ToolingCategory` 和 `ToolingStatus` 的 Type，并分别增加常量映射 `TOOLING_CATEGORY_PREFIX`、`TOOLING_CATEGORY_LABELS` 和 `TOOLING_STATUS_LABELS`。
  2. 扩展 `Tooling` 接口，增加 `toolingNumber`、`type`、`status`、`leadTimeDays` 可选属性。
  3. `coreTypes.ts` 中更新 `ToolingRecord` 以及 `CreateToolingRecordInput` 类型，使其与 `Tooling` 接口同步。
- **Verification**: `npm run build` 无基础类型冲突，但可能存在未修改文件的类型报错，这属于正常现象。

---

### Task 2: Server Database Schema & Fastify Routes
- **Goal**: 拓展数据库存储，构建 REST 服务，为前端提供 API 数据支持。
- **Scope**: 处理 Prisma 映射、编写 SQL 迁移、封装 Fastify API 接口并重构种子数据。
- **Files**:
  - [schema.prisma](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/server/db/schema.prisma)
  - [apiTypes.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/shared/apiTypes.ts)
  - [tooling.ts (route)](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/server/routes/tooling.ts)
  - [seed.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/server/db/seed.ts)
- **Requirements**:
  1. 在 `schema.prisma` 中为 `ToolingRecord` 增加 `toolingNumber`（默认 `""`）、`type`、`status`（默认 `"pending"`）和 `leadTimeDays` 字段。
  2. 封装新的 SQL 迁移，通过 `ALTER TABLE "ToolingRecord" ADD COLUMN...` 保证本地 SQLite 数据库成功兼容。
  3. 在 `apiTypes.ts` 中加入 `ApiToolingRecord` 新字段以及 `ApiToolingRecordMutationResponse` 结构。
  4. 修改 `server/routes/tooling.ts`，增加 `POST /`（创建 Tooling) 和 `PATCH /:toolingId`（更新基础信息）路由。使用 Zod 做入参验证，在 `POST` 请求中根据类型前缀和同类型已有记录数自动分配 `toolingNumber`。
  5. 调整 `seed.ts` 中三条模具记录的值以符合新格式。
- **Verification**: 运行 `npx prisma validate` 成功，运行 `npm run build` 服务器端代码编译通过。

---

### Task 3: Client Data Layer Integration (Store & Repository)
- **Goal**: 升级客户端底层的状态管理器和核心持久化，打通 API 及 Mock 双向逻辑。
- **Scope**: 添加校验逻辑，扩展 Zustand store 动作，适配接口参数。
- **Files**:
  - [coreValidation.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/repositories/core/coreValidation.ts)
  - [coreRepository.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/repositories/core/coreRepository.ts)
  - [backendApi.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/services/backendApi.ts)
  - [useToolingStore.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/stores/useToolingStore.ts)
  - [mockTooling.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/data/mockTooling.ts)
- **Requirements**:
  1. 在 `coreValidation.ts` 中增加 `validateToolingRecordInput` 和 `validateToolingRecordUpdates`，确保 `type` 与 `status` 不超出枚举区间。
  2. 重写 `coreRepository.ts` 的 `createToolingRecord` 和 `updateToolingRecord`，执行前置校验，自动根据同类累计数序列递增分配 `toolingNumber`（如: `TL-INJ-002`），生成对应的审计日志事件。
  3. 修改 `mockTooling.ts` 以提供包含新增字段的种子记录。
  4. 封装 `backendApi.ts` 的 `createBackendTooling` 与 `updateBackendTooling` 函数，分别请求对应 API。
  5. 修改 `useToolingStore.ts` 的 `createTooling` 和 `updateTooling` 动作：当 `isBackendApiConfigured()` 为真时，发送 API 异步请求并更新本地状态；在 Mock 模式下，直接调用 `coreRepository` 方法。
  6. 在 `useToolingStore.ts` 中提供 `getT1PlannedDate` 辅助函数，通过 `kickoff.plannedDate + leadTimeDays` 计算 T1 计划时间。
- **Verification**: 执行 `npm run build` 和 `npm run test`（确保已有测试不回退）。

---

### Task 4: ToolingHub UI — KPI Summary Card & Filters Toolbar
- **Goal**: 重构 Tooling Hub 顶部的 KPI 概览和搜索过滤工具栏，解决初始信息乱的问题。
- **Scope**: 重构 `ToolingHub.tsx` 的上方区域布局。
- **Files**:
  - [ToolingHub.tsx](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/pages/ToolingHub.tsx)
- **Requirements**:
  1. **ZONE 1: KPI Summary**: 增加五个状态卡片：Total Tooling、Completed (状态为 `approved` / `approved-next-build`)、In-Progress (状态为 `in-progress`)、Blocked (任何里程碑状态为 `blocked`）、Avg L/T（所有有效记录的 leadTimeDays 平均值）。
  2. 在 KPI 下方加入可折叠的 "Active Blockers" 列表，汇总并高亮哪些模具在哪里遇到了 Blocked 状态。
  3. **ZONE 2: Toolbar**: 提供过滤及分组工具栏，包含模糊搜索框（支持编号/名称/供应商/DMP 代码匹配），ToolingCategory 过滤下拉菜单，ToolingStatus 过滤下拉菜单。
  4. 提供 "Group by" 下拉菜单，选项为："None" | "Type" | "Design Master Part"。选中后，通过计算生成对应的分组折叠列表。
- **Verification**: 进入浏览器，确认 KPI 卡片能够反应真实的模具数据；输入搜索框，数据表可立即反应。

---

### Task 5: ToolingHub UI — Main Table Redesign
- **Goal**: 升级模具主表格的列展示与操作，使其具备高类型可区分度和直观进度。
- **Scope**: 更新 `ToolingHub.tsx` 的表格渲染逻辑。
- **Files**:
  - [ToolingHub.tsx](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/pages/ToolingHub.tsx)
- **Requirements**:
  1. 表格列重构为：
     - **Tooling**: 加粗显示自动生成的编号（mono 字体，如 `TL-INJ-001`），副文本展示 Tooling Name。
     - **Type**: 圆点色彩高亮 + 缩写 Badge（例如：INJ、STP、MIM 等），且行的左侧边框颜色对应所属类型。
     - **Design Master**: 显示 DMP Code + Name。
     - **Supplier / L/T**: 显示供应商和 Lead Time，并在 Lead Time 栏提供 Tooltip 展示推导出的计划 T1 日期。
     - **Milestones**: 将原本平铺的里程碑精简为一个进度条，包含 5 个小圆点指示器，绿色代表已完成，蓝色（带呼吸效果）代表进行中，红色代表 Blocked，灰色代表未开始。Hover 指示器时提示该里程碑的详情。
     - **Status**: 汇总生命周期状态 Badge。
  2. 重新配置模具创建表单：去除用户手动输入 `toolingNumber` 的输入框（改为由后端或状态库自动派发），替换为 "Type" 下拉菜单 and "Lead Time (Days)" 的必填字段。
- **Verification**: 访问 UI 界面，确认能直观区分不同的 Tooling，每行均正确配置侧边框和 5 点进度灯。

---

### Task 6: ToolingHub UI — Slide-out Detail Panel Overhaul
- **Goal**: 重构右侧详情面板，解耦无用字段，支持快速维护状态与日期。
- **Scope**: 修改 `ToolingHub.tsx` 的详情面板内容与交互。
- **Files**:
  - [ToolingHub.tsx](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/pages/ToolingHub.tsx)
- **Requirements**:
  1. 详情面板分为三个标签页：Overview、Links（保留原有功能）、Milestones。
  2. **Overview 标签页**：
     - 置顶显示大字号 Tooling Number 和 Tooling Name。
     - 增加 `ToolingStatus` 的生命周期转换下拉菜单（具有 MANAGE_TOOLING 权限时可用）。
     - 信息网格展示：Supplier、Cavities、Lead Time。
     - 显式展示 **T1 推算计划日期**，如果当前时间已超过 T1 计划时间且未合格，显示延期红字警告。
  3. **Milestones 标签页**：
     - 为 5 个 Milestone 提供状态变更（`not-started` | `in-progress` | `done` | `blocked`）下拉菜单。
     - 如果某里程碑被改为 `blocked`，激活展示 blockerReason 文本输入框。
     - **日期控件差异化**:
       - 只有 `kickoff` 展示 plannedDate 和 actualDate 输入框。
       - `t1` 的 plannedDate 设为只读并展示自动推导的时间，只提供 actualDate 的时间选择框。
       - `drawingRelease`、`dfm`、`quotation` 标签下**彻底移除所有的日期输入组件**，仅保留状态控制下拉框。
- **Verification**: 打开详情面板，验证更新 Lifecycle 状态能即时生效；验证 Milestone 的状态调整在保存后正确反映回主表格 of 5 点指示灯。

---

### Task 7: Dashboard Integration & Export CSV
- **Goal**: 将 Tooling 状态汇总融入大盘仪表盘，并提供符合过滤条件的 CSV 导出。
- **Scope**: 更新仪表盘页面，增加导出功能。
- **Files**:
  - [Dashboard.tsx](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/pages/Dashboard.tsx)
  - [ToolingHub.tsx](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/pages/ToolingHub.tsx)
- **Requirements**:
  1. 在 `Dashboard.tsx` 页面 KPI 排列中，新增 "Tooling Progress" 卡片，内容显示 `完成模具数 / 总模具数` 的百分比进度条，下方附加 `X blocked | Y delayed` 副标题，点击卡片能跳转导航至 Tooling Hub 页面。
  2. 在 Tooling Hub 工具栏中引入 "Export CSV" 按钮，下载经过过滤查询过滤后的当前视图中的模具明细。
  3. 导出的列包括：Tooling Number, Name, Type, Design Master, Supplier, Owner, Cavities, Lead Time, Status, 5 个里程碑的各自状态、Kickoff 计划/实际日期、T1 计划/实际日期。
- **Verification**: 仪表盘显示数据正常并能够正常跳转；过滤查询后，导出的 CSV 文件包含正确匹配 of 模具信息。

---

## Verification Plan

### Automated Tests
- 执行 API 存储测试：
  `npx vitest tests/storesApiMode.test.tsx`
- 执行 Tooling 状态与 Lead Time 计算逻辑测试：
  `npx vitest tests/toolingStore.test.ts`
- 执行 Repository 测试：
  `npx vitest tests/coreRepository.test.ts`
- 运行最终的整体编译检查：
  `npm run build`

### Manual Verification
1. 启动本地开发服务：`npm run dev`
2. 进入 Tooling Hub 界面，创建不同分类的模具，验证 `toolingNumber` 自动递增生成（例如：`TL-INJ-001`, `TL-MIM-001`）。
3. 选择模具，设置 Kickoff 计划日期与 Lead Time，确认详情页能自动计算出 T1 的 plannedDate。
4. 切换里程碑状态为 `blocked`，验证 KPI 卡片上的 Blocked 计数增加，且 Blockers 折叠区渲染详情。
5. 过滤某类型模具，点击 Export CSV，核实所导出的文件无错漏且只包含过滤数据。
6. 进入 Dashboard，观察 "Tooling Progress" 卡片数值同步并支持正确跳转。

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| 是否需要在 API 模式下更新数据库结构 | ✅ 需要，创建 SQLite 表结构 ALTER 迁移，补全 `schema.prisma`。 |
| API 模式下的持久化接口是否齐备 | ❌ 缺失，需要在后端 Fastify 路由补齐 `POST /` 与 `PATCH /:toolingId` 接口实现全同步。 |
| 是否需要细分权限控制 | ✅ 暂不需要，沿用 `MANAGE_TOOLING` 对所有的更改做校验。 |
| Milestone 能否实现弹性的日期处理 | ✅ 可以，只有 kickoff 和 t1 维持日期交互，其余 3 个精简为纯状态流转。 |
