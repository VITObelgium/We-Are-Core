/**
 * Configuration class for Verifiable Credentials (VC).
 */
export class VcConfig {
    url: URL;
    issuePath?: string;
    derivePath?: string;
    queryPath?: string;
    issueEndpoint?: URL;
    deriveEndpoint?: URL;
    queryEndpoint?: URL;

    /**
     * Creates an instance of VcConfig.
     * @param {URL} url - The base URL for the VC provider.
     * @param {Object} [options] - Optional configuration options.
     * @param {string} [options.issuePath] - The path for the issue endpoint.
     * @param {string} [options.derivePath] - The path for the derive endpoint.
     */
    constructor(url: URL, options?: { issuePath?: string, derivePath?: string, queryPath?: string }) {
        this.url = url;
        this.issuePath = options?.issuePath;
        this.derivePath = options?.derivePath;
        this.queryPath = options?.queryPath;

        const issueEndpoint = url;
        if(this.issuePath) {
            issueEndpoint.pathname = this.issuePath;
            this.issueEndpoint = issueEndpoint;
        }

        const deriveEndpoint = url;
        if(this.derivePath) {
            deriveEndpoint.pathname = this.derivePath;
            this.deriveEndpoint = deriveEndpoint;
        }

        const queryPath = url;
        if(this.queryPath) {
            queryPath.pathname = this.queryPath;
            this.queryEndpoint = queryPath;
        }
    }
}