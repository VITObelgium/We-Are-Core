import log from "loglevel";
import {SolidDataset, WithResourceInfo, WithServerResourceInfo} from "@inrupt/solid-client";
import {
    AccessGrant, deleteSolidDataset,
    getFile,
    getSolidDataset,
    overwriteFile,
    saveSolidDatasetAt
} from "@inrupt/solid-client-access-grants";
import { createFetchWithCorrelationAndRequestId, createFetchWithIdToken } from "../factory/fetch-factory";
import { validateAccessGrant } from "../operator/vc-operator";
import { Service } from "./service";

/**
 * Service class for interacting with Solid Pods.
 */
export class PodService extends Service {

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
                fetch: createFetchWithCorrelationAndRequestId.bind({ ...context, fetchFn: createFetchWithIdToken.bind(this.oidcConfig)})
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
            fetch: createFetchWithCorrelationAndRequestId.bind({ ...context, fetchFn: createFetchWithIdToken.bind(this.oidcConfig)})
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
            fetch: createFetchWithCorrelationAndRequestId.bind({ ...context, fetchFn: createFetchWithIdToken.bind(this.oidcConfig)})
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
                    fetchFn: createFetchWithIdToken.bind(this.oidcConfig)
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
                    fetchFn: createFetchWithIdToken.bind(this.oidcConfig)
                })
            }
        );
    }
}
