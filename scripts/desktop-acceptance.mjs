#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const appPath = path.join(
  repositoryRoot,
  "src-tauri/target/release/bundle/macos/铝材订单管理系统.app",
);
const defaultDbPath = path.join(
  os.homedir(),
  "Library/Application Support/com.jnhxf.order-manager/order-manager.sqlite",
);
const defaultRoot = "/private/tmp/order-manager-desktop-acceptance";
const cliArgs = process.argv.slice(2);

if (cliArgs[0] === "--") {
  cliArgs.shift();
}

function usage() {
  console.log(`Usage:
  pnpm run desktop:acceptance -- prepare [--run-id 20260623180000]
  pnpm run desktop:acceptance -- verify [--manifest /private/tmp/.../manifest.json]

prepare:
  备份当前真实库，生成本轮桌面 App 验收用客户/商品/订单明细 CSV 和操作说明。

verify:
  按 manifest 中的 run id 自动查询桌面 App 数据库，复核导入、下单、入库、出库和备份恢复结果。

Options:
  --run-id <id>       prepare 时指定验收批次号
  --manifest <path>   verify 时指定 manifest.json；不传则使用最近一次
  -h, --help          显示帮助`);
}

function argValue(name) {
  const index = cliArgs.indexOf(name);
  return index === -1 ? null : cliArgs[index + 1] ?? null;
}

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(filePath, rows) {
  fs.writeFileSync(
    filePath,
    rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n",
  );
}

function runSqlite(dbPath, sql, { json = false } = {}) {
  const args = json ? ["-json", dbPath, sql] : [dbPath, sql];
  const output = execFileSync("sqlite3", args, { encoding: "utf8" }).trim();
  return json ? (output ? JSON.parse(output) : []) : output;
}

