#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const defaultDbPath = path.join(
  os.homedir(),
  "Library/Application Support/com.jnhxf.order-manager/order-manager.sqlite",
);
const args = process.argv.slice(2);

if (args[0] === "--") {
  args.shift();
}

function usage() {
  console.log(`Usage:
  pnpm run restore:real-db -- --backup /private/tmp/real-db-backup.sqlite --yes
  pnpm run restore:real-db -- --backup /private/tmp/real-db-backup.sqlite --dry-run

Options:
  -b, --backup <path>   要恢复的备份 SQLite 文件，必填
  --db <path>           要恢复到的真实库路径，默认当前桌面 App 数据库
  --yes                 确认执行恢复；没有该参数时不会覆盖真实库
  --dry-run             只校验备份和显示将要执行的动作
  --force-running       App 正在运行时仍继续恢复，不建议使用
  -h, --help            显示帮助
`);
}

function argValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function hasFlag(name) {
  return args.includes(name);
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

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function ensureSqlite() {
  const result = spawnSync("sqlite3", ["--version"], { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error("未找到 sqlite3 命令，无法恢复真实库。");
  }
}

function runSqlite(dbPath, sql) {
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}

function validateDatabase(dbPath) {
  const tableCount = runSqlite(
    dbPath,
    `
      SELECT COUNT(*)
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('orders', 'order_items', 'products', 'customers');
    `,
  );

  if (Number(tableCount) !== 4) {
    throw new Error(`数据库结构不符合订单管理系统要求：${dbPath}`);
  }

  const integrity = runSqlite(dbPath, "PRAGMA integrity_check;");

  if (integrity !== "ok") {
    throw new Error(`数据库完整性检查失败：${integrity}`);
  }
}

function backupDatabase(dbPath, outputPath) {
  runSqlite(dbPath, `VACUUM main INTO ${quoteSql(outputPath)};`);
}

function databaseSummary(dbPath) {
  const [customers, products, orders] = runSqlite(
    dbPath,
    `
      SELECT COUNT(*) FROM customers;
      SELECT COUNT(*) FROM products WHERE deleted_at IS NULL;
      SELECT COUNT(*) FROM orders;
    `,
  ).split("\n");

  return { customers, orders, products };
}

function nextSafetyBackupPath(dbPath) {
  const dir = path.dirname(dbPath);
  const baseName = `order-manager-before-cli-restore-${timestamp()}`;
  let candidate = path.join(dir, `${baseName}.sqlite`);

  for (let suffix = 2; fs.existsSync(candidate); suffix += 1) {
    candidate = path.join(dir, `${baseName}-${suffix}.sqlite`);
  }

  return candidate;
}

function isAppRunning() {
  const result = spawnSync("pgrep", ["-x", "order-manager"], {
    encoding: "utf8",
  });

  return result.status === 0;
}

function removeSidecarFiles(dbPath) {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecarPath = `${dbPath}${suffix}`;

    if (fs.existsSync(sidecarPath)) {
      fs.rmSync(sidecarPath);
    }
  }
}

function replaceDatabaseFile(sourcePath, targetPath) {
  const dir = path.dirname(targetPath);
  const stamp = timestamp();
  const tempRestorePath = path.join(dir, `.order-manager-cli-restore-${stamp}.tmp`);
  const tempCurrentPath = path.join(dir, `.order-manager-current-${stamp}.tmp`);

  if (fs.existsSync(tempRestorePath)) {
    fs.rmSync(tempRestorePath);
  }

  fs.copyFileSync(sourcePath, tempRestorePath);

  if (fs.existsSync(targetPath)) {
    fs.renameSync(targetPath, tempCurrentPath);
  }

  removeSidecarFiles(targetPath);

  try {
    fs.renameSync(tempRestorePath, targetPath);
  } catch (error) {
    if (fs.existsSync(tempCurrentPath)) {
      fs.renameSync(tempCurrentPath, targetPath);
    }

    throw error;
  }

  if (fs.existsSync(tempCurrentPath)) {
    fs.rmSync(tempCurrentPath);
  }
}

function assertDifferentFiles(sourcePath, targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const sourceRealPath = fs.realpathSync(sourcePath);
  const targetRealPath = fs.realpathSync(targetPath);

  if (sourceRealPath === targetRealPath) {
    throw new Error("不能选择当前正在使用的数据库作为恢复来源。");
  }
}

function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  ensureSqlite();

  const backupPathArg = argValue("--backup") ?? argValue("-b");

  if (!backupPathArg) {
    throw new Error("请通过 --backup 指定要恢复的备份文件。");
  }

  const backupPath = path.resolve(backupPathArg);
  const dbPath = path.resolve(argValue("--db") ?? defaultDbPath);
  const dryRun = hasFlag("--dry-run");
  const confirmed = hasFlag("--yes");

  if (!fs.existsSync(backupPath)) {
    throw new Error(`备份文件不存在：${backupPath}`);
  }

  if (!fs.existsSync(path.dirname(dbPath))) {
    throw new Error(`真实库目录不存在：${path.dirname(dbPath)}`);
  }

  assertDifferentFiles(backupPath, dbPath);
  validateDatabase(backupPath);

  const backupSummary = databaseSummary(backupPath);
  const safetyBackupPath = fs.existsSync(dbPath) ? nextSafetyBackupPath(dbPath) : null;

  console.log("恢复前检查通过。");
  console.log(`恢复来源：${backupPath}`);
  console.log(`目标真实库：${dbPath}`);
  console.log(
    `备份数据概览：客户 ${backupSummary.customers}，有效商品 ${backupSummary.products}，订单 ${backupSummary.orders}`,
  );

  if (safetyBackupPath) {
    console.log(`恢复前安全备份将保存到：${safetyBackupPath}`);
  } else {
    console.log("当前真实库不存在，本次不会生成恢复前安全备份。");
  }

  if (dryRun) {
    console.log("dry-run 完成，没有修改真实库。");
    return;
  }

  if (!confirmed) {
    throw new Error("为防误操作，执行恢复必须显式添加 --yes。");
  }

  if (isAppRunning() && !hasFlag("--force-running")) {
    throw new Error(
      "检测到铝材订单管理系统正在运行。请先退出 App 后重试；确需强制恢复时加 --force-running。",
    );
  }

  if (safetyBackupPath) {
    backupDatabase(dbPath, safetyBackupPath);
    validateDatabase(safetyBackupPath);
  }

  replaceDatabaseFile(backupPath, dbPath);
  validateDatabase(dbPath);

  console.log("真实库恢复完成。");
  console.log(`已恢复到：${dbPath}`);

  if (safetyBackupPath) {
    console.log(`恢复前安全备份：${safetyBackupPath}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
