
from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

app = Flask(__name__)
CORS(app)

DB_PATH = Path(__file__).resolve().parent / "pyrosense.db"


def connect_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def initialise_db():
    with connect_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS households (
                id TEXT PRIMARY KEY,
                area TEXT NOT NULL,
                household_type TEXT NOT NULL,
                fuel_percent INTEGER NOT NULL,
                days_remaining INTEGER NOT NULL
            )
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                area TEXT NOT NULL,
                level TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Open',
                created_at TEXT NOT NULL
            )
        """)

        count = db.execute(
            "SELECT COUNT(*) FROM households"
        ).fetchone()[0]

        if count == 0:
            areas = [
                ("Yelahanka", "Urban"),
                ("Devanahalli", "Rural"),
                ("Hebbal", "Urban"),
                ("Doddaballapur", "Rural"),
                ("Nelamangala", "Rural"),
            ]

            for i in range(500):
                area, household_type = areas[i % len(areas)]
                fuel = (i * 17 + 23) % 101
                days = max(1, round(fuel / 5))

                db.execute("""
                    INSERT INTO households
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    f"FS-{1000 + i}",
                    area,
                    household_type,
                    fuel,
                    days
                ))

        incident_count = db.execute(
            "SELECT COUNT(*) FROM incidents"
        ).fetchone()[0]

        if incident_count == 0:
            now = datetime.now(timezone.utc).isoformat()

            demo_incidents = [
                (
                    "INC-2081",
                    "Critical leak threshold exceeded",
                    "Devanahalli · Rural",
                    "Critical",
                    "Open",
                    now
                ),
                (
                    "INC-2079",
                    "Unusual consumption pattern",
                    "Yelahanka · Urban",
                    "Warning",
                    "Open",
                    now
                ),
            ]

            db.executemany("""
                INSERT INTO incidents
                VALUES (?, ?, ?, ?, ?, ?)
            """, demo_incidents)


def household_status(days):
    if days <= 1:
        return "Priority"
    if days <= 3:
        return "Refill soon"
    return "Normal"


def get_household_dict(row):
    return {
        "id": row["id"],
        "area": row["area"],
        "type": row["household_type"],
        "fuel": row["fuel_percent"],
        "days": row["days_remaining"],
        "status": household_status(row["days_remaining"])
    }


@app.route("/")
def home():
    return jsonify({
        "project": "PyroSense",
        "message": "LPG intelligence backend is running."
    })


@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "project": "PyroSense",
        "data_mode": "simulated"
    })


@app.route("/api/summary")
def summary():
    with connect_db() as db:
        total = db.execute(
            "SELECT COUNT(*) FROM households"
        ).fetchone()[0]

        refill_due = db.execute("""
            SELECT COUNT(*) FROM households
            WHERE days_remaining <= 3
        """).fetchone()[0]

        open_incidents = db.execute("""
            SELECT COUNT(*) FROM incidents
            WHERE status = 'Open'
        """).fetchone()[0]

    return jsonify({
        "households_monitored": total,
        "refills_due_soon": refill_due,
        "open_incidents": open_incidents,
        "distribution_coverage_percent": 94.2,
        "data_mode": "simulated"
    })


@app.route("/api/households")
def get_households():
    search = request.args.get("search", "").strip()
    household_type = request.args.get("type", "").strip()

    query = "SELECT * FROM households WHERE 1=1"
    params = []

    if search:
        query += " AND (id LIKE ? OR area LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term])

    if household_type in ("Urban", "Rural"):
        query += " AND household_type = ?"
        params.append(household_type)

    query += " ORDER BY days_remaining ASC, fuel_percent ASC"

    with connect_db() as db:
        rows = db.execute(query, params).fetchall()

    return jsonify([get_household_dict(row) for row in rows])


