import { LanguageProvider } from "./interface";
import { MockTauriService } from "../tauriBridge";

export class PythonProvider implements LanguageProvider {
    id = "python";

    supports(filePath: string): boolean {
        return /\.(py|txt|toml)$/.test(filePath);
    }

    getManifestFiles(): string[] {
        return ['requirements.txt', 'pyproject.toml', 'setup.py'];
    }

    getSystemPrompt(): string {
        return `
        LANGUAGE CONTEXT: Python
        - Follow PEP 8 style guide.
        - Use type hints (typing module) for all function signatures.
        - Use docstrings for classes and methods.
        - Prefer f-strings over .format().
        `;
    }

    async lintFile(filePath: string, projectRoot: string): Promise<string[]> {
        const errors: string[] = [];

        try {
            const content = await MockTauriService.readFile(filePath);

            // SECURITY CHECKS
            if (content.match(/import\s+subprocess/)) errors.push("SECURITY: 'subprocess' module forbidden.");
            if (content.match(/import\s+os/) && content.includes('os.system')) errors.push("SECURITY: 'os.system' usage forbidden.");
            if (content.match(/\beval\s*\(/)) errors.push("SECURITY: 'eval()' usage forbidden.");
            if (content.match(/\bexec\s*\(/)) errors.push("SECURITY: 'exec()' usage forbidden.");

            if (content.includes('print(')) errors.push("Use 'logging' module instead of print().");
        } catch { }

        try {
            const output = await MockTauriService.executeShell('flake8', ['--format=default', filePath], projectRoot);
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes(filePath)) {
                    errors.push(`[Flake8] ${line}`);
                }
            }
        } catch (e) { }

        return errors;
    }
}