use std::process::Command;
use tauri::Manager; // Import Manager trait so it is available

// Example custom command to verify backend connectivity and prerequisites
#[tauri::command]
fn check_system_health() -> Result<String, String> {
    // Check if Git is installed on the host system
    let output = Command::new("git")
        .arg("--version")
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout);
        Ok(format!("System Healthy. {}", version.trim()))
    } else {
        Err("Git not found or not responding".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Initialize Plugins
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        
        // Register Custom Commands
        .invoke_handler(tauri::generate_handler![
            check_system_health
        ])
        
        // App Setup Hook
        .setup(|app| {
            // Perform initialization tasks here
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools(); 
            }
            
            // Silence unused variable warning in release mode
            let _ = app;
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}