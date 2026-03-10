from langgraph.graph import StateGraph, START, END

from graph.state import GraphState
from graph.nodes.ingest import ingest_event
from graph.nodes.load_patient_config import load_patient_config
from graph.nodes.check_sos import check_sos
from graph.nodes.check_geofence import check_geofence
from graph.nodes.check_medication import check_medication
from graph.nodes.check_inactivity import check_inactivity
from graph.nodes.aggregate_results import aggregate_results
from graph.nodes.create_actions import create_actions
from graph.nodes.persist_results import persist_results


def parallel_router(state: GraphState):
    # returning a list makes these nodes run in parallel
    return [
        "check_sos",
        "check_geofence",
        "check_medication",
        "check_inactivity",
    ]


def build_graph():
    graph = StateGraph(GraphState)

    graph.add_node("ingest_event", ingest_event)
    graph.add_node("load_patient_config", load_patient_config)
    graph.add_node("check_sos", check_sos)
    graph.add_node("check_geofence", check_geofence)
    graph.add_node("check_medication", check_medication)
    graph.add_node("check_inactivity", check_inactivity)
    graph.add_node("aggregate_results", aggregate_results)
    graph.add_node("create_actions", create_actions)
    graph.add_node("persist_results", persist_results)

    graph.add_edge(START, "ingest_event")
    graph.add_edge("ingest_event", "load_patient_config")

    # graph.add_conditional_edges("load_patient_config", parallel_router)
    graph.add_conditional_edges(
    "load_patient_config",
    parallel_router,
    [
        "check_sos",
        "check_geofence",
        "check_medication",
        "check_inactivity",
    ]
)

    # # wait for all four parallel nodes before aggregating
    # graph.add_edge(
    #     ["check_sos", "check_geofence", "check_medication", "check_inactivity"],
    #     "aggregate_results"
    # )
    graph.add_edge("check_sos", "aggregate_results")
    graph.add_edge("check_geofence", "aggregate_results")
    graph.add_edge("check_medication", "aggregate_results")
    graph.add_edge("check_inactivity", "aggregate_results")
    graph.add_edge("aggregate_results", "create_actions")
    graph.add_edge("create_actions", "persist_results")
    graph.add_edge("persist_results", END)

    return graph.compile()