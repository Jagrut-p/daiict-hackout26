# ==============================================================================
# SQLAlchemy models for the five stores main.py uses. Column names deliberately
# match the dict keys the app already reads/writes (including the shipment/
# verification/carbon-record camelCase keys), so db_store.py can hand back a
# plain dict from each row and none of the existing business logic in main.py
# (matching, CVRP calls, carbon math) has to change.
# ==============================================================================
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, event

from database import Base, ENABLE_POSTGIS

if ENABLE_POSTGIS:
    from geoalchemy2 import Geography
    from geoalchemy2.elements import WKTElement


class GeneratorModel(Base):
    __tablename__ = "generators"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    waste_type = Column(String, default="Organic")
    quantity_tons = Column(Float, default=5.0)
    contamination_pct = Column(Float, default=5.0)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(String, nullable=True)
    if ENABLE_POSTGIS:
        geog = Column(Geography(geometry_type="POINT", srid=4326), nullable=True)


class FacilityModel(Base):
    __tablename__ = "facilities"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    accepted_waste_type = Column(String, default="Organic")
    max_contamination_pct = Column(Float, default=20.0)
    processing_factor = Column(Float, default=0.08)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    capacity_tons_day = Column(Float, default=50.0)
    technology = Column(String, default="Standard Processing")
    address = Column(String, nullable=True)
    if ENABLE_POSTGIS:
        geog = Column(Geography(geometry_type="POINT", srid=4326), nullable=True)


class ShipmentModel(Base):
    __tablename__ = "shipments"

    shipment_id = Column(String, primary_key=True)
    generatorId = Column(String, nullable=True)
    generatorName = Column(String, nullable=True)
    facilityId = Column(String, nullable=True)
    facilityName = Column(String, nullable=True)
    wasteType = Column(String, nullable=True)
    weightKg = Column(Float, nullable=True)
    weightTons = Column(Float, nullable=True)
    contaminationLevel = Column(Float, nullable=True)
    status = Column(String, default="synced")
    createdAt = Column(String, nullable=True)
    netCarbonImpact = Column(Float, nullable=True)
    syncAttemptCount = Column(Integer, default=0)
    verifiedWeightTons = Column(Float, nullable=True)
    receiptId = Column(String, nullable=True)


class VerificationModel(Base):
    __tablename__ = "verifications"

    shipmentId = Column(String, primary_key=True)
    receiptId = Column(String, nullable=True)
    verifiedAt = Column(String, nullable=True)
    generatorName = Column(String, nullable=True)
    wasteType = Column(String, nullable=True)
    expectedWeightTons = Column(Float, nullable=True)
    actualWeightTons = Column(Float, nullable=True)
    deviationPercent = Column(Float, nullable=True)
    hasDiscrepancy = Column(Boolean, default=False)
    operatorNotes = Column(Text, nullable=True)
    scaleTerminalId = Column(String, nullable=True)


class CarbonRecordModel(Base):
    __tablename__ = "carbon_records"

    shipment_uuid = Column(String, primary_key=True)
    certificate_id = Column(String, nullable=True)
    calculation_version_id = Column(String, nullable=True)
    label = Column(String, nullable=True)
    diverted_tons = Column(Float, nullable=True)
    avoided_landfill_tCO2e = Column(Float, nullable=True)
    displacement_tCO2e = Column(Float, nullable=True)
    transport_tCO2e = Column(Float, nullable=True)
    processing_tCO2e = Column(Float, nullable=True)
    net_climate_benefit_tCO2e = Column(Float, nullable=True)
    route_distance_km = Column(Float, nullable=True)
    data_tier = Column(String, nullable=True)
    timestamp = Column(String, nullable=True)
    verification_status = Column(String, nullable=True)
    anti_tamper_hash = Column(String, nullable=True)


if ENABLE_POSTGIS:
    def _sync_geog(mapper, connection, target):
        if target.lat is not None and target.lng is not None:
            target.geog = WKTElement(f"POINT({target.lng} {target.lat})", srid=4326)

    event.listen(GeneratorModel, "before_insert", _sync_geog)
    event.listen(GeneratorModel, "before_update", _sync_geog)
    event.listen(FacilityModel, "before_insert", _sync_geog)
    event.listen(FacilityModel, "before_update", _sync_geog)
