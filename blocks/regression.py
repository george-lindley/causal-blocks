# blocks/regression.py
import statsmodels.api as sm

def regression(df, x, y, controls=None):
    """
    Run OLS regression of y on x, optionally with control variables.
    
    Parameters
    ----------
    df : DataFrame
        The dataset
    x : str
        Predictor variable
    y : str
        Outcome variable
    controls : list of str, optional
        Control variables to include
    """
    X_vars = [x] + (controls if controls else [])
    X_mat = sm.add_constant(df[X_vars])
    model = sm.OLS(df[y], X_mat).fit()
    return model