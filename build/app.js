import { RadixEngineToolkit, } from "@radixdlt/radix-engine-toolkit";
import express from 'express';
import { NETWORK } from "./common.js";
const app = express();
const port = 5105;
app.use((req, res, next) => {
    if (!/^POST$/.test(req.method)) {
        if (!req.headers['content-type']) {
            req.headers['content-type'] = req.url.endsWith(".json") ? "application/json" : "text/plain";
        }
    }
    return next();
});
app.listen(port, async function () {
    console.log("Listening on port " + port + "!");
});
async function olympiaToBabylon(olympiaAddress) {
    return await RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(olympiaAddress, NETWORK);
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
            const line = lines[i];
            await RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(line, NETWORK).then((result) => {
                results[i] = result;
            }, () => {
                results[i] = "null";
            });
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
        console.log(req.body);
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
process.on('exit', function () {
    console.log('Process terminating.');
});
