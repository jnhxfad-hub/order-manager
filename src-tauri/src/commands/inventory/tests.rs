use super::*;
use crate::commands::error::CommandError;
use crate::processing_fees::ProcessingFeeSnapshot;
use calamine::Data;
use rusqlite::{params, Connection};

#[test]
fn derives_customer_inventory_delivery_group_between_first_two_commas() {
    assert_eq!(
        derive_customer_inventory_delivery_group_label("虎标膜，第一车，其他备注"),
        "第一车"
    );
    assert_eq!(
        derive_customer_inventory_delivery_group_label("虎标膜, 第二车，其他备注"),
        "第二车"
    );
    assert_eq!(
        derive_customer_inventory_delivery_group_label("虎标膜，第三车"),
        "第三车"
    );
    assert_eq!(derive_customer_inventory_delivery_group_label("虎标膜"), "");
    assert_eq!(
        derive_customer_inventory_delivery_group_label("虎标膜，，其他备注"),
        ""
    );
}

fn setup_conn() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory database");
    conn.execute_batch(include_str!("../../db/migrations/001_init.sql"))
        .expect("run migrations");
    conn
}

fn setup_customer_inventory_import_conn() -> Connection {
    let conn = setup_conn();
    conn.execute_batch(
        "
            INSERT INTO customers (id, customer_name, customer_address)
            VALUES ('import-customer', '导入客户', '导入地址');

            INSERT INTO products (
              id, product_name, mold_code, thickness_mm_x100, weight_per_meter_kg_x1000
            ) VALUES
              ('import-product-1', '导入商品一', 'IMP-001', 120, 2500),
              ('import-product-2', '导入商品二', 'IMP-002', 120, 2500),
              ('unassigned-product', '未分配商品', 'IMP-003', 120, 2500);

            INSERT INTO customer_products (customer_id, product_id)
            VALUES
              ('import-customer', 'import-product-1'),
              ('import-customer', 'import-product-2');
            ",
    )
    .expect("seed customer inventory import fixtures");
    conn
}

fn customer_inventory_import_row(
    row_number: usize,
    batch_key: &str,
    product_name: &str,
    mold_code: &str,
) -> ParsedCustomerInventoryImportRow {
    ParsedCustomerInventoryImportRow {
        row_number,
        batch_key: batch_key.to_string(),
        customer_name: "导入客户".to_string(),
        historical_order_date: Some("2026-07-01".to_string()),
        historical_order_ref: format!("REF-{batch_key}"),
        aluminum_ingot_price_x100: 2_050_000,
        pricing_tax_included: true,
        bridge_processing_fee_x100: 0,
        powder_processing_fee_x100: 100,
        billet_processing_fee_x100: 0,
        oxidation_processing_fee_x100: 0,
        electrophoresis_processing_fee_x100: 0,
        batch_note: format!("批次备注-{batch_key}"),
        product_name: product_name.to_string(),
        mold_code: mold_code.to_string(),
        length_mm: 6000,
        color: "喷涂灰".to_string(),
        quantity: 5,
        item_note: "明细备注".to_string(),
    }
}

fn customer_inventory_import_csv_rows() -> Vec<Vec<String>> {
    vec![
        vec![
            "导入批次标识",
            "客户名称",
            "历史下单日期",
            "历史单号",
            "铝锭价",
            "计价方式",
            "断桥加工费",
            "喷涂加工费",
            "坯料加工费",
            "氧化加工费",
            "电泳加工费",
            "批次备注",
            "商品名称",
            "模具编号",
            "长度(mm)",
            "颜色",
            "当前库存(支)",
            "明细备注",
        ]
        .into_iter()
        .map(str::to_string)
        .collect(),
        vec![
            "TEMP-A",
            "导入客户",
            "2026-07-01",
            "OLD-001",
            "20500.50元/吨",
            "含税",
            "0",
            "1.25",
            "0",
            "0",
            "0",
            "批次备注",
            "导入商品一",
            "IMP-001",
            "6000mm",
            "喷涂灰",
            "5支",
            "明细备注",
        ]
        .into_iter()
        .map(str::to_string)
        .collect(),
    ]
}

#[test]
fn parses_customer_inventory_import_rows_and_reports_invalid_cells() {
    let parsed = parse_customer_inventory_import_rows(customer_inventory_import_csv_rows());
    assert!(parsed.errors.is_empty());
    assert_eq!(parsed.rows.len(), 1);
    assert_eq!(parsed.rows[0].aluminum_ingot_price_x100, 2_050_050);
    assert_eq!(parsed.rows[0].powder_processing_fee_x100, 125);
    assert_eq!(parsed.rows[0].length_mm, 6000);
    assert_eq!(parsed.rows[0].quantity, 5);

    let mut invalid_rows = customer_inventory_import_csv_rows();
    invalid_rows[1][2] = "2026/07/01".to_string();
    invalid_rows[1][4] = "错误金额".to_string();
    let invalid = parse_customer_inventory_import_rows(invalid_rows);
    assert!(invalid
        .errors
        .iter()
        .any(|error| error.contains("日期格式")));
    assert!(invalid.errors.iter().any(|error| error.contains("铝锭价")));

    let missing = parse_customer_inventory_import_rows(vec![
        vec!["客户名称", "商品名称"]
            .into_iter()
            .map(str::to_string)
            .collect(),
        vec!["导入客户", "导入商品一"]
            .into_iter()
            .map(str::to_string)
            .collect(),
    ]);
    assert!(missing
        .errors
        .iter()
        .any(|error| error == "缺少导入批次标识列"));
}

#[test]
fn parses_customer_inventory_csv_multiline_cells_and_excel_dates() {
    assert_eq!(
        parse_customer_inventory_import_csv(
            "\u{FEFF}A,B,C\r\n\"含,逗号\",\"第一行\r\n第二行\",\"包含\"\"引号\"\"\"\r\n",
        ),
        vec![
            vec!["A", "B", "C"],
            vec!["含,逗号", "第一行\r\n第二行", "包含\"引号\""],
        ]
    );

    let excel_date = Data::DateTime(calamine::ExcelDateTime::new(
        45943.0,
        calamine::ExcelDateTimeType::DateTime,
        false,
    ));
    assert_eq!(
        customer_inventory_import_excel_cell_to_string(&excel_date),
        "2025-10-13"
    );
}

#[test]
fn validates_customer_inventory_import_group_and_assignments() {
    let conn = setup_customer_inventory_import_conn();
    let first = customer_inventory_import_row(2, "TEMP-A", "导入商品一", "IMP-001");
    let mut inconsistent = customer_inventory_import_row(3, "TEMP-A", "导入商品二", "IMP-002");
    inconsistent.aluminum_ingot_price_x100 = 2_060_000;
    assert!(
        build_customer_inventory_import_payloads(&conn, &[first.clone(), inconsistent])
            .err()
            .expect("reject inconsistent batch")
            .contains("同批次前一行不一致")
    );

    let mut unknown_customer = first.clone();
    unknown_customer.customer_name = "不存在客户".to_string();
    assert!(
        build_customer_inventory_import_payloads(&conn, &[unknown_customer])
            .err()
            .expect("reject unknown customer")
            .contains("客户不存在")
    );

    let unassigned = customer_inventory_import_row(2, "TEMP-B", "未分配商品", "IMP-003");
    assert!(
        build_customer_inventory_import_payloads(&conn, &[unassigned])
            .err()
            .expect("reject unassigned product")
            .contains("商品未分配给客户")
    );

    let mut duplicate = first.clone();
    duplicate.row_number = 3;
    assert!(
        build_customer_inventory_import_payloads(&conn, &[first, duplicate])
            .err()
            .expect("reject duplicate detail")
            .contains("商品、长度和颜色重复")
    );
}

