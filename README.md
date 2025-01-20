# Introduction - We Are Project and We Are Platform

The We Are partnership, consisting of the Flemish Institute for Technological Research (VITO) – Flemish Patients' Platform (VPP) – Domus Medica (DM) – Zorgnet Icuro (ZI), is committed to enabling the ethical and safe reuse of personal health data for both public and private purposes, with the citizen at the center. The project collaborates closely with Athumi, the provider of the [SOLID](https://solidproject.org/TR/) data vault system in Flanders. This system allows citizens to securely store their data in vaults and share it with third parties based on consent. This project was made possible thanks to the European recovery fund; the Department of Economy, Science & Innovation; the Department of Care & the Department of Digital Flanders. More information at [www.we-are-health.be](https://www.we-are-health.be).

# We Are Core

The We Are Core is a TypeScript library that contains helper methods that can be used when developing We Are apps. Together with the We Are Demo Frontend, We Are Demo Backend and We Are Expressjs, this module will demonstrate how to successfully build an application interacting with Solid pods and the Athumi Solid infrastructure.

The We Are Core consists of 4 parts:
* factory: all logic grouped in factories that is responsible to creates fetch methods, create jwk object and create a dpop header.
* helper: a helper function to deal with linked data.
* operator: operations on jkw and verifiable credentials
* service: contains services to interact with Athumi Solid pods on the level of authentication, authorization and CRUD.

## Factory
We combined some common logic concerning creating instances of objects under the factory directory.

### fetch-factory
Interacting with the Athumi and Solid requires authenticated requests. In some cases authenticated requests with access tokens are necessary, in other cases with an id-token. In order to easy the use of this, we created 2 factory methods which will provide you with a fetch function with the right token in the authorization header. This is done by calling

```
await tokenService.requestAccessToken();
```
The right token is then chosen from the return values and added to the headers of the fetch method.

### jwk-factory

This factory  creates a key pair, exports the private key as a JWK, and assigns the 'ES256' algorithm. This is necessary for creating the [dpop](https://datatracker.ietf.org/doc/html/rfc9449) header when communicating with the Solid pod.

### token-factory

This function extracts the jwk information and uses it to create a dpop header.

## Helper

Under the helper directory we organize all logic that could be summarized as boilerplate.

### solid-dataset-helper

Interacting with linked data is sometimes a bit tedious. Therefore we provided some base functionality to let you manage your RDF linked data. This will enable you to convert strings to solid datasets and reverse.

Serialize of a solid dataset to a turtle string:

```
export async function solidDatasetAsTurtle(
    solidDataset: SolidDataset & WithResourceInfo,
    prefixes?: {[key: string] : string},
): Promise<string> {
    const n3Dataset = toRdfJsDataset(solidDataset);
    return datasetAsTurtle(n3Dataset, solidDataset.internal_resourceInfo.sourceIri + "#", {...prefixes, this: solidDataset.internal_resourceInfo.sourceIri + "#", thisParent: solidDataset.internal_resourceInfo.sourceIri.split("/").slice(0, -1).join("/") + "/"});
}

```

Deserialize a turtle string to a solid dataset:

```
export function turtleAsSolidDataset(turtle: string): SolidDataset {
    return fromRdfJsDataset(turtleAsDataset(turtle));
}

```

## Operator

Under operators you can find specific helper functionality on objects like jwk and vc's. 

### jwk-operator

Because we are dealing with dpop and public/private key pairs, this logic will help you extract the different parts of the jwk object.

### vc-operator

The ```vc-operator``` has a helper function which enable you to validate access grants. It checks on validity over time, if the access grant has not yet been revoked and then also if it concerns the correct resource.

## Service

Under ```service```, service classes are defined that help you interact with the pod.

### athumi-service
In order to be able to interact with a pod, a pod and webId need to exist. That is the responsibility of the ```AthumiService```.
It offers you the functionality to provision and delete a webId via the Athumi endpoints.

### oidc-service

The ```OIDCService``` enables you to call the login endpoint and get the correct token from the OIDC flow.

### pod-service

The ```PodService``` offers 4 functions to get and put data to the pod. Two for dealing with linked data and 2 for binary or other data.

### token-service

The ```TokenService``` let's you create an access token, with the option of dpop as string. And allows you to request an access token with dpop by means of passing the JWK object and let it calculate itself the dpop.


### vc-service

The ```VCService``` is for issuing an Access Request, fetching a specific Access Grant and fetching all Access Grants.