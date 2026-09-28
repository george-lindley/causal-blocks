# blocks/visualize.py
import matplotlib.pyplot as plt
import numpy as np

def plot_regression(data, x, y, model, title=None):
    """
    Plot data points with regression line showing the effect of x on y.
    
    Parameters
    ----------
    data : pandas.DataFrame
        The dataset
    x : str
        X variable name
    y : str  
        Y variable name
    model : fitted model
        Regression model to plot
    title : str, optional
        Plot title
    """
    coef = model.params[x]
    
    plt.figure(figsize=(8, 6))
    plt.scatter(data[x], data[y], alpha=0.6, color='blue')
    
    # For models with controls, we need to show the partial effect
    # Create a line using just the X coefficient and intercept
    x_range = np.linspace(data[x].min(), data[x].max(), 100)
    
    if 'const' in model.params:
        intercept = model.params['const']
    else:
        intercept = 0
    
    # Simple line: intercept + coefficient * X
    # (This shows the X effect holding other variables constant at 0)
    y_line = intercept + coef * x_range
    
    plt.plot(x_range, y_line, color='red', linewidth=2)
    plt.xlabel(x)
    plt.ylabel(y)
    
    if title:
        plt.title(f"{title}\n(Effect: {coef:.4f})")
    else:
        plt.title(f"{y} ~ {x}\n(Effect: {coef:.4f})")
    
    plt.grid(True, alpha=0.3)
    plt.show()


def correlation_heatmap(data, variables=None):
    """
    Create a correlation heatmap.
    
    Parameters
    ----------
    data : pandas.DataFrame
        The dataset
    variables : list of str, optional
        Variables to include. If None, uses all numeric variables.
    """
    if variables:
        corr_data = data[variables]
    else:
        corr_data = data.select_dtypes(include=[np.number])
    
    corr_matrix = corr_data.corr()
    
    plt.figure(figsize=(8, 6))
    plt.imshow(corr_matrix, cmap='coolwarm', vmin=-1, vmax=1)
    plt.colorbar(label='Correlation')
    
    # Add labels
    plt.xticks(range(len(corr_matrix.columns)), corr_matrix.columns, rotation=45)
    plt.yticks(range(len(corr_matrix.columns)), corr_matrix.columns)
    
    # Add correlation values
    for i in range(len(corr_matrix.columns)):
        for j in range(len(corr_matrix.columns)):
            plt.text(j, i, f'{corr_matrix.iloc[i, j]:.2f}', 
                    ha='center', va='center', 
                    color='white' if abs(corr_matrix.iloc[i, j]) > 0.5 else 'black')
    
    plt.title('Correlation Matrix')
    plt.tight_layout()
    plt.show()