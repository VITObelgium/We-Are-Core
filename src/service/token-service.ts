import { calculateJwkThumbprint, decodeJwt, decodeProtectedHeader, JWK } from "jose";
import log from "loglevel";
import {createDpop} from "../factory/token-factory";
import {Service} from "./service";

/**
 * Service class for handling token requests.
 */
export class TokenService extends Service {

    private tokenCache = new Map<string, any>();

    /**
     * Builds the part of the token cache key that identifies the proof-of-possession binding of a token.
     * Tokens obtained with a DPoP proof are bound to the key of that proof and must never be handed out
     * for a plain Bearer request (or for a request using a different key), so the thumbprint of the DPoP
     * key is part of the cache key. The DPoP proof itself is not usable as a key, since every proof is
     * unique and would make the cache ineffective.
     * @param {string} [dpopHeader] - Optional DPoP header.
     * @returns {Promise<string>} A promise that resolves to the binding part of the cache key.
     */
    private async cacheKeyBinding(dpopHeader?: string): Promise<string> {
        if (!dpopHeader) return "bearer";

        try {
            const { jwk } = decodeProtectedHeader(dpopHeader) as { jwk?: JWK };
            if (jwk) return `dpop:${await calculateJwkThumbprint(jwk)}`;
        } catch (error) {
            log.debug(`[cacheKeyBinding] Could not derive the key thumbprint from the DPoP header, falling back to the DPoP header itself.`);
        }

        return `dpop:${dpopHeader}`;
    }

    /**
     * Requests an access token.
     * @param {string} [dpopHeader] - Optional DPoP header.
     * @param {string} [scope] - Optional space separated list of scopes.
     * @returns {Promise<any>} A promise that resolves to the token response.
     */
    async requestAccessToken(dpopHeader?: string, scope = ""): Promise<any> {
        if(!this.oidcConfig) throw Error("[TokenService.requestAccessToken] OIDC configuration is required to request access token from We Are OIDC.");

        await this.oidcConfig.discover();

        const binding = await this.cacheKeyBinding(dpopHeader);
        const accessTokenCacheKey = `at:${binding}:${scope}`;
        const idTokenCacheKey = `id:${binding}:${scope}`;

        const cachedAccessToken = this.tokenCache.get(accessTokenCacheKey);
        const cachedIdToken = this.tokenCache.get(idTokenCacheKey);
        const fiveSecondsIntoTheFuture = Math.floor(Date.now() / 1000) + 5;

        if (cachedAccessToken && cachedAccessToken.exp > fiveSecondsIntoTheFuture && cachedIdToken && cachedIdToken.exp > fiveSecondsIntoTheFuture) {
            log.debug(`[requestAccessToken] Returning cached tokens for scope [${scope}]`);
            return {
                ...cachedAccessToken.token,
                ...cachedIdToken.token
            };
        }

        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.oidcConfig.clientId,
            client_secret: this.oidcConfig.clientSecret,
            scope: scope
        });

        const extraHeaders = {} as { dpop?: string };
        if(dpopHeader) {
            extraHeaders.dpop = dpopHeader;
        }

        log.debug(`[requestAccessToken] Requesting access token from ${this.oidcConfig.tokenEndpoint!}`);
        const response = await fetch(this.oidcConfig.tokenEndpoint!, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...extraHeaders
            },
            body: new URLSearchParams(body)
        });

        const json = await response.json();

        if (json.access_token) {
            const decodedAccessToken: any = decodeJwt(json.access_token);
            if (decodedAccessToken?.exp) {
                this.tokenCache.set(accessTokenCacheKey, {
                    token: { access_token: json.access_token },
                    exp: decodedAccessToken.exp
                });
            }
        }

        if (json.id_token) {
            const decodedIdToken: any = decodeJwt(json.id_token);
            if (decodedIdToken?.exp) {
                this.tokenCache.set(idTokenCacheKey, {
                    token: { id_token: json.id_token },
                    exp: decodedIdToken.exp
                });
            }
        }

        return json;
    }

    /**
     * Requests an access token with DPoP (Demonstration of Proof-of-Possession).
     * @param {JWK} jwk - The JSON Web Key.
     * @param {string} [scope] - Optional space separated list of scopes.
     * @returns {Promise<any>} A promise that resolves to the token response.
     */
    async requestAccessTokenWithDpop(jwk: JWK, scope = "" ): Promise<any> {
        if(!this.oidcConfig) throw Error("[TokenService.requestAccessTokenWithDpop] OIDC configuration is required to request access token (with DPoP) from We Are OIDC.");

        await this.oidcConfig.discover();

        return await this.requestAccessToken(await createDpop(this.oidcConfig.tokenEndpoint!.href, "POST", jwk), scope);
    }
}