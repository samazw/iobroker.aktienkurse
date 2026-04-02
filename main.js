"use strict";

const utils = require("@iobroker/adapter-core");
const axios = require("axios");

class Aktienkurse extends utils.Adapter {
    constructor(options) {
        super({ ...options, name: "aktienkurse" });
        this.on("ready", this.onReady.bind(this));
        this.on("unload", this.onUnload.bind(this));
        this.updateInterval = null;
    }

    async onReady() {
        this.log.info("Adapter startet und bereitet Aktienliste vor...");
        await this.updateData();
        
        const intervall = parseInt(this.config.intervall) || 10;
        this.updateInterval = setInterval(() => this.updateData(), intervall * 60000);
    }

    async updateData() {
        const rawList = this.config.aktienListeText || "";
        const aktien = rawList.split(",").map(s => s.trim()).filter(s => s.length > 0);

        if (aktien.length === 0) {
            this.log.info("Keine Aktien-Symbole konfiguriert.");
            return;
        }

        for (const symbol of aktien) {
            const cleanSymbol = symbol.replace(".", "_");
            const dpName = `Aktien.kurs_${cleanSymbol}`;

            await this.setObjectNotExistsAsync(dpName, {
                type: "state",
                common: {
                    name: `Kurs ${symbol}`,
                    type: "number",
                    role: "value.price",
                    unit: "EUR",
                    read: true,
                    write: false
                },
                native: {},
            });

            this.fetchPrice(symbol, dpName);
        }
    }

    async fetchPrice(symbol, dpName) {
        try {
            const url = `https://yahoo.com{symbol}`;
            const response = await axios.get(url);
            
            if (response.data && response.data.chart && response.data.chart.result) {
                const price = response.data.chart.result[0].meta.regularMarketPrice;
                this.setState(dpName, { val: price, ack: true });
                this.log.debug(`Update für ${symbol}: ${price} EUR`);
            }
        } catch (e) {
            this.log.error(`Fehler beim Abrufen von ${symbol}: ${e.message}`);
        }
    }

    onUnload(callback) {
        try {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            callback();
        } catch (e) {
            callback();
        }
    }
}

if (require.main === module) {
    new Aktienkurse();
} else {
    module.exports = Aktienkurse;
}