#[test]
fn allows_existing_batch_id_as_customer_inventory_import_group_key() {
    let mut conn = setup_customer_inventory_import_conn();
    conn.execute(
        "
            INSERT INTO customer_inventory_batches (
              id,
              customer_id,
              customer_name,
              historical_order_date,
              aluminum_ingot_price_x100,
              powder_processing_fee_x100
            ) VALUES (?1, 'import-customer', '导入客户', '2026-07-01', 2050000, 100)
            ",
        ["EXPORTED-BATCH-ID"],
    )
    .expect("seed exported customer inventory batch");

    let imported = import_customer_inventory_batches_inner(
        &mut conn,
        vec![customer_inventory_import_row(
            2,
            "EXPORTED-BATCH-ID",
            "导入商品一",
            "IMP-001",
        )],
    )
    .expect("reimport exported customer inventory batch");

    assert_eq!(imported.batch_count, 1);
    assert_ne!(imported.batch_ids[0], "EXPORTED-BATCH-ID");
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM customer_inventory_batches",
            [],
            |row| row.get::<_, i64>(0),
        )
        .expect("count reimported customer inventory batches"),
        2
    );
}

#[test]
fn imports_customer_inventory_atomically_and_writes_movements() {
    let mut conn = setup_customer_inventory_import_conn();
    let first = customer_inventory_import_row(2, "TEMP-A", "导入商品一", "IMP-001");
    let mut second = customer_inventory_import_row(3, "TEMP-B", "导入商品二", "IMP-002");
    second.quantity = 7;
    let result =
        import_customer_inventory_batches_inner(&mut conn, vec![first.clone(), second.clone()])
            .expect("import customer inventory batches");
    assert_eq!(result.batch_count, 2);
    assert_eq!(result.item_count, 2);
    assert_eq!(result.total_quantity, 12);
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM customer_inventory_batches",
            [],
            |row| row.get::<_, i64>(0)
        )
        .expect("count batches"),
        2
    );
    assert_eq!(
            conn.query_row(
                "SELECT COUNT(*) FROM customer_inventory_movements WHERE movement_type = 'historical_import'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("count import movements"),
            2
        );

    let mut rollback_conn = setup_customer_inventory_import_conn();
    let mut invalid_second = second;
    invalid_second.historical_order_date = Some("2026/07/01".to_string());
    assert!(import_customer_inventory_batches_inner(
        &mut rollback_conn,
        vec![first, invalid_second],
    )
    .err()
    .expect("reject invalid second batch")
    .contains("日期格式"));
    for table in [
        "customer_inventory_batches",
        "customer_inventory_stocks",
        "customer_inventory_movements",
    ] {
        let count = rollback_conn
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get::<_, i64>(0)
            })
            .expect("count rolled back rows");
        assert_eq!(count, 0, "{table} should be rolled back");
    }
}

#[test]
fn maps_inventory_list_errors_to_internal_error() {
    assert_eq!(
        map_inventory_list_error("failed to query order inventory".to_string()),
        CommandError::new("INTERNAL_ERROR", "failed to query order inventory")
    );
    assert_eq!(
        map_inventory_list_error("failed to sum inventory quantity".to_string()),
        CommandError::new("INTERNAL_ERROR", "failed to sum inventory quantity")
    );
}

#[test]
fn maps_customer_inventory_list_errors_to_internal_error() {
    assert_eq!(
        map_customer_inventory_list_error("failed to query customer inventory batches".to_string()),
        CommandError::new(
            "INTERNAL_ERROR",
            "failed to query customer inventory batches"
        )
    );
    assert_eq!(
        map_customer_inventory_list_error("failed to sum customer inventory quantity".to_string()),
        CommandError::new(
            "INTERNAL_ERROR",
            "failed to sum customer inventory quantity"
        )
    );
}

#[test]
fn reads_customer_inventory_print_snapshot_with_positive_stock_only() {
    let conn = setup_conn();
    conn.execute_batch(
            "
            INSERT INTO customers (id, customer_name, customer_address)
            VALUES
              ('customer-print', '打印客户', '打印地址'),
              ('customer-empty', '空库存客户', '空库存地址');

            INSERT INTO customer_inventory_batches (
              id,
              customer_id,
              customer_name,
              customer_address,
              historical_order_date,
              historical_order_ref,
              aluminum_ingot_price_x100,
              pricing_tax_included,
              bridge_processing_fee_x100,
              powder_processing_fee_x100,
              billet_processing_fee_x100,
              oxidation_processing_fee_x100,
              electrophoresis_processing_fee_x100,
              note
            ) VALUES
              ('BATCH-002', 'customer-print', '打印客户', '打印地址', '2026-07-02', 'OLD-002', 2000000, 1, 320000, 310000, 300000, 0, 0, '第二批'),
              ('BATCH-001', 'customer-print', '打印客户', '打印地址', '2026-07-01', 'OLD-001', 2000000, 1, 320000, 310000, 300000, 0, 0, '第一批'),
              ('BATCH-EMPTY', 'customer-empty', '空库存客户', '空库存地址', '2026-07-03', '', 2000000, 1, 320000, 310000, 300000, 0, 0, '空批次');

            INSERT INTO customer_inventory_stocks (
              id,
              batch_id,
              product_name,
              mold_code,
              length_mm,
              color,
              quantity,
              note
            ) VALUES
              ('stock-positive', 'BATCH-001', '打印商品', 'M-001', 6000, '灰色', 5, '保留'),
              ('stock-zero', 'BATCH-002', '零库存商品', 'M-002', 6000, '白色', 0, '过滤'),
              ('stock-empty-customer', 'BATCH-EMPTY', '空库存商品', 'M-003', 6000, '灰色', 0, '过滤');
            ",
        )
        .expect("seed customer inventory print data");

    let snapshot = query_customer_inventory_print_snapshot(&conn, "customer-print")
        .expect("query print snapshot")
        .expect("print customer exists");

    assert_eq!(snapshot.customer_name, "打印客户");
    assert_eq!(snapshot.customer_address, "打印地址");
    assert_eq!(snapshot.batches.len(), 1);
    assert_eq!(snapshot.batches[0].id, "BATCH-001");
    assert_eq!(snapshot.batches[0].aluminum_ingot_price_x100, 2_000_000);
    assert!(snapshot.batches[0].pricing_tax_included);
    assert_eq!(snapshot.batches[0].bridge_processing_fee_x100, 320_000);
    assert_eq!(snapshot.batches[0].powder_processing_fee_x100, 310_000);
    assert_eq!(snapshot.batches[0].billet_processing_fee_x100, 300_000);
    assert_eq!(snapshot.batches[0].oxidation_processing_fee_x100, 0);
    assert_eq!(snapshot.batches[0].electrophoresis_processing_fee_x100, 0);
    assert_eq!(snapshot.batches[0].items.len(), 1);
    assert_eq!(snapshot.batches[0].items[0].id, "stock-positive");
    assert_eq!(snapshot.item_count, 1);
    assert_eq!(snapshot.total_quantity, 5);
    assert!(snapshot.generated_at.ends_with('Z'));

    assert!(query_customer_inventory_print_snapshot(&conn, "missing")
        .expect("query missing print customer")
        .is_none());
    assert!(matches!(
        query_customer_inventory_print_snapshot(&conn, "customer-empty"),
        Err(message) if message == "该客户暂无当前库存"
    ));
    assert_eq!(
        map_customer_inventory_print_snapshot_error("该客户暂无当前库存".to_string()),
        CommandError::new("CUSTOMER_INVENTORY_EMPTY", "该客户暂无当前库存")
    );
}

