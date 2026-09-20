# UNIMEDI — COMPLETE PROJECT CONTEXT & TECHNICAL HANDOFF

> **Document purpose:** Persistent source-of-context for the Unimedi project.  
> **Use this file to transfer the project to another AI/developer without losing the project's purpose, decisions, progress, dependencies, architecture, workflows, technical assumptions, limitations, and future direction.**
>
> **Important:** This document distinguishes between **confirmed project decisions**, **discussed/planned functionality**, and **implementation details that still need verification from the actual repository**. Do not invent missing implementation details.

---

# 1. PROJECT IDENTITY

**Project Name:** Unimedi  
**Type:** Full-stack digital healthcare management platform  
**Primary focus:** Patient-centric medical-record management, healthcare workflows, secure access, appointments, and future intelligent assistance.

### One-line description

> Unimedi is a full-stack healthcare management platform for secure medical records, appointments, role-based access, and patient-centric healthcare workflows.

### Repository description

> Unimedi is a full-stack healthcare management platform that centralizes patient medical records, appointment scheduling, and healthcare workflows while providing secure role-based access for patients, doctors, and receptionists.

---

# 2. PROJECT VISION

Unimedi aims to provide a unified digital healthcare layer in which a patient's important healthcare information can be managed through one secure platform rather than remaining fragmented across individual hospitals, clinics, laboratories, physical documents, and disconnected applications.

The long-term vision is a **patient-centric healthcare ecosystem** where:

- Patients can access and manage their healthcare information.
- Patients can control access to sensitive records.
- Doctors can access relevant information when authorized.
- Receptionists can manage operational workflows without unnecessary access to clinical information.
- Appointments, prescriptions, reports, and medical history can exist within one coordinated system.
- Access to sensitive information can be transparent and auditable.
- Future AI/LLM/RAG modules can provide assistive healthcare functionality without replacing qualified professionals.

---

# 3. PROJECT AIM

The immediate aim is to develop a working MVP that demonstrates:

1. Secure authentication.
2. Patient, Doctor, and Receptionist roles.
3. Role-specific dashboards.
4. Centralized medical-record management.
5. Appointment scheduling and management.
6. Controlled doctor access to patient records.
7. Prescription/report management.
8. Access transparency and notifications.
9. A foundation for future healthcare AI features.
10. A deployable full-stack web architecture.

---

# 4. PROBLEM DEFINITION

Healthcare information is frequently fragmented between hospitals, clinics, diagnostic centers, pharmacies, and physical documents.

This creates problems such as:

- Incomplete medical history.
- Difficulty transferring records.
- Repeated tests.
- Delayed access to relevant information.
- Poor continuity between healthcare providers.
- Limited patient control over personal records.
- Unclear visibility into record access.
- Separate appointment and medical-record workflows.
- Security and privacy challenges.
- Lack of integrated healthcare assistance.

Unimedi attempts to address these problems by providing a unified platform for healthcare data and workflows.

---

# 5. CORE USERS

## 5.1 Patient

The patient is the primary user and intended owner/controller of their healthcare information.

Expected functionality:

- Registration/login.
- Profile management.
- Medical-history viewing.
- Prescription viewing.
- Report/history viewing.
- Appointment viewing/requesting.
- Doctor access authorization.
- Access/update notifications.
- Healthcare assistance features.

## 5.2 Doctor

Expected functionality:

- Doctor authentication.
- Dashboard.
- Appointment viewing.
- Authorized patient-record access.
- Consultation information entry.
- Diagnosis entry.
- Prescription entry.
- Relevant medical-history review.

## 5.3 Receptionist

Expected functionality:

- Receptionist authentication.
- Appointment creation.
- Appointment scheduling.
- Cancellation/rescheduling.
- Patient-doctor appointment coordination.
- Operational dashboard.
- Restricted access to sensitive clinical information.

---

# 6. CORE DESIGN PRINCIPLE

