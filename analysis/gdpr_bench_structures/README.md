# GDPR-Bench RQ2 pilot: structures A and B in one page

`gdpr_bench_structures.html` contains every chart and table from
`../gdpr_bench_iteration1A/` and `../gdpr_bench_iteration2B/`, with a button at
the top to switch between:

- **A**: iteration 1, structure A (snippet only)
- **B**: iteration 2, structure B (snippet + GDPR classification JSON)

The page opens on A. `#structure-b` in the link opens B directly.

Rebuild (after regenerating each structure's `data.json` with its `build_data.py`):

```bash
npm pack plotly.js-dist-min@2.35.2 && tar xzf plotly.js-dist-min-2.35.2.tgz
python -c "t=open('template.html').read().replace('__DATA_A__',open('../gdpr_bench_iteration1A/data.json').read()).replace('__DATA_B__',open('../gdpr_bench_iteration2B/data.json').read()); open('gdpr_bench_structures.html','w').write(t.replace('__PLOTLY__',open('package/plotly.min.js').read().replace('</script','<\\/script').replace('�','\\uFFFD'),1))"
```
