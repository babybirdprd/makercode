use std::fs;
use std::path::Path;
use serde::Serialize;
use git2::{Repository, StatusOptions, BranchType, Signature, IndexAddOption};

#[derive(Serialize)]
struct FileNode {
    name: String,
    path: String,
    #[serde(rename = "isDirectory")]
    is_directory: bool,
    children: Option<Vec<FileNode>>,
}

#[derive(Serialize, Default)]
struct GitStatus {
    is_repo: bool,
    current_branch: String,
    is_dirty: bool,
    has_remote: bool,
    behind: usize,
    ahead: usize,
}

// ... [Existing File System Code remains unchanged] ...
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
                node.children = Some(Vec::new());
            } else {
                match build_tree(&path_buf, root_base) {
                    Ok(children) => {
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

// ... [End File System Code] ...

// --- GIT OPERATIONS ---

#[tauri::command]
fn get_git_status(path: String) -> Result<GitStatus, String> {
    let repo = match Repository::open(&path) {
        Ok(r) => r,
        Err(_) => return Ok(GitStatus::default()),
    };

    let mut status = GitStatus {
        is_repo: true,
        ..Default::default()
    };

    if let Ok(head) = repo.head() {
        if let Some(name) = head.shorthand() {
            status.current_branch = name.to_string();
        }
    }

    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    if let Ok(statuses) = repo.statuses(Some(&mut opts)) {
        status.is_dirty = !statuses.is_empty();
    }

    if let Ok(head) = repo.head() {
        if repo.branch_upstream_name(head.name().unwrap_or("")).is_ok() {
            status.has_remote = true;
            if let Ok(local_oid) = head.target().ok_or("No local OID") {
                if let Ok(upstream_branch) = repo.find_branch(&status.current_branch, BranchType::Local) {
                    if let Ok(upstream) = upstream_branch.upstream() {
                        if let Some(upstream_oid) = upstream.get().target() {
                            if let Ok((ahead, behind)) = repo.graph_ahead_behind(local_oid, upstream_oid) {
                                status.ahead = ahead;
                                status.behind = behind;
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(status)
}

#[tauri::command]
fn git_init(path: String) -> Result<String, String> {
    Repository::init(&path).map_err(|e| e.message().to_string())?;
    Ok("Initialized empty Git repository".to_string())
}

#[tauri::command]
fn git_add_all(path: String) -> Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.message().to_string())?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    
    // Add all files, respecting .gitignore
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| e.message().to_string())?;
        
    index.write().map_err(|e| e.message().to_string())?;
    Ok("Staged all changes".to_string())
}

#[tauri::command]
fn git_commit(path: String, message: String) -> Result<String, String> {
    let repo = Repository::open(&path).map_err(|e| e.message().to_string())?;
    
    // 1. Prepare the signature
    // In a real app, we'd read this from git config or user settings
    let signature = Signature::now("MakerCode Agent", "agent@makercode.dev")
        .map_err(|e| e.message().to_string())?;

    // 2. Get the tree to commit
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.message().to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.message().to_string())?;

    // 3. Find parent (if exists)
    let parent_commit = match repo.head() {
        Ok(head) => {
            let target = head.target().ok_or("HEAD is not pointing to a commit")?;
            Some(repo.find_commit(target).map_err(|e| e.message().to_string())?)
        },
        Err(_) => None, // Initial commit
    };

    let parents = if let Some(ref parent) = parent_commit {
        vec![parent]
    } else {
        vec![]
    };

    // 4. Commit
    repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        &message,
        &tree,
        &parents,
    ).map_err(|e| e.message().to_string())?;

    Ok("Commit successful".to_string())
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
            get_project_tree,
            get_git_status,
            git_init,
            git_add_all,
            git_commit
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools(); 
            }
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}