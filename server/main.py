"""Spike receiver: accepts batches from the tablet and reports gaps.

Run on your laptop (same Wi-Fi as the tablet):
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000

Then open http://<laptop-ip>:8000/spike/stats after a test ride.

This is NOT the real transport API. It exists to answer two questions:
1. Do points arrive without big gaps (Android killing the app)?
2. Do offline events arrive once, and only once, after the network returns?
"""

from __future__ import annotations

import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel

DB_PATH = Path(__file__).with_name("spike_server.db")

app = FastAPI(title="Bus spike receiver")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


with closing(connect()) as _c:
    _c.executescript(
        """
        CREATE TABLE IF NOT EXISTS gps_point (
            client_id TEXT PRIMARY KEY, device_id TEXT, recorded_at TEXT,
            received_at TEXT, lat REAL, lng REAL, speed REAL, accuracy REAL, battery REAL
        );
        CREATE TABLE IF NOT EXISTS trip_event (
            client_id TEXT PRIMARY KEY, device_id TEXT, type TEXT, label TEXT,
            occurred_at TEXT, received_at TEXT, lat REAL, lng REAL
        );
        """
    )


class Point(BaseModel):
    client_id: str
    recorded_at: str
    lat: float
    lng: float
    speed: float | None = None
    accuracy: float | None = None
    battery: float | None = None


class Event(BaseModel):
    client_id: str
    type: str
    label: str | None = None
    occurred_at: str
    lat: float | None = None
    lng: float | None = None


class Batch(BaseModel):
    device_id: str
    points: list[Point] = []
    events: list[Event] = []


@app.post("/spike/batch")
def receive(batch: Batch) -> dict[str, int]:
    now = datetime.utcnow().isoformat()
    with closing(connect()) as conn, conn:
        # INSERT OR IGNORE on client_id = idempotent: a batch sent twice
        # (timeout after the server saved it) is stored once.
        conn.executemany(
            "INSERT OR IGNORE INTO gps_point VALUES (?,?,?,?,?,?,?,?,?)",
            [
                (p.client_id, batch.device_id, p.recorded_at, now, p.lat, p.lng, p.speed, p.accuracy, p.battery)
                for p in batch.points
            ],
        )
        conn.executemany(
            "INSERT OR IGNORE INTO trip_event VALUES (?,?,?,?,?,?,?,?)",
            [
                (e.client_id, batch.device_id, e.type, e.label, e.occurred_at, now, e.lat, e.lng)
                for e in batch.events
            ],
        )
    return {"points": len(batch.points), "events": len(batch.events)}


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


@app.get("/spike/stats")
def stats(gap_seconds: int = 60) -> dict:
    """Per device: point count, time span, battery drop, and every gap longer
    than `gap_seconds` between consecutive GPS fixes. Gaps = the app was
    asleep or killed. A clean 90-minute ride should show no gaps over 60 s."""
    with closing(connect()) as conn:
        devices = [r["device_id"] for r in conn.execute("SELECT DISTINCT device_id FROM gps_point")]
        out = {}
        for d in devices:
            rows = conn.execute(
                "SELECT recorded_at, battery FROM gps_point WHERE device_id = ? ORDER BY recorded_at", (d,)
            ).fetchall()
            times = [_parse(r["recorded_at"]) for r in rows]
            gaps = [
                {"from": a.isoformat(), "to": b.isoformat(), "seconds": int((b - a).total_seconds())}
                for a, b in zip(times, times[1:])
                if (b - a).total_seconds() > gap_seconds
            ]
            batteries = [r["battery"] for r in rows if r["battery"] is not None]
            late = conn.execute(
                """SELECT COUNT(*) FROM trip_event WHERE device_id = ?
                   AND (julianday(received_at) - julianday(occurred_at)) * 86400 > 120""",
                (d,),
            ).fetchone()[0]
            out[d] = {
                "points": len(rows),
                "first": times[0].isoformat() if times else None,
                "last": times[-1].isoformat() if times else None,
                "battery_start": batteries[0] if batteries else None,
                "battery_end": batteries[-1] if batteries else None,
                "gaps_over_threshold": gaps,
                "events": conn.execute("SELECT COUNT(*) FROM trip_event WHERE device_id = ?", (d,)).fetchone()[0],
                "events_arrived_over_2min_late": late,
            }
        return out
