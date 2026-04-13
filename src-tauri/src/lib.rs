use std::{
  fs,
  path::{Path, PathBuf},
  time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativePickedFile {
  path: String,
  name: String,
  contents: String,
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

fn read_native_file(path: &Path) -> Result<NativePickedFile, String> {
  let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
  Ok(NativePickedFile {
    path: path.to_string_lossy().into_owned(),
    name: file_name_for_path(path),
    contents,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      #[cfg(desktop)]
      app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
      Ok(())
    })
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![
      pick_native_set_files,
      write_set_source_file
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
