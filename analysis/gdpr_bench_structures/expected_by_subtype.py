"""Expected hallucination per code-snippet sub-level, 6 methods pooled, for structures A and B.

FDR (expected hallucination) = FP / (TP + FP); also TP, FN for Precision, FNR, TPR
rate = hallucinated articles / predicted articles over all snippets of the sub-level and all 6 methods
95% CI = cluster bootstrap over snippets (2000 resamples, seed 0): articles of one snippet move together.
Usage: python expected_by_subtype.py <snippet_tags.csv> <A data.json> <B data.json> <out.json>
"""
import csv, json, sys
import numpy as np

tags = list(csv.DictReader(open(sys.argv[1])))
METHODS = ['Baseline', 'Snippet + description', 'Snippet + function', 'Snippet + CoVe',
           'Snippet + Self-Refine', 'Snippet + CoVe + Self-Refine']
GROUPS = [('Structure', 'Expression', lambda t: t['structural'] == 'expression'),
          ('Structure', 'Statement', lambda t: t['structural'] == 'statement'),
          ('Structure', 'Block', lambda t: t['structural'] == 'block'),
          ('Structure', 'Function', lambda t: t['structural'] == 'function_or_class'),
          ('Structure', 'Config / markup', lambda t: t['structural'] == 'config_markup'),
          ('Syntactic', 'Complete', lambda t: t['syntactic'] == 'complete'),
          ('Syntactic', 'Context dependent', lambda t: t['syntactic'] == 'context_dependent'),
          ('Syntactic', 'Syntactically incomplete', lambda t: t['syntactic'] == 'incomplete'),
          ('Syntactic', 'Mixed content', lambda t: t['syntactic'] == 'mixed_content'),
          ('Formatting', 'Single line', lambda t: t['L_single_line'] == '1'),
          ('Formatting', 'Compact', lambda t: t['F_compact'] == '1'),
          ('Formatting', 'Indented', lambda t: t['F_indented'] == '1'),
          ('Formatting', 'Comment', lambda t: t['F_has_comment'] == '1'),
          ('Formatting', 'Documented', lambda t: t['F_has_doc'] == '1')]
out = {}
for name, path in (('A', sys.argv[2]), ('B', sys.argv[3])):
    d = json.load(open(path)); G = d['articles']['Prediction']
    assert [t['key'].split('|')[0] for t in tags] == d['ids']
    # per snippet: predicted and hallucinated articles summed over the 6 methods
    P = np.array([sum(len(d['articles'][m][i]) for m in METHODS) for i in range(len(tags))])
    H = np.array([sum(sum(a not in G[i] for a in d['articles'][m][i]) for m in METHODS) for i in range(len(tags))])
    # gold articles counted once per method (6 x gold), so FN = 6 x gold - TP
    GD = np.array([len(METHODS) * len(G[i]) for i in range(len(tags))])
    TP = P - H; FN = GD - TP
    rng = np.random.default_rng(0)
    res = {'overall': {'pred': int(P.sum()), 'hall': int(H.sum()), 'tp': int(TP.sum()), 'fn': int(FN.sum()), 'gold': int(GD.sum()), 'rate': H.sum() / P.sum()}, 'rows': []}
    for lvl, sub, f in GROUPS:
        idx = np.array([i for i, t in enumerate(tags) if f(t)])
        p, h = int(P[idx].sum()), int(H[idx].sum())
        row = {'level': lvl, 'sub': sub, 'n': len(idx), 'answered': int((P[idx] > 0).sum()), 'pred': p, 'hall': h,
               'tp': int(TP[idx].sum()), 'fn': int(FN[idx].sum()), 'gold': int(GD[idx].sum())}
        if p:
            k = rng.integers(0, len(idx), (2000, len(idx)))
            r = H[idx][k].sum(1) / np.maximum(P[idx][k].sum(1), 1)
            row.update(rate=h / p, lo=float(np.percentile(r, 2.5)), hi=float(np.percentile(r, 97.5)))
        res['rows'].append(row)
    out[name] = res
json.dump(out, open(sys.argv[4], 'w'), indent=1)
for s in out:
    o = out[s]['overall']; print(s, f"overall {o['hall']}/{o['pred']} = {100*o['rate']:.1f}%")
    for r in out[s]['rows']:
        print(f"  {r['level']:10s} {r['sub']:25s} n={r['n']:3d} pred={r['pred']:4d} hall={r['hall']:4d} " + (f"{100*r['rate']:.1f}% [{100*r['lo']:.1f}-{100*r['hi']:.1f}]" if 'rate' in r else '-'))
