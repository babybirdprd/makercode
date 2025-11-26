import { LanguageProvider } from "./interface";
import { MockTauriService } from "../tauriBridge";

export class RustProvider implements LanguageProvider {
    id = "rust";

    supports(filePath: string): boolean {
        return /\.(rs|toml)$/.test(filePath);
    }

    getManifestFiles(): string[] {
        return ['Cargo.toml', 'Cargo.lock'];
    }

    getSystemPrompt(): string {
        return `
        LANGUAGE CONTEXT: Rust
        - Follow standard formatting (rustfmt).
        - Handle all Result/Option types (no .unwrap() in production code).
        - Use idiomatic error handling (thiserror/anyhow).
        - Prefer references (&str) over owning Strings where possible.
        `;
    }

    async lintFile(filePath: string, projectRoot: string): Promise<string[]> {
        const errors: string[] = [];

        try {
            const content = await MockTauriService.readFile(filePath);

            // SECURITY CHECKS
            if (content.includes('std::process::Command')) errors.push("SECURITY: 'std::process::Command' usage forbidden.");
            if (content.includes('unsafe {')) errors.push("SECURITY: 'unsafe' blocks require manual review.");

            if (content.includes('.unwrap()')) errors.push("Avoid .unwrap(), use match or ? operator.");
            if (content.includes('println!')) errors.push("Use proper logging instead of println!.");
        } catch { }

        try {
            const output = await MockTauriService.executeShell('cargo', ['clippy', '--message-format=json', '--no-deps'], projectRoot);
            const lines = output.split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const msg = JSON.parse(line);
                    if (msg.reason === 'compiler-message' && msg.message) {
                        const span = msg.message.spans?.[0];
                        if (span && span.file_name && filePath.endsWith(span.file_name)) {
                            errors.push(`[Rustc] Line ${span.line_start}: ${msg.message.message}`);
                        }
                    }
                } catch { }
            }
        } catch (e) { }

        return errors;
    }
}