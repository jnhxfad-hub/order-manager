use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use order_manager_lib::commands::customers::parse_customer_import_file;
use order_manager_lib::commands::orders::parse_order_item_import_file;
use order_manager_lib::commands::products::parse_product_import_file;

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn column_name(mut column: usize) -> String {
    let mut name = String::new();

    while column > 0 {
        let remainder = (column - 1) % 26;
        name.insert(0, char::from(b'A' + remainder as u8));
        column = (column - 1) / 26;
    }

    name
}

fn worksheet_xml(rows: &[Vec<&str>], merges: &[&str]) -> String {
    let mut sheet_data = String::new();

    for (row_index, row) in rows.iter().enumerate() {
        let row_number = row_index + 1;
        sheet_data.push_str(&format!(r#"<row r="{row_number}">"#));

        for (column_index, value) in row.iter().enumerate() {
            if value.is_empty() {
                continue;
            }

            let cell_ref = format!("{}{}", column_name(column_index + 1), row_number);
            sheet_data.push_str(&format!(
                r#"<c r="{cell_ref}" t="inlineStr"><is><t>{}</t></is></c>"#,
                escape_xml(value)
            ));
        }

        sheet_data.push_str("</row>");
    }

    let merge_xml = if merges.is_empty() {
        String::new()
    } else {
        format!(
            r#"<mergeCells count="{}">{}</mergeCells>"#,
            merges.len(),
            merges
                .iter()
                .map(|range| format!(r#"<mergeCell ref="{range}"/>"#))
                .collect::<String>()
        )
    };

    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:Z{}"/>
  <sheetData>{sheet_data}</sheetData>
  {merge_xml}
</worksheet>"#,
        rows.len().max(1)
    )
}

fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xffff_ffff_u32;

    for byte in bytes {
        crc ^= u32::from(*byte);

        for _ in 0..8 {
            crc = if crc & 1 == 1 {
                (crc >> 1) ^ 0xedb8_8320
            } else {
                crc >> 1
            };
        }
    }

    !crc
}

fn write_u16(output: &mut Vec<u8>, value: u16) {
    output.extend_from_slice(&value.to_le_bytes());
}

fn write_u32(output: &mut Vec<u8>, value: u32) {
    output.extend_from_slice(&value.to_le_bytes());
}

fn push_local_zip_file(
    output: &mut Vec<u8>,
    name: &str,
    content: &[u8],
) -> (String, u32, u32, u32) {
    let offset = u32::try_from(output.len()).expect("zip offset fits u32");
    let checksum = crc32(content);
    let size = u32::try_from(content.len()).expect("zip file size fits u32");
    let name_bytes = name.as_bytes();

    write_u32(output, 0x0403_4b50);
    write_u16(output, 20);
    write_u16(output, 0);
    write_u16(output, 0);
    write_u16(output, 0);
    write_u16(output, 0);
    write_u32(output, checksum);
    write_u32(output, size);
    write_u32(output, size);
    write_u16(
        output,
        u16::try_from(name_bytes.len()).expect("zip file name length fits u16"),
    );
    write_u16(output, 0);
    output.extend_from_slice(name_bytes);
    output.extend_from_slice(content);

    (name.to_string(), checksum, size, offset)
}

fn push_central_zip_file(
    output: &mut Vec<u8>,
    name: &str,
    checksum: u32,
    size: u32,
    local_header_offset: u32,
) {
    let name_bytes = name.as_bytes();

    write_u32(output, 0x0201_4b50);
    write_u16(output, 20);
    write_u16(output, 20);
    write_u16(output, 0);
    write_u16(output, 0);
    write_u16(output, 0);
    write_u16(output, 0);
    write_u32(output, checksum);
    write_u32(output, size);
    write_u32(output, size);
    write_u16(
        output,
        u16::try_from(name_bytes.len()).expect("zip file name length fits u16"),
    );
    write_u16(output, 0);
    write_u16(output, 0);
    write_u16(output, 0);
    write_u16(output, 0);
    write_u32(output, 0);
    write_u32(output, local_header_offset);
    output.extend_from_slice(name_bytes);
}

fn write_xlsx(path: &Path, rows: &[Vec<&str>], merges: &[&str]) {
    let files = [
        (
            "[Content_Types].xml",
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"#
                .to_string(),
        ),
        (
            "_rels/.rels",
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"#
                .to_string(),
        ),
        (
            "xl/workbook.xml",
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="真实导入样例" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"#
                .to_string(),
        ),
        (
            "xl/_rels/workbook.xml.rels",
            r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"#
                .to_string(),
        ),
        ("xl/worksheets/sheet1.xml", worksheet_xml(rows, merges)),
    ];
    let mut output = Vec::new();
    let mut central_entries = Vec::new();

    for (name, content) in files {
        central_entries.push(push_local_zip_file(&mut output, name, content.as_bytes()));
    }

    let central_directory_offset =
        u32::try_from(output.len()).expect("central directory offset fits u32");

    for (name, checksum, size, local_header_offset) in &central_entries {
        push_central_zip_file(&mut output, name, *checksum, *size, *local_header_offset);
    }

    let central_directory_size =
        u32::try_from(output.len()).expect("zip length fits u32") - central_directory_offset;
    let entry_count = u16::try_from(central_entries.len()).expect("zip entry count fits u16");

    write_u32(&mut output, 0x0605_4b50);
    write_u16(&mut output, 0);
    write_u16(&mut output, 0);
    write_u16(&mut output, entry_count);
    write_u16(&mut output, entry_count);
    write_u32(&mut output, central_directory_size);
    write_u32(&mut output, central_directory_offset);
    write_u16(&mut output, 0);

    let mut file = fs::File::create(path).expect("create xlsx fixture");
    file.write_all(&output).expect("write xlsx fixture");
}

fn fixture_path(file_name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "order-manager-import-fixtures-{}",
        std::process::id()
    ));
    fs::create_dir_all(&dir).expect("create fixture dir");

    dir.join(file_name)
}

