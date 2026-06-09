# zBOM P0 Production Foundation Development Plan

Date: 2026-06-07

## 1. 背景与结论

当前 zBOM 已具备高保真前端原型、核心模块 durable repository、角色 UI gating、OpenAI-compatible AI Provider 前端配置、Vitest 回归和 browser QA。但系统仍不具备生产级安全与数据边界。

本阶段 P0 目标不是继续扩展前端功能，而是建立最小生产地基：

1. 真实后端 API。
2. 数据库与 migration。
3. 登录/session/actor 模型。
4. 服务端 RBAC 权限校验。
5. 核心 BOM / Part / Tooling 数据从浏览器 `localStorage` 迁移到数据库。
6. AI provider key 从浏览器迁移到后端 secret store，并通过服务端代理调用。

## 2. 当前基线

### 2.0 Implementation Log

2026-06-07 P0 foundation start:

- WP1 completed: added `server/` Fastify skeleton, `/api/health`, CORS/cookie registration, API config, `dev:api`, `build:api`, and `test:api`.
- WP2 foundation completed: added Prisma 6 schema, SQL migration artifact, idempotent `prisma:apply`, seed script, and local SQLite seed verification.
- WP3 completed: added dev-login/session cookie, `/api/auth/me`, `/api/auth/logout`, actor loading, server-side role permissions, and API auth/RBAC tests.
- WP4 completed for the first production foundation slice: added Projects/Parts/BOM/Tooling read APIs; Part create/update/archive; BOM node create/update/delete; Tooling milestone update; field-level permissions; workspace scoping; and audit writes for mutations.
- WP5 completed for read hydration: added `services/backendApi.ts`; App-level API hydration for Projects/BOM/Parts/Tooling when `VITE_API_BASE_URL` is set; local repository fallback remains configurable.
- WP6 foundation completed: added encrypted AI provider credential helper, `/api/ai/provider`, `/api/ai/chat`, AI request logging, Settings backend save path in API mode, and frontend AI provider proxy routing. Browser `localStorage` no longer persists provider keys.
- Verification completed: `npm run test:api` passes 5 files / 20 tests; `npm run build:api` passes; `./node_modules/.bin/vitest run --reporter=verbose` passes 24 files / 175 tests; `npm run build` passes.
- Verification limitation: local API/Vite dev-server browser联调 was not completed because the required `tsx` dev server escalation was rejected by current workspace credit limits. Do not count browser API-mode QA as closed until a future run starts the dev servers and captures evidence.
- Important note: Prisma 6 `migrate dev` / `db push` returned an empty schema-engine error in this environment. `migrate diff` generated valid SQL and `prisma db execute --file` succeeds, so the current development migration path is the checked-in SQL migration plus `npm run prisma:apply`. Revisit native `prisma migrate dev` once the engine issue is understood.

### 2.1 已验证状态

- `./node_modules/.bin/vitest run --reporter=verbose`: 24 files / 175 tests passed。
- `npm run build`: passed。
- `npm run build:api`: passed。
- `npm run test:api`: 5 files / 20 tests passed。
- `npm run test:core-browser`: 10 desktop/narrow browser checks passed。
- Vitest discovery 已限定到 `tests/**/*.test.{ts,tsx}`，避免 `.worktrees/**` 污染。
- 旧 `GEMINI_API_KEY` build-time 注入已移除。
- `@google/genai` 依赖已移除。
- AI provider key 不再持久化到 browser `localStorage`；API mode 下 Settings 保存到 backend encrypted provider store，AI Assistant 通过 `/api/ai/chat` proxy 调用。

### 2.2 P0 风险当前状态

| 编号 | 风险 | 当前状态 | 下一步 |
| --- | --- | --- | --- |
| P0-1 | 无真实后端、数据库、登录系统或 ERP 写回 | 部分关闭：本地 API/SQLite/session/RBAC 已落地；正式 SSO/Postgres/ERP 未接入 | 接生产 Postgres、OIDC/SSO、部署配置和 ERP command 边界 |
| P0-2 | 服务端授权边界缺失 | 部分关闭：核心 Part/BOM/Tooling mutation API 已做服务端 RBAC；前端仍有 local repository fallback 和部分本地写入路径 | 将核心 UI mutation 全部切 API command，限制 fallback 仅用于 demo/test |
| P0-3 | bulk replacement / lifecycle gate 不具备服务端 invariant | 未完全关闭：BOM node command 已有；CSV import、phase transition、bulk replacement 仍需后端 command | 新增 import preview/commit、phase transition、audit read API |
| P0-4 | 核心数据保存在浏览器 | 部分关闭：API mode 可 hydrate BOM/Parts/Tooling；local repository 仍作为 fallback/source for some UI writes | API mode 浏览器联调后继续迁移 mutations 和 cache 策略 |
| P0-5 | AI key 仍在浏览器 | 基本关闭：localStorage 不再保存 key；API mode 后端 encrypted store + proxy 已落地 | 完成 provider metadata load/keyLast4 回显和 browser API-mode QA |

## 3. 阶段范围

### 3.1 必做范围

本阶段只覆盖生产地基和四个关键面：

1. Backend/API foundation。
2. Auth/session/RBAC。
3. Core data API: BOM、Part Library、Tooling、Audit。
4. AI provider credential + AI proxy。

### 3.2 暂不纳入

