import { Provider, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { DuneClient } from "@duneanalytics/client-sdk";

interface Chain {
    gecko_id: string;
    tvl: number;
    tokenSymbol: string;
    cmcId: string;
    name: string;
    chainId: number;
}

const CMC_API_KEY = process.env.CMC_API_KEY;

async function fetchArweaveData() {
    try {
        const response = await fetch(
            "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?slug=arweave",
            {
                headers: {
                    "X-CMC_PRO_API_KEY": CMC_API_KEY,
                    Accept: "application/json",
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        const data = responseData.data;
        const arweaveKey = Object.keys(data)[0];
        const arweaveInfo = data[arweaveKey];
        return arweaveInfo.quote.USD;
    } catch (error) {
        console.error("Error fetching Arweave data:", error);
        return null;
    }
}

// Updated function using fetch
async function getChainsByTVLRange(
    minTvl: number,
    maxTvl: number
): Promise<Chain[]> {
    try {
        const response = await fetch("https://api.llama.fi/v2/chains");
        const chains: Chain[] = await response.json();

        return chains
            .filter((chain) => chain.tvl >= minTvl && chain.tvl <= maxTvl)
            .sort((a, b) => b.tvl - a.tvl); // Sort by TVL descending
    } catch (error) {
        console.error("Error fetching chains data:", error);
        return [];
    }
}

const aoDataProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        try {
            const dune = new DuneClient(process.env.DUNE_API_KEY);

            const QUERIES = {
                TOTAL_DEPOSITS: 4028918,
                TOTAL_DEPOSITORS: 4029003,
                DAILY_METRICS: 3834081,
            };

            const results = {
                totalDeposits: await fetchQueryResult(
                    dune,
                    QUERIES.TOTAL_DEPOSITS
                ),
                totalDepositors: await fetchQueryResult(
                    dune,
                    QUERIES.TOTAL_DEPOSITORS
                ),
            };
            console.log("Raw results:", results);

            const formattedData = {
                timestamp: new Date().toISOString(),
                totalDeposits: formatNumericValue(
                    results.totalDeposits[0]?.Total_Value
                ),
                totalDepositors: {
                    dai: formatNumericValue(results.totalDepositors[0]?.No_DAI),
                    stEth: formatNumericValue(
                        results.totalDepositors[0]?.No_stETH
                    ),
                    total: formatNumericValue(
                        results.totalDepositors[0]?.Total
                    ),
                },
            };
            const tvlInMillions = formattedData.totalDeposits * 1000000; // Convert to absolute value
            const similarChains = await getChainsByTVLRange(
                tvlInMillions - 200000000,
                tvlInMillions + 200000000
            );

            const competitorInfo = similarChains
                .map(
                    (chain) =>
                        `${chain.name}: $${(chain.tvl / 1000000).toFixed(2)}M`
                )
                .join("\n- ");

            const arweaveData = await fetchArweaveData();

            return `
AO Data Metrics:
- Total Deposits: ${formattedData.totalDeposits}M$
- DAI Depositors: ${formattedData.totalDepositors.dai}
- stETH Depositors: ${formattedData.totalDepositors.stEth}
- Total Depositors: ${formattedData.totalDepositors.total}

Arweave Market Data:
- Price (USD): $${arweaveData?.price?.toFixed(2) || "N/A"}
- Market Cap: $${(arweaveData?.market_cap / 1000000).toFixed(2)}M
- 24h Volume: $${(arweaveData?.volume_24h / 1000000).toFixed(2)}M
- FDV: $${(arweaveData?.fully_diluted_market_cap / 1000000).toFixed(2)}M
- Circulating Supply: ${Math.round(arweaveData?.circulating_supply || 0).toLocaleString()} AR

Competitors (Chains with similar TVL):
- ${competitorInfo}
`.trim();
        } catch (error) {
            console.error("Error fetching data:", error);
            return "AO metrics temporarily unavailable";
        }
    },
};

async function fetchQueryResult(client, queryId) {
    try {
        const queryResult = await client.getLatestResult({ queryId });
        return queryResult.result.rows;
    } catch (error) {
        console.error(`Error fetching query ${queryId}:`, error);
        return [];
    }
}

function formatNumericValue(value) {
    return value ? parseFloat(Number(value).toFixed(2)) : null;
}

function formatDailyMetrics(metrics) {
    if (!metrics) return null;

    return {
        date: metrics.Day_Date
            ? new Date(metrics.Day_Date).toISOString().split("T")[0]
            : null,
        dailyNet: formatNumericValue(metrics.Daily_Net),
        ethAccumulative: formatNumericValue(metrics.ETHAccum_),
        netEthDaily: formatNumericValue(metrics.NetETHDaily_),
        netEthValAccumulative: formatNumericValue(
            metrics.NetETHValAccumNetETHVal_
        ),
    };
}

export default aoDataProvider;
