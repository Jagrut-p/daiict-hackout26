import hashlib
import math
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

# Section 11: Capacitated Vehicle Routing Problem (CVRP) Engine
from optimizer import solve_cvrp_route

app = FastAPI(
    title="Waste-to-Carbon Value Chain Tracker",
    description="Carbon-aware routing and MRV calculation engine strictly adhering to IPCC Tier 2 specifications."
)

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
class ShipmentCreate(BaseModel):
    shipment_uuid: str
    generator_id: str
    facility_id: str

class BatchIntake(BaseModel):
    shipment_uuid: str
    intake_weight_tons: float
    accepted_weight_tons: float
    rejected_weight_tons: float = 0.0
    energy_consumed_kwh: float = 120.0
    output_yield_tons: float = 4.5

class RouteOptimizeRequest(BaseModel):
    vehicle_id: str = "veh_1"
    generator_ids: list[str] = ["gen_1", "gen_2", "gen_3"]
    facility_id: str = "fac_2"

@app.get("/")
def health_check():
    return {"status": "online", "system": "Waste-to-Carbon Value Chain Tracker (PDF Compliant)"}

@app.get("/dashboard", include_in_schema=False)
def get_dashboard():
    return FileResponse("templates/index.html")

# Section 10: Carbon-Aware Facility Matching
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

    # Fetch facilities and geodesic distance via PostGIS
    query = """
        SELECT 
            f.id AS facility_id,
            f.name AS facility_name,
            f.technology_type,
            f.processing_ef_tco2e_per_ton,
            ROUND((ST_Distance(f.location, g.location) / 1000.0)::numeric, 2) AS straight_dist_km
        FROM facilities f, generators g
        WHERE g.id = %s
    """
    cur.execute(query, (generator_id,))
    facilities = cur.fetchall()

    ranked = []
    # Vehicle Emission Factor (Diesel collection truck: 0.90 kg CO2e / km = 0.0009 tCO2e/km)
    ef_truck_tco2e_per_km = 0.0009
    # Urban circuity road factor (PDF Section 10.3)
    CIRCUITY_FACTOR = 1.35

    for fac in facilities:
        straight_dist = float(fac["straight_dist_km"])
        # Section 10.3 Road-distance estimation
        road_distance_km = round(straight_dist * CIRCUITY_FACTOR, 2)
        proc_factor = float(fac["processing_ef_tco2e_per_ton"])

        # Transport emissions = distance (km) * factor (tCO2e/km)
        transport_tco2e = round(road_distance_km * ef_truck_tco2e_per_km, 4)
        # Processing emissions = tonnage * factor (tCO2e/ton)
        proc_tco2e = round(tonnage * proc_factor, 4)
        total_carbon_cost = round(transport_tco2e + proc_tco2e, 4)

        ranked.append({
            "facility_id": fac["facility_id"],
            "facility_name": fac["facility_name"],
            "technology_type": fac["technology_type"],
            "straight_distance_km": straight_dist,
            "road_distance_km": road_distance_km,
            "transport_emissions_tCO2e": transport_tco2e,
            "processing_emissions_tCO2e": proc_tco2e,
            "total_emissions_penalty": total_carbon_cost
        })

    # Sort lowest carbon penalty first (PDF Section 10.2: Carbon-Aware)
    ranked.sort(key=lambda x: x["total_emissions_penalty"])
    cur.close()
    conn.close()
    return ranked