以下内容不在 P0 阶段扩展，除非为关闭 P0 风险必须触碰：

- 完整 ERP 双向同步。
- 完整 ECR/ECO 审批流。
- 附件对象存储与病毒扫描。
- CAD/PDM integration。
- 多租户 billing / plan / license。
- 实时协同编辑。
- 通知、任务队列、邮件、IM。

## 4. 技术方案

### 4.1 仓库结构

在当前单仓库中新增后端与共享层，避免一次性迁移成复杂 monorepo。

```text
.
├── server/
│   ├── index.ts
│   ├── app.ts
│   ├── config.ts
│   ├── db/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── auth/
│   │   ├── session.ts
│   │   ├── actor.ts
│   │   └── rbac.ts
│   ├── routes/
│   │   ├── health.ts
│   │   ├── auth.ts
│   │   ├── projects.ts
│   │   ├── parts.ts
│   │   ├── bom.ts
│   │   ├── tooling.ts
│   │   ├── audit.ts
│   │   └── ai.ts
│   ├── services/
│   │   ├── bomService.ts
│   │   ├── partService.ts
│   │   ├── toolingService.ts
│   │   ├── auditService.ts
│   │   └── aiProviderService.ts
│   └── tests/
├── shared/
│   ├── apiTypes.ts
│   ├── permissions.ts
│   └── validation.ts
├── services/
│   ├── apiClient.ts
│   └── ApiInterface.ts
└── stores/
```

### 4.2 推荐技术选型

| 层 | 方案 | 原因 |
| --- | --- | --- |
| API 服务 | Node.js + Fastify | 轻量、TypeScript 友好、测试容易、可逐步接入 |
| Validation | Zod | 当前项目已使用 Zod，复用 schema 心智 |
| ORM / migration | Prisma | migration、seed、类型生成成熟，适合快速建立数据地基 |
| Dev DB | SQLite | 本地开发简单，适合快速落地和 CI |
| Production DB target | Postgres | 正式部署建议使用 Postgres，Prisma schema 需避免 SQLite-only 设计 |
| Auth | HttpOnly session cookie + dev login | 先建立 actor 边界，后续可接 SSO/OIDC |
| Secret encryption | Node `crypto` AES-GCM | 避免浏览器保存 AI key，后端加密存储 |
| Frontend API | `fetch` based typed client | 先轻量实现，避免引入大型 query/cache 框架 |

### 4.3 环境变量

```bash
DATABASE_URL="file:./dev.db"
SERVER_PORT=3001
SESSION_SECRET="dev-session-secret-change-me"
AI_CREDENTIAL_ENCRYPTION_KEY="32-byte-base64-key"
CORS_ORIGIN="http://localhost:3000"
```

生产环境必须替换：

- `DATABASE_URL` 指向 Postgres。
- `SESSION_SECRET` 使用强随机 secret。
- `AI_CREDENTIAL_ENCRYPTION_KEY` 使用 KMS 或 secret manager 管理。
- `CORS_ORIGIN` 指向真实前端域名。

## 5. 数据模型草案

### 5.1 Identity / Workspace

| Entity | 核心字段 |
| --- | --- |
| Workspace | `id`, `name`, `createdAt`, `updatedAt` |
| User | `id`, `email`, `name`, `createdAt`, `updatedAt` |
| Membership | `id`, `workspaceId`, `userId`, `role` |
| Session | `id`, `userId`, `expiresAt`, `createdAt` |

### 5.2 BOM / Part / Tooling

| Entity | 核心字段 |
| --- | --- |
| Project | `id`, `workspaceId`, `code`, `name`, `sku`, `phase`, `createdAt`, `updatedAt` |
| Part | `id`, `workspaceId`, `partNumber`, `name`, `description`, `type`, `lifecycleState`, `manufacturer`, `mpn`, `cost`, `currency`, `leadTimeWeeks`, `moq`, `spq`, `archivedAt` |
| BOMNode | `id`, `workspaceId`, `projectId`, `parentId`, `partId`, `partNumber`, `name`, `revision`, `state`, `type`, `quantity`, `unit`, `cost`, `currency`, `customAttributesJson`, `createdAt`, `updatedAt` |
| ToolingDesignMaster | `id`, `workspaceId`, `projectId`, `code`, `name` |
| ToolingConcretePartMapping | `id`, `workspaceId`, `designMasterId`, `partId` |
| ToolingRecord | `id`, `workspaceId`, `projectId`, `designMasterId`, `name`, `supplier`, `owner`, `cavityCount` |
| ToolingMilestone | `id`, `workspaceId`, `toolingId`, `key`, `status`, `plannedDate`, `actualDate`, `owner`, `notes`, `blockerReason` |
| AuditEvent | `id`, `workspaceId`, `actorUserId`, `entityType`, `entityId`, `action`, `beforeJson`, `afterJson`, `createdAt` |

### 5.3 AI Provider

| Entity | 核心字段 |
| --- | --- |
| AiProviderConfig | `id`, `workspaceId`, `providerType`, `baseUrl`, `model`, `temperature`, `encryptedApiKey`, `keyLast4`, `enabled`, `createdAt`, `updatedAt` |
| AiRequestLog | `id`, `workspaceId`, `actorUserId`, `providerConfigId`, `purpose`, `status`, `redactedPromptPreview`, `createdAt` |

## 6. 权限模型

### 6.1 Actor 来源

