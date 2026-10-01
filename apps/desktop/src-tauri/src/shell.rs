//! Window geometry is presentation only. Record access remains guarded by Access.
use crate::commands::SharedAccess;
use tauri::{LogicalSize, State, WebviewWindow};

const FAILED: &str = "Oracle could not change its window. Close and reopen the app.";

#[cfg(windows)]
fn region(window: &WebviewWindow, circular: bool) -> Result<(), &'static str> {
    let hwnd = window.hwnd().map_err(|_| FAILED)?;
    let size = window.outer_size().map_err(|_| FAILED)?;
    unsafe { apply_region(hwnd, circular, size.width as i32, size.height as i32) }
}

#[cfg(windows)]
unsafe fn apply_region(
    hwnd: windows::Win32::Foundation::HWND,
    circular: bool,
    width: i32,
    height: i32,
) -> Result<(), &'static str> {
    use windows::Win32::Graphics::Gdi::{CreateEllipticRgn, DeleteObject, SetWindowRgn};
    // The caller runs on Tauri's UI thread. On success Windows owns the region.
    unsafe {
        if !circular {
            if SetWindowRgn(hwnd, None, true) == 0 {
                return Err(FAILED);
            }
        } else {
            let shape = CreateEllipticRgn(0, 0, width, height);
            if shape.0.is_null() {
                return Err(FAILED);
            }
            if SetWindowRgn(hwnd, Some(shape), true) == 0 {
                let _ = DeleteObject(shape.into());
                return Err(FAILED);
            }
        }
    }
    Ok(())
}

#[cfg(not(windows))]
fn region(_: &WebviewWindow, _: bool) -> Result<(), &'static str> {
    Ok(())
}

pub fn initialize(window: &WebviewWindow) -> Result<(), &'static str> {
    region(window, true)?;
    let observed = window.clone();
    let initial = window.outer_size().map_err(|_| FAILED)?;
    let dimensions =
        std::sync::atomic::AtomicU64::new(((initial.width as u64) << 32) | initial.height as u64);
    window.on_window_event(move |event| {
        if matches!(
            event,
            tauri::WindowEvent::Resized(_) | tauri::WindowEvent::ScaleFactorChanged { .. }
        ) && matches!(observed.is_decorated(), Ok(false))
        {
            if let Ok(size) = observed.outer_size() {
                let next = ((size.width as u64) << 32) | size.height as u64;
                // SetWindowRgn can itself deliver window-position messages. Avoid reentry.
                if dimensions.swap(next, std::sync::atomic::Ordering::Relaxed) != next {
                    let _ = region(&observed, true);
                }
            }
        }
    });
    window.show().map_err(|_| FAILED)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use windows::{
        core::w,
        Win32::{
            Graphics::Gdi::{CreateRectRgn, DeleteObject, GetWindowRgn, PtInRegion},
            UI::WindowsAndMessaging::{
                CreateWindowExW, DestroyWindow, WINDOW_EX_STYLE, WINDOW_STYLE,
            },
        },
    };

    #[test]
    fn native_circle_excludes_corners_and_restores_rectangle() {
        // A hidden disposable HWND, never the owner's running Oracle window.
        unsafe {
            let hwnd = CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                w!("STATIC"),
                w!("Oracle region test"),
                WINDOW_STYLE::default(),
                0,
                0,
                560,
                560,
                None,
                None,
                None,
                None,
            )
            .unwrap();
            apply_region(hwnd, true, 560, 560).unwrap();
            let probe = CreateRectRgn(0, 0, 0, 0);
            assert_ne!(GetWindowRgn(hwnd, probe).0, 0);
            assert!(!PtInRegion(probe, 0, 0).as_bool());
            assert!(PtInRegion(probe, 280, 280).as_bool());
            apply_region(hwnd, true, 840, 840).unwrap();
            assert_ne!(GetWindowRgn(hwnd, probe).0, 0);
            assert!(PtInRegion(probe, 800, 420).as_bool());
            apply_region(hwnd, false, 1100, 760).unwrap();
            assert_eq!(GetWindowRgn(hwnd, probe).0, 0);
            let _ = DeleteObject(probe.into());
            DestroyWindow(hwnd).unwrap();
        }
    }
}

#[tauri::command]
pub fn shell_mode(
    workspace: bool,
    window: WebviewWindow,
    access: State<'_, SharedAccess>,
) -> Result<(), &'static str> {
    // Synchronous Tauri commands run on the main thread. Authorize expansion natively.
    let access = access.lock().map_err(|_| FAILED)?;
    if workspace {
        access.require_unlocked()?;
    }
    window.hide().map_err(|_| FAILED)?;
    let result = (|| {
        window.unmaximize().map_err(|_| FAILED)?;
        window
            .set_min_size(None::<LogicalSize<f64>>)
            .map_err(|_| FAILED)?;
        window.set_decorations(workspace).map_err(|_| FAILED)?;
        window.set_resizable(workspace).map_err(|_| FAILED)?;
        window
            .set_size(if workspace {
                LogicalSize::new(1100.0, 760.0)
            } else {
                LogicalSize::new(560.0, 560.0)
            })
            .map_err(|_| FAILED)?;
        region(&window, !workspace)?;
        if workspace {
            window
                .set_min_size(Some(LogicalSize::new(640.0, 640.0)))
                .map_err(|_| FAILED)?;
        }
        window.center().map_err(|_| FAILED)
    })();
    let shown = window.show().map_err(|_| FAILED);
    result.and(shown)
}

#[tauri::command]
pub fn shell_action(action: &str, window: WebviewWindow) -> Result<(), &'static str> {
    match action {
        "close" => window.close(),
        "minimize" => window.minimize(),
        "drag" => window.start_dragging(),
        _ => return Err(FAILED),
    }
    .map_err(|_| FAILED)
}