Unimedi should remain **patient-centric**, not merely hospital-centric.

The system should follow:

> **Least privilege + explicit authorization + centralized records + transparent access + modular architecture**

A role should receive only the data and actions required for that role.

---

# 7. HIGH-LEVEL SYSTEM ARCHITECTURE

The intended architecture is:

```text
                    ┌──────────────────────┐
                    │      Unimedi UI      │
                    │      Next.js         │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Application / API    │
                    │ Business Logic       │
                    │ Next.js / Node.js    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        Authentication    Authorization     Workflows
        Supabase Auth     Role/Permission   Appointments
                                           Medical Records
              │
              ▼
       ┌──────────────────────┐
       │       Supabase       │
       │      PostgreSQL      │
       └──────────────────────┘
```

Future AI functionality can sit as an additional service layer:

```text
User
  ↓
Permission Check
  ↓
Authorized Data Retrieval
  ↓
Retrieval / ML / RAG
  ↓
AI/LLM Processing
  ↓
Grounded Assistive Response
```

---

# 8. TECHNOLOGY STACK

## 8.1 Frontend

**Confirmed/project direction:**

- Next.js
- JavaScript / TypeScript
- Tailwind CSS
- Responsive web interface

## 8.2 Backend

Project direction:

- Next.js API/server-side functionality
- Node.js ecosystem
- Server-side business logic

## 8.3 Database

**Supabase PostgreSQL**

Supabase is intended to provide:

- PostgreSQL database.
- Authentication.
- Database access.
- Row-level security where configured.
- Cloud-hosted persistence.

## 8.4 Authentication

Project direction:

- Supabase Authentication.
- OTP-based verification where applicable.
- PIN/password-style subsequent authentication.
- Role-based authorization.

## 8.5 Version Control

- Git
- GitHub

## 8.6 Deployment

- Vercel

## 8.7 Future AI/ML

Potential future technologies:

- Python
- Scikit-learn
- LLM APIs
- RAG
- Vector databases
- Embedding models
- Healthcare information retrieval

These are **future/possible technologies**, not automatically confirmed as implemented.

---

# 9. DATABASE / SCHEMA CONTEXT

## 9.1 Important instruction

The exact live Supabase schema was **not provided in the available project files during creation of this handoff**.

Therefore, the following is the **logical schema expected/required by the project**, not a claim that every table/column currently exists.

Before modifying the database, inspect the actual Supabase schema and reconcile it with this logical model.

---

## 9.2 Logical Entity Model

```text
users
  │
  ├──────────────► patient_profile
  │
  ├──────────────► doctor_profile
  │
  └──────────────► receptionist_profile

patient
  │
  ├──────────────► medical_records
  ├──────────────► prescriptions
  ├──────────────► reports
  ├──────────────► appointments
  ├──────────────► access_permissions
  ├──────────────► notifications
  └──────────────► access_logs

doctor
  │
  ├──────────────► appointments
  ├──────────────► prescriptions
  ├──────────────► medical_records
  └──────────────► access_requests/permissions

receptionist
  │
  └──────────────► appointments
```

---

## 9.3 Expected Logical Tables

### `users`

Purpose: common identity/account information.

Conceptual fields:

```text
id
email
role
created_at
updated_at
```

Role values conceptually include:

```text
patient
doctor
receptionist
```

**Do not create these columns blindly. Verify the actual schema first.**

---

### `patient_profiles`

Purpose: patient-specific information.

Potential fields:

```text
id
user_id
name
date_of_birth
gender
phone
address
created_at
updated_at
```

---

### `doctor_profiles`

Purpose: doctor-specific information.

Potential fields:

```text
id
user_id
name
specialization
license/registration information
contact information
created_at
updated_at
```

---

### `receptionist_profiles`

Purpose: receptionist-specific information.

Potential fields:

```text
id
user_id
name
contact information
created_at
updated_at
```

---

### `medical_records`

Purpose: patient medical history.

Potential logical fields:

