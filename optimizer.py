import math
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

CIRCUITY_FACTOR = 1.35
TRUCK_EF_TCO2E_PER_KM = 0.0009  # 0.90 kg CO2e / km

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def solve_cvrp_route(depot_coords, stops, vehicle_capacity_tons=10.0):
    """
    Solves CVRP for a depot/start point, a series of generator pickups, and a terminal facility.
    - stops: list of dicts with keys: 'id', 'name', 'lat', 'lng', 'demand_tons', 'is_facility'
    """
    # 0 is Depot
    all_locations = [depot_coords] + [(s['lat'], s['lng']) for s in stops]
    num_locations = len(all_locations)
    
    # Distance Matrix in meters (integer matrix required by OR-Tools)
    distance_matrix = []
    for i in range(num_locations):
        row = []
        for j in range(num_locations):
            if i == j:
                row.append(0)
            else:
                dist_km = haversine_km(all_locations[i][0], all_locations[i][1], 
                                       all_locations[j][0], all_locations[j][1]) * CIRCUITY_FACTOR
                row.append(int(round(dist_km * 1000)))
        distance_matrix.append(row)

    # Demands: 0 for depot, demand_tons * 1000 (kg) for stops
    demands = [0] + [int(round(s.get('demand_tons', 0.0) * 1000)) for s in stops]
    vehicle_capacity_kg = int(round(vehicle_capacity_tons * 1000))

    manager = pywrapcp.RoutingIndexManager(num_locations, 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # null capacity slack
        [vehicle_capacity_kg],  # vehicle maximum capacities
        True,  # start cumul to zero
        'Capacity'
    )

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = 2

    solution = routing.SolveWithParameters(search_parameters)

    if not solution:
        return None

    ordered_stops = []
    index = routing.Start(0)
    total_distance_meters = 0

    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        if node == 0:
            ordered_stops.append({"step": "Depot Start", "name": "Central Depot / Fleet Hub"})
        else:
            stop_info = stops[node - 1]
            ordered_stops.append({
                "step": f"Pickup {node}",
                "id": stop_info["id"],
                "name": stop_info["name"],
                "demand_tons": stop_info["demand_tons"],
                "lat": stop_info["lat"],
                "lng": stop_info["lng"]
            })
        previous_index = index
        index = solution.Value(routing.NextVar(index))
        total_distance_meters += routing.GetArcCostForVehicle(previous_index, index, 0)

    total_distance_km = round(total_distance_meters / 1000.0, 2)
    total_transport_emissions = round(total_distance_km * TRUCK_EF_TCO2E_PER_KM, 4)

    return {
        "ordered_route": ordered_stops,
        "total_distance_km": total_distance_km,
        "total_transport_emissions_tCO2e": total_transport_emissions
    }