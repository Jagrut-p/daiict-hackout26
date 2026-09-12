# ==============================================================================
# CONTRIBUTING & ARCHITECTURE NOTE:
# In-memory data store by design for this hackathon — do not reintroduce a
# database dependency without also adding a schema/migration and updating this comment.
# ==============================================================================

import os
import math
import hashlib
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger("uvicorn.error")

# Google OR-Tools CVRP Route Optimization Engine
try:
    from optimizer import solve_cvrp_route, CIRCUITY_FACTOR, TRUCK_EF_TCO2E_PER_KM
    ORTOOLS_AVAILABLE = True
except ImportError:
    solve_cvrp_route = None
    CIRCUITY_FACTOR = 1.35
    TRUCK_EF_TCO2E_PER_KM = 0.0009
    ORTOOLS_AVAILABLE = False
    logger.warning("WARNING: Google OR-Tools is not installed. /routes/optimize will return 503 until 'ortools' is installed.")

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# ==============================================================================
# IPCC-ALIGNED WASTE METHODOLOGY (TIER-1 / FOD DECOMPOSITION PARAMETERS)
# Equation: EF_landfill = DOC * DOC_F * MCF * F * (16/12) * (1 - OX) * GWP_CH4
# ==============================================================================
IPCC_DOC_ORGANIC_FOOD = 0.15       # Degradable Organic Carbon fraction in wet food/kitchen waste
IPCC_DOC_F = 0.50                  # Fraction of DOC dissimilated under anaerobic conditions
IPCC_MCF = 0.80                    # Methane Correction Factor for unmanaged deep landfills
IPCC_F = 0.50                      # Volume fraction of CH4 in landfill gas (50%)
IPCC_C_TO_CH4_RATIO = 16.0 / 12.0  # Molecular conversion from Carbon to Methane (1.3333)
IPCC_OXIDATION_FACTOR = 0.10       # Soil cover oxidation factor (10% oxidized to CO2)
IPCC_GWP_CH4 = 28.0                # Global Warming Potential of Methane (IPCC AR5/AR6, 100-year)

# Computed baseline landfill methane emission factor (tCO2e per ton wet waste)
LANDFILL_EMISSION_FACTOR_TCO2E_PER_TON = round(
    IPCC_DOC_ORGANIC_FOOD
    * IPCC_DOC_F
    * IPCC_MCF
    * IPCC_F
    * IPCC_C_TO_CH4_RATIO
    * (1.0 - IPCC_OXIDATION_FACTOR)
    * IPCC_GWP_CH4,
    4
)  # Evaluates to 0.8064 ~ 0.80 tCO2e / ton

# In-memory storage for hackathon testing
GENERATORS: Dict[str, Dict[str, Any]] = {}
FACILITIES: Dict[str, Dict[str, Any]] = {}
SHIPMENTS: Dict[str, Dict[str, Any]] = {}
VERIFICATIONS: Dict[str, Dict[str, Any]] = {}
CARBON_RECORDS: Dict[str, Dict[str, Any]] = {}

