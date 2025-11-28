use std::fs;
use std::path::Path;
use serde::Serialize;

#[derive(Serialize)]
struct FileNode {
    name: String,
    path: String,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
    children: Option<Vec<FileNode>>,
}

// Helper to check if a directory should be ignored
fn is_ignored(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".git"
            | "target"
            | "dist"
            | "build"
            | ".maker"
            | "__pycache__"
            | "venv"
            | ".vscode"
    )
}

fn build_tree(path: &Path, root_base: &Path) -> Result<Vec<FileNode>, String> {
    let mut nodes = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        let path_buf = entry.path();
        
        // Calculate path relative to the project root for the frontend
        // We ensure it starts with / like the VFS expects
        let relative_path = path_buf.strip_prefix(root_base)
            .map(|p| format!("/{}", p.to_string_lossy().replace("\\", "/")))
            .unwrap_or_else(|_| format!("/{}", file_name));

        let is_dir = metadata.is_dir();

        let mut node = FileNode {
            name: file_name.clone(),
            path: relative_path,
            is_directory: is_dir,
            children: None,
        };

        if is_dir {
            if is_ignored(&file_name) {
                // Return empty children for ignored dirs (visual consistency)
                node.children = Some(Vec::new());
            } else {
                // Recursively build children
                match build_tree(&path_buf, root_base) {
                    Ok(children) => {
                        // Sort: Directories first, then files
                        let mut sorted_children = children;
                        sorted_children.sort_by(|a, b| {
                            match (a.is_directory, b.is_directory) {
                                (true, false) => std::cmp::Ordering::Less,
                                (false, true) => std::cmp::Ordering::Greater,
                                _ => a.name.cmp(&b.name),
                            }
                        });
                        node.children = Some(sorted_children);
                    }
                    Err(_) => node.children = Some(Vec::new()),
                }
            }
        }

        nodes.push(node);
    }

    // Sort the current level
    nodes.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(nodes)
}

#[tauri::command]
fn get_project_tree(path: String) -> Result<Vec<FileNode>, String> {
    let root_path = Path::new(&path);
    if !root_path.exists() {
        return Err("Path does not exist".to_string());
    }
    
    build_tree(root_path, root_path)
}

#[tauri::command]
fn check_system_health() -> Result<String, String> {
    use std::process::Command;
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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            check_system_health,
            get_project_tree
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                // FIX: Import Manager only in debug scope to prevent unused import warnings in release
                use tauri::Manager;
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools(); 
            }
            // Silence unused variable warning in release
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}