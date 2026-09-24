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
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
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

    pub fn require_unlocked(&self) -> Result<(), &'static str> {
        if self.unlocked {
            Ok(())
        } else {
            Err("Unlock Oracle to continue.")
        }
    }
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
