from graph.builder import build_graph

graph = build_graph()
png_data = graph.get_graph().draw_mermaid_png()

with open("budii_graph.png", "wb") as f:
    f.write(png_data)

print("saved budii_graph.png")