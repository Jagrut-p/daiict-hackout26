import hashlib
import math
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI(
    title="Waste-to-Carbon Value Chain Tracker",
    description="Carbon-aware routing and MRV calculation engine"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONN_STR = "postgresql://postgres:postgres@localhost:5432/waste_carbon_db"

def get_db():
    return psycopg2.connect(CONN_STR, cursor_factory=RealDictCursor)

# Pydantic Schemas
class GeneratorIn(BaseModel):
    name: str
    waste_type: str = "ORGANIC_FOOD"
    quantity_tons: float = 10.0
    contamination_pct: float = 5.0
    lat: float
    lng: float

class FacilityIn(BaseModel):
    name: str
    technology_type: str = "ANAEROBIC_DIGESTION"
    capacity_tons_daily: float = 100.0
    max_contamination_pct: float = 20.0
    processing_ef_tco2e_per_ton: float = 0.05
    conversion_yield_factor: float = 0.45
    lat: float
    lng: float

class ShipmentCreate(BaseModel):
    shipment_uuid: str
    generator_id: str
    facility_id: str

@app.get("/")
def health_check():
    return {"status": "online", "system": "Waste-to-Carbon Value Chain Tracker with PostGIS"}

@app.get("/dashboard", include_in_schema=False)
def get_dashboard():
    return FileResponse("templates/index.html")

# 1. Generator Management (PostGIS-backed)
@app.post("/generators")
def add_generator(gen: GeneratorIn):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM generators;")
    count = cur.fetchone()["count"]
    gid = f"gen_{count + 1}"
    
    cur.execute("""
        INSERT INTO generators (id, org_id, name, location, primary_waste_type_id)
        VALUES (%s, 'org_pilot', %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), 'wt_food')
        RETURNING id, name;
    """, (gid, gen.name, gen.lng, gen.lat))
    created = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return created

@app.get("/generators")
def list_generators():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            id, name, 
            ST_Y(location::geometry) AS lat, 
            ST_X(location::geometry) AS lng 
        FROM generators;
    """)
    gens = cur.fetchall()
    cur.close()
    conn.close()
    return gens

# 2. Facility Management (PostGIS-backed)
@app.post("/facilities")
def add_facility(fac: FacilityIn):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM facilities;")
    count = cur.fetchone()["count"]
    fid = f"fac_{count + 1}"

    cur.execute("""
        INSERT INTO facilities (
            id, org_id, name, technology_type, location, 
            capacity_tons_daily, max_contamination_pct, 
            processing_ef_tco2e_per_ton, conversion_yield_factor
        )
        VALUES (%s, 'org_pilot', %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s)
        RETURNING id, name;
    """, (
        fid, fac.name, fac.technology_type, fac.lng, fac.lat,
        fac.capacity_tons_daily, fac.max_contamination_pct,
        fac.processing_ef_tco2e_per_ton, fac.conversion_yield_factor
    ))
    created = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return created

@app.get("/facilities")
def list_facilities():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            id, name, technology_type, capacity_tons_daily,
            max_contamination_pct, processing_ef_tco2e_per_ton,
            ST_Y(location::geometry) AS lat, 
            ST_X(location::geometry) AS lng 
        FROM facilities;
    """)
    facs = cur.fetchall()
    cur.close()
    conn.close()
    return facs

# 3. Carbon-Aware Facility Matching (Using PostGIS ST_Distance Geodesic)
@app.get("/facilities/match")
def match_facilities(generator_id: str = "gen_1", tonnage: float = 10.0):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id, name, location FROM generators WHERE id = %s", (generator_id,))
    generator = cur.fetchone()
    if not generator:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Generator not found")

    query = """
        SELECT 
            f.id AS facility_id,
            f.name AS facility_name,
            f.technology_type,
            f.processing_ef_tco2e_per_ton,
            ROUND((ST_Distance(f.location, g.location) / 1000.0)::numeric, 2) AS distance_km
        FROM facilities f, generators g
        WHERE g.id = %s
    """
    cur.execute(query, (generator_id,))
    facilities = cur.fetchall()

    ranked = []
    ef_truck = 0.90  # 0.90 kg CO2e / km

    for fac in facilities:
        dist = float(fac["distance_km"])
        proc_factor = float(fac["processing_ef_tco2e_per_ton"])

        # Transport emissions = distance (km) * factor (kg/km) / 1000
        transport_tco2e = round(dist * ef_truck / 1000.0, 4)
        # Processing emissions = tonnage * factor (tCO2e/ton)
        proc_tco2e = round(tonnage * proc_factor, 4)
        total_carbon_cost = round(transport_tco2e + proc_tco2e, 4)

        ranked.append({
            "facility_id": fac["facility_id"],
            "facility_name": fac["facility_name"],
            "technology_type": fac["technology_type"],
            "distance_km": dist,
            "transport_emissions_tCO2e": transport_tco2e,
            "processing_emissions_tCO2e": proc_tco2e,
            "total_emissions_penalty": total_carbon_cost
        })

    # Sort lowest carbon penalty first
    ranked.sort(key=lambda x: x["total_emissions_penalty"])
    cur.close()
    conn.close()
    return ranked

