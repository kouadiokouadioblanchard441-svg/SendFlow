---
name: Workflow process ownership
description: Managed workflow failures can coexist with old children still serving the same port after environment updates or merges.
---

In this workspace, environment updates and task merges have repeatedly left
application child processes serving their ports while the corresponding managed
workflow reports a port-conflict failure.

**Why:** Restarting without distinguishing the old listener from the failed
launch repeats the conflict and can misidentify a process-management issue as
an application regression.

**How to apply:** Compare the managed workflow status with the actual listener.
Confirm the process command and working directory belong to that exact artifact
before terminating a residual process. Preserve unrelated services and ports;
do not change application routing or kill all Node processes to resolve it.
