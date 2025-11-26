// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Initialize the logging system immediately
    env_logger::init();
    
    // Delegate execution to the library entry point
    // The crate name matches the [package] name in Cargo.toml ("makercode")
    makercode::run();
}