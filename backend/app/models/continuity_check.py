# backend/app/models/continuity_check.py
"""
ContinuityCheck model.

V2 note: the underlying table was RENAMED from `continuity_checks` to
`heartbeats` by migrations/v1_to_v2.py, and several columns were renamed
to match the V2 schema. This class keeps the public name `ContinuityCheck`
so that V1 route imports (`from app.models import ContinuityCheck`) do not
break, but it points at the new `heartbeats` table with the new columns.

Column mapping (V1 -> V2):
    check_time        -> client_reported_at
    (new)             -> server_received_at
    check_number      -> sequence_num
    hash_link         -> hash
    (new)             -> prev_hash
    hash_link_valid   -> valid
    (new)             -> backfilled
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class ContinuityCheck(Base):
    __tablename__ = "heartbeats"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)

    client_reported_at = Column(DateTime(timezone=True), nullable=False)
    server_received_at = Column(DateTime(timezone=True), nullable=True)

    sequence_num = Column(Integer, nullable=False, default=0)
    hash = Column(String, nullable=True)
    prev_hash = Column(String, nullable=True)
    valid = Column(Boolean, default=False)

    status = Column(String, default="pending")
    message = Column(Text, nullable=True)

    environment_overlap = Column(Float, nullable=True)
    proof_hash = Column(String, nullable=True)

    backfilled = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("Session", back_populates="continuity_checks")

    def __repr__(self):
        return (
            f"<ContinuityCheck(id={self.id}, session_id={self.session_id}, "
            f"sequence_num={self.sequence_num}, valid={self.valid})>"
        )


Heartbeat = ContinuityCheck