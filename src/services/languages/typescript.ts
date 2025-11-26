import { LanguageProvider } from "./interface";
import { MockTauriService } from "../tauriBridge";

export class TypeScriptProvider implements LanguageProvider {
    id = "typescript";

    supports(filePath: string): boolean {
        return /\.(ts|tsx|js|jsx|json)$/.test(filePath);
    }

    getManifestFiles(): string[] {
        return ['package.json', 'tsconfig.json', '.eslintrc.json'];
    }

    getSystemPrompt(): string {
        return `
        LANGUAGE CONTEXT: TypeScript/Node.js
        - Use 'const' over 'var'.
        - Prefer Interfaces over Types for object definitions.
        - strictNullChecks is ON. Handle null/undefined explicitly.
        - Use ES Modules (import/export).
        `;
    }

    async lintFile(filePath: string, projectRoot: string): Promise<string[]> {
        const errors: string[] = [];

        try {
            const content = await MockTauriService.readFile(filePath);

            // SECURITY CHECKS
            if (content.match(/import\s+.*\s+from\s+['"]child_process['"]/)) errors.push("SECURITY: 'child_process' import forbidden.");
            if (content.match(/require\(['"]child_process['"]\)/)) errors.push("SECURITY: 'child_process' require forbidden.");
            if (content.match(/\beval\s*\(/)) errors.push("SECURITY: 'eval()' usage forbidden.");
            if (content.match(/\bexec\s*\(/)) errors.push("SECURITY: 'exec()' usage forbidden.");

            // Best Practices
            if (content.includes(': any')) errors.push("Explicit 'any' type is forbidden.");
            if (content.includes('console.log')) errors.push("Remove console.log before committing.");
        } catch { }

        try {
            const output = await MockTauriService.executeShell('npx', ['eslint', '--format=json', filePath], projectRoot);
            const results = JSON.parse(output);
            if (Array.isArray(results)) {
                results.forEach(res => {
                    res.messages?.forEach((msg: any) => {
                        errors.push(`[ESLint] Line ${msg.line}: ${msg.message}`);
                    });
                });
            }
        } catch (e) {
            // ESLint optional
        }

        return errors;
    }
}