import { decodeJwt } from "jose";
import log from "loglevel";
import {SolidDataset, UrlString, WithResourceInfo, WithServerResourceInfo} from "@inrupt/solid-client";
import {
    AccessGrant, DatasetWithId, deleteSolidDataset,
    getFile,
    getSolidDataset,
    overwriteFile,
    saveSolidDatasetAt
} from "@inrupt/solid-client-access-grants";
import { createFetchWithCorrelationAndRequestId, createFetchWithIdToken } from "../factory/fetch-factory";
import { validateAccessGrant } from "../operator/vc-operator";
import { Service } from "./service";
import {VerifiableCredential} from "@inrupt/solid-client-vc";

const WWW_AUTH_HEADER = "www-authenticate";
const VC_CLAIM_TOKEN_TYPE = "https://www.w3.org/TR/vc-data-model/#json-ld";
const UMA_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:uma-ticket";
const UMA_CONFIG_PATH = "/.well-known/uma2-configuration";
const NO_WWW_AUTH_HEADER_ERROR = "No www-authentication header found in response headers; UMA cannot proceed. Refer to your network requests for details.";
const NO_WWW_AUTH_HEADER_UMA_TICKET_ERROR = 'www-authentication header in response headers did not include "ticket"; UMA cannot proceed. Refer to your network requests for details.';
const NO_WWW_AUTH_HEADER_UMA_IRI_ERROR = 'www-authentication header in response headers did not include "as_uri"; UMA cannot proceed. Refer to your network requests for details.';
const NO_ACCESS_TOKEN_RETURNED = "No access token was returned during the UMA exchange flow. Refer to your network requests for details.";
const UMA_TICKET_REGEX = /ticket="([^"]+)"/;
const UMA_IRI_REGEX = /as_uri="([^"]+)"/;

class UmaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UmaError";
    }
}

function parseUMAAuthIri(header: string): UrlString | null {
    const matches = UMA_IRI_REGEX.exec(header);
    return matches ? matches[1] : null;
}

interface UmaConfiguration {
    dpop_signing_alg_values_supported: string[];
    grant_types_supported: string[];
    issuer: UrlString;
    jwks_url: UrlString;
    token_endpoint: UrlString;
    uma_profiles_supported: UrlString[];
    verifiable_credential_issuer: UrlString;
}

class UmaTokenCache {
    private static readonly ONE_HOUR_MS = 60 * 60 * 1000;
    private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
    private cache = new Map<string, { token: string; exp: number; cachedAt: number }>();
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const nowInSeconds = Math.floor(now / 1000);
            for (const [key, value] of this.cache.entries()) {
                if (now - value.cachedAt > UmaTokenCache.ONE_HOUR_MS || value.exp < nowInSeconds) {
                    this.cache.delete(key);
                }
            }
        }, UmaTokenCache.CLEANUP_INTERVAL_MS);

        if (typeof this.cleanupInterval.unref === "function") {
            this.cleanupInterval.unref();
        }
    }



    get(key: string): { token: string; exp: number } | undefined {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }
        return { token: entry.token, exp: entry.exp };
    }

    set(key: string, value: { token: string; exp: number }): void {
        this.cache.set(key, {
            ...value,
            cachedAt: Date.now(),
        });
    }
}

class UmaConfigurationCache {
    private static readonly ONE_HOUR_MS = 60 * 60 * 1000;
    private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
    private cache = new Map<string, { config: UmaConfiguration; cachedAt: number }>();
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor() {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const nowInSeconds = Math.floor(now / 1000);
            for (const [key, value] of this.cache.entries()) {
                if (now - value.cachedAt > UmaConfigurationCache.ONE_HOUR_MS) {
                    this.cache.delete(key);
                }
            }
        }, UmaConfigurationCache.CLEANUP_INTERVAL_MS);

        if (typeof this.cleanupInterval.unref === "function") {
            this.cleanupInterval.unref();
        }
    }

    get(key: string): { config: UmaConfiguration; } | undefined {
        const entry = this.cache.get(key);
        if (!entry) {
            return undefined;
        }
        return { config: entry.config };
    }

    set(key: string, value: { config: UmaConfiguration; }): void {
        this.cache.set(key, {
            ...value,
            cachedAt: Date.now(),
        });
    }
}

function parseUMAAuthTicket(header: string): string | null {
    const matches = UMA_TICKET_REGEX.exec(header);
    return matches ? matches[1] : null;
}

async function exchangeTicketForAccessToken(
    tokenEndpoint: UrlString,
    accessGrant: DatasetWithId | VerifiableCredential,
    authTicket: string,
    authFetch: typeof fetch,
): Promise<string | null> {
    const credentialPresentation = {
        // This is the presentation context, so only the W3C context is required.
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiablePresentation"],
        verifiableCredential: [accessGrant],
    };
    const response = await authFetch(tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            claim_token: Buffer.from(JSON.stringify(credentialPresentation)).toString("base64"),
            claim_token_format: VC_CLAIM_TOKEN_TYPE,
            grant_type: UMA_GRANT_TYPE,
            ticket: authTicket,
        }).toString(),
    });

    try {
        const data: any = await response.json();
        return data.access_token || null;
    } catch {
        // An error being thrown here means that the response body doesn't parse as JSON.
        return null;
    }
}


