import {OidcConfig} from "../oidc-config";
// @ts-ignore
import {Session} from "@inrupt/solid-client-authn-node/dist/Session";

/**
 * Service class for handling OIDC (OpenID Connect) operations.
 */
export class OidcService {
    oidcConfig: OidcConfig;

    /**
     * Constructs an OIDC service.
     * This service provides means for authenticating a citizen using the provided configuration.
     * The OIDC configuration should reflect the ACM/IDM configuration used.
     * @param {OidcConfig} oidcConfig - The configuration for OIDC.
     */
    constructor(oidcConfig: OidcConfig) {
        this.oidcConfig = oidcConfig;
    }

    /**
     * Logs in a session using the provided OIDC configuration.
     * @param {Session} session - The session to log in.
     * @param {Function} [handleRedirect] - Optional function to handle redirects.
     * @returns {Promise<void>} A promise that resolves when the login is complete.
     */
    async login(session: Session, handleRedirect?: Function): Promise<void> {
        const loginConfig = {
            oidcIssuer: this.oidcConfig.loginEndpoint!.href,
            clientId: this.oidcConfig.clientId,
            clientName: this.oidcConfig.clientName,
            clientSecret: this.oidcConfig.clientSecret,
            redirectUrl: this.oidcConfig.redirectEndpoint!.href,
        } as any;

        if(handleRedirect) loginConfig.handleRedirect = handleRedirect;

        return session.login(loginConfig);
    }

    /**
     * Retrieves tokens from the OIDC using the provided authorization code and other parameters.
     * Utilizes the authorization code flow.
     * @param {string} code - The authorization code.
     * @param {string} codeVerifier - The code verifier.
     * @param {string} state - The state parameter.
     * @param {string} [grantType='authorization_code'] - The grant type (default is 'authorization_code').
     * @returns {Promise<any>} A promise that resolves to the token response.
     */
    async getToken(code: string, codeVerifier: string, state: string, grantType: string = 'authorization_code'): Promise<any> {
        const params = new URLSearchParams();
        params.append('client_id', this.oidcConfig.clientId);
        params.append('client_secret', this.oidcConfig.clientSecret);
        params.append('code', code);
        params.append('code_verifier', codeVerifier);
        params.append('state', state);
        params.append('grant_type', grantType);
        params.append('redirect_uri', this.oidcConfig.redirectEndpoint!.href);

        const response = await fetch(this.oidcConfig.tokenEndpoint!.href, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: params.toString()
        });

        return await response.json();
    }
}