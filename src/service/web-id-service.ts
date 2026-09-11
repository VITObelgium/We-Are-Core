import {WebIdConfig} from "../web-id-config";

/**
 * Service class for interacting with the Web ID provisioning (Athumi) endpoints to provision a webId and to delete a webId.
 */
export class WebIdService {
    webIdConfig: WebIdConfig;

    /**
     * Creates an instance of WebIdService.
     * This service interacts with the Web ID provisioning endpoints.
     * @param {WebIdConfig} webIdConfig - The Web ID provisioning configuration.
     */
    constructor(webIdConfig: WebIdConfig) {
        this.webIdConfig = webIdConfig;
    }

    /**
     * Provisions a Web ID by using the citizens ID token.
     * @param idToken - The ID token for authorization, provided by ACM/IDM.
     * @returns {Promise<Response>} A promise that resolves to the response of the fetch request.
     */
    async provisionWebId(idToken: string): Promise<Response> {
        return fetch(this.webIdConfig.webEndpoint.href, {
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
        return fetch(this.webIdConfig.webEndpoint.href, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            }
        });
    }
}