#[test]
fn maps_get_customer_inventory_batch_errors_to_stable_codes() {
    assert_eq!(
        map_get_customer_inventory_batch_error("请选择客户库存批次".to_string()),
        CommandError::new("CUSTOMER_INVENTORY_BATCH_REQUIRED", "请选择客户库存批次")
    );
    assert_eq!(
        map_get_customer_inventory_batch_error("客户库存批次不存在".to_string()),
        CommandError::new("CUSTOMER_INVENTORY_BATCH_NOT_FOUND", "客户库存批次不存在")
    );
    assert_eq!(
        map_get_customer_inventory_batch_error(
            "failed to read customer inventory batch".to_string()
        ),
        CommandError::new("INTERNAL_ERROR", "failed to read customer inventory batch")
    );
}

#[test]
fn maps_create_customer_inventory_batch_errors_to_stable_codes() {
    let cases = [
        ("请选择客户", "CUSTOMER_INVENTORY_CUSTOMER_REQUIRED"),
        (
            "历史下单日期格式必须为 YYYY-MM-DD",
            "CUSTOMER_INVENTORY_DATE_INVALID",
        ),
        ("铝锭价必须大于 0", "CUSTOMER_INVENTORY_PRICE_INVALID"),
        (
            "请至少添加一项客户库存",
            "CUSTOMER_INVENTORY_ITEMS_REQUIRED",
        ),
        ("客户不存在", "CUSTOMER_INVENTORY_CUSTOMER_NOT_FOUND"),
        ("请选择商品", "CUSTOMER_INVENTORY_PRODUCT_REQUIRED"),
        ("长度必须大于 0", "CUSTOMER_INVENTORY_LENGTH_INVALID"),
        ("颜色不能为空", "CUSTOMER_INVENTORY_COLOR_REQUIRED"),
        ("数量必须大于 0", "CUSTOMER_INVENTORY_QUANTITY_INVALID"),
        (
            "商品不属于当前客户",
            "CUSTOMER_INVENTORY_PRODUCT_NOT_ASSIGNED",
        ),
        (
            "颜色“双面氧化 1#色”同时命中断桥、氧化、电泳，请检查颜色录入",
            "CUSTOMER_INVENTORY_COLOR_CATEGORY_CONFLICT",
        ),
        (
            "含税喷涂加工费未设置",
            "CUSTOMER_INVENTORY_PROCESSING_FEE_NOT_CONFIGURED",
        ),
    ];

    for (message, code) in cases {
        assert_eq!(
            map_create_customer_inventory_batch_error(message.to_string()),
            CommandError::new(code, message)
        );
    }

    assert_eq!(
        map_create_customer_inventory_batch_error(
            "failed to create customer inventory stock".to_string()
        ),
        CommandError::new(
            "INTERNAL_ERROR",
            "failed to create customer inventory stock"
        )
    );
}

#[test]
fn maps_update_customer_inventory_batch_errors_to_stable_codes() {
    let cases = [
        ("请选择客户库存批次", "CUSTOMER_INVENTORY_BATCH_REQUIRED"),
        ("请选择客户", "CUSTOMER_INVENTORY_CUSTOMER_REQUIRED"),
        (
            "历史下单日期格式必须为 YYYY-MM-DD",
            "CUSTOMER_INVENTORY_DATE_INVALID",
        ),
        ("铝锭价必须大于 0", "CUSTOMER_INVENTORY_PRICE_INVALID"),
        (
            "请至少添加一项客户库存",
            "CUSTOMER_INVENTORY_ITEMS_REQUIRED",
        ),
        ("客户库存批次不存在", "CUSTOMER_INVENTORY_BATCH_NOT_FOUND"),
        (
            "该客户库存批次已出库，不能修改",
            "CUSTOMER_INVENTORY_LOCKED",
        ),
        ("客户不存在", "CUSTOMER_INVENTORY_CUSTOMER_NOT_FOUND"),
        ("请选择商品", "CUSTOMER_INVENTORY_PRODUCT_REQUIRED"),
        ("长度必须大于 0", "CUSTOMER_INVENTORY_LENGTH_INVALID"),
        ("颜色不能为空", "CUSTOMER_INVENTORY_COLOR_REQUIRED"),
        ("数量必须大于 0", "CUSTOMER_INVENTORY_QUANTITY_INVALID"),
        (
            "商品不属于当前客户",
            "CUSTOMER_INVENTORY_PRODUCT_NOT_ASSIGNED",
        ),
        (
            "颜色“双面氧化 1#色”同时命中断桥、氧化、电泳，请检查颜色录入",
            "CUSTOMER_INVENTORY_COLOR_CATEGORY_CONFLICT",
        ),
        (
            "含税喷涂加工费未设置",
            "CUSTOMER_INVENTORY_PROCESSING_FEE_NOT_CONFIGURED",
        ),
    ];

    for (message, code) in cases {
        assert_eq!(
            map_update_customer_inventory_batch_error(message.to_string()),
            CommandError::new(code, message)
        );
    }

    assert_eq!(
        map_update_customer_inventory_batch_error(
            "failed to reset customer inventory stocks".to_string()
        ),
        CommandError::new(
            "INTERNAL_ERROR",
            "failed to reset customer inventory stocks"
        )
    );
}