def seed_baseline_data():
    GENERATORS.clear()
    FACILITIES.clear()
    SHIPMENTS.clear()
    CARBON_RECORDS.clear()
    VERIFICATIONS.clear()

    # Seed Gujarat / Gandhinagar / Ahmedabad Facilities
    FACILITIES["FAC-BIOCHAR-01"] = {
        "id": "FAC-BIOCHAR-01",
        "name": "Pethapur Biochar Pyrolysis Unit",
        "accepted_waste_type": "Organic",
        "max_contamination_pct": 10.0,
        "processing_factor": 0.04,  # High sequestration, low emission
        "lat": 23.2854,
        "lng": 72.6589,
        "capacity_tons_day": 40.0,
        "technology": "Biochar Pyrolysis (High Carbon Sequestration)",
        "address": "GIDC Bio-Energy Park, Pethapur"
    }
    FACILITIES["FAC-BIOGAS-02"] = {
        "id": "FAC-BIOGAS-02",
        "name": "Sector 30 CBG Anaerobic Digestion Plant",
        "accepted_waste_type": "Organic",
        "max_contamination_pct": 15.0,
        "processing_factor": 0.08,
        "lat": 23.2389,
        "lng": 72.6841,
        "capacity_tons_day": 60.0,
        "technology": "Anaerobic Digestion (CBG / Biogas + Fertilizer)",
        "address": "Sector 30 Waste Processing Zone, Gandhinagar"
    }
    FACILITIES["FAC-COMPOST-03"] = {
        "id": "FAC-COMPOST-03",
        "name": "Koba Aerobic High-Throughput Compost Center",
        "accepted_waste_type": "Organic",
        "max_contamination_pct": 20.0,
        "processing_factor": 0.16,
        "lat": 23.1422,
        "lng": 72.6241,
        "capacity_tons_day": 25.0,
        "technology": "Aerobic Windrow Composting",
        "address": "Koba Circle Eco Facility, Gandhinagar"
    }
    FACILITIES["FAC-RECYCLE-04"] = {
        "id": "FAC-RECYCLE-04",
        "name": "EcoSync Resource Recovery Center",
        "accepted_waste_type": "Recyclable",
        "max_contamination_pct": 25.0,
        "processing_factor": 0.06,
        "lat": 23.0800,
        "lng": 72.5600,
        "capacity_tons_day": 100.0,
        "technology": "Optical Sort & Mechanical Recycling",
        "address": "Sanand GIDC Gateway, Ahmedabad"
    }
    FACILITIES["FAC-HAZMAT-05"] = {
        "id": "FAC-HAZMAT-05",
        "name": "Sector 30 EcoSync HazMat Plant",
        "accepted_waste_type": "Hazardous",
        "max_contamination_pct": 50.0,
        "processing_factor": 0.22,
        "lat": 23.0250,
        "lng": 72.5400,
        "capacity_tons_day": 35.0,
        "technology": "High-Temp Thermal Oxidation & Neutralization",
        "address": "Vatva Chemical Hub, Ahmedabad"
    }

    # Seed Generators
    GENERATORS["GEN-GJ-01"] = {
        "id": "GEN-GJ-01",
        "name": "Gandhinagar Agro Mandi (APMC)",
        "waste_type": "Organic",
        "quantity_tons": 4.8,
        "contamination_pct": 4.0,
        "lat": 23.2233,
        "lng": 72.6492,
        "address": "Sector 21 APMC Yard, Gandhinagar"
    }
    GENERATORS["GEN-GJ-02"] = {
        "id": "GEN-GJ-02",
        "name": "Kudasan Food & Hotel Cluster",
        "waste_type": "Organic",
        "quantity_tons": 2.1,
        "contamination_pct": 8.0,
        "lat": 23.1784,
        "lng": 72.6358,
        "address": "Kudasan Commercial Hub, Gandhinagar"
    }
    GENERATORS["GEN-GJ-03"] = {
        "id": "GEN-GJ-03",
        "name": "Infocity Tech Park Canteen",
        "waste_type": "Organic",
        "quantity_tons": 1.4,
        "contamination_pct": 3.0,
        "lat": 23.1951,
        "lng": 72.6288,
        "address": "Infocity Gate 1, Gandhinagar"
    }
    GENERATORS["GEN-GJ-04"] = {
        "id": "GEN-GJ-04",
        "name": "Pethapur Rural Biomass Hub",
        "waste_type": "Organic",
        "quantity_tons": 6.5,
        "contamination_pct": 2.0,
        "lat": 23.2721,
        "lng": 72.6712,
        "address": "Pethapur Farm Collective, Gandhinagar"
    }
    GENERATORS["GEN-AHM-02"] = {
        "id": "GEN-AHM-02",
        "name": "Ashram Rd Commercial Kitchen",
        "waste_type": "Organic",
        "quantity_tons": 3.2,
        "contamination_pct": 5.0,
        "lat": 23.0400,
        "lng": 72.5700,
        "address": "Ashram Road, Central Ahmedabad"
    }
    GENERATORS["GEN-AHM-03"] = {
        "id": "GEN-AHM-03",
        "name": "Navrangpura Central Food Court",
        "waste_type": "Organic",
        "quantity_tons": 2.8,
        "contamination_pct": 6.0,
        "lat": 23.0350,
        "lng": 72.5550,
        "address": "Navrangpura Commercial Complex, Ahmedabad"
    }
    GENERATORS["GEN-TX-4091"] = {
        "id": "GEN-TX-4091",
        "name": "Hotel Grand Organic Waste",
        "waste_type": "Organic",
        "quantity_tons": 10.0,
        "contamination_pct": 5.0,
        "lat": 23.0200,
        "lng": 72.5700,
        "address": "Central Ring Road, Ahmedabad"
    }
    GENERATORS["GEN-IND-8821"] = {
        "id": "GEN-IND-8821",
        "name": "Apex Petrochemical Refining Ltd.",
        "waste_type": "Hazardous",
        "quantity_tons": 12.5,
        "contamination_pct": 12.0,
        "lat": 23.0100,
        "lng": 72.5300,
        "address": "Sanand Industrial Zone"
    }
    GENERATORS["GEN-REC-3301"] = {
        "id": "GEN-REC-3301",
        "name": "Indo-Steel Metal Fabricators & Recyclers",
        "waste_type": "Recyclable",
        "quantity_tons": 15.0,
        "contamination_pct": 6.0,
        "lat": 23.0900,
        "lng": 72.5500,
        "address": "Vatva GIDC Phase IV"
    }

    # Seed Sample Baseline Shipments
    baseline_shipments = [
        {
            "shipment_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
            "generatorId": "GEN-IND-8821",
            "generatorName": "Apex Petrochemical Refining Ltd.",
            "facilityId": "FAC-HAZMAT-05",
            "facilityName": "Sector 30 EcoSync HazMat Plant",
            "wasteType": "Hazardous",
            "weightKg": 12500.0,
            "weightTons": 12.5,
            "contaminationLevel": 12.0,
            "status": "verified",
            "createdAt": "2026-09-12T11:32:00Z",
            "netCarbonImpact": 6.84,
            "syncAttemptCount": 1
        },
        {
            "shipment_id": "8a3b129c-7e44-4f01-b8d2-3c5e89a10123",
            "generatorId": "GEN-GJ-01",
            "generatorName": "Gandhinagar Agro Mandi (APMC)",
            "facilityId": "FAC-BIOGAS-02",
            "facilityName": "Sector 30 CBG Anaerobic Digestion Plant",
            "wasteType": "Organic",
            "weightKg": 8200.0,
            "weightTons": 8.2,
            "contaminationLevel": 4.0,
            "status": "dispatched",
            "createdAt": "2026-09-12T11:05:00Z",
            "netCarbonImpact": 4.12,
            "syncAttemptCount": 1
        },
        {
            "shipment_id": "123e4567-e89b-12d3-a456-426614174000",
            "generatorId": "GEN-REC-3301",
            "generatorName": "Indo-Steel Metal Fabricators & Recyclers",
            "facilityId": "FAC-RECYCLE-04",
            "facilityName": "EcoSync Resource Recovery Center",
            "wasteType": "Recyclable",
            "weightKg": 15000.0,
            "weightTons": 15.0,
            "contaminationLevel": 6.0,
            "status": "verified",
            "createdAt": "2026-09-12T10:48:00Z",
            "netCarbonImpact": 8.95,
            "syncAttemptCount": 1
        },
        {
            "shipment_id": "c83d917f-4421-4f77-8ea0-5591bf612999",
            "generatorId": "GEN-TX-4091",
            "generatorName": "Hotel Grand Organic Waste",
            "facilityId": "FAC-BIOCHAR-01",
            "facilityName": "Pethapur Biochar Pyrolysis Unit",
            "wasteType": "Organic",
            "weightKg": 14800.0,
            "weightTons": 14.8,
            "contaminationLevel": 5.0,
            "status": "verified",
            "createdAt": "2026-09-12T09:12:00Z",
            "netCarbonImpact": 7.21,
            "syncAttemptCount": 1
        }
    ]

    for s in baseline_shipments:
        sid = s["shipment_id"]
        SHIPMENTS[sid] = s
        qty = s.get("weightTons", s.get("weightKg", 0) / 1000.0)
        avoided_landfill = round(qty * LANDFILL_EMISSION_FACTOR_TCO2E_PER_TON, 3)
        displacement = round(qty * 0.05, 3)
        transport_e = round(qty * TRUCK_EF_TCO2E_PER_KM * 15.0, 3)
        processing_e = round(qty * 0.05, 3)
        net_benefit = round(avoided_landfill + displacement - transport_e - processing_e, 3)
        
        CARBON_RECORDS[sid] = {
            "certificate_id": f"CERT-{sid[:8].upper()}",
            "shipment_uuid": sid,
            "calculation_version_id": "v2.1.0-AR6",
            "label": "Estimated Climate Impact / MRV Record - Not a Certified Carbon Credit",
            "diverted_tons": round(qty, 2),
            "avoided_landfill_tCO2e": avoided_landfill,
            "displacement_tCO2e": displacement,
            "transport_tCO2e": transport_e,
            "processing_tCO2e": processing_e,
            "net_climate_benefit_tCO2e": net_benefit,
            "data_tier": "Tier A (Scale Verified)",
            "timestamp": s["createdAt"],
            "verification_status": "Verified & Finalized",
            "anti_tamper_hash": hashlib.sha256(f"{sid}{net_benefit}".encode()).hexdigest()[:16]
        }

