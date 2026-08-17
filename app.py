"""
==============================================================================
Atechabad Testing System (ATS) - Consolidated Single Application Controller
All configuration, relational DB storage (MySQL/SQLite), exam engine, question loader,
analytics, guides data, and routes contained in this single primary application file.
==============================================================================
"""

import os
import sys
import json
import random
import time
import traceback
from flask import Flask, render_template, request, jsonify, redirect, url_for, session

# ── 1. CONFIGURATION ────────────────────────────────────────────────────────
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'atechabad-ats-secret-key-2026-entry-test')
    DATABASE_PATH = os.path.join(BASE_DIR, 'database', 'scores.db')
    
    # MySQL / MariaDB Environment Variables (cPanel / phpMyAdmin)
    DB_HOST = os.environ.get('DB_HOST', '')
    DB_USER = os.environ.get('DB_USER', '')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
    DB_NAME = os.environ.get('DB_NAME', '')
    DB_PORT = int(os.environ.get('DB_PORT', 3306))
    
    QUESTIONS_DIR = os.path.join(BASE_DIR, 'questions')
    DEFAULT_EXAM_TIME_MINUTES = 120
    DEFAULT_EXAM_QUESTION_COUNT = 100
    PASSING_PERCENTAGE = 50.0
    NEGATIVE_MARKING_VAL = 0.0

    SUBJECT_FILES = {
        'english': 'english.json',
        'maths': 'maths.json',
        'physics': 'physics.json',
        'analytical': 'analytical.json',
        'gk': 'gk.json',
        'computer': 'computer.json'
    }

app = Flask(__name__)
app.config.from_object(Config)

# ── 2. DATABASE ENGINE (MySQL / SQLite Dual Support) ────────────────────────
try:
    import pymysql
    from pymysql.cursors import DictCursor
    HAS_PYMYSQL = True
except ImportError:
    HAS_PYMYSQL = False

def is_mysql():
    return bool(HAS_PYMYSQL and Config.DB_HOST and Config.DB_USER and Config.DB_NAME)