#[test]
fn maps_create_customer_inventory_delivery_note_errors_to_stable_codes() {
    let cases = [
        ("请选择客户库存批次", "CUSTOMER_DELIVERY_BATCH_REQUIRED"),
        ("请输入经手人", "CUSTOMER_DELIVERY_HANDLER_REQUIRED"),
        ("请至少选择一项出库明细", "CUSTOMER_DELIVERY_ITEMS_REQUIRED"),
        ("客户库存批次不存在", "CUSTOMER_INVENTORY_BATCH_NOT_FOUND"),
        (
            "只能合并同一客户的库存批次",
            "CUSTOMER_DELIVERY_BATCH_CUSTOMER_MISMATCH",
        ),
        ("重量不能小于 0", "CUSTOMER_DELIVERY_WEIGHT_INVALID"),
        ("出库数量不能小于 0", "CUSTOMER_DELIVERY_QUANTITY_INVALID"),
        (
            "出库明细不属于所选客户库存批次",
            "CUSTOMER_DELIVERY_ITEM_BATCH_MISMATCH",
        ),
        (
            "出库明细必须属于同一客户",
            "CUSTOMER_DELIVERY_CUSTOMER_MISMATCH",
        ),
        (
            "合并出库的批次价格快照必须一致，请拆开出库",
            "CUSTOMER_DELIVERY_BATCH_PRICING_MISMATCH",
        ),
        (
            "出库明细的价格快照必须一致，请拆开出库",
            "CUSTOMER_DELIVERY_ITEM_PRICING_MISMATCH",
        ),
        ("请填写断桥重量", "CUSTOMER_DELIVERY_BRIDGE_WEIGHT_REQUIRED"),
        ("请填写喷涂重量", "CUSTOMER_DELIVERY_POWDER_WEIGHT_REQUIRED"),
        ("请填写坯料重量", "CUSTOMER_DELIVERY_BILLET_WEIGHT_REQUIRED"),
        (
            "请填写氧化重量",
            "CUSTOMER_DELIVERY_OXIDATION_WEIGHT_REQUIRED",
        ),
        (
            "请填写电泳重量",
            "CUSTOMER_DELIVERY_ELECTROPHORESIS_WEIGHT_REQUIRED",
        ),
        ("收费金额不能小于 0", "DELIVERY_EXTRA_CHARGE_AMOUNT_INVALID"),
        (
            "收费金额必须大于 0",
            "DELIVERY_EXTRA_CHARGE_AMOUNT_REQUIRED",
        ),
        (
            "请至少录入一项出库数量",
            "CUSTOMER_DELIVERY_QUANTITY_REQUIRED",
        ),
        ("出库商品不能为空", "CUSTOMER_DELIVERY_PRODUCT_REQUIRED"),
        ("客户库存商品不存在", "CUSTOMER_DELIVERY_ITEM_NOT_FOUND"),
        ("历史库存出库单不存在", "CUSTOMER_DELIVERY_NOT_FOUND"),
        (
            "颜色“双面氧化 1#色”同时命中断桥、氧化、电泳，请检查颜色录入",
            "CUSTOMER_DELIVERY_COLOR_CATEGORY_CONFLICT",
        ),
        (
            "含税喷涂加工费未设置",
            "CUSTOMER_DELIVERY_PROCESSING_FEE_NOT_CONFIGURED",
        ),
    ];

    for (message, code) in cases {
        assert_eq!(
            map_create_customer_inventory_delivery_note_error(message.to_string()),
            CommandError::new(code, message)
        );
    }

    assert_eq!(
        map_create_customer_inventory_delivery_note_error(
            "测试商品 出库数量不能大于当前库存".to_string()
        ),
        CommandError::new(
            "CUSTOMER_DELIVERY_ITEM_INSUFFICIENT_STOCK",
            "测试商品 出库数量不能大于当前库存"
        )
    );
    assert_eq!(
        map_create_customer_inventory_delivery_note_error("测试商品 出库分组不能为空".to_string()),
        CommandError::new(
            "CUSTOMER_DELIVERY_GROUP_REQUIRED",
            "测试商品 出库分组不能为空"
        )
    );
    assert_eq!(
        map_create_customer_inventory_delivery_note_error(
            "failed to create customer inventory delivery note item".to_string()
        ),
        CommandError::new(
            "INTERNAL_ERROR",
            "failed to create customer inventory delivery note item"
        )
    );
}

#[test]
fn maps_customer_inventory_adjust_errors_to_stable_codes() {
    let cases = [
        ("请选择客户库存明细", "CUSTOMER_INVENTORY_STOCK_REQUIRED"),
        (
            "盘点数量不能小于 0",
            "CUSTOMER_INVENTORY_ADJUST_QUANTITY_INVALID",
        ),
        ("客户库存商品不存在", "CUSTOMER_INVENTORY_STOCK_NOT_FOUND"),
        ("盘点数量未变化", "CUSTOMER_INVENTORY_ADJUST_UNCHANGED"),
    ];

    for (message, code) in cases {
        assert_eq!(
            map_customer_inventory_adjust_error(message.to_string()),
            CommandError::new(code, message)
        );
    }

    assert_eq!(
        map_customer_inventory_adjust_error(
            "failed to write customer inventory movement".to_string()
        ),
        CommandError::new(
            "INTERNAL_ERROR",
            "failed to write customer inventory movement"
        )
    );
}

#[test]
fn maps_get_customer_inventory_delivery_note_errors_to_stable_codes() {
    assert_eq!(
        map_get_customer_inventory_delivery_note_error("出库单号不能为空".to_string()),
        CommandError::new("CUSTOMER_DELIVERY_ID_REQUIRED", "出库单号不能为空")
    );
    assert_eq!(
        map_get_customer_inventory_delivery_note_error("历史库存出库单不存在".to_string()),
        CommandError::new("CUSTOMER_DELIVERY_NOT_FOUND", "历史库存出库单不存在")
    );
    assert_eq!(
        map_get_customer_inventory_delivery_note_error(
            "failed to read customer inventory delivery note".to_string()
        ),
        CommandError::new(
            "INTERNAL_ERROR",
            "failed to read customer inventory delivery note"
        )
    );
}

#[test]
fn zero_inventory_result_keeps_product_snapshot() {
    let result = build_zero_inventory_item(
        "product-1",
        InventoryProduct {
            product_name: "测试商品".to_string(),
            mold_code: "M-001".to_string(),
            thickness_mm_x100: 120,
            weight_per_meter_kg_x1000: 2500,
            order_quantity: 0,
        },
        6000,
        "灰色",
        "盘点归零",
    );

    assert_eq!(result.product_id, "product-1");
    assert_eq!(result.product_name, "测试商品");
    assert_eq!(result.mold_code, "M-001");
    assert_eq!(result.length_mm, 6000);
    assert_eq!(result.color, "灰色");
    assert_eq!(result.quantity, 0);
    assert_eq!(result.latest_note, "盘点归零");
    assert_eq!(result.updated_at, None);
}

#[test]
fn maps_inventory_adjust_business_errors_to_stable_codes() {
    assert_eq!(
        map_inventory_adjust_error("请选择商品".to_string()),
        CommandError::new("INVENTORY_PRODUCT_REQUIRED", "请选择商品")
    );
    assert_eq!(
        map_inventory_adjust_error("出库数量不能大于当前库存".to_string()),
        CommandError::new("INVENTORY_INSUFFICIENT_STOCK", "出库数量不能大于当前库存")
    );
    assert_eq!(
        map_inventory_adjust_error("商品不存在".to_string()),
        CommandError::new("INVENTORY_PRODUCT_NOT_FOUND", "商品不存在")
    );
    assert_eq!(
        map_inventory_adjust_error("failed to read inventory stock: locked".to_string()),
        CommandError::new("INTERNAL_ERROR", "failed to read inventory stock: locked")
    );
}

#[test]
fn maps_order_inventory_adjust_business_errors_to_stable_codes() {
    let cases = [
        ("请选择订单", "ORDER_INVENTORY_ORDER_REQUIRED"),
        ("请选择商品", "ORDER_INVENTORY_PRODUCT_REQUIRED"),
        ("长度必须大于 0", "ORDER_INVENTORY_LENGTH_INVALID"),
        ("颜色不能为空", "ORDER_INVENTORY_COLOR_REQUIRED"),
        (
            "订单库存类型不正确",
            "ORDER_INVENTORY_MOVEMENT_TYPE_INVALID",
        ),
        ("数量必须大于 0", "ORDER_INVENTORY_QUANTITY_INVALID"),
        ("该订单已出库，库存已锁定", "ORDER_INVENTORY_LOCKED"),
        ("订单商品不存在", "ORDER_INVENTORY_ITEM_NOT_FOUND"),
        (
            "出库数量不能大于当前订单库存",
            "ORDER_INVENTORY_INSUFFICIENT_STOCK",
        ),
    ];

    for (message, code) in cases {
        assert_eq!(
            map_order_inventory_adjust_error(message.to_string()),
            CommandError::new(code, message)
        );
    }

    assert_eq!(
        map_order_inventory_adjust_error("failed to read order inventory stock".to_string()),
        CommandError::new("INTERNAL_ERROR", "failed to read order inventory stock")
    );
}

