import {NetworkId} from "@radixdlt/radix-engine-toolkit";

export const NETWORK = NetworkId.Mainnet;
export const NETWORK_STR = "mainnet";
export const XRD_ADDRESS = "resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd";
export const CORE_URL = "https://core.radix.live/core";



export  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

