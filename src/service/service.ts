import {OidcConfig} from "../oidc-config";
import {TokenService} from "./token-service";

/**
 * Base service class for handling OIDC (OpenID Connect) configuration.
 */
export class Service {
    oidcConfig?: OidcConfig;
    tokenService?: TokenService;

    constructor(oidcConfig?: OidcConfig, tokenService?: TokenService) {
        this.oidcConfig = oidcConfig;
        this.tokenService = tokenService;
    }
}