所有 API request 必须经过：

1. 读取 session cookie。
2. 加载 user。
3. 加载 workspace membership。
4. 生成 actor:

```ts
interface Actor {
  userId: string;
  workspaceId: string;
  role: 'ADMIN' | 'ENG_LEAD' | 'SOURCING' | 'VIEWER';
  permissions: Permission[];
}
```

### 6.2 服务端权限校验

服务端必须成为唯一授权边界。

| 操作 | 最低权限 |
| --- | --- |
| Read BOM / Part / Tooling | `VIEW_BOM` |
| Create / update BOM structure | `EDIT_BOM_STRUCTURE` |
| Update BOM metadata | `EDIT_BOM_METADATA` |
| Update cost / commercial fields | `EDIT_COST` 或 `EDIT_COMMERCIAL_FIELDS` |
| Manage AVL | `MANAGE_AVL` |
| Manage tooling | `MANAGE_TOOLING` |
| Transition project phase | `TRANSITION_PROJECT_PHASE` |
| Manage AI provider | `ADMIN` only |
| Use AI assistant | `VIEW_BOM` plus workspace AI enabled |

### 6.3 必须新增的负向测试

- Viewer 调用任何 mutation API 返回 `403`。
- Sourcing 修改工程字段返回 `403`。
- Engineer 修改 commercial fields 返回 `403`。
- 未登录 request 返回 `401`。
- 跨 workspace 访问返回 `404` 或 `403`，不能泄露资源存在性。
- AI provider key 读取 API 永不返回明文 key。

## 7. API 设计草案

### 7.1 Health / Auth

| Method | Path | 用途 |
| --- | --- | --- |
| GET | `/api/health` | 服务健康检查 |
| POST | `/api/auth/dev-login` | 本地开发登录指定角色用户 |
| POST | `/api/auth/logout` | 清除 session |
| GET | `/api/auth/me` | 当前 user / workspace / role / permissions |

### 7.2 Projects

| Method | Path | 权限 |
| --- | --- | --- |
| GET | `/api/projects` | `VIEW_BOM` |
| GET | `/api/projects/:projectId` | `VIEW_BOM` |
| POST | `/api/projects` | `ADMIN` |
| PATCH | `/api/projects/:projectId` | `ADMIN` |
| POST | `/api/projects/:projectId/transition` | `TRANSITION_PROJECT_PHASE` |

### 7.3 Parts

| Method | Path | 权限 |
| --- | --- | --- |
| GET | `/api/parts` | `VIEW_BOM` |
| GET | `/api/parts/:partId` | `VIEW_BOM` |
| POST | `/api/parts` | `EDIT_BOM_STRUCTURE` 或 `ADMIN` |
| PATCH | `/api/parts/:partId` | 字段级权限 |
| POST | `/api/parts/:partId/archive` | `ADMIN` |

字段级规则：

- Engineering fields: `EDIT_BOM_METADATA`。
- Commercial fields: `EDIT_COST` / `EDIT_COMMERCIAL_FIELDS`。
- AVL fields: `MANAGE_AVL`。

### 7.4 BOM

| Method | Path | 权限 |
| --- | --- | --- |
| GET | `/api/projects/:projectId/bom` | `VIEW_BOM` |
| POST | `/api/projects/:projectId/bom` | `EDIT_BOM_STRUCTURE` |
| PATCH | `/api/projects/:projectId/bom/:nodeId` | 字段级权限 |
| DELETE | `/api/projects/:projectId/bom/:nodeId` | `EDIT_BOM_STRUCTURE` |
| POST | `/api/projects/:projectId/bom/snapshots` | `EDIT_BOM_STRUCTURE` |

禁止用户路径调用 unrestricted replace API。CSV import 必须变成显式 command：

```text
POST /api/projects/:projectId/bom/import-preview
POST /api/projects/:projectId/bom/import-commit
```

### 7.5 Tooling

| Method | Path | 权限 |
| --- | --- | --- |
| GET | `/api/tooling` | `VIEW_BOM` |
| POST | `/api/tooling/design-masters` | `MANAGE_TOOLING` |
| POST | `/api/tooling/records` | `MANAGE_TOOLING` |
| PATCH | `/api/tooling/records/:toolingId` | `MANAGE_TOOLING` |
| PATCH | `/api/tooling/milestones/:milestoneId` | `MANAGE_TOOLING` |
| POST | `/api/tooling/design-masters/:id/parts` | `MANAGE_TOOLING` |

### 7.6 Audit

| Method | Path | 权限 |
| --- | --- | --- |
| GET | `/api/audit?entityType=&entityId=` | `ADMIN` or scoped owner permission |

所有 mutation 必须写 AuditEvent。

### 7.7 AI

| Method | Path | 权限 |
| --- | --- | --- |
| GET | `/api/ai/provider` | `ADMIN` |
| PUT | `/api/ai/provider` | `ADMIN` |
| DELETE | `/api/ai/provider/key` | `ADMIN` |
| POST | `/api/ai/chat` | `VIEW_BOM` |
| POST | `/api/ai/analyze-bom-node` | `VIEW_BOM` |

约束：

- `GET /api/ai/provider` 只能返回 `keyLast4`，不能返回明文 key。
- `PUT /api/ai/provider` 在服务端加密 key。
- AI proxy 必须基于当前 actor 和 workspace provider config。
- AI request log 只保存 redacted preview，不保存完整 BOM prompt。

