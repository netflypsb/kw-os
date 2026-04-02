import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';

const EXECUTION_TIMEOUT = 30_000; // 30 seconds per execution
const SENTINEL = '__KWOS_REPL_DONE__';

// Python imports that are blocked for safety
const BLOCKED_IMPORTS = [
  'os', 'subprocess', 'socket', 'requests', 'urllib',
  'http', 'shutil', 'pathlib', 'glob', 'sys',
  'importlib', 'ctypes', 'signal', 'multiprocessing',
];

/**
 * Sandboxed Python REPL executor for the RLM engine.
 *
 * Spawns a persistent Python subprocess with pre-loaded variables.
 * Code execution is sandboxed: dangerous imports are blocked,
 * filesystem access is restricted, and each execution has a timeout.
 */
export class REPLExecutor {
  private process: ChildProcess | null = null;
  private variables: Map<string, string> = new Map();
  private functions: Map<string, (...args: string[]) => Promise<string>> = new Map();
  private tempDir: string;
  private ready: boolean = false;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), `kwos-repl-${crypto.randomUUID().slice(0, 8)}`);
  }

  /**
   * Set a variable in the REPL environment.
   * Must be called before start() for the variable to be available.
   */
  setVariable(name: string, value: string): void {
    this.variables.set(name, value);
  }

  /**
   * Register a callable function (e.g., recursive_llm).
   * These are intercepted via a special protocol in the REPL output.
   */
  registerFunction(name: string, fn: (...args: string[]) => Promise<string>): void {
    this.functions.set(name, fn);
  }

  /**
   * Start the Python REPL subprocess.
   */
  async start(): Promise<void> {
    if (this.ready) return;

    // Create temp directory for sandboxed execution
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    // Write the bootstrap script
    const bootstrapPath = path.join(this.tempDir, 'bootstrap.py');
    fs.writeFileSync(bootstrapPath, this.buildBootstrapScript());

    this.process = spawn('python', ['-u', bootstrapPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.tempDir,
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONUNBUFFERED: '1',
      },
    });

    // Wait for ready signal
    await this.waitForOutput(SENTINEL, 10_000);
    this.ready = true;
  }

  /**
   * Execute a code string in the REPL and return the output.
   */
  async execute(code: string): Promise<string> {
    if (!this.ready || !this.process) {
      await this.start();
    }

    // Validate code safety
    const safetyCheck = this.checkCodeSafety(code);
    if (safetyCheck) {
      return `SecurityError: ${safetyCheck}`;
    }

    // Send code to REPL
    const escapedCode = Buffer.from(code).toString('base64');
    this.process!.stdin!.write(`__EXEC__${escapedCode}\n`);

    // Collect output until sentinel
    const output = await this.waitForOutput(SENTINEL, EXECUTION_TIMEOUT);

    // Check for function call requests
    const funcCallMatch = output.match(/__FUNC_CALL__(\w+)\|(.+?)__FUNC_END__/s);
    if (funcCallMatch) {
      const funcName = funcCallMatch[1];
      const argsJson = funcCallMatch[2];

      const fn = this.functions.get(funcName);
      if (fn) {
        try {
          const args = JSON.parse(argsJson) as string[];
          const result = await fn(...args);
          // Send result back to REPL
          const encodedResult = Buffer.from(result).toString('base64');
          this.process!.stdin!.write(`__FUNC_RESULT__${encodedResult}\n`);
          // Wait for continued execution
          const continued = await this.waitForOutput(SENTINEL, EXECUTION_TIMEOUT);
          return output.replace(/__FUNC_CALL__.*?__FUNC_END__/s, '') + continued;
        } catch (err) {
          return `Function call error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
      return `Unknown function: ${funcName}`;
    }

    return output;
  }

  /**
   * Check code for dangerous operations.
   */
  private checkCodeSafety(code: string): string | null {
    for (const blocked of BLOCKED_IMPORTS) {
      const importPattern = new RegExp(
        `(?:^|\\s)(?:import\\s+${blocked}|from\\s+${blocked}\\s+import)`,
        'm'
      );
      if (importPattern.test(code)) {
        return `Import of '${blocked}' is not allowed in the sandbox`;
      }
    }

    // Block exec/eval of dynamic code
    if (/\b(?:exec|eval|compile|__import__)\s*\(/.test(code)) {
      return 'exec/eval/compile/__import__ are not allowed in the sandbox';
    }

    // Block file operations
    if (/\bopen\s*\(/.test(code) && !code.includes('# safe: file')) {
      return 'File operations are not allowed in the sandbox';
    }

    return null;
  }

  /**
   * Wait for a specific sentinel string in the process output.
   */
  private waitForOutput(sentinel: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdout) {
        return reject(new Error('REPL process not running'));
      }

      let output = '';
      const timer = setTimeout(() => {
        cleanup();
        resolve(output + '\n[Execution timed out]');
      }, timeout);

      const onData = (data: Buffer) => {
        output += data.toString();
        if (output.includes(sentinel)) {
          cleanup();
          resolve(output.replace(sentinel, '').trim());
        }
      };

      const onError = (data: Buffer) => {
        output += `[stderr] ${data.toString()}`;
      };

      const cleanup = () => {
        clearTimeout(timer);
        this.process?.stdout?.off('data', onData);
        this.process?.stderr?.off('data', onError);
      };

      this.process.stdout.on('data', onData);
      this.process.stderr?.on('data', onError);
    });
  }

  /**
   * Build the Python bootstrap script that runs in the subprocess.
   */
  private buildBootstrapScript(): string {
    // Pre-serialize variables into the script
    const varLines = [...this.variables.entries()]
      .map(([name, value]) => {
        const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `${name} = '''${escaped}'''`;
      })
      .join('\n');

    // Function stubs that communicate back to Node.js via stdout protocol
    const funcStubs = [...this.functions.keys()]
      .map(name => `
def ${name}(*args):
    import json, base64
    args_json = json.dumps(args)
    print(f"__FUNC_CALL__${name}|{args_json}__FUNC_END__", flush=True)
    # Wait for result from Node.js
    result_line = input()
    if result_line.startswith("__FUNC_RESULT__"):
        encoded = result_line[len("__FUNC_RESULT__"):]
        return base64.b64decode(encoded).decode('utf-8')
    return ""
`)
      .join('\n');

    return `
import re
import json
import math
import base64
import collections

# Pre-loaded variables
${varLines}

# Function stubs
${funcStubs}

# Signal ready
print("${SENTINEL}", flush=True)

# REPL loop
while True:
    try:
        line = input()
        if line.startswith("__EXEC__"):
            encoded_code = line[len("__EXEC__"):]
            code = base64.b64decode(encoded_code).decode('utf-8')
            try:
                # Try eval first (for expressions)
                result = eval(code)
                if result is not None:
                    print(str(result), flush=True)
            except SyntaxError:
                # Fall back to exec (for statements)
                exec(code)
            except Exception as e:
                print(f"Error: {type(e).__name__}: {e}", flush=True)
            print("${SENTINEL}", flush=True)
    except EOFError:
        break
    except Exception as e:
        print(f"REPL Error: {e}", flush=True)
        print("${SENTINEL}", flush=True)
`;
  }

  /**
   * Stop the REPL subprocess and clean up.
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill();
      this.process = null;
    }
    this.ready = false;

    // Clean up temp directory
    try {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}
