import { parse } from "acorn";

function propertyName(node) {
  if (!node || node.computed) return null;
  if (node.key?.type === "Identifier") return node.key.name;
  if (node.key?.type === "Literal" && typeof node.key.value === "string") {
    return node.key.value;
  }
  return null;
}

function memberName(node) {
  if (!node || node.type !== "MemberExpression") return null;
  if (node.computed) {
    return node.property?.type === "Literal" &&
      typeof node.property.value === "string"
      ? node.property.value
      : null;
  }
  return node.property?.type === "Identifier" ? node.property.name : null;
}

function isExportsMember(node, exportName) {
  return (
    node?.type === "MemberExpression" &&
    node.object?.type === "Identifier" &&
    node.object.name === "exports" &&
    memberName(node) === exportName
  );
}

function readScalar(node, path) {
  if (
    node?.type === "Literal" &&
    (node.value === null ||
      typeof node.value === "string" ||
      typeof node.value === "number" ||
      typeof node.value === "boolean")
  ) {
    return node.value;
  }

  if (
    node?.type === "UnaryExpression" &&
    (node.operator === "+" || node.operator === "-") &&
    node.argument?.type === "Literal" &&
    typeof node.argument.value === "number"
  ) {
    return node.operator === "-" ? -node.argument.value : node.argument.value;
  }

  throw new Error(`${path} must be a static scalar value.`);
}

function defineDataProperty(target, key, value) {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

export function parseShowdownStaticExport(
  source,
  exportName,
  { presenceFields = [], scalarFields = [] } = {},
) {
  const program = parse(source, {
    ecmaVersion: "latest",
    sourceType: "script",
  });
  const statements = program.body.filter(
    (statement) =>
      statement.type !== "EmptyStatement" &&
      !(statement.type === "ExpressionStatement" && statement.directive),
  );

  if (statements.length !== 1) {
    throw new Error(`${exportName} source must contain one export assignment.`);
  }

  const statement = statements[0];
  const assignment =
    statement.type === "ExpressionStatement" ? statement.expression : null;
  if (
    assignment?.type !== "AssignmentExpression" ||
    assignment.operator !== "=" ||
    !isExportsMember(assignment.left, exportName) ||
    assignment.right.type !== "ObjectExpression"
  ) {
    throw new Error(`${exportName} source did not match the expected export.`);
  }

  const scalarFieldSet = new Set(scalarFields);
  const presenceFieldSet = new Set(presenceFields);
  const records = Object.create(null);

  for (const entry of assignment.right.properties) {
    if (
      entry.type !== "Property" ||
      entry.kind !== "init" ||
      entry.method ||
      entry.computed ||
      entry.value.type !== "ObjectExpression"
    ) {
      throw new Error(`${exportName} contains an unsupported top-level entry.`);
    }

    const entryName = propertyName(entry);
    if (!entryName) {
      throw new Error(`${exportName} contains an unnamed top-level entry.`);
    }

    const record = Object.create(null);
    for (const field of entry.value.properties) {
      if (field.type !== "Property") continue;
      const fieldName = propertyName(field);
      if (!fieldName) continue;

      if (scalarFieldSet.has(fieldName)) {
        if (field.kind !== "init" || field.method || field.computed) {
          throw new Error(`${exportName}.${entryName}.${fieldName} is not static.`);
        }
        defineDataProperty(
          record,
          fieldName,
          readScalar(field.value, `${exportName}.${entryName}.${fieldName}`),
        );
      } else if (presenceFieldSet.has(fieldName)) {
        if (
          field.kind !== "init" ||
          field.method ||
          field.computed ||
          !["ObjectExpression", "Literal"].includes(field.value.type)
        ) {
          throw new Error(`${exportName}.${entryName}.${fieldName} is not static.`);
        }
        defineDataProperty(record, fieldName, true);
      }
    }
    defineDataProperty(records, entryName, record);
  }

  return records;
}
