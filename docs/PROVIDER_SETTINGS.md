# Provider configuration and credentials

**05 / CONTROL** prepares the first OpenAI connection. It supports saving/replacing/removing a key,
a persisted permission for manual connection checks, and an explicit **Test connection** action.
It does not enable inference, select a model, or grant access to private records. OpenAI is the
initial adapter from the original plan; local and other providers are not configured here yet.

## Owner workflow

1. Unlock Oracle and open **05 / CONTROL**.
2. Choose **Add API key in Windows**. In the Windows dialog's password field, enter the OpenAI API
   key, not the Oracle or Windows password. Cancel leaves the saved configuration unchanged.
3. Enable **Allow manual connection checks to OpenAI** if desired.
4. Choose **Test connection**. Saving credentials or permissions alone never contacts the provider.

The test sends the key as a Bearer authorization header to the fixed HTTPS endpoint
`https://api.openai.com/v1/models`, plus ordinary request/network metadata. There is no prompt,
record payload, generation or automatic retry. A successful test establishes model-list access for
that configuration at that moment, not inference availability, billing eligibility or authorization
to send any document. A restricted key may legitimately fail model-list permission checks.

Replace/remove disables connection permission. Removing the local key does not revoke it at OpenAI.
Refresh after conflicts or uncertain operations to confirm the saved state before another mutation.
The UI does not retain a successful test as a permanent or background connectivity promise.

## Security boundary

Key entry uses Windows CredUI, outside the WebView. The renderer passes only an operation, settings
revision and (for permission changes) a boolean. It cannot submit or retrieve a key, choose a target
URL, choose a vault target, access a record or invoke a model through this command.

Windows Credential Manager stores a bounded, versioned binary record at the single generic target
`Oracle.Provider.OpenAI.v1`. It includes the key, revision and connection-test permission, replaced
atomically together with same-user/same-machine persistence. The native code does not enumerate
other credentials. An empty `provider-settings.lock` file in private Oracle AppData uses Windows
sharing denial to serialize read/check/write across app instances. Revisions reject stale edits.

Every provider operation requires an unlocked native session. The authorization guard remains held
through an admitted operation: finish or cancel the modal credential dialog before locking Oracle.
Locking can wait for a current connection test, which has a ten-second request deadline and a
four-second connect deadline. After lock returns, no prior provider operation remains admitted.

The HTTP adapter uses Windows TLS with certificate validation and TLS 1.2 or later. It rejects
redirects, disables proxies and automatic retries, fixes the endpoint, caps the response at 512 KiB,
validates its structure, and returns only a status. External bodies, keys and exception details are
never returned as errors. Authorization headers are marked sensitive. Owned key buffers and the OS
credential-read buffer are zeroized where controlled; this is not a guarantee that Windows, TLS or
allocator-internal temporary copies are erased immediately.

Credential Manager protects storage using the Windows account boundary. Oracle's lock does not
protect against malware, an administrator or other code already running as the same Windows user.
No claim of application-exclusive OS credential access is made.

## Storage and recovery

Keys are not in Git, renderer state/storage, the Linux database, environment variables, command-line
arguments or Oracle's encrypted workspace backups. Keep an independent recovery method and re-enter
the key after moving machines. Existing Oracle access credentials and record-runtime selection are
unchanged. No schema migration or Linux backend release is required for this desktop-only feature.

An unreadable/unsupported credential fails closed; Oracle does not overwrite or silently initialize
it. If recovery is needed, close Oracle and review the exact **Oracle.Provider.OpenAI.v1** entry in
Windows Credential Manager. Removing that specific entry resets this provider setup and requires
key entry and permission again. Do not remove unrelated credentials or runtime/rollback markers.

## Verification and current limits

Tests use unique synthetic Credential Manager targets, delete them on fixture cleanup, and never
read the owner's provider key. Native regressions cover real vault round trips, redacted status,
default-denied networking, stale writes, cancellation, corrupted data, cross-instance exclusion,
locked sessions, lock ordering, and bounded input/response validation. Frontend tests cover explicit
key entry/permission/testing, removal, secret-free request contracts and failure reconciliation.

No real API key was entered or external provider request made during implementation. Native dialog
presentation and a live account's connection result remain owner verification steps. Model choice,
inference permissions, data-sharing approvals, additional providers and usage limits are later work.

References: [OpenAI model-list endpoint](https://developers.openai.com/api/reference/resources/models/methods/list),
[Windows credential dialog](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-creduipromptforcredentialsw),
and [Windows credential persistence](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw).
