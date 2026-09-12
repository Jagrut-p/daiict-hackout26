import psycopg2

CONN_STR = "postgresql://postgres:postgres@localhost:5432/waste_carbon_db"

def seed_extra():
    conn = psycopg2.connect(CONN_STR)
    cur = conn.cursor()

    # Generator 2 (Commercial Kitchen, Ashram Road: 23.04, 72.57)
    cur.execute("""
        INSERT INTO generators (id, org_id, name, location, primary_waste_type_id)
        VALUES ('gen_2', 'org_pilot', 'Ashram Rd Commercial Kitchen', ST_SetSRID(ST_MakePoint(72.57, 23.04), 4326), 'wt_food')
        ON CONFLICT (id) DO NOTHING;
    """)

    # Generator 3 (Navrangpura Food Court: 23.035, 72.555)
    cur.execute("""
        INSERT INTO generators (id, org_id, name, location, primary_waste_type_id)
        VALUES ('gen_3', 'org_pilot', 'Navrangpura Central Food Court', ST_SetSRID(ST_MakePoint(72.555, 23.035), 4326), 'wt_food')
        ON CONFLICT (id) DO NOTHING;
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Extra generator stops seeded for CVRP testing.")

if __name__ == "__main__":
    seed_extra()