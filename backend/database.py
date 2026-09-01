"""
VoiceGuard / SIH26104 - SQLite Database Module
Stores caller profiles, fraud incident logs, and session analysis history.
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from .config import DATABASE_URL, BASE_DIR

def get_db_path() -> Path:
    if DATABASE_URL.startswith("sqlite:///"):
        raw_path = DATABASE_URL.replace("sqlite:///", "")
        return Path(raw_path)
    return BASE_DIR / "sih26104.db"

def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables and populate demo seed records."""
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Callers Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS callers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone_number TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                known_contact INTEGER NOT NULL DEFAULT 1,
                usual_amount REAL NOT NULL DEFAULT 10000.0,
                usual_call_hours TEXT NOT NULL DEFAULT '09:00-18:00',
                fraud_history INTEGER NOT NULL DEFAULT 0,
                risk_level TEXT NOT NULL DEFAULT 'Low',
                created_at TEXT NOT NULL
            )
        """)

        # 2. Fraud Incident History Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS fraud_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                caller_id TEXT NOT NULL,
                incident_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                description TEXT NOT NULL,
                date TEXT NOT NULL,
                FOREIGN KEY (caller_id) REFERENCES callers(phone_number)
            )
        """)

        # 3. Analysis History Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analysis_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                caller_id TEXT NOT NULL,
                risk_score INTEGER NOT NULL,
                recommendation TEXT NOT NULL,
                reason TEXT NOT NULL,
                model_score REAL NOT NULL,
                acoustic_score INTEGER NOT NULL,
                context_score INTEGER NOT NULL,
                processing_time_ms REAL NOT NULL,
                audio_filename TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        
        conn.commit()
        
        # Check if seed data needed
        cursor.execute("SELECT COUNT(*) as count FROM callers")
        count = cursor.fetchone()["count"]
        if count == 0:
            seed_demo_data(cursor)
            conn.commit()

def seed_demo_data(cursor: sqlite3.Cursor):
    """Seed safe realistic demo caller profiles and fraud records."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    callers_data = [
        ("+919122390182", "Alice Sharma", 1, 8500.0, "09:00-19:00", 0, "Low", now_str),
        ("+919841028419", "Bob Verma", 0, 10000.0, "10:00-18:00", 1, "High", now_str),
        ("+919871102931", "Charlie Patel", 1, 25000.0, "08:00-20:00", 0, "Medium", now_str),
        ("+919940188320", "David Rao", 0, 15000.0, "09:00-18:00", 1, "High", now_str),
        ("+919381011902", "Elena Mehta", 1, 5000.0, "09:00-17:00", 0, "Low", now_str)
    ]

    cursor.executemany("""
        INSERT OR IGNORE INTO callers (phone_number, name, known_contact, usual_amount, usual_call_hours, fraud_history, risk_level, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, callers_data)

    fraud_data = [
        ("+919841028419", "Synthetic Speech Attempt", "High", "Prior call exhibited neural vocoder phase artifacts during wire transfer attempt.", "2026-08-20"),
        ("+919841028419", "OTP Interception Suspicion", "Medium", "Failed 2-step SMS verification and multiple rapid login attempts.", "2026-08-25"),
        ("+919940188320", "Voice Clone Deepfake", "Critical", "Confirmed AI voice conversion impersonating corporate executive.", "2026-08-15")
    ]

    cursor.executemany("""
        INSERT INTO fraud_history (caller_id, incident_type, severity, description, date)
        VALUES (?, ?, ?, ?, ?)
    """, fraud_data)

def get_caller_by_phone(phone_number: str) -> Optional[Dict[str, Any]]:
    clean_phone = phone_number.replace(" ", "").replace("-", "")
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM callers WHERE phone_number = ? OR phone_number = ?", 
                       (clean_phone, f"+{clean_phone.lstrip('+')}"))
        row = cursor.fetchone()
        if not row:
            return None
        
        caller = dict(row)
        cursor.execute("SELECT * FROM fraud_history WHERE caller_id = ?", (caller["phone_number"],))
        fraud_rows = cursor.fetchall()
        caller["fraud_incidents"] = [dict(f) for f in fraud_rows]
        return caller

def get_all_callers() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM callers ORDER BY id ASC")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def add_analysis_record(
    session_id: str,
    caller_id: str,
    risk_score: int,
    recommendation: str,
    reason: str,
    model_score: float,
    acoustic_score: int,
    context_score: int,
    processing_time_ms: float,
    audio_filename: str
) -> int:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO analysis_history (
                session_id, caller_id, risk_score, recommendation, reason,
                model_score, acoustic_score, context_score, processing_time_ms,
                audio_filename, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            session_id, caller_id, risk_score, recommendation, reason,
            model_score, acoustic_score, context_score, processing_time_ms,
            audio_filename, now_str
        ))
        conn.commit()
        return cursor.lastrowid

def get_analysis_history(limit: int = 50) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM analysis_history ORDER BY id DESC LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

# Auto-initialize SQLite tables upon module load
init_db()