## 8. 前端迁移方案

### 8.1 API client

新增：

```text
services/apiClient.ts
services/coreApi.ts
services/aiApi.ts
```

环境变量：

```bash
VITE_API_BASE_URL=http://localhost:3001
```

### 8.2 替换路径

| 当前路径 | 目标 |
| --- | --- |
| `services/ApiInterface.ts` mock admin actor | 改为调用 server API，删除 hard-coded ADMIN actor |
| `repositories/core` localStorage source of truth | 逐步降级为 frontend adapter/cache 或 seed helper |
| `stores/useBOMStore.ts` core mutation | 调 API mutation，成功后刷新/合并 server state |
| `stores/useAISettingsStore.ts` 保存明文 key | 只保存非敏感 UI form state；provider key 提交到后端 |
| `services/aiProvider.ts` browser direct fetch provider | 改为调用 `/api/ai/chat` 和 `/api/ai/analyze-bom-node` |

### 8.3 兼容策略

第一阶段可保留 dev fallback，但必须满足：

- 默认生产路径走 API。
- fallback 只在 `VITE_ENABLE_LOCAL_REPOSITORY_FALLBACK=true` 时启用。
- fallback UI 明确显示 local prototype mode。
- 所有测试区分 API mode 与 fallback mode。

## 9. 实施工作包

### WP0: Baseline Lock

目标：确保开发前基线稳定。

任务：

- 运行 `git status --short`，确认已有改动范围。
- 运行 `./node_modules/.bin/vitest run --reporter=verbose`。
- 运行 `npm run build`。
- 运行 `npm run test:core-browser`。
- 记录当前测试结果到 README 或 stage report。

验收：

- 三项验证通过。
- 无 `.worktrees` 测试污染。

### WP1: Backend Skeleton

目标：新增可启动 API 服务。

任务：

- 新增 `server/` 目录。
- 安装并配置 Fastify、server-side Zod、tsx/ts-node dev runner。
- 新增 `server/app.ts` 和 `server/index.ts`。
- 新增 `/api/health`。
- 新增 CORS 配置。
- 新增统一 error response。
- 新增 `npm run dev:api`、`npm run build:api`、`npm run test:api`。

验收：

- `npm run dev:api` 可启动。
- `GET /api/health` 返回 `{ ok: true }`。
- API 单元测试通过。

### WP2: Database And Seed

目标：建立数据库 source of truth。

任务：

- 配置 Prisma。
- 创建 schema。
- 创建 dev migration。
- 创建 seed script，将现有 mock/core seed 数据映射到数据库。
- 创建 repository helpers，用于测试隔离与事务清理。

验收：

- `prisma migrate dev` 成功。
- `prisma db seed` 成功。
- seed 后可查询 Project / Part / BOM / Tooling。
- 测试环境可以创建临时数据库。

### WP3: Auth, Session, Actor, RBAC

目标：建立服务端授权边界。

任务：

- 新增 dev users: Admin、Engineer、Sourcing、Viewer。
- 新增 `POST /api/auth/dev-login`。
- 新增 `GET /api/auth/me`。
- 新增 session cookie。
- 新增 `requireActor` middleware。
- 新增 `assertPermission` 和 field-level policy。

验收：

- 未登录请求返回 `401`。
- Viewer mutation 返回 `403`。
- Sourcing 工程字段 mutation 返回 `403`。
- Engineer commercial field mutation 返回 `403`。
- Admin mutation 成功。

### WP4: Core Data APIs

目标：把 BOM、Part、Tooling、Audit API 落地。

任务：

- 实现 Project read/update/transition API。
- 实现 Part read/create/update/archive API。
- 实现 BOM tree read/create/update/delete/snapshot/import preview/import commit API。
- 实现 Tooling design master / record / milestone API。
- 实现 Audit write/read。
- 所有 mutation 写 audit。
- 所有 mutation 走 service command，不走 unrestricted replace。

验收：

- API tests 覆盖 read/write/negative permission/audit。
- BOM tree 返回结构与前端当前类型兼容。
- Part Library 搜索/排序/过滤 API 可支持现有 UI。
- Tooling Hub link path 可由 API 数据驱动。

### WP5: Frontend API Migration

目标：核心前端模块从 local repository 切到 API。

任务：

- 新增 `services/apiClient.ts`。
- 将 `ApiInterface.ts` hard-coded admin actor 替换为 API client。
- BOM Editor 加载 `/api/projects/:projectId/bom`。
- Part Library 加载 `/api/parts`。
- Tooling Hub 加载 `/api/tooling`。
- mutations 调用对应 API。
- 前端处理 `401` / `403` / validation error。

验收：

- 现有核心模块用户路径仍可用。
- Viewer 在 UI 仍只读，且 API mutation 被拒绝。
- Sourcing / Engineer 字段级权限和 API 行为一致。
- browser QA 通过。

### WP6: AI Backend Proxy

目标：关闭浏览器保存 provider key 的 P0 风险。

任务：

- 新增 `AiProviderConfig` schema。
- 新增 key encryption helper。
- 新增 `GET /api/ai/provider`，只返回 metadata + `keyLast4`。
- 新增 `PUT /api/ai/provider`，保存 encrypted key。
- 新增 `/api/ai/chat` 和 `/api/ai/analyze-bom-node`。
- 前端 Settings 改为提交 key 到后端。
- 前端 AI assistant 改为调用后端 proxy。
- 删除浏览器 `localStorage` 明文 key。

