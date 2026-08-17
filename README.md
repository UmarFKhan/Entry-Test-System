# Atechabad Testing System (ATS)

Atechabad Testing System (ATS) is a premier, feature-rich Computer-Based Testing (CBT) portal & University Entry Test preparation platform. Built with **Flask**, **SQLite**, **Phusion Passenger WSGI**, and modern **vanilla CSS3/JavaScript** with **Chart.js** integration.

---

## 🌟 Key Features

1. **University Entry Test Guides**:
   - Comprehensive test pattern, subject weightage, time breakdown, and strategy guides for **NUST (NET)**, **FAST-NU**, **ECAT (UET)**, **MDCAT**, **NTS (NAT/GAT)**, **GIKI**, **PIEAS**, **Bahria**, and **Air University**.

2. **Multiple Testing Modes**:
   - **Full CBT Exam Simulator**: 100 MCQs, 120 Minutes official format.
   - **Custom Practice Mode**: Pick question count, set time limit override, and filter by subject sections.
   - **Quiz Madness Mode**: Unlimited exhaustive testing across 100% of question banks with **zero repeats**.

3. **cPanel Phusion Passenger Ready**:
   - Built-in `passenger_wsgi.py` entry point.
   - Designed for subpath hosting e.g., `atechabad.com/ats` or standalone root.

4. **Rich Analytics & Official Transcripts**:
   - Chart.js Visualizations (Accuracy breakdown, Subject section performance, Historical progression).
   - Detailed Question Review with step-by-step explanations.
   - Official Printable Score Transcripts (`/report/<id>`).

---

## 🌐 cPanel Deployment Configuration

In your cPanel **Setup Python App** section, set the following parameters matching your server setup:

| Setting | Value |
| :--- | :--- |
| **Python Version** | `3.11` (or 3.10+) |
| **Application Root** | `atechabad/testingsystem` |
| **Application URL** | `atechabad.com/ats` |
| **Application Startup File** | `passenger_wsgi.py` |
| **Application Entry Point** | `app` |
| **Environment Variable** | `SECRET_KEY` = `atechabad-super-secret-key-2025` |

---

## 📂 Directory Structure

```text
atechabad/testingsystem/
│
├── app.py                  # Flask Application Controller
├── passenger_wsgi.py       # cPanel Phusion Passenger WSGI Entry Point
├── config.py               # App Configuration & Environment Settings
├── question_loader.py      # Question Loader & Randomizer
├── exam_engine.py          # Exam Logic & Evaluation Engine
├── result_engine.py        # Analytics & Metrics Engine
├── storage.py              # SQLite Database Layer
├── requirements.txt        # Python Dependencies
├── README.md               # Quick Start Guide
│
├── questions/              # Question Banks (JSON)
│   ├── english.json
│   ├── maths.json
│   ├── physics.json
│   ├── analytical.json
│   ├── gk.json
│   └── computer.json
│
├── static/
│   ├── css/
│   │   ├── style.css       # Primary Light Theme & Glassmorphism
│   │   └── dark.css        # Dark Mode Overrides
│   ├── js/
│   │   ├── app.js          # Core Exam Client & Hotkeys
│   │   ├── timer.js        # Countdown & Storage Timer
│   │   ├── storage.js      # LocalStorage Manager
│   │   ├── randomizer.js   # Question & Option Shuffler
│   │   ├── charts.js       # Chart.js Visualizer
│   │   └── review.js       # Review Filter Logic
│
├── templates/
│   ├── base.html           # Base Layout & Header Nav
│   ├── home.html           # Dashboard
│   ├── guides.html         # University Entry Test Guides
│   ├── instructions.html   # Exam Instructions
│   ├── exam.html           # CBT Test Interface
│   ├── practice.html       # Custom Practice Configurator
│   ├── madness.html        # Quiz Madness Mode
│   ├── result.html         # Scorecard & Analytics Dashboard
│   ├── review.html         # Answer Review
│   └── report.html         # Official Score Transcript
│
└── database/
    └── scores.db           # SQLite Database Store
```
