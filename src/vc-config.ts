import log from "loglevel";

/**
 * Namespace used by the Solid VC discovery document to identify its services.
 */
const SOLID_VC_NS = "http://www.w3.org/ns/solid/vc#";

/**
 * Subset of the Verifiable Credential provider metadata as published on the
 * `.well-known/vc-configuration` endpoint.
 */
export interface VcConfiguration {
    issuerService?: string;
    derivationService?: string;
    queryService?: string;
    statusService?: string;
    verifierService?: string;

    [key: string]: any;
}

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
    discoveryEndpoint: URL;
    vcConfiguration?: VcConfiguration;

    private discoveryPromise?: Promise<VcConfiguration>;

    /**
     * Creates an instance of VcConfig.
     * The endpoints are resolved from the VC provider its `.well-known/vc-configuration` document.
     * Call {@link discover} (or let a service do it for you) to load that document.
     * @param {URL} url - The base URL for the VC provider.
     * @param {Object} [options] - Optional configuration options.
     * @param {string} [options.issuePath] - The path for the issue endpoint. @deprecated Resolved from the vc-configuration.
     * @param {string} [options.derivePath] - The path for the derive endpoint. @deprecated Resolved from the vc-configuration.
     * @param {string} [options.queryPath] - The path for the query endpoint. @deprecated Resolved from the vc-configuration.
     */
    constructor(url: URL, options?: { issuePath?: string, derivePath?: string, queryPath?: string }) {
        this.url = url;
        this.issuePath = options?.issuePath;
        this.derivePath = options?.derivePath;
        this.queryPath = options?.queryPath;

        if (this.issuePath) {
            log.warn("[VcConfig] The 'issuePath' option is deprecated and will be removed in a future release. The issue endpoint is resolved from the provider its .well-known/vc-configuration document.");
            const issueEndpoint = new URL(this.url);
            issueEndpoint.pathname = this.issuePath;
            this.issueEndpoint = issueEndpoint;
        }

        if (this.derivePath) {
            log.warn("[VcConfig] The 'derivePath' option is deprecated and will be removed in a future release. The derive endpoint is resolved from the provider its .well-known/vc-configuration document.");
            const deriveEndpoint = new URL(this.url);
            deriveEndpoint.pathname = this.derivePath;
            this.deriveEndpoint = deriveEndpoint;
        }

        if (this.queryPath) {
            log.warn("[VcConfig] The 'queryPath' option is deprecated and will be removed in a future release. The query endpoint is resolved from the provider its .well-known/vc-configuration document.");
            const queryEndpoint = new URL(this.url);
            queryEndpoint.pathname = this.queryPath;
            this.queryEndpoint = queryEndpoint;
        }

        this.discoveryEndpoint = VcConfig.resolveDiscoveryEndpoint(this.url);
    }

    /**
     * Builds the `.well-known/vc-configuration` URL for the given base URL,
     * keeping a potentially present base path intact.
     * @param {URL} url - The base URL for the VC provider.
     * @returns {URL} The discovery endpoint.
     */
    private static resolveDiscoveryEndpoint(url: URL): URL {
        const discoveryEndpoint = new URL(url);
        if (discoveryEndpoint.pathname.includes('.well-known/vc-configuration')) return discoveryEndpoint;

        discoveryEndpoint.pathname = `${discoveryEndpoint.pathname.replace(/\/+$/, '')}/.well-known/vc-configuration`;
        return discoveryEndpoint;
    }

    /**
     * Fetches the vc-configuration of the provider and resolves the endpoints with it.
     * Endpoints derived from the deprecated `issuePath` / `derivePath` / `queryPath` options take precedence.
     * The document is fetched only once; subsequent calls return the cached result unless `force` is set.
     * @param {boolean} [force=false] - Forces a refetch of the vc-configuration document.
     * @returns {Promise<VcConfiguration>} A promise that resolves to the vc-configuration document.
     */
    async discover(force: boolean = false): Promise<VcConfiguration> {
        if (force) {
            this.discoveryPromise = undefined;
            this.vcConfiguration = undefined;
        }

        this.discoveryPromise ||= this.fetchVcConfiguration();

        try {
            return await this.discoveryPromise;
        } catch (error) {
            this.discoveryPromise = undefined;
            throw error;
        }
    }

    private async fetchVcConfiguration(): Promise<VcConfiguration> {
        log.debug(`[VcConfig.discover] Fetching vc-configuration from ${this.discoveryEndpoint.href}`);

        const response = await fetch(this.discoveryEndpoint.href, {headers: {'Accept': 'application/ld+json, application/json'}});
        if (!response.ok) throw new Error(`[VcConfig.discover] Failed to fetch the vc-configuration from ${this.discoveryEndpoint.href}: ${response.status} ${response.statusText}`);

        const vcConfiguration = await response.json() as VcConfiguration;
        this.vcConfiguration = vcConfiguration;
        this.applyVcConfiguration(vcConfiguration);

        return vcConfiguration;
    }

    /**
     * Applies the endpoints of a vc-configuration document on this configuration.
     * Explicitly configured (deprecated) paths are never overwritten.
     * @param {VcConfiguration} vcConfiguration - The vc-configuration document.
     */
    private applyVcConfiguration(vcConfiguration: VcConfiguration): void {
        const issuerService = VcConfig.resolveService(vcConfiguration, 'issuerService');
        if (!this.issuePath && issuerService) this.issueEndpoint = new URL(issuerService);

        const derivationService = VcConfig.resolveService(vcConfiguration, 'derivationService');
        if (!this.derivePath && derivationService) this.deriveEndpoint = new URL(derivationService);

        const queryService = VcConfig.resolveService(vcConfiguration, 'queryService');
        if (!this.queryPath && queryService) this.queryEndpoint = new URL(queryService);
    }

    /**
     * Reads a service IRI from a vc-configuration document.
     * The document is JSON-LD, so a service is either aliased by its term or expanded to its full IRI,
     * and its value is either a plain IRI, a node object, or a list of either.
     * @param {VcConfiguration} vcConfiguration - The vc-configuration document.
     * @param {string} service - The term of the service to resolve.
     * @returns {string | undefined} The IRI of the service, if published.
     */
    private static resolveService(vcConfiguration: VcConfiguration, service: string): string | undefined {
        return VcConfig.resolveServiceIri(vcConfiguration[service] ?? vcConfiguration[`${SOLID_VC_NS}${service}`]);
    }

    private static resolveServiceIri(value: any): string | undefined {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value.map((entry) => VcConfig.resolveServiceIri(entry)).find((iri) => iri !== undefined);
        if (value && typeof value === 'object' && typeof value['@id'] === 'string') return value['@id'];
        return undefined;
    }
}
