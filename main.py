from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math

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
@app.get("/dashboard", include_in_schema=False)
def get_dashboard():
    return FileResponse("templates/index.html")

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# In-memory storage for hackathon testing
GENERATORS = {}
FACILITIES = {}
SHIPMENTS = {}
CARBON_RECORDS = {}

@app.on_event("startup")
def auto_seed_data():
    # Seed Demo Facilities
    FACILITIES["fac_1"] = {
        "id": "fac_1",
        "name": "Facility A (Near, Dirty Composting)",
        "accepted_waste_type": "organic",
        "max_contamination_pct": 20.0,
        "processing_factor": 0.18,
        "lat": 23.03,
        "lng": 72.58
    }
    FACILITIES["fac_2"] = {
        "id": "fac_2",
        "name": "Facility B (Far, Clean Biogas/AD)",
        "accepted_waste_type": "organic",
        "max_contamination_pct": 20.0,
        "processing_factor": 0.05,
        "lat": 23.20,
        "lng": 72.65
    }
    # Seed Demo Generator
    GENERATORS["gen_1"] = {
        "id": "gen_1",
        "name": "Hotel Grand Organic Waste",
        "waste_type": "organic",
        "quantity_tons": 10.0,
        "contamination_pct": 5.0,
        "lat": 23.02,
        "lng": 72.57
    }
    print("\n>>> Baseline demo data automatically loaded into memory! <<<\n")

# Pydantic Schemas
class GeneratorIn(BaseModel):
    name: str
    waste_type: str
    quantity_tons: float
    contamination_pct: float
    lat: float
    lng: float

class FacilityIn(BaseModel):
    name: str
    accepted_waste_type: str
    max_contamination_pct: float
    processing_factor: float  # tCO2e emitted per ton processed
    lat: float
    lng: float

class ShipmentIn(BaseModel):
    shipment_uuid: str
    generator_id: str
    facility_id: str

@app.get("/")
def health_check():
    return {"status": "online", "system": "Waste-to-Carbon Value Chain Tracker"}

# 1. Generator Management
@app.post("/generators")
def add_generator(gen: GeneratorIn):
    gid = f"gen_{len(GENERATORS) + 1}"
    GENERATORS[gid] = {"id": gid, **gen.model_dump()}
    return GENERATORS[gid]

@app.get("/generators")
def list_generators():
    return list(GENERATORS.values())

# 2. Facility Management
@app.post("/facilities")
def add_facility(fac: FacilityIn):
    fid = f"fac_{len(FACILITIES) + 1}"
    FACILITIES[fid] = {"id": fid, **fac.model_dump()}
    return FACILITIES[fid]

@app.get("/facilities")
def list_facilities():
    return list(FACILITIES.values())

# 3. Carbon-Aware Facility Matching (PDF Sections 1 & 10)
@app.get("/facilities/match")
def match_facility(generator_id: str):
    if generator_id not in GENERATORS:
        raise HTTPException(status_code=404, detail="Generator not found")
    gen = GENERATORS[generator_id]

    matches = []
    for fid, fac in FACILITIES.items():
        # Hard Eligibility Filters
        if fac["accepted_waste_type"] != gen["waste_type"]:
            continue
        if gen["contamination_pct"] > fac["max_contamination_pct"]:
            continue

        # Distance & Transport Emissions (approx. 0.0009 tCO2e / km / ton)
        dist_km = haversine_km(gen["lat"], gen["lng"], fac["lat"], fac["lng"])
        transport_emissions = dist_km * 0.0009 * gen["quantity_tons"]
        processing_emissions = fac["processing_factor"] * gen["quantity_tons"]
        total_carbon_cost = transport_emissions + processing_emissions

        matches.append({
            "facility_id": fid,
            "facility_name": fac["name"],
            "distance_km": round(dist_km, 2),
            "transport_emissions_tCO2e": round(transport_emissions, 4),
            "processing_emissions_tCO2e": round(processing_emissions, 4),
            "total_emissions_penalty": round(total_carbon_cost, 4)
        })

    # Sort lowest carbon penalty first (Carbon-Aware rank)
    matches.sort(key=lambda x: x["total_emissions_penalty"])
    return {"generator": gen, "ranked_facilities": matches}

# 4. Idempotent Shipment Logging (PDF Section 9.2)
@app.post("/shipments")
def create_shipment(payload: ShipmentIn):
    if payload.shipment_uuid in SHIPMENTS:
        return {"status": "already_synced", "shipment": SHIPMENTS[payload.shipment_uuid]}
    SHIPMENTS[payload.shipment_uuid] = payload.model_dump()
    return {"status": "created", "shipment": SHIPMENTS[payload.shipment_uuid]}

# 5. Versioned MRV Engine & Certificate Generation (PDF Sections 6, 12 & 13)
@app.post("/carbon/calculate")
def calculate_carbon(shipment_uuid: str):
    if shipment_uuid not in SHIPMENTS:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    shipment = SHIPMENTS[shipment_uuid]
    gen = GENERATORS[shipment["generator_id"]]
    fac = FACILITIES[shipment["facility_id"]]
    
    dist_km = haversine_km(gen["lat"], gen["lng"], fac["lat"], fac["lng"])
    qty = gen["quantity_tons"]
    
    avoided_landfill = qty * 0.8          # Baseline: 0.8 tCO2e/t avoided
    transport_e = dist_km * 0.0009 * qty
    processing_e = fac["processing_factor"] * qty
    displacement = qty * 0.05             # Clean energy displacement
    
    net_benefit = avoided_landfill + displacement - transport_e - processing_e
    
    certificate = {
        "certificate_id": f"CERT-{shipment_uuid[:8].upper()}",
        "calculation_version_id": "v1.0.0",
        "label": "Estimated Climate Impact / MRV Record - Not a Certified Carbon Credit",
        "diverted_tons": qty,
        "avoided_landfill_tCO2e": round(avoided_landfill, 3),
        "displacement_tCO2e": round(displacement, 3),
        "transport_tCO2e": round(transport_e, 3),
        "processing_tCO2e": round(processing_e, 3),
        "net_climate_benefit_tCO2e": round(net_benefit, 3),
        "data_tier": "Tier C"
    }
    CARBON_RECORDS[shipment_uuid] = certificate
    return certificate