```text
id
patient_id
doctor_id
visit_date
diagnosis
symptoms
notes
treatment
created_at
updated_at
```

---

### `prescriptions`

Purpose: medicine/prescription information.

Potential logical fields:

```text
id
patient_id
doctor_id
medical_record_id
medicine
dosage
frequency
duration
instructions
created_at
```

---

### `reports`

Purpose: diagnostic/test reports.

Potential logical fields:

```text
id
patient_id
record_type
title
description
file_reference
report_date
created_at
```

---

### `appointments`

Purpose: appointment scheduling.

Potential logical fields:

```text
id
patient_id
doctor_id
receptionist_id
appointment_date
appointment_time
status
reason
created_at
updated_at
```

Possible status values:

```text
pending
confirmed
completed
cancelled
rescheduled
```

---

### `access_permissions`

Purpose: control doctor access to patient data.

Potential logical fields:

```text
id
patient_id
doctor_id
permission_type
status
granted_at
expires_at
created_at
```

---

### `notifications`

Purpose: notify users about relevant system activity.

Potential logical fields:

```text
id
user_id
type
title
message
is_read
created_at
```

---

### `access_logs`

Purpose: transparency/auditing.

Potential logical fields:

```text
id
patient_id
accessed_by
access_type
resource_type
resource_id
timestamp
```

---

# 10. DATABASE RELATIONSHIPS

The intended logical relationships are:

```text
users 1 ─── 1 patient_profiles
users 1 ─── 1 doctor_profiles
users 1 ─── 1 receptionist_profiles

patient 1 ─── N medical_records
doctor  1 ─── N medical_records

patient 1 ─── N appointments
doctor  1 ─── N appointments
receptionist 1 ─── N appointments

patient 1 ─── N prescriptions
doctor  1 ─── N prescriptions

patient 1 ─── N reports

patient 1 ─── N access_permissions
doctor  1 ─── N access_permissions

patient 1 ─── N notifications
patient 1 ─── N access_logs
```

Again, these represent the **intended logical relationships**, not verified production schema.

---

# 11. AUTHENTICATION FLOW

Expected flow:

```text
Registration
    ↓
Identity / account information
    ↓
OTP verification where applicable
    ↓
Profile + role creation
    ↓
Login
    ↓
Session validation
    ↓
Role identification
    ↓
Role-specific dashboard
```

Subsequent login can use the project's selected secure authentication mechanism, including PIN/password where implemented.

### Important security rule

Authentication and authorization are different.

```text
Authentication = Who is the user?
Authorization  = What is the user allowed to access?
```

Both must be enforced.

---

# 12. ROLE-BASED AUTHORIZATION

## Patient

Can:

- Read own records.
- Manage own profile.
- View own appointments.
- Control/approve defined doctor access.
- View prescriptions/reports.
- Receive relevant notifications.

Should not:

- Modify another patient's information.
- Access doctor-only administration.
- Access receptionist operations.

## Doctor

Can:

- View assigned appointments.
- Access authorized patient records.
- Create/update appropriate consultation records.
- Create prescriptions.

Should not:

- Access every patient's data automatically.
- Access receptionist-only operations.
- Bypass patient permission mechanisms where such permission is part of the workflow.

## Receptionist

Can:

- Create/manage appointments.
- Coordinate schedules.
- Access operational patient information required for scheduling.

Should not:

- Read sensitive clinical records unnecessarily.
- Modify clinical diagnoses/prescriptions.

---

# 13. MEDICAL RECORD ACCESS WORKFLOW

Intended workflow:

```text
Doctor selects patient
        ↓
System checks authorization
        ↓
Authorized?
   ┌────┴────┐
   │         │
  YES        NO
   │         │
   ▼         ▼
Show       Request /
allowed    deny access
records
   │
   ▼
Log relevant access
   │
   ▼
Notify patient where configured
```

The exact implementation must follow the actual application logic.

---

