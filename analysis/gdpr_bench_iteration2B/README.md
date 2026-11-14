# GDPR-Bench RQ2 pilot: iteration 2, structure B plot

Interactive line chart (`gdpr_bench_iteration2B_plot.html`) of the number of GDPR articles per snippet (887 Task 2 snippets) for:

- Prediction (gold labels from `predictions.json`, dashed)
- Baseline, Snippet + description, Snippet + function, Snippet + CoVe, Snippet + Self-Refine, Snippet + CoVe + Self-Refine

y = number of articles in the answer `text` of the experiment's `*_calls.jsonl` (`"0"` -> 0, `"1,2"` -> 2).
Self-Refine uses the last `ANSWER:` line of `refine_r2_calls.jsonl`; CoVe uses the `*_final_calls.jsonl` files (snippets not verified count as 0).

Plotly is embedded in the HTML, so the file opens offline (download it and open it in a browser; GitHub only shows its source).

Rebuild from a checkout of `aishahasim/gdpr-bench-rq2-pilot`:

```bash
python build_data.py <repo>/data_level/iteration2_structureB data.json
npm pack plotly.js-dist-min@2.35.2 && tar xzf plotly.js-dist-min-2.35.2.tgz
python -c "t=open('template.html').read().replace('__DATA__',open('data.json').read()); open('gdpr_bench_iteration2B_plot.html','w').write(t.replace('__PLOTLY__',open('package/plotly.min.js').read().replace('</script','<\\/script').replace('\ufffd','\\uFFFD'),1))"
```
