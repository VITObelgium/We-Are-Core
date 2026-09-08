import log from "loglevel";

/**
 * Subset of the OpenID Provider Metadata as published on the
 * `.well-known/openid-configuration` endpoint.
 */
export interface OpenIdConfiguration {
    issuer?: string;
    authorization_endpoint?: string;
    token_endpoint?: string;

    [key: string]: any;
}

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
    discoveryEndpoint: URL;
    openIdConfiguration?: OpenIdConfiguration;

    private discoveryPromise?: Promise<OpenIdConfiguration>;

    /**
     * Creates an instance of OidcConfig.
     * The endpoints are resolved from the OpenID provider its `.well-known/openid-configuration` document.
     * Call {@link discover} (or let a service do it for you) to load that document.
     * @param {URL} url - The base URL for the OIDC provider.
     * @param {string} clientId - The client ID for the OIDC client.
     * @param {string} clientSecret - The client secret for the OIDC client.
     * @param {Object} [options] - Optional configuration options.
     * @param {string} [options.loginPath] - The path for the login endpoint. @deprecated Resolved from the openid-configuration.
     * @param {URL} [options.redirectEndpoint] - The URL for the redirect endpoint.
     * @param {string} [options.tokenPath] - The path for the token endpoint. @deprecated Resolved from the openid-configuration.
     * @param {string} [options.clientName] - The name of the client.
     */
    constructor(url: URL, clientId: string, clientSecret: string, options?: { loginPath?: string, redirectEndpoint?: URL, tokenPath?: string, issuePath?: string, derivePath?: string, clientName?: string }) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.url = url;
        this.loginPath = options?.loginPath;
        this.tokenPath = options?.tokenPath;
        this.clientName = options?.clientName;

        if (this.loginPath) {
            log.warn("[OidcConfig] The 'loginPath' option is deprecated and will be removed in a future release. The login endpoint is resolved from the provider its .well-known/openid-configuration document.");
            const loginEndpoint = new URL(this.url);
            loginEndpoint.pathname = this.loginPath;
            this.loginEndpoint = loginEndpoint;
        }

        this.redirectEndpoint = options?.redirectEndpoint;

        if (this.tokenPath) {
            log.warn("[OidcConfig] The 'tokenPath' option is deprecated and will be removed in a future release. The token endpoint is resolved from the provider its .well-known/openid-configuration document.");
            const tokenEndpoint = new URL(this.url);
            tokenEndpoint.pathname = this.tokenPath;
            this.tokenEndpoint = tokenEndpoint;
        }

        this.discoveryEndpoint = OidcConfig.resolveDiscoveryEndpoint(this.url);
    }

    /**
     * Builds the `.well-known/openid-configuration` URL for the given base URL,
     * keeping a potentially present base path intact.
     * @param {URL} url - The base URL for the OIDC provider.
     * @returns {URL} The discovery endpoint.
     */
    private static resolveDiscoveryEndpoint(url: URL): URL {
        const discoveryEndpoint = new URL(url);
        if (discoveryEndpoint.pathname.includes('.well-known/openid-configuration')) return discoveryEndpoint;

        discoveryEndpoint.pathname = `${discoveryEndpoint.pathname.replace(/\/+$/, '')}/.well-known/openid-configuration`;
        return discoveryEndpoint;
    }

    /**
     * Fetches the OpenID configuration of the provider and resolves the endpoints with it.
     * Endpoints derived from the deprecated `loginPath` / `tokenPath` options take precedence.
     * The document is fetched only once; subsequent calls return the cached result unless `force` is set.
     * @param {boolean} [force=false] - Forces a refetch of the openid-configuration document.
     * @returns {Promise<OpenIdConfiguration>} A promise that resolves to the openid-configuration document.
     */
    async discover(force: boolean = false): Promise<OpenIdConfiguration> {
        if (force) {
            this.discoveryPromise = undefined;
            this.openIdConfiguration = undefined;
        }

        this.discoveryPromise ||= this.fetchOpenIdConfiguration();

        try {
            return await this.discoveryPromise;
        } catch (error) {
            this.discoveryPromise = undefined;
            throw error;
        }
    }

    private async fetchOpenIdConfiguration(): Promise<OpenIdConfiguration> {
        log.debug(`[OidcConfig.discover] Fetching openid-configuration from ${this.discoveryEndpoint.href}`);

        const response = await fetch(this.discoveryEndpoint.href, {headers: {'Accept': 'application/json'}});
        if (!response.ok) throw new Error(`[OidcConfig.discover] Failed to fetch the openid-configuration from ${this.discoveryEndpoint.href}: ${response.status} ${response.statusText}`);

        const openIdConfiguration = await response.json() as OpenIdConfiguration;
        this.openIdConfiguration = openIdConfiguration;
        this.applyOpenIdConfiguration(openIdConfiguration);

        return openIdConfiguration;
    }

    /**
     * Applies the endpoints of an openid-configuration document on this configuration.
     * Explicitly configured (deprecated) paths are never overwritten.
     * @param {OpenIdConfiguration} openIdConfiguration - The openid-configuration document.
     */
    private applyOpenIdConfiguration(openIdConfiguration: OpenIdConfiguration): void {
        const authorizationEndpoint = openIdConfiguration.authorization_endpoint;
        if (!this.loginPath && authorizationEndpoint) this.loginEndpoint = new URL(authorizationEndpoint);

        if (!this.tokenPath && openIdConfiguration.token_endpoint) this.tokenEndpoint = new URL(openIdConfiguration.token_endpoint);
    }
}