#[test]
fn reports_real_customer_excel_duplicate_names_clearly() {
    let path = fixture_path("客户真实样例.xlsx");
    write_xlsx(
        &path,
        &[
            vec![
                "客户导入样例（合并标题）",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
            ],
            vec![],
            vec![
                " 客户 ",
                " 电话 ",
                " 地址 ",
                " 默认计价是否含税 ",
                " 含税断桥加工费 ",
                " 含税喷涂加工费 ",
                " 含税坯料加工费 ",
                " 含税氧化加工费 ",
                " 含税电泳加工费 ",
                " 不含税断桥加工费 ",
                " 不含税喷涂加工费 ",
                " 不含税坯料加工费 ",
                " 不含税氧化加工费 ",
                " 不含税电泳加工费 ",
                " 特殊计价关键词 ",
                " 特殊含税喷涂加工费 ",
            ],
            vec![
                " 真实客户A ",
                " 13800138000 ",
                " 上海市长地址 1 号 ",
                " 是 ",
                "1,800元/吨",
                "1200元",
                "800",
                "1500.50元／吨",
                "¥1600",
                "1700rmb",
                "1100cny",
                "700元吨",
                "1400",
                "1500",
                "急单",
                "1300元/吨",
            ],
            vec![],
            vec![
                "真实客户A",
                "13800138001",
                "重复客户地址",
                "含税",
                "1800元/吨",
                "1200元",
                "800",
                "1500.50元／吨",
                "¥1600",
                "1700rmb",
                "1100cny",
                "700元吨",
                "1400",
                "1500",
                "",
                "",
            ],
        ],
        &["A1:P1"],
    );

    let result = parse_customer_import_file(path.to_string_lossy().to_string())
        .expect("parse customer excel");

    assert_eq!(result.errors, vec!["第 6 行：客户名称重复"]);
    assert!(result.customers.is_empty());
}

#[test]
fn parses_real_customer_excel_aliases_blank_rows_and_money_units() {
    let path = fixture_path("客户真实样例_成功.xlsx");
    write_xlsx(
        &path,
        &[
            vec![
                "客户导入样例（合并标题）",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
            ],
            vec![],
            vec![
                " 客户 ",
                " 电话 ",
                " 地址 ",
                " 默认计价是否含税 ",
                " 含税断桥加工费 ",
                " 含税喷涂加工费 ",
                " 含税坯料加工费 ",
                " 含税氧化加工费 ",
                " 含税电泳加工费 ",
                " 不含税断桥加工费 ",
                " 不含税喷涂加工费 ",
                " 不含税坯料加工费 ",
                " 不含税氧化加工费 ",
                " 不含税电泳加工费 ",
                " 特殊计价关键词 ",
                " 特殊含税喷涂加工费 ",
            ],
            vec![
                " 真实客户A ",
                " 13800138000 ",
                " 上海市长地址 1 号 ",
                " 是 ",
                "1,800元/吨",
                "1200元",
                "800",
                "1500.50元／吨",
                "¥1600",
                "1700rmb",
                "1100cny",
                "700元吨",
                "1400",
                "1500",
                "急单",
                "1300元/吨",
            ],
        ],
        &["A1:P1"],
    );

    let result = parse_customer_import_file(path.to_string_lossy().to_string())
        .expect("parse customer excel");

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert_eq!(result.customers.len(), 1);
    assert_eq!(result.customers[0].customer_name, "真实客户A");
    assert_eq!(result.customers[0].customer_address, "上海市长地址 1 号");
    assert_eq!(
        result.customers[0].powder_processing_fee_tax_included_x100,
        120_000
    );
    assert_eq!(
        result.customers[0].oxidation_processing_fee_tax_included_x100,
        150_050
    );
    assert_eq!(
        result.customers[0].special_powder_processing_fee_tax_included_x100,
        130_000
    );
}

