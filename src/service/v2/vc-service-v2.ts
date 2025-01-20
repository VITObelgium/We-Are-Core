import {
    CredentialResult, query
} from "@inrupt/solid-client-access-grants";
import log from "loglevel";
import {createFetchWithAccessToken, createFetchWithCorrelationAndRequestId} from "../../factory/fetch-factory";
import {Service} from "../service";
import {OidcConfig} from "../../oidc-config";
import {VcConfig} from "../../vc-config";
// @ts-ignore
import {AccessGrantFilter} from "@inrupt/solid-client-access-grants/dist/gConsent/query/query";

/**
 * Service class for handling Verifiable Credential (VC) operations.
 */
export class VcServiceV2 extends Service {
    vcConfig: VcConfig;

    /**
     * Creates an instance of VcService v2.
     * This service implements the newly provided ESS 2.3 /query endpoint for retrieving access grants.
     * You can also choose to use the current user session to fetch the access grants, instead of using the back-end token fetched from the We Are OIDC.
     * @param {OidcConfig} oidcConfig - The OIDC configuration.
     * @param {VcConfig} vcConfig - The VC configuration.
     */
    constructor(vcConfig: VcConfig, oidcConfig?: OidcConfig) {
        super(oidcConfig);
        this.vcConfig = vcConfig;
    }

    /**
     * Fetches access grants based on specified options.
     * @param {string} [correlationId] - Optional correlation ID for logging.
     * @param {AccessGrantFilter} filters - The filters to apply to the access grants.
     * @param {(requestInfo: RequestInfo | URL, requestInit?: RequestInit) => Promise<Response>} fetch - The fetch function to use for the request.
     * @returns {Promise<CredentialResult[]>} A promise that resolves to an CredentialResult.
     */
    async fetchAccessGrants(correlationId?: string, filters?: AccessGrantFilter, fetch?: (requestInfo: RequestInfo | URL, requestInit?: RequestInit) => Promise<Response>): Promise<CredentialResult> {
        if(!this.oidcConfig && !fetch) {
            throw new Error("Either an OIDC configuration or a fetch function must be provided.");
        }

        log.debug(`[fetchAccessGrants] Fetching access grants with filters [${JSON.stringify(filters)}].`);

        const defaults: AccessGrantFilter = {
            type: "SolidAccessGrant",
        }
        filters = {...defaults, ...filters};
        filters.type = "SolidAccessGrant";

        const context = {} as { correlationId?: string };
        if (correlationId)
            context.correlationId = correlationId;

        return await query(filters,
            {
                fetch: createFetchWithCorrelationAndRequestId.bind({...context, fetchFn: fetch}) || createFetchWithCorrelationAndRequestId.bind({...context, fetchFn: createFetchWithAccessToken.bind(this.oidcConfig!)}),
                queryEndpoint: this.vcConfig.queryEndpoint!
            })
    }
}
