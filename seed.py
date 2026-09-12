import requests

BASE_URL = "http://127.0.0.1:8000"

facilities = [
    {
        "name": "Facility A (Near, Dirty Composting)",
        "accepted_waste_type": "organic",
        "max_contamination_pct": 20.0,
        "processing_factor": 0.18,
        "lat": 23.03,
        "lng": 72.58
    },
    {
        "name": "Facility B (Far, Clean Biogas/AD)",
        "accepted_waste_type": "organic",
        "max_contamination_pct": 20.0,
        "processing_factor": 0.05,
        "lat": 23.20,
        "lng": 72.65
    }
]

generator = {
    "name": "Hotel Grand Organic Waste",
    "waste_type": "organic",
    "quantity_tons": 10.0,
    "contamination_pct": 5.0,
    "lat": 23.02,
    "lng": 72.57
}

print("--- Seeding Facilities ---")
for f in facilities:
    res = requests.post(f"{BASE_URL}/facilities", json=f)
    print(f"Added: {res.json().get('id')} -> {f['name']}")

print("\n--- Seeding Generator ---")
res = requests.post(f"{BASE_URL}/generators", json=generator)
print(f"Added: {res.json().get('id')} -> {generator['name']}")

print("\nSeeding complete! Backend is loaded.")