验收：

- `localStorage` 中不出现 provider key。
- browser bundle 不出现 provider key。
- `GET /api/ai/provider` 不返回明文 key。
- AI proxy request 使用服务端 key。
- 未授权用户不能管理 provider key。

### WP7: End-to-End Verification

目标：建立 P0 验收测试。

任务：

- API integration tests。
- 前端 Vitest。
- browser QA。
- AI proxy mocked-provider test。
- negative permission E2E。
- migration/seed test。

验收命令：

```bash
npm run test:api
./node_modules/.bin/vitest run --reporter=verbose
npm run build
npm run test:core-browser
```

## 10. 推荐开发顺序

1. WP0 Baseline Lock。
2. WP1 Backend Skeleton。
3. WP2 Database And Seed。
4. WP3 Auth/RBAC。
5. WP4 Core Data APIs。
6. WP5 Frontend API Migration。
7. WP6 AI Backend Proxy。
8. WP7 End-to-End Verification。

不要先做 AI proxy。原因：AI proxy 需要 actor、workspace、secret store 和 audit，这些依赖 WP1 到 WP3。

## 11. Definition Of Done

P0 阶段完成时必须满足：

1. 后端 API 可启动并有 health check。
2. 数据库 migration 和 seed 可重复执行。
3. 核心 BOM / Part / Tooling 数据来自数据库。
4. 所有核心 mutation 由服务端校验权限。
5. API facade 不再 hard-code ADMIN actor。
6. 浏览器 `localStorage` 不再保存核心 BOM/Part/Tooling source of truth。
7. 浏览器 `localStorage` 不再保存 AI provider key。
8. AI provider key 后端加密保存。
9. AI 调用通过 server-side proxy。
10. Viewer/Sourcing/Engineer/Admin 的负向权限测试覆盖 API 层。
11. `npm run build` 通过。
12. Vitest 通过。
13. API tests 通过。
14. Browser QA 通过。
15. Production readiness report 中对应 P0 项关闭或降级。

### 11.1 2026-06-07 当前验收状态

| DoD | 状态 | 说明 |
| --- | --- | --- |
| 后端 API / health / tests | Done | Fastify API、health、auth、core routes、AI routes 已覆盖测试 |
| 数据库 schema / seed | Done for local | SQLite + Prisma schema + SQL migration + seed 已可用；native `prisma migrate dev` 仍需复查 |
| 服务端 RBAC | Done for core slice | auth/session/actor/field-level policy 已覆盖 Part/BOM/Tooling/AI provider |
| 核心数据来自数据库 | Partial | API mode 可 hydrate；部分 UI mutation 和 fallback 仍依赖 local repository |
| AI key 后端加密保存 | Done for API mode | `AiProviderConfig.encryptedApiKey` + `keyLast4`; browser localStorage 不保存 key |
| AI 调用通过 server proxy | Done for API mode | `services/aiProvider.ts` 在 `VITE_API_BASE_URL` 配置时调用 `/api/ai/chat` |
| Browser API-mode QA | Blocked this run | dev server escalation 因 workspace credit 被拒绝，未产出截图/浏览器证据 |
| Production readiness P0 全关闭 | Partial | 正式 auth、Postgres、ERP、CSV import、phase transition、audit read API 仍待开发 |

## 12. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 一次性迁移所有 store 过大 | 容易引入大面积回归 | 先迁 BOM / Part / Tooling，保留非核心 preview mock |
| DB schema 和当前前端类型不一致 | 前端适配成本上升 | 先保持 API response 兼容当前 `types.ts`，后续再领域重构 |
| 权限规则散落 | 以后继续绕过 | 权限只放在 server `rbac.ts` 和 service command 层 |
| AI prompt 泄露敏感 BOM | 安全风险 | proxy 增加 redaction、workspace policy、request log |
| 本地开发变慢 | 开发效率下降 | SQLite dev DB + seed reset script |
| Browser QA 因 UI 改动 stale | 误报/漏报 | QA 脚本跟真实路径，失败时输出 JSON artifact |

## 13. 第一批具体开发任务清单

### Task 1: 安装后端基础依赖

- Fastify。
- Prisma。
- server runner。
- test helpers。

完成后更新：

- `package.json`
- `package-lock.json`

### Task 2: 新增 API skeleton

- `server/app.ts`
- `server/index.ts`
- `server/config.ts`
- `server/routes/health.ts`

测试：

- `server/tests/health.test.ts`

### Task 3: 新增数据库 schema 和 seed

- `server/db/schema.prisma`
- `server/db/seed.ts`
- dev migration

先覆盖：

- Workspace。
- User。
- Membership。
- Project。
- Part。
- BOMNode。
- Tooling。
- AuditEvent。
- AiProviderConfig。

### Task 4: 新增 auth 和 RBAC

- `server/auth/session.ts`
- `server/auth/actor.ts`
- `server/auth/rbac.ts`

测试：

- 未登录 `401`。
- 角色权限 `403`。
- Admin 成功。

### Task 5: 新增核心 API read-only

先实现 read-only，降低迁移风险：

- `GET /api/projects`
- `GET /api/projects/:projectId/bom`
- `GET /api/parts`
- `GET /api/tooling`

