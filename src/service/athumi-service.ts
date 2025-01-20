import {AthumiConfig} from "../athumi-config";

/**
 * Service class for interacting with Athumi endpoints to provision a webId and to delete a webId.
 */
export class AthumiService {
    athumiConfig: AthumiConfig;

    /**
     * Creates an instance of AthumiService.
     * This service interacts with the Athumi provided endpoints.
     * @param {AthumiConfig} athumiConfig - The Athumi configuration.
     */
    constructor(athumiConfig: AthumiConfig) {
        this.athumiConfig = athumiConfig;
    }

    /**
     * Provisions a Web ID by using the citizens ID token.
     * @param idToken - The ID token for authorization, provided by ACM/IDM.
     * @returns {Promise<Response>} A promise that resolves to the response of the fetch request.
     */
    async provisionWebId(idToken: string): Promise<Response> {
        return fetch(this.athumiConfig.webEndpoint.href, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            }
        });
    }

    /**
     * Deletes a WebID using the provided ID token.
     * @param {string} idToken - The ID token for authorization, provided by ACM/IDM.
     */
    async deleteWebId(idToken: string): Promise<Response> {
        return fetch(this.athumiConfig.webEndpoint.href, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            }
        });
    }
}