/**
 * Configuration class for Athumi.
 */
export class AthumiConfig {
    url: URL;
    webPath: string;
    webEndpoint: URL;

    /**
     * Creates an instance of AthumiConfig.
     * @param {URL} url - The base URL for Athumi.
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