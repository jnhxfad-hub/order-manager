# 铝材订单管理系统

单机版订单管理系统，数据保存在本地 SQLite 数据库。面向铝型材加工业务，客户确认下单后按单安排生产，覆盖客户、商品、订单、库存、出库单全流程，支持打印、备份与恢复。

## 技术栈

- Tauri v2 + React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn / Base UI
- 后端 Rust，SQLite（rusqlite），Excel 导入（calamine）

## 常用命令

```bash
pnpm install                    # 安装依赖
pnpm run tauri:dev              # 开发运行桌面应用
pnpm run check                  # 前端检查：类型检查 + Node 测试 + 构建
pnpm run check:all              # 全部检查：前端 + Rust（fmt、clippy、cargo test）
pnpm tauri build --bundles app  # 构建 macOS 应用
```

## 目录结构

- `src/` 前端：`features/` 按客户、商品、订单、库存、设置分模块，`components/` 通用组件，`lib/` 工具函数
- `src-tauri/src/` Rust 后端：`commands/` 按模块提供 Tauri 命令，`db.rs` 与 `db/migrations/` 负责数据库初始化
- `tests/node/` Node 测试（浏览器 fallback 逻辑），`tests/ui/` Playwright 界面测试
- `scripts/` 运维脚本：数据库备份、恢复、桌面验收
- `docs/` 项目文档：交接上下文、试用说明、发布检查清单、桌面验收

## 文档

- `docs/codex-context.md` 项目交接上下文：业务规则与历史改动记录
- `docs/trial-user-guide.md` 试用快速说明
- `docs/release-checklist.md` 试用版发布检查清单

## 开发环境

- VS Code + Tauri 插件 + rust-analyzer
