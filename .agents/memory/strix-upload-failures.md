---
name: Strix cloud upload failures
description: Safe handling when Strix Cloud cannot confirm completion of a source upload.
---

When Strix reports an invalid source-upload completion response, treat the upload state as unknown. Check the cloud scan list before any retry; if the CLI provides no upload ID or upload-list operation, do not relaunch blindly.

**Why:** The cloud may have received source files even when the CLI cannot confirm the upload, and a retry could create duplicate uploads or a billable scan.

**How to apply:** Check for a created scan and a retained staged upload using supported read operations. If either state cannot be confirmed, stop and report the uncertainty rather than retrying or guessing an upload ID.