#[test]
fn maps_order_inventory_batch_adjust_business_errors_to_stable_codes() {
    let cases = [
        ("请选择订单", "ORDER_INVENTORY_ORDER_REQUIRED"),
        (
            "请至少录入一项入库数量",
            "ORDER_INVENTORY_BATCH_ITEMS_REQUIRED",
        ),
        ("订单商品不能为空", "ORDER_INVENTORY_PRODUCT_REQUIRED"),
        ("长度必须大于 0", "ORDER_INVENTORY_LENGTH_INVALID"),
        ("颜色不能为空", "ORDER_INVENTORY_COLOR_REQUIRED"),
        ("入库数量必须大于 0", "ORDER_INVENTORY_QUANTITY_INVALID"),
        ("该订单已出库，库存已锁定", "ORDER_INVENTORY_LOCKED"),
        ("订单商品不存在", "ORDER_INVENTORY_ITEM_NOT_FOUND"),
    ];

    for (message, code) in cases {
        assert_eq!(
            map_order_inventory_batch_adjust_error(message.to_string()),
            CommandError::new(code, message)
        );
    }

    assert_eq!(
        map_order_inventory_batch_adjust_error("failed to write inventory movement".to_string()),
        CommandError::new("INTERNAL_ERROR", "failed to write inventory movement")
    );
}

#[test]
fn maps_public_inventory_transfer_business_errors_to_stable_codes() {
    let cases = [
        ("请选择订单", "INVENTORY_TRANSFER_ORDER_REQUIRED"),
        ("请选择商品", "INVENTORY_TRANSFER_PRODUCT_REQUIRED"),
        ("长度必须大于 0", "INVENTORY_TRANSFER_LENGTH_INVALID"),
        ("颜色不能为空", "INVENTORY_TRANSFER_COLOR_REQUIRED"),
        ("转入数量必须大于 0", "INVENTORY_TRANSFER_QUANTITY_INVALID"),
        ("该订单已出库，库存已锁定", "ORDER_INVENTORY_LOCKED"),
        ("订单商品不存在", "ORDER_INVENTORY_ITEM_NOT_FOUND"),
        (
            "转入数量不能大于公共库存",
            "INVENTORY_TRANSFER_INSUFFICIENT_STOCK",
        ),
    ];

    for (message, code) in cases {
        assert_eq!(
            map_public_inventory_transfer_error(message.to_string()),
            CommandError::new(code, message)
        );
    }

    assert_eq!(
        map_public_inventory_transfer_error("failed to update order inventory stock".to_string()),
        CommandError::new("INTERNAL_ERROR", "failed to update order inventory stock")
    );
}

#[test]
fn maps_order_inventory_remainder_transfer_errors_to_stable_codes() {
    let cases = [
        ("请选择订单", "ORDER_INVENTORY_REMAINDER_ORDER_REQUIRED"),
        (
            "请选择剩余库存去向",
            "ORDER_INVENTORY_REMAINDER_DESTINATION_REQUIRED",
        ),
        ("订单不存在或未下单", "ORDER_NOT_FOUND_OR_NOT_ORDERED"),
        (
            "订单首次出库后才能处理剩余库存",
            "ORDER_INVENTORY_REMAINDER_NOT_LOCKED",
        ),
        ("该订单库存已完结", "ORDER_INVENTORY_CLOSED"),
        ("当前订单没有剩余库存", "ORDER_INVENTORY_REMAINDER_EMPTY"),
        ("订单客户不存在", "ORDER_CUSTOMER_NOT_FOUND"),
    ];

    for (message, code) in cases {
        assert_eq!(
            map_order_inventory_remainder_transfer_error(message.to_string()),
            CommandError::new(code, message)
        );
    }

    assert_eq!(
        map_order_inventory_remainder_transfer_error(
            "failed to transfer remainder to public inventory".to_string()
        ),
        CommandError::new(
            "INTERNAL_ERROR",
            "failed to transfer remainder to public inventory"
        )
    );
}

#[test]
fn maps_delivery_note_business_errors_to_stable_codes() {
    let cases = [
        ("请选择订单", "DELIVERY_ORDER_REQUIRED"),
        ("请至少选择一项出库明细", "DELIVERY_ITEMS_REQUIRED"),
        ("重量不能小于 0", "DELIVERY_WEIGHT_INVALID"),
        ("收费金额不能小于 0", "DELIVERY_EXTRA_CHARGE_AMOUNT_INVALID"),
        (
            "收费金额必须大于 0",
            "DELIVERY_EXTRA_CHARGE_AMOUNT_REQUIRED",
        ),
        ("订单不存在或未下单", "DELIVERY_ORDER_NOT_FOUND"),
        (
            "该订单库存已完结，不能继续出库",
            "DELIVERY_INVENTORY_CLOSED",
        ),
        ("当前订单没有可出库库存", "DELIVERY_NO_STOCK"),
        ("请至少录入一项出库数量", "DELIVERY_QUANTITY_REQUIRED"),
        ("出库数量不能小于 0", "DELIVERY_QUANTITY_INVALID"),
        (
            "出库数量不能大于当前订单库存",
            "DELIVERY_INSUFFICIENT_STOCK",
        ),
        ("出库商品不能为空", "DELIVERY_PRODUCT_REQUIRED"),
        ("订单商品不存在", "DELIVERY_ITEM_NOT_FOUND"),
        ("长度必须大于 0", "DELIVERY_LENGTH_INVALID"),
        ("颜色不能为空", "DELIVERY_COLOR_REQUIRED"),
        ("请填写断桥重量", "DELIVERY_BRIDGE_WEIGHT_REQUIRED"),
        ("请填写喷涂重量", "DELIVERY_POWDER_WEIGHT_REQUIRED"),
        ("请填写坯料重量", "DELIVERY_BILLET_WEIGHT_REQUIRED"),
        ("请填写氧化重量", "DELIVERY_OXIDATION_WEIGHT_REQUIRED"),
        ("请填写电泳重量", "DELIVERY_ELECTROPHORESIS_WEIGHT_REQUIRED"),
        ("出库单不存在", "DELIVERY_NOT_FOUND"),
        (
            "颜色“国标氧化 1#色”同时命中氧化、电泳，请检查颜色录入",
            "DELIVERY_COLOR_CATEGORY_CONFLICT",
        ),
        (
            "含税喷涂加工费未设置，请先维护客户资料",
            "DELIVERY_PROCESSING_FEE_NOT_CONFIGURED",
        ),
        (
            "客户资料未设置含税加工费，请先维护客户资料",
            "DELIVERY_PRICING_NOT_CONFIGURED",
        ),
    ];

    for (message, code) in cases {
        assert_eq!(
            map_create_delivery_note_error(message.to_string()),
            CommandError::new(code, message)
        );
    }

    assert_eq!(
        map_create_delivery_note_error("测试商品 出库数量不能大于当前库存".to_string()),
        CommandError::new(
            "DELIVERY_ITEM_INSUFFICIENT_STOCK",
            "测试商品 出库数量不能大于当前库存"
        )
    );
    assert_eq!(
        map_create_delivery_note_error("failed to create delivery note".to_string()),
        CommandError::new("INTERNAL_ERROR", "failed to create delivery note")
    );
}

