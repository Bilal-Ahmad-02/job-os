# Job OS — Project Context

This document preserves the project owner's long-term plan for future development sessions. It describes intended direction and future capabilities, not features that already exist or permission to implement the entire roadmap.

## Current stage and scope

Job OS is at the beginning of repository and development-environment setup. Application implementation has not started. Work should proceed through explicitly scoped, incremental tasks.

Do not create domain entities, browser integrations, training infrastructure, or other future features merely because they appear in this document. Do not install dependencies or scaffold the entire application without a task requiring that work.

## Purpose

Job OS is a local-first Windows desktop application for the owner's personal job search while studying an MSc in a data/data-engineering-related field.

Target opportunities include Data Engineer, Data Scientist, Machine Learning Engineer, AI Engineer, and Software Engineer positions, as well as graduate roles, internships, and part-time technical roles.

The project has two equally important purposes:

1. Provide a real application the owner will personally use.
2. Become a serious GitHub/portfolio project demonstrating software engineering, data engineering, AI/ML engineering, databases, APIs, frontend development, automation, testing, and eventually local LLM training.

Engineer it professionally, with maintainability and practical usefulness in mind. Avoid unnecessary complexity without sacrificing sound engineering for speed.

## Product workflow

The eventual workflow is:

1. Discover and save or import a job.
2. Extract structured information and analyse requirements.
3. Compare the job with the candidate profile, identifying strengths and skill gaps.
4. Prepare an application and associate the CV and cover letter versions used.
5. Mark the application as submitted.
6. Track application status, follow-ups, interviews, and outcomes.
7. Analyse historical application data and learn how to improve future applications.

## Delivery phases

| Phase | Focus |
| --- | --- |
| A | Job and application tracker |
| B | AI job assistant |
| C | Browser, email, background automation, and agentic features |

Build incrementally. Do not jump directly to Phase C.

## Intended architecture

These are the current technology choices in the plan; they do not imply that dependencies or components are already installed or implemented.

| Area | Intended technology |
| --- | --- |
| Operating system | Windows |
| Desktop shell | Tauri 2 |
| Frontend | React and TypeScript |
| Backend | Python and FastAPI |
| Database | SQLite initially |
| ORM | SQLAlchemy |
| Database migrations | Alembic |
| Validation | Pydantic |
| AI | Provider abstraction, with the OpenAI API initially and local/open-weight models later |
| Backend tests | pytest |
| Frontend tests | Appropriate tooling to be selected later |
| Version control and hosting | Git and GitHub |

Core application functionality must work locally. Do not assume cloud services are required. Hosted AI is an intended integration, not a prerequisite for the core tracker.

Keep concerns separated, including UI, backend logic, persistence, AI integrations, and experimental ML work. Explain major architectural decisions to the owner before implementing them.

## Domain and data direction

The database should be normalized where appropriate rather than storing everything in one giant table. Likely entities include:

- Company, Job, and Application.
- Skill, JobSkillRequirement, CandidateSkill, and CandidateEvidence.
- Document, ResumeVersion, and CoverLetterVersion.
- Contact and Interview.
- Activity, Task, and FollowUp.
- ApplicationStatusHistory and AIAnalysis.

These are candidate entities, not an approved final schema. Do not create them until explicitly instructed.

### Job and application information

The application should eventually track:

- Job title, company, job URL, company website, and discovery source.
- Location; remote, hybrid, or onsite arrangement; and full-time, part-time, internship, or graduate role type.
- Dates discovered, saved, and applied, plus application deadlines.
- Application status and rejection, offer, or withdrawal outcomes.
- Required and preferred skills, required education, requested experience, and responsibilities.
- Salary information when available, recruiter/contact information, and notes.
- CV and cover letter versions used.
- Interview stages and follow-up dates.
- Skills or topics to revise or learn, and AI analysis.

### Application status concept

Potential states are Saved, Analysing, Preparing, Ready to Apply, Applied, Assessment, Interview, Final Interview, Offer, Rejected, and Withdrawn.

The exact workflow and permitted transitions remain undecided. This list does not prescribe a single mandatory sequence.

## Candidate profile and evidence

The future candidate profile should represent education, experience, projects, programming languages, frameworks, databases, cloud technologies, ML/AI technologies, DevOps knowledge, courses, certifications, languages, GitHub projects, preferred roles, and preferred locations.

Skills should have supporting evidence. For example, a PyTorch skill might be supported by the FlowSense project and coursework. This is an illustration of the evidence relationship, not a substitute for verified candidate records.

AI-generated claims about the candidate must be grounded in stored candidate evidence. The AI must not invent qualifications or silently fabricate experience.

## Planned AI capabilities

### Job advertisement extraction

