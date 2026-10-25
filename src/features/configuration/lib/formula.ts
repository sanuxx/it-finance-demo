/**
 * Safe formula engine for the no-code formula builder.
 *
 * Tokenizer + recursive-descent parser producing an AST that is evaluated by a
 * small interpreter. There is NO use of eval / Function: only numbers, the
 * approved variables, arithmetic, comparisons and a fixed set of functions.
 *
 * Grammar:
 *   expr       := comparison
 *   comparison := additive (( '>' | '>=' | '<' | '<=' | '=' | '==' | '!=' | '<>' ) additive)?
 *   additive   := term (('+' | '-') term)*
 *   term       := unary (('*' | '/') unary)*
 *   unary      := '-' unary | '+' unary | primary
 *   primary    := number | identifier | function '(' args ')' | '(' expr ')'
 */

export type FormulaFunction = 'IF' | 'MIN' | 'MAX' | 'ROUND' | 'ABS'
export const FORMULA_FUNCTIONS: { name: FormulaFunction; signature: string; description: string }[] = [
  { name: 'IF', signature: 'IF(condition, then, else)', description: 'Returns "then" when the condition is true, otherwise "else".' },
  { name: 'MIN', signature: 'MIN(a, b, …)', description: 'Smallest of the values.' },
  { name: 'MAX', signature: 'MAX(a, b, …)', description: 'Largest of the values.' },
  { name: 'ROUND', signature: 'ROUND(value, decimals)', description: 'Round half away from zero to the given decimals (default 0).' },
  { name: 'ABS', signature: 'ABS(value)', description: 'Absolute value.' },
]

type TokenType = 'number' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma'
interface Token {
  type: TokenType
  value: string
  pos: number
}

export type Node =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string; pos: number }
  | { kind: 'unary'; op: '-' | '+'; arg: Node }
  | { kind: 'bin'; op: string; left: Node; right: Node; pos: number }
  | { kind: 'call'; name: FormulaFunction; args: Node[]; pos: number }

export class FormulaError extends Error {
  pos: number
  constructor(message: string, pos: number) {
    super(message)
    this.name = 'FormulaError'
    this.pos = pos
  }
}

const MAX_LENGTH = 500

export function tokenize(src: string): Token[] {
  if (src.length > MAX_LENGTH) throw new FormulaError(`Formula is too long (max ${MAX_LENGTH} characters).`, MAX_LENGTH)
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (/[0-9.]/.test(ch)) {
      const start = i
      while (i < src.length && /[0-9.]/.test(src[i]!)) i++
      const raw = src.slice(start, i)
      if (!/^(\d+\.?\d*|\.\d+)$/.test(raw)) throw new FormulaError(`Invalid number "${raw}" at position ${start + 1}.`, start)
      tokens.push({ type: 'number', value: raw, pos: start })
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i]!)) i++
      tokens.push({ type: 'ident', value: src.slice(start, i), pos: start })
      continue
    }
    const two = src.slice(i, i + 2)
    if (['>=', '<=', '==', '!=', '<>'].includes(two)) {
      tokens.push({ type: 'op', value: two, pos: i })
      i += 2
      continue
    }
    if ('+-*/<>='.includes(ch)) {
      tokens.push({ type: 'op', value: ch, pos: i })
      i++
      continue
    }
    if (ch === '(') tokens.push({ type: 'lparen', value: ch, pos: i })
    else if (ch === ')') tokens.push({ type: 'rparen', value: ch, pos: i })
    else if (ch === ',') tokens.push({ type: 'comma', value: ch, pos: i })
    else throw new FormulaError(`Unexpected character "${ch}" at position ${i + 1}.`, i)
    i++
  }
  return tokens
}

export function parse(src: string, allowedVariables: string[]): Node {
  const tokens = tokenize(src)
  if (!tokens.length) throw new FormulaError('Enter a formula.', 0)
  const allowed = new Set(allowedVariables)
  let p = 0
  const peek = () => tokens[p]
  const endPos = src.length

  const expect = (type: TokenType, label: string) => {
    const t = tokens[p]
    if (!t || t.type !== type) throw new FormulaError(`Expected ${label} at position ${(t?.pos ?? endPos) + 1}.`, t?.pos ?? endPos)
    p++
    return t
  }

  function comparison(): Node {
    const left = additive()
    const t = peek()
    if (t && t.type === 'op' && ['>', '>=', '<', '<=', '=', '==', '!=', '<>'].includes(t.value)) {
      p++
      const right = additive()
      return { kind: 'bin', op: t.value, left, right, pos: t.pos }
    }
    return left
  }
  function additive(): Node {
    let node = term()
    for (let t = peek(); t && t.type === 'op' && (t.value === '+' || t.value === '-'); t = peek()) {
      p++
      node = { kind: 'bin', op: t.value, left: node, right: term(), pos: t.pos }
    }
    return node
  }
  function term(): Node {
    let node = unary()
    for (let t = peek(); t && t.type === 'op' && (t.value === '*' || t.value === '/'); t = peek()) {
      p++
      node = { kind: 'bin', op: t.value, left: node, right: unary(), pos: t.pos }
    }
    return node
  }
  function unary(): Node {
    const t = peek()
    if (t && t.type === 'op' && (t.value === '-' || t.value === '+')) {
      p++
      return { kind: 'unary', op: t.value as '-' | '+', arg: unary() }
    }
    return primary()
  }
  function primary(): Node {
    const t = peek()
    if (!t) throw new FormulaError('Formula ends unexpectedly — a value is missing.', endPos)
    if (t.type === 'number') {
      p++
      return { kind: 'num', value: Number(t.value) }
    }
    if (t.type === 'lparen') {
      p++
      const node = comparison()
      expect('rparen', 'a closing ")"')
      return node
    }
    if (t.type === 'ident') {
      p++
      const next = peek()
      if (next && next.type === 'lparen') {
        const name = t.value.toUpperCase() as FormulaFunction
        if (!FORMULA_FUNCTIONS.some((f) => f.name === name)) throw new FormulaError(`Unknown function "${t.value}" at position ${t.pos + 1}. Allowed: ${FORMULA_FUNCTIONS.map((f) => f.name).join(', ')}.`, t.pos)
        p++
        const args: Node[] = []
        if (peek()?.type !== 'rparen') {
          args.push(comparison())
          while (peek()?.type === 'comma') {
            p++
            args.push(comparison())
          }
        }
        expect('rparen', 'a closing ")"')
        validateArity(name, args.length, t.pos)
        return { kind: 'call', name, args, pos: t.pos }
      }
      if (!allowed.has(t.value)) throw new FormulaError(`Unknown field "${t.value}" at position ${t.pos + 1}. Use one of: ${allowedVariables.join(', ') || '(no fields defined)'}.`, t.pos)
      return { kind: 'var', name: t.value, pos: t.pos }
    }
    throw new FormulaError(`Unexpected "${t.value}" at position ${t.pos + 1}.`, t.pos)
  }

  const node = comparison()
  if (p < tokens.length) {
    const t = tokens[p]!
    throw new FormulaError(`Unexpected "${t.value}" at position ${t.pos + 1}.`, t.pos)
  }
  return node
}

