pub mod commands;
mod db;
mod processing_fees;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = db::init(app.handle()).map_err(std::io::Error::other)?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::customers::create_customer,
            commands::customers::delete_customer,
            commands::customers::export_customers,
            commands::customers::import_customers,
            commands::customers::list_customers,
            commands::customers::parse_customer_import_file,
            commands::customers::update_customer,
            commands::files::backup_database,
            commands::files::get_database_path,
            commands::files::print_current_window,
            commands::files::restore_database,
            commands::files::write_text_file,
            commands::inventory::public::adjust_inventory,
            commands::inventory::customer::adjust_customer_inventory_stock,
            commands::inventory::public::adjust_order_inventory_batch,
            commands::inventory::public::adjust_order_inventory,
            commands::inventory::customer::create_customer_inventory_batch,
            commands::inventory::customer::create_customer_inventory_delivery_note,
            commands::inventory::delivery::create_delivery_note,
            commands::inventory::customer::get_customer_inventory_batch,
            commands::inventory::customer::get_customer_inventory_delivery_note,
            commands::inventory::customer::get_customer_inventory_print_snapshot,
            commands::inventory::delivery::get_delivery_note,
            commands::inventory::customer::import_customer_inventory_batches,
            commands::inventory::customer::list_customer_inventory,
            commands::inventory::public::list_inventory,
            commands::inventory::customer::parse_customer_inventory_import_file,
            commands::inventory::public::transfer_public_inventory_to_order,
            commands::inventory::delivery::transfer_order_inventory_remainder,
            commands::inventory::customer::update_customer_inventory_delivery_note_special_note,
            commands::inventory::customer::update_customer_inventory_batch,
            commands::inventory::delivery::update_delivery_note_special_note,
            commands::ocr::read_inventory_image_preview,
            commands::ocr::recognize_inventory_image,
            commands::orders::get_order,
            commands::orders::create_order,
            commands::orders::delete_order,
            commands::orders::list_orders,
            commands::orders::parse_order_item_import_file,
            commands::orders::update_order,
            commands::products::assign_customer_products,
            commands::products::create_product,
            commands::products::delete_product,
            commands::products::export_products,
            commands::products::import_products,
            commands::products::list_product_ids,
            commands::products::list_products,
            commands::products::parse_product_import_file,
            commands::products::set_product_customers,
            commands::products::update_product
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
