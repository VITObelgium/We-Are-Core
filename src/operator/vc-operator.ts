import {AccessGrant} from "@inrupt/solid-client-access-grants";
import log from "loglevel";

/**
 * Validates an access grant's validity.
 * @param {AccessGrant} accessGrant - The access grant to validate.
 * @param {string} [resourceUrl] - The URL of the resource to check against the access grant.
 * @param {'Read'|'Write'|'Append'} [mode] - The access mode to check against the access grant.
 * @param {Object} [options] - Additional validation options.
 * @param {string} [options.recipientWebId] - The WebID of the recipient to check against the access grant.
 * @throws Will throw an error if the access grant is not valid.
 */
export const validateAccessGrant = (accessGrant: AccessGrant, resourceUrl? : string, mode? : 'Read'|'Write'|'Append', options?:{ recipientWebId?: string }) => {
    log.debug(`[validateAccessGrant] Validating access grant [${accessGrant.id}].`);

    if (accessGrant.credentialSubject.providedConsent.hasStatus !== "ConsentStatusExplicitlyGiven") {
        const message= `Access grant [${accessGrant.id}] does not have status "ConsentStatusExplicitlyGiven".`;
        throw new Error(message);
    }

    if (accessGrant.expirationDate && new Date(accessGrant.expirationDate) < new Date()) {
        const message= `Access grant [${accessGrant.id}] is expired.`;
        throw new Error(message);
    }

    if (resourceUrl) {
        const containerExists = (forPersonalData: string[], resourceUrl: string) => {
            let found = false;
            forPersonalData.forEach((url) => {
                if (resourceUrl.startsWith(url)) {
                    found = true;
                }
            });
            return found;
        }
        if (!accessGrant.credentialSubject.providedConsent.forPersonalData.includes(resourceUrl) && !containerExists(accessGrant.credentialSubject.providedConsent.forPersonalData, resourceUrl)) {
            const message = `Resource [${resourceUrl}] nor its container is not part of the access grant [${accessGrant.id}].`;
            throw new Error(message);
        }
    }

    if (mode && !accessGrant.credentialSubject.providedConsent.mode.includes(mode)) {
        const message = `Access grant [${accessGrant.id}] does not have mode "${mode}".`;
        throw new Error(message);
    }

    if (options?.recipientWebId && accessGrant.credentialSubject.providedConsent.isProvidedTo !== options?.recipientWebId) {
        const message = `Access grant [${accessGrant.id}] is not provided to [${options?.recipientWebId}].`;
        throw new Error(message);
    }

    log.debug(`[validateAccessGrant] Access grant [${accessGrant.id}] is valid.`);
}