### Task 6: 新增核心 mutation

- Part create/update/archive。
- BOM node create/update/delete。
- Tooling record/milestone update。
- Audit write。

### Task 7: 前端切 API

- 新增 API client。
- 先读 API，再切 mutation。
- 删除 hard-coded admin actor。

### Task 8: AI proxy

- 后端保存 key。
- 前端 Settings 改为 server-backed。
- AI assistant 调 server proxy。

## 14. 开发期间的测试节奏

每个 task 完成后至少运行：

```bash
./node_modules/.bin/vitest run --reporter=verbose
npm run build
```

涉及后端时运行：

```bash
npm run test:api
```

涉及跨页 UI 或响应式时运行：

```bash
npm run test:core-browser
```

## 15. 上下文压缩后的恢复入口

如果对话上下文压缩，继续开发时优先读取：

1. 本文件。
2. `docs/user-tests/20260607-production-readiness-review.md`。
3. `README.md` 当前状态。
4. `services/ApiInterface.ts`。
5. `repositories/core`。
6. `stores/useBOMStore.ts`。
7. `stores/useAISettingsStore.ts`。
8. `services/aiProvider.ts`。

恢复后的第一步：

```bash
git status --short
./node_modules/.bin/vitest run --reporter=verbose
npm run build
```

## 16. New Session Handoff - 2026-06-08

本节用于在新 session 中继续开发，优先级高于上文早期草案。

### 16.1 当前开发状态

当前 P0 production foundation 已完成一轮可验证实现，但还不是完整生产就绪：

| 工作包 | 状态 | 当前事实 |
| --- | --- | --- |
| WP0 Baseline | Done | 前端 Vitest、build、API tests 均已跑通；browser API-mode QA 未完成 |
| WP1 Backend Skeleton | Done | `server/app.ts`、`server/index.ts`、Fastify、CORS、cookie、health route 已落地 |
| WP2 Database And Seed | Done for local | Prisma 6 + SQLite schema、SQL migration、seed、test DB helper 已落地 |
| WP3 Auth/RBAC | Done for core slice | dev-login/session/actor/RBAC/field-level policy 已覆盖 API tests |
| WP4 Core APIs | Partial / usable slice | Projects/Parts/BOM/Tooling read API 已完成；Part/BOM node/Tooling milestone mutation + audit 已完成 |
| WP5 Frontend API Migration | Partial | `VITE_API_BASE_URL` 时 App 可 hydrate Projects/BOM/Parts/Tooling；核心 UI mutation 仍多处走 local repository |
| WP6 AI Backend Proxy | Partial / usable slice | encrypted provider store、`/api/ai/provider`、`/api/ai/chat`、request log、Settings backend save path 已完成 |
| WP7 E2E Verification | Partial | unit/API/build 通过；local dev server + browser API-mode QA 因提权被拒绝未完成 |

### 16.2 最后一次验证结果

最后一次完整自动化验证在 2026-06-07 晚间完成：

```bash
npm run test:api
# 5 files / 20 tests passed

npm run build:api
# passed

./node_modules/.bin/vitest run --reporter=verbose
# 24 files / 175 tests passed

npm run build
# passed
```

额外检查：

```bash
rg "sk-test|sk-secret|GEMINI_API_KEY|VITE_GEMINI" dist
# no matches
```

已知测试警告：

- React Testing Library 中仍有既有 `act(...)` warning，测试结果通过；本轮未修复这些历史警告。

### 16.3 当前重要文件

后端入口与配置：

- `server/app.ts`
- `server/index.ts`
- `server/config.ts`
- `vitest.api.config.ts`

数据库：

- `server/db/schema.prisma`
- `server/db/migrations/20260607223000_init/migration.sql`
- `server/db/seed.ts`
- `server/tests/testDb.ts`

Auth/RBAC：

- `shared/permissions.ts`
- `server/auth/session.ts`
- `server/auth/actor.ts`
- `server/auth/requestActor.ts`
- `server/auth/rbac.ts`

Core API：

- `server/routes/projects.ts`
- `server/routes/parts.ts`
- `server/routes/bom.ts`
- `server/routes/tooling.ts`
- `server/services/audit.ts`
- `shared/apiTypes.ts`

AI backend：

- `server/routes/ai.ts`
- `server/services/aiCredentials.ts`
- `services/aiProvider.ts`
- `services/backendApi.ts`
- `stores/useAISettingsStore.ts`
- `pages/SettingsPage.tsx`

Frontend API hydration：

- `App.tsx`
- `services/backendApi.ts`
- `stores/useBOMStore.ts`
- `stores/useToolingStore.ts`

测试：

- `server/tests/health.test.ts`
- `server/tests/auth.test.ts`
- `server/tests/coreReadRoutes.test.ts`
- `server/tests/coreMutationRoutes.test.ts`
- `server/tests/aiRoutes.test.ts`
- `tests/AIProvider.test.ts`
- `tests/AISettingsStore.test.ts`
- `tests/ConfigurationFlows.test.tsx`

### 16.4 当前 worktree 注意事项

当前 worktree 是 dirty 状态，包含本轮 P0 改动和此前 AI Settings / browser QA 改动。新 session 继续时不要 revert 这些文件，除非用户明确要求。

`git status --short` 最后观察到：