# 14. APPOINTMENT WORKFLOW

Conceptual workflow:

```text
Patient
   ↓
Appointment request
   ↓
Receptionist / scheduling workflow
   ↓
Doctor availability
   ↓
Appointment confirmation
   ↓
Patient + Doctor dashboards
   ↓
Consultation
   ↓
Medical record / prescription update
```

---

# 15. DASHBOARD STRUCTURE

## Patient Dashboard

Previously established direction includes:

- Welcome/header area.
- Medical history.
- Upcoming appointments.
- Prescriptions.
- Insurance.
- Healthcare/AI tools.
- Profile/security settings.

## Doctor Dashboard

Expected:

- Today's/upcoming appointments.
- Patient list relevant to the doctor.
- Authorized medical history.
- Consultation workflow.
- Prescription entry.
- Doctor profile.

## Receptionist Dashboard

Expected:

- Appointment calendar.
- Booking.
- Cancellation.
- Rescheduling.
- Patient appointment lookup.
- Doctor availability.

---

# 16. UI/UX DIRECTION

The project direction is:

- Clean.
- Modern.
- Card-based.
- Responsive.
- Simple navigation.
- Role-specific dashboards.
- Avoid information overload.
- Use clear healthcare-oriented terminology.
- Keep sensitive data visually separated from general account information.

Do not redesign the entire UI when implementing a small feature.

---

# 17. NOTIFICATIONS

Intended notification cases include:

- Record access.
- Record modification.
- Appointment confirmation.
- Appointment changes.
- Important account activity.

The notification system should be designed so users can distinguish:

```text
Informational
Appointment
Security / Access
Medical-record activity
```

---

# 18. INTELLIGENT ASSISTANCE

Discussed/planned modules include:

### Doctor Recommendation

Possible factors:

- Specialization.
- User requirement.
- Location/context.
- Availability.

### Medicine Information

Possible assistance:

- Medicine information.
- Usage information.
- Common side-effect information.
- Prescription interpretation assistance.

### Insurance Assistance

Potential future module:

- Compare/recommend relevant insurance options.
- Explain basic coverage concepts.

### AI/LLM/RAG

Future architecture:

```text
User Query
   ↓
Authentication
   ↓
Authorization
   ↓
Retrieve only permitted data
   ↓
Knowledge/Data Retrieval
   ↓
LLM
   ↓
Grounded response
   ↓
User
```

AI should never be allowed to bypass record permissions.

---

# 19. CURRENT PROJECT PROGRESS — 7 WEEKS

## Week 1 — Project Ideation & Workflow Drafting

### Discussed
- Healthcare record-management issues.
- Need for centralized digital medical records.
- Patient/Doctor/Receptionist roles.
- Appointment and record workflow.
- Initial project scope.

### Task Given
Design the complete project workflow on **Eraser** and prepare the requirement list.

---

## Week 2 — Requirement Finalization & Existing System Study

### Discussed
- Project objectives.
- Existing healthcare record systems.
- Hospital management applications.
- Limitations of manual/fragmented systems.
- Secure digital access.

### Task Given
Research similar systems and prepare comparative notes.

---

## Week 3 — Architecture Design & Module Planning

### Discussed
- Overall architecture.
- Frontend/backend technology selection.
- Module division.
- Database schema planning.
- Navigation/screen flow.

### Task Given
Prepare architecture diagram and finalize modules.

---

## Week 4 — Authentication, Security & UI Planning

### Discussed
- Login/signup.
- OTP/PIN authentication.
- Role-based permissions.
- Patient-record privacy.
- Dashboard/UI planning.

### Task Given
Design authentication flow and UI wireframes.

---

## Week 5 — Frontend Development & Dashboard Implementation

### Discussed
- Dashboard implementation.
- Patient dashboard.
- Doctor dashboard.
- Receptionist panel.
- Routing/navigation.
- Appointment and record forms.
- Responsive UI.

### Task Given
Complete core frontend pages and test navigation.

