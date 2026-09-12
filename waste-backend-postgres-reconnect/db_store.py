# ==============================================================================
# ORMDictStore: a dict-like object backed by a PostgreSQL table.
#
# main.py was written against plain in-memory dicts (GENERATORS["id"],
# "id" in FACILITIES, SHIPMENTS.values(), len(CARBON_RECORDS), etc.). Rather
# than rewrite every endpoint against a SQLAlchemy Session, this class
# implements the same dict interface (via collections.abc.MutableMapping) but
# reads/writes rows in Postgres underneath — so GENERATORS = ORMDictStore(...)
# is a drop-in replacement for GENERATORS = {} and the rest of main.py's
# business logic (matching, CVRP calls, carbon math) needs no changes.
#
# Trade-off: each dict operation opens a short-lived session rather than
# reusing one session per HTTP request. That's simple and correct, just not
# maximally efficient — fine at hackathon/demo scale. If this needs to scale
# up, switch these endpoints to `db: Session = Depends(get_db)` instead.
# ==============================================================================
from collections.abc import MutableMapping

from database import SessionLocal


class ORMDictStore(MutableMapping):
    def __init__(self, model, pk_attr: str):
        self.model = model
        self.pk_attr = pk_attr

    def __getitem__(self, key):
        with SessionLocal() as session:
            obj = session.get(self.model, key)
            if obj is None:
                raise KeyError(key)
            return self._to_dict(obj)

    def __setitem__(self, key, value: dict):
        payload = dict(value)
        payload[self.pk_attr] = key
        with SessionLocal() as session:
            obj = session.get(self.model, key)
            if obj is None:
                obj = self.model(**payload)
                session.add(obj)
            else:
                for field, val in payload.items():
                    setattr(obj, field, val)
            session.commit()

    def __delitem__(self, key):
        with SessionLocal() as session:
            obj = session.get(self.model, key)
            if obj is None:
                raise KeyError(key)
            session.delete(obj)
            session.commit()

    def __iter__(self):
        with SessionLocal() as session:
            pk_column = getattr(self.model, self.pk_attr)
            rows = session.query(pk_column).all()
        return iter(row[0] for row in rows)

    def __len__(self):
        with SessionLocal() as session:
            return session.query(self.model).count()

    def clear(self):
        with SessionLocal() as session:
            session.query(self.model).delete()
            session.commit()

    @staticmethod
    def _to_dict(obj):
        return {
            c.name: getattr(obj, c.name)
            for c in obj.__table__.columns
            if c.name != "geog"
        }
