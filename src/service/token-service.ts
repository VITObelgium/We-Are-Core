import { JWK } from "jose";
import log from "loglevel";
import {createDpop} from "../factory/token-factory";
import {Service} from "./service";

/**
 * Service class for handling token requests.
 */
export class TokenService extends Service {

    /**
     * Requests an access token.
     * @param {string} [dpopHeader] - Optional DPoP header.
     * @returns {Promise<any>} A promise that resolves to the token response.
     */
    async requestAccessToken(dpopHeader?: string): Promise<any> {
        if(!this.oidcConfig) throw Error("[TokenService.requestAccessToken] OIDC configuration is required to request access token from We Are OIDC.");

        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.oidcConfig.clientId,
            client_secret: this.oidcConfig.clientSecret
        });

        const extraHeaders = {} as { dpop?: string };
        if(dpopHeader) {
            extraHeaders.dpop = dpopHeader;
        }

        log.debug(`[requestAccessToken] Requesting access token from ${this.oidcConfig.tokenEndpoint}`);
        const response = await fetch(this.oidcConfig.tokenEndpoint!, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...extraHeaders
            },
            body: new URLSearchParams(body)
        });

        return await response.json();
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