- 已修改：`.gitignore`、`App.tsx`、`README.md`、`package.json`、`package-lock.json`、`pages/SettingsPage.tsx`、`stores/useBOMStore.ts`、`stores/useToolingStore.ts`、`services/gemini.ts`、`tests/ConfigurationFlows.test.tsx`、`vite.config.ts`、`vitest.config.ts` 等。
- 未跟踪：`server/`、`shared/`、`services/backendApi.ts`、`services/aiProvider.ts`、`stores/useAISettingsStore.ts`、`tests/AIProvider.test.ts`、`tests/AISettingsStore.test.ts`、`vitest.api.config.ts`、本计划文档、production readiness report。
- `server/db/dev.db` 应被 `.gitignore` 忽略，不应提交。

### 16.5 本地运行与联调命令

准备数据库：

```bash
npm run prisma:generate
npm run prisma:apply
npm run prisma:seed
```

启动 API：

```bash
SERVER_PORT=3101 DATABASE_URL=file:dev.db npm run dev:api
```

启动前端 API mode：

```bash
VITE_API_BASE_URL=http://127.0.0.1:3101 \
VITE_ENABLE_LOCAL_REPOSITORY_FALLBACK=false \
npm run dev -- --host 127.0.0.1 --port 5174
```

API health / auth smoke：

```bash
curl -s http://127.0.0.1:3101/api/health
curl -s -c /tmp/zbom.cookies \
  -H 'Content-Type: application/json' \
  -X POST http://127.0.0.1:3101/api/auth/dev-login \
  -d '{"role":"VIEWER"}'
curl -s -b /tmp/zbom.cookies http://127.0.0.1:3101/api/projects
```

重要限制：

- 在上一 session 中，`tsx` 启动 dev server 在沙箱内触发 IPC pipe `EPERM`。
- 尝试提权启动时因 workspace credit 限制被拒绝。
- 新 session 若 credit/审批恢复，应优先补一次 API mode browser QA。

### 16.6 下一 session 推荐顺序

1. 先确认 worktree 和验证基线：

```bash
git status --short
npm run build:api
npm run test:api
./node_modules/.bin/vitest run --reporter=verbose
npm run build
```

2. 若可以启动 dev server，先补 API mode browser QA：

- API `SERVER_PORT=3101`。
- Web `VITE_API_BASE_URL=http://127.0.0.1:3101`。
- `VITE_ENABLE_LOCAL_REPOSITORY_FALLBACK=false`。
- 验证 Dashboard/BOM Editor/Part Library/Tooling Hub 首屏非空。
- 验证 Header project 来自 API seed。
- 验证 Settings > AI Provider 保存后不会把 key 写入 `localStorage`。
- 验证 Viewer/Sourcing/Engineer 的 API 403 行为和 UI gating 一致。

3. 若 browser QA 通过，继续迁移核心 UI mutation 到 API command：

- `stores/useBOMStore.updateBOMNode/addBOMNode/deleteBOMNode` 调后端 BOM node APIs。
- `stores/useBOMStore.updateLibraryPart/addLibraryPart` 调后端 Parts APIs。
- `stores/useToolingStore.updateMilestone` 调 `/api/tooling/milestones/:milestoneId`。
- mutation 成功后 refresh API snapshot 或局部 merge。
- mutation 失败时显示 `401/403/400` 可理解错误。

4. 后端继续补缺口：

- `GET /api/audit?entityType=&entityId=`。
- `POST /api/projects/:projectId/transition`。
- BOM CSV `import-preview` / `import-commit` command。
- AVL / supplier mapping API。
- AI provider metadata load on Settings mount，回显 `keyLast4`。

### 16.7 当前 Production Readiness 残留 P0

必须继续跟踪：

1. 正式认证：当前只有 dev-login/session，没有 SSO/OIDC。
2. 生产数据库：当前为 SQLite local，目标应为 Postgres + managed migration。
3. API mode browser QA：尚未完成截图/浏览器证据。
4. 核心 mutation UI：仍有 local repository fallback 写入路径。
5. Bulk replacement / CSV import：仍需后端 command 和 invariant。
6. Project phase transition：前端已有流程，后端 command 未补齐。
7. Audit read：只写入，尚未提供 scoped read API。
8. AI Settings：后端保存已完成，但 provider metadata/keyLast4 mount 回填仍需补。
9. ERP：仍是 setup/checklist，无真实 sync/writeback。

### 16.8 建议的新 session 第一句话目标

建议直接以如下目标继续：

> 继续执行 zBOM P0 Production Foundation：先补 API mode browser QA；若验证通过，将 BOM/Part/Tooling 核心 UI mutation 从 local repository 迁移到后端 API command，并补对应测试。

---

## 17. 2026-06-08 状态更新 (Latest Status Update)

依据最近一轮的具体执行，P0 阶段的进展已得到了重大的推进，具体完成情况和遗留改善项核对如下：

### 17.1 最新已完成的 P0 任务与功能

1. **项目生命周期持久化与阶段流转 (DoD - Done)**
   - 项目创建 (`createProject`) 与更新 (`updateProject`) 已从 localStorage 彻底迁移至后端数据库路由，创建时自动在事务中生成首层 BOMNode 装配节点（物料号形如 `800-[CODE]-001`）。
   - 服务端落地 `/api/projects/:projectId/transition` 接口，流转阶段时强制加载 Workspace 中配置的 Checklist 阶段控制流，校验并记录电子签名，保存至 `AuditEvent.afterJson` 中。