#[test]
fn maps_get_delivery_note_errors_to_stable_codes() {
    assert_eq!(
        map_get_delivery_note_error("出库单号不能为空".to_string()),
        CommandError::new("DELIVERY_ID_REQUIRED", "出库单号不能为空")
    );
    assert_eq!(
        map_get_delivery_note_error("出库单不存在".to_string()),
        CommandError::new("DELIVERY_NOT_FOUND", "出库单不存在")
    );
    assert_eq!(
        map_get_delivery_note_error("failed to read delivery note".to_string()),
        CommandError::new("INTERNAL_ERROR", "failed to read delivery note")
    );
}

fn order_with_snapshot_prices() -> DeliveryOrder {
    DeliveryOrder {
        customer_id: Some("missing-customer".to_string()),
        customer_name: "测试客户".to_string(),
        customer_address: String::new(),
        handler_name: "经手人".to_string(),
        aluminum_ingot_price_x100: 2_000_000,
        pricing_tax_included: true,
        processing_fees: ProcessingFeeSnapshot::new(100, 200, 300, 450, 550),
        note: String::new(),
    }
}

fn insert_delivered_order_fixture(conn: &Connection) {
    conn.execute(
        "
            INSERT INTO customers (id, customer_name)
            VALUES ('customer-1', '锁定客户')
            ",
        [],
    )
    .expect("insert customer");
    conn.execute(
        "
            INSERT INTO products (
              id,
              product_name,
              mold_code,
              thickness_mm_x100,
              weight_per_meter_kg_x1000
            )
            VALUES ('product-1', '锁定商品', 'LOCK-1', 120, 2500)
            ",
        [],
    )
    .expect("insert product");
    conn.execute(
        "
            INSERT INTO orders (
              id,
              customer_id,
              customer_name,
              handler_name,
              aluminum_ingot_price_x100,
              powder_processing_fee_x100,
              status,
              ordered_date,
              inventory_locked_at
            )
            VALUES (
              'ALU20260623001',
              'customer-1',
              '锁定客户',
              '经手人',
              2000000,
              100,
              'ordered',
              '2026-06-23',
              CURRENT_TIMESTAMP
            )
            ",
        [],
    )
    .expect("insert order");
    conn.execute(
        "
            INSERT INTO order_items (
              id,
              order_id,
              product_id,
              product_name,
              product_mold_code,
              thickness_mm_x100,
              weight_per_meter_kg_x1000,
              length_mm,
              color,
              quantity,
              theoretical_weight_kg_x100
            )
            VALUES (
              'item-1',
              'ALU20260623001',
              'product-1',
              '锁定商品',
              'LOCK-1',
              120,
              2500,
              6000,
              '灰色',
              2,
              3000
            )
            ",
        [],
    )
    .expect("insert order item");
    conn.execute(
        "
            INSERT INTO order_inventory_stocks (
              order_id,
              product_id,
              length_mm,
              color,
              quantity
            )
            VALUES ('ALU20260623001', 'product-1', 6000, '灰色', 1)
            ",
        [],
    )
    .expect("insert order stock");
    conn.execute(
        "
            INSERT INTO inventory_stocks (
              product_id,
              length_mm,
              color,
              quantity
            )
            VALUES ('product-1', 6000, '灰色', 1)
            ",
        [],
    )
    .expect("insert public stock");
    conn.execute(
        "
            INSERT INTO delivery_notes (
              id,
              order_id,
              customer_name,
              handler_name,
              aluminum_ingot_price_x100,
              powder_processing_fee_x100,
              powder_weight_kg_x100
            )
            VALUES (
              'ALU20260623001-01',
              'ALU20260623001',
              '锁定客户',
              '经手人',
              2000000,
              100,
              1000
            )
            ",
        [],
    )
    .expect("insert delivery note");
}

#[test]
fn order_inventory_query_keeps_order_and_item_notes_separate() {
    let conn = setup_conn();
    insert_delivered_order_fixture(&conn);
    conn.execute(
        "UPDATE orders SET note = '完整订单备注' WHERE id = 'ALU20260623001'",
        [],
    )
    .expect("update order note");
    conn.execute(
        "UPDATE order_items SET note = '订单明细备注' WHERE order_id = 'ALU20260623001'",
        [],
    )
    .expect("update order item note");

    let items = query_order_inventory_items(&conn, "").expect("query order inventory");

    assert_eq!(items.len(), 1);
    assert_eq!(items[0].order_note, "完整订单备注");
    assert_eq!(items[0].note, "订单明细备注");

    conn.execute(
        "UPDATE orders SET note = NULL WHERE id = 'ALU20260623001'",
        [],
    )
    .expect("clear order note to null");
    let items_with_null_note =
        query_order_inventory_items(&conn, "").expect("query null order note");

    assert_eq!(items_with_null_note[0].order_note, "");
    assert_eq!(items_with_null_note[0].note, "订单明细备注");
}

#[test]
fn normalizes_multiple_delivery_charges_and_rejects_invalid_rows() {
    let charges = vec![
        DeliveryExtraCharge {
            name: " 运费 ".into(),
            amount_x100: 20010,
        },
        DeliveryExtraCharge {
            name: "装车费".into(),
            amount_x100: 5020,
        },
    ];
    let rows = normalize_delivery_extra_charges(&charges).unwrap();
    assert_eq!(rows.iter().map(|row| row.amount_x100).sum::<i64>(), 25030);
    assert_eq!(rows[0].name, "运费");
    assert!(normalize_delivery_extra_charges(&[]).unwrap().is_empty());
    for (name, amount_x100) in [("", 100), ("运费", 0), ("运费", -1), ("运费", i64::MAX)] {
        assert!(normalize_delivery_extra_charges(&[DeliveryExtraCharge {
            name: name.into(),
            amount_x100
        }])
        .is_err());
    }
}

#[test]
fn delivery_charge_details_are_the_only_stored_fee_data() {
    let conn = setup_conn();
    insert_delivered_order_fixture(&conn);
    assert!(query_delivery_note(&conn, "ALU20260623001-01")
        .unwrap()
        .unwrap()
        .extra_charges
        .is_empty());
    let columns = conn
        .prepare("PRAGMA table_info(delivery_notes)")
        .unwrap()
        .query_map([], |row| row.get::<_, String>(1))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert!(!columns.iter().any(|name| name.starts_with("extra_charge")));
    for (position, name, amount) in [(0, "运费", 20010), (1, "装车费", 5020)] {
        conn.execute("INSERT INTO delivery_note_extra_charges (delivery_note_id, position, name, amount_x100) VALUES ('ALU20260623001-01', ?1, ?2, ?3)", params![position, name, amount]).unwrap();
    }
    let note = query_delivery_note(&conn, "ALU20260623001-01")
        .unwrap()
        .unwrap();
    assert_eq!(note.extra_charges.len(), 2);
    assert_eq!(note.extra_charges[0].name, "运费");
    assert_eq!(note.extra_charges[1].amount_x100, 5020);
}

#[test]
fn normalizes_delivery_extra_charge() {
    let charge = normalize_delivery_extra_charge(" 运费 ", 20_000).expect("normalize extra charge");

    assert_eq!(charge.name, "运费");
    assert_eq!(charge.amount_x100, 20_000);
}

#[test]
fn clears_delivery_extra_charge_amount_when_name_is_blank() {
    let charge =
        normalize_delivery_extra_charge("  ", 20_000).expect("normalize blank extra charge");

    assert_eq!(charge.name, "");
    assert_eq!(charge.amount_x100, 0);
}

