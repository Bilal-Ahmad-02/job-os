use std::{io::Read, time::Duration};

const UNAVAILABLE: &str = "The local service is unavailable.";

pub fn check() -> Result<(), &'static str> {
    let client = reqwest::blocking::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|_| UNAVAILABLE)?;
    let response = client
        .get("http://127.0.0.1:8000/health")
        .header("Accept", "application/json")
        .header("Cache-Control", "no-store")
        .send()
        .map_err(|_| UNAVAILABLE)?;
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if !response.status().is_success() || content_type.split(';').next() != Some("application/json")
    {
        return Err(UNAVAILABLE);
    }
    // A hostile process occupying the port must not cause an unbounded allocation.
    let mut body = Vec::new();
    response
        .take(1025)
        .read_to_end(&mut body)
        .map_err(|_| UNAVAILABLE)?;
    validate_body(&body)
}

fn validate_body(body: &[u8]) -> Result<(), &'static str> {
    if body.len() > 1024 {
        return Err(UNAVAILABLE);
    }
    let value: serde_json::Value = serde_json::from_slice(body).map_err(|_| UNAVAILABLE)?;
    if value.get("status").and_then(|value| value.as_str()) == Some("ok") {
        Ok(())
    } else {
        Err(UNAVAILABLE)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_health_without_exposing_invalid_response_contents() {
        assert!(validate_body(br#"{"status":"ok"}"#).is_ok());
        for body in [
            b"null".as_slice(),
            b"[]",
            b"{}",
            br#"{"status":"error"}"#,
            b"private error",
        ] {
            assert_eq!(validate_body(body), Err(UNAVAILABLE));
        }
        assert!(validate_body(&vec![b' '; 1025]).is_err());
    }
}