---

## Week 6 — Database Integration & Functional Modules

### Discussed
- Database connection.
- User data storage.
- Medical records.
- Appointment linkage.
- CRUD operations.

### Task Given
Integrate backend/database functionality with frontend modules.

---

## Week 7 — Enhancements, Testing & Final Review

### Discussed
- Intelligent assistance concepts.
- Insurance assistance.
- Medicine information.
- Doctor recommendation.
- Bug fixing.
- Optimization.
- Documentation.
- Future scope.

### Task Given
Finalize testing, documentation, and presentation material.

---

# 20. CURRENT STATUS

The project should be treated as an **MVP/integration-stage project**, not a fully production-ready healthcare platform.

### Established / discussed

- Project concept.
- Requirements.
- Eraser workflow.
- Architecture direction.
- Technology stack.
- User roles.
- Authentication direction.
- Dashboard structure.
- Supabase direction.
- Database integration direction.
- Appointment workflow.
- Medical-record workflow.
- Access-control concept.
- Notification concept.
- Intelligent-assistance roadmap.
- Vercel deployment direction.

### Previously encountered development issue

A duplicate email/authentication database issue was encountered with:

```text
users_email_key
```

This indicates duplicate-user handling and database constraints were being tested.

Do not assume the issue is still present without checking the current project.

---

# 21. IMPLEMENTATION STATUS MATRIX

| Area | Status | Notes |
|---|---|---|
| Project concept | COMPLETE | Established |
| Requirements | COMPLETE | Established |
| Eraser workflow | PLANNED/CREATED | Workflow design task |
| Architecture | ESTABLISHED | Modular full-stack direction |
| Next.js | ESTABLISHED | Frontend/application framework |
| Supabase | ESTABLISHED | Database/auth direction |
| Vercel | ESTABLISHED | Deployment direction |
| Patient dashboard | PARTIALLY IMPLEMENTED/DESIGNED | Verify current repository |
| Doctor dashboard | PLANNED/IN DEVELOPMENT | Verify repository |
| Receptionist dashboard | PLANNED/IN DEVELOPMENT | Verify repository |
| Authentication | INTEGRATION | Verify actual current flow |
| Database schema | NEEDS VERIFICATION | Logical model documented below |
| Medical records | INTEGRATION | Verify current CRUD |
| Appointments | INTEGRATION | Verify current CRUD |
| Access permissions | PLANNED/INTEGRATION | Verify actual implementation |
| Notifications | PLANNED | Verify actual implementation |
| AI assistance | FUTURE/CONCEPTUAL | Do not claim complete |
| LLM/RAG | FUTURE | Architecture discussed |
| Production compliance | NOT COMPLETE | Outside MVP |

---

# 22. PROJECT DEPENDENCIES

Unimedi depends on several components that are not themselves the primary project feature but are essential to operation.

## Required dependencies

```text
Next.js
   ↓
Frontend + server/application logic

Supabase
   ↓
PostgreSQL + authentication + cloud backend

Vercel
   ↓
Deployment/hosting

GitHub
   ↓
Version control/source management
```

## Future dependencies

Potentially:

```text
LLM provider
Embedding model
Vector database
External healthcare knowledge source
OTP provider
Notification provider
```

Do not add these unless the corresponding feature is actually required.

---

# 23. ENVIRONMENT VARIABLES

Never expose secrets in source code.

Expected categories may include:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

**Important:**

- Only use variables that actually exist in the current project.
- Never place service-role/private keys in browser/client code.
- Never commit `.env.local`.
- Never put API keys in GitHub.
- Verify the actual `.env` requirements before changing deployment configuration.

---

# 24. FOLDER / FILE STRUCTURE

The exact current repository tree was not available in the project files used to create this document.

Therefore, **do not assume a specific file path** such as:

```text
app/patient/dashboard/page.tsx
```

unless it is verified in the actual repository.

When continuing development:

