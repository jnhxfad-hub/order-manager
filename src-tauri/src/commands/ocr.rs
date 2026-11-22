use std::cmp::Ordering;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::commands::error::CommandError;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognizeInventoryImagePayload {
    path: String,
    rotation_degrees: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognizedInventoryImageResult {
    raw_text: String,
    items: Vec<RecognizedInventoryImageItem>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecognizedInventoryImageItem {
    mold_code: String,
    product_name: String,
    color: String,
    length_mm: i64,
    quantity: Option<i64>,
    raw_text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadInventoryImagePreviewPayload {
    path: String,
}

#[derive(Clone)]
struct RecognizedTextBlock {
    text: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl RecognizedTextBlock {
    fn left(&self) -> f64 {
        self.x
    }

    fn right(&self) -> f64 {
        self.x + self.width
    }
}

#[derive(Clone)]
struct RecognizedTextLine {
    text: String,
    blocks: Vec<RecognizedTextBlock>,
}

#[derive(Clone)]
struct TableColumnLayout {
    mold_code: (f64, f64),
    product_name: (f64, f64),
    color: (f64, f64),
    length: (f64, f64),
    quantity: (f64, f64),
}

#[derive(Clone)]
struct ParsedInventoryImageRow {
    y: f64,
    item: RecognizedInventoryImageItem,
}

#[derive(Clone)]
struct QuantityColumnRow {
    y: f64,
    quantity: Option<i64>,
}

#[tauri::command]
pub fn recognize_inventory_image(
    payload: RecognizeInventoryImagePayload,
) -> Result<RecognizedInventoryImageResult, CommandError> {
    recognize_inventory_image_inner(payload).map_err(map_inventory_image_recognition_error)
}

fn recognize_inventory_image_inner(
    payload: RecognizeInventoryImagePayload,
) -> Result<RecognizedInventoryImageResult, String> {
    let path = PathBuf::from(payload.path.trim());

    if path.as_os_str().is_empty() {
        return Err("请选择入库图片".to_string());
    }

    if !path.exists() {
        return Err("入库图片不存在".to_string());
    }

    let rotation_degrees = payload.rotation_degrees.unwrap_or(0);
    let input_paths = crop_inventory_image_to_table_regions(&path, rotation_degrees)?;
    let mut fallback_raw_text: Option<String> = None;
    let mut merged_rows: Vec<ParsedInventoryImageRow> = Vec::new();

    for input_path in &input_paths {
        let blocks = match recognize_text_blocks(input_path, 0) {
            Ok(blocks) => blocks,
            Err(error) => {
                remove_temp_ocr_images(&input_paths);
                return Err(error);
            }
        };
        let lines = group_text_blocks_into_lines(blocks);
        let layout = detect_table_column_layout(&lines);
        let mut parsed_rows = parse_inventory_image_rows(&lines);

        if let Some(layout) = layout.as_ref() {
            if let Ok(quantity_rows) = recognize_quantity_column_rows(input_path, layout) {
                fill_missing_quantities_from_quantity_rows(&mut parsed_rows, &quantity_rows);
            }
        }

        let raw_text = if parsed_rows.is_empty() {
            build_inventory_image_raw_text(&lines)
        } else {
            build_inventory_image_raw_text_from_rows(&parsed_rows)
        };

        if !raw_text.trim().is_empty() {
            fallback_raw_text = Some(raw_text.clone());
        } else if fallback_raw_text.is_none() {
            fallback_raw_text = Some(
                lines
                    .iter()
                    .map(|line| line.text.as_str())
                    .collect::<Vec<_>>()
                    .join("\n"),
            );
        }

        merge_inventory_image_rows(&mut merged_rows, parsed_rows);
        let _ = fs::remove_file(input_path);
    }

    if !merged_rows.is_empty() {
        let raw_text = build_inventory_image_raw_text_from_rows(&merged_rows);
        let items = merged_rows
            .into_iter()
            .map(|row| row.item)
            .collect::<Vec<_>>();

        return Ok(RecognizedInventoryImageResult { raw_text, items });
    }

    let raw_text_hint = fallback_raw_text
        .filter(|text| !text.trim().is_empty())
        .map(|text| format!("OCR 原文：\n{text}"))
        .unwrap_or_else(|| "OCR 未识别到文字".to_string());

    Err(format!(
        "未解析到可入库明细，请确认图片包含型材型号、颜色、长度和支数。\n{raw_text_hint}"
    ))
}

fn map_inventory_image_recognition_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择入库图片" => "INVENTORY_IMAGE_REQUIRED",
        "入库图片不存在" => "INVENTORY_IMAGE_NOT_FOUND",
        "入库图片路径包含无法识别的字符" => "INVENTORY_IMAGE_PATH_INVALID",
        "当前系统暂不支持图片文字识别"
        | "当前系统不支持 Vision 图片识别"
        | "当前系统不支持文字识别" => "OCR_UNSUPPORTED",
        "无法初始化文字识别请求" | "无法初始化图片识别" | "图片文字识别失败" => {
            "OCR_RECOGNITION_FAILED"
        }
        _ if message.starts_with("读取入库图片失败：") => "INVENTORY_IMAGE_READ_FAILED",
        _ if message.starts_with("生成临时文件失败：")
            || message.starts_with("创建临时图片失败：")
            || message.starts_with("写入临时图片失败：")
            || message.starts_with("保存临时图片失败：") =>
        {
            "OCR_TEMP_IMAGE_FAILED"
        }
        _ if message.starts_with("未解析到可入库明细") => "OCR_NO_ITEMS",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

#[tauri::command]
pub fn read_inventory_image_preview(
    payload: ReadInventoryImagePreviewPayload,
) -> Result<String, CommandError> {
    read_inventory_image_preview_inner(payload).map_err(map_inventory_image_preview_error)
}

fn read_inventory_image_preview_inner(
    payload: ReadInventoryImagePreviewPayload,
) -> Result<String, String> {
    let path = PathBuf::from(payload.path.trim());

    if path.as_os_str().is_empty() {
        return Err("请选择入库图片".to_string());
    }

    if !path.exists() {
        return Err("入库图片不存在".to_string());
    }

    let mime_type = match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("heic") => "image/heic",
        Some("heif") => "image/heif",
        _ => return Err("请选择 PNG、JPG、WEBP 或 HEIC 图片".to_string()),
    };

    let bytes = fs::read(&path).map_err(|error| format!("读取入库图片失败：{error}"))?;

    Ok(format!("data:{mime_type};base64,{}", encode_base64(&bytes)))
}

fn map_inventory_image_preview_error(message: String) -> CommandError {
    let code = match message.as_str() {
        "请选择入库图片" => "INVENTORY_IMAGE_REQUIRED",
        "入库图片不存在" => "INVENTORY_IMAGE_NOT_FOUND",
        "请选择 PNG、JPG、WEBP 或 HEIC 图片" => "INVENTORY_IMAGE_FORMAT_INVALID",
        _ if message.starts_with("读取入库图片失败：") => "INVENTORY_IMAGE_READ_FAILED",
        _ => "INTERNAL_ERROR",
    };

    CommandError::new(code, message)
}

fn encode_base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let first = chunk[0];
        let second = chunk.get(1).copied().unwrap_or(0);
        let third = chunk.get(2).copied().unwrap_or(0);

        output.push(TABLE[(first >> 2) as usize] as char);
        output.push(TABLE[(((first & 0b0000_0011) << 4) | (second >> 4)) as usize] as char);

        if chunk.len() > 1 {
            output.push(TABLE[(((second & 0b0000_1111) << 2) | (third >> 6)) as usize] as char);
        } else {
            output.push('=');
        }

        if chunk.len() > 2 {
            output.push(TABLE[(third & 0b0011_1111) as usize] as char);
        } else {
            output.push('=');
        }
    }

    output
}

fn parse_inventory_image_rows(lines: &[RecognizedTextLine]) -> Vec<ParsedInventoryImageRow> {
    let blocks = lines
        .iter()
        .flat_map(|line| line.blocks.iter().cloned())
        .collect::<Vec<_>>();
    let layout = detect_table_column_layout(lines);
    let mut rows = parse_inventory_image_rows_by_table_blocks(&blocks, layout.as_ref());

    rows.extend(
        lines
            .iter()
            .filter(|line| line.blocks.is_empty())
            .filter_map(|line| {
                parse_inventory_image_text_line(line).map(|item| ParsedInventoryImageRow {
                    y: table_row_y(line).unwrap_or(0.0),
                    item,
                })
            }),
    );

    rows
}

#[cfg(test)]
fn parse_inventory_image_items(lines: &[RecognizedTextLine]) -> Vec<RecognizedInventoryImageItem> {
    parse_inventory_image_rows(lines)
        .into_iter()
        .map(|row| row.item)
        .collect()
}

fn merge_inventory_image_rows(
    merged_rows: &mut Vec<ParsedInventoryImageRow>,
    rows: Vec<ParsedInventoryImageRow>,
) {
    for row in rows {
        if let Some(existing_row) = merged_rows
            .iter_mut()
            .find(|existing_row| is_same_inventory_image_item(&existing_row.item, &row.item))
        {
            if inventory_image_item_score(&row.item)
                > inventory_image_item_score(&existing_row.item)
            {
                *existing_row = row;
            }
        } else {
            merged_rows.push(row);
        }
    }
}

fn is_same_inventory_image_item(
    left: &RecognizedInventoryImageItem,
    right: &RecognizedInventoryImageItem,
) -> bool {
    normalize_inventory_mold_code_for_lookup(&left.mold_code)
        == normalize_inventory_mold_code_for_lookup(&right.mold_code)
        && left.color == right.color
        && left.length_mm == right.length_mm
}

fn inventory_image_item_score(item: &RecognizedInventoryImageItem) -> i64 {
    let mut score = 0;

    if item.quantity.is_some() {
        score += 10;
    }
    if item.mold_code == normalize_inventory_mold_code_for_lookup(&item.mold_code) {
        score += 1;
    }
    if !item.product_name.trim().is_empty() {
        score += 1;
    }

    score
}

fn normalize_inventory_mold_code_for_lookup(token: &str) -> String {
    normalize_ocr_mold_code_for_lookup(&clean_mold_code(token))
}

fn normalize_ocr_mold_code_for_lookup(token: &str) -> String {
    let chars = token.chars().collect::<Vec<_>>();

    chars
        .iter()
        .enumerate()
        .map(|(index, ch)| {
            let previous_is_digit = index > 0 && chars[index - 1].is_ascii_digit();
            let next_is_digit = chars
                .get(index + 1)
                .is_some_and(|next| next.is_ascii_digit());

            if *ch == 'O' && (previous_is_digit || next_is_digit) {
                '0'
            } else {
                *ch
            }
        })
        .collect()
}

fn crop_inventory_image_to_table_regions(
    path: &PathBuf,
    rotation_degrees: i64,
) -> Result<Vec<PathBuf>, String> {
    let source = image::open(path).map_err(|error| format!("读取入库图片失败：{error}"))?;
    let source = match rotation_degrees.rem_euclid(360) {
        90 => source.rotate90(),
        180 => source.rotate180(),
        270 => source.rotate270(),
        _ => source,
    };

    let mut crops = find_table_region_crops(&source);
    if crops.is_empty() {
        crops.push(source);
    }

    crops
        .into_iter()
        .map(write_temp_ocr_image)
        .collect::<Result<Vec<_>, _>>()
}

fn write_temp_ocr_image(image: image::DynamicImage) -> Result<PathBuf, String> {
    let temp_path = std::env::temp_dir().join(format!(
        "order-manager-ocr-{}.png",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|error| format!("生成临时文件失败：{error}"))?
            .as_nanos()
    ));
    let mut file =
        fs::File::create(&temp_path).map_err(|error| format!("创建临时图片失败：{error}"))?;
    image
        .write_to(&mut file, image::ImageFormat::Png)
        .map_err(|error| format!("写入临时图片失败：{error}"))?;
    file.flush()
        .map_err(|error| format!("保存临时图片失败：{error}"))?;
    Ok(temp_path)
}

