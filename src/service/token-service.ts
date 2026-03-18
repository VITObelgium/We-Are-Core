import { decodeJwt, JWK } from "jose";
import log from "loglevel";
import {createDpop} from "../factory/token-factory";
import {Service} from "./service";

/**
 * Service class for handling token requests.
 */
export class TokenService extends Service {

    private tokenCache = new Map<string, any>();

    /**
     * Requests an access token.
     * @param {string} [dpopHeader] - Optional DPoP header.
     * @param scopes
     * @returns {Promise<any>} A promise that resolves to the token response.
     */
    async requestAccessToken(dpopHeader?: string, scopes = ""): Promise<any> {
        if(!this.oidcConfig) throw Error("[TokenService.requestAccessToken] OIDC configuration is required to request access token from We Are OIDC.");

        const accessTokenCacheKey = `at:${scopes}`;
        const idTokenCacheKey = `id:${scopes}`;

        const cachedAccessToken = this.tokenCache.get(accessTokenCacheKey);
        const cachedIdToken = this.tokenCache.get(idTokenCacheKey);
        const now = Math.floor(Date.now() / 1000);

        if (cachedAccessToken && cachedAccessToken.exp > now && cachedIdToken && cachedIdToken.exp > now) {
            log.debug(`[requestAccessToken] Returning cached tokens for scopes [${scopes}]`);
            return {
                ...cachedAccessToken.token,
                ...cachedIdToken.token
            };
        }

        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.oidcConfig.clientId,
            client_secret: this.oidcConfig.clientSecret,
            scopes: scopes
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
     * @returns {Promise<any>} A promise that resolves to the token response.
     */
    async requestAccessTokenWithDpop(jwk: JWK ): Promise<any> {
        if(!this.oidcConfig) throw Error("[TokenService.requestAccessTokenWithDpop] OIDC configuration is required to request access token (with DPoP) from We Are OIDC.");

        return await this.requestAccessToken(await createDpop(this.oidcConfig.tokenEndpoint!.href, "POST", jwk));
    }
}