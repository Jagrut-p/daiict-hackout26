import psycopg2

CONN_STR = "postgresql://postgres:postgres@localhost:5432/waste_carbon_db"

def seed():
    conn = psycopg2.connect(CONN_STR)
    cur = conn.cursor()

    cur.execute("""
        TRUNCATE TABLE revenue_ledger, carbon_calculations, processing_batches, 
        shipments, routes, vehicles, facilities, generators, waste_types, users, organizations CASCADE;
    """)

    cur.execute("""
        INSERT INTO organizations (id, name, org_type)
        VALUES ('org_pilot', 'Gujarat Clean Bio-Grid Pilot', 'COORDINATOR');
    """)

    cur.execute("""
        INSERT INTO waste_types (id, code, name, default_moisture_pct, doc_content, landfill_ef_tco2e_per_ton)
        VALUES ('wt_food', 'ORGANIC_FOOD', 'Commercial Kitchen & Hotel Food Waste', 70.0, 0.15, 0.8000);
    """)

    cur.execute("""
        INSERT INTO generators (id, org_id, name, location, primary_waste_type_id)
        VALUES (
            'gen_1', 
            'org_pilot', 
            'Hotel Grand Ahmedabad', 
            ST_SetSRID(ST_MakePoint(72.57, 23.02), 4326), 
            'wt_food'
        );
    """)

    cur.execute("""
        INSERT INTO facilities (id, org_id, name, technology_type, location, capacity_tons_daily, max_contamination_pct, processing_ef_tco2e_per_ton, conversion_yield_factor)
        VALUES (
            'fac_1', 
            'org_pilot', 
            'Facility A (Near, Open-Windrow Composting)', 
            'COMPOSTING', 
            ST_SetSRID(ST_MakePoint(72.58, 23.03), 4326), 
            50.0, 
            25.0, 
            0.1800, 
            0.1000
        );
    """)

    cur.execute("""
        INSERT INTO facilities (id, org_id, name, technology_type, location, capacity_tons_daily, max_contamination_pct, processing_ef_tco2e_per_ton, conversion_yield_factor)
        VALUES (
            'fac_2', 
            'org_pilot', 
            'Facility B (Far, Clean Biogas / Anaerobic Digestion)', 
            'ANAEROBIC_DIGESTION', 
            ST_SetSRID(ST_MakePoint(72.65, 23.20), 4326), 
            120.0, 
            15.0, 
            0.0500, 
            0.4500
        );
    """)

    cur.execute("""
        INSERT INTO vehicles (id, org_id, registration_no, capacity_tons, fuel_type, emission_factor_kg_per_km)
        VALUES ('veh_1', 'org_pilot', 'GJ-01-CX-4021', 10.0, 'DIESEL', 0.9000);
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("PostGIS database successfully seeded.")

if __name__ == "__main__":
    seed()