//! Local desktop access control. This is not encryption or backend authentication.
use std::{
    fs::{File, OpenOptions},
    io::{Read, Write},
    path::PathBuf,
    time::{Duration, Instant},
};

use argon2::{
    password_hash::{phc::PasswordHash, PasswordHasher, PasswordVerifier},
    Algorithm, Argon2, Params, Version,
};

pub const STORAGE_ERROR: &str = "Oracle cannot read its password settings. Access remains locked.";
const HASH_PREFIX: &str = "$argon2id$v=19$m=19456,t=2,p=1$";

pub struct Access {
    path: PathBuf,
    unlocked: bool,
    failures: u32,
    retry_at: Option<Instant>,
}

impl Access {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            unlocked: false,
            failures: 0,
            retry_at: None,
        }
    }

    // Read on each attempt: never cache a missing or invalid credential file.
    fn stored_hash(&self) -> Result<Option<String>, &'static str> {
        let file = match File::open(&self.path) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                // A missing credential beside existing personal data is a recovery
                // problem, never permission to set a replacement password.
                for name in [
                    "oracle.sqlite3",
                    "oracle.workspace-id",
                    "runtime.json",
                    "runtime-wsl.selected",
                    "runtime-transition.pending",
                    "rotation.phc",
                ] {
                    if self
                        .path
                        .with_file_name(name)
                        .try_exists()
                        .map_err(|_| STORAGE_ERROR)?
                    {
                        return Err(STORAGE_ERROR);
                    }
                }
                return Ok(None);
            }
            Err(_) => return Err(STORAGE_ERROR),
        };
        let mut value = String::new();
        file.take(513)
            .read_to_string(&mut value)
            .map_err(|_| STORAGE_ERROR)?;
        if value.len() > 512 || !value.starts_with(HASH_PREFIX) {
            return Err(STORAGE_ERROR);
        }
        let parsed = PasswordHash::new(&value).map_err(|_| STORAGE_ERROR)?;
        // Reject unsupported parameters before allocating Argon2 memory.
        let params = Params::try_from(&parsed).map_err(|_| STORAGE_ERROR)?;
        if params != password_params() || parsed.salt.is_none() || parsed.hash.is_none() {
            return Err(STORAGE_ERROR);
        }
        Ok(Some(value))
    }

    pub fn status(&self) -> Result<&'static str, &'static str> {
        if self.stored_hash()?.is_none() {
            return Ok("setup");
        }
        Ok(if self.unlocked { "unlocked" } else { "locked" })
    }

    pub fn create_password(&mut self, password: &str) -> Result<(), &'static str> {
        validate_password(password)?;
        if self.stored_hash()?.is_some() {
            return Err("A password is already configured.");
        }
        let hash = hasher()
            .hash_password(password.as_bytes())
            .map_err(|_| "Password setup failed. Please try again.")?
            .to_string();
        let parent = self.path.parent().ok_or(STORAGE_ERROR)?;
        std::fs::create_dir_all(parent).map_err(|_| STORAGE_ERROR)?;
        // Exclusive creation prevents two app instances from replacing each other's password.
        // An interrupted write leaves an invalid file and therefore fails closed next launch.
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&self.path)
            .map_err(|_| STORAGE_ERROR)?;
        file.write_all(hash.as_bytes())
            .and_then(|()| file.sync_all())
            .map_err(|_| STORAGE_ERROR)?;
        self.unlocked = true;
        Ok(())
    }

    pub fn unlock(&mut self, password: &str, now: Instant) -> Result<(), &'static str> {
        if self.retry_at.is_some_and(|deadline| now < deadline) {
            return Err("Please wait up to 30 seconds before trying again.");
        }
        validate_password(password)?;
        let stored = self
            .stored_hash()?
            .ok_or("Create your Oracle password first.")?;
        let hash = PasswordHash::new(&stored).map_err(|_| STORAGE_ERROR)?;
        if hasher()
            .verify_password(password.as_bytes(), &hash)
            .is_err()
        {
            self.unlocked = false;
            self.failures = self.failures.saturating_add(1);
            self.retry_at =
                Some(now + Duration::from_secs((1_u64 << self.failures.min(5)).min(30)));
            return Err("Incorrect password. Wait a moment and try again.");
        }
        self.failures = 0;
        self.retry_at = None;
        self.unlocked = true;
        Ok(())
    }

    pub fn lock(&mut self) {
        self.unlocked = false;
    }

    pub fn rotation_configured(&self) -> Result<bool, &'static str> {
        if !self
            .path
            .with_file_name("rotation.phc")
            .try_exists()
            .map_err(|_| STORAGE_ERROR)?
        {
            return Ok(false);
        }
        Ok(self.rotation_store().stored_hash()?.is_some())
    }

    fn rotation_store(&self) -> Self {
        Self::new(self.path.with_file_name("rotation.phc"))
    }

    pub fn enroll_rotation(&self, steps: &[i32], confirmation: &[i32]) -> Result<(), &'static str> {
        self.require_unlocked()?;
        if steps != confirmation {
            return Err("The rotation sequences do not match.");
        }
        let secret = rotation_secret(steps)?;
        // Exclusive creation: an existing key can never be replaced by enrollment.
        let hash = hasher()
            .hash_password(secret.as_bytes())
            .map_err(|_| STORAGE_ERROR)?
            .to_string();
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(self.path.with_file_name("rotation.phc"))
            .map_err(|_| STORAGE_ERROR)?;
        file.write_all(hash.as_bytes())
            .and_then(|()| file.sync_all())
            .map_err(|_| STORAGE_ERROR)
    }

    pub fn unlock_rotation(&mut self, steps: &[i32], now: Instant) -> Result<(), &'static str> {
        if self.retry_at.is_some_and(|deadline| now < deadline) {
            return Err("Please wait up to 30 seconds before trying again.");
        }
        // The password remains the recovery credential; missing/corrupt storage fails closed.
        self.stored_hash()?.ok_or(STORAGE_ERROR)?;
        let secret = rotation_secret(steps)?;
        let stored = self.rotation_store().stored_hash()?.ok_or(STORAGE_ERROR)?;
        let hash = PasswordHash::new(&stored).map_err(|_| STORAGE_ERROR)?;
        if hasher().verify_password(secret.as_bytes(), &hash).is_err() {
            self.unlocked = false;
            self.failures = self.failures.saturating_add(1);
            self.retry_at =
                Some(now + Duration::from_secs((1_u64 << self.failures.min(5)).min(30)));
            return Err("Sequence not recognized. Wait a moment and try again.");
        }
        self.unlocked = true;
        self.failures = 0;
        self.retry_at = None;
        Ok(())
    }

    pub fn require_unlocked(&self) -> Result<(), &'static str> {
        if self.unlocked {
            Ok(())
        } else {
            Err("Unlock Oracle to continue.")
        }
    }
}

