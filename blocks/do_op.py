def do_intervention(df, var, new_value):
    df_copy = df.copy()
    df_copy[var] = new_value
    return df_copy
