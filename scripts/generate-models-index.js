#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Recursively scan a directory to find JSON files containing "model3"
 * @param {string} dir - The directory to scan
 * @param {number} maxDepth - Maximum scan depth
 * @param {number} currentDepth - Current depth
 * @returns {Array} List of found model files
 */
function scanDirectory(dir, maxDepth = 4, currentDepth = 0) {
  const models = [];

  if (currentDepth >= maxDepth) {
    return models;
  }

  try {
    if (!fs.existsSync(dir)) {
      console.log(`⚠️  Directory does not exist: ${dir}`);
      return models;
    }

    const items = fs.readdirSync(dir);
    console.log(`🔍 Scanning directory: ${dir} (depth: ${currentDepth})`);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isFile()) {
        // Check if it is a JSON file containing "model3"
        if (item.includes("model3") && item.endsWith(".json")) {
          const relativePath = path
            .relative("public", fullPath)
            .replace(/\\/g, "/");
          const webPath = "/" + relativePath;
          const folderName = path.basename(path.dirname(fullPath));
          const modelName = item.replace(/\.(model3\.)?json$/, "");

          models.push({
            name: modelName,
            path: webPath,
            folder: folderName,
            description: `${folderName} Live2D Model`,
            file: item,
            size: stat.size,
            lastModified: stat.mtime.toISOString(),
          });

          console.log(`✅ Found model file: ${webPath}`);
        }
      } else if (stat.isDirectory()) {
        // Recursively scan subdirectories
        if (!item.startsWith(".") && item !== "node_modules") {
          const subModels = scanDirectory(fullPath, maxDepth, currentDepth + 1);
          models.push(...subModels);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Failed to scan directory: ${dir}`, error.message);
  }

  return models;
}

/**
 * Generate the model index file
 */
function generateModelsIndex() {
  console.log("🚀 Starting Live2D model index generation...");

  const live2dModelsDir = path.join(__dirname, "../public/models");
  const outputFile = path.join(live2dModelsDir, "models-index.json");

  // Scan for model files
  const models = scanDirectory(live2dModelsDir);

  // Sort by folder and name
  models.sort((a, b) => {
    if (a.folder !== b.folder) {
      return a.folder.localeCompare(b.folder);
    }
    return a.name.localeCompare(b.name);
  });

  // Extract folder info for logging
  const folders = [...new Set(models.map((m) => m.folder))].sort();

  // Ensure the output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created directory: ${outputDir}`);
  }

  // Write the index file, root element is a model array
  try {
    fs.writeFileSync(outputFile, JSON.stringify(models, null, 2), "utf8");
    console.log(`✅ Model index generated successfully: ${outputFile}`);
    console.log(`📊 Found ${models.length} model file(s)`);
    console.log(`📂 Across ${folders.length} folder(s): ${folders.join(", ")}`);

    // Display the list of found models
    if (models.length > 0) {
      console.log("\n📋 Model list:");
      models.forEach((model, index) => {
        console.log(
          `  ${index + 1}. ${model.folder}/${model.name} -> ${model.path}`,
        );
      });
    }
  } catch (error) {
    console.error(`❌ Failed to write index file:`, error.message);
    process.exit(1);
  }
}

// If this script is run directly
if (require.main === module) {
  generateModelsIndex();
}

module.exports = { generateModelsIndex, scanDirectory };