#[test]
fn rejects_invalid_delivery_extra_charge() {
    assert_eq!(
        match normalize_delivery_extra_charge("运费", 0) {
            Ok(_) => panic!("should reject zero amount"),
            Err(error) => error,
        },
        "收费金额必须大于 0"
    );
    assert_eq!(
        match normalize_delivery_extra_charge("", -1) {
            Ok(_) => panic!("should reject negative amount"),
            Err(error) => error,
        },
        "收费金额不能小于 0"
    );
}

#[test]
fn delivery_pricing_falls_back_to_order_snapshot_for_oxidation_and_electrophoresis() {
    let conn = setup_conn();
    let order = order_with_snapshot_prices();

    let pricing = resolve_delivery_note_pricing(&conn, &order, true).expect("resolve pricing");

    assert_eq!(pricing.profile_name, "默认价");
    assert_eq!(pricing.processing_fees.oxidation, 450);
    assert_eq!(pricing.processing_fees.electrophoresis, 550);
}

#[test]
fn delivery_pricing_does_not_use_order_snapshot_when_tax_mode_changes() {
    let conn = setup_conn();
    let order = order_with_snapshot_prices();

    let error = match resolve_delivery_note_pricing(&conn, &order, false) {
        Ok(_) => panic!("should reject missing switched pricing"),
        Err(error) => error,
    };

    assert_eq!(error, "客户资料未设置不含税加工费，请先维护客户资料");
}

#[test]
fn detached_order_customer_keeps_delivery_snapshot_available() {
    let conn = setup_conn();
    conn.execute(
        "
            INSERT INTO orders (
              id,
              customer_id,
              customer_name,
              handler_name,
              aluminum_ingot_price_x100,
              pricing_tax_included,
              powder_processing_fee_x100,
              status
            ) VALUES (
              'ALU20260717001',
              NULL,
              '已删除客户快照',
              '经手人',
              2000000,
              1,
              125,
              'ordered'
            )
            ",
        [],
    )
    .expect("insert detached ordered snapshot");

    let order = query_order_for_delivery_note(&conn, "ALU20260717001")
        .expect("read detached ordered snapshot")
        .expect("ordered snapshot exists");

    assert!(order.customer_id.is_none());
    assert_eq!(order.customer_name, "已删除客户快照");
    let pricing =
        resolve_delivery_note_pricing(&conn, &order, true).expect("use ordered pricing snapshot");
    assert_eq!(pricing.processing_fees.powder, 125);
}

#[test]
fn customer_inventory_delivery_note_id_increments_within_batch() {
    let conn = setup_conn();
    let first_batch_id = "YZHZ-20260618001";
    let second_batch_id = "YZHZ-20260618002";
    let customer_id = "customer-1";

    conn.execute(
        "
            INSERT INTO customers (id, customer_name)
            VALUES (?1, '测试客户')
            ",
        [customer_id],
    )
    .expect("insert customer");
    for batch_id in [first_batch_id, second_batch_id] {
        conn.execute(
            "
                INSERT INTO customer_inventory_batches (
                  id,
                  customer_id,
                  customer_name,
                  aluminum_ingot_price_x100
                ) VALUES (?1, ?2, '测试客户', 2000000)
                ",
            params![batch_id, customer_id],
        )
        .expect("insert customer inventory batch");
    }
    let first_batch = query_customer_inventory_batch(&conn, first_batch_id)
        .expect("read first batch")
        .expect("first batch exists");
    let second_batch = query_customer_inventory_batch(&conn, second_batch_id)
        .expect("read second batch")
        .expect("second batch exists");

    assert_eq!(
        next_customer_inventory_delivery_note_id(&conn, &first_batch, false)
            .expect("generate first delivery note id"),
        "YZHZ-20260618001-01"
    );

    conn.execute(
        "
            INSERT INTO customer_inventory_delivery_notes (
              id,
              batch_id,
              customer_name,
              aluminum_ingot_price_x100
            ) VALUES (?1, ?2, '测试客户', 2000000)
            ",
        params!["YZHZ-20260618001-01", first_batch_id],
    )
    .expect("insert first batch delivery note");
    conn.execute(
        "
            INSERT INTO customer_inventory_delivery_notes (
              id,
              batch_id,
              customer_name,
              aluminum_ingot_price_x100
            ) VALUES (?1, ?2, '测试客户', 2000000)
            ",
        params!["YZHZ-20260618002-01", second_batch_id],
    )
    .expect("insert second batch delivery note");
    assert_eq!(
        next_customer_inventory_delivery_note_id(&conn, &first_batch, false)
            .expect("generate second delivery note id"),
        "YZHZ-20260618001-02"
    );
    assert_eq!(
        next_customer_inventory_delivery_note_id(&conn, &second_batch, false)
            .expect("generate independent batch delivery note id"),
        "YZHZ-20260618002-02"
    );

    let delivery_date: String = conn
        .query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
        .expect("read current date");
    let merged_prefix = format!(
        "{}-CK{}",
        customer_name_initials(&first_batch.customer_name),
        delivery_date.replace('-', "")
    );
    assert_eq!(
        next_customer_inventory_delivery_note_id(&conn, &first_batch, true)
            .expect("generate first merged delivery note id"),
        format!("{merged_prefix}-01")
    );

    conn.execute(
        "
            INSERT INTO customer_inventory_delivery_notes (
              id,
              customer_name,
              aluminum_ingot_price_x100
            ) VALUES (?1, '测试客户', 2000000)
            ",
        params![format!("{merged_prefix}-01")],
    )
    .expect("insert first merged delivery note");
    assert_eq!(
        next_customer_inventory_delivery_note_id(&conn, &first_batch, true)
            .expect("generate second merged delivery note id"),
        format!("{merged_prefix}-02")
    );
}

#[test]
fn locks_order_inventory_after_delivery_note_is_created() {
    let conn = setup_conn();
    insert_delivered_order_fixture(&conn);

    let single_adjust_error = apply_order_inventory_adjustment(
        &conn,
        OrderInventoryAdjustmentParams {
            order_id: "ALU20260623001",
            product_id: "product-1",
            length_mm: 6000,
            color: "灰色",
            movement_type: "produce",
            quantity: 1,
            note: "锁定后入库",
        },
    )
    .expect_err("should reject locked order inventory");
    assert_eq!(single_adjust_error, "该订单已出库，库存已锁定");

    let transfer_error = ensure_order_inventory_unlocked(&conn, "ALU20260623001")
        .expect_err("should reject public transfer");
    assert_eq!(transfer_error, "该订单已出库，库存已锁定");
}

#[test]
fn keeps_inventory_locked_while_allowing_next_delivery_note_number() {
    let conn = setup_conn();
    insert_delivered_order_fixture(&conn);

    let delivery_note_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM delivery_notes WHERE order_id = ?1",
            ["ALU20260623001"],
            |row| row.get(0),
        )
        .expect("read delivery note count");
    assert_eq!(delivery_note_count, 1);
    assert_eq!(
        next_order_delivery_note_id(&conn, "ALU20260623001")
            .expect("generate next delivery note id"),
        "ALU20260623001-02"
    );
    conn.execute(
        "INSERT INTO delivery_notes (
               id, order_id, customer_name, handler_name, aluminum_ingot_price_x100
             ) VALUES (
               'ALU20260623001-03', 'ALU20260623001', '锁定客户', '经手人', 2000000
             )",
        [],
    )
    .expect("insert delivery note after sequence gap");
    assert_eq!(
        next_order_delivery_note_id(&conn, "ALU20260623001")
            .expect("generate delivery note id after sequence gap"),
        "ALU20260623001-04"
    );
    assert_eq!(
        ensure_order_inventory_unlocked(&conn, "ALU20260623001")
            .expect_err("should reject inventory adjustment"),
        "该订单已出库，库存已锁定"
    );
}