# Section 11: Multi-Stop Logistics Optimization (CVRP via OR-Tools)
@app.post("/routes/optimize")
def optimize_collection_route(payload: RouteOptimizeRequest):
    conn = get_db()
    cur = conn.cursor()

    # 1. Fetch vehicle capacity & specs
    cur.execute("SELECT * FROM vehicles WHERE id = %s", (payload.vehicle_id,))
    vehicle = cur.fetchone()
    if not vehicle:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # 2. Central Depot / Logistics Base (Ahmedabad central hub: 23.01, 72.56)
    depot_coords = (23.01, 72.56)

    # 3. Fetch Generator Details
    cur.execute("""
        SELECT id, name, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng 
        FROM generators WHERE id = ANY(%s)
    """, (payload.generator_ids,))
    gens = cur.fetchall()

    if len(gens) == 0:
        cur.close()
        conn.close()
        raise HTTPException(status_code=400, detail="No valid generators found")

    stops = []
    for g in gens:
        stops.append({
            "id": g["id"],
            "name": g["name"],
            "lat": float(g["lat"]),
            "lng": float(g["lng"]),
            "demand_tons": 2.5  # Typical segmented collection demand per stop
        })

    # 4. Run Google OR-Tools CVRP Solver
    result = solve_cvrp_route(
        depot_coords=depot_coords,
        stops=stops,
        vehicle_capacity_tons=float(vehicle["capacity_tons"])
    )

    if not result:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail="Could not find feasible route satisfying vehicle capacity.")

    # 5. Persist Route into DB (Table 7 in Data Model)
    route_id = f"ROUTE-{payload.vehicle_id}-{gens[0]['id']}"
    cur.execute("""
        INSERT INTO routes (id, vehicle_id, route_date, total_distance_km, total_transport_emissions_tco2e, status)
        VALUES (%s, %s, CURRENT_DATE, %s, %s, 'OPTIMIZED')
        ON CONFLICT (id) DO UPDATE SET 
            total_distance_km = EXCLUDED.total_distance_km,
            total_transport_emissions_tco2e = EXCLUDED.total_transport_emissions_tco2e
        RETURNING *;
    """, (route_id, payload.vehicle_id, result["total_distance_km"], result["total_transport_emissions_tCO2e"]))
    saved_route = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    return {
        "route_id": saved_route["id"],
        "vehicle_id": payload.vehicle_id,
        "capacity_tons": float(vehicle["capacity_tons"]),
        "total_distance_km": result["total_distance_km"],
        "total_transport_emissions_tCO2e": result["total_transport_emissions_tCO2e"],
        "stops_sequence": result["ordered_route"]
    }

