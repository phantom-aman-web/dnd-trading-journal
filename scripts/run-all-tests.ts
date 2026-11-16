import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const testFiles = [
  "src/lib/backup-safety.test.ts",
  "src/lib/broker-csv-mappings.test.ts",
  "src/lib/checklist-adherence.test.ts",
  "src/lib/duration-analytics.test.ts",
  "src/lib/filter-presets.test.ts",
  "src/lib/financial-engine.test.ts",
  "src/lib/global-search-domains.test.ts",
  "src/lib/instrument-catalog.test.ts",
  "src/lib/multi-user-isolation.test.ts",
  "src/lib/phase1-4-acceptance-deep.test.ts",
  "src/lib/phase1-hardening.test.ts",
  "src/lib/phase2-workflow.test.ts",
  "src/lib/phase3-analytics.test.ts",
  "src/lib/phase4-secondary-workflows.test.ts",
  "src/lib/phase5-workspace-widgets.test.ts",
  "src/lib/population.test.ts",
  "src/lib/prop-firm-engine.test.ts",
  "src/lib/strategy-comparison.test.ts",
  "src/lib/strategy-management.test.ts",
  "src/lib/trade-idempotency.test.ts",
  "src/lib/trades-filtering.test.ts",
  "src/lib/trades-pagination-search.test.ts",
];

interface SuiteResult {
  file: string;
  pass: boolean;
  passCount: number;
  failCount: number;
  expectCount: number;
  durationMs: number;
  output: string;
}

const results: SuiteResult[] = [];
let totalPass = 0;
let totalFail = 0;
let totalExpect = 0;

console.log(`Starting sequential test run for ${testFiles.length} test files...\n`);

for (const file of testFiles) {
  const start = Date.now();
  const proc = spawnSync("bun", ["test", file], {
    encoding: "utf-8",
    env: process.env,
  });
  const duration = Date.now() - start;
  const stdout = proc.stdout + proc.stderr;

  // Bun test output format:
  // " 8 pass\n 0 fail\n 30 expect() calls\nRan 8 tests across 1 files. [54.88s]"
  const passMatch = stdout.match(/(\d+)\s+pass/);
  const failMatch = stdout.match(/(\d+)\s+fail/);
  const expectMatch = stdout.match(/(\d+)\s+expect\(\)/);

  const passes = passMatch ? parseInt(passMatch[1], 10) : 0;
  const fails = failMatch ? parseInt(failMatch[1], 10) : 0;
  const expects = expectMatch ? parseInt(expectMatch[1], 10) : 0;

  totalPass += passes;
  totalFail += fails;
  totalExpect += expects;

  const isSuccess = proc.status === 0 && fails === 0;

  results.push({
    file,
    pass: isSuccess,
    passCount: passes,
    failCount: fails,
    expectCount: expects,
    durationMs: duration,
    output: stdout,
  });

  const status = isSuccess ? "PASS" : "FAIL";
  console.log(`[${status}] ${file} -> ${passes} pass, ${fails} fail, ${expects} expect (${(duration / 1000).toFixed(2)}s)`);
  if (!isSuccess) {
    console.error(stdout);
  }
}

console.log("\n==========================================");
console.log(`TOTAL SUITES: ${results.length}`);
console.log(`PASSED SUITES: ${results.filter((r) => r.pass).length}`);
console.log(`FAILED SUITES: ${results.filter((r) => !r.pass).length}`);
console.log(`TOTAL TESTS: ${totalPass + totalFail}`);
console.log(`TOTAL PASSES: ${totalPass}`);
console.log(`TOTAL FAILS: ${totalFail}`);
console.log(`TOTAL EXPECTS: ${totalExpect}`);
console.log("==========================================");

fs.writeFileSync(
  "test-results-final.json",
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      totalSuites: results.length,
      passedSuites: results.filter((r) => r.pass).length,
      failedSuites: results.filter((r) => !r.pass).length,
      totalPass,
      totalFail,
      totalExpect,
      suites: results.map((r) => ({
        file: r.file,
        pass: r.pass,
        passCount: r.passCount,
        failCount: r.failCount,
        expectCount: r.expectCount,
        durationMs: r.durationMs,
      })),
    },
    null,
    2
  )
);

if (totalFail > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
