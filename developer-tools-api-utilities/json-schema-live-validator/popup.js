// JSON Schema Live Validator — popup logic.
// On-device validator for the JSON Schema draft-07 subset:
// type, required, properties, additionalProperties, items,
// enum, const, string/number/array/object constraints.

// ---------- validator (pure, no DOM) ----------

function jsonTypeName(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function checkType(expected, v) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((t) => {
    if (t === "number") return typeof v === "number" && !isNaN(v);
    if (t === "integer") return Number.isInteger(v);
    if (t === "string") return typeof v === "string";
    if (t === "boolean") return typeof v === "boolean";
    if (t === "null") return v === null;
    if (t === "object") return v !== null && typeof v === "object" && !Array.isArray(v);
    if (t === "array") return Array.isArray(v);
    return false;
  });
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validateSchema(schema, data, path, errors) {
  path = path || "$";
  errors = errors || [];
  const err = (p, m) => errors.push({ path: p, message: m });
  if (typeof schema !== "object" || schema === null) return errors;

  if (schema.type !== undefined) {
    const want = Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type;
    if (!checkType(schema.type, data)) {
      err(path, `expected ${want}, got ${jsonTypeName(data)}`);
      return errors; // stop cascading on a type mismatch
    }
  }

  if (schema.enum !== undefined && !schema.enum.some((e) => deepEqual(e, data))) {
    err(path, "value is not one of the allowed enum values");
  }
  if (schema.const !== undefined && !deepEqual(schema.const, data)) {
    err(path, `value does not equal const ${JSON.stringify(schema.const)}`);
  }

  const t = jsonTypeName(data);

  if (t === "string") {
    if (schema.minLength !== undefined && data.length < schema.minLength)
      err(path, `string is shorter than minLength ${schema.minLength}`);
    if (schema.maxLength !== undefined && data.length > schema.maxLength)
      err(path, `string is longer than maxLength ${schema.maxLength}`);
    if (schema.pattern !== undefined) {
      try {
        if (!new RegExp(schema.pattern).test(data)) err(path, `string does not match pattern ${schema.pattern}`);
      } catch (e) { err(path, `schema has an invalid regex pattern: ${schema.pattern}`); }
    }
  }

  if (t === "number" || t === "integer") {
    if (schema.minimum !== undefined && data < schema.minimum) err(path, `number is less than minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && data > schema.maximum) err(path, `number is greater than maximum ${schema.maximum}`);
    if (schema.exclusiveMinimum === true && schema.minimum !== undefined && data <= schema.minimum)
      err(path, `number must be greater than ${schema.minimum}`);
    if (schema.exclusiveMaximum === true && schema.maximum !== undefined && data >= schema.maximum)
      err(path, `number must be less than ${schema.maximum}`);
    if (typeof schema.exclusiveMinimum === "number" && data <= schema.exclusiveMinimum)
      err(path, `number must be greater than ${schema.exclusiveMinimum}`);
    if (typeof schema.exclusiveMaximum === "number" && data >= schema.exclusiveMaximum)
      err(path, `number must be less than ${schema.exclusiveMaximum}`);
    if (schema.multipleOf !== undefined) {
      const q = data / schema.multipleOf;
      if (Math.abs(q - Math.round(q)) > 1e-9) err(path, `number is not a multiple of ${schema.multipleOf}`);
    }
  }

  if (t === "object") {
    const keys = Object.keys(data);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties)
      err(path, `object has fewer than minProperties ${schema.minProperties}`);
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties)
      err(path, `object has more than maxProperties ${schema.maxProperties}`);
    (schema.required || []).forEach((k) => {
      if (!(k in data)) err(path, `required property "${k}" is missing`);
    });
    const props = schema.properties || {};
    keys.forEach((k) => {
      const child = path + "." + k;
      if (Object.prototype.hasOwnProperty.call(props, k)) validateSchema(props[k], data[k], child, errors);
      else if (schema.additionalProperties === false) err(child, `additional property "${k}" is not allowed`);
      else if (typeof schema.additionalProperties === "object") validateSchema(schema.additionalProperties, data[k], child, errors);
    });
  }

  if (t === "array") {
    if (schema.minItems !== undefined && data.length < schema.minItems)
      err(path, `array has fewer than minItems ${schema.minItems}`);
    if (schema.maxItems !== undefined && data.length > schema.maxItems)
      err(path, `array has more than maxItems ${schema.maxItems}`);
    if (schema.uniqueItems === true) {
      const seen = new Set();
      data.forEach((item, i) => {
        const s = JSON.stringify(item);
        if (seen.has(s)) err(`${path}[${i}]`, "duplicate item (uniqueItems is true)");
        seen.add(s);
      });
    }
    if (schema.items !== undefined) {
      if (Array.isArray(schema.items)) {
        data.forEach((item, i) => {
          if (i < schema.items.length) validateSchema(schema.items[i], item, `${path}[${i}]`, errors);
        });
        if (schema.additionalItems === false && data.length > schema.items.length)
          err(path, "additional items are not allowed");
      } else {
        data.forEach((item, i) => validateSchema(schema.items, item, `${path}[${i}]`, errors));
      }
    }
  }

  return errors;
}

// Export for Node unit tests; harmless in the browser.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { validateSchema };
}

// ---------- popup UI (browser only) ----------

if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);

  const SAMPLE_JSON = JSON.stringify(
    { name: "Asha", age: 29, email: "asha@example.com", tags: ["dev", "design"] },
    null, 2
  );
  const SAMPLE_SCHEMA = JSON.stringify(
    {
      type: "object",
      required: ["name", "age"],
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 2 },
        age: { type: "integer", minimum: 0, maximum: 150 },
        email: { type: "string", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
        tags: { type: "array", items: { type: "string" }, uniqueItems: true },
      },
    },
    null,
    2
  );

  let debounceT = null;
  let saveT = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const saved = await chrome.storage.local.get(["lastJson", "lastSchema"]);
    if (saved.lastJson) $("json").value = saved.lastJson;
    if (saved.lastSchema) $("schema").value = saved.lastSchema;
    $("json").addEventListener("input", onType);
    $("schema").addEventListener("input", onType);
    $("validate").addEventListener("click", runValidation);
    $("sample").addEventListener("click", () => {
      $("json").value = SAMPLE_JSON;
      $("schema").value = SAMPLE_SCHEMA;
      onType();
    });
    $("clear").addEventListener("click", () => {
      $("json").value = "";
      $("schema").value = "";
      setStatus("idle", "—");
      $("errors").innerHTML = "";
      chrome.storage.local.remove(["lastJson", "lastSchema"]);
    });
    if ($("json").value || $("schema").value) runValidation();
  }

  function onType() {
    clearTimeout(debounceT);
    debounceT = setTimeout(runValidation, 400);
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      chrome.storage.local.set({ lastJson: $("json").value, lastSchema: $("schema").value });
    }, 800);
  }

  function setStatus(kind, text) {
    const s = $("status");
    s.className = "status " + kind;
    s.textContent = text;
  }

  function parseField(el) {
    el.classList.remove("syntax-err");
    const raw = el.value.trim();
    if (!raw) return { empty: true };
    try {
      return { value: JSON.parse(raw) };
    } catch (e) {
      el.classList.add("syntax-err");
      return { error: "Invalid JSON: " + e.message };
    }
  }

  function runValidation() {
    const schemaRes = parseField($("schema"));
    const jsonRes = parseField($("json"));
    const box = $("errors");
    box.innerHTML = "";

    if (schemaRes.error) {
      setStatus("err", "Bad schema");
      return showErrors([{ path: "schema", message: schemaRes.error }]);
    }
    if (jsonRes.error) {
      setStatus("err", "Bad JSON");
      return showErrors([{ path: "json", message: jsonRes.error }]);
    }
    if (schemaRes.empty || jsonRes.empty) {
      setStatus("idle", "—");
      box.innerHTML = '<div class="ok-note">Paste a document and a schema to validate live.</div>';
      return;
    }

    const errors = validateSchema(schemaRes.value, jsonRes.value);
    if (!errors.length) {
      setStatus("ok", "Valid ✓");
      box.innerHTML = '<div class="ok-note"><b>Valid</b> — document matches the schema.</div>';
    } else {
      setStatus("err", errors.length + (errors.length === 1 ? " error" : " errors"));
      showErrors(errors);
    }
  }

  function showErrors(errors) {
    const box = $("errors");
    errors.slice(0, 100).forEach((e) => {
      const row = document.createElement("div");
      row.className = "err-row";
      const p = document.createElement("div");
      p.className = "path";
      p.textContent = e.path;
      const m = document.createElement("div");
      m.className = "msg";
      m.textContent = e.message;
      row.append(p, m);
      box.appendChild(row);
    });
    if (errors.length > 100) {
      const more = document.createElement("div");
      more.className = "ok-note";
      more.textContent = `…and ${errors.length - 100} more`;
      box.appendChild(more);
    }
  }
}