fn remove_temp_ocr_images(paths: &[PathBuf]) {
    for path in paths {
        let _ = fs::remove_file(path);
    }
}

fn recognize_quantity_column_rows(
    path: &PathBuf,
    layout: &TableColumnLayout,
) -> Result<Vec<QuantityColumnRow>, String> {
    let column_path = crop_quantity_column_image(path, layout)?;
    let blocks = recognize_text_blocks(&column_path, 0);
    let _ = fs::remove_file(&column_path);
    let blocks = blocks?;

    Ok(group_text_blocks_into_lines(blocks)
        .into_iter()
        .filter_map(|line| {
            let y = table_row_y(&line)?;
            let quantity = parse_quantity_cell(&line.text);

            Some(QuantityColumnRow { y, quantity })
        })
        .collect())
}

fn crop_quantity_column_image(
    path: &PathBuf,
    layout: &TableColumnLayout,
) -> Result<PathBuf, String> {
    let source = image::open(path).map_err(|error| format!("读取支数列图片失败：{error}"))?;
    let width = source.width();
    let height = source.height();

    if width == 0 || height == 0 {
        return Err("支数列图片尺寸异常".to_string());
    }

    let horizontal_padding = 0.018;
    let left_ratio = (layout.quantity.0 - horizontal_padding).clamp(0.0, 1.0);
    let right_ratio = (layout.quantity.1 + horizontal_padding).clamp(0.0, 1.0);
    let left = ((left_ratio * width as f64).floor() as u32).min(width.saturating_sub(1));
    let right = ((right_ratio * width as f64).ceil() as u32).clamp(left + 1, width);
    let column = source.crop_imm(left, 0, right - left, height);
    let scale = 3;
    let enlarged = column.resize(
        (right - left) * scale,
        height * scale,
        image::imageops::FilterType::CatmullRom,
    );

    write_temp_ocr_image(enlarged)
}

fn fill_missing_quantities_from_quantity_rows(
    rows: &mut [ParsedInventoryImageRow],
    quantity_rows: &[QuantityColumnRow],
) {
    for row in rows.iter_mut().filter(|row| row.item.quantity.is_none()) {
        let Some(quantity_row) = nearest_quantity_row(row.y, quantity_rows) else {
            continue;
        };
        let Some(quantity) = quantity_row.quantity else {
            continue;
        };

        row.item.quantity = Some(quantity);
    }
}

fn nearest_quantity_row(y: f64, quantity_rows: &[QuantityColumnRow]) -> Option<&QuantityColumnRow> {
    const MAX_ROW_DISTANCE: f64 = 0.035;

    quantity_rows
        .iter()
        .filter(|row| row.quantity.is_some())
        .map(|row| ((row.y - y).abs(), row))
        .filter(|(distance, _)| *distance <= MAX_ROW_DISTANCE)
        .min_by(|(left_distance, _), (right_distance, _)| {
            left_distance
                .partial_cmp(right_distance)
                .unwrap_or(Ordering::Equal)
        })
        .map(|(_, row)| row)
}

fn find_table_region_crops(image: &image::DynamicImage) -> Vec<image::DynamicImage> {
    let gray = image.to_luma8();
    let (width, height) = gray.dimensions();

    if width == 0 || height == 0 {
        return Vec::new();
    }

    let horizontal_lines = find_table_line_positions(&gray, LineAxis::Horizontal);
    let vertical_lines = find_table_line_positions(&gray, LineAxis::Vertical);
    let Some((top_line, bottom_line)) = widest_pair(&horizontal_lines, height / 5, height * 9 / 10)
    else {
        return Vec::new();
    };
    let Some((left_line, right_line)) = widest_pair(&vertical_lines, width / 8, width * 9 / 10)
    else {
        return Vec::new();
    };
    let padding_x = (width / 80).max(2);
    let padding_y = (height / 80).max(2);
    let left = left_line.saturating_sub(padding_x);
    let top = top_line.saturating_sub(padding_y);
    let right = right_line.saturating_add(padding_x).min(width);
    let bottom = bottom_line.saturating_add(padding_y).min(height);

    if right <= left || bottom <= top {
        return Vec::new();
    }

    let table_height = bottom - top;
    let primary_bottom = top
        .saturating_add((table_height as f64 * 0.58).round() as u32)
        .min(bottom);
    let mut crops = vec![image.crop_imm(left, top, right - left, primary_bottom - top)];

    if primary_bottom < bottom {
        crops.push(image.crop_imm(left, top, right - left, bottom - top));
    }

    crops
}

