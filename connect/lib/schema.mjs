// Minimal JSON Schema checker for the subset our contracts use (no dependencies):
// type, const, enum, required, properties, additionalProperties:false, items, minItems,
// minLength, maxLength, pattern, anyOf, local $ref.
import { join } from 'node:path';
import { CONNECT_DIR, readJson } from './util.mjs';

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);

function check(schema, value, path, root, errors) {
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o[k], root);
    return check(target, value, path, root, errors);
  }
  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => {
      const e = [];
      check(s, value, path, root, e);
      return e.length === 0;
    });
    if (!ok) errors.push(`${path}: does not match any allowed shape`);
    return;
  }
  if ('const' in schema && value !== schema.const) errors.push(`${path}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: must be one of ${schema.enum.join(', ')}`);
  if (schema.type) {
    const types = [].concat(schema.type);
    const t = typeOf(value);
    if (!types.includes(t) && !(t === 'integer' && types.includes('number'))) {
      errors.push(`${path}: expected ${types.join('|')}, got ${t}`);
      return;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match ${schema.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((v, i) => check(schema.items, v, `${path}[${i}]`, root, errors));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of schema.required ?? []) if (!(k in value)) errors.push(`${path}.${k}: required`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) check(schema.properties[k], v, `${path}.${k}`, root, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${k}: not allowed`);
    }
  }
}

const cache = {};
export function validateSchema(name, value) {
  const schema = (cache[name] ??= readJson(join(CONNECT_DIR, 'schemas', `${name}.schema.json`)));
  const errors = [];
  check(schema, value, '$', schema, errors);
  return errors;
}
