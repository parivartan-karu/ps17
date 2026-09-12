# 🎬 Judge Presentation & Demo Walkthrough Guide — Parivartan (PS17)

## 1. 3-Minute Hackathon Pitch Script

### ⏱️ Minute 0:00 - 0:45: The Problem & The AI Classification Agent
1. Open the **Citizen Portal** (`/citizen/dashboard`).
2. Click **Report a Problem** (`/citizen/report`).
3. Type or speak a real-world municipal issue (e.g., *"Large pothole on Karve Road near Nal Stop with exposed water pipeline causing traffic backlog"*).
4. Click **Analyze & Submit**. Show how the **Google Gemini AI Agent**:
   - Classifies the exact department (`Engineering / Road Maintenance`).
   - Calculates urgency score (`8/10`) and assigns priority (`High`).
   - Sets a dynamic SLA resolution deadline (`12 Hours`).

---

### ⏱️ Minute 0:45 - 1:45: Department Head Dispatch & Worker SLA Roster
1. Switch to the **Department Head Portal** (`/dept/workers`).
2. Show the **{Dept} Worker Performance Roster** displaying active workload, available dispatch slots, and on-time SLA rate.
3. Open the **Add Field Worker** modal. Show how skill categories and designations are **strictly filtered to the active department** (e.g., Garbage Truck Driver for Garbage, Asphalt Worker for Road Maintenance).
4. Go to `/smc/complaints`, select the new complaint, and assign it to an available field worker.

---

### ⏱️ Minute 1:45 - 2:30: SLA Breach Escalation & SMS Reminders
1. Explain the **6-Hour Pre-Breach SMS Reminder** sent to field workers via Twilio.
2. Trigger the SLA Monitor Cron (`/api/cron/sla-monitor`) or demonstrate an overdue task:
   - Highlight the **SLA Overdue Warning Banner** on the worker roster.
   - Show **Level 1 Escalation** notification to Department Head.
   - Show **Level 2 Auto-Escalation** flag to SMC Central Admin.

---

### ⏱️ Minute 2:30 - 3:00: Executive Analytics & City-Wide Heatmap
1. Open the **SMC Central Admin Analytics Dashboard** (`/smc/analytics`).
2. Show:
   - **Department SLA Performance Scorecard Table** with health status badges (`Optimal`, `At Risk`, `Critical SLA Breach`).
   - **SLA Compliance % vs. Resolution Rate % Bar Chart**.
   - **Active Backlog vs. Overdue Breaches Bar Chart**.
   - **Interactive City Heatmap** (`/smc/dashboard`).

---

## 🔑 Test User Credentials Matrix

| Persona | Target URL | Credentials / Action |
| :--- | :--- | :--- |
| **Citizen User** | `/citizen/dashboard` | Public Access / Click "Report a Problem" |
| **Department Head (Garbage)** | `/dept/workers` | Auto-detected via Dept Head Login |
| **Field Worker** | `/worker/login` | Worker ID & Auto-generated Password |
| **SMC Central Admin** | `/smc/dashboard` | Municipal Admin Access |

---

## ⚡ 1-Click SLA Breach Simulation Code Snippet (For Live Demo)

If you want to force an immediate SLA breach during your judge presentation without waiting for clock time:

```bash
# Execute SLA Monitor Cron manually via HTTP GET:
curl -H "Authorization: Bearer parivartan_cron_secret_2026_super_secure" http://localhost:3000/api/cron/sla-monitor
```
