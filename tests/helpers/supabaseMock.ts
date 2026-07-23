/**
 * In-memory mock of the Supabase client used by the app.
 *
 * Tests seed rows into named tables, then any app code that queries
 * `supabase.from(table)` runs against that data. The mock implements the
 * small slice of the PostgREST query builder the app actually uses:
 * `.select() .eq() .is() .ilike() .or() .limit() .single()`, awaited directly
 * or chained with `.then()`.
 *
 * Usage (must be the jest.mock factory so the real client never loads):
 *
 *   jest.mock("../../app/util/supabase", () =>
 *     require("../helpers/supabaseMock").createSupabaseModuleMock()
 *   );
 *
 *   import { seedTable, resetDb } from "../helpers/supabaseMock";
 *
 *   beforeEach(() => {
 *     resetDb();
 *     seedTable("songs", [{ id: 1, name: "Yellow", artist: "Coldplay" }]);
 *   });
 */

type Row = Record<string, any>;
type QueryError = { message: string } | null;
type Predicate = (row: Row) => boolean;

const tables = new Map<string, Row[]>();
const tableErrors = new Map<string, { message: string }>();

/** Replace the contents of a table. Rows are copied so tests can't mutate the seed. */
export const seedTable = (name: string, rows: Row[]): void => {
  tables.set(name, rows.map((row) => ({ ...row })));
};

/** Make every query against a table fail with the given error. */
export const setTableError = (name: string, error: { message: string }): void => {
  tableErrors.set(name, error);
};

/** Clear all seeded tables and errors. Call from beforeEach. */
export const resetDb = (): void => {
  tables.clear();
  tableErrors.clear();
};

/** Convert a PostgREST ilike pattern (with % wildcards) to a RegExp. */
const ilikeToRegExp = (pattern: string): RegExp => {
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, "[\\s\\S]*");
  return new RegExp(`^${escaped}$`, "i");
};

/** Parse a single `column.operator.value` clause from an `.or()` expression. */
const parseOrClause = (clause: string): Predicate => {
  const firstDot = clause.indexOf(".");
  const secondDot = clause.indexOf(".", firstDot + 1);
  const column = clause.slice(0, firstDot);
  const operator = clause.slice(firstDot + 1, secondDot);
  const value = clause.slice(secondDot + 1);

  if (operator === "eq") {
    return (row) => String(row[column]) === value;
  }
  if (operator === "ilike") {
    const regex = ilikeToRegExp(value);
    return (row) => regex.test(String(row[column] ?? ""));
  }
  throw new Error(
    `supabaseMock: unsupported operator "${operator}" in or() clause "${clause}"`
  );
};

class FakeQuery implements PromiseLike<{ data: any; error: QueryError }> {
  private predicates: Predicate[] = [];
  private limitCount: number | null = null;
  private singleMode = false;

  constructor(private tableName: string) {}

  select(_columns?: string): this {
    return this;
  }

  eq(column: string, value: any): this {
    this.predicates.push((row) => row[column] === value);
    return this;
  }

  /** `.is(col, null)` - PostgREST's IS NULL, distinct from `.eq(col, null)`. */
  is(column: string, value: null | boolean): this {
    this.predicates.push((row) =>
      value === null ? row[column] === null || row[column] === undefined
                     : row[column] === value
    );
    return this;
  }

  ilike(column: string, pattern: string): this {
    const regex = ilikeToRegExp(pattern);
    this.predicates.push((row) => regex.test(String(row[column] ?? "")));
    return this;
  }

  or(expression: string): this {
    const clauses = expression
      .split(",")
      .map((clause) => clause.trim())
      .filter(Boolean)
      .map(parseOrClause);
    this.predicates.push((row) => clauses.some((matches) => matches(row)));
    return this;
  }

  order(_column: string, _options?: unknown): this {
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  single(): this {
    this.singleMode = true;
    return this;
  }

  private execute(): { data: any; error: QueryError } {
    const forcedError = tableErrors.get(this.tableName);
    if (forcedError) {
      return { data: null, error: forcedError };
    }

    let rows = (tables.get(this.tableName) ?? []).filter((row) =>
      this.predicates.every((matches) => matches(row))
    );
    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.singleMode) {
      if (rows.length !== 1) {
        return {
          data: null,
          error: { message: `Expected a single row, found ${rows.length}` },
        };
      }
      return { data: { ...rows[0] }, error: null };
    }

    return { data: rows.map((row) => ({ ...row })), error: null };
  }

  then<TResult1 = { data: any; error: QueryError }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any; error: QueryError }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export const mockSupabase = {
  from: (tableName: string) => new FakeQuery(tableName),
  auth: {
    user: jest.fn(() => null),
    session: jest.fn(() => null),
    onAuthStateChange: jest.fn(() => ({
      data: { unsubscribe: jest.fn() },
    })),
  },
};

/** Drop-in replacement for the `app/util/supabase` module. */
export const createSupabaseModuleMock = () => ({
  supabase: mockSupabase,
  getSession: async () => ({ session: null, error: null }),
});
