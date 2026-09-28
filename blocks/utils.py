# Website Color Palette - UPDATED
COLORS = {
    'primary': '#fa953d',      # Orange - treatment/main brand
    'outcome': '#16a085',      # Teal - outcome variable
    'supporting': '#3498db',   # Blue - supporting elements  
    'highlight': '#e74c3c',    # Coral-red - emphasis
    'neutral': '#95a5a6',      # Light gray - confounders
    'light_bg': '#ecf0f1',     # Light gray - backgrounds
    'dark_text': '#2c3e50',    # Navy - text only
}

# DAG-specific palette (ordered by typical usage)
DAG_PALETTE = [
    COLORS['primary'],      # Treatment (orange)
    COLORS['outcome'],      # Outcome (teal)
    COLORS['supporting'],   # Mediator/Important confounder (blue)
    COLORS['neutral'],      # Other confounders (light gray)
    COLORS['highlight'],    # Special cases (coral)
    '#9b59b6',             # Purple
    '#f39c12',             # Golden
    '#27ae60',             # Green
]

# Seaborn palette (for categorical plots)
SEABORN_PALETTE = [
    COLORS['primary'],      # Orange
    COLORS['outcome'],      # Teal
    COLORS['supporting'],   # Blue
    COLORS['highlight'],    # Coral
    '#9b59b6',             # Purple
    '#f39c12',             # Golden
    '#27ae60',             # Green
    '#e67e22',             # Dark orange
]

def set_seaborn_theme():
    """Set consistent Seaborn theme for all visualizations."""
    try:
        import seaborn as sns
        import matplotlib.pyplot as plt
        
        sns.set_theme(
            style="whitegrid",
            palette=SEABORN_PALETTE,
            context="notebook",
            rc={
                'figure.figsize': (10, 6),
                'axes.labelcolor': COLORS['dark_text'],
                'xtick.color': COLORS['dark_text'],
                'ytick.color': COLORS['dark_text'],
                'grid.color': COLORS['light_bg'],
                'axes.edgecolor': COLORS['neutral'],
            }
        )
    except ImportError:
        # Seaborn not installed, skip styling
        pass
    
def get_dag_colors(n):
    """Get n distinct colors for DAG nodes."""
    if n <= len(DAG_PALETTE):
        return DAG_PALETTE[:n]
    else:
        # Extend with lighter versions if needed
        try:
            import matplotlib.colors as mcolors
            extended = DAG_PALETTE.copy()
            while len(extended) < n:
                base_color = DAG_PALETTE[len(extended) % len(DAG_PALETTE)]
                rgb = mcolors.hex2color(base_color)
                lighter = tuple(min(1, c + 0.2) for c in rgb)
                extended.append(mcolors.rgb2hex(lighter))
            return extended[:n]
        except ImportError:
            # If matplotlib not available, just cycle through palette
            return [DAG_PALETTE[i % len(DAG_PALETTE)] for i in range(n)]

def get_variable_color(var_type='other'):
    """
    Get color for specific variable types in causal diagrams.
    
    Args:
        var_type: 'treatment', 'outcome', 'mediator', 'confounder', or 'other'
    """
    mapping = {
        'treatment': COLORS['primary'],      # Orange
        'outcome': COLORS['outcome'],        # Teal
        'mediator': COLORS['supporting'],    # Blue
        'confounder': COLORS['neutral'],     # Light gray
        'collider': COLORS['highlight'],     # Coral
        'other': COLORS['neutral'],          # Light gray
    }
    return mapping.get(var_type, COLORS['neutral'])