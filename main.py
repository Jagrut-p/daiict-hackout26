import hashlib
import math
from typing import List
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
    description="Carbon-aware routing, CVRP optimization, and MRV calculation engine strictly adhering to IPCC Tier 2 specifications."
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
    generator_ids: List[str] = ["gen_1", "gen_2", "gen_3"]
    facility_id: str = "fac_2"

class OfflineShipmentItem(BaseModel):
    shipment_uuid: str
    generator_id: str
    facility_id: str
    declared_weight_tons: float = 2.5

@app.get("/")
def health_check():
    return {"status": "online", "system": "Waste-to-Carbon Value Chain Tracker (PDF Compliant)"}

@app.get("/dashboard", include_in_schema=False)
def get_dashboard():
    return FileResponse("templates/index.html")

# 1. Carbon-Aware Facility Matching (Section 10 & 10.1 Hard Eligibility Filter)
@app.get("/facilities/match")
def match_facilities(
    generator_id: str = "gen_1", 
    tonnage: float = 10.0, 
    contamination_pct: float = 5.0
):
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            db_cur.execute("""
                SELECT id, name, location, primary_waste_type_id 
                FROM generators 
                WHERE id = %s
            """, (generator_id,))
            generator = db_cur.fetchone()
            if not generator:
                raise HTTPException(status_code=404, detail="Generator not found")

            # Section 10.1 Hard Eligibility Filter matching actual database schema
            query = """
                SELECT 
                    f.id AS facility_id,
                    f.name AS facility_name,
                    f.technology_type,
                    f.processing_ef_tco2e_per_ton,
                    f.capacity_tons_daily,
                    ROUND((ST_Distance(f.location, g.location) / 1000.0)::numeric, 2) AS straight_dist_km
                FROM facilities f, generators g
                WHERE g.id = %s
                  AND f.capacity_tons_daily >= %s
                  AND f.max_contamination_pct >= %s
            """
            db_cur.execute(query, (
                generator_id, 
                tonnage, 
                contamination_pct
            ))
            eligible_facilities = db_cur.fetchall()

    if not eligible_facilities:
        return []

    ranked = []
    ef_truck_tco2e_per_km = 0.0009
    circuity_factor = 1.35

    for fac in eligible_facilities:
        straight_dist = float(fac["straight_dist_km"])
        road_distance_km = round(straight_dist * circuity_factor, 2)
        proc_factor = float(fac["processing_ef_tco2e_per_ton"])

        transport_tco2e = round(road_distance_km * ef_truck_tco2e_per_km, 4)
        proc_tco2e = round(tonnage * proc_factor, 4)
        total_carbon_cost = round(transport_tco2e + proc_tco2e, 4)

        ranked.append({
            "facility_id": fac["facility_id"],
            "facility_name": fac["facility_name"],
            "technology_type": fac["technology_type"],
            "eligibility_status": "COMPATIBLE",
            "straight_distance_km": straight_dist,
            "road_distance_km": road_distance_km,
            "transport_emissions_tCO2e": transport_tco2e,
            "processing_emissions_tCO2e": proc_tco2e,
            "total_emissions_penalty": total_carbon_cost
        })

    ranked.sort(key=lambda x: x["total_emissions_penalty"])
    return ranked

# 2. Multi-Stop Logistics Optimization (CVRP via OR-Tools, Section 11)
@app.post("/routes/optimize")
def optimize_collection_route(payload: RouteOptimizeRequest):
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            db_cur.execute("SELECT * FROM vehicles WHERE id = %s", (payload.vehicle_id,))
            vehicle = db_cur.fetchone()
            if not vehicle:
                raise HTTPException(status_code=404, detail="Vehicle not found")

            depot_coords = (23.01, 72.56)

            db_cur.execute("""
                SELECT id, name, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng 
                FROM generators WHERE id = ANY(%s)
            """, (payload.generator_ids,))
            gens = db_cur.fetchall()

            if len(gens) == 0:
                raise HTTPException(status_code=400, detail="No valid generators found")

            stops = []
            for g in gens:
                stops.append({
                    "id": g["id"],
                    "name": g["name"],
                    "lat": float(g["lat"]),
                    "lng": float(g["lng"]),
                    "demand_tons": 2.5
                })

            result = solve_cvrp_route(
                depot_coords=depot_coords,
                stops=stops,
                vehicle_capacity_tons=float(vehicle["capacity_tons"])
            )

            if not result:
                raise HTTPException(status_code=500, detail="Could not find feasible route satisfying capacity.")

            route_id = f"ROUTE-{payload.vehicle_id}-{gens[0]['id']}"
            db_cur.execute("""
                INSERT INTO routes (id, vehicle_id, route_date, total_distance_km, total_transport_emissions_tco2e, status)
                VALUES (%s, %s, CURRENT_DATE, %s, %s, 'OPTIMIZED')
                ON CONFLICT (id) DO UPDATE SET 
                    total_distance_km = EXCLUDED.total_distance_km,
                    total_transport_emissions_tco2e = EXCLUDED.total_transport_emissions_tco2e
                RETURNING *;
            """, (route_id, payload.vehicle_id, result["total_distance_km"], result["total_transport_emissions_tCO2e"]))
            saved_route = db_cur.fetchone()
            db_conn.commit()

    return {
        "route_id": saved_route["id"],
        "vehicle_id": payload.vehicle_id,
        "capacity_tons": float(vehicle["capacity_tons"]),
        "total_distance_km": result["total_distance_km"],
        "total_transport_emissions_tCO2e": result["total_transport_emissions_tCO2e"],
        "stops_sequence": result["ordered_route"]
    }