/**
 * Service class for interacting with Solid Pods.
 */
export class PodService extends Service {

    private umaTokenCache = new UmaTokenCache();
    private umaConfigCache = new UmaConfigurationCache();

    async fetchUmaToken(resourceUrl: string, mode: 'Read'|'Write'|'Append', accessGrant: AccessGrant): Promise<string> {
        if(!this.oidcConfig) throw Error("[PodService.fetchUmaToken] OIDC configuration is required to fetch an UMA token.");

        const forPersonalData = accessGrant.credentialSubject.providedConsent.forPersonalData;
        const agResourceUrl = Array.isArray(forPersonalData) ? forPersonalData[0] : forPersonalData;
        const cacheKey = `${agResourceUrl}:${mode}:${accessGrant.id}`;

        const cachedToken = this.umaTokenCache.get(cacheKey);
        const fiveSecondsIntoTheFuture = Math.floor(Date.now() / 1000) + 5;

        if (cachedToken && cachedToken.exp > fiveSecondsIntoTheFuture) {
            log.debug(`[fetchUmaToken] Returning cached UMA token for key [${cacheKey}].`);
            return cachedToken.token;
        }

        validateAccessGrant(accessGrant, resourceUrl, mode);

        // Use an unauthenticated session to fetch the resource so that we can parse
        // its headers to find the UMA endpoint information and ticket
        const errorResponse = await fetch(agResourceUrl);
        const { headers } = errorResponse;

        const wwwAuthentication = headers.get(WWW_AUTH_HEADER);

        if (!wwwAuthentication) {
            throw new UmaError(NO_WWW_AUTH_HEADER_ERROR);
        }

        const authTicket = parseUMAAuthTicket(wwwAuthentication);
        const authIri = parseUMAAuthIri(wwwAuthentication);

        if (!authTicket) {
            throw new UmaError(NO_WWW_AUTH_HEADER_UMA_TICKET_ERROR);
        }

        if (!authIri) {
            throw new UmaError(NO_WWW_AUTH_HEADER_UMA_IRI_ERROR);
        }

        const umaConfiguration = await this.getUmaConfiguration(authIri);
        const tokenEndpoint = umaConfiguration.token_endpoint;

        const umaAuthedFetch = createFetchWithIdToken.bind({
            oidc_config: this.oidcConfig,
            token_service: this.tokenService,
        });

        const umaAccessToken = await exchangeTicketForAccessToken(
            tokenEndpoint,
            accessGrant,
            authTicket,
            umaAuthedFetch as any,
        );

        if (!umaAccessToken) {
            throw new UmaError(NO_ACCESS_TOKEN_RETURNED);
        }

        const decodedToken: any = decodeJwt(umaAccessToken);
        const exp = decodedToken?.exp;

        this.umaTokenCache.set(cacheKey, {
            token: umaAccessToken,
            exp
        });

        return umaAccessToken;
    }

    /**
     * Fetches a SolidDataset from a given resource URL using an access grant.
     * @param {URL} resourceUrl - The URL of the resource.
     * @param {AccessGrant} accessGrant - The access grant to use.
     * @param {string} [correlationId] - Optional correlation ID for logging.
     * @returns {Promise<SolidDataset & WithResourceInfo>} A promise that resolves to the fetched SolidDataset.
     */
    async getSolidDataset(resourceUrl: URL, accessGrant: AccessGrant, correlationId?: string): Promise<SolidDataset & WithResourceInfo> {
        if(!this.oidcConfig) throw Error("[PodService.getSolidDataset] OIDC configuration is required to fetch a solid dataset.");

        log.debug(`Fetching resource [${resourceUrl}] with access grant [${accessGrant.id}].`);
        validateAccessGrant(accessGrant, resourceUrl.href, 'Read');

        const context = {} as { correlationId? : string };
        if(correlationId)
            context.correlationId = correlationId;

        return await getSolidDataset(
            resourceUrl.href,
            accessGrant,
            {
                fetch: createFetchWithCorrelationAndRequestId.bind({ ...context, fetchFn: createFetchWithIdToken.bind({oidc_config: this.oidcConfig, token_service: this.tokenService})})
            }
        );
    }

