import { MockTauriService } from "./tauriBridge";
import { MakerConfig } from "../types";

const CONFIG_FILE = ".maker/config.json";

export class ProjectService {

    static async loadConfig(projectRoot: string): Promise<MakerConfig | null> {
        try {
            const fullPath = `${projectRoot}/${CONFIG_FILE}`;
            const content = await MockTauriService.readFile(fullPath);
            if (!content) return null;
            return JSON.parse(content) as MakerConfig;
        } catch (e) {
            // Silent fail on load is acceptable (new project)
            return null;
        }
    }

    static async saveConfig(projectRoot: string, config: MakerConfig): Promise<boolean> {
        try {
            const fullPath = `${projectRoot}/${CONFIG_FILE}`;

            // Ensure directories exist using FS plugin, not shell
            await this.ensureMakerDirectory(projectRoot);

            await MockTauriService.writeFile(fullPath, JSON.stringify(config, null, 2));
            return true;
        } catch (e) {
            console.error("Failed to save config:", e);
            return false;
        }
    }

    static async ensureMakerDirectory(projectRoot: string) {
        // Use the bridge's mkdir which wraps tauri-plugin-fs
        await MockTauriService.mkdir(`${projectRoot}/.maker`);
        await MockTauriService.mkdir(`${projectRoot}/.maker/worktrees`);
        await MockTauriService.mkdir(`${projectRoot}/.maker/logs`);
    }
}