# 3. Idempotent Shipment Logging (Section 6 & 8.2)
@app.post("/shipments")
def create_shipment(payload: ShipmentCreate):
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            db_cur.execute("SELECT shipment_uuid, status FROM shipments WHERE shipment_uuid = %s", (payload.shipment_uuid,))
            existing = db_cur.fetchone()
            if existing:
                return {"status": "ALREADY_SYNCED", "shipment_uuid": payload.shipment_uuid}

            lot_id = f"LOT-{payload.shipment_uuid}"
            db_cur.execute("""
                INSERT INTO shipments (
                    id, shipment_uuid, source_lot_id, generator_id, 
                    facility_id, waste_type_id, declared_weight_tons, status
                )
                VALUES (%s, %s, %s, %s, %s, 'wt_food', 10.0, 'DISPATCHED')
            """, (payload.shipment_uuid, payload.shipment_uuid, lot_id, payload.generator_id, payload.facility_id))
            db_conn.commit()

    return {"status": "CREATED", "shipment_uuid": payload.shipment_uuid, "source_lot_id": lot_id}

# 4. Offline Batch Sync (Section 9.2)
@app.post("/shipments/sync")
def sync_offline_shipments(items: List[OfflineShipmentItem]):
    results = []
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            for item in items:
                db_cur.execute("SELECT shipment_uuid FROM shipments WHERE shipment_uuid = %s", (item.shipment_uuid,))
                existing = db_cur.fetchone()
                
                if existing:
                    results.append({"id": item.shipment_uuid, "status": "already_synced"})
                    continue

                lot_id = f"LOT-{item.shipment_uuid}"
                try:
                    db_cur.execute("""
                        INSERT INTO shipments (
                            id, shipment_uuid, source_lot_id, generator_id, 
                            facility_id, waste_type_id, declared_weight_tons, status
                        )
                        VALUES (%s, %s, %s, %s, %s, 'wt_food', %s, 'DISPATCHED')
                    """, (item.shipment_uuid, item.shipment_uuid, lot_id, item.generator_id, item.facility_id, item.declared_weight_tons))
                    db_conn.commit()
                    results.append({"id": item.shipment_uuid, "status": "created"})
                except Exception as e:
                    db_conn.rollback()
                    results.append({"id": item.shipment_uuid, "status": "rejected", "reason": str(e)})

    return results

