import { open } from '@tauri-apps/plugin-dialog';
import { readDir, readTextFile, writeTextFile, mkdir, watch } from '@tauri-apps/plugin-fs';
import { Command } from '@tauri-apps/plugin-shell';

declare global {
  interface Window {
    __TAURI__?: any;
    __TAURI_INTERNALS__?: any;
  }
}

// Browser Shim for Web Preview Mode
class BrowserShim {
  static async open(): Promise<string | null> {
    return prompt("Enter mock project path (Web Mode):", "/mock/project");
  }
  static async readDir(path: string): Promise<any[]> {
    console.log(`[Shim] readDir: ${path}`);
    return [];
  }
  static async readTextFile(path: string): Promise<string> {
    console.log(`[Shim] readTextFile: ${path}`);
    return "";
  }
}

export interface ProcessHandle {
  pid: number;
  kill: () => Promise<void>;
  write: (data: string) => Promise<void>;
}

export class MockTauriService {
  private static isTauri(): boolean {
    return typeof window !== 'undefined' && (!!window.__TAURI__ || !!window.__TAURI_INTERNALS__);
  }

  static async openDialog(): Promise<string | null> {
    if (this.isTauri()) {
      try {
        const selected = await open({
          directory: true,
          multiple: false,
          title: "Open MAKER Project"
        });
        return selected as string | null;
      } catch (e) {
        console.error("Dialog failed:", e);
        return null;
      }
    }
    return BrowserShim.open();
  }

  static async listFiles(path: string): Promise<any[]> {
    if (this.isTauri()) {
      try {
        return await readDir(path);
      } catch (e) {
        console.error(`Failed to read dir ${path}:`, e);
        return [];
      }
    }
    return BrowserShim.readDir(path);
  }

  static async writeFile(path: string, content: string): Promise<void> {
    if (this.isTauri()) {
      try {
        await writeTextFile(path, content);
        return;
      } catch (e) {
        console.error(`Failed to write file ${path}:`, e);
        throw e;
      }
    }
    console.log(`[Shim] Wrote to ${path}`);
  }

  static async readFile(path: string): Promise<string> {
    if (this.isTauri()) {
      try {
        return await readTextFile(path);
      } catch (e) {
        console.error(`Failed to read file ${path}:`, e);
        throw e;
      }
    }
    return BrowserShim.readTextFile(path);
  }

  static async mkdir(path: string): Promise<void> {
    if (this.isTauri()) {
      try {
        await mkdir(path, { recursive: true });
      } catch (e) {
        console.error(`Failed to mkdir ${path}:`, e);
      }
      return;
    }
    console.log(`[Shim] mkdir -p ${path}`);
  }

  static async executeShell(command: string, args: string[] = [], cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = "";
      this.spawnShell(command, args, cwd,
        (data) => output += data + "\n",
        (code) => {
          if (code === 0) resolve(output);
          else reject(new Error(`Command failed with code ${code}\n${output}`));
        }
      ).catch(reject);
    });
  }

  static async spawnShell(
    command: string,
    args: string[],
    cwd: string | undefined,
    onOutput: (data: string, type: 'stdout' | 'stderr') => void,
    onExit: (code: number) => void
  ): Promise<ProcessHandle> {

    if (cwd && cwd.includes('..')) {
      throw new Error("Security Violation: Shell CWD traversal detected.");
    }

    if (this.isTauri()) {
      try {
        let cmd: Command<string>;

        if (command === 'git') cmd = Command.create('git', args, { cwd });
        else if (command === 'npx') cmd = Command.create('npx', args, { cwd });
        else if (command === 'npm') cmd = Command.create('npm', args, { cwd });
        else {
          console.warn(`Command '${command}' not explicitly allowed. Trying generic...`);
          cmd = Command.create(command, args, { cwd });
        }

        cmd.on('close', (data) => {
          onExit(data.code);
        });

        cmd.on('error', (error) => {
          onOutput(`Spawn Error: ${error}`, 'stderr');
          onExit(1);
        });

        cmd.stdout.on('data', (line) => onOutput(line, 'stdout'));
        cmd.stderr.on('data', (line) => onOutput(line, 'stderr'));

        const child = await cmd.spawn();

        return {
          pid: child.pid,
          kill: async () => {
            try {
              await child.kill();
            } catch (e) {
              console.error("Failed to kill process:", e);
            }
          },
          write: async (data) => {
            try {
              await child.write(data);
            } catch (e) {
              console.error("Failed to write to stdin:", e);
            }
          }
        };

      } catch (e: any) {
        // FIX: Ensure we return a valid string message
        const msg = e.message || (typeof e === 'string' ? e : JSON.stringify(e));
        throw new Error(`Failed to spawn '${command}': ${msg}`);
      }
    }

    // --- BROWSER SHIM ---
    console.log(`[Shim Spawn] ${command} ${args.join(' ')} in ${cwd || '.'}`);

    let interval: any;
    let step = 0;
    const mockPid = Math.floor(Math.random() * 10000);

    if (command === 'npm' && args.includes('install')) {
      interval = setInterval(() => {
        step++;
        if (step === 1) onOutput("npm warn deprecated ...", 'stderr');
        if (step === 2) onOutput("reify:fsevents: \u001b[32mhttp fetch\u001b[0m GET 200 ...", 'stdout');
        if (step === 3) onOutput("reify:rxjs: \u001b[32mhttp fetch\u001b[0m GET 200 ...", 'stdout');
        if (step === 4) onOutput("added 142 packages in 2s", 'stdout');
        if (step >= 5) {
          clearInterval(interval);
          onExit(0);
        }
      }, 800);
    } else {
      setTimeout(() => {
        if (command === 'ls') onOutput("src  package.json  tsconfig.json", 'stdout');
        else if (command === 'git' && args.includes('status')) onOutput("On branch main\nYour branch is up to date.", 'stdout');
        else onOutput(`[Mock] Executed ${command}`, 'stdout');
        onExit(0);
      }, 500);
    }

    return {
      pid: mockPid,
      kill: async () => {
        if (interval) clearInterval(interval);
        onOutput("^C [Process Killed]", 'stderr');
        onExit(130); // SIGINT
      },
      write: async () => { }
    };
  }

  static async watchPath(path: string, callback: (event: any) => void): Promise<() => void> {
    if (this.isTauri()) {
      try {
        const unwatch = await watch(path, (event) => {
          callback(event);
        }, { recursive: true });
        return unwatch;
      } catch (e) {
        console.warn("Failed to start watcher:", e);
        return () => { };
      }
    }
    return () => { };
  }
}