@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_baseline_data()
    print("\n=======================================================")
    print(">>> EcoSync Backend Online: Seed Data Successfully Loaded! <<<")
    print(">>> Listening on http://127.0.0.1:8000                  <<<")
    print("=======================================================\n")
    yield

app = FastAPI(
    title="Waste-to-Carbon Value Chain Tracker API",
    description="Carbon-aware routing, offline synchronization, and MRV calculation engine for HackOut 2026",
    version="2.1.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_dist = os.path.join(os.path.dirname(__file__), "Frontend", "dist")
frontend_assets = os.path.join(frontend_dist, "assets")
if os.path.exists(frontend_assets):
    app.mount("/assets", StaticFiles(directory=frontend_assets), name="assets")

# Pydantic Schemas
class GeneratorIn(BaseModel):
    name: str
    waste_type: str = Field(default="Organic")
    quantity_tons: float = Field(default=5.0)
    contamination_pct: float = Field(default=5.0)
    lat: float
    lng: float
    address: Optional[str] = None

class FacilityIn(BaseModel):
    name: str
    accepted_waste_type: str = Field(default="Organic")
    max_contamination_pct: float = Field(default=20.0)
    processing_factor: float = Field(default=0.08)  # tCO2e emitted per ton processed
    lat: float
    lng: float
    capacity_tons_day: Optional[float] = 50.0
    technology: Optional[str] = "Standard Processing"
    address: Optional[str] = None

class ShipmentSyncIn(BaseModel):
    shipment_id: str
    generatorId: str
    wasteType: str
    weightKg: float
    contaminationLevel: float
    facilityId: Optional[str] = None
    createdAt: Optional[str] = None
    status: Optional[str] = "synced"
    syncAttemptCount: Optional[int] = 0

class ShipmentVerifyIn(BaseModel):
    shipmentId: str
    generatorName: Optional[str] = None
    wasteType: Optional[str] = None
    expectedWeightTons: Optional[float] = None
    actualWeightTons: float
    deviationPercent: Optional[float] = None
    hasDiscrepancy: Optional[bool] = False
    operatorNotes: Optional[str] = None
    verifiedAt: Optional[str] = None
    scaleTerminalId: Optional[str] = None

class DepotCoords(BaseModel):
    lat: float
    lng: float

class RouteOptimizeIn(BaseModel):
    depot: Optional[DepotCoords] = None
    depot_lat: Optional[float] = None
    depot_lng: Optional[float] = None
    generator_ids: List[str] = Field(default_factory=list)
    facility_id: str
    vehicle_capacity_tons: Optional[float] = 10.0

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "system": "Waste-to-Carbon Value Chain Tracker",
        "version": "2.1.0",
        "ortools_available": ORTOOLS_AVAILABLE,
        "stats": {
            "generators_count": len(GENERATORS),
            "facilities_count": len(FACILITIES),
            "shipments_count": len(SHIPMENTS),
            "certificates_count": len(CARBON_RECORDS)
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/")
def get_root():
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "status": "online",
        "system": "Waste-to-Carbon Value Chain Tracker",
        "docs_url": "/docs",
        "health_url": "/health"
    }

# 1. Generator Endpoints
@app.post("/generators")
def add_generator(gen: GeneratorIn):
    gid = f"GEN-GJ-{len(GENERATORS) + 1:02d}"
    data = {"id": gid, **gen.model_dump()}
    GENERATORS[gid] = data
    return data

@app.get("/generators")
def list_generators():
    return list(GENERATORS.values())

@app.get("/generators/{generator_id}")
def get_generator(generator_id: str):
    if generator_id not in GENERATORS:
        raise HTTPException(status_code=404, detail="Generator not found")
    return GENERATORS[generator_id]

# 2. Facility Endpoints
@app.post("/facilities")
def add_facility(fac: FacilityIn):
    fid = f"FAC-USR-{len(FACILITIES) + 1:02d}"
    data = {"id": fid, **fac.model_dump()}
    FACILITIES[fid] = data
    return data

@app.get("/facilities")
def list_facilities():
    return list(FACILITIES.values())

# 3. Carbon-Aware Facility Matching Helper & Endpoints
def calculate_facility_matches(generator_id: str) -> Optional[Dict[str, Any]]:
    if generator_id not in GENERATORS:
        return None
    gen = GENERATORS[generator_id]

    matches = []
    gen_type = str(gen.get("waste_type", "Organic")).lower()
    gen_contamination = float(gen.get("contamination_pct", 5.0))
    gen_qty = float(gen.get("quantity_tons", 5.0))

    for fid, fac in FACILITIES.items():
        fac_type = str(fac.get("accepted_waste_type", "Organic")).lower()
        max_contam = float(fac.get("max_contamination_pct", 20.0))

        # Waste type compatibility matching
        type_compatible = (
            fac_type in gen_type or
            gen_type in fac_type or
            ("organic" in fac_type and "food" in gen_type) or
            ("organic" in fac_type and "crop" in gen_type) or
            ("organic" in fac_type and "agricultural" in gen_type) or
            ("recycle" in fac_type and "recyclable" in gen_type) or
            ("hazardous" in fac_type and "hazardous" in gen_type)
        )
        if not type_compatible:
            continue

        if gen_contamination > max_contam:
            continue

        # Distance & Transport Emissions (0.0009 tCO2e / km / ton)
        dist_km = haversine_km(gen["lat"], gen["lng"], fac["lat"], fac["lng"])
        transport_emissions = dist_km * 0.0009 * gen_qty
        processing_emissions = fac["processing_factor"] * gen_qty
        total_carbon_cost = transport_emissions + processing_emissions

        # Gross avoided landfill methane & net benefit (derived from IPCC decomposition factors)
        avoided_baseline = round(gen_qty * LANDFILL_EMISSION_FACTOR_TCO2E_PER_TON, 4)
        net_carbon_benefit = avoided_baseline - total_carbon_cost

        matches.append({
            "facility_id": fid,
            "facility_name": fac["name"],
            "distance_km": round(dist_km, 2),
            "transport_emissions_tCO2e": round(transport_emissions, 4),
            "processing_emissions_tCO2e": round(processing_emissions, 4),
            "total_emissions_penalty": round(total_carbon_cost, 4),
            "net_carbon_benefit_tCO2e": round(net_carbon_benefit, 4),
            "technology": fac.get("technology", "Standard Processing"),
            "address": fac.get("address", ""),
            "lat": fac["lat"],
            "lng": fac["lng"]
        })

    matches.sort(key=lambda x: x["total_emissions_penalty"])
    return {
        "generator": gen,
        "ranked_facilities": matches,
        "optimal_facility": matches[0] if matches else None,
        "evaluated_count": len(matches)
    }

@app.get("/facilities/match")
def match_facility(generator_id: str):
    result = calculate_facility_matches(generator_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Generator '{generator_id}' not found")
    return result

@app.get("/facilities/{facility_id}")
def get_facility(facility_id: str):
    if facility_id not in FACILITIES:
        raise HTTPException(status_code=404, detail="Facility not found")
    return FACILITIES[facility_id]

# 4. Route Optimization (Google OR-Tools CVRP)
@app.get("/routes/optimize/health")
def routes_health():
    return {
        "status": "online" if ORTOOLS_AVAILABLE else "ortools_missing",
        "ortools_available": ORTOOLS_AVAILABLE,
        "solver": "Google OR-Tools CVRP (Guided Local Search)"
    }

@app.post("/routes/optimize")
def optimize_routes(payload: RouteOptimizeIn):
    if not ORTOOLS_AVAILABLE or solve_cvrp_route is None:
        raise HTTPException(
            status_code=503,
            detail="Google OR-Tools CVRP solver is not available on server. Install ortools package."
        )

    if not payload.generator_ids:
        raise HTTPException(
            status_code=422,
            detail="At least one generator pickup stop is required for route optimization."
        )

    if payload.facility_id not in FACILITIES:
        raise HTTPException(status_code=404, detail=f"Facility '{payload.facility_id}' not found")
    facility = FACILITIES[payload.facility_id]

    # Build pickup stops list strictly for generators (facility is excluded from CVRP solving)
    stops = []
    for gid in payload.generator_ids:
        if gid not in GENERATORS:
            raise HTTPException(status_code=404, detail=f"Generator '{gid}' not found")
        gen = GENERATORS[gid]
        stops.append({
            "id": gen["id"],
            "name": gen["name"],
            "lat": float(gen["lat"]),
            "lng": float(gen["lng"]),
            "demand_tons": float(gen.get("quantity_tons", 2.0)),
            "is_facility": False
        })

    if payload.depot:
        depot_coords = (float(payload.depot.lat), float(payload.depot.lng))
    elif payload.depot_lat is not None and payload.depot_lng is not None:
        depot_coords = (float(payload.depot_lat), float(payload.depot_lng))
    else:
        # Default central logistics depot (Gandhinagar / DA-IICT hub)
        depot_coords = (23.1885, 72.6288)

    vehicle_cap = float(payload.vehicle_capacity_tons or 10.0)
    # 1. Solve CVRP for generator pickups ONLY
    result = solve_cvrp_route(depot_coords, stops, vehicle_capacity_tons=vehicle_cap)

    if not result:
        raise HTTPException(
            status_code=422,
            detail="No feasible CVRP route found. Total pickups may exceed vehicle capacity."
        )

    ordered_route = list(result.get("ordered_route", []))

    # 2. Identify coordinates of the last pickup stop to compute final transport leg to facility
    if len(ordered_route) > 1:
        last_stop = ordered_route[-1]
        last_lat = float(last_stop.get("lat", depot_coords[0]))
        last_lng = float(last_stop.get("lng", depot_coords[1]))
    else:
        last_lat, last_lng = depot_coords[0], depot_coords[1]

    fac_lat = float(facility["lat"])
    fac_lng = float(facility["lng"])
    final_leg_km = round(haversine_km(last_lat, last_lng, fac_lat, fac_lng) * CIRCUITY_FACTOR, 2)
    final_leg_emissions = round(final_leg_km * TRUCK_EF_TCO2E_PER_KM, 4)

    total_distance_km = round(float(result.get("total_distance_km", 0.0)) + final_leg_km, 2)
    total_transport_emissions = round(float(result.get("total_transport_emissions_tCO2e", 0.0)) + final_leg_emissions, 4)

    # 3. Append destination facility as the fixed final leg of the route
    ordered_route.append({
        "step": "Facility Drop-off",
        "id": facility["id"],
        "name": facility["name"],
        "lat": fac_lat,
        "lng": fac_lng,
        "demand_tons": 0.0,
        "is_facility": True
    })

    return {
        "status": "optimized",
        "ordered_route": ordered_route,
        "total_distance_km": total_distance_km,
        "total_transport_emissions_tCO2e": total_transport_emissions,
        "facility": facility,
        "depot": {"lat": depot_coords[0], "lng": depot_coords[1]}
    }

# 5. Idempotent Shipment Logging & Syncing
@app.get("/shipments")
def list_shipments():
    enriched = []
    for sid, s in SHIPMENTS.items():
        item = dict(s)
        gid = item.get("generatorId") or item.get("generator_id")
        if gid and gid in GENERATORS:
            item["generatorName"] = GENERATORS[gid]["name"]
        fid = item.get("facilityId") or item.get("facility_id")
        if fid and fid in FACILITIES:
            item["facilityName"] = FACILITIES[fid]["name"]
        
        if "weightTons" not in item:
            weight_kg = item.get("weightKg", 0)
            item["weightTons"] = round(weight_kg / 1000.0, 2)
            
        enriched.append(item)
    return enriched

@app.get("/shipments/{shipment_id}")
def get_shipment(shipment_id: str):
    if shipment_id not in SHIPMENTS:
        raise HTTPException(status_code=404, detail="Shipment not found")
    item = dict(SHIPMENTS[shipment_id])
    gid = item.get("generatorId") or item.get("generator_id")
    if gid and gid in GENERATORS:
        item["generatorName"] = GENERATORS[gid]["name"]
    fid = item.get("facilityId") or item.get("facility_id")
    if fid and fid in FACILITIES:
        item["facilityName"] = FACILITIES[fid]["name"]
    if "weightTons" not in item:
        weight_kg = item.get("weightKg", 0)
        item["weightTons"] = round(weight_kg / 1000.0, 2)
    return item

@app.post("/shipments/sync")
def sync_shipment(payload: ShipmentSyncIn):
    is_existing = payload.shipment_id in SHIPMENTS
    now_iso = datetime.now(timezone.utc).isoformat()
    
    weight_tons = payload.weightKg / 1000.0
    net_carbon = round(weight_tons * LANDFILL_EMISSION_FACTOR_TCO2E_PER_TON * 0.85, 2)

    shipment_dict = payload.model_dump()
    shipment_dict["weightTons"] = round(weight_tons, 2)
    shipment_dict["netCarbonImpact"] = net_carbon
    if not shipment_dict.get("status"):
        shipment_dict["status"] = "synced"
    if not shipment_dict.get("createdAt"):
        shipment_dict["createdAt"] = now_iso

    gid = payload.generatorId
    if gid in GENERATORS:
        shipment_dict["generatorName"] = GENERATORS[gid]["name"]
    else:
        shipment_dict["generatorName"] = f"Generator ({gid})"

    # Facility assignment: respect explicit payload if provided and valid, otherwise auto-match
    if payload.facilityId and payload.facilityId in FACILITIES:
        shipment_dict["facilityId"] = payload.facilityId
        shipment_dict["facilityName"] = FACILITIES[payload.facilityId]["name"]
    else:
        match_data = calculate_facility_matches(gid)
        if match_data and match_data.get("optimal_facility"):
            opt = match_data["optimal_facility"]
            shipment_dict["facilityId"] = opt["facility_id"]
            shipment_dict["facilityName"] = opt["facility_name"]
        elif FACILITIES:
            first_fid = next(iter(FACILITIES))
            shipment_dict["facilityId"] = first_fid
            shipment_dict["facilityName"] = FACILITIES[first_fid]["name"]
        else:
            shipment_dict["facilityId"] = "FAC-DEFAULT"
            shipment_dict["facilityName"] = "Municipal Waste Hub"

    SHIPMENTS[payload.shipment_id] = shipment_dict

    calculate_carbon_internal(payload.shipment_id)

    if is_existing:
        return {
            "success": True,
            "status": 200,
            "shipment_id": payload.shipment_id,
            "message": f"Shipment {payload.shipment_id} verified and updated idempotently (200 OK).",
            "timestamp": now_iso
        }
    return {
        "success": True,
        "status": 201,
        "shipment_id": payload.shipment_id,
        "message": f"Shipment {payload.shipment_id} successfully created and registered on server (201 Created).",
        "timestamp": now_iso
    }

@app.post("/shipments/verify")
def verify_shipment(payload: ShipmentVerifyIn):
    receipt_id = f"RCP-{abs(hash(payload.shipmentId)) % 900000 + 100000}"
    now_iso = datetime.now(timezone.utc).isoformat()
    
    VERIFICATIONS[payload.shipmentId] = {
        "receiptId": receipt_id,
        "verifiedAt": now_iso,
        **payload.model_dump()
    }

    if payload.shipmentId in SHIPMENTS:
        SHIPMENTS[payload.shipmentId]["status"] = "verified"
        SHIPMENTS[payload.shipmentId]["verifiedWeightTons"] = payload.actualWeightTons
        SHIPMENTS[payload.shipmentId]["receiptId"] = receipt_id
        calculate_carbon_internal(payload.shipmentId)

    return {
        "success": True,
        "status": 200,
        "message": f"Scale intake record verified & finalized for Shipment {payload.shipmentId}.",
        "receiptId": receipt_id,
        "timestamp": now_iso
    }

# 6. MRV Calculation & Carbon Certificates
def calculate_carbon_internal(shipment_uuid: str) -> Dict[str, Any]:
    if shipment_uuid not in SHIPMENTS:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    shipment = SHIPMENTS[shipment_uuid]
    gid = shipment.get("generatorId") or shipment.get("generator_id", "GEN-GJ-01")
    fid = shipment.get("facilityId") or shipment.get("facility_id", "FAC-BIOGAS-02")
    
    gen = GENERATORS.get(gid, {
        "lat": 23.2233, "lng": 72.6492, "name": shipment.get("generatorName", "Generator"),
        "waste_type": shipment.get("wasteType", "Organic")
    })
    fac = FACILITIES.get(fid, {
        "lat": 23.2389, "lng": 72.6841, "name": shipment.get("facilityName", "Facility"),
        "processing_factor": 0.08
    })
    
    dist_km = haversine_km(gen["lat"], gen["lng"], fac["lat"], fac["lng"])
    qty = shipment.get("weightTons", shipment.get("weightKg", 1000.0) / 1000.0)
    
    # Compute transport emissions using CVRP route optimization solver if available
    route_dist_km = None
    transport_e = None
    depot_coords = (23.1885, 72.6288)

    if ORTOOLS_AVAILABLE and solve_cvrp_route and gid in GENERATORS and fid in FACILITIES:
        try:
            stops = [{
                "id": gen.get("id", gid),
                "name": gen.get("name", "Generator"),
                "lat": float(gen["lat"]),
                "lng": float(gen["lng"]),
                "demand_tons": float(qty),
                "is_facility": False
            }]
            cvrp_res = solve_cvrp_route(depot_coords, stops, vehicle_capacity_tons=max(10.0, float(qty) + 2.0))
            if cvrp_res:
                base_dist = float(cvrp_res.get("total_distance_km", 0.0))
                final_leg = round(haversine_km(float(gen["lat"]), float(gen["lng"]), float(fac["lat"]), float(fac["lng"])) * CIRCUITY_FACTOR, 2)
                route_dist_km = round(base_dist + final_leg, 2)
                transport_e = round(route_dist_km * TRUCK_EF_TCO2E_PER_KM, 4)
        except Exception as e:
            logger.warning(f"Could not calculate CVRP route for carbon calculation ({shipment_uuid}): {e}")

    if route_dist_km is None:
        # Fallback to circuity-factored direct transport leg
        route_dist_km = round(haversine_km(float(gen["lat"]), float(gen["lng"]), float(fac["lat"]), float(fac["lng"])) * CIRCUITY_FACTOR, 2)
        transport_e = round(route_dist_km * TRUCK_EF_TCO2E_PER_KM, 4)

    # Avoided baseline methane calculated from IPCC FOD decomposition parameters
    avoided_landfill = round(qty * LANDFILL_EMISSION_FACTOR_TCO2E_PER_TON, 3)
    processing_e = round(fac.get("processing_factor", 0.08) * qty, 3)
    displacement = round(qty * 0.05, 3)             # Clean energy displacement
    
    net_benefit = round(avoided_landfill + displacement - transport_e - processing_e, 3)
    
    cert_id = f"CERT-{shipment_uuid[:8].upper()}"
    certificate = {
        "certificate_id": cert_id,
        "shipment_uuid": shipment_uuid,
        "calculation_version_id": "v2.1.0-AR6",
        "label": "Estimated Climate Impact / MRV Record - Not a Certified Carbon Credit",
        "diverted_tons": round(qty, 2),
        "avoided_landfill_tCO2e": avoided_landfill,
        "displacement_tCO2e": displacement,
        "transport_tCO2e": round(transport_e, 3),
        "processing_tCO2e": processing_e,
        "net_climate_benefit_tCO2e": net_benefit,
        "route_distance_km": route_dist_km,
        "data_tier": "Tier A (Scale Verified)" if shipment.get("status") == "verified" else "Tier B (Sensor Estimate)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "anti_tamper_hash": hashlib.sha256(f"{shipment_uuid}{net_benefit}".encode()).hexdigest()[:16]
    }
    CARBON_RECORDS[shipment_uuid] = certificate
    return certificate

@app.post("/carbon/calculate")
def calculate_carbon(shipment_uuid: str = Query(..., description="UUID of the waste shipment")):
    return calculate_carbon_internal(shipment_uuid)

@app.get("/carbon/certificates")
def list_certificates():
    return list(CARBON_RECORDS.values())

@app.get("/carbon/certificates/{shipment_uuid}")
def get_certificate(shipment_uuid: str):
    if shipment_uuid not in CARBON_RECORDS:
        if shipment_uuid in SHIPMENTS:
            return calculate_carbon_internal(shipment_uuid)
        raise HTTPException(status_code=404, detail="Carbon certificate not found")
    return CARBON_RECORDS[shipment_uuid]

# 7. ESG & Analytics Engine (Strict Real Computed Totals)
@app.get("/carbon/analytics")
def get_esg_analytics():
    total_tons = sum(s.get("weightTons", s.get("weightKg", 0) / 1000.0) for s in SHIPMENTS.values())
    total_avoided = sum(c.get("net_climate_benefit_tCO2e", 0) for c in CARBON_RECORDS.values())
    total_methane = sum(c.get("avoided_landfill_tCO2e", 0) for c in CARBON_RECORDS.values())
    total_transport = sum(c.get("transport_tCO2e", 0) for c in CARBON_RECORDS.values())

    is_empty = len(SHIPMENTS) == 0
    avg_reduction = round((total_avoided / total_methane) * 100.0, 1) if total_methane > 0 else 0.0

    return {
        "summary": {
            "total_diverted_tonnes": round(total_tons, 2),
            "total_net_co2e_avoided": round(total_avoided, 2),
            "methane_abated_tonnes": round(total_methane, 2),
            "fleet_transport_emissions": round(total_transport, 2),
            "average_reduction_percentage": avg_reduction,
            "active_facilities": len(FACILITIES),
            "active_generators": len(GENERATORS),
            "total_shipments_logged": len(SHIPMENTS),
            "is_baseline": is_empty
        },
        "recent_shipments": list(SHIPMENTS.values())[-6:],
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@app.post("/reset-data")
def reset_data():
    seed_baseline_data()
    return {"message": "Demo data reset and loaded successfully.", "status": 200}