# 5. Facility Intake & Processing Batch Logging (Section 6)
@app.post("/batches/intake")
def record_batch_intake(batch: BatchIntake):
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            db_cur.execute("SELECT id, facility_id FROM shipments WHERE shipment_uuid = %s", (batch.shipment_uuid,))
            shipment = db_cur.fetchone()
            if not shipment:
                raise HTTPException(status_code=404, detail="Shipment not found")

            batch_id = f"BATCH-{batch.shipment_uuid}"
            db_cur.execute("""
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
            batch_record = db_cur.fetchone()

            db_cur.execute("UPDATE shipments SET status = 'RECEIVED' WHERE id = %s", (shipment["id"],))
            db_conn.commit()

    return batch_record

# 6. IPCC Tier 2 MRV Calculation Engine (Sections 12 & 13)
@app.post("/carbon/calculate")
def calculate_carbon(shipment_uuid: str):
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            db_cur.execute("""
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
            shipment = db_cur.fetchone()

            if not shipment:
                raise HTTPException(status_code=404, detail="Shipment not found")

            db_cur.execute("SELECT * FROM processing_batches WHERE shipment_id = %s", (shipment["id"],))
            batch = db_cur.fetchone()
            if not batch:
                batch_id = f"BATCH-{shipment_uuid}"
                db_cur.execute("""
                    INSERT INTO processing_batches (
                        id, facility_id, shipment_id, intake_weight_tons, accepted_weight_tons, output_yield_tons
                    ) VALUES (%s, %s, %s, 10.0, 10.0, 4.5)
                    RETURNING *;
                """, (batch_id, shipment["facility_id"], shipment["id"]))
                batch = db_cur.fetchone()
                db_conn.commit()

            db_cur.execute("SELECT * FROM carbon_calculations WHERE shipment_id = %s", (shipment["id"],))
            calc = db_cur.fetchone()

            if not calc:
                w_tons = float(batch["accepted_weight_tons"])
                doc = float(shipment["doc_content"])
                doc_f = 0.50
                mcf = 0.80
                f_ch4 = 0.50
                ox = 0.10
                gwp_ch4 = 28.0

                ch4_avoided_tons = w_tons * doc * doc_f * mcf * f_ch4 * (16.0 / 12.0) * (1.0 - ox)
                avoided_methane_tco2e = round(ch4_avoided_tons * gwp_ch4, 4)

                yield_factor = float(shipment["conversion_yield_factor"])
                displacement_tco2e = round(w_tons * yield_factor * 0.1000, 4)

                circuity = 1.35
                road_km = float(shipment["straight_dist_km"]) * circuity
                transport_tco2e = round(road_km * 0.0009, 4)

                proc_ef = float(shipment["processing_ef_tco2e_per_ton"])
                processing_tco2e = round(w_tons * proc_ef, 4)

                net_benefit = round(avoided_methane_tco2e + displacement_tco2e - transport_tco2e - processing_tco2e, 4)

                cert_id = f"CERT-{shipment_uuid[:8].upper()}"
                version_id = "IPCC-2019-Tier2-v1.0"

                hash_payload = f"{shipment_uuid}|{cert_id}|{net_benefit}|{version_id}|{batch['id']}"
                evidence_hash = hashlib.sha256(hash_payload.encode()).hexdigest()

                db_cur.execute("""
                    INSERT INTO carbon_calculations (
                        id, shipment_id, batch_id, calculation_version_id, diverted_waste_tons,
                        avoided_landfill_tco2e, displacement_tco2e, transport_emissions_tco2e,
                        processing_emissions_tco2e, net_climate_benefit_tco2e, evidence_hash
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                """, (
                    cert_id, shipment["id"], batch["id"], version_id, w_tons,
                    avoided_methane_tco2e, displacement_tco2e, transport_tco2e,
                    processing_tco2e, net_benefit, evidence_hash
                ))
                calc = db_cur.fetchone()
                db_conn.commit()

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

# 7. Immutable Certificate Lookup (Section 7.3 & 12.8)
@app.get("/carbon/certificate/{cert_id}")
def get_certificate(cert_id: str):
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            db_cur.execute("SELECT * FROM carbon_calculations WHERE id = %s", (cert_id,))
            calc = db_cur.fetchone()

    if not calc:
        raise HTTPException(status_code=404, detail="Certificate not found")

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
        "calculation_version_id": calc["calculation_version_id"],
        "created_at": str(calc["created_at"])
    }

# 8. Circular-Economy Revenue Ledger Settlement (Section 15.1)
@app.post("/revenue/settle/{shipment_uuid}")
def settle_shipment_revenue(shipment_uuid: str, tipping_fee_inr: float = 1000.0):
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            db_cur.execute("SELECT id, status FROM shipments WHERE shipment_uuid = %s", (shipment_uuid,))
            shipment = db_cur.fetchone()
            if not shipment:
                raise HTTPException(status_code=404, detail="Shipment not found")

            logistics_share = tipping_fee_inr * 0.60
            facility_share = tipping_fee_inr * 0.20
            worker_payout = tipping_fee_inr * 0.10
            platform_fee = tipping_fee_inr * 0.10

            ledger_id = f"REV-{shipment_uuid[:8].upper()}"
            db_cur.execute("""
                INSERT INTO revenue_ledger (
                    id, shipment_id, tipping_fee_inr, platform_fee_inr, worker_payout_inr, status
                )
                VALUES (%s, %s, %s, %s, %s, 'SETTLED')
                ON CONFLICT (id) DO UPDATE SET status = 'SETTLED'
                RETURNING *;
            """, (ledger_id, shipment["id"], tipping_fee_inr, platform_fee, worker_payout))
            entry = db_cur.fetchone()
            db_conn.commit()

    return {
        "ledger_id": entry["id"],
        "shipment_id": shipment["id"],
        "tipping_fee_inr": float(entry["tipping_fee_inr"]),
        "worker_payout_inr": float(entry["worker_payout_inr"]),
        "logistics_inr": logistics_share,
        "facility_inr": facility_share,
        "platform_fee_inr": float(entry["platform_fee_inr"]),
        "status": entry["status"]
    }

