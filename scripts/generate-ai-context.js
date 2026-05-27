#!/usr/bin/env node

/**
 * generate-ai-context.js — Codebase Context Aggregator for AI Assistants
 * 
 * Outputs a highly consolidated, rich Markdown context summary of the 
 * Live2D-Viewer codebase. This can be piped or directly run by any terminal-based 
 * AI agent to immediately understand the project state.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PROJECT_ROOT = path.join(__dirname, "..");

// Helper to execute git command safely
function runGitCommand(cmd) {
  try {
    return execSync(cmd, { cwd: PROJECT_ROOT, encoding: "utf8" }).trim();
  } catch (e) {
    return "N/A (Git not initialized or not in PATH)";
  }
}

// Helper to count files in a directory recursively
function countFiles(dir, extensions = [".ts", ".vue"]) {
  let count = 0;
  let totalSize = 0;
  
  if (!fs.existsSync(dir)) return { count, totalSize };

  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      if (item === "node_modules" || item.startsWith(".")) continue;
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          count++;
          totalSize += stat.size;
        }
      }
    }
  }
  
  walk(dir);
  return { count, totalSize: (totalSize / 1024).toFixed(1) + " KB" };
}

// Generate the context markdown
function generateContext() {
  console.log("======================================================================");
  console.log("⚡ LIVE2D VIEWER — AUTOMATED AI CODEBASE CONTEXT GENERATOR ⚡");
  console.log("======================================================================");

  // 1. Git Status & History
  const activeBranch = runGitCommand("git rev-parse --abbrev-ref HEAD");
  const recentCommits = runGitCommand("git log -n 3 --oneline");
  const gitStatusSummary = runGitCommand("git status --porcelain");

  // 2. Metrics & File Counts
  const componentsMetric = countFiles(path.join(PROJECT_ROOT, "src/components"));
  const storesMetric = countFiles(path.join(PROJECT_ROOT, "src/stores"));
  const utilsMetric = countFiles(path.join(PROJECT_ROOT, "src/utils"));

  // Read AGENTS.md and DEVELOPMENT_LOG.md if they exist
  let agentsMdContent = "";
  let devLogContent = "";
  try {
    agentsMdContent = fs.readFileSync(path.join(PROJECT_ROOT, "AGENTS.md"), "utf8");
  } catch (e) {
    agentsMdContent = "AGENTS.md not found.";
  }
  try {
    devLogContent = fs.readFileSync(path.join(PROJECT_ROOT, "DEVELOPMENT_LOG.md"), "utf8");
  } catch (e) {
    devLogContent = "DEVELOPMENT_LOG.md not found.";
  }

  // 3. Output Markdown String
  const md = `# Live2D Viewer — Automated AI Context Map

> **Generated on**: ${new Date().toLocaleString()}
> This file is dynamically generated. Run \`npm run ai-context\` to refresh.

---

## 🧬 Active Developer Environment Status

### 📍 Git Context
- **Active Branch**: \`${activeBranch}\`
- **Recent Git Log**:
\`\`\`text
${recentCommits}
\`\`\`

- **Uncommitted Changes (git status)**:
\`\`\`text
${gitStatusSummary || "No uncommitted changes (working directory clean)"}
\`\`\`

### 📊 Codebase Directory Statistics
- **Components** (\`src/components/\`): **${componentsMetric.count}** Vue files (Total: ${componentsMetric.totalSize})
- **Pinia Stores** (\`src/stores/\`): **${storesMetric.count}** TS files (Total: ${storesMetric.totalSize})
- **Core Engine** (\`src/utils/\`): **${utilsMetric.count}** TS files (Total: ${utilsMetric.totalSize})

---

## 📜 Development History & Log (\`DEVELOPMENT_LOG.md\`)
${devLogContent}

---

## 🤖 AI Master Context & Rules (\`AGENTS.md\`)
${agentsMdContent}
`;

  // Output to stdout for immediate AI consumption
  console.log(md);
  console.log("======================================================================");
  console.log("💡 Tip: You can output this directly to a file: npm run ai-context > ai-map.md");
  console.log("======================================================================");
}

generateContext();
