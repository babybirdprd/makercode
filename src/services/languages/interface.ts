export interface LanguageProvider {
    /**
     * Unique ID for the language (e.g., "typescript", "rust")
     */
    id: string;

    /**
     * Returns true if this provider handles the given file extension
     */
    supports(filePath: string): boolean;

    /**
     * Returns the list of configuration files relevant to this language
     * (e.g., package.json, Cargo.toml)
     */
    getManifestFiles(): string[];

    /**
     * Runs the language-specific linter on a file.
     * Returns an array of error messages.
     */
    lintFile(filePath: string, projectRoot: string): Promise<string[]>;

    /**
     * Returns a system prompt snippet describing best practices for this language
     */
    getSystemPrompt(): string;
}