import pandas as pd
import numpy as np

def simulate_data(nodes, n=1000, seed=None):
    """
    Simulate data from a DAG defined by nodes.
    
    Parameters
    ----------
    nodes : list of dicts
        Each dict must have 'name' and 'targets'.
    n : int
        Number of samples
    seed : int, optional
        Random seed for reproducibility
    """
    if seed is not None:
        np.random.seed(seed)
    
    df = pd.DataFrame()
    for node in nodes:
        name = node['name']
        parents = [n for n in nodes if name in n['targets']]
        parent_names = [p['name'] for p in parents]
        
        if not parent_names:
            # Independent variable
            df[name] = np.random.normal(size=n)
        else:
            # Sum of parent values + noise
            df[name] = df[parent_names].sum(axis=1) + np.random.normal(size=n)
    
    return df

