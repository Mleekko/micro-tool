import {RadixEngineToolkit, SerializationMode} from "@radixdlt/radix-engine-toolkit";
import express from 'express';
import {fromHexString, NETWORK} from "./common.js";
import * as fs from "fs";
import * as readline from "readline";

const app = express();
const port = 5105;

const ACCOUNTS_FILE: string = "./data/accounts-dict.csv";
const OLYMPIA_ACC_PREFIX: string = "rdx1qsp";
const BABYLON_ACC_PREFIX: string = "account_rdx16";
let ACCOUNTS_DICT  = new Map<string, string>();

app.use((req, res, next) => {
    if (!/^POST$/.test(req.method)) {
        if (!req.headers['content-type']) {
            req.headers['content-type'] = req.url.endsWith(".json") ? "application/json" : "text/plain";
        }
    }
    return next();
});

async function readAccountsDict() {
    const inputStream = fs.createReadStream(ACCOUNTS_FILE);
    let accounts = new Map<string, string>();
    readline.createInterface({
        input: inputStream,
        terminal: false,
    }).on("line", function (line) {
        let parts = line.split(",");
        accounts.set(BABYLON_ACC_PREFIX + parts[0], OLYMPIA_ACC_PREFIX + parts[1]);
    }).on("close", function() {
        ACCOUNTS_DICT = accounts;
    });
}

app.listen(port, async function () {
    console.log("Listening on port " + port + "!");

    await readAccountsDict();

    console.log("done!");
});

async function olympiaToBabylon(olympiaAddress: string) {
    return await
        RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(
            olympiaAddress,
            NETWORK
        );
}
async function isBabylonValid(babylonAddress: string): Promise<boolean> {
    try {
        let decoded = await RadixEngineToolkit.Address.decode(babylonAddress);
        return !!(decoded && decoded.hrp);
    } catch (e) {
        return false;
    }
}

app.get('/convert-to-babylon', async function (req, res) {
    const olympiaAddress: string = req.query["address"] as string || "";

    const account2 = await olympiaToBabylon(olympiaAddress);
    res.status(200).send(account2);
});

app.get('/convert-to-babylon.json', async function (req, res) {
    const olympiaAddress: string = req.query['address'] as string || "";
    const account2 = await olympiaToBabylon(olympiaAddress);
    res.status(200).json({
        "result": account2
    });
});

app.post('/convert-to-babylon-batch', express.text(), async function (req, res) {
    let body = req.body.toString().trim();
    let lines = body.split(new RegExp("\r?\n"));
    if (lines.length > 1000) {
        res.status(400).send("Max 1000 addresses at a time please");
    }

    try {
        let results = new Array<string>(lines.length);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            await RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(
                line,
                NETWORK
            ).then((result) => {
                results[i] = result;
            }, () => {
                results[i] = "null";
            });
        }

        res.status(200).send(results.join("\n"));
    } catch (e: any) {
        res.status(500).send(e.message);
    }
});

app.post('/convert-to-babylon-batch.json', express.text({type: "application/json"}), async function (req, res) {
    try {
        let body:Record<string, Array<string>> | null = null;
        try {
            body = JSON.parse(req.body);
        } catch (e) {}

        if (!body || !body.addresses) {
            return res.status(400).send({
                error: "Request body should be JSON with the 'addresses' array."
            });
        }
        let addresses: string[] = body.addresses;
        if (addresses.length > 1000) {
            return res.status(400).send({
                error: "Max 1000 addresses at a time please!"
            });
        }

        let results = new Array<string | null>(addresses.length);
        for (let i = 0; i < addresses.length; i++) {
            const line = addresses[i];
            await RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(
                line,
                NETWORK
            ).then((result) => {
                results[i] = result;
            }, () => {
                results[i] = null;
            });
        }

        return res.status(200).json({
            "results": results
        });
    } catch (e: any) {
        return res.status(500).send({
            error: e.message
        });
    }
});

app.get('/convert-to-olympia', async function (req, res) {
    if (ACCOUNTS_DICT.size == 0) {
       return res.status(500).send("Not initialized!");
    }

    const babylonAddress: string = req.query["address"] as string || "";

    let valid = await isBabylonValid(babylonAddress);
    if (!valid) {
        return res.status(400).send("Invalid Babylon address");
    }

    const olympiaAddress = ACCOUNTS_DICT.get(babylonAddress);
    if (!olympiaAddress) {
        return res.status(404).send("Address did not have any balance in Olympia");
    }
    return res.status(200).send(olympiaAddress);
});

app.get('/convert-to-olympia.json', async function (req, res) {
    if (ACCOUNTS_DICT.size == 0) {
        return res.status(500).send({
            error: "Not initialized!"
        });
    }

    const babylonAddress: string = req.query['address'] as string || "";

    let valid = await isBabylonValid(babylonAddress);
    if (!valid) {
        return res.status(400).send({
            error:  "Invalid Babylon address"
        });
    }

    const olympiaAddress = ACCOUNTS_DICT.get(babylonAddress);
    if (!olympiaAddress) {
        return res.status(404).send({
            error: "Address did not have any balance in Olympia"
        });
    }

    res.status(200).json({
        "result": olympiaAddress
    });
});

async function getProgrammaticJson(hex: string, network: string): Promise<string> {
    let bytes = fromHexString(hex);
    return RadixEngineToolkit.ScryptoSbor.decodeToString(bytes, Number(network), SerializationMode.Programmatic);
}

app.get('/convert-to-readable', async function (req, res) {
    const hex: string = req.query["hex"] as string || "";
    const network: string = req.query["networkId"] as string || "1";

    if (!hex) {
        return res.status(400).send("'hex' should not be empty!");
    }

    try {
        // check if it's just a hex of an address (reference)
        let reference = await getProgrammaticJson('5c90' + hex, network);
        let json = JSON.parse(reference);
        return res.status(200).send(json.value);
    } catch (e: any) {
        // Failure. Try to treat it as programmatic JSON
        try {
            let json = await getProgrammaticJson(hex, network);
            return res.status(200).send(json);
        } catch (ee: any) {
            // ignore
        }
        return res.status(400).send("Invalid address hex. Error: " + e.message);
    }
});


process.on('exit', function () {
    console.log('Process terminating.');
});
