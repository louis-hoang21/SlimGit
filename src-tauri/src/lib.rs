mod git;

use git::*;

// ----- Repo -----

#[tauri::command]
fn is_repo(path: String) -> bool {
    git::is_git_repo(&path)
}

#[tauri::command]
fn toplevel(path: String) -> Result<String, String> {
    git::repo_toplevel(&path)
}

#[tauri::command]
fn find_repos_in_dir(path: String) -> Vec<String> {
    git::find_repos_in_dir(&path)
}

#[tauri::command]
fn get_status(repo: String) -> Result<StatusResult, String> {
    git::status(&repo)
}

#[tauri::command]
fn get_diff(
    repo: String,
    path: String,
    staged: bool,
    untracked: bool,
) -> Result<String, String> {
    git::diff(&repo, &path, staged, untracked)
}

// ----- Staging -----

#[tauri::command]
fn stage(repo: String, paths: Vec<String>) -> Result<(), String> {
    git::stage(&repo, paths)
}

#[tauri::command]
fn stage_all(repo: String) -> Result<(), String> {
    git::stage_all(&repo)
}

#[tauri::command]
fn unstage(repo: String, paths: Vec<String>) -> Result<(), String> {
    git::unstage(&repo, paths)
}

#[tauri::command]
fn unstage_all(repo: String) -> Result<(), String> {
    git::unstage_all(&repo)
}

#[tauri::command]
fn discard(repo: String, paths: Vec<String>, untracked: bool) -> Result<(), String> {
    git::discard(&repo, paths, untracked)
}

#[tauri::command]
fn remove_file(repo: String, paths: Vec<String>, cached: bool) -> Result<String, String> {
    git::remove_file(&repo, paths, cached)
}

#[tauri::command]
fn delete_file(repo: String, paths: Vec<String>) -> Result<(), String> {
    git::delete_file(&repo, paths)
}

#[tauri::command]
fn commit(repo: String, message: String, amend: bool) -> Result<String, String> {
    git::commit(&repo, &message, amend)
}

// ----- Log -----

#[tauri::command]
fn log_graph(repo: String, limit: u32, all: bool) -> Result<Vec<CommitInfo>, String> {
    git::log_graph(&repo, limit, all)
}

#[tauri::command]
fn log_branch(repo: String, branch: String, limit: u32) -> Result<Vec<CommitInfo>, String> {
    git::log_branch(&repo, &branch, limit)
}

#[tauri::command]
fn commit_files(repo: String, hash: String) -> Result<Vec<DiffFile>, String> {
    git::commit_files(&repo, &hash)
}

#[tauri::command]
fn commit_file_diff(repo: String, hash: String, path: String) -> Result<String, String> {
    git::commit_file_diff(&repo, &hash, &path)
}

#[tauri::command]
fn branch_compare_file_diff(repo: String, path: String) -> Result<BranchCompareDiff, String> {
    git::branch_compare_file_diff(&repo, &path)
}

// ----- Branches -----

#[tauri::command]
fn branches(repo: String) -> Result<Vec<BranchInfo>, String> {
    git::branches(&repo)
}

#[tauri::command]
fn checkout(repo: String, branch: String, force: bool) -> Result<String, String> {
    git::checkout(&repo, &branch, force)
}

#[tauri::command]
fn checkout_remote(repo: String, remote_branch: String, local: String) -> Result<String, String> {
    git::checkout_remote(&repo, &remote_branch, &local)
}

#[tauri::command]
fn create_branch(repo: String, name: String, checkout: bool) -> Result<String, String> {
    git::create_branch(&repo, &name, checkout)
}

#[tauri::command]
fn delete_branch(repo: String, name: String, force: bool) -> Result<String, String> {
    git::delete_branch(&repo, &name, force)
}

#[tauri::command]
fn remotes(repo: String) -> Result<Vec<String>, String> {
    git::remotes(&repo)
}

#[tauri::command]
fn tags(repo: String) -> Result<Vec<String>, String> {
    git::tags(&repo)
}

// ----- Network -----

#[tauri::command]
fn fetch(repo: String) -> Result<String, String> {
    git::fetch(&repo)
}

#[tauri::command]
fn pull(repo: String) -> Result<String, String> {
    git::pull(&repo)
}

#[tauri::command]
fn push(
    repo: String,
    remote: String,
    branch: String,
    force: bool,
    set_upstream: bool,
) -> Result<String, String> {
    git::push(&repo, &remote, &branch, force, set_upstream)
}

// ----- Merge / rebase / cherry-pick -----

#[tauri::command]
fn merge(repo: String, branch: String, no_ff: bool) -> Result<String, String> {
    git::merge(&repo, &branch, no_ff)
}

#[tauri::command]
fn merge_abort(repo: String) -> Result<String, String> {
    git::merge_abort(&repo)
}

#[tauri::command]
fn cherry_pick(repo: String, hash: String) -> Result<String, String> {
    git::cherry_pick(&repo, &hash)
}

#[tauri::command]
fn revert(repo: String, hash: String) -> Result<String, String> {
    git::revert(&repo, &hash)
}

#[tauri::command]
fn commit_message(repo: String, hash: String) -> Result<String, String> {
    git::commit_message(&repo, &hash)
}