fn rotation_secret(steps: &[i32]) -> Result<zeroize::Zeroizing<String>, &'static str> {
    if !(4..=8).contains(&steps.len())
        || steps.iter().any(|s| *s == 0 || !(-24..=24).contains(s))
        || steps.windows(2).any(|s| s[0].signum() == s[1].signum())
    {
        return Err("Use 4 to 8 alternating turns, each 1 to 24 stops.");
    }
    Ok(zeroize::Zeroizing::new(format!(
        "oracle-rotation-v1:{steps:?}"
    )))
}

fn password_params() -> Params {
    Params::new(19456, 2, 1, Some(32)).expect("Valid fixed Argon2 parameters")
}

fn hasher() -> Argon2<'static> {
    Argon2::new(Algorithm::Argon2id, Version::V0x13, password_params())
}

fn validate_password(password: &str) -> Result<(), &'static str> {
    if password.len() > 512 || !(15..=128).contains(&password.chars().count()) {
        return Err("Use 15 to 128 characters for your Oracle password.");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    const PASSWORD: &str = "test-only long passphrase";

    #[test]
    fn migrated_workspace_never_allows_password_reinitialization() {
        for name in [
            "runtime.json",
            "runtime-wsl.selected",
            "runtime-transition.pending",
            "rotation.phc",
        ] {
            let directory = tempfile::tempdir().unwrap();
            std::fs::write(directory.path().join(name), b"synthetic").unwrap();
            let mut access = Access::new(directory.path().join("password.phc"));
            assert_eq!(access.status(), Err(STORAGE_ERROR));
            assert!(access.create_password(PASSWORD).is_err());
        }
    }

    #[test]
    fn rotation_enrollment_requires_auth_confirmation_and_cannot_replace_a_key() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("password.phc");
        let mut access = Access::new(path.clone());
        let pattern = [4, -3, 12, -1];
        assert!(!access.rotation_configured().unwrap());
        assert!(access.enroll_rotation(&pattern, &pattern).is_err());
        access.create_password(PASSWORD).unwrap();
        assert!(access.enroll_rotation(&pattern, &[1, -2, 3, -4]).is_err());
        access.enroll_rotation(&pattern, &pattern).unwrap();
        assert!(access.rotation_configured().unwrap());
        assert!(access.enroll_rotation(&pattern, &pattern).is_err());
        let stored = std::fs::read_to_string(directory.path().join("rotation.phc")).unwrap();
        assert!(stored.starts_with(HASH_PREFIX));
        assert!(!stored.contains("[4, -3, 12, -1]"));
        let mut restarted = Access::new(path);
        assert!(restarted.require_unlocked().is_err());
        restarted.unlock_rotation(&pattern, Instant::now()).unwrap();
        assert!(restarted.require_unlocked().is_ok());
        restarted.lock();
        assert!(restarted.require_unlocked().is_err());
    }

    #[test]
    fn rotation_and_password_share_throttle_and_password_recovers_corrupt_dial() {
        let directory = tempfile::tempdir().unwrap();
        let mut access = Access::new(directory.path().join("password.phc"));
        access.create_password(PASSWORD).unwrap();
        access
            .enroll_rotation(&[4, -3, 12, -1], &[4, -3, 12, -1])
            .unwrap();
        access.lock();
        let now = Instant::now();
        assert!(access.unlock_rotation(&[1, -2, 3, -4], now).is_err());
        assert!(access.require_unlocked().is_err());
        assert!(access
            .unlock(PASSWORD, now + Duration::from_secs(1))
            .is_err());
        access
            .unlock(PASSWORD, now + Duration::from_secs(3))
            .unwrap();
        access.lock();
        std::fs::write(directory.path().join("rotation.phc"), b"corrupt").unwrap();
        assert!(access.unlock_rotation(&[4, -3, 12, -1], now).is_err());
        access.unlock(PASSWORD, now).unwrap();
        access.lock();
        std::fs::remove_file(directory.path().join("password.phc")).unwrap();
        assert!(access.unlock_rotation(&[4, -3, 12, -1], now).is_err());
    }

    #[test]
    fn rotation_policy_rejects_short_repeated_direction_and_unbounded_inputs() {
        for pattern in [
            vec![],
            vec![1, -2, 3],
            vec![1, 2, 3, 4],
            vec![0, -2, 3, -4],
            vec![25, -2, 3, -4],
            vec![i32::MIN, -2, 3, -4],
            vec![1, -1, 1, -1, 1, -1, 1, -1, 1],
        ] {
            assert!(rotation_secret(&pattern).is_err());
        }
        assert!(rotation_secret(&[24, -24, 1, -1]).is_ok());
    }

    #[test]
    fn setup_persists_only_a_salted_hash_and_restart_is_locked() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("password.phc");
        let mut access = Access::new(path.clone());
        assert_eq!(access.status(), Ok("setup"));
        assert!(access.require_unlocked().is_err());
        access.create_password(PASSWORD).unwrap();
        assert!(access.require_unlocked().is_ok());
        let hash = std::fs::read_to_string(&path).unwrap();
        assert!(hash.starts_with(HASH_PREFIX));
        assert!(!hash.contains(PASSWORD));
        let mut restarted = Access::new(path);
        assert_eq!(restarted.status(), Ok("locked"));
        assert!(restarted.require_unlocked().is_err());
        restarted.unlock(PASSWORD, Instant::now()).unwrap();
        restarted.lock();
        assert!(restarted.require_unlocked().is_err());
        assert!(restarted.create_password("replacement password").is_err());
    }

    #[test]
    fn wrong_password_is_denied_and_throttled_even_if_next_password_is_correct() {
        let directory = tempfile::tempdir().unwrap();
        let mut access = Access::new(directory.path().join("password.phc"));
        access.create_password(PASSWORD).unwrap();
        access.lock();
        let now = Instant::now();
        assert!(access.unlock("wrong long passphrase", now).is_err());
        assert!(access.require_unlocked().is_err());
        assert!(access
            .unlock(PASSWORD, now + Duration::from_secs(1))
            .is_err());
        access
            .unlock(PASSWORD, now + Duration::from_secs(3))
            .unwrap();
        assert_eq!(access.failures, 0);
    }

    #[test]
    fn corruption_and_excessive_cost_fail_closed_without_overwriting() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("password.phc");
        for contents in [
            "".to_owned(),
            "not a hash".to_owned(),
            "x".repeat(514),
            "$argon2id$v=19$m=4294967295,t=2,p=1$c2FsdHNhbHQ$aGFzaA".to_owned(),
        ] {
            std::fs::write(&path, &contents).unwrap();
            let mut access = Access::new(path.clone());
            assert_eq!(access.status(), Err(STORAGE_ERROR));
            assert!(access.unlock(PASSWORD, Instant::now()).is_err());
            assert!(access.create_password(PASSWORD).is_err());
            assert!(access.require_unlocked().is_err());
            assert_eq!(std::fs::read_to_string(&path).unwrap(), contents);
        }
    }

    #[test]
    fn hashes_use_unique_salts_and_password_policy_allows_unicode_and_spaces() {
        let first = hasher()
            .hash_password(PASSWORD.as_bytes())
            .unwrap()
            .to_string();
        let second = hasher()
            .hash_password(PASSWORD.as_bytes())
            .unwrap()
            .to_string();
        assert_ne!(first, second);
        assert!(validate_password("short").is_err());
        assert!(validate_password(&"x".repeat(129)).is_err());
        assert!(validate_password(&"界".repeat(15)).is_ok());
        assert!(validate_password("a long pass phrase").is_ok());
    }
}