function ensureSqlite() {
  const result = spawnSync("sqlite3", ["--version"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("未找到 sqlite3 命令，无法备份或复核桌面数据库。");
  }
}

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function latestManifest() {
  if (!fs.existsSync(defaultRoot)) {
    return null;
  }

  const manifests = fs
    .readdirSync(defaultRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(defaultRoot, entry.name, "manifest.json"))
    .filter((filePath) => fs.existsSync(filePath))
    .sort();

  return manifests.at(-1) ?? null;
}

function prepare() {
  ensureSqlite();

  const runId = argValue("--run-id") ?? timestamp();
  const outputDir = path.join(defaultRoot, runId);
  fs.mkdirSync(outputDir, { recursive: true });

  const names = {
    customer: `桌面验收客户-${runId}`,
    product: `桌面验收商品-${runId}`,
    mold: `DTA-${runId.slice(-6)}`,
  };
  const files = {
    customerCsv: path.join(outputDir, `customers-${runId}.csv`),
    productCsv: path.join(outputDir, `products-${runId}.csv`),
    orderItemsCsv: path.join(outputDir, `order-items-${runId}.csv`),
    backupBeforeAcceptance: path.join(
      outputDir,
      `real-db-before-desktop-acceptance-${runId}.sqlite`,
    ),
    manualBackupTarget: path.join(
      outputDir,
      `manual-backup-from-app-${runId}.sqlite`,
    ),
  };

  writeCsv(files.customerCsv, [
    [
      "客户名称",
      "手机",
      "客户地址",
      "默认计价",
      "含税断桥加工费",
      "含税喷涂加工费",
      "含税坯料加工费",
      "含税氧化加工费",
      "含税电泳加工费",
      "不含税断桥加工费",
      "不含税喷涂加工费",
      "不含税坯料加工费",
      "不含税氧化加工费",
      "不含税电泳加工费",
    ],
    [
      names.customer,
      "13800138000",
      `桌面验收地址-${runId}`,
      "不含税",
      "1800",
      "1200",
      "800",
      "1500",
      "1600",
      "1700",
      "1100",
      "700",
      "1400",
      "1500",
    ],
  ]);
  writeCsv(files.productCsv, [
    ["商品名称", "模具编号", "厚度", "米重"],
    [names.product, names.mold, "1.20mm", "2.500kg/m"],
  ]);
  writeCsv(files.orderItemsCsv, [
    ["商品名称", "长度(mm)", "颜色", "数量", "备注"],
    [names.product, "6000", "灰色", "6", "桌面验收订单明细"],
  ]);

  if (fs.existsSync(defaultDbPath)) {
    runSqlite(defaultDbPath, `.backup ${quoteSql(files.backupBeforeAcceptance)}`);
  }

  const manifest = {
    appPath,
    createdAt: new Date().toISOString(),
    dbPath: defaultDbPath,
    expected: {
      color: "灰色",
      customerName: names.customer,
      handlerName: "桌面验收",
      firstDeliveryQuantity: 2,
      firstPowderWeightX100: 2000,
      lengthMm: 6000,
      moldCode: names.mold,
      orderQuantity: 6,
      productName: names.product,
      remainderQuantity: 3,
      secondDeliveryQuantity: 1,
      secondPowderWeightX100: 1000,
      customerInventory: {
        mergedDeliveryNote: `桌面验收客户库存合并出库-${runId}`,
        mergedGroupA: "第一车",
        mergedGroupB: "第二车",
        mergedPowderFeeA: "1.3",
        mergedPowderFeeB: "1.4",
        mergedQuantityA: 2,
        mergedQuantityB: 3,
        mergedRefA: `CI-MERGE-A-${runId}`,
        mergedRefB: `CI-MERGE-B-${runId}`,
        mergedWeightAX100: 1100,
        mergedWeightBX100: 1200,
        singleDeliveryNote: `桌面验收客户库存单批次出库-${runId}`,
        singlePowderFee: "1.2",
        singleQuantity: 2,
        singleRef: `CI-SINGLE-${runId}`,
        singleWeightX100: 1234,
      },
    },
    files,
    outputDir,
    runId,
  };

  const manifestPath = path.join(outputDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  fs.writeFileSync(
    path.join(outputDir, "runbook.md"),
    buildRunbook(manifest, manifestPath),
  );

  console.log(`桌面验收数据已准备：${outputDir}`);
  console.log(`manifest: ${manifestPath}`);
  console.log(`真实库预备份: ${files.backupBeforeAcceptance}`);
  console.log(`客户导入: ${files.customerCsv}`);
  console.log(`商品导入: ${files.productCsv}`);
  console.log(`订单明细导入: ${files.orderItemsCsv}`);
}

function buildRunbook(manifest, manifestPath) {
  const { expected, files } = manifest;

  return `# 桌面 App 验收 ${manifest.runId}

## 启动前

- 目标 App：\`${manifest.appPath}\`
- 数据库：\`${manifest.dbPath}\`
- 当前真实库预备份：\`${files.backupBeforeAcceptance}\`
- 验收后复核命令：

\`\`\`bash
pnpm run desktop:acceptance -- verify --manifest ${manifestPath}
\`\`\`

## 桌面操作

1. 启动目标 release App，进入设置页核对应用版本、构建时间和数据库路径。
2. 客户页导入：\`${files.customerCsv}\`
3. 商品页导入：\`${files.productCsv}\`
4. 商品页搜索 \`${expected.productName}\`，选择商品并分配给 \`${expected.customerName}\`。
5. 新建订单，选择客户 \`${expected.customerName}\`。
6. 导入订单明细：\`${files.orderItemsCsv}\`
7. 填写经手人：\`${expected.handlerName}\`，铝锭价：\`20000\`，然后下单。
8. 可选 OCR 人工抽查：如果手头有入库图片，图片内容应包含模具 \`${expected.moldCode}\`、颜色 \`${expected.color}\`、长度 \`${expected.lengthMm}\`、支数 \`${expected.orderQuantity}\`。在批量入库弹窗点击“识别图片”，确认图片预览、旋转、识别结果、OCR 原文和重复图片跳过提示正常；抽查后关闭弹窗，不确认入库，避免影响后续自动复核。
9. 库存页对新订单执行普通批量入库，确认本次入库 6 支。
10. 第一次创建出库单：出库数量填写 \`${expected.firstDeliveryQuantity}\`，喷涂重量填写 \`20\`，确认并打开预览；关闭预览后确认订单仍有 4 支，且批量入库已锁定。
11. 第二次创建出库单：出库数量填写 \`${expected.secondDeliveryQuantity}\`，喷涂重量填写 \`10\`，确认并打开预览；关闭预览后确认存在 \`订单号-01\` 和 \`订单号-02\` 两张出库记录。
12. 点击“处理剩余库存”，选择“转入客户库存”，确认剩余 \`${expected.remainderQuantity}\` 支全部转入并完结订单库存。
13. 库存页切到“客户库存”，新增客户库存批次：
    - 客户：\`${expected.customerName}\`
    - 历史日期：\`2026-06-20\`
    - 历史单号：\`${expected.customerInventory.singleRef}\`
    - 铝锭价：\`20000\`
    - 计价方式：\`含税\`
    - 喷涂加工费：\`${expected.customerInventory.singlePowderFee}\`
    - 批次备注：\`单批次\`
    - 明细：\`${expected.productName}\`，长度 \`6000\`，颜色 \`灰色\`，数量 \`6\`
14. 对上一步批次创建客户库存出库单：
    - 经手人：\`${expected.handlerName}\`
    - 喷涂重量：\`12.34\`
    - 出库数量：\`2\`
    - 出库单备注：\`${expected.customerInventory.singleDeliveryNote}\`
    - 预期客户库存出库单列表显示类型：\`单批次\`
15. 继续新增两个客户库存批次，客户、商品和铝锭价同上；两批次喷涂加工费故意不同，用于验证合并出库生成两个计价方案：
    - 批次 A：历史日期 \`2026-06-21\`，历史单号 \`${expected.customerInventory.mergedRefA}\`，喷涂加工费 \`${expected.customerInventory.mergedPowderFeeA}\`，批次备注 \`前第一车\`，数量 \`5\`
    - 批次 B：历史日期 \`2026-06-22\`，历史单号 \`${expected.customerInventory.mergedRefB}\`，喷涂加工费 \`${expected.customerInventory.mergedPowderFeeB}\`，批次备注 \`前第二车\`，数量 \`6\`
16. 勾选批次 A 和批次 B，执行客户库存合并出库：
    - 经手人：\`${expected.handlerName}\`
    - 批次 A（历史日期较早、通常显示在第二组）喷涂重量：\`11\`，出库数量：\`2\`，分组：\`${expected.customerInventory.mergedGroupA}\`
    - 批次 B（历史日期较新、通常显示在第一组）喷涂重量：\`12\`，出库数量：\`3\`，分组：\`${expected.customerInventory.mergedGroupB}\`
    - 注意：不要按界面“第一组/第二组”套用重量；必须按批次 A/B 对应填写。当前日期排序下，界面第一组通常是批次 B，第二组通常是批次 A。
    - 出库单备注：\`${expected.customerInventory.mergedDeliveryNote}\`
    - 预期客户库存出库单列表显示类型：\`合并\`
17. 设置页手动备份，建议保存到：\`${files.manualBackupTarget}\`
18. 使用刚保存的备份恢复，确认恢复前安全备份已生成。
19. 回到订单列表确认新订单仍存在，状态为“剩余转客户”。

## 期望数据

- 客户：\`${expected.customerName}\`
- 商品：\`${expected.productName}\`
- 模具编号：\`${expected.moldCode}\`
- 订单数量：\`${expected.orderQuantity}\`
- 订单库存：两次出库后剩余 3 支，手动转客户库存后为 \`0\`
- 出库单：\`订单号-01\` 出 2 支、喷涂重量 \`20.00 kg\`；\`订单号-02\` 出 1 支、喷涂重量 \`10.00 kg\`
- 库存流水：\`produce +6\`、\`ship -2\`、\`ship -1\`、\`transfer_customer -3\`
- 订单转客户库存批次：\`source_order_id = 订单号\`，当前库存 3 支，客户库存流水 \`transfer_order +3\`
- 客户库存单批次出库单号：\`批次号-01\`
- 客户库存合并出库单号：\`客户首字母-CK日期-01\`
- 客户库存出库单列表类型：单批次出库显示 \`单批次\`，合并出库显示 \`合并\`
`;
}

function assertCheck(checks, condition, message, detail = "") {
  checks.push({ detail, message, ok: Boolean(condition) });
}

function verify() {
  ensureSqlite();

  const manifestPath = argValue("--manifest") ?? latestManifest();
  if (!manifestPath) {
    throw new Error("没有找到 manifest，请先运行 prepare。");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const { dbPath, expected, files } = manifest;
  const checks = [];
  const nameSql = quoteSql(expected.customerName);
  const productSql = quoteSql(expected.productName);
  const moldSql = quoteSql(expected.moldCode);

  assertCheck(checks, fs.existsSync(dbPath), "桌面数据库存在", dbPath);
  assertCheck(
    checks,
    fs.existsSync(files.backupBeforeAcceptance),
    "验收前真实库备份存在",
    files.backupBeforeAcceptance,
  );
  assertCheck(
    checks,
    fs.existsSync(files.manualBackupTarget),
    "桌面 App 手动备份文件存在",
    files.manualBackupTarget,
  );

  const customers = runSqlite(
    dbPath,
    `SELECT id, customer_name FROM customers WHERE customer_name = ${nameSql};`,
    { json: true },
  );
  const products = runSqlite(
    dbPath,
    `SELECT id, product_name, mold_code FROM products WHERE product_name = ${productSql} AND mold_code = ${moldSql} AND deleted_at IS NULL;`,
    { json: true },
  );

  const customer = customers[0];
  const product = products[0];
  assertCheck(checks, customer, "客户已导入", expected.customerName);
  assertCheck(checks, product, "商品已导入", expected.productName);

  if (customer && product) {
    const assignments = runSqlite(
      dbPath,
      `SELECT COUNT(*) AS count FROM customer_products WHERE customer_id = ${quoteSql(customer.id)} AND product_id = ${quoteSql(product.id)};`,
      { json: true },
    );
    assertCheck(
      checks,
      assignments[0]?.count === 1,
      "商品已分配给客户",
      `${customer.id} -> ${product.id}`,
    );
  }

  const orders = runSqlite(
    dbPath,
    `SELECT id, status, handler_name, aluminum_ingot_price_x100, inventory_locked_at, inventory_closed_at, inventory_close_destination FROM orders WHERE customer_name = ${nameSql} ORDER BY created_at DESC LIMIT 1;`,
    { json: true },
  );
  const order = orders[0];
  assertCheck(checks, order, "订单已创建", expected.customerName);
  assertCheck(checks, order?.status === "ordered", "订单状态为 ordered");
  assertCheck(
    checks,
    order?.handler_name === expected.handlerName,
    "订单经手人正确",
    order?.handler_name,
  );
  assertCheck(
    checks,
    order?.aluminum_ingot_price_x100 === 2000000,
    "订单铝锭价快照正确",
    order?.aluminum_ingot_price_x100,
  );
  assertCheck(checks, Boolean(order?.inventory_locked_at), "首次出库后订单库存已锁定");
  assertCheck(
    checks,
    Boolean(order?.inventory_closed_at) &&
      order?.inventory_close_destination === "customer",
    "订单剩余库存转客户后已完结",
    JSON.stringify(order),
  );

  if (order) {
    const orderItems = runSqlite(
      dbPath,
      `SELECT product_name, product_mold_code, length_mm, color, quantity FROM order_items WHERE order_id = ${quoteSql(order.id)};`,
      { json: true },
    );
    assertCheck(
      checks,
      orderItems.some(
        (item) =>
          item.product_name === expected.productName &&
          item.product_mold_code === expected.moldCode &&
          item.length_mm === expected.lengthMm &&
          item.color === expected.color &&
          item.quantity === expected.orderQuantity,
      ),
      "订单明细导入正确",
      JSON.stringify(orderItems),
    );

    const stocks = runSqlite(
      dbPath,
      `SELECT quantity FROM order_inventory_stocks WHERE order_id = ${quoteSql(order.id)};`,
      { json: true },
    );
    assertCheck(
      checks,
      stocks.length > 0 && stocks.every((stock) => stock.quantity === 0),
      "出库后订单库存为 0",
      JSON.stringify(stocks),
    );

    const notes = runSqlite(
      dbPath,
      `
      SELECT
        delivery_notes.id,
        delivery_notes.powder_weight_kg_x100,
        COALESCE(SUM(delivery_note_items.quantity), 0) AS delivery_quantity
      FROM delivery_notes
      LEFT JOIN delivery_note_items
        ON delivery_note_items.delivery_note_id = delivery_notes.id
      WHERE delivery_notes.order_id = ${quoteSql(order.id)}
      GROUP BY delivery_notes.id
      ORDER BY delivery_notes.id ASC;
      `,
      { json: true },
    );
    assertCheck(
      checks,
      notes.length === 2 &&
        notes[0]?.id === `${order.id}-01` &&
        notes[0]?.delivery_quantity === expected.firstDeliveryQuantity &&
        notes[0]?.powder_weight_kg_x100 === expected.firstPowderWeightX100 &&
        notes[1]?.id === `${order.id}-02` &&
        notes[1]?.delivery_quantity === expected.secondDeliveryQuantity &&
        notes[1]?.powder_weight_kg_x100 === expected.secondPowderWeightX100,
      "两张订单出库单的编号、数量和重量正确",
      JSON.stringify(notes),
    );

    const movements = runSqlite(
      dbPath,
      `SELECT movement_type, delta_quantity, note FROM inventory_movements WHERE order_id = ${quoteSql(order.id)} ORDER BY created_at;`,
      { json: true },
    );
    assertCheck(
      checks,
      movements.some(
        (movement) =>
          movement.movement_type === "produce" &&
          movement.delta_quantity === expected.orderQuantity,
      ),
      "库存流水包含入库 produce +6",
      JSON.stringify(movements),
    );
    assertCheck(
      checks,
      movements.some(
        (movement) =>
          movement.movement_type === "ship" &&
          movement.delta_quantity === -expected.firstDeliveryQuantity,
      ),
      "库存流水包含首次出库 ship -2",
      JSON.stringify(movements),
    );
    assertCheck(
      checks,
      movements.some(
        (movement) =>
          movement.movement_type === "ship" &&
          movement.delta_quantity === -expected.secondDeliveryQuantity,
      ),
      "库存流水包含第二次出库 ship -1",
      JSON.stringify(movements),
    );
    assertCheck(
      checks,
      movements.some(
        (movement) =>
          movement.movement_type === "transfer_customer" &&
          movement.delta_quantity === -expected.remainderQuantity,
      ),
      "库存流水包含转客户库存 transfer_customer -3",
      JSON.stringify(movements),
    );

    const transferredBatches = runSqlite(
      dbPath,
      `
      SELECT
        customer_inventory_batches.id,
        customer_inventory_batches.source_order_id,
        customer_inventory_batches.historical_order_ref,
        customer_inventory_batches.aluminum_ingot_price_x100,
        customer_inventory_batches.pricing_tax_included,
        customer_inventory_batches.powder_processing_fee_x100,
        COALESCE(SUM(customer_inventory_stocks.quantity), 0) AS current_quantity
      FROM customer_inventory_batches
      LEFT JOIN customer_inventory_stocks
        ON customer_inventory_stocks.batch_id = customer_inventory_batches.id
      WHERE customer_inventory_batches.source_order_id = ${quoteSql(order.id)}
      GROUP BY customer_inventory_batches.id;
      `,
      { json: true },
    );
    const transferredBatch = transferredBatches[0];
    assertCheck(
      checks,
      transferredBatches.length === 1 &&
        transferredBatch?.historical_order_ref === order.id &&
        transferredBatch?.aluminum_ingot_price_x100 === 2000000 &&
        transferredBatch?.pricing_tax_included === 0 &&
        transferredBatch?.powder_processing_fee_x100 === 110000 &&
        transferredBatch?.current_quantity === expected.remainderQuantity,
      "订单剩余库存已按订单快照转入客户库存",
      JSON.stringify(transferredBatches),
    );
    if (transferredBatch) {
      const transferredMovements = runSqlite(
        dbPath,
        `SELECT movement_type, delta_quantity FROM customer_inventory_movements WHERE batch_id = ${quoteSql(transferredBatch.id)};`,
        { json: true },
      );
      assertCheck(
        checks,
        transferredMovements.some(
          (movement) =>
            movement.movement_type === "transfer_order" &&
            movement.delta_quantity === expected.remainderQuantity,
        ),
        "客户库存流水包含 transfer_order +3",
        JSON.stringify(transferredMovements),
      );
    }
  }

  const customerInventoryExpected = expected.customerInventory;

  if (customerInventoryExpected) {
    assertCheck(
      checks,
      customer && product,
      "客户库存验收依赖客户和商品数据",
      `${customer?.id ?? "missing customer"} / ${product?.id ?? "missing product"}`,
    );

    if (customer && product) {
      const refs = [
        customerInventoryExpected.singleRef,
        customerInventoryExpected.mergedRefA,
        customerInventoryExpected.mergedRefB,
      ];
      const customerInventoryBatches = runSqlite(
        dbPath,
        `
        SELECT
          customer_inventory_batches.id,
          customer_inventory_batches.historical_order_ref,
          COALESCE(SUM(customer_inventory_stocks.quantity), 0) AS current_quantity
        FROM customer_inventory_batches
        LEFT JOIN customer_inventory_stocks
          ON customer_inventory_stocks.batch_id = customer_inventory_batches.id
        WHERE customer_inventory_batches.customer_id = ${quoteSql(customer.id)}
          AND customer_inventory_batches.historical_order_ref IN (${refs.map(quoteSql).join(", ")})
        GROUP BY customer_inventory_batches.id
        `,
        { json: true },
      );
      const batchByRef = new Map(
        customerInventoryBatches.map((batch) => [
          batch.historical_order_ref,
          batch,
        ]),
      );
      const singleBatch = batchByRef.get(customerInventoryExpected.singleRef);
      const mergedBatchA = batchByRef.get(customerInventoryExpected.mergedRefA);
      const mergedBatchB = batchByRef.get(customerInventoryExpected.mergedRefB);

      assertCheck(checks, singleBatch, "客户库存单批次批次已创建");
      assertCheck(checks, mergedBatchA, "客户库存合并批次 A 已创建");
      assertCheck(checks, mergedBatchB, "客户库存合并批次 B 已创建");
      assertCheck(
        checks,
        singleBatch?.current_quantity === 4,
        "客户库存单批次出库后剩余数量正确",
        JSON.stringify(singleBatch),
      );
      assertCheck(
        checks,
        mergedBatchA?.current_quantity === 3,
        "客户库存合并批次 A 出库后剩余数量正确",
        JSON.stringify(mergedBatchA),
      );
      assertCheck(
        checks,
        mergedBatchB?.current_quantity === 3,
        "客户库存合并批次 B 出库后剩余数量正确",
        JSON.stringify(mergedBatchB),
      );

      if (singleBatch) {
        const singleNotes = runSqlite(
          dbPath,
          `
          SELECT id, batch_id, powder_weight_kg_x100, note
          FROM customer_inventory_delivery_notes
          WHERE batch_id = ${quoteSql(singleBatch.id)}
            AND note = ${quoteSql(customerInventoryExpected.singleDeliveryNote)}
          ORDER BY created_at DESC
          LIMIT 1
          `,
          { json: true },
        );
        const singleNote = singleNotes[0];

        assertCheck(
          checks,
          singleNote?.id === `${singleBatch.id}-01`,
          "客户库存单批次出库单号为 批次号-01",
          singleNote?.id,
        );
        assertCheck(
          checks,
          singleNote?.powder_weight_kg_x100 ===
            customerInventoryExpected.singleWeightX100,
          "客户库存单批次出库喷涂重量正确",
          singleNote?.powder_weight_kg_x100,
        );

        if (singleNote) {
          const singleItems = runSqlite(
            dbPath,
            `
            SELECT COUNT(*) AS item_count, COALESCE(SUM(quantity), 0) AS total_quantity
            FROM customer_inventory_delivery_note_items
            WHERE delivery_note_id = ${quoteSql(singleNote.id)}
            `,
            { json: true },
          );

          assertCheck(
            checks,
            singleItems[0]?.item_count === 1 &&
              singleItems[0]?.total_quantity ===
                customerInventoryExpected.singleQuantity,
            "客户库存单批次出库明细正确",
            JSON.stringify(singleItems[0]),
          );
        }
      }

      const mergedNotes = runSqlite(
        dbPath,
        `
        SELECT id, batch_id, note
        FROM customer_inventory_delivery_notes
        WHERE customer_id = ${quoteSql(customer.id)}
          AND batch_id IS NULL
          AND note = ${quoteSql(customerInventoryExpected.mergedDeliveryNote)}
        ORDER BY created_at DESC
        LIMIT 1
        `,
        { json: true },
      );
      const mergedNote = mergedNotes[0];
      const mergedIdPattern = /^[A-Z0-9]+-CK\d{8}-01$/;

      assertCheck(
        checks,
        mergedNote && mergedIdPattern.test(mergedNote.id),
        "客户库存合并出库单号为 客户首字母-CK日期-01",
        mergedNote?.id,
      );

      if (mergedNote) {
        const mergedItems = runSqlite(
          dbPath,
          `
          SELECT
            customer_inventory_delivery_note_items.quantity,
            customer_inventory_delivery_note_items.group_label,
            customer_inventory_stocks.batch_id,
            customer_inventory_delivery_note_items.price_group_id
          FROM customer_inventory_delivery_note_items
          INNER JOIN customer_inventory_stocks
            ON customer_inventory_stocks.id = customer_inventory_delivery_note_items.stock_id
          WHERE customer_inventory_delivery_note_items.delivery_note_id = ${quoteSql(mergedNote.id)}
          ORDER BY customer_inventory_delivery_note_items.id ASC
          `,
          { json: true },
        );
        const mergedSourceBatchIds = Array.from(
          new Set(mergedItems.map((item) => item.batch_id)),
        );
        const mergedPriceGroups = runSqlite(
          dbPath,
          `
          SELECT id, powder_weight_kg_x100
          FROM customer_inventory_delivery_note_price_groups
          WHERE delivery_note_id = ${quoteSql(mergedNote.id)}
          ORDER BY group_index ASC
          `,
          { json: true },
        );

        assertCheck(
          checks,
          mergedItems.length === 2 &&
            mergedItems.some(
              (item) =>
                item.batch_id === mergedBatchA?.id &&
                item.quantity === customerInventoryExpected.mergedQuantityA &&
                item.group_label === customerInventoryExpected.mergedGroupA,
            ) &&
            mergedItems.some(
              (item) =>
                item.batch_id === mergedBatchB?.id &&
                item.quantity === customerInventoryExpected.mergedQuantityB &&
                item.group_label === customerInventoryExpected.mergedGroupB,
            ),
          "客户库存合并出库明细和分组正确",
          JSON.stringify(mergedItems),
        );
        assertCheck(
          checks,
          mergedSourceBatchIds.length === 2,
          "客户库存合并出库关联两个批次，列表应显示 合并",
          mergedSourceBatchIds.join("、"),
        );
        assertCheck(
          checks,
          mergedPriceGroups.length === 2 &&
            mergedPriceGroups.find(
              (group) =>
                group.id ===
                mergedItems.find((item) => item.batch_id === mergedBatchA?.id)
                  ?.price_group_id,
            )?.powder_weight_kg_x100 ===
              customerInventoryExpected.mergedWeightAX100 &&
            mergedPriceGroups.find(
              (group) =>
                group.id ===
                mergedItems.find((item) => item.batch_id === mergedBatchB?.id)
                  ?.price_group_id,
            )?.powder_weight_kg_x100 ===
              customerInventoryExpected.mergedWeightBX100,
          "客户库存合并出库计价方案重量正确",
          JSON.stringify(mergedPriceGroups),
        );
      }
    }
  }

  const safetyBackups = fs
    .readdirSync(path.dirname(dbPath), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /^order-manager-before-restore-\d+(?:-\d+)?\.sqlite$/.test(entry.name),
    )
    .map((entry) => path.join(path.dirname(dbPath), entry.name))
    .filter(
      (filePath) =>
        fs.statSync(filePath).mtimeMs >= new Date(manifest.createdAt).getTime(),
    );
  assertCheck(
    checks,
    safetyBackups.length > 0,
    "恢复前安全备份已生成",
    safetyBackups.at(-1) ?? "",
  );

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.message}`);
    if (check.detail) {
      console.log(`     ${check.detail}`);
    }
  }

  if (failed.length > 0) {
    console.error(`桌面验收复核失败：${failed.length} 项未通过。`);
    process.exit(1);
  }

  console.log("桌面验收复核通过。");
}

const command = cliArgs[0] ?? "help";

try {
  if (command === "prepare") {
    prepare();
  } else if (command === "verify") {
    verify();
  } else {
    usage();
    process.exit(
      command === "help" || command === "--help" || command === "-h" ? 0 : 1,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
