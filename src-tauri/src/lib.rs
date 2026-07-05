use std::{
  fs,
  path::{Path, PathBuf},
  time::{SystemTime, UNIX_EPOCH},
};

use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::Manager;
#[cfg(desktop)]
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct QuestionRecord {
  id: String,
  q: String,
  options: Vec<String>,
  correct: i32,
  explanation: Option<String>,
  subject: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SetRecord {
  id: String,
  slug: String,
  set_name: String,
  file_name: String,
  source_format: String,
  #[serde(default)]
  source_path: String,
  raw_source: String,
  questions: Vec<QuestionRecord>,
  updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct SyncOperation {
  #[serde(rename = "type")]
  operation_type: String,
  queued_at: String,
  set_ids: Option<Vec<String>>,
  record: Option<SetRecord>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FlushSyncResult {
  operations: Vec<SyncOperation>,
  flushed_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativePickedFile {
  path: String,
  name: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  contents: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  binary_base64: Option<String>,
}

fn file_name_for_path(path: &Path) -> String {
  path
    .file_name()
    .and_then(|value| value.to_str())
    .map(String::from)
    .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn safe_segment(value: &str) -> String {
  value
    .chars()
    .map(|character| {
      if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
        character
      } else {
        '_'
      }
    })
    .collect::<String>()
}

fn ensure_directory(path: &Path) -> Result<(), String> {
  fs::create_dir_all(path).map_err(|error| error.to_string())
}

fn user_root_dir(app: &tauri::AppHandle, user_id: &str) -> Result<PathBuf, String> {
  let base_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
  let root_dir = base_dir.join("users").join(safe_segment(user_id));
  ensure_directory(&root_dir)?;
  Ok(root_dir)
}

fn sets_dir(app: &tauri::AppHandle, user_id: &str) -> Result<PathBuf, String> {
  let directory = user_root_dir(app, user_id)?.join("sets");
  ensure_directory(&directory)?;
  Ok(directory)
}

fn sync_queue_path(app: &tauri::AppHandle, user_id: &str) -> Result<PathBuf, String> {
  Ok(user_root_dir(app, user_id)?.join("sync-queue.json"))
}

fn set_path(app: &tauri::AppHandle, user_id: &str, set_id: &str) -> Result<PathBuf, String> {
  Ok(sets_dir(app, user_id)?.join(format!("{}.json", safe_segment(set_id))))
}

fn read_sync_queue(path: &Path) -> Result<Vec<SyncOperation>, String> {
  if !path.exists() {
    return Ok(Vec::new());
  }

  let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
  if raw.trim().is_empty() {
    return Ok(Vec::new());
  }

  serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn write_sync_queue(path: &Path, operations: &[SyncOperation]) -> Result<(), String> {
  let payload = serde_json::to_string_pretty(operations).map_err(|error| error.to_string())?;
  fs::write(path, payload).map_err(|error| error.to_string())
}

fn flush_sync_file(path: &Path) -> Result<FlushSyncResult, String> {
  let operations = read_sync_queue(path)?;
  write_sync_queue(path, &[])?;
  Ok(FlushSyncResult {
    flushed_count: operations.len(),
    operations,
  })
}

fn read_native_file(path: &Path) -> Result<NativePickedFile, String> {
  let extension = path
    .extension()
    .and_then(|value| value.to_str())
    .map(|value| value.to_ascii_lowercase())
    .unwrap_or_default();

  let (contents, binary_base64) = if extension == "apkg" {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    (None, Some(BASE64_STANDARD.encode(bytes)))
  } else {
    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    (Some(contents), None)
  };

  Ok(NativePickedFile {
    path: path.to_string_lossy().into_owned(),
    name: file_name_for_path(path),
    contents,
    binary_base64,
  })
}

fn write_atomic_text_file(path: &Path, contents: &str) -> Result<(), String> {
  if !path.is_absolute() {
    return Err("sourcePath mutlak bir yol olmalı.".to_string());
  }

  let path = path.canonicalize().map_err(|error| error.to_string())?;
  if path.is_dir() {
    return Err("sourcePath bir klasör olamaz.".to_string());
  }

  let parent = path
    .parent()
    .ok_or_else(|| "sourcePath üst dizini bulunamadı.".to_string())?;
  let unique_suffix = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map_err(|error| error.to_string())?
    .as_nanos();
  let temp_path = parent.join(format!(
    ".mcq-app-{}-{}.tmp",
    safe_segment(&file_name_for_path(&path)),
    unique_suffix
  ));

  fs::write(&temp_path, contents).map_err(|error| error.to_string())?;

  let rename_result = (|| {
    if path.exists() {
      fs::remove_file(&path).map_err(|error| error.to_string())?;
    }
    fs::rename(&temp_path, &path).map_err(|error| error.to_string())
  })();

  if let Err(error) = rename_result {
    let _ = fs::remove_file(&temp_path);
    return Err(error);
  }

  Ok(())
}

#[tauri::command]
async fn pick_native_set_files(app: tauri::AppHandle) -> Result<Vec<NativePickedFile>, String> {
  let picked_files = app.dialog().file().blocking_pick_files();
  let Some(files) = picked_files else {
    return Ok(Vec::new());
  };

  files
    .into_iter()
    .map(|file_path| {
      let path = file_path.into_path().map_err(|error| error.to_string())?;
      read_native_file(&path)
    })
    .collect()
}

#[tauri::command]
async fn write_set_source_file(source_path: String, raw_source: String) -> Result<(), String> {
  let path = PathBuf::from(source_path);
  write_atomic_text_file(&path, &raw_source)
}

#[tauri::command]
fn list_local_sets(app: tauri::AppHandle, user_id: String) -> Result<Vec<SetRecord>, String> {
  let directory = sets_dir(&app, &user_id)?;
  let entries = fs::read_dir(directory).map_err(|error| error.to_string())?;
  let mut records = Vec::new();

  for entry in entries {
    let entry = entry.map_err(|error| error.to_string())?;
    let path = entry.path();
    if path.extension().and_then(|value| value.to_str()) != Some("json") {
      continue;
    }

    let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let record: SetRecord = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    records.push(record);
  }

  Ok(records)
}

#[tauri::command]
fn upsert_local_set(
  app: tauri::AppHandle,
  user_id: String,
  record: SetRecord,
) -> Result<SetRecord, String> {
  let path = set_path(&app, &user_id, &record.id)?;
  let payload = serde_json::to_string_pretty(&record).map_err(|error| error.to_string())?;
  fs::write(path, payload).map_err(|error| error.to_string())?;
  Ok(record)
}

#[tauri::command]
fn delete_local_sets(
  app: tauri::AppHandle,
  user_id: String,
  set_ids: Vec<String>,
) -> Result<usize, String> {
  let mut deleted_count = 0usize;

  for set_id in set_ids {
    let path = set_path(&app, &user_id, &set_id)?;
    if path.exists() {
      fs::remove_file(path).map_err(|error| error.to_string())?;
      deleted_count += 1;
    }
  }

  Ok(deleted_count)
}

#[tauri::command]
fn queue_sync(
  app: tauri::AppHandle,
  user_id: String,
  operation: SyncOperation,
) -> Result<(), String> {
  let path = sync_queue_path(&app, &user_id)?;
  let mut operations = read_sync_queue(&path)?;
  operations.push(operation);
  write_sync_queue(&path, &operations)
}

#[tauri::command]
fn flush_sync(app: tauri::AppHandle, user_id: String) -> Result<FlushSyncResult, String> {
  let path = sync_queue_path(&app, &user_id)?;
  flush_sync_file(&path)
}

#[tauri::command]
fn get_startup_args() -> Vec<String> {
  std::env::args().collect()
}

#[tauri::command]
async fn read_native_file_by_path(path: String) -> Result<NativePickedFile, String> {
  let path_buf = PathBuf::from(path);
  read_native_file(&path_buf)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    std::process::Command::new("cmd")
      .args(["/C", "start", "", &url])
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(target_os = "macos")]
  {
    std::process::Command::new("open")
      .arg(&url)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  #[cfg(target_os = "linux")]
  {
    std::process::Command::new("xdg-open")
      .arg(&url)
      .spawn()
      .map_err(|e| e.to_string())?;
  }
  // TODO(phase-3): Android'de bu komut için henüz bir kol yok; buraya düşen url
  // sessizce yok sayılır. Native Google auth (google_auth) Faz 3'te eklenene kadar
  // JS tarafı Google giriş düğmesini yalnızca masaüstünde gösteriyor (isDesktopRuntime).
  let _ = url;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|_app| {
      #[cfg(desktop)]
      {
        _app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
        _app.handle().plugin(tauri_plugin_process::init())?;
        _app.handle().plugin(tauri_plugin_deep_link::init())?;

        #[cfg(any(windows, target_os = "linux"))]
        {
          use tauri_plugin_deep_link::DeepLinkExt;
          _app.deep_link().register("mcq-app")?;
        }

        _app.handle().plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
          let _ = app.emit("single-instance-args", args);
        }))?;
      }
      Ok(())
    })
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      list_local_sets,
      upsert_local_set,
      delete_local_sets,
      queue_sync,
      flush_sync,
      pick_native_set_files,
      write_set_source_file,
      get_startup_args,
      read_native_file_by_path,
      open_url
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::*;

  fn sample_set_record() -> SetRecord {
    SetRecord {
      id: "set-1".to_string(),
      slug: "set-1".to_string(),
      set_name: "Set 1".to_string(),
      file_name: "set-1.json".to_string(),
      source_format: "json".to_string(),
      source_path: String::new(),
      raw_source: "{\"setName\":\"Set 1\",\"questions\":[]}".to_string(),
      questions: vec![QuestionRecord {
        id: "q1".to_string(),
        q: "Question".to_string(),
        options: vec!["A".to_string(), "B".to_string()],
        correct: 0,
        explanation: Some("Explanation".to_string()),
        subject: Some("General".to_string()),
      }],
      updated_at: "2026-04-23T00:00:00.000Z".to_string(),
    }
  }

  fn unique_queue_path() -> PathBuf {
    std::env::temp_dir().join(format!(
      "mcq-sync-queue-{}.json",
      SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before epoch")
        .as_nanos()
    ))
  }

  #[test]
  fn sync_queue_round_trip_flushes_records() {
    let path = unique_queue_path();
    let operation = SyncOperation {
      operation_type: "upsert".to_string(),
      queued_at: "2026-04-23T00:00:00.000Z".to_string(),
      set_ids: None,
      record: Some(sample_set_record()),
    };

    write_sync_queue(&path, &[operation.clone()]).expect("queue write should succeed");
    let queued = read_sync_queue(&path).expect("queue read should succeed");
    assert_eq!(queued, vec![operation.clone()]);

    let flushed = flush_sync_file(&path).expect("queue flush should succeed");
    assert_eq!(flushed.flushed_count, 1);
    assert_eq!(flushed.operations, vec![operation]);
    assert!(read_sync_queue(&path).expect("queue should remain readable").is_empty());

    let _ = fs::remove_file(path);
  }
}