# 4. Idempotent Shipment Logging (Enforcing Unique Source Lots)
@app.post("/shipments")
def create_shipment(payload: ShipmentCreate):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT shipment_uuid, status FROM shipments WHERE shipment_uuid = %s", (payload.shipment_uuid,))
    existing = cur.fetchone()
    if existing:
        cur.close()
        conn.close()
        return {"status": "ALREADY_SYNCED", "shipment_uuid": payload.shipment_uuid}

    lot_id = f"LOT-{payload.shipment_uuid}"
    cur.execute("""
        INSERT INTO shipments (
            id, shipment_uuid, source_lot_id, generator_id, 
            facility_id, waste_type_id, declared_weight_tons, status
        )
        VALUES (%s, %s, %s, %s, %s, 'wt_food', 10.0, 'CREATED')
    """, (payload.shipment_uuid, payload.shipment_uuid, lot_id, payload.generator_id, payload.facility_id))

    conn.commit()
    cur.close()
    conn.close()
    return {"status": "CREATED", "shipment_uuid": payload.shipment_uuid, "source_lot_id": lot_id}

class ShipmentVerifyIn(BaseModel):
    actual_weight_tons: float
    operator_notes: Optional[str] = None
    weigh_station_id: Optional[str] = "SCALE-BAY-01"
    operator_id: Optional[str] = "OP-DEFAULT"

@app.get("/shipments/{shipment_uuid}")
def get_shipment(shipment_uuid: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT s.*, 
               g.name AS generator_name,
               f.name AS facility_name,
               wt.name AS waste_type_name
        FROM shipments s
        JOIN generators g ON s.generator_id = g.id
        JOIN facilities f ON s.facility_id = f.id
        LEFT JOIN waste_types wt ON s.waste_type_id = wt.id
        WHERE s.shipment_uuid = %s
    """, (shipment_uuid,))
    shipment = cur.fetchone()
    cur.close()
    conn.close()

    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    return {
        "shipment_uuid": shipment["shipment_uuid"],
        "source_lot_id": shipment["source_lot_id"],
        "generator_id": shipment["generator_id"],
        "generator_name": shipment["generator_name"],
        "facility_id": shipment["facility_id"],
        "facility_name": shipment["facility_name"],
        "waste_type_id": shipment["waste_type_id"],
        "declared_waste_type": shipment.get("waste_type_name") or "Organic Commercial Food Waste",
        "expected_weight_tons": float(shipment["declared_weight_tons"]),
        "status": shipment["status"]
    }

@app.post("/shipments/{shipment_uuid}/verify")
def verify_shipment_intake(shipment_uuid: str, payload: ShipmentVerifyIn):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT s.*, g.name AS generator_name, f.name AS facility_name
        FROM shipments s
        JOIN generators g ON s.generator_id = g.id
        JOIN facilities f ON s.facility_id = f.id
        WHERE s.shipment_uuid = %s
    """, (shipment_uuid,))
    shipment = cur.fetchone()

    if not shipment:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Shipment not found")

    expected_tons = float(shipment["declared_weight_tons"])
    actual_tons = float(payload.actual_weight_tons)
    diff_tons = round(actual_tons - expected_tons, 3)
    deviation_pct = round((abs(diff_tons) / expected_tons) * 100.0, 2) if expected_tons > 0 else 0.0
    requires_audit = deviation_pct > 10.0
    new_status = "AUDIT_REQUIRED" if requires_audit else "VERIFIED"

    # Update shipment status
    cur.execute("""
        UPDATE shipments 
        SET status = %s
        WHERE shipment_uuid = %s
    """, (new_status, shipment_uuid))
    conn.commit()

    # Generate verification proof hash
    proof_raw = f"{shipment_uuid}|{expected_tons}|{actual_tons}|{deviation_pct}|{new_status}"
    proof_hash = hashlib.sha256(proof_raw.encode()).hexdigest()

    cur.close()
    conn.close()

    return {
        "success": True,
        "message": "Weight Discrepancy Detected - Requires Manual Audit." if requires_audit else "Intake weight verified successfully.",
        "verification_id": f"VRF-{shipment_uuid[:6].upper()}",
        "shipment_uuid": shipment_uuid,
        "status": new_status,
        "expected_weight_tons": expected_tons,
        "actual_weight_tons": actual_tons,
        "deviation_percentage": deviation_pct,
        "requires_manual_audit": requires_audit,
        "proof_hash": f"0x{proof_hash[:16]}",
        "verified_at": "2026-09-12T14:00:00Z"
    }


