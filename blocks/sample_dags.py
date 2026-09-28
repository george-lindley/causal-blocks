# blocks/sample_dags.py

def start_dag():
    """Single-node DAG to start Duplo play."""
    return [{"name": "X", "color": "blue", "targets": []}]

def sample_dag():
    """
    Small DAG with confounder (Z), treatment (X), and outcome (Y).
    """
    return [
        {"name": "Z", "color": "red", "targets": ["X", "Y"]},      # Confounder
        {"name": "X", "color": "blue", "targets": ["Y"]},          # Treatment
        {"name": "Y", "color": "green", "targets": []},            # Outcome
    ]

def m_bias_dag():
    """
    M-bias DAG with collider (M). Classic example where controlling 
    for M makes things worse, not better!
    
    Structure: U1 → X, M ← U2 → Y
    No direct path X → Y, so true causal effect = 0
    """
    return [
        {"name": "U1", "color": "green", "targets": ["X", "M"]},   # Hidden confounder 1
        {"name": "U2", "color": "white", "targets": ["M", "Y"]},   # Hidden confounder 2
        {"name": "X", "color": "blue", "targets": []},             # Treatment (no direct effect)
        {"name": "M", "color": "red", "targets": []},              # Collider (DON'T control for this!)
        {"name": "Y", "color": "purple", "targets": []},           # Outcome
    ]