    /**
     * Writes a SolidDataset to a given resource URL using an access grant.
     * @param {URL} resourceUrl - The URL of the resource.
     * @param {SolidDataset} solidDataset - The SolidDataset to write.
     * @param {AccessGrant} accessGrant - The access grant to use.
     * @param {string} [correlationId] - Optional correlation ID for logging.
     * @returns {Promise<null | any>} A promise that resolves when the dataset is written.
     */
    async writeSolidDataset(resourceUrl: URL, solidDataset: SolidDataset, accessGrant: AccessGrant, correlationId?: string ): Promise<null | any> {
        if(!this.oidcConfig) throw Error("[PodService.writeSolidDataset] OIDC configuration is required to write a solid dataset.");

        validateAccessGrant(accessGrant, resourceUrl.href, 'Write');

        const context = {} as { correlationId? : string };
        if(correlationId)
            context.correlationId = correlationId;

        return await saveSolidDatasetAt(resourceUrl.href, solidDataset, accessGrant, {
            fetch: createFetchWithCorrelationAndRequestId.bind({ ...context, fetchFn: createFetchWithIdToken.bind({oidc_config: this.oidcConfig, token_service: this.tokenService})})
        });
    };

    /**
     * Deletes a SolidDataset at a given resource URL using an access grant.
     * @param {URL} resourceUrl - The URL of the resource.
     * @param {AccessGrant} accessGrant - The access grant to use.
     * @param {string} [correlationId] - Optional correlation ID for logging.
     * @returns {Promise<null | any>} A promise that resolves when the dataset is deleted.
     */
    async deleteSolidDataset(resourceUrl: URL, accessGrant: AccessGrant, correlationId?: string ): Promise<null | any> {
        if(!this.oidcConfig) throw Error("[PodService.getSolidDataset] OIDC configuration is required to delete a solid dataset.");

        validateAccessGrant(accessGrant, resourceUrl.href, 'Write');

        const context = {} as { correlationId? : string };
        if(correlationId)
            context.correlationId = correlationId;

        return await deleteSolidDataset(resourceUrl.href, accessGrant, {
            fetch: createFetchWithCorrelationAndRequestId.bind({ ...context, fetchFn: createFetchWithIdToken.bind({oidc_config: this.oidcConfig, token_service: this.tokenService})})
        });
    };

    /**
     * Fetches a file from a given resource URL using an access grant.
     * @param {URL} resourceUrl - The URL of the resource.
     * @param {AccessGrant} accessGrant - The access grant to use.
     * @param {string} [correlationId] - Optional correlation ID for logging.
     * @returns {Promise<Blob & WithServerResourceInfo>} A promise that resolves to the fetched file.
     */
    async getFile(resourceUrl: URL, accessGrant: AccessGrant, correlationId?: string): Promise<Blob & WithServerResourceInfo> {
        if(!this.oidcConfig) throw Error("[PodService.getFile] OIDC configuration is required to retrieve a file.");

        validateAccessGrant(accessGrant, resourceUrl.href, 'Read');

        const context = {} as { correlationId? : string };
        if(correlationId)
            context.correlationId = correlationId;

        return await getFile(
            resourceUrl.href,
            accessGrant,
            {
                fetch: createFetchWithCorrelationAndRequestId.bind({
                    ...context,
                    fetchFn: createFetchWithIdToken.bind({oidc_config: this.oidcConfig, token_service: this.tokenService})
                })
            }
        );
    }

    /**
     * Writes a file to a given resource URL using an access grant.
     * @param {URL} fileUrl - The URL of the file.
     * @param {File | Blob} file - The file to write.
     * @param {AccessGrant} accessGrant - The access grant to use.
     * @param {string} [correlationId] - Optional correlation ID for logging.
     * @returns {Promise<File & WithServerResourceInfo & any>} A promise that resolves to the written file.
     */
    async writeFile(fileUrl: URL, file: File | Blob, accessGrant: AccessGrant, correlationId?: string): Promise<File & WithServerResourceInfo & any> {
        if(!this.oidcConfig) throw Error("[PodService.writeFile] OIDC configuration is required to write a file.");

        validateAccessGrant(accessGrant, fileUrl.href, 'Read');

        const context = {} as { correlationId? : string };
        if(correlationId)
            context.correlationId = correlationId;

        return await overwriteFile(
            fileUrl.href,
            file,
            accessGrant,
            {
                fetch: createFetchWithCorrelationAndRequestId.bind({
                    ...context,
                    fetchFn: createFetchWithIdToken.bind({oidc_config: this.oidcConfig, token_service: this.tokenService})
                })
            }
        );
    }


    async getUmaConfiguration (
        authIri: string,
    ): Promise<UmaConfiguration> {
        const cachedConfig = this.umaConfigCache.get(authIri);
        if (cachedConfig) {
            return cachedConfig.config;
        }

        const configurationUrl = new URL(UMA_CONFIG_PATH, authIri).href;
        const response = await fetch(configurationUrl);
        const config = await response.json().catch((e) => {
            throw new UmaError(
                `Parsing the UMA configuration found at ${configurationUrl} failed with the following error: ${e.toString()}`,
            );
        });

        this.umaConfigCache.set(authIri, {
            config
        });

        return config;
    }
}
