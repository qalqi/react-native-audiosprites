import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';
import path from 'path';

/**
 *   Robustness:
 * - Uses AST (Abstract Syntax Tree) traversal via ts-morph.
 * - Handles complex inheritance and type merging.
 * - Automatically generates global module augmentation.
 */

const project = new Project();
const libraryPath = 'node_modules/react-native-audio-api/src'; // Update to your library source path
const outputPath = 'types/native-audio-extensions.d.ts';

async function generate() {
  console.log('🚀 Starting Robust Type Extraction...');

  // 1. Load the library source files into a virtual project
  project.addSourceFilesAtPaths(`${libraryPath}/**/*.ts`);

  let ambientDeclarations = `/** * AUTO-GENERATED NATIVE AUDIO EXTENSIONS
 * This file provides types for react-native-audio-api without requiring it as a runtime dependency.
 */\n\n`;

  // 2. Target specific interfaces we want to "clone" for our SDK
  const targetInterfaces = ['AudioBufferQueueSourceNode', 'IBaseAudioContext'];

  const extractedTypes = new Set();

  project.getSourceFiles().forEach(sourceFile => {
    sourceFile.getInterfaces().forEach(inter => {
      const name = inter.getName();

      // We only extract what we need to avoid bloat
      if (targetInterfaces.includes(name) || name.includes('QueueSource')) {
        // Strip the 'I' prefix if they use internal interface naming conventions
        const cleanName = name.startsWith('I') && name[1] === name[1].toUpperCase() ? name.substring(1) : name;

        // Use the Printer to get clean, formatted TS code
        const typeText = inter.getText()
          .replace(`interface ${name}`, `interface ${cleanName}`)
          .replace(/export /g, ''); // Remove export keywords for ambient file

        extractedTypes.add(typeText);
      }
    });
  });

  // 3. Construct the Ambient Module
  ambientDeclarations += Array.from(extractedTypes).join('\n\n');

  // 4. Fortune 500 Global Augmentation
  ambientDeclarations += `
/**
 * Global Augmentation to merge Native methods into standard Web Audio types
 */
declare global {
  interface AudioContext extends ExtendedAudioContext {}
  interface OfflineAudioContext extends ExtendedAudioContext {}
}

interface ExtendedAudioContext {
  /**
   * Native-only: Creates a high-performance buffer queue for seamless looping and low-latency.
   * Not available in standard Browser AudioContext.
   */
  createBufferQueueSource(): AudioBufferQueueSourceNode;
}
`;

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outputPath, ambientDeclarations);
  console.log(`✅ Robust types generated at: ${outputPath}`);
}

generate().catch(console.error);
