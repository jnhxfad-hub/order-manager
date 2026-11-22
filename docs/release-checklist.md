# 试用版发布检查清单

## 发布口径

- 试用版只从当前仓库构建产物启动：`src-tauri/target/release/bundle/macos/铝材订单管理系统.app`。
- 如果要交给用户以 `/Applications/铝材订单管理系统.app` 运行，必须先用本次 release bundle 覆盖 `/Applications` 中的旧 App，再启动验证。
- 验收前先确认没有旧进程混跑：活动监视器或 `ps` 中只保留目标 release bundle 的 `order-manager` 进程。
- 进入设置页核对“应用版本”和“构建时间”，并确认数据库路径为预期用户数据路径。

## 构建

```bash
pnpm run check:all
pnpm tauri build --bundles app
```

- 构建完成后确认目标 App 存在：
  `src-tauri/target/release/bundle/macos/铝材订单管理系统.app`
- 若要覆盖 `/Applications`，先退出所有正在运行的旧 App，再复制 release bundle 到 `/Applications/铝材订单管理系统.app`。

## 启动核对

- 推荐先生成本轮桌面验收数据：

```bash
pnpm run desktop:acceptance -- prepare
```

- 按生成的 `/private/tmp/order-manager-desktop-acceptance/<run-id>/runbook.md` 操作桌面 App。
- 启动目标 release App，不使用浏览器预览。
- 打开设置页，记录：
  - 应用版本。
  - 构建时间。
  - 当前数据库路径。
  - 最近备份时间和备份文件路径。
- 若设置页显示的构建时间不是本次构建时间，停止验收并排查是否启动了旧包。

## 端到端走查

- 客户导入：
  - 导入客户样例文件。
  - 确认客户数量增加，客户名称、地址、默认计价和加工费显示正确。
- 商品导入：
  - 导入商品样例文件。
  - 覆盖 `1.20mm`、`2.500kg/m` 这类带单位数字。
  - 确认厚度和米重解析正确。
- 分配客户：
  - 搜索新导入商品。
  - 跨页选择或当前筛选选择后分配给新客户。
  - 确认商品行显示归属客户。
- 下单：
  - 新建订单选择新客户。
  - 确认客户地址自动带出、计价方式自动带出。
  - 导入订单明细，确认商品、模具、长度、颜色、数量和理论重量正确。
  - 填写经手人和铝锭价后下单。
- 入库：
  - 进入库存页后确认新订单在订单库存中可见。
  - 使用批量入库默认剩余数量完成入库。
  - 确认当前库存增加，并出现订单入库流水。
- 出库：
  - 首次只出库部分数量，填写对应品类重量。
  - 确认未出数量保留在订单库存，订单显示“部分出库”，入库、调整和公共库存转入已锁定。
  - 再次创建出库单，确认编号依次为 `订单号-01`、`订单号-02`。
  - 分别验收“剩余转公共库存”和“剩余转客户库存”，确认只有手动点击后才转移并完结。
  - 确认订单侧及目标库存侧流水、来源订单和价格规格快照正确。
- 打印预览：
  - 打开出库单打印预览。
  - 核对客户、订单编号、商品、模具、长度、颜色、出库数量、重量、货款和备注。
  - 只打开预览，不发送到物理打印机。
- 备份恢复：
  - 设置页执行手动备份，保存到临时验收目录。
  - 选择刚生成的备份文件恢复。
  - 恢复前确认系统提示会自动备份当前库。
  - 恢复成功后记录恢复前安全备份路径。
  - 返回订单列表，确认最新订单仍可查询且状态正确。

## 命令行兜底

- 试用前建议额外生成一份真实库命令行备份：

```bash
pnpm run backup:real-db
```

- 备份脚本会校验数据库结构、执行完整性检查，并输出客户、有效商品和订单数量。
- 如果用户试用污染了真实库，先退出桌面 App，再用备份文件恢复：

```bash
pnpm run restore:real-db -- --backup /private/tmp/order-manager-real-db-backups/<backup-file>.sqlite --yes
```

- 恢复脚本会在覆盖前自动生成 `order-manager-before-cli-restore-<timestamp>.sqlite` 安全备份。
- 不确定恢复文件时，先执行 dry-run：

```bash
pnpm run restore:real-db -- --backup /path/to/backup.sqlite --dry-run
```

## 数据库复核

推荐使用桌面验收脚本自动复核：

```bash
pnpm run desktop:acceptance -- verify --manifest /private/tmp/order-manager-desktop-acceptance/<run-id>/manifest.json
```

也可以手动执行以下 SQL：

```bash
sqlite3 "$HOME/Library/Application Support/com.jnhxf.order-manager/order-manager.sqlite" "
SELECT id, status, customer_name, handler_name, aluminum_ingot_price_x100
FROM orders
ORDER BY created_at DESC
LIMIT 1;

SELECT id, customer_name, powder_weight_kg_x100, note
FROM delivery_notes
ORDER BY created_at DESC
LIMIT 1;

SELECT order_id, length_mm, color, quantity
FROM order_inventory_stocks
WHERE order_id = '<订单编号>';

SELECT movement_type, delta_quantity, note
FROM inventory_movements
WHERE order_id = '<订单编号>'
ORDER BY created_at;
"
```

- 预期结果：
  - 订单状态为 `ordered`。
  - 同一订单可存在多张出库单，编号带两位顺序后缀。
  - 首次部分出库后余额保留，手动处理剩余库存后订单库存为 `0`。
  - 流水包含 `produce` 正数、`ship` 负数和对应目标的 `transfer_public` 或 `transfer_customer`。

## 发布记录

- 在 `docs/codex-context.md` 记录本次 App 路径、订单编号、备份路径、安全备份路径和发现的问题。
- 提交文档和代码变更。

## 试用交付物

- 给用户试用前，先在设置页备份当前真实库。
- 样例导入模板位于 `docs/trial-kit/`，只包含试用客户、试用商品和试用订单明细 CSV。
- 极简使用说明位于 `docs/trial-user-guide.md`，覆盖客户导入、商品导入、分配客户、下单、入库、出库和备份。
- 不直接交付真实数据库副本作为样例库，避免样例数据和真实业务数据混淆。
