================================================================================
WASTE-TO-CARBON VALUE CHAIN TRACKER
================================================================================

Core Thesis: Carbon-aware waste routing beats distance-first routing. By 
evaluating processing emissions and transport burn prior to dispatch, our 
platform converts traditional waste logistics into an auditable climate asset.

--------------------------------------------------------------------------------
1. PROBLEM & CORE THESIS
--------------------------------------------------------------------------------
Standard municipal waste routing prioritizes the shortest driving distance or 
fixed historical habits. This approach frequently sends waste to facilities 
with insufficient processing standards or high leakage rates, causing 
avoidable methane emissions. 

Our platform inverts this model by introducing Carbon-Aware Routing. Using 
real-time calculation of transport emissions versus avoided landfill methane, 
the system directs waste loads to the facility that yields the highest net 
environmental benefit, even if it requires a longer transport distance.

--------------------------------------------------------------------------------
2. SYSTEM ARCHITECTURE
--------------------------------------------------------------------------------
[ Generator / Collection ] -- (Offline Sync / IndexedDB) --> [ FastAPI Backend ]
                                                                   |
                                                      +------------+------------+
                                                      |                         |
                                                      v                         v
                                             [ OR-Tools CVRP ]        [ In-Memory Ledger ]
                                             (Route Optimizer)       (Idempotent Claims)
                                                      |                         |
                                                      +------------+------------+
                                                                   |
                                                                   v
                                                      [ MRV Certificate Engine ]

--------------------------------------------------------------------------------
3. CORE FEATURES
--------------------------------------------------------------------------------
- Offline-First Collection Form: Mobile interface using client-generated 
  UUIDs (v4) and local storage (IndexedDB/localStorage) to record collection 
  events without cell connectivity. Automatically syncs upon reconnection using 
  idempotent batch requests.
- Carbon-Aware GIS Routing Map: Interactive Leaflet.js map integration 
  visualizing candidate facilities, generator locations, and multi-stop vehicle 
  routes calculated via Google OR-Tools.
- Facility Intake & Verification Terminal: Destination weigh-station interface 
  that validates physical load receipts against declared shipment UUIDs, 
  flagging weight discrepancies exceeding predefined thresholds.
- Immutable MRV Certificate Engine: Generates read-only Measurement, 
  Reporting, and Verification (MRV) audit records with explicit version 
  tracking and non-editable net climate impact metrics.
- Transparent Audit Ledger: Queryable history of all processed shipments 
  ensuring strict data integrity and preventing double-counting of carbon offset 
  claims.
- Executive ESG Dashboard: Aggregate municipal analytics platform visualizing 
  historical carbon reduction, methane avoidance, and efficiency gains over 
  traditional distance-based routing.

--------------------------------------------------------------------------------
4. CLIMATE MATH & CALCULATION ENGINE
--------------------------------------------------------------------------------
Net Climate Benefit (tCO2e) = Avoided Landfill Methane - (Transport Emissions + Processing Emissions)

- Avoided Methane: Calculated based on waste category, moisture, and organic 
  mass fraction.
- Transport Emissions: Calculated using route distance from OR-Tools multiplied 
  by fleet fuel burn rates.
- Processing Emissions: Facility-specific emission rates based on operational 
  energy source and efficiency.

--------------------------------------------------------------------------------
5. TECH STACK
--------------------------------------------------------------------------------
Frontend:
  - Core: React 18, TypeScript, Vite
  - Styling & UI: Tailwind CSS, Lucide React
  - Mapping: Leaflet.js, React-Leaflet
  - Visualization: Recharts
  - Storage & Sync: LocalForage / IndexedDB

Backend:
  - API Framework: Python 3.11+, FastAPI, Uvicorn
  - Optimization Engine: Google OR-Tools (Capacitated Vehicle Routing Problem)
  - Data Store: PostgreSQL via SQLAlchemy, with idempotent UUID deduplication
    (optional PostGIS geography column on generators/facilities — see below)
  - Validation & Models: Pydantic v2

--------------------------------------------------------------------------------
6. SETUP & INSTALLATION
--------------------------------------------------------------------------------
DATABASE SETUP (PostgreSQL — required before starting the backend):
  1. Install PostgreSQL locally (or use a hosted instance) and make sure it's running.
  2. Create the database:
       createdb waste_carbon_db
     (or: psql -U postgres -c "CREATE DATABASE waste_carbon_db;")
  3. (Optional) Set a custom connection string via env var — defaults to
     postgresql://postgres:postgres@localhost:5432/waste_carbon_db :
       export DATABASE_URL="postgresql://<user>:<password>@<host>:5432/waste_carbon_db"
  4. (Optional) If your Postgres server has the `postgis` extension package
     installed, set ENABLE_POSTGIS=true to add a geography column to
     generators/facilities for future spatial queries:
       export ENABLE_POSTGIS=true
     Leave this unset/false for a plain vanilla Postgres install.

BACKEND SETUP (Run from repository root):
  python -m venv venv
  venv\Scripts\activate          # On Linux/macOS: source venv/bin/activate
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000

  *Note: Backend server runs at http://127.0.0.1:8000. Interactive Swagger docs
  are available at http://127.0.0.1:8000/docs. Tables are created automatically
  on first startup, and baseline demo data (facilities/generators/shipments) is
  seeded automatically the first time the database is empty. Use
  POST /reset-data any time to wipe and reload the demo dataset.

  *Note on migrations-reference/: seed_db.py / seed_multistop.py in that folder
  are the ORIGINAL (older) hand-written PostgreSQL/PostGIS schema and are kept
  as historical reference only — they are not run by the app. The live schema
  now lives in models.py (SQLAlchemy) and is created automatically by
  database.init_db() on startup.

FRONTEND SETUP (Run from Frontend/ directory):
  cd Frontend
  npm install
  npm run dev

  *Note: Vite dev server runs at http://localhost:3000 with automatic proxy
  rules forwarding /shipments, /facilities, /generators, /carbon, /routes,
  /reset-data, and /health requests to http://127.0.0.1:8000.

--------------------------------------------------------------------------------
7. FRAUD PREVENTION & CLAIM INTEGRITY
--------------------------------------------------------------------------------
1. Client-Generated UUIDs: Idempotent keys prevent duplicate submissions 
   during network retries.
2. Idempotent Persistent Registry: A unique shipment ID (UUID) is enforced as 
   the primary key of the shipments table in Postgres, preventing duplicate 
   processing or multi-batch double-claiming across server restarts.
3. Weight Discrepancy Auditing: Automatic flagging occurs if destination 
   intake weights deviate from collection origin logs.
4. Version-Locked Certificates: Generated certificates link directly to fixed 
   calculation versions rather than raw editable fields.
================================================================================
