import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPABASE_SCHEMA_CHECKS,
  runSupabaseSchemaDiagnostics,
} from "../src/lib/supabaseDiagnostics.mjs";

test("schema diagnostics query every required table and column group", async () => {
  const calls = [];
  const fakeSupabase = {
    from(table) {
      return {
        select(columns) {
          return {
            async limit(count) {
              calls.push({ table, columns, count });
              return { data: [], error: null };
            },
          };
        },
      };
    },
  };

  const results = await runSupabaseSchemaDiagnostics(fakeSupabase);

  assert.equal(results.length, SUPABASE_SCHEMA_CHECKS.length);
  assert.deepEqual(
    calls,
    SUPABASE_SCHEMA_CHECKS.map((check) => ({
      table: check.table,
      columns: check.columns,
      count: 1,
    }))
  );
  assert.ok(results.every((result) => result.status === "ok"));
});

test("schema diagnostics report Supabase table or column errors", async () => {
  const fakeSupabase = {
    from(table) {
      return {
        select() {
          return {
            async limit() {
              return {
                data: null,
                error: table === "encounters" ? { message: "column encounters.combatants does not exist" } : null,
              };
            },
          };
        },
      };
    },
  };

  const results = await runSupabaseSchemaDiagnostics(fakeSupabase);
  const encounterResult = results.find((result) => result.id === "encounters");

  assert.equal(encounterResult.status, "error");
  assert.equal(encounterResult.message, "column encounters.combatants does not exist");
});
