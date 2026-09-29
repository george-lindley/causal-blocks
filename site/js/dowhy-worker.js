// Real DoWhy, in a background thread. "Try your own data" answers instantly
// with js/estimate.js; this worker loads Python (Pyodide) and DoWhy in the
// background, then re-runs each estimate so the page can say it was
// confirmed by DoWhy itself.
//
// Messages in:  {type: "estimate", id, data, graph: {nodes, edges}, spec}
// Messages out: {type: "status", stage, message} while loading,
//               {type: "ready", version}, {type: "failed", message},
//               {type: "result", id, adjust, effect, ci, p} or {type: "result", id, error}

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
const DOWHY = "dowhy==0.14";

// Packages DoWhy imports at startup. numba, causal-learn and cvxpy are imported
// but never used by backdoor identification, linear regression or these
// refuters, and numba cannot run in the browser at all, so they get stand-ins.
const PACKAGES = ["micropip", "numpy", "pandas", "scipy", "statsmodels", "networkx", "sympy",
  "scikit-learn", "joblib", "tqdm", "matplotlib"];

const SETUP = `
import importlib.abc, importlib.machinery, sys, types, warnings, logging
warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)

STUB = ("numba", "causallearn", "cvxpy")
class _Stub(types.ModuleType):
    def __getattr__(self, name):
        if name.startswith("__"):
            raise AttributeError(name)
        return type(name, (), {"__init__": lambda self, *a, **k: None, "__call__": lambda self, *a, **k: None})
class _Finder(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def find_spec(self, name, path, target=None):
        if name.split(".")[0] in STUB:
            return importlib.machinery.ModuleSpec(name, self, is_package=True)
    def create_module(self, spec):
        m = _Stub(spec.name)
        m.__path__ = []
        return m
    def exec_module(self, module):
        pass
sys.meta_path.insert(0, _Finder())

import dowhy, networkx as nx, pandas as pd
from dowhy import CausalModel

def run(payload):
    data, graph, spec = payload["data"], payload["graph"], payload["spec"]
    df = pd.DataFrame(data)
    for z in spec["categorical"]:
        df[z] = df[z].astype(str)
    t, y = spec["treatment"], spec["outcome"]

    # 1. Does DoWhy, reading the student's own graph, choose the same set?
    g = nx.DiGraph()
    g.add_nodes_from(graph["nodes"])
    g.add_edges_from(graph["edges"])
    chosen = CausalModel(data=df, treatment=t, outcome=y, graph=g).identify_effect(
        proceed_when_unidentifiable=True).get_backdoor_variables()

    # 2. DoWhy's estimate with the page's adjustment set, for a like-for-like comparison.
    adjust = spec["adjust"]
    star = nx.DiGraph([(t, y)] + [(z, v) for z in adjust for v in (t, y)])
    model = CausalModel(data=df[[t, y, *adjust]], treatment=t, outcome=y, graph=star)
    estimand = model.identify_effect(proceed_when_unidentifiable=True)
    est = model.estimate_effect(estimand, method_name="backdoor.linear_regression", effect_modifiers=[],
                                confidence_intervals=True, test_significance=True)
    lo, hi = est.get_confidence_intervals()[0]
    return {"adjust": sorted(chosen or []), "effect": float(est.value), "ci": [float(lo), float(hi)],
            "p": float(est.test_stat_significance()["p_value"][0])}
`;

let py = null;
const queue = [];
let busy = false;

function status(stage, message) {
  postMessage({ type: "status", stage, message });
}

async function boot() {
  try {
    status("python", "Loading Python in your browser…");
    const { loadPyodide } = await import(`${PYODIDE}pyodide.mjs`);
    py = await loadPyodide({ indexURL: PYODIDE });
    status("packages", "Loading the maths libraries…");
    await py.loadPackage(PACKAGES, { messageCallback: () => {} });
    status("dowhy", "Loading DoWhy…");
    await py.runPythonAsync(`import micropip\nawait micropip.install("${DOWHY}", deps=False)`);
    await py.runPythonAsync(SETUP);
    postMessage({ type: "ready", version: py.runPython("dowhy.__version__") });
    drain();
  } catch (err) {
    py = null;
    postMessage({ type: "failed", message: String(err?.message ?? err).split("\n")[0] });
  }
}

function drain() {
  if (!py || busy || !queue.length) return;
  busy = true;
  // Only the newest request matters: the graph may have changed several times.
  const job = queue.pop();
  queue.length = 0;
  try {
    const run = py.globals.get("run");
    const out = run(py.toPy(job)).toJs({ dict_converter: Object.fromEntries });
    postMessage({ type: "result", id: job.id, ...out });
  } catch (err) {
    postMessage({ type: "result", id: job.id, error: String(err?.message ?? err).split("\n").filter(Boolean).at(-1) });
  }
  busy = false;
  drain();
}

onmessage = (e) => {
  if (e.data.type === "estimate") {
    queue.push(e.data);
    drain();
  }
};

boot();
