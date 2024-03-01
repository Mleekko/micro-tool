import { RadixEngineToolkit, SerializationMode } from "@radixdlt/radix-engine-toolkit";
import express from 'express';
import { fromHexString, NETWORK, toHexString } from "./common.js";
import * as fs from "fs";
import * as readline from "readline";
const app = express();
const port = 5105;
const ACCOUNTS_FILE = "./data/accounts-dict.csv";
const OLYMPIA_ACC_PREFIX = "rdx1qsp";
const BABYLON_ACC_PREFIX = "account_rdx16";
let ACCOUNTS_DICT = new Map();
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
    let accounts = new Map();
    readline.createInterface({
        input: inputStream,
        terminal: false,
    }).on("line", function (line) {
        let parts = line.split(",");
        accounts.set(BABYLON_ACC_PREFIX + parts[0], OLYMPIA_ACC_PREFIX + parts[1]);
    }).on("close", function () {
        ACCOUNTS_DICT = accounts;
    });
}
app.listen(port, async function () {
    console.log("Listening on port " + port + "!");
    await readAccountsDict();
    console.log("done!");
});
async function olympiaToBabylon(olympiaAddress) {
    return await RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(olympiaAddress, NETWORK);
}
async function isBabylonValid(babylonAddress) {
    try {
        let decoded = await RadixEngineToolkit.Address.decode(babylonAddress);
        return !!(decoded && decoded.hrp);
    }
    catch (e) {
        return false;
    }
}
app.get('/convert-to-babylon', async function (req, res) {
    const olympiaAddress = req.query["address"] || "";
    const account2 = await olympiaToBabylon(olympiaAddress);
    res.status(200).send(account2);
});
app.get('/convert-to-babylon.json', async function (req, res) {
    const olympiaAddress = req.query['address'] || "";
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
        let results = new Array(lines.length);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                await RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(line, NETWORK).then((result) => {
                    results[i] = result;
                }, () => {
                    results[i] = "null";
                });
            }
            else {
                results[i] = lines[i];
            }
        }
        res.status(200).send(results.join("\n"));
    }
    catch (e) {
        res.status(500).send(e.message);
    }
});
app.post('/convert-to-babylon-batch.json', express.text({ type: "application/json" }), async function (req, res) {
    try {
        let body = null;
        try {
            body = JSON.parse(req.body);
        }
        catch (e) { }
        if (!body || !body.addresses) {
            return res.status(400).send({
                error: "Request body should be JSON with the 'addresses' array."
            });
        }
        let addresses = body.addresses;
        if (addresses.length > 1000) {
            return res.status(400).send({
                error: "Max 1000 addresses at a time please!"
            });
        }
        let results = new Array(addresses.length);
        for (let i = 0; i < addresses.length; i++) {
            const line = addresses[i];
            await RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(line, NETWORK).then((result) => {
                results[i] = result;
            }, () => {
                results[i] = null;
            });
        }
        return res.status(200).json({
            "results": results
        });
    }
    catch (e) {
        return res.status(500).send({
            error: e.message
        });
    }
});
app.get('/convert-to-olympia', async function (req, res) {
    if (ACCOUNTS_DICT.size == 0) {
        return res.status(500).send("Not initialized!");
    }
    const babylonAddress = req.query["address"] || "";
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
    const babylonAddress = req.query['address'] || "";
    let valid = await isBabylonValid(babylonAddress);
    if (!valid) {
        return res.status(400).send({
            error: "Invalid Babylon address"
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
async function getProgrammaticJson(hex, network) {
    let bytes = fromHexString(hex);
    return RadixEngineToolkit.ScryptoSbor.decodeToString(bytes, Number(network), SerializationMode.Programmatic);
}
app.get('/convert-to-readable', async function (req, res) {
    const hex = req.query["hex"] || "";
    const network = req.query["networkId"] || "1";
    if (!hex) {
        return res.status(400).send("'hex' should not be empty!");
    }
    try {
        // check if it's just a hex of an address (reference)
        let reference = await getProgrammaticJson('5c90' + hex, network);
        let json = JSON.parse(reference);
        return res.status(200).send(json.value);
    }
    catch (e) {
        // Failure. Try to treat it as programmatic JSON
        try {
            let json = await getProgrammaticJson(hex, network);
            return res.status(200).send(json);
        }
        catch (ee) {
            // ignore
        }
        return res.status(400).send("Invalid address hex. Error: " + e.message);
    }
});
async function refToHex(ref) {
    const programmaticJson = {
        kind: "Reference",
        value: ref,
    };
    let bytes = await RadixEngineToolkit.ScryptoSbor.encodeProgrammaticJson(programmaticJson);
    return toHexString(bytes).substring(4); // remove the "ref" type prefix
}
app.get('/convert-to-hex', async function (req, res) {
    const ref = req.query["ref"] || "";
    if (!ref) {
        return res.status(400).send("'ref' should not be empty!");
    }
    // check if it's just a ref of an address (reference)
    let hex = await refToHex(ref);
    return res.status(200).send(hex);
});
process.on('exit', function () {
    console.log('Process terminating.');
});