def get_db_connection():
    if is_mysql():
        return pymysql.connect(
            host=Config.DB_HOST,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            database=Config.DB_NAME,
            port=Config.DB_PORT,
            autocommit=True,
            cursorclass=DictCursor,
            charset='utf8mb4'
        )
    else:
        import sqlite3
        os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)
        conn = sqlite3.connect(Config.DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def q(sql):
    return sql.replace('?', '%s') if is_mysql() else sql

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_mysql():
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS `attempts` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `candidate_name` VARCHAR(255) DEFAULT 'Candidate',
                `candidate_roll` VARCHAR(100) DEFAULT 'ATS-2026-001',
                `total_score` DOUBLE NOT NULL,
                `max_score` INT NOT NULL,
                `percentage` DOUBLE NOT NULL,
                `grade` VARCHAR(10) NOT NULL,
                `pass_status` VARCHAR(20) NOT NULL,
                `time_taken_seconds` INT NOT NULL,
                `correct_count` INT NOT NULL,
                `wrong_count` INT NOT NULL,
                `skipped_count` INT NOT NULL,
                `longest_streak` INT DEFAULT 0,
                `strongest_subject` VARCHAR(255) DEFAULT NULL,
                `weakest_subject` VARCHAR(255) DEFAULT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS `attempt_answers` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `attempt_id` INT NOT NULL,
                `question_id` VARCHAR(100) NOT NULL,
                `question_text` TEXT NOT NULL,
                `subject` VARCHAR(100) NOT NULL,
                `selected_option` TEXT,
                `correct_option` TEXT NOT NULL,
                `is_correct` TINYINT(1) NOT NULL,
                `explanation` TEXT,
                INDEX `idx_attempt_id` (`attempt_id`),
                CONSTRAINT `fk_answers_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS `attempt_section_scores` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `attempt_id` INT NOT NULL,
                `subject` VARCHAR(100) NOT NULL,
                `total_questions` INT NOT NULL,
                `correct_count` INT NOT NULL,
                `wrong_count` INT NOT NULL,
                `percentage` DOUBLE NOT NULL,
                INDEX `idx_sec_attempt_id` (`attempt_id`),
                CONSTRAINT `fk_sections_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS `settings` (
                `setting_key` VARCHAR(100) PRIMARY KEY,
                `setting_value` TEXT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ''')
        defaults = [
            ('theme', 'light'), ('timer_sound', 'true'), ('font_size', 'medium'),
            ('shuffle_questions', 'true'), ('shuffle_options', 'true'), ('auto_submit', 'true')
        ]
        for k, v in defaults:
            cursor.execute(
                "INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES (%s, %s) ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`)",
                (k, v)
            )
    else:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                candidate_name TEXT DEFAULT 'Candidate',
                candidate_roll TEXT DEFAULT 'ATS-2026-001',
                total_score REAL NOT NULL,
                max_score INTEGER NOT NULL,
                percentage REAL NOT NULL,
                grade TEXT NOT NULL,
                pass_status TEXT NOT NULL,
                time_taken_seconds INTEGER NOT NULL,
                correct_count INTEGER NOT NULL,
                wrong_count INTEGER NOT NULL,
                skipped_count INTEGER NOT NULL,
                longest_streak INTEGER DEFAULT 0,
                strongest_subject TEXT,
                weakest_subject TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attempt_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_id INTEGER NOT NULL,
                question_id TEXT NOT NULL,
                question_text TEXT NOT NULL,
                subject TEXT NOT NULL,
                selected_option TEXT,
                correct_option TEXT NOT NULL,
                is_correct INTEGER NOT NULL,
                explanation TEXT,
                FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attempt_section_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_id INTEGER NOT NULL,
                subject TEXT NOT NULL,
                total_questions INTEGER NOT NULL,
                correct_count INTEGER NOT NULL,
                wrong_count INTEGER NOT NULL,
                percentage REAL NOT NULL,
                FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                setting_key TEXT PRIMARY KEY,
                setting_value TEXT NOT NULL
            )
        ''')
        defaults = [
            ('theme', 'light'), ('timer_sound', 'true'), ('font_size', 'medium'),
            ('shuffle_questions', 'true'), ('shuffle_options', 'true'), ('auto_submit', 'true')
        ]
        for k, v in defaults:
            cursor.execute(
                "INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)",
                (k, v)
            )
        conn.commit()
    conn.close()

init_db()

# ── Relational Storage Queries ──────────────────────────────────────────────
def save_attempt(attempt_data):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Insert main attempt row
    sql_attempt = '''
        INSERT INTO attempts (
            candidate_name, candidate_roll, total_score, max_score, percentage,
            grade, pass_status, time_taken_seconds, correct_count, wrong_count,
            skipped_count, longest_streak, strongest_subject, weakest_subject
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''
    params_attempt = (
        attempt_data.get('candidate_name', 'Candidate'),
        attempt_data.get('candidate_roll', 'ATS-2026-001'),
        attempt_data['total_score'],
        attempt_data['max_score'],
        attempt_data['percentage'],
        attempt_data['grade'],
        attempt_data['pass_status'],
        attempt_data['time_taken_seconds'],
        attempt_data['correct_count'],
        attempt_data['wrong_count'],
        attempt_data['skipped_count'],
        attempt_data.get('longest_streak', 0),
        attempt_data.get('strongest_subject', ''),
        attempt_data.get('weakest_subject', '')
    )
    cursor.execute(q(sql_attempt), params_attempt)
    attempt_id = cursor.lastrowid

    # 2. Insert relational answers
    sql_ans = '''
        INSERT INTO attempt_answers (
            attempt_id, question_id, question_text, subject,
            selected_option, correct_option, is_correct, explanation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    '''
    for ans in attempt_data.get('detailed_answers', []):
        cursor.execute(q(sql_ans), (
            attempt_id,
            str(ans.get('id', '')),
            ans.get('question', ''),
            ans.get('subject', 'General'),
            ans.get('user_answer', ''),
            ans.get('correct_answer', ''),
            1 if ans.get('is_correct') else 0,
            ans.get('explanation', '')
        ))

    # 3. Insert relational section scores
    sql_sec = '''
        INSERT INTO attempt_section_scores (
            attempt_id, subject, total_questions, correct_count, wrong_count, percentage
        ) VALUES (?, ?, ?, ?, ?, ?)
    '''
    for subj, sdata in attempt_data.get('section_scores', {}).items():
        cursor.execute(q(sql_sec), (
            attempt_id,
            subj,
            sdata.get('total', 0),
            sdata.get('correct', 0),
            sdata.get('wrong', 0),
            sdata.get('percentage', 0.0)
        ))

    if not is_mysql():
        conn.commit()
    conn.close()
    return attempt_id

def format_created_at(val):
    if not val:
        return ""
    if hasattr(val, 'strftime'):
        return val.strftime('%Y-%m-%d %H:%M:%S')
    return str(val)[:19]

def get_attempt_by_id(attempt_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(q('SELECT * FROM attempts WHERE id = ?'), (attempt_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
        
    data = dict(row)
    data['created_at'] = format_created_at(data.get('created_at'))
    
    # Fetch relational answers
    cursor.execute(q('SELECT * FROM attempt_answers WHERE attempt_id = ?'), (attempt_id,))
    ans_rows = cursor.fetchall()
    detailed_answers = []
    for ar in ans_rows:
        ard = dict(ar)
        detailed_answers.append({
            'id': ard['question_id'],
            'question': ard['question_text'],
            'subject': ard['subject'],
            'user_answer': ard['selected_option'],
            'correct_answer': ard['correct_option'],
            'is_correct': bool(ard['is_correct']),
            'explanation': ard.get('explanation', '')
        })
    data['detailed_answers'] = detailed_answers

    # Fetch relational section scores
    cursor.execute(q('SELECT * FROM attempt_section_scores WHERE attempt_id = ?'), (attempt_id,))
    sec_rows = cursor.fetchall()
    section_scores = {}
    for sr in sec_rows:
        srd = dict(sr)
        section_scores[srd['subject']] = {
            'total': srd['total_questions'],
            'correct': srd['correct_count'],
            'wrong': srd['wrong_count'],
            'percentage': srd['percentage']
        }
    data['section_scores'] = section_scores
    data['difficulty_scores'] = {}
    conn.close()
    return data

def get_all_attempts(limit=50):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(q('SELECT * FROM attempts ORDER BY created_at DESC LIMIT ?'), (limit,))
    rows = cursor.fetchall()
    attempts = []
    for r in rows:
        d = dict(r)
        d['created_at'] = format_created_at(d.get('created_at'))
        d['section_scores'] = {}
        d['detailed_answers'] = []
        attempts.append(d)
    conn.close()
    return attempts

def get_settings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(q('SELECT setting_key, setting_value FROM settings'))
    rows = cursor.fetchall()
    conn.close()
    return {r['setting_key']: r['setting_value'] for r in rows}

def get_high_score_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as total_attempts, MAX(percentage) as top_percentage, AVG(percentage) as avg_percentage, MIN(time_taken_seconds) as best_time FROM attempts')
    summary = cursor.fetchone()
    conn.close()
    total = summary['total_attempts'] or 0 if summary else 0
    top_pct = float(summary['top_percentage']) if summary and summary['top_percentage'] is not None else 0.0
    avg_pct = float(summary['avg_percentage']) if summary and summary['avg_percentage'] is not None else 0.0
    best_t = int(summary['best_time']) if summary and summary['best_time'] is not None else 0
    return {
        'total_attempts': total,
        'top_percentage': round(top_pct, 1),
        'avg_percentage': round(avg_pct, 1),
        'best_time': best_t
    }

# ── 3. QUESTION LOADER & RANDOMIZER ──────────────────────────────────────────
def load_json_file(filepath):
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def load_all_question_banks():
    all_q = []
    for subj_key, filename in Config.SUBJECT_FILES.items():
        fp = os.path.join(Config.QUESTIONS_DIR, filename)
        qlist = load_json_file(fp)
        for qitem in qlist:
            if 'subject' not in qitem:
                qitem['subject'] = qitem.get('section', subj_key.capitalize())
            ans = qitem.get('answer') or qitem.get('correct_answer') or qitem.get('correct_option') or ''
            qitem['answer'] = ans
            qitem['correct_answer'] = ans
            all_q.append(qitem)
    return all_q

def shuffle_options_for_question(question):
    q_copy = dict(question)
    opts = list(q_copy.get('options', []))
    random.shuffle(opts)
    q_copy['options'] = opts
    return q_copy

def prepare_exam_questions(count=100, shuffle=True):
    all_questions = load_all_question_banks()
    if not all_questions:
        return []
    if shuffle:
        random.shuffle(all_questions)
    selected = all_questions[:count]
    processed = []
    for qitem in selected:
        processed.append(shuffle_options_for_question(qitem) if shuffle else qitem)
    return processed

def prepare_custom_exam_questions(count=30, subjects=None, shuffle=True):
    all_questions = load_all_question_banks()
    if subjects:
        subj_lower = [s.lower() for s in subjects]
        all_questions = [q for q in all_questions if q.get('subject', '').lower() in subj_lower]
    if not all_questions:
        return []
    if shuffle:
        random.shuffle(all_questions)
    selected = all_questions[:count]
    processed = []
    for qitem in selected:
        processed.append(shuffle_options_for_question(qitem) if shuffle else qitem)
    return processed

def prepare_madness_questions():
    all_questions = load_all_question_banks()
    random.shuffle(all_questions)
    processed = [shuffle_options_for_question(q) for q in all_questions]
    return processed

# ── 4. EXAM ENGINE EVALUATION ────────────────────────────────────────────────
def evaluate_exam_submission(answers_dict, question_pool, time_taken=0, candidate_name="Candidate", candidate_roll="ATS-2026-001"):
    total_questions = len(question_pool)
    correct_count = 0
    wrong_count = 0
    skipped_count = 0
    total_score = 0.0
    max_score = total_questions
    detailed_answers = []
    section_scores = {}
    longest_streak = 0
    current_streak = 0

    for qitem in question_pool:
        q_id = str(qitem['id'])
        subj = qitem.get('subject', 'General')
        user_ans = answers_dict.get(q_id, None)
        correct_ans = qitem.get('correct_answer') or qitem.get('answer') or qitem.get('correct_option') or ''
        
        if subj not in section_scores:
            section_scores[subj] = {'total': 0, 'correct': 0, 'wrong': 0, 'skipped': 0, 'score': 0.0}
        section_scores[subj]['total'] += 1

        is_correct = False
        if user_ans is None or user_ans == '':
            skipped_count += 1
            section_scores[subj]['skipped'] += 1
            current_streak = 0
        elif str(user_ans).strip().lower() == str(correct_ans).strip().lower():
            correct_count += 1
            total_score += 1.0
            section_scores[subj]['correct'] += 1
            section_scores[subj]['score'] += 1.0
            is_correct = True
            current_streak += 1
            if current_streak > longest_streak:
                longest_streak = current_streak
        else:
            wrong_count += 1
            total_score -= Config.NEGATIVE_MARKING_VAL
            section_scores[subj]['wrong'] += 1
            section_scores[subj]['score'] -= Config.NEGATIVE_MARKING_VAL
            current_streak = 0

        detailed_answers.append({
            'id': q_id,
            'question': qitem['question'],
            'subject': subj,
            'user_answer': user_ans if user_ans else 'Skipped',
            'correct_answer': correct_ans,
            'is_correct': is_correct,
            'explanation': qitem.get('explanation', 'No detailed explanation available.')
        })

    pct = round((total_score / max_score) * 100.0, 2) if max_score > 0 else 0.0
    pass_status = "PASSED" if pct >= Config.PASSING_PERCENTAGE else "FAILED"
    
    if pct >= 80: grade = 'A*'
    elif pct >= 70: grade = 'A'
    elif pct >= 60: grade = 'B'
    elif pct >= 50: grade = 'C'
    else: grade = 'F'

    for subj, sdata in section_scores.items():
        stotal = sdata['total']
        sdata['percentage'] = round((sdata['correct'] / stotal) * 100.0, 2) if stotal > 0 else 0.0

    sorted_sec = sorted(section_scores.items(), key=lambda x: x[1]['percentage'])
    weakest = sorted_sec[0][0] if sorted_sec else 'None'
    strongest = sorted_sec[-1][0] if sorted_sec else 'None'

    return {
        'candidate_name': candidate_name,
        'candidate_roll': candidate_roll,
        'total_score': max(0.0, total_score),
        'max_score': max_score,
        'percentage': pct,
        'grade': grade,
        'pass_status': pass_status,
        'time_taken_seconds': time_taken,
        'correct_count': correct_count,
        'wrong_count': wrong_count,
        'skipped_count': skipped_count,
        'longest_streak': longest_streak,
        'strongest_subject': strongest,
        'weakest_subject': weakest,
        'section_scores': section_scores,
        'detailed_answers': detailed_answers
    }

def format_time(seconds):
    try:
        s = int(seconds)
        m, sec = divmod(s, 60)
        h, m = divmod(m, 60)
        if h > 0:
            return f"{h}h {m}m {sec}s"
        return f"{m}m {sec}s"
    except Exception:
        return "0m 0s"

# ── 5. UNIVERSITIES GUIDES DATA ──────────────────────────────────────────────
UNIVERSITIES_DATA = {
    'bahria': {
        'id': 'bahria',
        'name': 'Bahria University Islamabad (BUIC)',
        'short_name': 'Bahria University',
        'tagline': 'Federal Chartered Public Sector University - E-8 Campus, Islamabad',
        'location': 'Islamabad Campus (E-8 Naval Complex)',
        'badge_color': '#2563eb',
        'badge_bg': '#eff6ff',
        'icon': '🏛️',
        'portal_url': 'https://bahria.edu.pk/admissions/',
        'test_name': 'BUET (Bahria University Entry Test)',
        'test_format': '100 MCQs | 120 Minutes | Computer-Based Test (CBT)',
        'negative_marking': 'No Negative Marking (0.0 Penalty)',
        'description': 'Bahria University Islamabad offers state-of-the-art computing, engineering, management, and social sciences programs under federal charter with top-tier lab infrastructure.',
        'programs': {
            'bscs': {
                'id': 'bscs',
                'name': 'BS Computer Science (BS CS)',
                'degree_level': '4-Year Undergraduate (8 Semesters)',
                'ssc_criteria': 'Minimum 60% marks in SSC (Matriculation) or O-Levels equivalent.',
                'hssc_criteria': 'Minimum 50% marks in HSSC (F.Sc Pre-Engineering / ICS / General Science with Maths) or A-Levels.',
                'tuition_fee': 'PKR 115,000',
                'misc_fee': 'PKR 15,000',
                'admission_fee': 'PKR 33,000',
                'security_fee': 'PKR 25,000',
                'total_first_semester': 'PKR 188,000',
                'fee_notes': 'Admission fee (PKR 33,000) and Security fee (PKR 25,000) are one-time initial charges.',
                'transfer_policy': 'Migration/Transfer from HEC recognized universities is permitted for CS/SE/IT with a minimum CGPA of 2.0/4.0. Transcripts must be evaluated by the Department HOD.',
                'engineering_transfer_rule': None,
                'test_breakdown': [
                    {'subject': 'Mathematics / Basic Math', 'questions': 30},
                    {'subject': 'English Grammar & Comprehension', 'questions': 30},
                    {'subject': 'Analytical & Logical Reasoning', 'questions': 20},
                    {'subject': 'Physics / Computer Science', 'questions': 20}
                ]
            },
            'bsse': {
                'id': 'bsse',
                'name': 'BS Software Engineering (BS SE)',
                'degree_level': '4-Year Undergraduate (8 Semesters)',
                'ssc_criteria': 'Minimum 60% marks in SSC (Matriculation) or O-Levels.',
                'hssc_criteria': 'Minimum 50% marks in HSSC (F.Sc Pre-Engg / ICS with Maths) or A-Levels equivalent.',
                'tuition_fee': 'PKR 118,000',
                'misc_fee': 'PKR 15,000',
                'admission_fee': 'PKR 33,000',
                'security_fee': 'PKR 25,000',
                'total_first_semester': 'PKR 191,000',
                'fee_notes': 'One-time admission & security fee + recurring per semester dues.',
                'transfer_policy': 'Transfer allowed for computing programs with CGPA >= 2.0 upon HOD course outline review.',
                'engineering_transfer_rule': None,
                'test_breakdown': [
                    {'subject': 'Mathematics', 'questions': 30},
                    {'subject': 'English', 'questions': 30},
                    {'subject': 'Analytical Logic', 'questions': 20},
                    {'subject': 'Physics / CS', 'questions': 20}
                ]
            },
            'bsee': {
                'id': 'bsee',
                'name': 'BS Electrical Engineering (BS EE)',
                'degree_level': '4-Year PEC Accredited Engineering (8 Semesters)',
                'ssc_criteria': 'Minimum 60% marks in SSC / Matric Science.',
                'hssc_criteria': 'Minimum 60% marks in F.Sc Pre-Engineering / ICS (with Maths & Physics).',
                'tuition_fee': 'PKR 125,000',
                'misc_fee': 'PKR 15,000',
                'admission_fee': 'PKR 33,000',
                'security_fee': 'PKR 25,000',
                'total_first_semester': 'PKR 198,000',
                'fee_notes': 'Admission fee (33k) & Security fee (25k) one-time initial charges.',
                'transfer_policy': 'STRICT PEC REGULATION: No cross transfer is allowed into Bahria Engineering programs. Incoming transfer students MUST start fresh from Semester 1.',
                'engineering_transfer_rule': '⚠️ IMPORTANT: No cross transfer in Bahria Engineering programs! All incoming transfer applicants must start from Semester 1.',
                'test_breakdown': [
                    {'subject': 'Mathematics (Advanced)', 'questions': 35},
                    {'subject': 'Physics', 'questions': 30},
                    {'subject': 'English', 'questions': 20},
                    {'subject': 'Analytical Reasoning', 'questions': 15}
                ]
            }
        },
        'timeline_steps': [
            {
                'step_num': 1,
                'title': 'Online Application & Test Fee Submission',
                'date_badge': 'Step 1 • Online Portal',
                'summary': 'Submit online application at bahria.edu.pk and pay the entry test fee challan at bank.',
                'details': 'Create an applicant account, fill academic marks, select degree preferences, and pay the PKR 2,000 test fee at bank.'
            },
            {
                'step_num': 2,
                'title': 'Attempt Bahria CBT Entry Test (BUET)',
                'date_badge': 'Step 2 • Test Date',
                'summary': 'Download Admit Card & appear for Computer-Based Test at Islamabad Campus.',
                'details': '100 MCQs across Maths, Physics/CS, English, and Analytical Logic. Timer is 120 minutes with zero negative marking.'
            },
            {
                'step_num': 3,
                'title': 'Merit List Publication & Status Check',
                'date_badge': 'Step 3 • Merit Declaration',
                'summary': 'Bahria University publishes official merit lists on their website.',
                'details': 'Check your merit position and note down your assigned document verification & interview slot venue.'
            },
            {
                'step_num': 4,
                'title': 'Document Verification & Interview Panel',
                'date_badge': 'Step 4 • On-Campus Verification',
                'summary': 'Appear for document verification on the specified date with all original certificates.',
                'details': 'Bring original SSC Marksheet, HSSC Marksheet, CNIC / B-Form, Domicile, and 4 passport size photos to the interview panel.'
            },
            {
                'step_num': 5,
                'title': 'Fee Challan Generation & Final Admission / Transfer Approval',
                'date_badge': 'Step 5 • Fee Payment',
                'summary': 'Receive approved Fee Challan, pay initial semester dues at bank, and finalize admission.',
                'details': 'Fresh Candidates: Paid fee challan issued (Tuition + 15k Misc + 33k Admission + 25k Refundable Security).\n\nTransfer Candidates: Present previous official transcript to Department HOD. Upon HOD course credit exemption approval, a customized fee challan will be generated by the HOD to complete transfer process.'
            },
            {
                'step_num': 6,
                'title': '🎉 Welcome to Bahria University Islamabad!',
                'date_badge': 'Final Step • Enrollment Complete',
                'summary': 'Receive your Student Enrollment ID, orientation schedule, and class timetable.',
                'details': 'Congratulations! Collect your university ID card and begin your academic journey.'
            }
        ]
    },
    'iiui': {
        'id': 'iiui',
        'name': 'International Islamic University Islamabad (IIUI)',
        'short_name': 'IIUI Islamabad',
        'tagline': 'Public Sector Federal University - Sector H-10, Islamabad',
        'location': 'H-10 Campus, Islamabad',
        'badge_color': '#059669',
        'badge_bg': '#d1fae5',
        'icon': '🕌',
        'portal_url': 'https://admission.iiu.edu.pk/',
        'test_name': 'IIUI Undergraduate Entry Test',
        'test_format': '100 MCQs | 120 Minutes | Subject & Aptitude Test',
        'negative_marking': 'No Negative Marking (60% Test + 40% Academic Weightage)',
        'description': 'International Islamic University Islamabad (IIUI) is a premier public university established in 1980, offering acclaimed degrees in Computer Science, Software Engineering, AI, and Engineering.',
        'programs': {
            'bscs': {
                'id': 'bscs',
                'name': 'BS Computer Science (BS CS)',
                'degree_level': '4-Year Undergraduate (8 Semesters)',
                'ssc_criteria': 'Minimum 50% marks in SSC (Matriculation Science) or O-Levels.',
                'hssc_criteria': 'Minimum 50% marks in HSSC (F.Sc Pre-Engineering / ICS with Maths & Physics) or A-Levels.',
                'tuition_fee': 'PKR 75,000',
                'misc_fee': 'PKR 12,000',
                'admission_fee': 'PKR 20,000',
                'security_fee': 'PKR 15,000',
                'total_first_semester': 'PKR 122,000',
                'fee_notes': 'Subsidized public sector fee structure.',
                'transfer_policy': 'External migration/credit transfer requires minimum CGPA of 2.5/4.0 from an HEC recognized university with HOD approval.',
                'engineering_transfer_rule': None,
                'test_breakdown': [
                    {'subject': 'Mathematics (F.Sc Level)', 'questions': 35},
                    {'subject': 'Physics', 'questions': 25},
                    {'subject': 'English Grammar', 'questions': 20},
                    {'subject': 'Analytical Reasoning', 'questions': 20}
                ]
            }
        },
        'timeline_steps': [
            {
                'step_num': 1,
                'title': 'Online Application & Test Voucher Payment',
                'date_badge': 'Step 1 • IIUI Portal',
                'summary': 'Register on admission.iiu.edu.pk and generate entry test voucher.',
                'details': 'Complete online registration and pay test fee voucher at HBL/ABL bank.'
            },
            {
                'step_num': 2,
                'title': 'Attempt IIUI Admission Test',
                'date_badge': 'Step 2 • Test Date at H-10',
                'summary': 'Appear for IIUI Entry Test at Sector H-10, Islamabad.',
                'details': '100 MCQs covering Maths, Physics, English, and Logical Reasoning. Duration 120 minutes.'
            },
            {
                'step_num': 3,
                'title': 'Merit List Announcement',
                'date_badge': 'Step 3 • Merit Declaration',
                'summary': 'IIUI publishes departmental merit lists based on 60% Entry Test + 40% Academics.',
                'details': 'Check merit position and receive interview verification call letter.'
            },
            {
                'step_num': 4,
                'title': 'Document Verification',
                'date_badge': 'Step 4 • On-Campus Verification',
                'summary': 'Report to IIUI H-10 Campus with original academic credentials.',
                'details': 'Present original Matric/SSC marksheet, F.Sc marksheet, CNIC / B-Form, Domicile, and photos.'
            },
            {
                'step_num': 5,
                'title': 'Fee Challan Generation & Migration Approval',
                'date_badge': 'Step 5 • Fee Payment',
                'summary': 'Receive fee voucher and finalize seat allotment.',
                'details': 'Fresh candidates pay fee voucher at bank.\nMigration candidates report to HOD with previous transcript for customized fee voucher generation.'
            },
            {
                'step_num': 6,
                'title': '🎉 Welcome to International Islamic University Islamabad!',
                'date_badge': 'Final Step • Enrollment Complete',
                'summary': 'Obtain IIUI registration number and attend orientation.',
                'details': 'Collect campus card and start your academic journey.'
            }
        ]
    }
}

# ── 6. FLASK ROUTES ──────────────────────────────────────────────────────────
@app.context_processor
def inject_global_vars():
    settings = get_settings()
    return {
        'system_settings': settings,
        'format_time': format_time
    }

@app.route('/')
def home():
    stats = get_high_score_stats()
    recent_attempts = get_all_attempts(limit=5)
    settings = get_settings()
    return render_template('home.html', stats=stats, recent_attempts=recent_attempts, settings=settings)

@app.route('/guides')
def guides():
    return render_template('guides.html', universities=UNIVERSITIES_DATA)

@app.route('/university/<uni_id>')
@app.route('/university/<uni_id>/<program_id>')
def university_detail(uni_id, program_id=None):
    uni = UNIVERSITIES_DATA.get(uni_id.lower())
    if not uni:
        return redirect(url_for('guides'))
    programs = uni['programs']
    if not program_id or program_id.lower() not in programs:
        first_prog_key = list(programs.keys())[0]
        selected_program = programs[first_prog_key]
    else:
        selected_program = programs[program_id.lower()]
    return render_template('university_detail.html', university=uni, program=selected_program)

@app.route('/instructions')
def instructions():
    total_q = Config.DEFAULT_EXAM_QUESTION_COUNT
    return render_template('instructions.html', total_questions=total_q, exam_time=Config.DEFAULT_EXAM_TIME_MINUTES, passing_pct=Config.PASSING_PERCENTAGE)

@app.route('/exam')
def exam():
    q_ids = session.get('exam_q_ids')
    if q_ids:
        all_q_map = {str(q['id']): q for q in load_all_question_banks()}
        questions = [all_q_map[str(qid)] for qid in q_ids if str(qid) in all_q_map]
    else:
        questions = []

    if not questions:
        questions = prepare_exam_questions(count=Config.DEFAULT_EXAM_QUESTION_COUNT)
        session['exam_q_ids'] = [q['id'] for q in questions]
        session['exam_start_time'] = time.time()
        session['exam_session_key'] = f"ats_exam_{int(time.time()*1000)}"

    session_key = session.get('exam_session_key')
    if not session_key:
        session['exam_session_key'] = f"ats_exam_{int(time.time()*1000)}"
        session_key = session['exam_session_key']

    exam_time = session.get('exam_time_minutes', Config.DEFAULT_EXAM_TIME_MINUTES)
    return render_template(
        'exam.html',
        questions=questions,
        exam_time=exam_time,
        total_time_minutes=exam_time,
        candidate_name=session.get('candidate_name', 'Candidate Name'),
        session_key=session_key
    )

@app.route('/practice')
def practice():
    all_q = load_all_question_banks()
    return render_template('practice.html', total_available=len(all_q), default_time=Config.DEFAULT_EXAM_TIME_MINUTES, sections=['English', 'Maths', 'Physics', 'Analytical', 'GK', 'Computer'])

@app.route('/practice/start', methods=['GET', 'POST'])
def practice_start():
    if request.method == 'GET':
        return redirect(url_for('practice'))
    try:
        if request.is_json:
            req = request.get_json(silent=True) or {}
            count = int(req.get('question_count', 30))
            custom_t = req.get('time_limit')
            time_limit = int(custom_t) if custom_t else max(1, round((count / Config.DEFAULT_EXAM_QUESTION_COUNT) * Config.DEFAULT_EXAM_TIME_MINUTES))
            subjects = req.get('subjects', [])
        else:
            req = request.form
            count = int(req.get('num_questions') or req.get('question_count') or 30)
            custom_t = req.get('custom_time')
            time_limit = int(custom_t) if (custom_t and str(custom_t).strip()) else max(1, round((count / Config.DEFAULT_EXAM_QUESTION_COUNT) * Config.DEFAULT_EXAM_TIME_MINUTES))
            subjects = req.getlist('sections') or req.getlist('subjects')

        if isinstance(subjects, str):
            subjects = [s.strip() for s in subjects.split(',') if s.strip()]

        questions = prepare_custom_exam_questions(count=count, subjects=subjects)
        session['exam_q_ids'] = [q['id'] for q in questions]
        session['exam_start_time'] = time.time()
        session['exam_time_minutes'] = time_limit
        session['exam_session_key'] = f"ats_practice_{int(time.time()*1000)}"

        if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'status': 'success', 'success': True, 'redirect': url_for('exam'), 'redirect_url': url_for('exam'), 'questions_count': len(questions), 'time_limit': time_limit})
        else:
            return redirect(url_for('exam'))
    except Exception as e:
        traceback.print_exc()
        if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'status': 'error', 'success': False, 'message': str(e)}), 400
        else:
            return redirect(url_for('practice'))

@app.route('/madness')
def madness():
    return render_template('madness.html')

@app.route('/madness/start', methods=['GET', 'POST'])
def madness_start():
    if request.method == 'GET':
        return redirect(url_for('madness'))
    questions = prepare_madness_questions()
    session['exam_q_ids'] = [q['id'] for q in questions]
    session['exam_start_time'] = time.time()
    session['exam_time_minutes'] = Config.DEFAULT_EXAM_TIME_MINUTES
    session['exam_session_key'] = f"ats_madness_{int(time.time()*1000)}"
    if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'status': 'success', 'success': True, 'redirect': url_for('exam'), 'redirect_url': url_for('exam'), 'questions_count': len(questions)})
    else:
        return redirect(url_for('exam'))

@app.route('/submit', methods=['GET', 'POST'])
def submit_exam():
    if request.method == 'GET':
        return redirect(url_for('home'))
    try:
        data = request.get_json(silent=True) or request.form.to_dict() or {}
        candidate_name = data.get('candidate_name', 'Candidate Name')
        candidate_roll = data.get('candidate_roll', 'ATS-2026-001')
        time_taken = int(data.get('time_taken_seconds', 0))
        user_answers = data.get('answers', {})
        if isinstance(user_answers, str):
            try: user_answers = json.loads(user_answers)
            except Exception: user_answers = {}

        # 1. Prefer questions passed directly from client payload
        questions = data.get('questions', [])
        if isinstance(questions, str):
            try: questions = json.loads(questions)
            except Exception: questions = []

        # 2. Fallback to reconstructing from session q_ids
        if not questions:
            q_ids = session.get('exam_q_ids', [])
            if q_ids:
                all_q_map = {str(q['id']): q for q in load_all_question_banks()}
                questions = [all_q_map[str(qid)] for qid in q_ids if str(qid) in all_q_map]
            
        if not questions:
            return jsonify({'status': 'error', 'success': False, 'message': 'No questions found for submission.'}), 400

        result = evaluate_exam_submission(
            user_answers, questions, time_taken, candidate_name, candidate_roll
        )
        
        attempt_id = save_attempt(result)
        session.pop('exam_q_ids', None)

        return jsonify({
            'status': 'success',
            'success': True,
            'attempt_id': attempt_id,
            'redirect': url_for('result_page', attempt_id=attempt_id),
            'redirect_url': url_for('result_page', attempt_id=attempt_id)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'status': 'error', 'success': False, 'message': f"Database or Server Error: {str(e)}"}), 500

@app.route('/result/<int:attempt_id>', endpoint='result')
@app.route('/result/<int:attempt_id>', endpoint='result_page')
def result_page(attempt_id):
    attempt = get_attempt_by_id(attempt_id)
    if not attempt:
        return redirect(url_for('home'))
    return render_template('result.html', attempt=attempt, perf_summary=attempt.get('section_scores', {}))

@app.route('/review/<int:attempt_id>', endpoint='review')
@app.route('/review/<int:attempt_id>', endpoint='review_page')
def review_page(attempt_id):
    attempt = get_attempt_by_id(attempt_id)
    if not attempt:
        return redirect(url_for('home'))
    return render_template('review.html', attempt=attempt)

@app.route('/report/<int:attempt_id>', endpoint='report')
@app.route('/report/<int:attempt_id>', endpoint='report_page')
def report_page(attempt_id):
    attempt = get_attempt_by_id(attempt_id)
    if not attempt:
        return redirect(url_for('home'))
    return render_template('report.html', attempt=attempt)

@app.route('/api/settings', methods=['POST'])
def api_save_settings():
    try:
        data = request.get_json(silent=True) or {}
        conn = get_db_connection()
        cursor = conn.cursor()
        for k, v in data.items():
            setting_key = f"theme_{k}" if k in ('dark', 'light') else str(k)
            if is_mysql():
                cursor.execute("INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES (%s, %s) ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`)", (setting_key, str(v)))
            else:
                cursor.execute("INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)", (setting_key, str(v)))
        if not is_mysql():
            conn.commit()
        conn.close()
        return jsonify({'status': 'success', 'success': True})
    except Exception as e:
        return jsonify({'status': 'error', 'success': False, 'message': str(e)}), 400

@app.route('/api/questions')
def api_questions():
    questions = prepare_exam_questions(count=Config.DEFAULT_EXAM_QUESTION_COUNT)
    return jsonify(questions)

if __name__ == '__main__':
    print("Atechabad Testing System starting on http://127.0.0.1:5000 ...")
    app.run(host='0.0.0.0', port=5000, debug=True)