1. Inspect the repository.
2. Identify the actual Next.js routing structure.
3. Identify components.
4. Identify Supabase utilities.
5. Identify API/server actions.
6. Identify authentication middleware.
7. Identify database-related files.
8. Then make changes.

Do not create duplicate files merely because a similar path is suggested in this document.

---

# 25. KNOWN DEVELOPMENT RISKS

## Authentication

Potential issues:

- Duplicate users.
- Session handling.
- Incorrect role assignment.
- OTP provider limitations.
- Authentication state inconsistencies.

## Database

Potential issues:

- Incorrect relationships.
- Duplicate records.
- Missing constraints.
- Incorrect RLS.
- Frontend assuming a different schema than the database.

## Security

Potential issues:

- Frontend-only authorization.
- Exposed Supabase service-role credentials.
- Overly broad database policies.
- Unauthorized record access.
- Missing audit logs.

## Deployment

Potential issues:

- Missing Vercel environment variables.
- Server/client environment-variable mistakes.
- Serverless limitations.
- Supabase connectivity.
- Build failures.

## AI

Potential issues:

- Hallucinations.
- Unsupported medical claims.
- Sensitive-data exposure.
- Poor retrieval quality.
- Lack of source grounding.
- Treating AI output as diagnosis.

---

# 26. SECURITY REQUIREMENTS

These are mandatory principles for future development:

### Never

- Trust a user-provided role without server-side verification.
- Expose service-role keys client-side.
- Allow unrestricted patient-record queries.
- Assume hiding a button equals authorization.
- Send sensitive patient information to an external AI provider without an appropriate privacy architecture.
- Treat AI output as a medical diagnosis.

### Always

- Validate authentication server-side.
- Validate authorization server-side.
- Apply least privilege.
- Use RLS where appropriate.
- Validate input.
- Sanitize/validate uploaded content.
- Keep secrets server-side.
- Log security-sensitive operations where appropriate.

---

# 27. PROJECT SCOPE

## Included

- User authentication.
- Role-based access.
- Patient dashboard.
- Doctor dashboard.
- Receptionist workflow.
- Medical records.
- Prescriptions.
- Reports/history.
- Appointment management.
- Permission-controlled doctor access.
- Notifications/access transparency.
- Responsive web interface.
- Supabase integration.
- Vercel deployment.

## Outside MVP

- National healthcare interoperability.
- Full government health-system integration.
- Real-time Aadhaar/UIDAI integration unless officially implemented.
- Direct integration with every hospital.
- Autonomous medical diagnosis.
- Fully automated clinical decisions.
- Full insurance purchasing/claims ecosystem.
- Production regulatory certification.
- National-scale healthcare deployment.

---

# 28. FUTURE WORK

## Phase 1 — MVP Completion

- Finish authentication.
- Verify database schema.
- Complete dashboards.
- Complete appointments.
- Complete medical-record CRUD.
- Complete role permissions.
- Add notifications.
- Test end-to-end flows.

## Phase 2 — Security

- Audit logging.
- Fine-grained permissions.
- MFA.
- Session/device management.
- Encryption improvements.
- Security testing.

## Phase 3 — Interoperability

- Hospital integrations.
- Laboratory integrations.
- Pharmacy integrations.
- Standardized healthcare data exchange.

## Phase 4 — AI

- Medicine information assistant.
- Doctor recommendation.
- Medical-record summarization.
- Patient-history analysis.
- Healthcare knowledge assistant.
- RAG-based authorized record querying.

## Phase 5 — Scale

- Caching.
- Background jobs.
- Monitoring.
- Backups.
- Disaster recovery.
- Performance optimization.
- Multi-institution architecture.

---

# 29. MVP DEFINITION OF DONE

Unimedi MVP should be considered functionally complete when:

