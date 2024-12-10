import { Provider, IAgentRuntime, Memory, State } from "@ai16z/eliza";
import { DuneClient } from "@duneanalytics/client-sdk";
import { Client, cacheExchange, fetchExchange, gql } from "urql";

interface Chain {
    gecko_id: string;
    tvl: number;
    tokenSymbol: string;
    cmcId: string;
    name: string;
    chainId: number;
}
type NetworkStat = {
    active_processes: number;
    active_users: number;
    created_date: string;
    eval_count: number;
    modules_rolling: number;
    new_module_count: number;
    new_process_count: number;
    processes_rolling: number;
    transfer_count: number;
    tx_count: number;
    tx_count_rolling: number;
};

const goldsky = new Client({
    url: "https://arweave-search.goldsky.com/graphql",
    exchanges: [cacheExchange, fetchExchange],
});
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
async function getArweaveStats() {
    try {
        const response = await fetch(
            "https://api.viewblock.io/arweave/stats?fast=true&network=mainnet",
            {
                method: "GET",
                headers: {
                    Accept: "*/*",
                    Origin: "https://viewblock.io",
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        return data.info;
    } catch (error) {
        console.log(error);
        console.error("Error fetching Arweave stats:", error);
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

async function getNetworkStats(): Promise<[]> {
    const messageFields = gql`
        fragment MessageFields on TransactionConnection {
            edges {
                cursor
                node {
                    id
                    ingested_at
                    recipient
                    block {
                        timestamp
                        height
                    }
                    tags {
                        name
                        value
                    }
                    data {
                        size
                    }
                    owner {
                        address
                    }
                }
            }
        }
    `;
    try {
        const networkStatsQuery = gql`
            query {
                transactions(
                    sort: HEIGHT_DESC
                    first: 1
                    owners: ["yqRGaljOLb2IvKkYVa87Wdcc8m_4w6FI58Gej05gorA"]
                    recipients: ["vdpaKV_BQNISuDgtZpLDfDlMJinKHqM3d2NWd3bzeSk"]
                    tags: [{ name: "Action", values: ["Update-Stats"] }]
                ) {
                    ...MessageFields
                }
            }

            ${messageFields}
        `;
        const result = await goldsky.query(networkStatsQuery, {}).toPromise();
        if (!result.data) return [];

        const { edges } = result.data.transactions;
        const updateId = edges[0]?.node.id;

        const data = await fetch(`https://arweave.net/${updateId}`);
        console.log("updateid", updateId);
        const json = await data.json();

        // Transform the data to rename 'tx_count_rolling' to 'messages'
        const transformedData = json.map((item: any) => ({
            ...item,
            messages: item.tx_count_rolling,
            tx_count_rolling: undefined, // Optionally remove the original property
        }));

        return transformedData;
    } catch (error) {
        console.error(error);
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
                depositRatio: (await fetchQueryResult(dune, 4028682)).map(
                    (row) => ({
                        token: row.Token,
                        accumulatedValue: row.AccumVal, // Convert to millions
                    })
                ),
            };

            const formattedData = {
                timestamp: new Date().toISOString(),
                totalDeposits: formatNumericValue(
                    results.totalDeposits[0]?.Total_Value
                ),
                depositByToken: {
                    dai: formatNumericValue(
                        results.depositRatio.find((r) => r.token === "DAI")
                            ?.accumulatedValue || 0
                    ),
                    stEth: formatNumericValue(
                        results.depositRatio.find((r) => r.token === "stETH")
                            ?.accumulatedValue || 0
                    ),
                },
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
            const arweaveStats = await getArweaveStats();
            const competitorInfo = similarChains
                .map(
                    (chain) =>
                        `${chain.name}: $${(chain.tvl / 1000000).toFixed(2)}M`
                )
                .join("\n- ");

            const arweaveData = await fetchArweaveData();

            const arweaveNetworkStatWholeArray = await getNetworkStats();
            const arweaveNetworkStat =
                arweaveNetworkStatWholeArray[
                    arweaveNetworkStatWholeArray.length - 1
                ];
            console.log(arweaveNetworkStat);
            return `
AO Network Stats:
- Active Users: ${arweaveNetworkStat?.active_users.toLocaleString()}
- Active Processes: ${arweaveNetworkStat?.active_processes.toLocaleString()}
- Total Modules: ${arweaveNetworkStat?.modules_rolling.toLocaleString()}
- Total Messages: ${(arweaveNetworkStat?.messages / 1000000).toFixed(2)}M

AO Data Metrics:
- Total Deposits: ${formattedData.totalDeposits} M$
- DAI Deposits: ${formattedData.depositByToken.dai} M$
- stETH Deposits: ${formattedData.depositByToken.stEth} M$
- DAI Depositors: ${formattedData.totalDepositors.dai}
- stETH Depositors: ${formattedData.totalDepositors.stEth}
- Total Depositors: ${formattedData.totalDepositors.total}

Arweave Market Data:
- Price (USD): $${arweaveData?.price?.toFixed(2) || "N/A"}
- Market Cap: $${(arweaveData?.market_cap / 1000000).toFixed(2)}M
- 24h Volume: $${(arweaveData?.volume_24h / 1000000).toFixed(2)}M
- FDV: $${(arweaveData?.fully_diluted_market_cap / 1000000).toFixed(2)}M
- Circulating Supply: ${Math.round(arweaveData?.circulating_supply || 0).toLocaleString()} AR

Arweave Stats:
- Height: ${arweaveStats.height}
- TPS: ${arweaveStats.tps.toFixed(2)}
- Total Transactions: ${(arweaveStats.txs / 1000000).toFixed(2)}M
- Active Addresses: ${arweaveStats.addresses.toLocaleString()}
- Smart Contracts: ${arweaveStats.contracts.toLocaleString()}
- Network Size: ${arweaveStats.networkSize.toFixed(2)} GB
- Proof Rate: ${(arweaveStats.proofRate / 1000000).toFixed(2)}M
- Storage Cost: ${(arweaveStats.storageCost / 1000000000).toFixed(2)}B
- Active Nodes: ${arweaveStats.nodes}

AO TVL Comparison:
- AO TVL: $${formattedData.totalDeposits}M
- Competitors (Chains with similar TVL):
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