# 5. Versioned MRV Engine & Tamper-Evident SHA-256 Certificate Generation
@app.post("/carbon/calculate")
def calculate_carbon(shipment_uuid: str):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT s.*, 
               ROUND((ST_Distance(f.location, g.location) / 1000.0)::numeric, 2) AS distance_km,
               f.processing_ef_tco2e_per_ton,
               f.conversion_yield_factor
        FROM shipments s
        JOIN facilities f ON s.facility_id = f.id
        JOIN generators g ON s.generator_id = g.id
        WHERE s.shipment_uuid = %s
    """, (shipment_uuid,))
    shipment = cur.fetchone()

    if not shipment:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Shipment not found")

    cur.execute("SELECT * FROM carbon_calculations WHERE shipment_id = %s", (shipment_uuid,))
    calc = cur.fetchone()

    if not calc:
        diverted = float(shipment["declared_weight_tons"])
        dist_km = float(shipment["distance_km"])
        proc_ef = float(shipment["processing_ef_tco2e_per_ton"])
        yield_factor = float(shipment["conversion_yield_factor"])

        # IPCC Tier 2 / Project Formulas
        avoided_methane = round(diverted * 0.8000, 4)
        displacement = round(diverted * yield_factor * 0.1000, 4)
        transport = round((dist_km * 0.90) / 1000.0, 4)
        processing = round(diverted * proc_ef, 4)
        net_benefit = round(avoided_methane + displacement - transport - processing, 4)

        cert_id = f"CERT-{shipment_uuid[:8].upper()}"
        version_id = "IPCC-2019-Tier2-v1.0"

        # SHA-256 Proof-of-Audit Hash
        hash_payload = f"{shipment_uuid}|{cert_id}|{net_benefit}|{version_id}"
        evidence_hash = hashlib.sha256(hash_payload.encode()).hexdigest()

        cur.execute("""
            INSERT INTO carbon_calculations (
                id, shipment_id, calculation_version_id, diverted_waste_tons,
                avoided_landfill_tco2e, displacement_tco2e, transport_emissions_tco2e,
                processing_emissions_tco2e, net_climate_benefit_tco2e, evidence_hash
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            cert_id, shipment_uuid, version_id, diverted, avoided_methane,
            displacement, transport, processing, net_benefit, evidence_hash
        ))
        calc = cur.fetchone()
        conn.commit()

    cur.close()
    conn.close()

    return {
        "certificate_id": calc["id"],
        "label": calc["label"],
        "diverted_tons": float(calc["diverted_waste_tons"]),
        "avoided_landfill_tCO2e": float(calc["avoided_landfill_tco2e"]),
        "displacement_tCO2e": float(calc["displacement_tco2e"]),
        "transport_tCO2e": float(calc["transport_emissions_tco2e"]),
        "processing_tCO2e": float(calc["processing_emissions_tco2e"]),
        "net_climate_benefit_tCO2e": float(calc["net_climate_benefit_tco2e"]),
        "evidence_hash": calc["evidence_hash"],
        "calculation_version_id": calc["calculation_version_id"]
    }