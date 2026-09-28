# blocks/dowhy_reference.py
# Reference guide for DoWhy methods and workflow

def print_estimation_methods():
    """Print available DoWhy estimation methods and their requirements."""
    print("=== DoWhy Estimation Methods for help estimating the effect in the model ===\n")
    
    print("📊 BACKDOOR METHODS:")
    print("• backdoor.linear_regression")
    print("  - Works with: Continuous or binary treatment")
    print("  - Best for: Linear relationships, continuous outcomes")
    print()
    print("• backdoor.propensity_score_matching")
    print("  - Works with: Binary treatment ONLY")
    print("  - Best for: Non-linear relationships, matching similar units")
    print()
    print("• backdoor.propensity_score_weighting")
    print("  - Works with: Binary treatment ONLY") 
    print("  - Best for: Reweighting to balance treatment groups")
    print()
    print("• backdoor.propensity_score_stratification")
    print("  - Works with: Binary treatment ONLY")
    print("  - Best for: Subclassification analysis")
    print()
    
    print("🎯 INSTRUMENTAL VARIABLE METHODS:")
    print("• iv.instrumental_variable")
    print("  - Works with: Continuous or binary treatment")
    print("  - Requires: Valid instruments in your DAG")
    print("  - Best for: When unobserved confounding suspected")
    print()
    
    print("🚪 OTHER METHODS:")
    print("• frontdoor.two_stage_regression")
    print("  - Requires: Valid mediator variables")
    print("  - Rarely applicable in practice")


def print_refutation_tests():
    """Print available refutation tests for validation."""
    print("=== DoWhy Refutation Tests ===\n")
    
    print("🔍 ROBUSTNESS TESTS:")
    print("• random_common_cause")
    print("  - Adds random confounder to test sensitivity - change should be close to 0")
    print()
    print("• placebo_treatment_refuter") 
    print("  - Replaces treatment with random variable - placebo effect should be close to 0")
    print()
    print("• data_subset_refuter")
    print("  - Tests on random subsets of data - change should be close to 0")
    print()
    print("• add_unobserved_common_cause")
    print("  - Simulates unobserved confounding - change should be close to 0")
    print()
    
    print("🎯 USAGE:")
    print("refutation = model.refute_estimate(estimand, effect, method_name='test_name')")


def print_workflow_reminder():
    """Print the standard DoWhy workflow steps."""
    print("=== DoWhy Workflow ===\n")
    
    print("1️⃣ CREATE MODEL:")
    print("model = CausalModel(data=df, treatment='X', outcome='Y', graph='...')")
    print()
    
    print("2️⃣ IDENTIFY EFFECT:")
    print("estimand = model.identify_effect()")
    print("# Shows all available identification strategies")
    print()
    
    print("3️⃣ ESTIMATE EFFECT:")
    print("effect = model.estimate_effect(estimand, method_name='...')")
    print("# Choose method based on your data type and assumptions")
    print()
    
    print("4️⃣ VALIDATE RESULTS:")
    print("refutation = model.refute_estimate(estimand, effect, method_name='...')")
    print("# Test robustness of your findings")


def print_data_requirements():
    """Print data type requirements for different methods."""
    print("=== Data Requirements ===\n")
    
    print("📈 CONTINUOUS TREATMENT:")
    print("• Use: backdoor.linear_regression")
    print("• Use: iv.instrumental_variable")
    print("• Avoid: All propensity score methods")
    print()
    
    print("🎯 BINARY TREATMENT:")
    print("• Use: Any backdoor method")
    print("• Use: iv.instrumental_variable") 
    print("• Best options: Propensity score methods")
    print()
    
    print("🔧 CHOOSE BASED ON:")
    print("• Treatment type (continuous vs binary)")
    print("• Available identification strategies from DAG")
    print("• Assumptions you're willing to make")
    print("• Sample size and data quality")


def print_dataset_generators():
    """Print available DoWhy synthetic dataset generators."""
    print("=== DoWhy Dataset Generators ===\n")
    
    print("LINEAR_DATASET:")
    print("• Most flexible generator")
    print("• Parameters: beta, num_common_causes, num_instruments, treatment_is_binary")
    print("• Creates: Confounders (W0, W1...), Instruments (Z0, Z1...)")
    print("• Example: dowhy.datasets.linear_dataset(beta=1.5, num_common_causes=2)")
    print()
    
    print("XY_DATASET:")  
    print("• Simple X→Y relationship")
    print("• Parameters: effect (same as beta), sd_error")
    print("• Creates: Just treatment and outcome, no confounders")
    print("• Example: dowhy.datasets.xy_dataset(effect=1.2, sd_error=0.2)")
    print()
    
    print("PARAMETER MEANINGS:")
    print("• beta/effect: True causal effect size")
    print("• num_common_causes: Number of confounders to create")
    print("• num_instruments: Number of instrumental variables")
    print("• sd_error: Standard deviation of noise term")
    print("• treatment_is_binary: Make treatment 0/1 instead of continuous")
    print()
    
    print('GENERATE TALEB EXTREMISTAN DATA IN THE DATASETS')
    
    print('# Pareto (power law)')
    print('np.random.pareto(a=1.16, size=n)  # 80/20 rule')

    print('# Student-t (adjustable tail thickness)')
    print('np.random.standard_t(df=3, size=n)  # df=3 very fat tails, df→∞ approaches normal')

    print('# Levy stable distributions (via scipy)')
    print('from scipy.stats import levy_stable')
    print('levy_stable.rvs(alpha=1.5, beta=0, size=n)  # alpha<2 gives infinite variance')



def dowhy_help(topic=None):
    """
    One-function reference for DoWhy help.
    
    Parameters
    ----------
    topic : str, optional
        Specific topic to show. Options: 'methods', 'tests', 'workflow', 'data', 'datasets', 'all'
        If None, shows available topics.
    """
    
    if topic is None:
        print("Available help topics:")
        print("dowhy_help('methods') - Estimation methods")  
        print("dowhy_help('tests') - Refutation tests")
        print("dowhy_help('workflow') - Standard workflow steps")
        print("dowhy_help('data') - Data requirements")
        print("dowhy_help('datasets') - Synthetic data generators")
        print("dowhy_help('all') - Everything")
        return
    
    topic = topic.lower()
    
    if topic == 'methods':
        print_estimation_methods()
    elif topic == 'tests':
        print_refutation_tests()
    elif topic == 'workflow':
        print_workflow_reminder() 
    elif topic == 'data':
        print_data_requirements()
    elif topic == 'datasets':
        print_dataset_generators()
    elif topic == 'all':
        print_all_references()
    else:
        print("Unknown topic. Try: 'methods', 'tests', 'workflow', 'data', 'datasets', or 'all'")


def print_all_references():
    """Print complete DoWhy reference guide."""
    print("COMPLETE DoWhy REFERENCE GUIDE")
    print("=" * 50)
    print()
    
    print_estimation_methods()
    print()
    print_refutation_tests() 
    print()
    print_workflow_reminder()
    print()
    print_data_requirements()
    print()
    print_dataset_generators()
    print()
    
    print("TIP: Always check your treatment type before choosing estimation method!")
    print("TIP: Use multiple methods to cross-validate results!")
    print("TIP: Always run refutation tests to check robustness!")


if __name__ == "__main__":
    print_all_references()