- [ ] Patient can register/login.
- [ ] Doctor can register/login.
- [ ] Receptionist can login.
- [ ] Roles are correctly enforced.
- [ ] Patient can view/manage own profile.
- [ ] Patient can view medical records.
- [ ] Doctor can access authorized patient records.
- [ ] Doctor can add appropriate consultation information.
- [ ] Doctor can create prescriptions.
- [ ] Receptionist can manage appointments.
- [ ] Patient can view appointments.
- [ ] Doctor can view appointments.
- [ ] Access activity is appropriately logged/notified.
- [ ] Core data persists correctly in Supabase.
- [ ] No secrets are exposed.
- [ ] Main workflows work end-to-end.
- [ ] Production deployment can build successfully.

---

# 30. POSITIVE PROMPT FOR AN AI CODING AGENT

Use this prompt when transferring Unimedi to another AI:

> You are continuing development of Unimedi, an existing full-stack patient-centric healthcare management platform. Do not treat this as a greenfield project.
>
> First inspect the existing repository, database-related code, authentication implementation, routes, components, and configuration. Compare the actual implementation against this handoff document before making changes.
>
> Preserve working functionality and existing architectural decisions. Use Next.js, Supabase/PostgreSQL, the existing authentication system, and the existing UI architecture unless the repository demonstrates a concrete reason to change them.
>
> Treat patients, doctors, and receptionists as separate roles with separate permissions. Medical records are sensitive data. Authorization must be enforced server-side and, where applicable, through database Row Level Security.
>
> Before modifying the database, inspect the actual schema and relationships. Never assume the logical schema in this document is identical to the live database.
>
> Before modifying authentication, inspect the existing session, user, role, and Supabase-authentication flow.
>
> Before creating a new page/component/API endpoint, inspect whether an equivalent already exists.
>
> Make the smallest safe change necessary. Preserve existing UI and workflows unless the requested change requires modification.
>
> Clearly identify whether each feature is:
> - implemented,
> - partially implemented,
> - planned,
> - or future.
>
> Never claim that a feature works unless it has been verified.
>
> For AI/LLM/RAG functionality, enforce authorization before retrieval and treat generated responses as assistive information rather than medical diagnosis.
>
> Prefer maintainability, security, consistency, and correctness over unnecessary complexity.

---

# 31. NEGATIVE PROMPT FOR AN AI CODING AGENT

> Do NOT rebuild Unimedi from scratch.
>
> Do NOT replace Next.js, Supabase, PostgreSQL, or Vercel without a demonstrated technical requirement.
>
> Do NOT invent a new database schema without inspecting the current database.
>
> Do NOT rename existing tables/columns simply to match this document's logical schema.
>
> Do NOT delete existing working functionality.
>
> Do NOT create duplicate dashboards, duplicate authentication systems, or duplicate API routes.
>
> Do NOT assume that a feature discussed in the project is already implemented.
>
> Do NOT claim Aadhaar/UIDAI integration, hospital integration, regulatory certification, AI diagnosis, production-scale interoperability, or complete RAG functionality unless it has actually been implemented and verified.
>
> Do NOT expose secrets, service-role keys, private API keys, or credentials in client-side code.
>
> Do NOT rely only on frontend checks for authorization.
>
> Do NOT allow a doctor or other role to bypass patient-record permissions.
>
> Do NOT send private medical information to an external AI service without an explicit privacy/security architecture.
>
> Do NOT present AI output as a medical diagnosis.
>
> Do NOT introduce unnecessary dependencies.
>
> Do NOT over-engineer the MVP.
>
> Do NOT modify the database without considering existing relationships and data.
>
> Do NOT use fake implementation results as evidence that functionality works.
>
> If the repository contradicts this document, inspect the repository and treat the actual verified implementation as authoritative; then update this document's project status rather than silently assuming either source is correct.

---

# 32. TEMPERATURE GUIDANCE

Use lower temperature when consistency and correctness are important.

