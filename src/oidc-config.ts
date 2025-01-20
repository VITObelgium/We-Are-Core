/**
 * Configuration class for OIDC (OpenID Connect).
 */
export class OidcConfig {
    clientId: string;
    clientSecret: string;
    url: URL;
    loginPath?: string;
    tokenPath?: string;
    clientName?: string;
    loginEndpoint?: URL;
    redirectEndpoint?: URL;
    tokenEndpoint?: URL;

    /**
     * Creates an instance of OidcConfig.
     * @param {URL} url - The base URL for the OIDC provider.
     * @param {string} clientId - The client ID for the OIDC client.
     * @param {string} clientSecret - The client secret for the OIDC client.
     * @param {Object} [options] - Optional configuration options.
     * @param {string} [options.loginPath] - The path for the login endpoint.
     * @param {URL} [options.redirectEndpoint] - The URL for the redirect endpoint.
     * @param {string} [options.tokenPath] - The path for the token endpoint.
     * @param {string} [options.clientName] - The name of the client.
     */
    constructor(url: URL, clientId: string, clientSecret: string, options?: { loginPath?: string, redirectEndpoint?: URL, tokenPath?: string, issuePath?: string, derivePath?: string, clientName?: string }) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.url = url;
        this.loginPath = options?.loginPath;
        this.tokenPath = options?.tokenPath;
        this.clientName = options?.clientName;

        const loginEndpoint = new URL(this.url);
        if(this.loginPath) {
            loginEndpoint.pathname = this.loginPath;
            this.loginEndpoint = loginEndpoint;
        }

        this.redirectEndpoint = options?.redirectEndpoint;

        const tokenEndpoint = new URL(this.url);
        if(this.tokenPath) {
            tokenEndpoint.pathname = this.tokenPath;
            this.tokenEndpoint = tokenEndpoint;
        }
    }
}