# NEW: Three-day refill demand forecast
@app.route("/api/forecast")
def get_forecast():
    with connect_db() as db:
        rows = db.execute("""
            SELECT
                household_type,
                days_remaining,
                COUNT(*) AS household_count
            FROM households
            GROUP BY household_type, days_remaining
        """).fetchall()

    forecast = []

    for day_number in range(1, 4):
        day_counts = {"Urban": 0, "Rural": 0}

        for row in rows:
            if day_number == 1:
                matches = row["days_remaining"] <= 1
            else:
                matches = row["days_remaining"] == day_number

            if matches:
                day_counts[row["household_type"]] += row["household_count"]

        forecast.append({
            "day": (
                "Today" if day_number == 1
                else "Tomorrow" if day_number == 2
                else "Day 3"
            ),
            "day_number": day_number,
            "estimated_refills": sum(day_counts.values()),
            "urban": day_counts["Urban"],
            "rural": day_counts["Rural"]
        })

    return jsonify({
        "data_mode": "simulated",
        "method": "Household days-remaining buckets",
        "forecast": forecast,
        "total_estimated_refills": sum(
            item["estimated_refills"] for item in forecast
        ),
        "note": (
            "Estimates use simulated household records and "
            "are not predictions from real consumption data."
        )
    })


# NEW: Most urgent households first
@app.route("/api/priorities")
def get_priorities():
    limit = request.args.get("limit", default=20, type=int)
    limit = max(1, min(limit or 20, 100))

    with connect_db() as db:
        rows = db.execute("""
            SELECT *
            FROM households
            ORDER BY days_remaining ASC, fuel_percent ASC
            LIMIT ?
        """, (limit,)).fetchall()

    priorities = []

    for rank, row in enumerate(rows, start=1):
        days = row["days_remaining"]

        if days <= 1:
            urgency = "Critical"
        elif days <= 3:
            urgency = "High"
        elif days <= 7:
            urgency = "Moderate"
        else:
            urgency = "Normal"

        priorities.append({
            **get_household_dict(row),
            "rank": rank,
            "urgency": urgency
        })

    return jsonify({
        "data_mode": "simulated",
        "count": len(priorities),
        "priorities": priorities
    })


# NEW: Area-level distribution planning
@app.route("/api/areas")
def get_areas():
    with connect_db() as db:
        rows = db.execute("""
            SELECT
                area,
                household_type,
                COUNT(*) AS total_households,
                SUM(CASE WHEN days_remaining <= 1
                    THEN 1 ELSE 0 END) AS priority_households,
                SUM(CASE WHEN days_remaining <= 3
                    THEN 1 ELSE 0 END) AS refills_due_soon,
                ROUND(AVG(fuel_percent), 1) AS average_fuel_percent
            FROM households
            GROUP BY area, household_type
            ORDER BY refills_due_soon DESC, area ASC
        """).fetchall()

    areas = [
        {
            "area": row["area"],
            "type": row["household_type"],
            "total_households": row["total_households"],
            "priority_households": row["priority_households"],
            "refills_due_soon": row["refills_due_soon"],
            "average_fuel_percent": row["average_fuel_percent"]
        }
        for row in rows
    ]

    return jsonify({
        "data_mode": "simulated",
        "areas": areas
    })


@app.route("/api/incidents")
def get_incidents():
    with connect_db() as db:
        rows = db.execute("""
            SELECT * FROM incidents
            ORDER BY
                CASE level
                    WHEN 'Critical' THEN 1
                    ELSE 2
                END,
                created_at DESC
        """).fetchall()

    return jsonify([
        {
            "id": row["id"],
            "title": row["title"],
            "area": row["area"],
            "level": row["level"],
            "status": row["status"],
            "time": row["created_at"]
        }
        for row in rows
    ])


@app.route("/api/incidents/<incident_id>", methods=["PATCH"])
def update_incident(incident_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if status not in ("Open", "Acknowledged", "Resolved"):
        return jsonify({
            "error": "Invalid incident status."
        }), 400

    with connect_db() as db:
        result = db.execute("""
            UPDATE incidents
            SET status = ?
            WHERE id = ?
        """, (status, incident_id))

        if result.rowcount == 0:
            return jsonify({
                "error": "Incident not found."
            }), 404

    return jsonify({
        "id": incident_id,
        "status": status,
        "message": "Incident status updated."
    })


initialise_db()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
