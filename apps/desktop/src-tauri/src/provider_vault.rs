//! Windows-only secret entry/storage. Nothing here returns a secret to the renderer.
use windows::{
    core::{w, PCWSTR, PWSTR},
    Win32::{
        Foundation::{ERROR_CANCELLED, ERROR_NOT_FOUND, ERROR_SUCCESS, HWND},
        Security::Credentials::*,
    },
};
use zeroize::{Zeroize, Zeroizing};

const FAILED: &str = "Windows could not access Oracle's provider credentials.";
pub const MAX_BLOB: usize = 1040;

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

struct Credential(*mut CREDENTIALW);
impl Drop for Credential {
    fn drop(&mut self) {
        // CredRead allocates this record and its blob; scrub before releasing the OS allocation.
        unsafe {
            let row = &*self.0;
            if !row.CredentialBlob.is_null() && row.CredentialBlobSize <= 2560 {
                std::slice::from_raw_parts_mut(row.CredentialBlob, row.CredentialBlobSize as usize)
                    .zeroize();
            }
            CredFree(self.0.cast());
        }
    }
}

pub fn read(target: &str) -> Result<Option<Zeroizing<Vec<u8>>>, &'static str> {
    let name = wide(target);
    let mut pointer = std::ptr::null_mut();
    // Fixed application-owned target; never enumerate other Windows credentials.
    if let Err(error) =
        unsafe { CredReadW(PCWSTR(name.as_ptr()), CRED_TYPE_GENERIC, None, &mut pointer) }
    {
        return if error.code() == windows::core::HRESULT::from_win32(ERROR_NOT_FOUND.0) {
            Ok(None)
        } else {
            Err(FAILED)
        };
    }
    if pointer.is_null() {
        return Err(FAILED);
    }
    let owned = Credential(pointer);
    let row = unsafe { &*owned.0 };
    if row.CredentialBlobSize as usize > MAX_BLOB || row.CredentialBlob.is_null() {
        return Err(FAILED);
    }
    let bytes =
        unsafe { std::slice::from_raw_parts(row.CredentialBlob, row.CredentialBlobSize as usize) };
    Ok(Some(Zeroizing::new(bytes.to_vec())))
}

pub fn write(target: &str, bytes: &mut [u8]) -> Result<(), &'static str> {
    if bytes.len() > MAX_BLOB {
        return Err(FAILED);
    }
    let mut name = wide(target);
    let mut username = wide("Oracle provider settings");
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: PWSTR(name.as_mut_ptr()),
        CredentialBlobSize: bytes.len() as u32,
        CredentialBlob: bytes.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: PWSTR(username.as_mut_ptr()),
        ..Default::default()
    };
    // Atomic replacement of this one generic credential, scoped to this Windows user/machine.
    unsafe { CredWriteW(&credential, 0) }.map_err(|_| FAILED)
}

pub fn prompt(parent: usize) -> Result<Option<Zeroizing<String>>, &'static str> {
    let mut username = wide("OpenAI API key");
    username.resize(514, 0);
    let mut password = Zeroizing::new(vec![0u16; 1025]);
    let info = CREDUI_INFOW {
        cbSize: std::mem::size_of::<CREDUI_INFOW>() as u32,
        hwndParent: HWND(parent as *mut std::ffi::c_void),
        pszCaptionText: w!("Oracle / OpenAI API key"),
        pszMessageText: w!("Enter your OpenAI API key in the password field. This is not your Oracle or Windows password. Saving does not contact OpenAI."),
        ..Default::default()
    };
    let status = unsafe {
        CredUIPromptForCredentialsW(
            Some(&info),
            w!("Oracle.OpenAI.KeyEntry"),
            None,
            0,
            &mut username,
            &mut password,
            None,
            CREDUI_FLAGS_GENERIC_CREDENTIALS
                | CREDUI_FLAGS_ALWAYS_SHOW_UI
                | CREDUI_FLAGS_DO_NOT_PERSIST
                | CREDUI_FLAGS_KEEP_USERNAME,
        )
    };
    if status == ERROR_CANCELLED {
        return Ok(None);
    }
    if status != ERROR_SUCCESS {
        return Err("Windows could not open the API key dialog.");
    }
    let length = password.iter().position(|ch| *ch == 0).ok_or(FAILED)?;
    Ok(Some(Zeroizing::new(
        String::from_utf16(&password[..length]).map_err(|_| FAILED)?,
    )))
}

#[cfg(test)]
pub fn remove_synthetic(target: &str) {
    assert!(target.starts_with("Oracle.Tests.Provider."));
    let name = wide(target);
    let _ = unsafe { CredDeleteW(PCWSTR(name.as_ptr()), CRED_TYPE_GENERIC, None) };
}
