from graphviz import Digraph
from IPython.display import display

def draw_duplo_dag(node_defs, save_path=None):
    """
    Draw a DAG as colored blocks (Duplo style) inline in Jupyter.
    
    Parameters
    ----------
    node_defs : list of dicts
        Each dict must have:
            - 'name': node name
            - 'color': node color (any Graphviz color or hex)
            - 'targets': list of node names this node points to
    save_path : str, optional
        If provided, save the DAG as PNG to this path (e.g., 'figures/my_dag.png')
    """
    dot = Digraph(format='png')
    dot.attr(rankdir='LR', bgcolor='white', dpi='300')  # High DPI
    
    # Node styling - rounded by default
    dot.attr('node', 
             style='filled,rounded', 
             shape='box', 
             width='1.8', 
             height='1', 
             fontname='Arial',
             fontsize='13',
             fontcolor='#2c3e50',
             penwidth='2.5')
    
    # Edge styling - cleaner arrows
    dot.attr('edge', 
             arrowsize='0.8',
             penwidth='2.5',
             color='#7f8c8d')
    
    # Add nodes - borders determined by node color
    for node in node_defs:
        if node['color'] == '#fa953d':  # Treatment (orange)
            border_color = '#e67e22'
        elif node['color'] == '#16a085':  # Supporting (teal)
            border_color = '#138d75'
        elif node['color'] == '#e74c3c':  # Highlight (coral)
            border_color = '#c0392b'
        else:  # Neutral/confounders
            border_color = '#95a5a6'
            
        dot.node(node['name'], 
                fillcolor=node['color'],
                color=border_color)
    
    # Add edges
    for node in node_defs:
        for target in node['targets']:
            dot.edge(node['name'], target)
    
    # Save if path provided
    if save_path:
        # Remove .png extension if provided (graphviz adds it)
        if save_path.endswith('.png'):
            save_path = save_path[:-4]
        dot.render(save_path, cleanup=True)  # cleanup=True removes intermediate files
        print(f"DAG saved to {save_path}.png")
    
    display(dot)

def duplo_to_dot(nodes):
    """
    Convert Duplo nodes to DOT graph string for DoWhy to then be able to create the CausalModel.
    
    Parameters
    ----------
    nodes : list of dicts
        Duplo node definitions with 'name' and 'targets'
        
    Returns
    -------
    str
        DOT notation graph string
    """
    edges = []
    for node in nodes:
        for target in node['targets']:
            edges.append(f"{node['name']}->{target}")
    
    dot_string = "digraph{" + "; ".join(edges) + ";}"
    return dot_string

def duplo_to_networkx(nodes):
    """
    Convert Duplo nodes to NetworkX DiGraph for GCM analysis.
    
    Parameters
    ----------
    nodes : list of dicts
        Duplo node definitions with 'name' and 'targets'
        
    Returns
    -------
    networkx.DiGraph
        NetworkX directed graph for use with DoWhy's GCM module
    """
    import networkx as nx
    
    edges = []
    for node in nodes:
        for target in node['targets']:
            edges.append((node['name'], target))
    
    return nx.DiGraph(edges)