# 9. Role-Specific Municipal & ESG Aggregation Analytics (Section 4 & 7.3)
@app.get("/analytics/summary")
def get_analytics_summary():
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            db_cur.execute("""
                SELECT 
                    COALESCE(COUNT(id), 0) AS total_certificates_issued,
                    COALESCE(SUM(diverted_waste_tons), 0) AS total_tonnage_diverted,
                    COALESCE(SUM(avoided_landfill_tco2e), 0) AS cumulative_avoided_landfill_tco2e,
                    COALESCE(SUM(displacement_tco2e), 0) AS cumulative_displacement_tco2e,
                    COALESCE(SUM(transport_emissions_tco2e), 0) AS cumulative_transport_emissions_tco2e,
                    COALESCE(SUM(processing_emissions_tco2e), 0) AS cumulative_processing_emissions_tco2e,
                    COALESCE(SUM(net_climate_benefit_tco2e), 0) AS cumulative_net_climate_benefit_tco2e
                FROM carbon_calculations;
            """)
            carbon_stats = db_cur.fetchone()

            db_cur.execute("""
                SELECT 
                    COALESCE(SUM(tipping_fee_inr), 0) AS total_tipping_fees_inr,
                    COALESCE(SUM(worker_payout_inr), 0) AS total_worker_payouts_inr,
                    COALESCE(SUM(platform_fee_inr), 0) AS total_platform_fees_inr
                FROM revenue_ledger
                WHERE status = 'SETTLED';
            """)
            revenue_stats = db_cur.fetchone()

    return {
        "reporting_period": "FY 2026-Q3",
        "data_tier": "Tier B (Measured weighbridge intake, IPCC Tier 2 parameters)",
        "disclaimer": "Estimated Climate Impact / MRV Record - Not a Certified Carbon Credit",
        "waste_metrics": {
            "total_diverted_tons": round(float(carbon_stats["total_tonnage_diverted"]), 2),
            "certificates_issued": int(carbon_stats["total_certificates_issued"])
        },
        "climate_impact_tCO2e": {
            "gross_avoided_methane": round(float(carbon_stats["cumulative_avoided_landfill_tco2e"]), 3),
            "clean_energy_displacement": round(float(carbon_stats["cumulative_displacement_tco2e"]), 3),
            "transport_footprint_penalty": round(float(carbon_stats["cumulative_transport_emissions_tco2e"]), 3),
            "processing_footprint_penalty": round(float(carbon_stats["cumulative_processing_emissions_tco2e"]), 3),
            "net_climate_benefit": round(float(carbon_stats["cumulative_net_climate_benefit_tco2e"]), 3)
        },
        "circular_economy_inr": {
            "total_settled_turnover_inr": round(float(revenue_stats["total_tipping_fees_inr"]), 2),
            "informal_worker_payouts_inr": round(float(revenue_stats["total_worker_payouts_inr"]), 2),
            "platform_maintenance_fee_inr": round(float(revenue_stats["total_platform_fees_inr"]), 2)
        }
    }

# 10. Spatial Proximity Discovery (Section 7.3)
@app.get("/generators/nearby")
def get_nearby_generators(lat: float = 23.01, lng: float = 72.56, radius_km: float = 15.0):
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            query = """
                SELECT 
                    id, 
                    name, 
                    primary_waste_type_id,
                    ROUND((ST_Distance(location, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) / 1000.0)::numeric, 2) AS distance_km,
                    ST_Y(location::geometry) AS lat,
                    ST_X(location::geometry) AS lng
                FROM generators
                WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s * 1000.0)
                ORDER BY distance_km ASC;
            """
            db_cur.execute(query, (lng, lat, lng, lat, radius_km))
            nearby = db_cur.fetchall()

    return nearby

# 11. Chain-of-Custody Lifecycle Query (Section 7.3 & 8.2)
@app.get("/shipments/{shipment_uuid}")
def get_shipment_status(shipment_uuid: str):
    with get_db() as db_conn:
        with db_conn.cursor() as db_cur:
            query = """
                SELECT 
                    s.id,
                    s.shipment_uuid,
                    s.source_lot_id,
                    s.status,
                    s.declared_weight_tons,
                    g.name AS generator_name,
                    f.name AS facility_name,
                    s.created_at
                FROM shipments s
                JOIN generators g ON s.generator_id = g.id
                JOIN facilities f ON s.facility_id = f.id
                WHERE s.shipment_uuid = %s;
            """
            db_cur.execute(query, (shipment_uuid,))
            record = db_cur.fetchone()

    if not record:
        raise HTTPException(status_code=404, detail="Shipment not found")

    return {
        "shipment_uuid": record["shipment_uuid"],
        "source_lot_id": record["source_lot_id"],
        "status": record["status"],
        "declared_weight_tons": float(record["declared_weight_tons"]),
        "generator": record["generator_name"],
        "destination_facility": record["facility_name"],
        "created_at": str(record["created_at"])
    }
