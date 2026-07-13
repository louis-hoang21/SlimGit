use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

// ---------- Data types shared with the frontend ----------

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileEntry {
    pub path: String,
    /// Original path for renames/copies.
    pub orig_path: Option<String>,
    /// Single-letter staged (index) status: M A D R C . U ? etc.
    pub index_status: String,
    /// Single-letter worktree status.
    pub worktree_status: String,
    pub staged: bool,
    pub unstaged: bool,
    pub conflicted: bool,
    pub untracked: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct StatusResult {
    pub branch: String,
    pub upstream: Option<String>,
    pub ahead: i64,
    pub behind: i64,
    pub oid: String,
    pub files: Vec<FileEntry>,
    pub merging: bool,
    pub rebasing: bool,
    pub cherry_picking: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommitInfo {
    pub hash: String,
    pub short: String,
    pub parents: Vec<String>,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub subject: String,
    pub refs: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: i64,
    pub behind: i64,
    /// True when the upstream branch has been deleted on the remote ([gone]).
    pub gone: bool,
    pub tip: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StashInfo {
    pub index: usize,
    pub message: String,
    pub branch: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiffFile {
    pub path: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BranchCompareDiff {
    pub base_branch: String,
    pub diff: String,
}

// ---------- Low level git runner ----------

/// Run a git command in `repo`, returning stdout on success.
/// On failure returns stderr (falling back to stdout) as the Err string.
fn run(repo: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .map_err(|e| format!("failed to spawn git: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if output.status.success() {
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(if stderr.trim().is_empty() { stdout } else { stderr })
    }
}

/// Like `run` but returns combined stdout+stderr regardless of exit code,
/// used for network ops where git reports progress on stderr.
fn run_combined(repo: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .map_err(|e| format!("failed to spawn git: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{stdout}{stderr}");
    if output.status.success() {
        Ok(combined)
    } else {
        Err(combined)
    }
}

// ---------- Repo checks ----------

pub fn is_git_repo(path: &str) -> bool {
    Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

pub fn repo_toplevel(path: &str) -> Result<String, String> {
    let out = run(path, &["rev-parse", "--show-toplevel"])?;
    Ok(out.trim().to_string())
}

// ---------- Status ----------

pub fn status(repo: &str) -> Result<StatusResult, String> {
    let raw = run(repo, &["status", "--porcelain=v2", "--branch", "-z"])?;
    let mut res = StatusResult::default();

    // Detect in-progress operations via the .git directory.
    let git_dir = run(repo, &["rev-parse", "--git-dir"])
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| ".git".to_string());
    let base = Path::new(repo).join(&git_dir);
    res.merging = base.join("MERGE_HEAD").exists();
    res.cherry_picking = base.join("CHERRY_PICK_HEAD").exists();
    res.rebasing = base.join("rebase-merge").exists() || base.join("rebase-apply").exists();

    // Records are separated by NUL. Renames (type 2) embed an extra NUL for the
    // original path, so we walk tokens explicitly rather than split-and-map.
    let tokens: Vec<&str> = raw.split('\0').collect();
    let mut i = 0;
    while i < tokens.len() {
        let line = tokens[i];
        if line.is_empty() {
            i += 1;
            continue;
        }
        if let Some(rest) = line.strip_prefix("# branch.head ") {
            res.branch = rest.to_string();
        } else if let Some(rest) = line.strip_prefix("# branch.upstream ") {
            res.upstream = Some(rest.to_string());
        } else if let Some(rest) = line.strip_prefix("# branch.oid ") {
            res.oid = rest.to_string();
        } else if let Some(rest) = line.strip_prefix("# branch.ab ") {
            // format: +A -B
            let mut parts = rest.split_whitespace();
            if let Some(a) = parts.next() {
                res.ahead = a.trim_start_matches('+').parse().unwrap_or(0);
            }
            if let Some(b) = parts.next() {
                res.behind = b.trim_start_matches('-').parse().unwrap_or(0);
            }
        } else if let Some(rest) = line.strip_prefix("1 ") {
            // Ordinary: <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
            let fields: Vec<&str> = rest.splitn(8, ' ').collect();
            if fields.len() == 8 {
                let xy = fields[0];
                res.files.push(make_entry(xy, fields[7], None));
            }
        } else if let Some(rest) = line.strip_prefix("2 ") {
            // Rename/copy: <XY> ... <path>, original path is the NEXT token.
            let fields: Vec<&str> = rest.splitn(9, ' ').collect();
            if fields.len() == 9 {
                let xy = fields[0];
                let path = fields[8];
                let orig = tokens.get(i + 1).copied().unwrap_or("");
                res.files
                    .push(make_entry(xy, path, Some(orig.to_string())));
                i += 1; // consumed original-path token
            }
        } else if let Some(rest) = line.strip_prefix("u ") {
            // Unmerged (conflict): <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
            let fields: Vec<&str> = rest.splitn(10, ' ').collect();
            if fields.len() == 10 {
                let path = fields[9];
                res.files.push(FileEntry {
                    path: path.to_string(),
                    orig_path: None,
                    index_status: "U".into(),
                    worktree_status: "U".into(),
                    staged: false,
                    unstaged: true,
                    conflicted: true,
                    untracked: false,
                });
            }
        } else if let Some(rest) = line.strip_prefix("? ") {
            res.files.push(FileEntry {
                path: rest.to_string(),
                orig_path: None,
                index_status: "?".into(),
                worktree_status: "?".into(),
                staged: false,
                unstaged: true,
                conflicted: false,
                untracked: true,
            });
        }
        i += 1;
    }

    Ok(res)
}

fn make_entry(xy: &str, path: &str, orig: Option<String>) -> FileEntry {
    let mut chars = xy.chars();
    let x = chars.next().unwrap_or('.').to_string();
    let y = chars.next().unwrap_or('.').to_string();
    FileEntry {
        path: path.to_string(),
        orig_path: orig,
        staged: x != ".",
        unstaged: y != ".",
        index_status: x,
        worktree_status: y,
        conflicted: false,
        untracked: false,
    }
}

// ---------- Diff ----------

pub fn diff(repo: &str, path: &str, staged: bool, untracked: bool) -> Result<String, String> {
    if untracked {
        // Untracked files have no index entry; diff against /dev/null.
        let output = Command::new("git")
            .arg("-C")
            .arg(repo)
            .args(["diff", "--no-index", "--", "/dev/null", path])
            .output()
            .map_err(|e| format!("failed to spawn git: {e}"))?;
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }
    let mut args = vec!["diff"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(path);
    run(repo, &args)
}

// ---------- Staging ----------

pub fn stage(repo: &str, paths: Vec<String>) -> Result<(), String> {
    let mut args: Vec<&str> = vec!["add", "--"];
    for p in &paths {
        args.push(p);
    }
    run(repo, &args).map(|_| ())
}

pub fn stage_all(repo: &str) -> Result<(), String> {
    run(repo, &["add", "-A"]).map(|_| ())
}

pub fn unstage(repo: &str, paths: Vec<String>) -> Result<(), String> {
    let mut args: Vec<&str> = vec!["reset", "-q", "HEAD", "--"];
    for p in &paths {
        args.push(p);
    }
    run(repo, &args).map(|_| ())
}

pub fn unstage_all(repo: &str) -> Result<(), String> {
    run(repo, &["reset", "-q", "HEAD"]).map(|_| ())
}

pub fn discard(repo: &str, paths: Vec<String>, untracked: bool) -> Result<(), String> {
    if untracked {
        let mut args: Vec<&str> = vec!["clean", "-fd", "--"];
        for p in &paths {
            args.push(p);
        }
        run(repo, &args).map(|_| ())
    } else {
        let mut args: Vec<&str> = vec!["checkout", "--"];
        for p in &paths {
            args.push(p);
        }
        run(repo, &args).map(|_| ())
    }
}

/// Remove files from the working tree AND the index (`git rm`). With
/// `cached=true` it only unstages+stops tracking, leaving the file on disk.
pub fn remove_file(repo: &str, paths: Vec<String>, cached: bool) -> Result<String, String> {
    let mut args: Vec<&str> = vec!["rm", "-r"];
    if cached {
        args.push("--cached");
    } else {
        args.push("-f");
    }
    args.push("--");
    for p in &paths {
        args.push(p);
    }
    run(repo, &args)
}

/// Delete files straight from disk (no git bookkeeping).
pub fn delete_file(repo: &str, paths: Vec<String>) -> Result<(), String> {
    for p in &paths {
        let full = Path::new(repo).join(p);
        if full.is_dir() {
            std::fs::remove_dir_all(&full).map_err(|e| format!("delete {p}: {e}"))?;
        } else {
            std::fs::remove_file(&full).map_err(|e| format!("delete {p}: {e}"))?;
        }
    }
    Ok(())
}

// ---------- Commit ----------

pub fn commit(repo: &str, message: &str, amend: bool) -> Result<String, String> {
    let mut args: Vec<&str> = vec!["commit", "-m", message];
    if amend {
        args.push("--amend");
    }
    run(repo, &args)
}

// ---------- Log / graph ----------

fn parse_log_output(raw: &str) -> Vec<CommitInfo> {
    let unit = '\u{1f}';
    let mut commits = Vec::new();
    for line in raw.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let f: Vec<&str> = line.split(unit).collect();
        if f.len() < 8 {
            continue;
        }
        let parents = if f[2].trim().is_empty() {
            Vec::new()
        } else {
            f[2].split_whitespace().map(|s| s.to_string()).collect()
        };
        let refs = if f[7].trim().is_empty() {
            Vec::new()
        } else {
            f[7].split(", ").map(|s| s.trim().to_string()).collect()
        };
        commits.push(CommitInfo {
            hash: f[0].to_string(),
            short: f[1].to_string(),
            parents,
            author: f[3].to_string(),
            email: f[4].to_string(),
            timestamp: f[5].parse().unwrap_or(0),
            subject: f[6].to_string(),
            refs,
        });
    }
    commits
}

/// Log commits for a specific branch (or HEAD if branch is empty).
pub fn log_branch(repo: &str, branch: &str, limit: u32) -> Result<Vec<CommitInfo>, String> {
    let unit = '\u{1f}';
    let fmt = format!("%H{u}%h{u}%P{u}%an{u}%ae{u}%at{u}%s{u}%D", u = unit);
    let limit_arg = format!("-n{}", limit);
    let pretty = format!("--pretty=format:{}", fmt);
    let rev = if branch.is_empty() { "HEAD" } else { branch };
    let raw = run(repo, &["log", "--date-order", &pretty, &limit_arg, rev])?;
    Ok(parse_log_output(&raw))
}

pub fn log_graph(repo: &str, limit: u32, all: bool) -> Result<Vec<CommitInfo>, String> {
    let unit = '\u{1f}';
    let fmt = format!("%H{u}%h{u}%P{u}%an{u}%ae{u}%at{u}%s{u}%D", u = unit);
    let limit_arg = format!("-n{}", limit);
    let pretty = format!("--pretty=format:{}", fmt);
    let mut args: Vec<&str> = vec!["log", "--topo-order", &pretty, &limit_arg];
    if all {
        // Show every ref EXCEPT the internal stash commits.
        args.push("--branches");
        args.push("--tags");
        args.push("--remotes");
    } else {
        args.push("HEAD");
    }
    let raw = run(repo, &args)?;
    Ok(parse_log_output(&raw))
}

pub fn commit_files(repo: &str, hash: &str) -> Result<Vec<DiffFile>, String> {
    let raw = run(
        repo,
        &["show", "--name-status", "--pretty=format:", "-z", hash],
    )?;
    Ok(parse_name_status(&raw))
}

pub fn commit_file_diff(repo: &str, hash: &str, path: &str) -> Result<String, String> {
    run(repo, &["show", hash, "--", path])
}

pub fn branch_compare_file_diff(repo: &str, path: &str) -> Result<BranchCompareDiff, String> {
    let base = infer_base_branch(repo)?;
    let spec = format!("{base}...HEAD");
    let diff = run(repo, &["diff", &spec, "--", path])?;
    Ok(BranchCompareDiff {
        base_branch: base,
        diff,
    })
}

fn infer_base_branch(repo: &str) -> Result<String, String> {
    let current = run(repo, &["rev-parse", "--abbrev-ref", "HEAD"])?
        .trim()
        .to_string();

    if let Some(from_reflog) = reflog_base_branch(repo, &current) {
        return Ok(from_reflog);
    }

    let candidates = branches(repo)?
        .into_iter()
        .filter(|b| !b.is_current)
        .filter(|b| b.name != current)
        .filter(|b| !b.name.ends_with(&format!("/{current}")))
        .collect::<Vec<_>>();

    let mut best: Option<(String, i64, i32)> = None;
    for b in candidates {
        let merge_base = match run(repo, &["merge-base", &b.name, "HEAD"]) {
            Ok(s) => s.trim().to_string(),
            Err(_) => continue,
        };
        if merge_base.is_empty() {
            continue;
        }
        let ts = run(repo, &["show", "-s", "--format=%ct", &merge_base])
            .ok()
            .and_then(|s| s.trim().parse::<i64>().ok())
            .unwrap_or(0);
        let priority = base_branch_priority(&b.name);
        match &best {
            Some((_, best_ts, best_priority))
                if ts < *best_ts || (ts == *best_ts && priority <= *best_priority) => {}
            _ => best = Some((b.name, ts, priority)),
        }
    }

    best.map(|(name, _, _)| name)
        .ok_or_else(|| "Could not infer a base branch for comparison".to_string())
}

fn reflog_base_branch(repo: &str, current: &str) -> Option<String> {
    let branch_ref = format!("refs/heads/{current}");
    if let Ok(raw) = run(repo, &["reflog", "show", "--format=%gs", &branch_ref]) {
        for line in raw.lines().rev() {
            if let Some(from) = line.strip_prefix("branch: Created from ") {
                let branch = from.trim();
                if branch != "HEAD" && !branch.is_empty() {
                    return Some(branch.to_string());
                }
            }
        }
    }

    if let Ok(raw) = run(repo, &["reflog", "show", "--format=%gs", "HEAD"]) {
        let suffix = format!(" to {current}");
        for line in raw.lines() {
            if let Some(from) = line
                .strip_prefix("checkout: moving from ")
                .and_then(|s| s.strip_suffix(&suffix))
            {
                if from != current && !from.is_empty() {
                    return Some(from.to_string());
                }
            }
        }
    }

    None
}

fn base_branch_priority(name: &str) -> i32 {
    match name {
        "master" | "main" => 40,
        "develop" | "dev" => 30,
        n if n.ends_with("/master") || n.ends_with("/main") => 20,
        n if n.ends_with("/develop") || n.ends_with("/dev") => 10,
        _ => 0,
    }
}

fn parse_name_status(raw: &str) -> Vec<DiffFile> {
    let tokens: Vec<&str> = raw.split('\0').filter(|t| !t.is_empty()).collect();
    let mut files = Vec::new();
    let mut i = 0;
    while i < tokens.len() {
        let status = tokens[i];
        let code = status.chars().next().unwrap_or(' ');
        if code == 'R' || code == 'C' {
            // status, oldpath, newpath
            if i + 2 < tokens.len() {
                files.push(DiffFile {
                    path: tokens[i + 2].to_string(),
                    status: status.to_string(),
                });
                i += 3;
                continue;
            }
        }
        if i + 1 < tokens.len() {
            files.push(DiffFile {
                path: tokens[i + 1].to_string(),
                status: status.to_string(),
            });
            i += 2;
        } else {
            i += 1;
        }
    }
    files
}

// ---------- Branches ----------

pub fn branches(repo: &str) -> Result<Vec<BranchInfo>, String> {
    let unit = '\u{1f}';
    let fmt = format!(
        "%(HEAD){u}%(refname){u}%(objectname:short){u}%(upstream:short){u}%(upstream:track)",
        u = unit
    );
    let fmt_arg = format!("--format={}", fmt);
    let raw = run(repo, &["branch", "-a", &fmt_arg])?;
    let mut out = Vec::new();
    for line in raw.lines() {
        let f: Vec<&str> = line.split(unit).collect();
        if f.len() < 5 {
            continue;
        }
        let is_current = f[0] == "*";
        let refname = f[1];
        let is_remote = refname.starts_with("refs/remotes/");
        // Skip the symbolic remote HEAD pointer.
        if refname.ends_with("/HEAD") {
            continue;
        }
        let name = refname
            .trim_start_matches("refs/heads/")
            .trim_start_matches("refs/remotes/")
            .to_string();
        let upstream = if f[3].is_empty() {
            None
        } else {
            Some(f[3].to_string())
        };
        let (ahead, behind) = parse_track(f[4]);
        let gone = f[4].contains("gone");
        out.push(BranchInfo {
            name,
            is_current,
            is_remote,
            upstream,
            ahead,
            behind,
            gone,
            tip: f[2].to_string(),
        });
    }
    Ok(out)
}

fn parse_track(track: &str) -> (i64, i64) {
    let mut ahead = 0;
    let mut behind = 0;
    // e.g. "[ahead 2, behind 1]" or "[ahead 3]"
    for part in track.trim_matches(|c| c == '[' || c == ']').split(", ") {
        if let Some(n) = part.strip_prefix("ahead ") {
            ahead = n.parse().unwrap_or(0);
        } else if let Some(n) = part.strip_prefix("behind ") {
            behind = n.parse().unwrap_or(0);
        }
    }
    (ahead, behind)
}

pub fn checkout(repo: &str, branch: &str, force: bool) -> Result<String, String> {
    if force {
        run_combined(repo, &["checkout", "-f", branch])
    } else {
        run_combined(repo, &["checkout", branch])
    }
}

pub fn checkout_remote(repo: &str, remote_branch: &str, local: &str) -> Result<String, String> {
    run_combined(repo, &["checkout", "-b", local, "--track", remote_branch])
}

pub fn create_branch(repo: &str, name: &str, checkout: bool) -> Result<String, String> {
    if checkout {
        run_combined(repo, &["checkout", "-b", name])
    } else {
        run_combined(repo, &["branch", name])
    }
}

pub fn delete_branch(repo: &str, name: &str, force: bool) -> Result<String, String> {
    let flag = if force { "-D" } else { "-d" };
    run_combined(repo, &["branch", flag, name])
}

pub fn remotes(repo: &str) -> Result<Vec<String>, String> {
    let raw = run(repo, &["remote"])?;
    Ok(raw.lines().map(|s| s.to_string()).collect())
}

pub fn tags(repo: &str) -> Result<Vec<String>, String> {
    let raw = run(repo, &["tag", "--sort=-creatordate"])?;
    Ok(raw
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|s| s.to_string())
        .collect())
}

// ---------- Network ----------

pub fn fetch(repo: &str) -> Result<String, String> {
    run_combined(repo, &["fetch", "--all", "--prune"])
}

pub fn pull(repo: &str) -> Result<String, String> {
    run_combined(repo, &["pull"])
}

pub fn push(
    repo: &str,
    remote: &str,
    branch: &str,
    force: bool,
    set_upstream: bool,
) -> Result<String, String> {
    let mut args: Vec<&str> = vec!["push"];
    if set_upstream {
        args.push("-u");
    }
    if force {
        args.push("--force-with-lease");
    }
    args.push(remote);
    args.push(branch);
    run_combined(repo, &args)
}

// ---------- Merge / rebase / cherry-pick ----------

pub fn merge(repo: &str, branch: &str, no_ff: bool) -> Result<String, String> {
    let mut args: Vec<&str> = vec!["merge"];
    if no_ff {
        args.push("--no-ff");
    }
    args.push(branch);
    run_combined(repo, &args)
}

pub fn merge_abort(repo: &str) -> Result<String, String> {
    run_combined(repo, &["merge", "--abort"])
}

pub fn cherry_pick(repo: &str, hash: &str) -> Result<String, String> {
    run_combined(repo, &["cherry-pick", hash])
}

pub fn revert(repo: &str, hash: &str) -> Result<String, String> {
    run_combined(repo, &["revert", "--no-edit", hash])
}

pub fn commit_message(repo: &str, hash: &str) -> Result<String, String> {
    let out = run(repo, &["log", "-1", "--format=%B", hash])?;
    Ok(out.trim_end().to_string())
}

pub fn cherry_pick_abort(repo: &str) -> Result<String, String> {
    run_combined(repo, &["cherry-pick", "--abort"])
}

pub fn cherry_pick_continue(repo: &str) -> Result<String, String> {
    run_combined(repo, &["-c", "core.editor=true", "cherry-pick", "--continue"])
}

pub fn rebase(repo: &str, onto: &str) -> Result<String, String> {
    run_combined(repo, &["rebase", onto])
}

pub fn rebase_abort(repo: &str) -> Result<String, String> {
    run_combined(repo, &["rebase", "--abort"])
}

pub fn rebase_continue(repo: &str) -> Result<String, String> {
    run_combined(repo, &["-c", "core.editor=true", "rebase", "--continue"])
}

// ---------- Stash ----------

pub fn stash_list(repo: &str) -> Result<Vec<StashInfo>, String> {
    let unit = '\u{1f}';
    let fmt = format!("--format=%gd{u}%gs", u = unit);
    let raw = run(repo, &["stash", "list", &fmt])?;
    let mut out = Vec::new();
    for (i, line) in raw.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let f: Vec<&str> = line.split(unit).collect();
        let gs = f.get(1).copied().unwrap_or("").to_string();
        // gs looks like "WIP on main: 1234567 subject" or "On main: msg"
        let branch = gs
            .split(':')
            .next()
            .unwrap_or("")
            .trim_start_matches("WIP on ")
            .trim_start_matches("On ")
            .to_string();
        out.push(StashInfo {
            index: i,
            message: gs,
            branch,
        });
    }
    Ok(out)
}

pub fn stash_save(repo: &str, message: &str, include_untracked: bool) -> Result<String, String> {
    let mut args: Vec<&str> = vec!["stash", "push"];
    if include_untracked {
        args.push("-u");
    }
    if !message.is_empty() {
        args.push("-m");
        args.push(message);
    }
    run_combined(repo, &args)
}

pub fn stash_save_paths(
    repo: &str,
    message: &str,
    paths: Vec<String>,
) -> Result<String, String> {
    let mut args: Vec<&str> = vec!["stash", "push"];
    if !message.is_empty() {
        args.push("-m");
        args.push(message);
    }
    args.push("--");
    for p in &paths {
        args.push(p);
    }
    run_combined(repo, &args)
}

fn stash_ref(index: usize) -> String {
    format!("stash@{{{}}}", index)
}

pub fn stash_pop(repo: &str, index: usize) -> Result<String, String> {
    run_combined(repo, &["stash", "pop", &stash_ref(index)])
}

pub fn stash_apply(repo: &str, index: usize) -> Result<String, String> {
    run_combined(repo, &["stash", "apply", &stash_ref(index)])
}

pub fn stash_drop(repo: &str, index: usize) -> Result<String, String> {
    run_combined(repo, &["stash", "drop", &stash_ref(index)])
}

pub fn stash_files(repo: &str, index: usize) -> Result<Vec<DiffFile>, String> {
    let r = stash_ref(index);
    let raw = run(repo, &["stash", "show", "--name-status", "-z", &r])?;
    Ok(parse_name_status(&raw))
}

pub fn stash_file_diff(repo: &str, index: usize, path: &str) -> Result<String, String> {
    let r = stash_ref(index);
    run(repo, &["diff", &format!("{}^", r), &r, "--", path])
}

// ---------- Conflict resolution ----------

pub fn conflict_content(repo: &str, path: &str) -> Result<String, String> {
    let full = Path::new(repo).join(path);
    std::fs::read_to_string(&full).map_err(|e| format!("read {path}: {e}"))
}

pub fn save_file(repo: &str, path: &str, content: &str) -> Result<(), String> {
    let full = Path::new(repo).join(path);
    std::fs::write(&full, content).map_err(|e| format!("write {path}: {e}"))
}

pub fn resolve_conflict(repo: &str, path: &str, side: &str) -> Result<String, String> {
    let flag = match side {
        "ours" => "--ours",
        "theirs" => "--theirs",
        _ => return Err("side must be 'ours' or 'theirs'".into()),
    };
    run(repo, &["checkout", flag, "--", path])?;
    run(repo, &["add", "--", path])?;
    Ok("resolved".into())
}

pub fn mark_resolved(repo: &str, paths: Vec<String>) -> Result<(), String> {
    let mut args: Vec<&str> = vec!["add", "--"];
    for p in &paths {
        args.push(p);
    }
    run(repo, &args).map(|_| ())
}