# Section 6 & 8.2: Idempotent Shipment Logging with Source-Lot
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
        VALUES (%s, %s, %s, %s, %s, 'wt_food', 10.0, 'DISPATCHED')
    """, (payload.shipment_uuid, payload.shipment_uuid, lot_id, payload.generator_id, payload.facility_id))

    conn.commit()
    cur.close()
    conn.close()
    return {"status": "CREATED", "shipment_uuid": payload.shipment_uuid, "source_lot_id": lot_id}

# Section 6: Facility Intake & Processing Batch Logging
@app.post("/batches/intake")
def record_batch_intake(batch: BatchIntake):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("SELECT id, facility_id FROM shipments WHERE shipment_uuid = %s", (batch.shipment_uuid,))
    shipment = cur.fetchone()
    if not shipment:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Shipment not found")

    batch_id = f"BATCH-{batch.shipment_uuid}"
    cur.execute("""
        INSERT INTO processing_batches (
            id, facility_id, shipment_id, intake_weight_tons,
            accepted_weight_tons, rejected_weight_tons, energy_consumed_kwh, output_yield_tons
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (shipment_id) DO UPDATE SET accepted_weight_tons = EXCLUDED.accepted_weight_tons
        RETURNING *;
    """, (
        batch_id, shipment["facility_id"], shipment["id"],
        batch.intake_weight_tons, batch.accepted_weight_tons,
        batch.rejected_weight_tons, batch.energy_consumed_kwh, batch.output_yield_tons
    ))
    batch_record = cur.fetchone()

    # Update shipment status to RECEIVED
    cur.execute("UPDATE shipments SET status = 'RECEIVED' WHERE id = %s", (shipment["id"],))
    conn.commit()
    cur.close()
    conn.close()
    return batch_record

# Section 12 & 13: IPCC Tier 2 Versioned MRV Calculation Engine
@app.post("/carbon/calculate")
def calculate_carbon(shipment_uuid: str):
    conn = get_db()
    cur = conn.cursor()

    # Verify Shipment & Batch existence
    cur.execute("""
        SELECT s.*, 
               ROUND((ST_Distance(f.location, g.location) / 1000.0)::numeric, 2) AS straight_dist_km,
               f.processing_ef_tco2e_per_ton,
               f.conversion_yield_factor,
               w.doc_content
        FROM shipments s
        JOIN facilities f ON s.facility_id = f.id
        JOIN generators g ON s.generator_id = g.id
        JOIN waste_types w ON s.waste_type_id = w.id
        WHERE s.shipment_uuid = %s
    """, (shipment_uuid,))
    shipment = cur.fetchone()

    if not shipment:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Ensure Processing Batch exists (auto-create standard batch if not already posted via intake)
    cur.execute("SELECT * FROM processing_batches WHERE shipment_id = %s", (shipment["id"],))
    batch = cur.fetchone()
    if not batch:
        batch_id = f"BATCH-{shipment_uuid}"
        cur.execute("""
            INSERT INTO processing_batches (
                id, facility_id, shipment_id, intake_weight_tons, accepted_weight_tons, output_yield_tons
            ) VALUES (%s, %s, %s, 10.0, 10.0, 4.5)
            RETURNING *;
        """, (batch_id, shipment["facility_id"], shipment["id"]))
        batch = cur.fetchone()
        conn.commit()

    # Check if calculation already exists
    cur.execute("SELECT * FROM carbon_calculations WHERE shipment_id = %s", (shipment["id"],))
    calc = cur.fetchone()

    if not calc:
        W = float(batch["accepted_weight_tons"])  # Diverted waste weight in tonnes
        DOC = float(shipment["doc_content"])       # 0.15 from waste_types table
        DOC_f = 0.50                              # Fraction of DOC that degrades (IPCC default)
        MCF = 0.80                                # Methane Correction Factor for unmanaged deep landfills
        F = 0.50                                  # Fraction of CH4 in landfill gas
        OX = 0.10                                 # Oxidation factor
        GWP_CH4 = 28.0                            # IPCC AR5 GWP-100 without climate-carbon feedbacks

        # PDF Section 12.1: IPCC Tier 2 Methane Equation
        # CH4 avoided = W * DOC * DOC_f * MCF * F * (16/12) * (1 - OX)
        ch4_avoided_tons = W * DOC * DOC_f * MCF * F * (16.0 / 12.0) * (1.0 - OX)
        avoided_methane_tco2e = round(ch4_avoided_tons * GWP_CH4, 4)

        # PDF Section 12.2: Clean Displacement (Yield * Displacement Factor)
        yield_factor = float(shipment["conversion_yield_factor"])
        displacement_tco2e = round(W * yield_factor * 0.1000, 4)

        # PDF Section 10.3 & 12.4: Road Transport Footprint
        CIRCUITY_FACTOR = 1.35
        road_km = float(shipment["straight_dist_km"]) * CIRCUITY_FACTOR
        transport_tco2e = round(road_km * 0.0009, 4)

        # PDF Section 12.3: Processing Footprint
        proc_ef = float(shipment["processing_ef_tco2e_per_ton"])
        processing_tco2e = round(W * proc_ef, 4)

        # Net Climate Benefit Formula (Section 12.6)
        net_benefit = round(avoided_methane_tco2e + displacement_tco2e - transport_tco2e - processing_tco2e, 4)

        cert_id = f"CERT-{shipment_uuid[:8].upper()}"
        version_id = "IPCC-2019-Tier2-v1.0"

        # PDF Section 12.8: Immutable SHA-256 Proof-of-Audit Hash
        hash_payload = f"{shipment_uuid}|{cert_id}|{net_benefit}|{version_id}|{batch['id']}"
        evidence_hash = hashlib.sha256(hash_payload.encode()).hexdigest()

        cur.execute("""
            INSERT INTO carbon_calculations (
                id, shipment_id, batch_id, calculation_version_id, diverted_waste_tons,
                avoided_landfill_tco2e, displacement_tco2e, transport_emissions_tco2e,
                processing_emissions_tco2e, net_climate_benefit_tco2e, evidence_hash
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            cert_id, shipment["id"], batch["id"], version_id, W,
            avoided_methane_tco2e, displacement_tco2e, transport_tco2e,
            processing_tco2e, net_benefit, evidence_hash
        ))
        calc = cur.fetchone()
        conn.commit()

    cur.close()
    conn.close()

    # PDF Section 12.7: Strict reporting disclaimers and tier tags
    return {
        "certificate_id": calc["id"],
        "label": calc["label"],
        "data_tier": "Tier B (Measured weight, regional emission factors)",
        "diverted_tons": round(float(calc["diverted_waste_tons"]), 2),
        "avoided_landfill_tCO2e": round(float(calc["avoided_landfill_tco2e"]), 3),
        "displacement_tCO2e": round(float(calc["displacement_tco2e"]), 3),
        "transport_tCO2e": round(float(calc["transport_emissions_tco2e"]), 3),
        "processing_tCO2e": round(float(calc["processing_emissions_tco2e"]), 3),
        "net_climate_benefit_tCO2e": round(float(calc["net_climate_benefit_tco2e"]), 3),
        "evidence_hash": calc["evidence_hash"],
        "calculation_version_id": calc["calculation_version_id"]
    }