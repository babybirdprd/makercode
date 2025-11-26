import { LanguageProvider } from "./interface";
import { TypeScriptProvider } from "./typescript";
import { RustProvider } from "./rust";
import { PythonProvider } from "./python";

export class LanguageRegistry {
    private static instance: LanguageRegistry;
    private providers: LanguageProvider[] = [];

    private constructor() {
        this.providers = [
            new TypeScriptProvider(),
            new RustProvider(),
            new PythonProvider()
        ];
    }

    public static getInstance(): LanguageRegistry {
        if (!LanguageRegistry.instance) {
            LanguageRegistry.instance = new LanguageRegistry();
        }
        return LanguageRegistry.instance;
    }

    public getProvider(filePath: string): LanguageProvider | null {
        return this.providers.find(p => p.supports(filePath)) || null;
    }

    public getAllManifests(): string[] {
        return this.providers.flatMap(p => p.getManifestFiles());
    }
}