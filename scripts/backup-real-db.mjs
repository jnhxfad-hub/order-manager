#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const defaultDbPath = path.join(
  os.homedir(),
  "Library/Application Support/com.jnhxf.order-manager/order-manager.sqlite",
);
const defaultBackupDir = "/private/tmp/order-manager-real-db-backups";
const args = process.argv.slice(2);

if (args[0] === "--") {
  args.shift();
}

function usage() {
  console.log(`Usage:
  pnpm run backup:real-db
  pnpm run backup:real-db -- --output /private/tmp/order-manager.sqlite

Options:
  --db <path>       要备份的真实库路径，默认当前桌面 App 数据库
  --output <path>   备份输出路径，默认 /private/tmp/order-manager-real-db-backups/real-db-backup-<timestamp>.sqlite
  --overwrite       允许覆盖已有输出文件
  -h, --help        显示帮助
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
    throw new Error("未找到 sqlite3 命令，无法备份真实库。");
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

function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  ensureSqlite();

  const dbPath = path.resolve(argValue("--db") ?? defaultDbPath);
  const outputPath = path.resolve(
    argValue("--output") ??
      path.join(defaultBackupDir, `real-db-backup-${timestamp()}.sqlite`),
  );

  if (!fs.existsSync(dbPath)) {
    throw new Error(`真实库不存在：${dbPath}`);
  }

  if (path.resolve(dbPath) === path.resolve(outputPath)) {
    throw new Error("备份输出路径不能覆盖当前真实库。");
  }

  if (fs.existsSync(outputPath)) {
    if (!hasFlag("--overwrite")) {
      throw new Error(`备份文件已存在，请换路径或加 --overwrite：${outputPath}`);
    }

    fs.rmSync(outputPath);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  validateDatabase(dbPath);
  backupDatabase(dbPath, outputPath);
  validateDatabase(outputPath);

  const summary = databaseSummary(outputPath);

  console.log("真实库备份完成。");
  console.log(`数据库：${dbPath}`);
  console.log(`备份文件：${outputPath}`);
  console.log(
    `数据概览：客户 ${summary.customers}，有效商品 ${summary.products}，订单 ${summary.orders}`,
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
