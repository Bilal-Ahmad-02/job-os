# Oracle roadmap

The owner paused new features after step 13 for stabilization and a Claude handoff (October 2026).
Do not treat this list as authorization to implement everything. HANDOFF.md and VALIDATION.md describe
actual current state. Steps 4 onward preserve the sequence from the owner's local stepbystep.txt note;
steps 1-3 below are reconstructed from the recorded foundation milestones.

1. Encrypted backup and staged recovery — implemented manually; scheduling/cloud status remain later.
2. Private source-document storage — implemented.
3. Candidate-profile storage — implemented.

4. Extract draft information from your documents. Read the imported PDFs locally and link each extracted statement to its source document and page.

5. Add profile review and corrections. Let you approve, edit, or reject extracted information. Distinguish your confirmed information from unreviewed document claims.

6. Handle document versions. Support updated CVs, certificates, and transcripts while preserving earlier originals and identifying which version is current.

7. Build the profile interface. Integrate your profile and document review into Oracle’s existing black-and-green console.

8. Strengthen the backend as these modules arrive. Keep storage, business rules, document processing, external integrations, and desktop communication separate and testable.

9. Add background task management. Give imports and longer operations progress reporting, cancellation, timeouts, safe retries, and recovery after interruption.

10. Finalize the runtime arrangement. Decide whether the backend stays entirely on Windows or uses WSL for selected workloads, with explicit ownership of files and processes.

11. Make Oracle launch independently. Package or manage its backend runtime so normal use does not depend on manually starting development tools.

12. Add controlled configuration and secret storage. Manage provider settings, API credentials, permissions, and connection testing without exposing secrets to the frontend or repository.

13. Define job-search preferences. Capture target roles, locations, remote-work preferences, employment types, exclusions, and other constraints you choose.

14. Add job ingestion. Begin with pasted descriptions and manually supplied listings, then add selected supported external sources.

15. Normalize incoming listings. Convert different source formats into consistent job records while retaining the original source and collection time.

16. Deduplicate and track listing changes. Recognize repeated postings, updates, closed roles, and previously reviewed opportunities.

17. Build deterministic matching first. Compare jobs against your confirmed profile and preferences using understandable rules.

18. Explain recommendations. Show supporting evidence, missing requirements, uncertainty, and reasons a role matches or conflicts with your preferences.

19. Build the job-review workflow. Add an incoming queue, shortlist, dismissals, saved searches, and transitions into the existing application tracker.

20. Expand application management. Add deadlines, tasks, reminders, interview preparation, follow-ups, and links to the exact documents used for each application.

21. Create application documents. Produce tailored CV and cover-letter drafts using approved profile facts, with review before export or use.

22. Introduce the AI provider boundary. Allow selected local or hosted models through one controlled interface, with explicit permissions for any data leaving your computer.

23. Build private knowledge retrieval. Let Oracle retrieve relevant approved profile facts, document passages, jobs, and application history, with source references and deletion controls.

24. Add the conversational assistant. Support questions, comparisons, explanations, and drafting inside Oracle. Clearly distinguish suggestions from completed actions.

25. Evaluate AI accuracy. Test factual grounding, unsupported claims, matching quality, prompt injection, privacy boundaries, latency, and cost before expanding capabilities.

26. Add controlled tool use. Let the assistant propose specific actions through narrowly scoped tools. Require approval for consequential actions such as sending messages or submitting applications.

27. Introduce reliable workflows. Combine approved tools into repeatable tasks with checkpoints, cancellation, bounded retries, and visible execution history.

28. Add scheduling and notifications. Support opted-in searches, follow-up reminders, background maintenance, and backup schedules.

29. Strengthen backup and recovery. Add backup status inside Oracle, scheduled encrypted snapshots, retention controls, recovery drills, and clear handling of missing or damaged workspaces.

30. Expand security controls. Refine locking, sensitive-data handling, storage protection, connector permissions, and credential recovery as Oracle gains capabilities.

31. Add useful diagnostics. Surface actual task status, failures, model availability, and resource usage through redacted logs and an understandable activity history.

32. Prepare the AI improvement pipeline. Collect only approved feedback and datasets, version evaluation sets, and measure whether retrieval, prompting, or matching changes improve results.

33. Consider model training only when justified. Add reproducible training experiments, checkpoints, evaluation, and rollback if measured needs warrant fine-tuning or specialized models.

34. Expand beyond job searching. Introduce separately scoped modules for your projects, study, files, notes, and other personal workflows without giving them unrestricted access.

35. Add personal memory and context controls. Let you inspect, correct, forget, export, and restrict what Oracle remembers across those modules.

36. Add voice interaction. Introduce optional activation, speech recognition, spoken responses, and visible microphone controls.

37. Consider broader computer assistance. Add narrowly authorized computer actions or context collection only when requested, with explicit scope and approval boundaries.

38. Evolve the command-center interface. Integrate conversation, evidence, tasks, notifications, and optional multi-monitor views while preserving your personalized black-and-green aesthetic.

39. Establish dependable releases. Finish installation, updates, migration recovery, performance testing, accessibility, security review, and regression checks.

40. Maintain and improve Oracle continuously. Review dependencies, test restores, monitor failures, evaluate AI changes, and deliver small, verified improvements.

Steps 4-13 have been implemented at their documented scope. Step 10's Linux runtime ownership
was completed early. The owner resumed the roadmap on 2026-10-05. Step 14's manual part (pasted and
hand-entered listings) is implemented and deployed; see LISTINGS.md. Step 15 normalization for
those listings is implemented and deployed, with no schema change. Step 16 duplicate flags and
the owner-set closed flag are implemented and deployed with schema `0010`. Steps 17-18 (matching
and its explanations) are skipped for now at the owner's request, pending a confirmed profile and
preferences. Step 19's review workflow is implemented in source with schema `0011`, not yet
deployed. Its
"selected supported external sources" part is not started. Later steps may
build on partial foundations already present; provider connection testing is not AI execution,
source-text extraction is not semantic profile generation, and manual backups are not scheduling.
