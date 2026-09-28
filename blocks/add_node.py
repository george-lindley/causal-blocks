def add_node(nodes, name, color, targets=None):
    """
    Add a new node to the DAG.
    
    Parameters
    ----------
    nodes : list of dict
        Existing node definitions.
    name : str
        Node name.
    color : str
        Node color.
    targets : list of str
        List of nodes this node points to.
    """
    if targets is None:
        targets = []
    nodes.append({
        "name": name,
        "color": color,
        "targets": targets
    })
    return nodes


def get_node(nodes, name):
    """
    Find a node by name in the DAG.
    
    Parameters
    ----------
    nodes : list of dict
        List of node definitions.
    name : str
        Name of the node to find.
        
    Returns
    -------
    dict
        The node dictionary with matching name.
    """
    return next(node for node in nodes if node["name"] == name)