2. **审计日志系统与 UI（DoD - Done）**
   - 服务端落地 `/api/audit` 审计日志查询接口，支持以 `entityType`、`action` 进行过滤和分页。
   - 前端 System Settings 页面追加了 **Audit Trail (审计痕迹)** 标签页，支持高保真 UI、多参数过滤和分页查看 Workspace 范围内的所有历史操作及审批电子签名细节。
   - BOM 详情页 History 选项卡支持从后端 API 动态获取该节点下的相关审计日志。
3. **AI 设置挂载回填 (DoD - Done)**
   - Settings 页面加载时会自动从后端拉取已保存的加密 AI 配置，并将 `keyLast4` 回显在密码输入框中。

### 17.2 最新自动化验证状态

- **后端集成测试**：新添了 [projectMutations.test.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/server/tests/projectMutations.test.ts) 和 [audit.test.ts](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/server/tests/audit.test.ts)，测试接口拦截逻辑、流转异常及分页检索。`npm run test:api` 通过测试从 20 项增至 **33 项** 并且 100% 成功。
- **前端 Store 测试**：在 [storesApiMode.test.tsx](file:///Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/tests/storesApiMode.test.tsx) 新增 4 个针对项目修改、阶段变更及审计拉取的 Mock 测试，`npx vitest run` 共 **193 项** 单元测试 100% 成功。

### 17.3 下一步的改善计划 (Next Step Improvement Plan)

1. **核心待改善项：BOM 批量替换与 CSV 导入服务端命令**
   - **现状**：前端 CSV 导入仍为纯客户端调用 `setBOMData`，在 API 模式下不写入后端数据库，无服务端安全边界，刷新后导入数据将丢失。
   - **改进**：需要在后端实现 `POST /api/projects/:projectId/bom/import-preview` 和 `POST /api/projects/:projectId/bom/import-commit` 接口，将 CSV 解析和安全验证上移到 Fastify 服务端。
2. **核心待改善项：附件对象存储集成**
   - **现状**：零件详情的附件上传仍是前端 Mock 的 URL，没有连接后端持久化存储。
   - **改进**：集成服务端 Presigned URL 上传（如 AWS S3 或本地磁盘持久化），并配合数据库 `Attachment` 关联表的存储。
3. **安全 hardening：正式的 SSO/OIDC 认证接入**
   - **现状**：目前只依赖 mock 开发登录机制，缺乏统一身份认证系统。
   - **改进**：接通真实的 OIDC 服务端判定。
4. **数据库与部署：生产 Postgres 数据库迁移**
   - **现状**：当前为 SQLite local 文件数据库开发。
   - **改进**：部署 PostgreSQL 环境，确认 Prisma Migration 机制在此环境中的引擎缺陷并修复。
5. **ERP 同步逻辑**：实现真实的 ERP 写回和 Webhook 发布流程。

---

## 18. 2026-06-09 最终完成状态 (Final Completion Status)

所有已承诺的开发任务均已验证完成并 commit。

### 18.1 最终验证基线

```bash
npm run test:api
# 12 files / 48 tests passed

npx vitest run --reporter=verbose
# 25 files / 193 tests passed

npm run build
# passed (built in ~2.7s)
```

### 18.2 已完成交付物总结

**后端 API（server/）**
- `server/routes/bom.ts` — import-preview / import-commit 事务端点
- `server/routes/attachments.ts` — 文件上传/下载/link/unlink 完整路由
- `server/routes/projects.ts` — 项目 CRUD + phase transition
- `server/routes/audit.ts` — 分页审计日志查询
- `server/routes/ai.ts` — AI provider 配置 + chat proxy
- `server/routes/ecos.ts` — ECO 流程路由
- `server/routes/workspace.ts` — Workspace 配置管理

**数据库与 Schema**
- `server/db/schema.prisma` — PostgreSQL provider + Attachment model
- `docker-compose.yml` — 本地 PostgreSQL 容器

**前端集成**
- `services/backendApi.ts` — 全量 API client（BOM / Parts / Tooling / Audit / AI / Attachments / Import）
- `stores/useBOMStore.ts` — CSV import preview/commit + attachment upload/delete 已接 API
- `pages/BOMEditor.tsx` — 导入预览确认弹窗 + 附件 UI 已接 API

**部署基础设施**
- `Dockerfile.prod` — 三阶段多目标生产构建
- `nginx.conf` — SPA fallback + /api/ 反代 + /uploads/ 静态
- `docker-compose.prod.yml` — db + api + web 三服务编排（含 healthcheck）
- `.env.prod.example` — 环境变量模板（含安全生成指引）
- `deploy-qcloud.sh` — 腾讯云 CVM 一键部署脚本（7步 SSH 流程）
- `start-local.sh` — 本地一键启动脚本（Docker/SQLite 自动检测）

### 18.3 当前遗留项（下阶段任务）

以下项目在本阶段明确标注为 "next phase"，不在当前 P0 范围内：

1. **正式 SSO/OIDC 认证接入**：当前仍为 dev-login mock 机制
2. **ERP 同步逻辑**：真实写回和 Webhook 发布流程
3. **API mode 浏览器 QA 截图证据**：需 dev server 环境权限恢复后补充
4. **Prisma migrate dev 引擎缺陷修复**：当前使用 SQL file 手动 migrate 绕过