| Task | Recommended Temperature |
|---|---:|
| Database/schema work | 0.1–0.2 |
| Authentication/security | 0.1–0.2 |
| Debugging | 0.1–0.2 |
| API implementation | 0.1–0.25 |
| General feature development | 0.2–0.35 |
| UI implementation | 0.25–0.4 |
| UI alternatives | 0.4–0.6 |
| Brainstorming/future features | 0.5–0.7 |

**Default Unimedi coding temperature:** approximately **0.2–0.3**.

---

# 33. DEVELOPMENT PRIORITY

When resuming development:

```text
1. Inspect repository
       ↓
2. Inspect package.json
       ↓
3. Inspect Next.js structure
       ↓
4. Inspect Supabase integration
       ↓
5. Inspect actual database schema
       ↓
6. Inspect authentication
       ↓
7. Inspect role handling
       ↓
8. Inspect dashboards
       ↓
9. Inspect appointment workflow
       ↓
10. Inspect medical-record workflow
       ↓
11. Fix security/authorization
       ↓
12. Test end-to-end workflows
       ↓
13. Deploy/validate MVP
       ↓
14. Add advanced AI features
```

---

# 34. REPOSITORY INSPECTION CHECKLIST

Before making significant changes, an AI developer should inspect:

```text
[ ] package.json
[ ] package-lock.json / equivalent
[ ] Next.js app/pages structure
[ ] components/
[ ] lib/
[ ] utils/
[ ] API routes / server actions
[ ] middleware
[ ] Supabase client
[ ] Supabase server client
[ ] authentication code
[ ] role logic
[ ] database queries
[ ] SQL migrations
[ ] RLS policies
[ ] .env.example
[ ] README
[ ] current dashboard pages
[ ] current forms
[ ] current deployment configuration
```

Never request or expose actual `.env.local` secrets as project context.

---

# 35. HOW TO UPDATE THIS FILE

When development progresses, update the relevant section.

Use these labels:

```text
[IMPLEMENTED]
[PARTIALLY IMPLEMENTED]
[IN PROGRESS]
[PLANNED]
[FUTURE]
[BLOCKED]
[NEEDS VERIFICATION]
```

For every important feature, record:

```text
Feature:
Status:
Files:
Database tables:
API:
Authentication:
Authorization:
Known issues:
Next step:
```

This prevents future AI sessions from confusing discussion with implementation.

---

# 36. SOURCE-OF-TRUTH HIERARCHY

When different information conflicts, use this order:

```text
1. Verified current repository implementation
2. Verified live database/schema
3. Current project configuration
4. This unimedi.md handoff
5. Older conversation/project discussions
6. Assumptions
```

Never use an assumption as evidence that a feature exists.

---

# 37. FINAL PROJECT CONTEXT

Unimedi is a healthcare management MVP focused on **secure, centralized, patient-centric healthcare information and workflows**.

The core system consists of:

```text
Patient
Doctor
Receptionist
      ↓
Role-based dashboards
      ↓
Authentication + Authorization
      ↓
Medical Records
Appointments
Prescriptions
Reports
Notifications
Access Control
      ↓
Supabase / PostgreSQL
      ↓
Next.js application
      ↓
Vercel deployment
```

The most important next development objective is **not adding more features blindly**. It is to verify and stabilize the existing implementation, especially:

- Actual database schema.
- Authentication.
- Role-based authorization.
- Patient dashboard.
- Doctor workflow.
- Receptionist workflow.
- Medical-record CRUD.
- Appointment CRUD.
- Access permissions.
- Notifications.
- End-to-end security.

Advanced AI/LLM/RAG functionality should come after the core MVP is stable.

---

# 38. HANDOFF INSTRUCTION

If this file is supplied to a new AI, the AI should begin with:

> **"Inspect the existing Unimedi repository and reconcile it with `unimedi.md`. Do not start coding until you understand the current architecture, database schema, authentication flow, role permissions, and existing dashboard structure. Report discrepancies between the repository and this document before making architectural changes."**

That instruction is intentionally placed at the end because it is the recommended entry point for future AI development.
