import {NetworkId} from "@radixdlt/radix-engine-toolkit";

export const NETWORK = NetworkId.Mainnet;
export const NETWORK_STR = "mainnet";
export const XRD_ADDRESS = "resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd";
export const CORE_URL = "https://core.radix.live/core";

export const fromHexString = (hexString: string) => {
    const buffer = Buffer.from(hexString, 'hex');
    return Uint8Array.from(buffer);
};
export const toHexString = (byteArray: Uint8Array) => {
    return Buffer.from(byteArray).toString('hex');
};


export  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

