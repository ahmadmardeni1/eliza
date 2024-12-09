import {
    IPdfService,
    ServiceType,
    IAgentRuntime,
    stringToUuid,
} from "@ai16z/eliza";

const PDF_URLS = {
    ARWEAVE_WHITEPAPER:
        "https://5z7leszqicjtb6bjtij34ipnwjcwk3owtp7szjirboxmwudpd2tq.arweave.net/7n6ySzBAkzD4KZoTviHtskVlbdab_yylEQuuy1BvHqc",
    ARWEAVE_YELLOWPAPER: "https://www.arweave.org/yellow-paper.pdf",
};

async function processPdfFromUrl(
    runtime: IAgentRuntime,
    pdfUrl: string,
    p0: string
): Promise<string> {
    try {
        // Fetch the PDF from URL
        const response = await fetch(pdfUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }

        const pdfBuffer = await response.arrayBuffer();

        // Get PDF service from runtime
        const pdfService = runtime.getService<IPdfService>(ServiceType.PDF);

        // Convert PDF to text
        const text = await pdfService.convertPdfToText(Buffer.from(pdfBuffer));

        return text;
    } catch (error) {
        console.error(`Error processing PDF from URL: ${error.message}`);
        throw error;
    }
}

async function injectArweavePapers(runtime: IAgentRuntime) {
    try {
        console.log(runtime.documentsManager, "ad");
        // Process both papers
        const whitePaperContent = await processPdfFromUrl(
            runtime,
            PDF_URLS.ARWEAVE_WHITEPAPER,
            "Arweave Whitepaper"
        );
        const yellowPaperContent = await processPdfFromUrl(
            runtime,
            PDF_URLS.ARWEAVE_YELLOWPAPER,
            "Arweave Yellowpaper"
        );

        // Create a consistent room ID for documents
        const documentsRoomId = stringToUuid("documents-room");

        // Use documentsManager directly from runtime
        await runtime.documentsManager.createMemory({
            id: stringToUuid(`arweave-whitepaper`),
            userId: runtime.agentId,
            agentId: runtime.agentId,
            roomId: documentsRoomId,
            content: {
                text: whitePaperContent,
            },
        });

        await runtime.documentsManager.createMemory({
            id: stringToUuid(`arweave-yellowpaper`),
            userId: runtime.agentId,
            agentId: runtime.agentId,
            roomId: documentsRoomId,
            content: {
                text: yellowPaperContent,
            },
        });

        console.log("Successfully processed and stored both Arweave papers");
    } catch (error) {
        console.error("Failed to process Arweave papers:", error);
        throw error;
    }
}

export { injectArweavePapers };
