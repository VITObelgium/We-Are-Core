import {
    AccessGrant,
    AccessRequest,
    getAccessGrant as getAccessGrantInrupt,
    issueAccessRequest as issueAccessRequestInrupt,
} from "@inrupt/solid-client-access-grants";
import { getVerifiableCredentialAllFromShape } from "@inrupt/solid-client-vc";
import log from "loglevel";
import {createFetchWithAccessToken, createFetchWithCorrelationAndRequestId} from "../factory/fetch-factory";
import {Service} from "./service";
import {OidcConfig} from "../oidc-config";
import {VcConfig} from "../vc-config";

/**
 * Service class for handling Verifiable Credential (VC) operations.
 */
export class VcService extends Service {
    vcConfig: VcConfig;

    /**
     * Creates an instance of VcService.
     * @param {OidcConfig} oidcConfig - The OIDC configuration.
     * @param {VcConfig} vcConfig - The VC configuration.
     */
    constructor(oidcConfig: OidcConfig, vcConfig: VcConfig) {
        super(oidcConfig);
        this.vcConfig = vcConfig;
    }

    /**
     * Issues an access request.
     * @param {string[]} data - The data resources to request access for.
     * @param {string} webId - The WebID of the resource owner.
     * @param {string} purpose - The purpose of the access request.
     * @param {Date} expirationDate - The expiration date of the access request.
     * @param {Object} [access] - The access modes to request.
     * @param {boolean} [access.read] - Request read access.
     * @param {boolean} [access.write] - Request write access.
     * @param {boolean} [access.append] - Request append access.
     * @param {string} [correlationId] - Optional correlation ID for logging.
     * @returns {Promise<AccessRequest>} A promise that resolves to the issued access request.
     */
    async issueAccessRequest(
        data: string[],
        webId: string,
        purpose: string,
        expirationDate: Date,
        access?: { read?: boolean; write?: boolean; append?: boolean },
        correlationId?: string
    ): Promise<AccessRequest> {
        if(!this.oidcConfig) throw Error("[VcService.issueAccessRequest] OIDC configuration is required to issue access requests.");

        log.debug(`[issueAccessRequest] Issuing access request.`);

        const context = {} as { correlationId?: string};
        if (correlationId)
            context.correlationId = correlationId;

        return await issueAccessRequestInrupt(
            {
                resources: data,
                resourceOwner: webId,
                purpose: [purpose],
                expirationDate: expirationDate,
                access: access || { read: true, write: true, append: true }
            },
            {
                accessEndpoint: this.vcConfig.issueEndpoint!.href,
                fetch: createFetchWithCorrelationAndRequestId.bind({
                    ...context,
                    fetchFn: createFetchWithAccessToken.bind(this.oidcConfig)
                })
            }
        );
    }

    /**
     * Fetches an access grant by ID.
     * @param {string} id - The ID of the access grant.
     * @param {string} [correlationId] - Optional correlation ID for logging.
     * @returns {Promise<AccessGrant>} A promise that resolves to the fetched access grant.
     */
    async fetchAccessGrant(id: string, correlationId?: string): Promise<AccessGrant> {
        if(!this.oidcConfig) throw Error("[VcService.issueAccessRequest] OIDC configuration is required to fetch access grant by ID.");

        const context = {} as { correlationId? : string };
        if(correlationId)
            context.correlationId = correlationId;

        return getAccessGrantInrupt(
            id,
        {
            fetch: createFetchWithCorrelationAndRequestId.bind({
                ...context, fetchFn: createFetchWithAccessToken.bind(this.oidcConfig)
            })
        });
    }

    /**
     * Fetches access grants based on specified options.
     * @param {string} [correlationId] - Optional correlation ID for logging.
     * @param {Object} [options] - Options for filtering access grants.
     * @param {string} [options.ownerWebId] - The WebID of the resource owner.
     * @param {string} [options.issuer] - The issuer of the access grants.
     * @param {string} [options.purpose] - The purpose of the access grants.
     * @param {string[]} [options.dataIris] - The data IRIs to filter by.
     * @param {Object} [options.access] - The access modes to filter by.
     * @param {boolean} [options.access.read] - Filter by read access.
     * @param {boolean} [options.access.write] - Filter by write access.
     * @param {boolean} [options.access.append] - Filter by append access.
     * @returns {Promise<AccessGrant[]>} A promise that resolves to an array of access grants.
     */
    async fetchAccessGrants(correlationId?: string, options?: { ownerWebId?: string, issuer?: string, purpose?: string, dataIris?: string[], access? : { read?: boolean, write?: boolean, append?: boolean }}): Promise<AccessGrant[]> {
        if(!this.oidcConfig) throw Error("[VcService.fetchAccessGrants] OIDC configuration is required to fetch access grants.");

        // <editor-fold description="Create VC shape for querying ESS service.">
        const vcShape = {
            type: ["SolidAccessGrant"],
            credentialSubject: {
                providedConsent: {
                    hasStatus: "ConsentStatusExplicitlyGiven",
                }
            },
        } as any; /* Validation fails for Partial<VerifiableCredential>, use any instead */

        if (options?.issuer) {
            log.debug(`[fetchAccessGrants] Fetching access grants for issuer [${options!.issuer}].`);
            vcShape.issuer = options!.issuer;
        }

        if (options?.ownerWebId) {
            log.debug(`[fetchAccessGrants] Fetching access grants for owner [${options!.ownerWebId}].`);
            vcShape.credentialSubject.id = options!.ownerWebId;
        }

        if (options?.purpose) {
            log.debug(`[fetchAccessGrants] Fetching access grants for sharing purpose [${options!.purpose}].`);
            vcShape.credentialSubject.providedConsent.forPurpose = options!.purpose;
        }

        if (options?.dataIris) {
            log.debug(`[fetchAccessGrants] Fetching access grants for data iris [${options!.dataIris}].`);
            vcShape.credentialSubject.providedConsent.forPersonalData = options!.dataIris![0];
        }

        if (options?.access) {
            const mode = Object.entries(options!.access!).map((entry) => entry[0].charAt(0).toUpperCase() + entry[0].slice(1));
            log.debug(`[fetchAccessGrants] Fetching access grants for mode [${JSON.stringify(mode)}].`);
            vcShape.credentialSubject.providedConsent.mode = mode;
        }
        // </editor-fold>

        log.debug(`[fetchAccessGrants] Fetching access grants with shape [${JSON.stringify(vcShape)}].`);

        const context = {} as { correlationId? : string };
        if(correlationId)
            context.correlationId = correlationId;

        return (await getVerifiableCredentialAllFromShape(this.vcConfig.deriveEndpoint!.href, vcShape, {
            fetch: createFetchWithCorrelationAndRequestId.bind({...context, fetchFn: createFetchWithAccessToken.bind(this.oidcConfig)}),
        })) as AccessGrant[];
    }

}