#[test]
fn parses_real_product_excel_with_aliases_blank_rows_and_mixed_units() {
    let path = fixture_path("商品真实样例_成功.xlsx");
    write_xlsx(
        &path,
        &[
            vec!["商品导入样例（合并标题）", "", "", ""],
            vec![],
            vec![" 名称 ", " 型号 ", " 厚度(mm) ", " 米重(kg/m) "],
            vec![" 90 转角 ", " G9001 ", "1.20mm", "2.500kg/m"],
            vec!["100 扇料", "G9002", "1毫米", "1,234.5kg/m"],
            vec![],
            vec!["氧化边框", "G9003", "1.35 毫米", "2.75 公斤/米"],
        ],
        &["A1:D1"],
    );

    let result =
        parse_product_import_file(path.to_string_lossy().to_string()).expect("parse product excel");

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert_eq!(result.products.len(), 3);
    assert_eq!(result.products[0].product_name, "90 转角");
    assert_eq!(result.products[0].thickness_mm_x100, 120);
    assert_eq!(result.products[0].weight_per_meter_kg_x1000, 2500);
    assert_eq!(result.products[1].weight_per_meter_kg_x1000, 1_234_500);
    assert_eq!(result.products[2].thickness_mm_x100, 135);
    assert_eq!(result.products[2].weight_per_meter_kg_x1000, 2750);
}

#[test]
fn reports_real_product_excel_duplicate_rows_clearly() {
    let path = fixture_path("商品真实样例_重复.xlsx");
    write_xlsx(
        &path,
        &[
            vec!["商品导入样例（合并标题）", "", "", ""],
            vec![],
            vec![" 名称 ", " 型号 ", " 厚度(mm) ", " 米重(kg/m) "],
            vec![" 90 转角 ", " G9001 ", "1.20mm", "2.500kg/m"],
            vec!["90 转角", "G9001", "1.30mm", "2.600kg/m"],
        ],
        &["A1:D1"],
    );

    let result =
        parse_product_import_file(path.to_string_lossy().to_string()).expect("parse product excel");

    assert!(result.products.is_empty());
    assert_eq!(
        result.errors,
        vec![
            "第 5 行：商品名称“90 转角”在导入文件中重复",
            "第 5 行：模具编号“G9001”在导入文件中重复",
        ]
    );
}

#[test]
fn parses_real_order_item_excel_with_aliases_blank_rows_and_units() {
    let path = fixture_path("订单明细真实样例.xlsx");
    write_xlsx(
        &path,
        &[
            vec!["订单明细导入样例（合并标题）", "", "", "", ""],
            vec![],
            vec![" 商品 ", " 长度(mm) ", " 颜色 ", " 数量(支) ", " 备注 "],
            vec![" 70 边框 ", " 6000mm ", " 灰色 ", " 12支 ", " 急单 "],
            vec!["喷涂扇料", "5,500毫米", "砂灰", "8 支", ""],
            vec!["70 边框", "6000mm", "灰色", "2支", "重复规格用于前端提示"],
        ],
        &["A1:E1"],
    );

    let result = parse_order_item_import_file(path.to_string_lossy().to_string())
        .expect("parse order item excel");

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert_eq!(result.rows.len(), 3);
    assert_eq!(result.rows[0].row_number, 4);
    assert_eq!(result.rows[0].length_mm, "6000");
    assert_eq!(result.rows[0].quantity, "12");
    assert_eq!(result.rows[1].length_mm, "5500");
    assert_eq!(result.rows[1].quantity, "8");
    assert_eq!(result.rows[2].length_mm, "6000");
    assert_eq!(result.rows[2].quantity, "2");
}