#[test]
fn locks_batch_order_inventory_after_delivery_note_is_created() {
    let conn = setup_conn();
    insert_delivered_order_fixture(&conn);

    let error = apply_order_inventory_batch_adjustment(
        &conn,
        "ALU20260623001",
        vec![AdjustOrderInventoryBatchItem {
            product_id: "product-1".to_string(),
            length_mm: 6000,
            color: "灰色".to_string(),
            quantity: 1,
        }],
        "锁定后批量入库",
    )
    .expect_err("should reject locked batch order inventory");

    assert_eq!(error, "该订单已出库，库存已锁定");
}

#[test]
fn validates_business_date_format() {
    assert!(validate_date("2026-06-21", "下单日期").is_ok());

    assert_eq!(
        validate_date("20260621", "下单日期").expect_err("should reject compact date"),
        "下单日期格式必须为 YYYY-MM-DD"
    );
    assert_eq!(
        validate_date("2026-6-21", "历史下单日期").expect_err("should reject non padded date"),
        "历史下单日期格式必须为 YYYY-MM-DD"
    );
    assert_eq!(
        validate_date("2026-06-aa", "出库日期").expect_err("should reject non digits"),
        "出库日期格式必须为 YYYY-MM-DD"
    );
}

#[test]
fn resolves_required_customer_inventory_weight_categories() {
    let items = vec![
        CreateCustomerInventoryStockItemPayload {
            product_id: "product-1".to_string(),
            length_mm: 6000,
            color: "坯料".to_string(),
            quantity: 2,
            note: String::new(),
        },
        CreateCustomerInventoryStockItemPayload {
            product_id: "product-2".to_string(),
            length_mm: 6000,
            color: "氧化银白".to_string(),
            quantity: 1,
            note: String::new(),
        },
        CreateCustomerInventoryStockItemPayload {
            product_id: "product-3".to_string(),
            length_mm: 6000,
            color: "1#色".to_string(),
            quantity: 1,
            note: String::new(),
        },
    ];

    let required_weights =
        get_required_customer_inventory_weights(&items).expect("resolve weights");

    assert!(!required_weights.bridge);
    assert!(!required_weights.powder);
    assert!(required_weights.billet);
    assert!(required_weights.oxidation);
    assert!(required_weights.electrophoresis);
}

#[test]
fn validates_processing_fees_for_required_weights() {
    let required_weights = RequiredDeliveryWeights {
        bridge: false,
        powder: false,
        billet: false,
        oxidation: true,
        electrophoresis: true,
    };

    assert_eq!(
        validate_processing_fees_for_required_weights(
            true,
            ProcessingFeeSnapshot::new(0, 0, 0, 0, 500),
            &required_weights,
        )
        .expect_err("should reject missing oxidation fee"),
        "含税氧化加工费未设置"
    );

    assert_eq!(
        validate_processing_fees_for_required_weights(
            false,
            ProcessingFeeSnapshot::new(0, 0, 0, 450, 0),
            &required_weights,
        )
        .expect_err("should reject missing electrophoresis fee"),
        "不含税电泳加工费未设置"
    );

    validate_processing_fees_for_required_weights(
        true,
        ProcessingFeeSnapshot::new(0, 0, 0, 450, 500),
        &required_weights,
    )
    .expect("should accept required fees");
}

#[test]
fn inventory_id_generation_uses_expected_prefixes_and_suffixes() {
    let conn = setup_conn();

    assert_eq!(
        next_movement_id(&conn).expect("first movement"),
        "MOV-000001"
    );
    assert_eq!(
        next_customer_inventory_movement_id(&conn).expect("first customer movement"),
        "CIM-000001"
    );
    let customer_initials = customer_name_initials("客户A");
    let first_batch_id = next_customer_inventory_batch_id(&conn, "客户A", "2026-06-21")
        .expect("first customer batch");

    assert_eq!(customer_name_initials("   "), "KH");
    assert_eq!(first_batch_id, format!("{customer_initials}-20260621001"));
    assert_eq!(
        format_customer_inventory_stock_id(&first_batch_id, 2),
        format!("{first_batch_id}-002")
    );
    assert_eq!(
        format_delivery_note_item_id("ALU20260621001", 3),
        "ALU20260621001-003"
    );

    conn.execute(
        "
            INSERT INTO inventory_movements (
              id,
              product_name,
              mold_code,
              movement_type,
              quantity_before,
              quantity_after,
              delta_quantity
            ) VALUES
              ('MOV-000002', '商品 2', 'M002', 'in', 0, 1, 1),
              ('LEGACY', '旧商品', 'OLD', 'in', 0, 1, 1),
              ('MOV-000010', '商品 10', 'M010', 'in', 0, 1, 1)
            ",
        [],
    )
    .expect("insert inventory movements");
    conn.execute(
        "
            INSERT INTO customers (id, customer_name)
            VALUES ('customer-1', '客户A')
            ",
        [],
    )
    .expect("insert customer");
    conn.execute(
        "
            INSERT INTO customer_inventory_batches (
              id,
              customer_id,
              customer_name,
              aluminum_ingot_price_x100
            ) VALUES
              (?1, 'customer-1', '客户A', 2000000),
              (?2, 'customer-1', '客户A', 2000000)
            ",
        params![
            format!("{customer_initials}-20260621002"),
            format!("{customer_initials}-20260622007")
        ],
    )
    .expect("insert batches");
    conn.execute(
        "
            INSERT INTO customer_inventory_movements (
              id,
              customer_name,
              product_name,
              mold_code,
              movement_type,
              quantity_before,
              quantity_after,
              delta_quantity
            ) VALUES
              ('CIM-000003', '客户A', '商品 3', 'M003', 'historical_import', 0, 1, 1),
              ('CIM-000009', '客户A', '商品 9', 'M009', 'historical_import', 0, 1, 1)
            ",
        [],
    )
    .expect("insert customer inventory movements");

    assert_eq!(
        next_movement_id(&conn).expect("next movement"),
        "MOV-000011"
    );
    assert_eq!(
        next_customer_inventory_movement_id(&conn).expect("next customer movement"),
        "CIM-000010"
    );
    assert_eq!(
        next_customer_inventory_batch_id(&conn, "客户A", "2026-06-21")
            .expect("next same-day batch"),
        format!("{customer_initials}-20260621003")
    );
    assert_eq!(
        next_customer_inventory_batch_id(&conn, "客户A", "2026-06-22")
            .expect("next other-day batch"),
        format!("{customer_initials}-20260622008")
    );
}

#[test]
fn customer_name_initials_use_pinyin_on_all_platforms() {
    // 与 macOS 原来的 Foundation 转换结果一致，且 Windows 上不再回退成 "KH"。
    assert_eq!(customer_name_initials("姜总"), "JZ");
    assert_eq!(customer_name_initials("袁庆龙"), "YQL");
    assert_eq!(customer_name_initials("邹城姜总"), "ZCJZ");
    assert_eq!(customer_name_initials("测试客户"), "CSKH");
    assert_eq!(customer_name_initials("客户A"), "KHA");
    assert_eq!(customer_name_initials("ABC公司"), "AGS");
    assert_eq!(customer_name_initials("   "), "KH");
}
