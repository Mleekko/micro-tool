import { RadixEngineToolkit, } from "@radixdlt/radix-engine-toolkit";
import express from 'express';
import { NETWORK } from "./common.js";
const app = express();
app.listen(5105, async function () {
    console.log("Listening on port 5005!");
});
app.get('/convert-to-babylon', async function (req, res) {
    const olympiaAddress = req.query['address'] || "";
    const account2 = await RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(olympiaAddress, NETWORK);
    res.status(200).send(account2);
});
app.get('/convert-to-babylon.json', async function (req, res) {
    const olympiaAddress = req.query['address'] || "";
    const account2 = await RadixEngineToolkit.Derive.virtualAccountAddressFromOlympiaAccountAddress(olympiaAddress, NETWORK);
    res.status(200).json({
        "result": account2
    });
});
process.on('exit', function () {
    console.log('Process terminating.');
});
