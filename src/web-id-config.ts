/**
 * Configuration class for the Web ID provisioning (Athumi) endpoints.
 */
export class WebIdConfig {
    url: URL;
    webPath: string;
    webEndpoint: URL;

    /**
     * Creates an instance of WebIdConfig.
     * @param {URL} url - The base URL for the Web ID provisioning service.
     * @param {string} webPath - The path for the web endpoint.
     */
    constructor(url: URL, webPath: string) {
        this.url = url;
        this.webPath = webPath;

        const webEndpoint = this.url;
        webEndpoint.pathname = this.webPath;
        this.webEndpoint = webEndpoint;
    }
}