#[tauri::command]
fn cherry_pick_abort(repo: String) -> Result<String, String> {
    git::cherry_pick_abort(&repo)
}

#[tauri::command]
fn cherry_pick_continue(repo: String) -> Result<String, String> {
    git::cherry_pick_continue(&repo)
}

#[tauri::command]
fn rebase(repo: String, onto: String) -> Result<String, String> {
    git::rebase(&repo, &onto)
}

#[tauri::command]
fn rebase_abort(repo: String) -> Result<String, String> {
    git::rebase_abort(&repo)
}

#[tauri::command]
fn rebase_continue(repo: String) -> Result<String, String> {
    git::rebase_continue(&repo)
}

// ----- Stash -----

#[tauri::command]
fn stash_list(repo: String) -> Result<Vec<StashInfo>, String> {
    git::stash_list(&repo)
}

#[tauri::command]
fn stash_save(repo: String, message: String, include_untracked: bool) -> Result<String, String> {
    git::stash_save(&repo, &message, include_untracked)
}

#[tauri::command]
fn stash_save_paths(
    repo: String,
    message: String,
    paths: Vec<String>,
) -> Result<String, String> {
    git::stash_save_paths(&repo, &message, paths)
}

#[tauri::command]
fn stash_pop(repo: String, index: usize) -> Result<String, String> {
    git::stash_pop(&repo, index)
}

#[tauri::command]
fn stash_apply(repo: String, index: usize) -> Result<String, String> {
    git::stash_apply(&repo, index)
}

#[tauri::command]
fn stash_drop(repo: String, index: usize) -> Result<String, String> {
    git::stash_drop(&repo, index)
}

#[tauri::command]
fn stash_files(repo: String, index: usize) -> Result<Vec<DiffFile>, String> {
    git::stash_files(&repo, index)
}

#[tauri::command]
fn stash_file_diff(repo: String, index: usize, path: String) -> Result<String, String> {
    git::stash_file_diff(&repo, index, &path)
}

// ----- Conflicts -----

#[tauri::command]
fn conflict_content(repo: String, path: String) -> Result<String, String> {
    git::conflict_content(&repo, &path)
}

#[tauri::command]
fn save_file(repo: String, path: String, content: String) -> Result<(), String> {
    git::save_file(&repo, &path, &content)
}

#[tauri::command]
fn resolve_conflict(repo: String, path: String, side: String) -> Result<String, String> {
    git::resolve_conflict(&repo, &path, &side)
}

#[tauri::command]
fn mark_resolved(repo: String, paths: Vec<String>) -> Result<(), String> {
    git::mark_resolved(&repo, paths)
}

/// Build the native application menu bar (SmartGit-style top menus).
fn build_menu(app: &tauri::AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

    let app_menu = SubmenuBuilder::new(app, "SlimGit")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let open = MenuItemBuilder::with_id("open", "Open Repository…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let refresh = MenuItemBuilder::with_id("refresh", "Refresh")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let fetch = MenuItemBuilder::with_id("fetch", "Fetch").build(app)?;
    let pull = MenuItemBuilder::with_id("pull", "Pull").build(app)?;
    let push = MenuItemBuilder::with_id("push", "Push").build(app)?;
    let repo_menu = SubmenuBuilder::new(app, "Repository")
        .item(&open)
        .item(&refresh)
        .separator()
        .item(&fetch)
        .item(&pull)
        .item(&push)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let commit = MenuItemBuilder::with_id("commit", "Commit…")
        .accelerator("CmdOrCtrl+K")
        .build(app)?;
    let branch = MenuItemBuilder::with_id("branch", "New Branch…")
        .accelerator("CmdOrCtrl+B")
        .build(app)?;
    let branch_menu = SubmenuBuilder::new(app, "Branch")
        .item(&commit)
        .item(&branch)
        .build()?;

    let toggle_theme =
        MenuItemBuilder::with_id("toggle-theme", "Toggle Dark Mode").build(app)?;
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&toggle_theme)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .separator()
        .fullscreen()
        .build()?;

    MenuBuilder::new(app)
        .items(&[
            &app_menu,
            &repo_menu,
            &edit_menu,
            &branch_menu,
            &view_menu,
            &window_menu,
        ])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Emitter;

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            // Forward custom menu clicks to the frontend.
            let _ = app.emit("menu", event.id().0.clone());
        })
        .invoke_handler(tauri::generate_handler![
            is_repo,
            toplevel,
            find_repos_in_dir,
            get_status,
            get_diff,
            stage,
            stage_all,
            unstage,
            unstage_all,
            discard,
            remove_file,
            delete_file,
            commit,
            log_graph,
            log_branch,
            commit_files,
            commit_file_diff,
            branch_compare_file_diff,
            branches,
            checkout,
            checkout_remote,
            create_branch,
            delete_branch,
            remotes,
            tags,
            fetch,
            pull,
            push,
            merge,
            merge_abort,
            cherry_pick,
            revert,
            commit_message,
            cherry_pick_abort,
            cherry_pick_continue,
            rebase,
            rebase_abort,
            rebase_continue,
            stash_list,
            stash_save,
            stash_save_paths,
            stash_pop,
            stash_apply,
            stash_drop,
            stash_files,
            stash_file_diff,
            conflict_content,
            save_file,
            resolve_conflict,
            mark_resolved,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SlimGit");
}
