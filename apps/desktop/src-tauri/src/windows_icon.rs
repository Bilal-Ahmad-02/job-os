//! Tauri's window icon currently sets ICON_SMALL only. Set ICON_BIG as well so
//! Windows need not fall back to the shell's cached executable icon after launch.
use windows::{
    core::PCWSTR,
    Win32::{
        Foundation::{HWND, LPARAM, WPARAM},
        System::LibraryLoader::GetModuleHandleW,
        UI::WindowsAndMessaging::{
            LoadImageW, SendMessageW, ICON_BIG, IMAGE_ICON, LR_SHARED, WM_GETICON, WM_SETICON,
        },
    },
};

pub fn configure(window: &tauri::WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    // Called in Tauri's setup callback, on the UI thread, while the window lives.
    unsafe { set_taskbar_icon(window.hwnd()?)? };
    Ok(())
}

/// # Safety
/// `hwnd` must be a live window owned by this process on the calling UI thread.
unsafe fn set_taskbar_icon(hwnd: HWND) -> windows::core::Result<()> {
    // Resource 32512 is the icon group emitted by tauri-build. Load from this
    // executable, never a mutable external path. LR_SHARED keeps the HICON valid
    // for the process lifetime; Windows owns it and it must not be destroyed.
    let module = unsafe { GetModuleHandleW(None)? };
    let icon = unsafe {
        LoadImageW(
            Some(module.into()),
            PCWSTR(32512_usize as *const u16),
            IMAGE_ICON,
            64,
            64,
            LR_SHARED,
        )?
    };
    unsafe {
        SendMessageW(
            hwnd,
            WM_SETICON,
            Some(WPARAM(ICON_BIG as usize)),
            Some(LPARAM(icon.0 as isize)),
        );
    }
    let installed =
        unsafe { SendMessageW(hwnd, WM_GETICON, Some(WPARAM(ICON_BIG as usize)), None) };
    if installed.0 != icon.0 as isize {
        return Err(windows::core::Error::new(
            windows::core::HRESULT(0x80004005_u32 as i32),
            "Windows did not retain Oracle's taskbar icon",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::{
        core::w,
        Win32::UI::WindowsAndMessaging::{
            CreateWindowExW, DestroyWindow, WINDOW_EX_STYLE, WINDOW_STYLE,
        },
    };

    #[test]
    fn installs_large_icon_on_a_window_that_has_none() {
        // A hidden native window exercises the actual Windows message/resource
        // path without opening Oracle or touching the user's local settings.
        let hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                w!("STATIC"),
                w!("Oracle icon test"),
                WINDOW_STYLE::default(),
                0,
                0,
                0,
                0,
                None,
                None,
                None,
                None,
            )
            .unwrap()
        };
        struct WindowGuard(HWND);
        impl Drop for WindowGuard {
            fn drop(&mut self) {
                unsafe {
                    let _ = DestroyWindow(self.0);
                }
            }
        }
        let _window = WindowGuard(hwnd);
        assert_eq!(
            unsafe { SendMessageW(hwnd, WM_GETICON, Some(WPARAM(ICON_BIG as usize)), None) }.0,
            0
        );
        unsafe { set_taskbar_icon(hwnd) }.unwrap();
        assert_ne!(
            unsafe { SendMessageW(hwnd, WM_GETICON, Some(WPARAM(ICON_BIG as usize)), None) }.0,
            0
        );
        // Reapplying uses the shared resource safely and must remain successful.
        unsafe { set_taskbar_icon(hwnd) }.unwrap();
    }
}
