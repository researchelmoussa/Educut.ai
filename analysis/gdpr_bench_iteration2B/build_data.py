"""Build per-snippet article counts for GDPR-Bench RQ2 pilot, iteration 1 / Structure A.

y = number of articles in the model's final answer text ("0" -> 0, "1,2" -> 2, ...).
"Prediction" line = gold article count from predictions.json.
Usage: python build_data.py <path to data_level/iteration1_structureA> <out.json>
"""
import json, re, sys, os

root, out = sys.argv[1], sys.argv[2]

def parse_articles(text):  # same parsing as data_level.py
    res = []
    for s in text.replace("，", ",").replace(" ", "").replace("\n", ",").split(","):
        if s.isdigit() and int(s) != 0 and int(s) not in res:
            res.append(int(s))
    return res

def parse_final(text):     # Self-Refine: numbers on the last "ANSWER:" line
    m = re.findall(r"ANSWER:\s*([0-9,\s]+)", text)
    return parse_articles(m[-1]) if m else []

def load(rel):
    return {r["key"]: r["text"] for r in map(json.loads, open(os.path.join(root, rel), encoding="utf-8"))}

gold = json.load(open(os.path.join(root, "0_Baseline/output/predictions.json")))
keys = list(gold)

# (name, calls file, parser, value when key absent -- CoVe steps only run on non-zero answers)
EXPS = [
    ("Baseline",                    "0_Baseline/output/baseline_calls.jsonl",                 parse_articles),
    ("Snippet + description",       "1_Description/output/description_calls.jsonl",           parse_articles),
    ("Snippet + function",          "2_Function/output/function_calls.jsonl",                 parse_articles),
    ("Snippet + CoVe",              "3_Chain_of_Verification/output/cove_final_calls.jsonl",  parse_articles),
    ("Snippet + Self-Refine",       "4_Self_Refine/output/refine_r2_calls.jsonl",             parse_final),
    ("Snippet + CoVe + Self-Refine","5_Self_Refine_plus_CoVe/output/sr_cove_final_calls.jsonl", parse_articles),
]
pred_files = ["0_Baseline", "1_Description", "2_Function", "3_Chain_of_Verification",
              "4_Self_Refine", "5_Self_Refine_plus_CoVe"]

series = {"Prediction": [len(gold[k]["gold"]) for k in keys]}
arts = {"Prediction": [gold[k]["gold"] for k in keys]}
for (name, rel, parser), pf in zip(EXPS, pred_files):
    calls = load(rel)
    a = [parser(calls[k]) if k in calls else [] for k in keys]
    # sanity check against the experiment's own predictions.json
    p = json.load(open(os.path.join(root, pf, "output/predictions.json")))
    mism = sum(sorted(x) != sorted(p[k]["pred"]) for x, k in zip(a, keys))
    print(f"{name:30s} calls={len(calls):4d} total={sum(map(len,a)):5d} zeros={sum(not x for x in a)} mismatches_vs_predictions={mism}")
    series[name] = [len(x) for x in a]
    arts[name] = a

ids = [k.split("|")[0] for k in keys]
json.dump({"ids": ids, "series": series, "articles": arts}, open(out, "w"), separators=(",", ":"))
