import {OidcConfig} from "../oidc-config";

/**
 * Base service class for handling OIDC (OpenID Connect) configuration.
 */
export class Service {
    oidcConfig?: OidcConfig;

    constructor(oidcConfig?: OidcConfig) {
        this.oidcConfig = oidcConfig;
    }
}