fn build_inventory_image_raw_text(lines: &[RecognizedTextLine]) -> String {
    let layout = detect_table_column_layout(lines);
    let blocks = lines
        .iter()
        .flat_map(|line| line.blocks.iter().cloned())
        .collect::<Vec<_>>();

    if let Some(layout) = layout.as_ref() {
        let rows = inventory_image_table_rows(&blocks, Some(layout));
        let raw_text = rows
            .iter()
            .filter_map(|line| extract_inventory_image_raw_text_line_by_columns(line, layout))
            .collect::<Vec<_>>()
            .join("\n");

        if !raw_text.trim().is_empty() {
            return raw_text;
        }
    }

    lines
        .iter()
        .filter_map(|line| {
            layout
                .as_ref()
                .and_then(|layout| extract_inventory_image_raw_text_line_by_columns(line, layout))
                .or_else(|| extract_inventory_image_raw_text_line(&line.text))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn build_inventory_image_raw_text_from_rows(rows: &[ParsedInventoryImageRow]) -> String {
    rows.iter()
        .map(|row| {
            let quantity = row
                .item
                .quantity
                .map(|quantity| quantity.to_string())
                .unwrap_or_else(|| "未识别".to_string());

            [
                row.item.mold_code.as_str(),
                row.item.color.as_str(),
                &format_length_for_inventory_image_raw_text(row.item.length_mm),
                quantity.as_str(),
            ]
            .join(" ")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn format_length_for_inventory_image_raw_text(length_mm: i64) -> String {
    if length_mm % 1000 == 0 {
        (length_mm / 1000).to_string()
    } else {
        length_mm.to_string()
    }
}

fn extract_inventory_image_raw_text_line_by_columns(
    line: &RecognizedTextLine,
    layout: &TableColumnLayout,
) -> Option<String> {
    let normalized = normalize_ocr_line(&line.text);
    if normalized.is_empty() || should_ignore_inventory_image_line(&normalized) {
        return None;
    }

    let mold_code = line
        .blocks
        .iter()
        .find(|block| overlaps_bounds(block, layout.mold_code) && looks_like_mold_code(&block.text))
        .map(|block| clean_mold_code(&block.text))?;
    let color = line
        .blocks
        .iter()
        .find(|block| {
            overlaps_bounds(block, layout.color)
                && normalize_recognized_color(&block.text).is_some()
        })
        .and_then(|block| normalize_recognized_color(&block.text))?;
    let length = line
        .blocks
        .iter()
        .find(|block| {
            overlaps_bounds(block, layout.length) && parse_length_to_mm(&block.text).is_some()
        })
        .map(|block| block.text.trim().to_string())?;
    let tokens = normalized
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();
    let quantity = quantity_text_in_column(&line.blocks, layout.quantity)
        .or_else(|| find_explicit_quantity_text(&tokens, 0))
        .unwrap_or_else(|| "未识别".to_string());

    Some([mold_code, color, length, quantity].join(" "))
}

#[derive(Clone, Copy)]
enum LineAxis {
    Horizontal,
    Vertical,
}

fn find_table_line_positions(gray: &image::GrayImage, axis: LineAxis) -> Vec<u32> {
    let (width, height) = gray.dimensions();
    let mut positions = Vec::new();
    let limit = match axis {
        LineAxis::Horizontal => height,
        LineAxis::Vertical => width,
    };
    let scan_limit = match axis {
        LineAxis::Horizontal => width,
        LineAxis::Vertical => height,
    };
    let threshold = (scan_limit as f64 * 0.35).round() as usize;
    let mut run_start: Option<u32> = None;

    for position in 0..limit {
        let dark_count = (0..scan_limit)
            .filter(|offset| match axis {
                LineAxis::Horizontal => gray.get_pixel(*offset, position).0[0] < 190,
                LineAxis::Vertical => gray.get_pixel(position, *offset).0[0] < 190,
            })
            .count();
        let is_line = dark_count >= threshold;

        if is_line {
            if run_start.is_none() {
                run_start = Some(position);
            }
        } else if let Some(start) = run_start.take() {
            positions.push(midpoint_u32(start, position.saturating_sub(1)));
        }
    }

    if let Some(start) = run_start {
        positions.push(midpoint_u32(start, limit.saturating_sub(1)));
    }

    positions
}

fn widest_pair(positions: &[u32], min_distance: u32, max_distance: u32) -> Option<(u32, u32)> {
    let mut best = None;
    let mut best_distance = 0;

    for (left_index, left) in positions.iter().enumerate() {
        for right in positions.iter().skip(left_index + 1) {
            let distance = right.saturating_sub(*left);
            if distance >= min_distance && distance <= max_distance && distance > best_distance {
                best = Some((*left, *right));
                best_distance = distance;
            }
        }
    }

    best
}

fn midpoint_u32(left: u32, right: u32) -> u32 {
    left + (right - left) / 2
}

fn extract_inventory_image_raw_text_line(line: &str) -> Option<String> {
    let normalized = normalize_ocr_line(line);
    if normalized.is_empty() || should_ignore_inventory_image_line(&normalized) {
        return None;
    }

    let tokens = normalized
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();

    let mold_index = tokens
        .iter()
        .position(|token| looks_like_mold_code(token))?;
    let color_index = tokens
        .iter()
        .enumerate()
        .skip(mold_index + 1)
        .find_map(|(index, token)| normalize_recognized_color(token).map(|_| index))?;
    let length_index = (color_index + 1..tokens.len())
        .find(|index| parse_length_to_mm(tokens[*index]).is_some())?;
    let quantity_index = find_raw_text_quantity_index(&tokens, length_index + 1)?;

    Some(
        [
            tokens[mold_index],
            tokens[color_index],
            tokens[length_index],
            tokens[quantity_index],
        ]
        .join(" "),
    )
}

fn parse_inventory_image_rows_by_table_blocks(
    blocks: &[RecognizedTextBlock],
    layout: Option<&TableColumnLayout>,
) -> Vec<ParsedInventoryImageRow> {
    if blocks.is_empty() {
        return Vec::new();
    }

    let mut rows = Vec::new();

    for row in inventory_image_table_rows(blocks, layout) {
        if let Some(item) = parse_inventory_image_line_by_columns(&row, layout)
            .or_else(|| parse_inventory_image_line(&row.text))
        {
            rows.push(ParsedInventoryImageRow {
                y: table_row_y(&row).unwrap_or(0.0),
                item,
            });
        }
    }

    rows
}

fn table_row_y(line: &RecognizedTextLine) -> Option<f64> {
    if line.blocks.is_empty() {
        return None;
    }

    Some(line.blocks.iter().map(|block| block.y).sum::<f64>() / line.blocks.len() as f64)
}

fn inventory_image_table_rows(
    blocks: &[RecognizedTextBlock],
    layout: Option<&TableColumnLayout>,
) -> Vec<RecognizedTextLine> {
    let mold_bounds = layout.map(|layout| layout.mold_code).unwrap_or((0.0, 0.18));
    let mut rows = Vec::new();

    for mold_block in blocks
        .iter()
        .filter(|block| overlaps_bounds(block, mold_bounds) && looks_like_mold_code(&block.text))
    {
        let mut row_blocks = blocks
            .iter()
            .filter(|block| is_same_table_row(mold_block, block))
            .cloned()
            .collect::<Vec<_>>();

        row_blocks.sort_by(|a, b| a.x.partial_cmp(&b.x).unwrap_or(Ordering::Equal));

        rows.push(RecognizedTextLine {
            text: row_blocks
                .iter()
                .map(|block| block.text.as_str())
                .collect::<Vec<_>>()
                .join(" "),
            blocks: row_blocks,
        });
    }

    rows
}

fn is_same_table_row(anchor: &RecognizedTextBlock, block: &RecognizedTextBlock) -> bool {
    (anchor.y - block.y).abs() <= anchor.height.max(block.height).max(0.015) * 1.0
}

fn parse_inventory_image_text_line(
    line: &RecognizedTextLine,
) -> Option<RecognizedInventoryImageItem> {
    if line.blocks.is_empty() {
        return parse_inventory_image_line(&line.text);
    }

    parse_inventory_image_line_by_columns(line, None)
        .or_else(|| parse_inventory_image_line(&line.text))
}

fn parse_inventory_image_line_by_columns(
    line: &RecognizedTextLine,
    layout: Option<&TableColumnLayout>,
) -> Option<RecognizedInventoryImageItem> {
    let normalized = normalize_ocr_line(&line.text);

    if should_ignore_inventory_image_line(&normalized) {
        return None;
    }

    let layout = layout?;
    let mold_block = line.blocks.iter().find(|block| {
        overlaps_bounds(block, layout.mold_code) && looks_like_mold_code(&block.text)
    })?;
    let color_block = line.blocks.iter().find(|block| {
        overlaps_bounds(block, layout.color) && normalize_recognized_color(&block.text).is_some()
    })?;
    let color = normalize_recognized_color(&color_block.text)?;
    let length_block = line.blocks.iter().find(|block| {
        overlaps_bounds(block, layout.length) && parse_length_to_mm(&block.text).is_some()
    })?;
    let length_mm = parse_length_to_mm(&length_block.text)?;
    let tokens = normalized
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();
    let quantity_start_index = tokens
        .iter()
        .position(|token| *token == length_block.text.trim())
        .map(|index| index + 1)
        .unwrap_or(0);
    let quantity = parse_quantity_in_column(&line.blocks, layout.quantity)
        .or_else(|| find_explicit_quantity(&tokens, quantity_start_index));

    let product_name = line
        .blocks
        .iter()
        .filter(|block| overlaps_bounds(block, layout.product_name))
        .map(|block| block.text.trim())
        .collect::<Vec<_>>()
        .join("");

    Some(RecognizedInventoryImageItem {
        mold_code: clean_mold_code(&mold_block.text),
        product_name,
        color,
        length_mm,
        quantity,
        raw_text: normalized,
    })
}

fn parse_inventory_image_line(line: &str) -> Option<RecognizedInventoryImageItem> {
    let normalized = normalize_ocr_line(line);
    let tokens = normalized
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();

    if tokens.len() < 4 || should_ignore_inventory_image_line(&normalized) {
        return None;
    }

    if let Some(item) = parse_inventory_image_line_with_defaults(&normalized, &tokens) {
        return Some(item);
    }

    let mold_index = tokens
        .iter()
        .position(|token| looks_like_mold_code(token))?;
    let color_index = tokens
        .iter()
        .enumerate()
        .skip(mold_index + 1)
        .find_map(|(index, token)| normalize_recognized_color(token).map(|_| index))?;
    let color = normalize_recognized_color(tokens[color_index])?;
    let length_index = (color_index + 1..tokens.len())
        .find(|index| parse_length_to_mm(tokens[*index]).is_some())?;
    let length_mm = parse_length_to_mm(tokens[length_index])?;
    let quantity = parse_quantity_from_table_tokens(&tokens, color_index, length_index);

    let product_name = tokens[mold_index + 1..color_index].join("");

    Some(RecognizedInventoryImageItem {
        mold_code: clean_mold_code(tokens[mold_index]),
        product_name,
        color,
        length_mm,
        quantity,
        raw_text: normalized,
    })
}

fn parse_inventory_image_line_with_defaults(
    normalized: &str,
    tokens: &[&str],
) -> Option<RecognizedInventoryImageItem> {
    let mold_index = tokens
        .iter()
        .position(|token| looks_like_mold_code(token))?;
    let mold_code = clean_mold_code(tokens[mold_index]);

    if !mold_code.starts_with("CL") {
        return None;
    }

    if tokens
        .iter()
        .any(|token| normalize_recognized_color(token).is_some())
    {
        return None;
    }

    let quantity = tokens
        .iter()
        .skip(mold_index + 1)
        .find_map(|token| parse_quantity(token).filter(|quantity| *quantity <= 10000))?;

    if quantity <= 0 {
        return None;
    }

    Some(RecognizedInventoryImageItem {
        mold_code,
        product_name: String::new(),
        color: "灰".to_string(),
        length_mm: 6000,
        quantity: Some(quantity),
        raw_text: normalized.to_string(),
    })
}

fn normalize_ocr_line(line: &str) -> String {
    line.replace('（', "(")
        .replace('）', ")")
        .replace('，', ",")
        .replace('。', ".")
        .replace('：', ":")
        .replace(['丨', '|'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn should_ignore_inventory_image_line(line: &str) -> bool {
    [
        "客户名称",
        "制单日期",
        "铝锭价",
        "出库单号",
        "型材型号",
        "型材名称",
        "合计",
        "总重量",
        "总金额",
        "运费",
        "含税",
        "审核人",
        "制单人",
        "承运人",
        "车牌号",
    ]
    .iter()
    .any(|keyword| line.contains(keyword))
}

fn looks_like_mold_code(token: &str) -> bool {
    let token = clean_mold_code(token);
    let has_ascii_letter = token.chars().any(|ch| ch.is_ascii_alphabetic());
    let has_digit = token.chars().any(|ch| ch.is_ascii_digit());

    has_ascii_letter && has_digit && token.len() >= 4
}

fn clean_mold_code(token: &str) -> String {
    token
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '_')
        .collect::<String>()
        .to_ascii_uppercase()
}

fn normalize_recognized_color(token: &str) -> Option<String> {
    let cleaned = token.trim();

    if cleaned.contains("坯料") {
        return Some("坯料".to_string());
    }

    if cleaned.contains('白') {
        return Some("白".to_string());
    }

    if cleaned.contains('灰') {
        return Some("灰".to_string());
    }

    None
}

fn parse_length_to_mm(token: &str) -> Option<i64> {
    let numeric = clean_numeric_token(token.trim_end_matches("mm").trim_end_matches("毫米"));
    let value = numeric.parse::<f64>().ok()?;

    if value <= 0.0 {
        return None;
    }

    if value < 100.0 {
        Some((value * 1000.0).round() as i64)
    } else {
        Some(value.round() as i64)
    }
}

fn parse_quantity(token: &str) -> Option<i64> {
    let numeric = clean_numeric_token(token.trim_end_matches('支'));
    let value = numeric.parse::<f64>().ok()?;

    if value.fract().abs() > f64::EPSILON {
        return None;
    }

    Some(value as i64)
}

fn quantity_text_in_column(blocks: &[RecognizedTextBlock], bounds: (f64, f64)) -> Option<String> {
    let quantity_blocks = blocks
        .iter()
        .filter(|block| overlaps_bounds(block, bounds))
        .map(|block| block.text.trim())
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>();

    if quantity_blocks.is_empty() {
        return None;
    }

    let combined = quantity_blocks.join(" ");
    parse_quantity_cell(&combined).map(|quantity| {
        if combined.contains('支') {
            format!("{quantity}支")
        } else {
            quantity.to_string()
        }
    })
}

fn find_raw_text_quantity_index(tokens: &[&str], start_index: usize) -> Option<usize> {
    for index in start_index..tokens.len() {
        let token = tokens[index];

        if parse_quantity_with_unit(token).is_some() {
            return Some(index);
        }

        if token == "支" {
            if index > start_index && parse_quantity(tokens[index - 1]).is_some() {
                return Some(index - 1);
            }
        } else if token.ends_with('支') && parse_quantity(token).is_some() {
            return Some(index);
        }
    }

    if tokens.len().saturating_sub(start_index) <= 2 {
        return tokens
            .iter()
            .rev()
            .find_map(|token| parse_quantity(token).filter(|quantity| *quantity > 0))
            .map(|_| tokens.len().saturating_sub(1));
    }

    None
}

fn find_explicit_quantity_text(tokens: &[&str], start_index: usize) -> Option<String> {
    for index in start_index..tokens.len() {
        let token = tokens[index];

        if parse_quantity_with_unit(token).is_some() {
            return Some(token.to_string());
        }

        if token == "支" {
            if index > start_index && parse_quantity(tokens[index - 1]).is_some() {
                return Some(format!("{}支", tokens[index - 1]));
            }
        } else if token.ends_with('支') && token != "支" && parse_quantity(token).is_some() {
            return Some(token.to_string());
        }
    }

    None
}

fn parse_quantity_cell(text: &str) -> Option<i64> {
    let normalized = normalize_ocr_line(text);
    let tokens = normalized
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();

    if let Some(quantity) = find_explicit_quantity(&tokens, 0) {
        return Some(quantity);
    }

    tokens
        .iter()
        .find_map(|token| parse_quantity(token).filter(|quantity| *quantity > 0))
}

fn parse_quantity_from_table_tokens(
    tokens: &[&str],
    color_index: usize,
    length_index: usize,
) -> Option<i64> {
    if let Some(quantity) = find_explicit_quantity(tokens, length_index + 1) {
        return Some(quantity);
    }

    let width_index = length_index + 1;
    let quantity_index = length_index + 2;

    if width_index >= tokens.len() || quantity_index >= tokens.len() {
        return None;
    }

    let _color = normalize_recognized_color(tokens[color_index])?;
    let width = parse_table_wall_thickness(tokens[width_index]);

    width?;

    parse_quantity(tokens[quantity_index]).filter(|quantity| *quantity > 0)
}

fn detect_table_column_layout(lines: &[RecognizedTextLine]) -> Option<TableColumnLayout> {
    let header_line = lines.iter().find(|line| {
        let normalized = normalize_ocr_line(&line.text);
        normalized.contains("型材型号")
            && normalized.contains("型材名称")
            && normalized.contains("颜色")
            && normalized.contains("长度")
            && normalized.contains("壁厚")
            && normalized.contains("支数")
            && normalized.contains("重量")
    })?;

    let mut headers = header_line
        .blocks
        .iter()
        .filter_map(|block| {
            header_column_kind(&block.text).map(|kind| (kind, block.left(), block.right()))
        })
        .collect::<Vec<_>>();

    headers.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(Ordering::Equal));

    let span_of = |kind: HeaderColumnKind| -> Option<(f64, f64)> {
        headers
            .iter()
            .find(|(header_kind, _, _)| *header_kind == kind)
            .map(|(_, left, right)| (*left, *right))
    };

    let mold_code = span_of(HeaderColumnKind::MoldCode)?;
    let product_name = span_of(HeaderColumnKind::ProductName)?;
    let color = span_of(HeaderColumnKind::Color)?;
    let length = span_of(HeaderColumnKind::Length)?;
    let thickness = span_of(HeaderColumnKind::Thickness)?;
    let quantity = span_of(HeaderColumnKind::Quantity)?;
    let weight = span_of(HeaderColumnKind::Weight)?;

    Some(TableColumnLayout {
        mold_code: (0.0, midpoint(mold_code.1, product_name.0)),
        product_name: (
            midpoint(mold_code.1, product_name.0),
            midpoint(product_name.1, color.0),
        ),
        color: (
            midpoint(product_name.1, color.0),
            midpoint(color.1, length.0),
        ),
        length: (midpoint(color.1, length.0), midpoint(length.1, thickness.0)),
        quantity: (
            midpoint(thickness.1, quantity.0),
            midpoint(quantity.1, weight.0),
        ),
    })
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum HeaderColumnKind {
    MoldCode,
    ProductName,
    Color,
    Length,
    Thickness,
    Quantity,
    Weight,
    Price,
    Amount,
}

fn header_column_kind(text: &str) -> Option<HeaderColumnKind> {
    let normalized = normalize_ocr_line(text);

    if normalized.contains("型材型号") {
        return Some(HeaderColumnKind::MoldCode);
    }
    if normalized.contains("型材名称") {
        return Some(HeaderColumnKind::ProductName);
    }
    if normalized.contains("颜色") {
        return Some(HeaderColumnKind::Color);
    }
    if normalized.contains("长度") {
        return Some(HeaderColumnKind::Length);
    }
    if normalized.contains("壁厚") {
        return Some(HeaderColumnKind::Thickness);
    }
    if normalized.contains("支数") {
        return Some(HeaderColumnKind::Quantity);
    }
    if normalized.contains("重量") {
        return Some(HeaderColumnKind::Weight);
    }
    if normalized.contains("单价") {
        return Some(HeaderColumnKind::Price);
    }
    if normalized.contains("金额") {
        return Some(HeaderColumnKind::Amount);
    }

    None
}

fn overlaps_bounds(block: &RecognizedTextBlock, bounds: (f64, f64)) -> bool {
    block.right() > bounds.0 && block.left() < bounds.1
}

fn midpoint(left: f64, right: f64) -> f64 {
    (left + right) / 2.0
}

fn parse_quantity_in_column(blocks: &[RecognizedTextBlock], bounds: (f64, f64)) -> Option<i64> {
    let quantity_blocks = blocks
        .iter()
        .filter(|block| overlaps_bounds(block, bounds))
        .map(|block| block.text.trim())
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>();

    if quantity_blocks.is_empty() {
        return None;
    }

    let combined = quantity_blocks.join(" ");
    parse_quantity_cell(&combined).filter(|quantity| *quantity > 0)
}

fn parse_table_wall_thickness(token: &str) -> Option<f64> {
    let value = clean_numeric_token(token).parse::<f64>().ok()?;

    if value > 0.0 && value < 5.0 {
        Some(value)
    } else {
        None
    }
}

fn find_explicit_quantity(tokens: &[&str], start_index: usize) -> Option<i64> {
    for index in start_index..tokens.len() {
        let token = tokens[index];

        if let Some(quantity) = parse_quantity_with_unit(token) {
            if quantity > 0 {
                return Some(quantity);
            }
        }

        if token == "支" {
            if index > start_index {
                if let Some(quantity) = parse_quantity(tokens[index - 1]) {
                    if quantity > 0 {
                        return Some(quantity);
                    }
                }
            }
        } else if token.ends_with('支') && token != "支" {
            if let Some(quantity) = parse_quantity(token) {
                if quantity > 0 {
                    return Some(quantity);
                }
            }
        }
    }

    None
}

fn parse_quantity_with_unit(token: &str) -> Option<i64> {
    let unit_index = token.find('支')?;
    let numeric = clean_numeric_token(&token[..unit_index]);
    let value = numeric.parse::<f64>().ok()?;

    if value.fract().abs() > f64::EPSILON {
        return None;
    }

    Some(value as i64)
}

fn clean_numeric_token(token: &str) -> String {
    token
        .chars()
        .filter(|ch| ch.is_ascii_digit() || *ch == '.')
        .collect()
}

fn group_text_blocks_into_lines(mut blocks: Vec<RecognizedTextBlock>) -> Vec<RecognizedTextLine> {
    blocks.sort_by(|a, b| {
        b.y.partial_cmp(&a.y)
            .unwrap_or(Ordering::Equal)
            .then_with(|| a.x.partial_cmp(&b.x).unwrap_or(Ordering::Equal))
    });

    let mut rows: Vec<Vec<RecognizedTextBlock>> = Vec::new();

    for block in blocks {
        if let Some(row) = rows.iter_mut().find(|row| {
            let row_y = row.iter().map(|item| item.y).sum::<f64>() / row.len() as f64;
            let row_height = row
                .iter()
                .map(|item| item.height)
                .fold(block.height, f64::max);
            (row_y - block.y).abs() <= row_height.max(0.015) * 0.5
        }) {
            row.push(block);
        } else {
            rows.push(vec![block]);
        }
    }

    rows.into_iter()
        .map(|mut row| {
            row.sort_by(|a, b| a.x.partial_cmp(&b.x).unwrap_or(Ordering::Equal));
            let text = row
                .iter()
                .map(|block| block.text.as_str())
                .collect::<Vec<_>>()
                .join(" ");
            RecognizedTextLine { text, blocks: row }
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn recognize_text_blocks(
    path: &PathBuf,
    rotation_degrees: i64,
) -> Result<Vec<RecognizedTextBlock>, String> {
    macos_vision::recognize_text_blocks(path, rotation_degrees)
}

#[cfg(not(target_os = "macos"))]
fn recognize_text_blocks(
    _path: &PathBuf,
    _rotation_degrees: i64,
) -> Result<Vec<RecognizedTextBlock>, String> {
    Err("当前系统暂不支持图片文字识别".to_string())
}

#[cfg(target_os = "macos")]
mod macos_vision {
    use std::path::PathBuf;
    use std::ptr::NonNull;

    use objc2::msg_send;
    use objc2::rc::{autoreleasepool, Retained};
    use objc2::runtime::{AnyClass, AnyObject};
    use objc2_core_foundation::CGRect;
    use objc2_foundation::{NSArray, NSString, NSURL};

    use super::RecognizedTextBlock;

    pub fn recognize_text_blocks(
        path: &PathBuf,
        rotation_degrees: i64,
    ) -> Result<Vec<RecognizedTextBlock>, String> {
        autoreleasepool(|pool| {
            let url = NSURL::from_file_path(path)
                .ok_or_else(|| "入库图片路径包含无法识别的字符".to_string())?;
            let handler_class = AnyClass::get(c"VNImageRequestHandler")
                .ok_or_else(|| "当前系统不支持 Vision 图片识别".to_string())?;
            let request_class = AnyClass::get(c"VNRecognizeTextRequest")
                .ok_or_else(|| "当前系统不支持文字识别".to_string())?;
            let array_class =
                AnyClass::get(c"NSArray").ok_or_else(|| "无法初始化文字识别请求".to_string())?;

            let request: Retained<AnyObject> = unsafe { msg_send![request_class, new] };
            let recognition_level: i64 = 0;
            // 型号、编号这类混合字母数字串，语言纠错容易把 `0` 误改成 `O`。
            // 这里关闭纠错，让原始识别结果更贴近图片本身。
            let uses_language_correction = false;
            let languages: Retained<NSArray<NSString>> = NSArray::from_slice(&[
                &*NSString::from_str("zh-Hans"),
                &*NSString::from_str("en-US"),
            ]);
            let minimum_text_height: f32 = 0.01;

            unsafe {
                let _: () = msg_send![&*request, setRecognitionLevel: recognition_level];
                let _: () =
                    msg_send![&*request, setUsesLanguageCorrection: uses_language_correction];
                let _: () = msg_send![&*request, setRecognitionLanguages: &*languages];
                let _: () = msg_send![&*request, setMinimumTextHeight: minimum_text_height];
            }

            let handler_alloc: *mut AnyObject = unsafe { msg_send![handler_class, alloc] };
            let orientation = image_orientation_for_rotation(rotation_degrees);
            let handler: *mut AnyObject = unsafe {
                msg_send![
                    handler_alloc,
                    initWithURL: &*url,
                    orientation: orientation,
                    options: None::<&AnyObject>
                ]
            };
            let Some(handler) = NonNull::new(handler) else {
                return Err("无法初始化图片识别".to_string());
            };
            let requests: Retained<AnyObject> =
                unsafe { msg_send![array_class, arrayWithObject: &*request] };
            let success: bool = unsafe {
                msg_send![
                    handler,
                    performRequests: &*requests,
                    error: std::ptr::null_mut::<*mut AnyObject>()
                ]
            };

            if !success {
                return Err("图片文字识别失败".to_string());
            }

            let observations: Option<Retained<NSArray<AnyObject>>> =
                unsafe { msg_send![&*request, results] };
            let Some(observations) = observations else {
                return Ok(Vec::new());
            };

            let mut blocks = Vec::new();

            for observation in observations.iter() {
                let candidates: Option<Retained<NSArray<AnyObject>>> =
                    unsafe { msg_send![&*observation, topCandidates: 1usize] };
                let Some(candidates) = candidates else {
                    continue;
                };

                if candidates.is_empty() {
                    continue;
                }

                let candidate = candidates.objectAtIndex(0);
                let text: Retained<NSString> = unsafe { msg_send![&*candidate, string] };
                let text = unsafe { text.to_str(pool) }.trim().to_string();

                if text.is_empty() {
                    continue;
                }

                let bounding_box: CGRect = unsafe { msg_send![&*observation, boundingBox] };
                blocks.push(RecognizedTextBlock {
                    text,
                    x: bounding_box.origin.x,
                    y: bounding_box.origin.y,
                    width: bounding_box.size.width,
                    height: bounding_box.size.height,
                });
            }

            Ok(blocks)
        })
    }

    fn image_orientation_for_rotation(rotation_degrees: i64) -> u32 {
        match rotation_degrees.rem_euclid(360) {
            90 => 6,
            180 => 3,
            270 => 8,
            _ => 1,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn block(text: &str, x: f64, y: f64, width: f64) -> RecognizedTextBlock {
        RecognizedTextBlock {
            text: text.to_string(),
            x,
            y,
            width,
            height: 0.02,
        }
    }

    fn shipping_note_header() -> RecognizedTextLine {
        RecognizedTextLine {
            text: "型材型号 型材名称 颜色 长度 壁厚 支数 重量 单价 金额".to_string(),
            blocks: vec![
                block("型材型号", 0.06, 0.72, 0.08),
                block("型材名称", 0.20, 0.72, 0.08),
                block("颜色", 0.36, 0.72, 0.05),
                block("长度", 0.46, 0.72, 0.05),
                block("壁厚", 0.55, 0.72, 0.05),
                block("支数", 0.63, 0.72, 0.05),
                block("重量", 0.72, 0.72, 0.05),
                block("单价", 0.82, 0.72, 0.05),
                block("金额", 0.92, 0.72, 0.05),
            ],
        }
    }

    #[test]
    fn maps_inventory_image_recognition_errors_to_stable_codes() {
        let cases = [
            ("请选择入库图片", "INVENTORY_IMAGE_REQUIRED"),
            ("入库图片不存在", "INVENTORY_IMAGE_NOT_FOUND"),
            ("读取入库图片失败：格式损坏", "INVENTORY_IMAGE_READ_FAILED"),
            (
                "入库图片路径包含无法识别的字符",
                "INVENTORY_IMAGE_PATH_INVALID",
            ),
            ("当前系统不支持 Vision 图片识别", "OCR_UNSUPPORTED"),
            ("创建临时图片失败：权限不足", "OCR_TEMP_IMAGE_FAILED"),
            ("图片文字识别失败", "OCR_RECOGNITION_FAILED"),
            (
                "未解析到可入库明细，请确认图片包含型材型号、颜色、长度和支数。",
                "OCR_NO_ITEMS",
            ),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_inventory_image_recognition_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_inventory_image_recognition_error("unexpected OCR error".to_string()),
            CommandError::new("INTERNAL_ERROR", "unexpected OCR error")
        );
    }

    #[test]
    fn maps_inventory_image_preview_errors_to_stable_codes() {
        let cases = [
            ("请选择入库图片", "INVENTORY_IMAGE_REQUIRED"),
            ("入库图片不存在", "INVENTORY_IMAGE_NOT_FOUND"),
            (
                "请选择 PNG、JPG、WEBP 或 HEIC 图片",
                "INVENTORY_IMAGE_FORMAT_INVALID",
            ),
            ("读取入库图片失败：权限不足", "INVENTORY_IMAGE_READ_FAILED"),
        ];

        for (message, code) in cases {
            assert_eq!(
                map_inventory_image_preview_error(message.to_string()),
                CommandError::new(code, message)
            );
        }

        assert_eq!(
            map_inventory_image_preview_error("unexpected preview error".to_string()),
            CommandError::new("INTERNAL_ERROR", "unexpected preview error")
        );
    }

    #[test]
    fn parses_shipping_note_rows() {
        let lines = vec![
            RecognizedTextLine {
                blocks: Vec::new(),
                text: "HZLYJM01 框角码 坯料 6 4支 35 26.5 927".to_string(),
            },
            RecognizedTextLine {
                blocks: Vec::new(),
                text: "合计 386支 900 26.6 23940".to_string(),
            },
        ];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].mold_code, "HZLYJM01");
        assert_eq!(items[0].color, "坯料");
        assert_eq!(items[0].length_mm, 6000);
        assert_eq!(items[0].quantity, Some(4));
    }

    #[test]
    fn parses_quantity_unit_for_any_color() {
        let lines = vec![
            RecognizedTextLine {
                blocks: Vec::new(),
                text: "CL5501A 边框 灰 6 4支 35 26.5 927".to_string(),
            },
            RecognizedTextLine {
                blocks: Vec::new(),
                text: "HZLYJM01 框角码 坯料 6 4支 35 26.5 927".to_string(),
            },
            RecognizedTextLine {
                blocks: Vec::new(),
                text: "HZLYJM02 框角码 坯料 6 4 支 35 26.5 927".to_string(),
            },
            RecognizedTextLine {
                blocks: Vec::new(),
                text: "HZLYJM01 框角码 坯料 6 35 26.5 927".to_string(),
            },
        ];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 4);
        assert_eq!(items[0].quantity, Some(4));
        assert_eq!(items[1].quantity, Some(4));
        assert_eq!(items[2].quantity, Some(4));
        assert_eq!(items[3].quantity, None);
    }

    #[test]
    fn extracts_raw_text_with_only_required_columns() {
        assert_eq!(
            extract_inventory_image_raw_text_line("CL5501A 边框 灰 6 1.4 75"),
            Some("CL5501A 灰 6 75".to_string())
        );
        assert_eq!(
            extract_inventory_image_raw_text_line("HZLYJM01 框角码 坯料 6 4支 35 26.5 927"),
            Some("HZLYJM01 坯料 6 4支".to_string())
        );
        assert_eq!(
            extract_inventory_image_raw_text_line("HZLYJMO1 框角码 坯料 6 35 26.5 927"),
            None
        );
    }

    #[test]
    fn extracts_raw_text_by_columns_without_leaking_later_columns() {
        let lines = vec![
            shipping_note_header(),
            RecognizedTextLine {
                text: "HZLYJM01 框角码 坯料 6 35 26.5 927".to_string(),
                blocks: vec![
                    block("HZLYJM01", 0.07, 0.50, 0.08),
                    block("框角码", 0.20, 0.50, 0.06),
                    block("坯料", 0.36, 0.50, 0.05),
                    block("6", 0.47, 0.50, 0.02),
                    block("35", 0.72, 0.50, 0.03),
                    block("26.5", 0.82, 0.50, 0.05),
                    block("927", 0.92, 0.50, 0.04),
                ],
            },
        ];

        assert_eq!(
            build_inventory_image_raw_text(&lines),
            "HZLYJM01 坯料 6 未识别"
        );
    }

    #[test]
    fn extracts_raw_text_and_quantity_from_explicit_quantity_token_even_if_column_is_shifted() {
        let lines = vec![
            shipping_note_header(),
            RecognizedTextLine {
                text: "HZLYJM01 框角码 坯料 6 4支 35 26.5 927".to_string(),
                blocks: vec![
                    block("HZLYJM01", 0.07, 0.50, 0.08),
                    block("框角码", 0.20, 0.50, 0.06),
                    block("坯料", 0.36, 0.50, 0.05),
                    block("6", 0.47, 0.50, 0.02),
                    block("4支", 0.61, 0.50, 0.05),
                    block("35", 0.72, 0.50, 0.03),
                ],
            },
        ];

        assert_eq!(
            build_inventory_image_raw_text(&lines),
            "HZLYJM01 坯料 6 4支"
        );

        let items = parse_inventory_image_items(&lines);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].quantity, Some(4));
    }

    #[test]
    fn parses_explicit_quantity_when_quantity_token_is_split_from_the_row() {
        let lines = vec![
            shipping_note_header(),
            RecognizedTextLine {
                text: "HZLYJM01 框角码 坯料 6 4 支 35 26.5 927".to_string(),
                blocks: vec![
                    block("HZLYJM01", 0.07, 0.50, 0.08),
                    block("框角码", 0.20, 0.50, 0.06),
                    block("坯料", 0.36, 0.50, 0.05),
                    block("6", 0.47, 0.50, 0.02),
                    block("4", 0.63, 0.50, 0.02),
                    block("支", 0.66, 0.505, 0.02),
                    block("35", 0.72, 0.50, 0.03),
                ],
            },
        ];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].quantity, Some(4));
        assert_eq!(
            build_inventory_image_raw_text(&lines),
            "HZLYJM01 坯料 6 4支"
        );
    }

    #[test]
    fn parses_billet_quantity_from_quantity_column_without_unit() {
        let lines = vec![
            shipping_note_header(),
            RecognizedTextLine {
                text: "HZLYJM01 框角码 坯料 6 4 35 26.5 927".to_string(),
                blocks: vec![
                    block("HZLYJM01", 0.07, 0.50, 0.08),
                    block("框角码", 0.20, 0.50, 0.06),
                    block("坯料", 0.36, 0.50, 0.05),
                    block("6", 0.47, 0.50, 0.02),
                    block("4", 0.64, 0.50, 0.02),
                    block("35", 0.72, 0.50, 0.03),
                ],
            },
        ];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].quantity, Some(4));
    }

    #[test]
    fn parses_quantity_with_unit_from_quantity_column() {
        let lines = vec![
            shipping_note_header(),
            RecognizedTextLine {
                text: "CL5501A 边框 灰 6 4支 35 26.5 927".to_string(),
                blocks: vec![
                    block("CL5501A", 0.07, 0.50, 0.08),
                    block("边框", 0.20, 0.50, 0.05),
                    block("灰", 0.37, 0.50, 0.03),
                    block("6", 0.47, 0.50, 0.02),
                    block("4支", 0.63, 0.50, 0.04),
                    block("35", 0.72, 0.50, 0.03),
                ],
            },
            RecognizedTextLine {
                text: "HZLYJM01 框角码 坯料 6 4 支 35 26.5 927".to_string(),
                blocks: vec![
                    block("HZLYJM01", 0.07, 0.45, 0.08),
                    block("框角码", 0.20, 0.45, 0.06),
                    block("坯料", 0.36, 0.45, 0.05),
                    block("6", 0.47, 0.45, 0.02),
                    block("4", 0.63, 0.45, 0.02),
                    block("支", 0.66, 0.45, 0.02),
                    block("35", 0.72, 0.45, 0.03),
                ],
            },
        ];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 2);
        assert_eq!(items[0].quantity, Some(4));
        assert_eq!(items[1].quantity, Some(4));
    }

    #[test]
    fn does_not_treat_weight_column_as_quantity() {
        let lines = vec![
            shipping_note_header(),
            RecognizedTextLine {
                text: "HZLYJMO1 框角码 坯料 6 35 26.5 927".to_string(),
                blocks: vec![
                    block("HZLYJMO1", 0.07, 0.50, 0.08),
                    block("框角码", 0.20, 0.50, 0.06),
                    block("坯料", 0.36, 0.50, 0.05),
                    block("6", 0.47, 0.50, 0.02),
                    block("35", 0.72, 0.50, 0.03),
                    block("26.5", 0.82, 0.50, 0.05),
                    block("927", 0.92, 0.50, 0.04),
                ],
            },
        ];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].mold_code, "HZLYJMO1");
        assert_eq!(items[0].quantity, None);
    }

    #[test]
    fn parses_normal_shipping_note_quantity_by_header_columns() {
        let lines = vec![
            shipping_note_header(),
            RecognizedTextLine {
                text: "CL5501A 边框 灰 6 1.4 75".to_string(),
                blocks: vec![
                    block("CL5501A", 0.07, 0.50, 0.08),
                    block("边框", 0.20, 0.50, 0.05),
                    block("灰", 0.37, 0.50, 0.03),
                    block("6", 0.47, 0.50, 0.02),
                    block("1.4", 0.55, 0.50, 0.04),
                    block("75", 0.64, 0.50, 0.03),
                ],
            },
        ];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].quantity, Some(75));
    }

    #[test]
    fn does_not_parse_numeric_weight_when_quantity_column_is_blank() {
        let lines = vec![
            shipping_note_header(),
            RecognizedTextLine {
                text: "HZLYJM01 框角码 坯料 6 35 26.5 927".to_string(),
                blocks: vec![
                    block("HZLYJM01", 0.07, 0.50, 0.08),
                    block("框角码", 0.20, 0.50, 0.06),
                    block("坯料", 0.36, 0.50, 0.05),
                    block("6", 0.47, 0.50, 0.02),
                    block("35", 0.72, 0.50, 0.03),
                ],
            },
        ];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].quantity, None);
    }

    #[test]
    fn parses_explicit_quantity_when_wall_thickness_column_is_blank() {
        let lines = vec![
            shipping_note_header(),
            RecognizedTextLine {
                text: "HZLYJM01 框角码 坯料 6 4支 35 26.5 927".to_string(),
                blocks: vec![
                    block("HZLYJM01", 0.07, 0.50, 0.08),
                    block("框角码", 0.20, 0.50, 0.06),
                    block("坯料", 0.36, 0.50, 0.05),
                    block("6", 0.47, 0.50, 0.02),
                    block("4支", 0.62, 0.50, 0.05),
                    block("35", 0.72, 0.50, 0.03),
                ],
            },
        ];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].quantity, Some(4));
    }

    #[test]
    fn does_not_guess_quantity_when_wall_thickness_column_is_blank() {
        let lines = vec![
            shipping_note_header(),
            RecognizedTextLine {
                text: "HZLYJMO1 框角码 坯料 6 35 26.5 927".to_string(),
                blocks: vec![
                    block("HZLYJMO1", 0.07, 0.50, 0.08),
                    block("框角码", 0.20, 0.50, 0.06),
                    block("坯料", 0.36, 0.50, 0.05),
                    block("6", 0.47, 0.50, 0.02),
                    block("35", 0.72, 0.50, 0.03),
                ],
            },
        ];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].quantity, None);
    }

    #[test]
    fn parses_text_fallback_quantity_after_wall_thickness_for_billet() {
        let lines = vec![RecognizedTextLine {
            blocks: Vec::new(),
            text: "HZLYJM01 框角码 坯料 6 1.4 4 35 26.5 927".to_string(),
        }];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].quantity, Some(4));
    }

    #[test]
    fn does_not_treat_text_fallback_weight_as_quantity_without_wall_thickness() {
        let lines = vec![RecognizedTextLine {
            blocks: Vec::new(),
            text: "HZLYJM01 框角码 坯料 6 35 26.5 927".to_string(),
        }];

        let items = parse_inventory_image_items(&lines);

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].quantity, None);
    }

    #[test]
    fn fills_only_missing_quantity_from_nearest_quantity_column_row() {
        let mut rows = vec![
            ParsedInventoryImageRow {
                y: 0.50,
                item: RecognizedInventoryImageItem {
                    mold_code: "CL5501A".to_string(),
                    product_name: "边框".to_string(),
                    color: "灰".to_string(),
                    length_mm: 6000,
                    quantity: Some(75),
                    raw_text: "CL5501A 边框 灰 6 1.4 75".to_string(),
                },
            },
            ParsedInventoryImageRow {
                y: 0.45,
                item: RecognizedInventoryImageItem {
                    mold_code: "HZLYJM01".to_string(),
                    product_name: "框角码".to_string(),
                    color: "坯料".to_string(),
                    length_mm: 6000,
                    quantity: None,
                    raw_text: "HZLYJM01 框角码 坯料 6 35 26.5 927".to_string(),
                },
            },
        ];
        let quantity_rows = vec![
            QuantityColumnRow {
                y: 0.50,
                quantity: Some(999),
            },
            QuantityColumnRow {
                y: 0.452,
                quantity: Some(4),
            },
        ];

        fill_missing_quantities_from_quantity_rows(&mut rows, &quantity_rows);

        assert_eq!(rows[0].item.quantity, Some(75));
        assert_eq!(rows[1].item.quantity, Some(4));
    }

    #[test]
    fn merges_rows_from_multiple_crops_without_dropping_later_rows() {
        let mut merged_rows = Vec::new();
        merge_inventory_image_rows(
            &mut merged_rows,
            vec![ParsedInventoryImageRow {
                y: 0.50,
                item: RecognizedInventoryImageItem {
                    mold_code: "CL5501A".to_string(),
                    product_name: "边框".to_string(),
                    color: "灰".to_string(),
                    length_mm: 6000,
                    quantity: Some(75),
                    raw_text: "CL5501A 边框 灰 6 1.4 75".to_string(),
                },
            }],
        );
        merge_inventory_image_rows(
            &mut merged_rows,
            vec![
                ParsedInventoryImageRow {
                    y: 0.50,
                    item: RecognizedInventoryImageItem {
                        mold_code: "CL5501A".to_string(),
                        product_name: "边框".to_string(),
                        color: "灰".to_string(),
                        length_mm: 6000,
                        quantity: Some(75),
                        raw_text: "CL5501A 边框 灰 6 1.4 75".to_string(),
                    },
                },
                ParsedInventoryImageRow {
                    y: 0.35,
                    item: RecognizedInventoryImageItem {
                        mold_code: "HZLYJM01".to_string(),
                        product_name: "角码".to_string(),
                        color: "坯料".to_string(),
                        length_mm: 6000,
                        quantity: Some(4),
                        raw_text: "HZLYJM01 角码 坯料 6 4".to_string(),
                    },
                },
            ],
        );

        assert_eq!(merged_rows.len(), 2);
        assert_eq!(merged_rows[0].item.mold_code, "CL5501A");
        assert_eq!(merged_rows[1].item.mold_code, "HZLYJM01");
        assert_eq!(merged_rows[1].item.quantity, Some(4));
    }

    #[test]
    fn merges_rows_even_when_product_names_differ() {
        let mut merged_rows = Vec::new();
        merge_inventory_image_rows(
            &mut merged_rows,
            vec![ParsedInventoryImageRow {
                y: 0.50,
                item: RecognizedInventoryImageItem {
                    mold_code: "HZLYJM01".to_string(),
                    product_name: "框角码".to_string(),
                    color: "坯料".to_string(),
                    length_mm: 6000,
                    quantity: Some(4),
                    raw_text: "HZLYJM01 框角码 坯料 6 4".to_string(),
                },
            }],
        );
        merge_inventory_image_rows(
            &mut merged_rows,
            vec![ParsedInventoryImageRow {
                y: 0.52,
                item: RecognizedInventoryImageItem {
                    mold_code: "HZLYJMO1".to_string(),
                    product_name: "角码".to_string(),
                    color: "坯料".to_string(),
                    length_mm: 6000,
                    quantity: None,
                    raw_text: "HZLYJMO1 角码 坯料 6".to_string(),
                },
            }],
        );

        assert_eq!(merged_rows.len(), 1);
        assert_eq!(merged_rows[0].item.mold_code, "HZLYJM01");
        assert_eq!(merged_rows[0].item.quantity, Some(4));
    }
}
