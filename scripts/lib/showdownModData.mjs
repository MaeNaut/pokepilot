import ts from 'typescript';

// Read static data only; Showdown battle callbacks are never executed.
export function readModData(source) {
  const file = ts.createSourceFile('mod.ts', source, ts.ScriptTarget.Latest, true);
  function read(node) {
    if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -read(node.operand);
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(read);
    if (ts.isObjectLiteralExpression(node)) {
      const result = {};
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop) || !prop.name || ts.isComputedPropertyName(prop.name)) continue;
        const value = read(prop.initializer);
        if (value !== undefined) Object.defineProperty(result, prop.name.text, { value, enumerable: true });
      }
      return result;
    }
    return undefined;
  }
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) return read(declaration.initializer);
    }
  }
  throw new Error('Missing Showdown data export');
}

export function mergeModData(base, mod) {
  const result = { ...base };
  for (const [id, value] of Object.entries(mod)) result[id] = { ...base[id], ...value };
  return result;
}