function validateArity(name: FormulaFunction, n: number, pos: number) {
  const bad =
    (name === 'IF' && n !== 3) || (name === 'ABS' && n !== 1) || (name === 'ROUND' && (n < 1 || n > 2)) || ((name === 'MIN' || name === 'MAX') && n < 1)
  if (bad) {
    const sig = FORMULA_FUNCTIONS.find((f) => f.name === name)!.signature
    throw new FormulaError(`${name} received ${n} argument(s). Usage: ${sig}.`, pos)
  }
}

export function evaluateNode(node: Node, vars: Record<string, number>): number {
  switch (node.kind) {
    case 'num':
      return node.value
    case 'var': {
      const v = vars[node.name]
      if (v === undefined || !Number.isFinite(v)) throw new FormulaError(`Field "${node.name}" has no numeric value.`, node.pos)
      return v
    }
    case 'unary': {
      const v = evaluateNode(node.arg, vars)
      return node.op === '-' ? -v : v
    }
    case 'bin': {
      const a = evaluateNode(node.left, vars)
      const b = evaluateNode(node.right, vars)
      switch (node.op) {
        case '+':
          return a + b
        case '-':
          return a - b
        case '*':
          return a * b
        case '/':
          if (b === 0) throw new FormulaError(`Division by zero at position ${node.pos + 1}. Wrap it in IF(divisor > 0, …, 0).`, node.pos)
          return a / b
        case '>':
          return a > b ? 1 : 0
        case '>=':
          return a >= b ? 1 : 0
        case '<':
          return a < b ? 1 : 0
        case '<=':
          return a <= b ? 1 : 0
        case '=':
        case '==':
          return a === b ? 1 : 0
        case '!=':
        case '<>':
          return a !== b ? 1 : 0
      }
      throw new FormulaError(`Unknown operator "${node.op}".`, node.pos)
    }
    case 'call': {
      if (node.name === 'IF') {
        // Lazy: only the chosen branch is evaluated (lets IF guard a division).
        return evaluateNode(node.args[0]!, vars) !== 0 ? evaluateNode(node.args[1]!, vars) : evaluateNode(node.args[2]!, vars)
      }
      const args = node.args.map((a) => evaluateNode(a, vars))
      switch (node.name) {
        case 'MIN':
          return Math.min(...args)
        case 'MAX':
          return Math.max(...args)
        case 'ABS':
          return Math.abs(args[0]!)
        case 'ROUND': {
          const dp = Math.max(0, Math.min(10, Math.trunc(args[1] ?? 0)))
          const f = 10 ** dp
          return (Math.sign(args[0]!) * Math.round(Math.abs(args[0]!) * f + Number.EPSILON)) / f
        }
      }
    }
  }
  throw new FormulaError('Unsupported expression.', 0)
}

export type FormulaResult = { ok: true; value: number } | { ok: false; error: string; pos: number }

/** Parse and evaluate in one step, never throwing. Result is rounded to 6 dp to tame float noise. */
export function evaluateFormula(expression: string, vars: Record<string, number>): FormulaResult {
  try {
    const ast = parse(expression, Object.keys(vars))
    const value = evaluateNode(ast, vars)
    if (!Number.isFinite(value)) return { ok: false, error: 'The result is not a finite number.', pos: 0 }
    return { ok: true, value: Math.round(value * 1e6) / 1e6 }
  } catch (e) {
    if (e instanceof FormulaError) return { ok: false, error: e.message, pos: e.pos }
    return { ok: false, error: 'Could not evaluate the formula.', pos: 0 }
  }
}

/** Validate syntax and variable names only (no evaluation). */
export function validateFormula(expression: string, variables: string[]): string | null {
  try {
    parse(expression, variables)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid formula.'
  }
}