Convert a raw job advertisement into structured information: company, role, location, employment type, required and preferred skills, experience and education requirements, responsibilities, and application deadline.

### Candidate/job comparison

Identify strong matches, partial matches, missing skills, relevant candidate evidence, topics worth revising, and preparation recommendations.

### Resume assistance

Start with a master CV, analyse the job, suggest relevant modifications, let the human review changes, and then produce a job-specific CV version. Preserve the evidence requirement throughout this workflow.

### Interview preparation

Use the job description, company data, candidate profile, and application history to recommend technical topics, likely interview themes, revision topics, and relevant projects to discuss.

### Application analytics

Eventually analyse interview rates by role, source, and CV version; commonly requested skills; recurring skill gaps; application response rates; and job-market skill trends.

## AI provider architecture

Do not tightly couple application logic to one LLM vendor. The intended conceptual boundary is:

```text
AIProvider
    OpenAIProvider
    LocalModelProvider
    Possibly other providers
```

The rest of the application should communicate through the abstraction. Exact interfaces and implementation details remain to be designed when required.

## Future integrations and automation

### Browser extension

A future Chrome/Edge extension should offer "Save to Job OS" while viewing a job advertisement and send the current page/job information to the local backend.

Potential sources include LinkedIn, company career websites, Greenhouse, Lever, Workday, Indeed, and other job boards. Do not implement this extension yet.

### Background operation

Future functionality may include the Windows system tray, launch at Windows startup, reminders, follow-up monitoring, processing job/application events, notifications, and analysis of application-related emails.

Destructive or consequential automation must remain human-in-the-loop. The application must not blindly mass-submit job applications.

### Email integration

Potential future functionality should detect application confirmations, interview invitations, rejections, assessment invitations, and offers, then suggest an application status change.

For example, an interview invitation from a company could suggest changing Applied to Interview. The user must be able to confirm or reject the suggested change.

## Local AI and model-training roadmap

A major long-term goal is learning to operate and train AI models locally. The intended progression is:

1. Use a frontier model API.
2. Run open-weight models locally.
3. Add embeddings and retrieval-augmented generation (RAG).
4. Collect Job OS training and evaluation data.
5. Fine-tune small open models.
6. Learn LoRA and QLoRA.
7. Fine-tune a domain-specific Job OS model.
8. Experiment with preference data.
9. Build a small Transformer from random weights.
10. Learn more advanced architectures, such as Mixture-of-Experts.

Keep production application code and experimental ML code cleanly separated. A possible future structure is:

```text
training/
    datasets/
    configs/
    scripts/
    evaluation/
    experiments/
```

This structure is illustrative. Do not create it unless instructed.

### Learning from user corrections

User corrections should eventually be able to produce structured training/evaluation examples containing model input, model output, corrected output, candidate evidence, and model/version metadata.

For example, the AI might label Python as a missing skill, while the user corrects it to a matching skill and supplies the FlowSense project as evidence.

Training data must not automatically be uploaded to a public repository.

## Privacy and security rules

Never hard-code secrets. Never commit:

- API keys, passwords, or OAuth tokens.
- Email contents or private candidate data.
- Personal application databases.
- Local model weights or sensitive training datasets.
- `.env` files.
- Private CV documents unless explicitly intended by the owner.

Protect these through appropriate local storage and, when that setup is in scope, `.gitignore` exclusions. The presence of these rules does not mean those protections have already been implemented.

## Engineering and collaboration principles

The owner remains the developer and architect; the coding agent is the implementation partner.

- Explain major architectural decisions before implementing them.
- Do not implement large unrelated features without instruction.
- Do not rewrite large portions of the project unless necessary.
- Ask when product or architectural requirements are uncertain rather than inventing them.
- Prefer focused, incremental changes and small, understandable commits.
- Maintain clean architecture, separation of concerns, useful type hints, clear naming, and proper error handling.
- Include database migrations, relevant tests, useful documentation, reproducible setup, and sensible dependency management as the project develops.

For each implementation task:

1. Inspect the relevant existing files.
2. Understand the current architecture.
3. Briefly explain intended changes when the task is substantial.
4. Make focused changes within the requested scope.
5. Run relevant tests.
6. Report what changed.
7. Report problems and unresolved design questions.

## Decisions still to resolve

The following are planning questions, not settled requirements or additional implementation scope:

- How Tauri will package, start, monitor, and stop the Python backend.
- How access to the local API will be controlled, including future browser-extension access.
- The smallest useful Phase A scope, job/application relationships, status transitions, and history requirements.
- Local database and document locations, backups/recovery, migration handling, and document versioning.
- What information may be sent to hosted AI providers and how outputs will retain evidence, model metadata, and user corrections.

Resolve these with the owner when relevant to the next implementation step. The long-term roadmap does not require designing every future subsystem now.
