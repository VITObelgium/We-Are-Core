import {
    fromRdfJsDataset,
    SolidDataset,
    toRdfJsDataset,
    WithResourceInfo,
} from "@inrupt/solid-client";
import {Parser, Quad, Store, Writer} from "n3";
import log from "loglevel";
import type {
    DataFactory,
    DatasetCore,
    DatasetCoreFactory,
} from "@rdfjs/types";

/**
 * Serializes a SolidDataset into Turtle format.
 * Converts a SolidDataset (along with its resource information) into a Turtle string.
 *
 * @param {SolidDataset & WithResourceInfo} solidDataset - The dataset to serialize, containing RDF triples and resource info.
 * @param {Object} [prefixes] - Optional prefixes to include in the Turtle output, mapping prefixes to URIs.
 * @returns {Promise<string>} - A Promise that resolves to the serialized Turtle string.
 */
export async function solidDatasetAsTurtle(
    solidDataset: SolidDataset & WithResourceInfo,
    prefixes?: {[key: string] : string},
): Promise<string> {
    const n3Dataset = toRdfJsDataset(solidDataset);
    return datasetAsTurtle(n3Dataset, solidDataset.internal_resourceInfo.sourceIri + "#", {...prefixes, this: solidDataset.internal_resourceInfo.sourceIri + "#", thisParent: solidDataset.internal_resourceInfo.sourceIri.split("/").slice(0, -1).join("/") + "/"});
}

export async function datasetAsTurtle(
    dataset: DatasetCore,
    baseUrl?: string,
    prefixes?: {[key: string] : string},
): Promise<string> {
    const writer = new Writer({
        baseIRI: baseUrl,
        format: "text/turtle",
        prefixes: prefixes
    });
    writer.addQuads([...dataset]);

    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) {
                const message = `Failed to serialize N3 as Turtle. Error: ${error}`;
                log.error(message);
                return reject(new Error(message));
            }
            return resolve(result);
        });
    });
}

/**
 * Parses a Turtle string and converts it into a SolidDataset.
 * The function takes a Turtle-formatted string and converts it into a dataset object for Solid.
 *
 * @param {string} turtle - The Turtle string to parse.
 * @returns {SolidDataset} - The parsed SolidDataset.
 */
export function turtleAsSolidDataset(turtle: string): SolidDataset {
    return fromRdfJsDataset(turtleAsDataset(turtle));
}

export function turtleAsDataset(turtle: string): DatasetCore {
    const dataset = new Store();
    const parser = new Parser();
    dataset.addQuads(parser.parse(turtle));
    return dataset;
}

export function turtleAsStore(turtle: string): Store {
    const dataset = turtleAsDataset(turtle);
    return datasetAsStore(dataset);
}

export function datasetAsStore(dataset: DatasetCore): Store {
    const store = new Store();
    store.addQuads([...dataset]);
    return store;
}