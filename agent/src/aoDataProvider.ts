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
        arweaveInfo.quote.USD.circulating_supply =
            arweaveInfo.circulating_supply;
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

// Add cache interface and helper
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const cache: Record<string, CacheEntry<any>> = {};

function getCachedData<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const cached = cache[key];
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION) {
        return Promise.resolve(cached.data);
    }

    return fetchFn().then((data) => {
        cache[key] = { data, timestamp: now };
        return data;
    });
}

export interface NetworkData {
    ao: {
        activeUsers: number;
        activeProcesses: number;
        totalModules: number;
        totalMessages: string;
        deposits: {
            total: number;
            dai: number;
            stEth: number;
        };
        depositors: {
            dai: number;
            stEth: number;
            total: number;
        };
        tvlInMillions: string;
    };
    arweave: {
        price: string;
        marketCap: string;
        volume24h: string;
        fullyDilutedValue: string;
        circulatingSupply: string;
        height: number;
        tps: number;
        totalTransactions: string;
        activeAddresses: number;
        smartContracts: number;
        networkSize: string;
        proofRate: string;
        storageCost: string;
        activeNodes: number;
    };
    competitors: Array<{
        name: string;
        tvl: string;
    }>;
}

const aoDataProvider: Provider = {
    get: async (_runtime: IAgentRuntime, _message: Memory, _state?: State) => {
        try {
            const networkData = await getNetworkData();
            const returnMessage =
                `AO Network Stats(Note: Values should not be rounded):
        - Active Users: ${networkData.ao.activeUsers.toLocaleString()}

        - Active Processes: ${networkData.ao.activeProcesses.toLocaleString()}
        - Total Modules: ${networkData.ao.totalModules.toLocaleString()}
        - Total Messages: ${networkData.ao.totalMessages}

        AO Data Metrics:
        - Total Deposits:$${networkData.ao.deposits.total}M
        - DAI Deposits: $${networkData.ao.deposits.dai}M
        - stETH Deposits: $${networkData.ao.deposits.stEth}M
        - DAI Depositors: ${networkData.ao.depositors.dai}
        - stETH Depositors:  ${networkData.ao.depositors.stEth}
        - Total Depositors:  ${networkData.ao.depositors.total}

        Arweave Market Data:
        - Price (USD): $${networkData.arweave?.price || "N/A"}
        - Market Cap: $${networkData?.arweave?.marketCap}
        - 24h Volume: $${networkData.arweave?.volume24h}
        - FDV: $${networkData.arweave?.fullyDilutedValue}
        - Circulating Supply: ${networkData.arweave?.circulatingSupply} AR

        Arweave Stats:
        - Height: ${networkData.arweave?.height}
        - TPS: ${networkData.arweave.tps}
        - Total Transactions: ${networkData.arweave.totalTransactions}
        - Active Addresses: ${networkData.arweave.activeAddresses.toLocaleString()}
        - Smart Contracts: ${networkData.arweave.smartContracts.toLocaleString()}
        - Network Size: ${networkData.arweave?.networkSize}
        - Proof Rate: ${networkData.arweave?.proofRate}
        - Storage Cost: ${networkData.arweave?.storageCost}
        - Active Nodes: ${networkData.arweave?.activeNodes}

        AO TVL Comparison:
        - AO TVL: $${networkData.ao.tvlInMillions}M
        - Competitors (Chains with similar TVL):
        - ${networkData.competitors
            .map((chain) => `${chain.name}: $${chain.tvl}`)
            .join("\n-")}`.trim();
            return returnMessage;
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
async function getAoStats() {
    const dune = new DuneClient(process.env.DUNE_API_KEY);

    const QUERIES = {
        TOTAL_DEPOSITS: 4028918,
        TOTAL_DEPOSITORS: 4029003,
        DAILY_METRICS: 3834081,
    };

    const results = {
        totalDeposits: await fetchQueryResult(dune, QUERIES.TOTAL_DEPOSITS),
        totalDepositors: await fetchQueryResult(dune, QUERIES.TOTAL_DEPOSITORS),
        depositRatio: (await fetchQueryResult(dune, 4028682)).map((row) => ({
            token: row.Token,
            accumulatedValue: row.AccumVal, // Convert to millions
        })),
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
            stEth: formatNumericValue(results.totalDepositors[0]?.No_stETH),
            total: formatNumericValue(results.totalDepositors[0]?.Total),
        },
    };
    return formattedData;
}
type arweaveNetworkStat = {
    active_users: number;
    active_processes: number;
    modules_rolling: number;
    messages: number;
};
export async function getNetworkData(): Promise<NetworkData> {
    const getFormatedAOData = await getCachedData("aoStats", getAoStats);
    const tvlInMillions = getFormatedAOData.totalDeposits * 1000000;
    // Replace direct calls with cached versions

    const [
        arweaveStats,
        similarChains,
        arweaveData,
        arweaveNetworkStatWholeArray,
    ] = await Promise.all([
        getCachedData("arweaveStats", getArweaveStats),
        getCachedData("chainsTVL", () =>
            getChainsByTVLRange(
                tvlInMillions - 200000000,
                tvlInMillions + 200000000
            )
        ),
        getCachedData("arweaveData", fetchArweaveData),
        getCachedData("networkStats", getNetworkStats),
    ]);

    const arweaveNetworkStat: arweaveNetworkStat =
        arweaveNetworkStatWholeArray[arweaveNetworkStatWholeArray.length - 1];

    const formatter = Intl.NumberFormat("en", { notation: "compact" });

    const networkData: NetworkData = {
        ao: {
            activeUsers: arweaveNetworkStat?.active_users,
            activeProcesses: arweaveNetworkStat?.active_processes,
            totalModules: arweaveNetworkStat?.modules_rolling,
            totalMessages: formatter.format(arweaveNetworkStat?.messages),
            deposits: {
                total: getFormatedAOData.totalDeposits,
                dai: getFormatedAOData.depositByToken.dai,
                stEth: getFormatedAOData.depositByToken.stEth,
            },
            depositors: {
                dai: getFormatedAOData.totalDepositors.dai,
                stEth: getFormatedAOData.totalDepositors.stEth,
                total: getFormatedAOData.totalDepositors.total,
            },
            tvlInMillions: formatter.format(tvlInMillions),
        },
        arweave: {
            price: arweaveData?.price.toFixed(2),
            marketCap: formatter.format(arweaveData?.market_cap.toFixed(2)),
            volume24h: formatter.format(arweaveData?.volume_24h),
            fullyDilutedValue: formatter.format(
                arweaveData?.fully_diluted_market_cap
            ),
            circulatingSupply: formatter.format(
                arweaveData?.circulating_supply
            ),
            height: arweaveStats.height,
            tps: arweaveStats.tps.toFixed(2),
            totalTransactions: formatter.format(arweaveStats.txs),
            activeAddresses: arweaveStats.addresses,
            smartContracts: arweaveStats.contracts,
            networkSize: arweaveStats.networkSize + "PiB",
            proofRate: arweaveStats.proofRate + " P/s",
            storageCost:
                (arweaveStats.storageCost / 1000000000000).toFixed(2) +
                "AR/GIB",
            activeNodes: arweaveStats.nodes,
        },
        competitors: similarChains.map((chain) => ({
            name: chain.name,
            tvl: formatter.format(chain.tvl),
        })),
    };
    console.log(networkData);
    return networkData;
}

export default aoDataProvider;
