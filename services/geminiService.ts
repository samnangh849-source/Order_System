
import { GoogleGenAI } from "@google/genai";
import { ParsedOrder } from "../types";

export const summarizeText = async (ai: GoogleGenAI, text: string): Promise<string> => {
    if (!text) return "No text provided to summarize.";
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Summarize the following note concisely for an order overview: "${text}"`,
        });
        return response.text;
    } catch (error) {
        console.error("Gemini summarization error:", error);
        return "Could not generate summary.";
    }
};

export const generateProductDescription = async (ai: GoogleGenAI, productName: string): Promise<string> => {
    if (!productName) return "";
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a short, appealing product description in Khmer for a product named "${productName}".`,
        });
        return response.text;
    } catch (error) {
        console.error("Gemini description generation error:", error);
        return "";
    }
};

export const analyzeReportData = async (ai: GoogleGenAI, reportData: any, filters: any): Promise<string> => {
    try {
        const filtersSummary = [
            `Date Range: ${filters.datePreset === 'all' ? 'All Time' : `${filters.startDate} to ${filters.endDate}`}`,
            `Team: ${filters.team || 'All'}`,
            `User: ${filters.user || 'All'}`,
            `Payment Status: ${filters.paymentStatus || 'All'}`
        ].join('; ');

        const prompt = `
            As a business data analyst, review the following sales data for an online business in Cambodia. Provide a concise summary of key insights and actionable recommendations, **written in clear Khmer language**.

            **Filters Applied for this Report:** ${filtersSummary}

            **Key Metrics Summary:**
            - Total Revenue: $${reportData.revenue.toFixed(2)}
            - Net Profit: $${reportData.profit.toFixed(2)}
            - Total Orders: ${reportData.totalOrders}
            - Average Order Value: $${reportData.aov.toFixed(2)}

            **Top Performers (by Revenue):**
            - Top 5 Teams/Pages: ${JSON.stringify(reportData.byPage.slice(0, 5).map((p: any) => ({ Page: p.label, Revenue: p.revenue.toFixed(2) })))}
            - Top 5 Products: ${JSON.stringify(reportData.byProduct.slice(0, 5).map((p: any) => ({ Product: p.label, Revenue: p.revenue.toFixed(2) })))}
            - Top 5 Users: ${JSON.stringify(reportData.byUser.slice(0, 5).map((u: any) => ({ User: u.label, Revenue: u.revenue.toFixed(2) })))}

            **Your analysis should be a bulleted list covering:**
            1.  An overall summary of business performance for the filtered period.
            2.  Identify the most significant contributors to revenue (products, pages, or users).
            3.  Point out any potential areas of concern or opportunities for growth based on the data.
            4.  Provide one strategic recommendation to improve sales or profitability.
        `;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        });
        
        return response.text;
    } catch (error) {
        console.error("Gemini report analysis error:", error);
        return "Could not generate analysis from Gemini.";
    }
};


export const generateSalesForecast = async (ai: GoogleGenAI, orders: ParsedOrder[]): Promise<string> => {
    if (orders.length < 5) {
        return "ត្រូវការទិន្នន័យប្រតិបត្តិការណ៍យ៉ាងតិច ៥ ដើម្បីបង្កើតការព្យាករណ៍។";
    }

    // Aggregate data by month
    const monthlyData = orders.reduce((acc, order) => {
        const month = new Date(order.Timestamp).toISOString().slice(0, 7); // YYYY-MM
        if (!acc[month]) {
            acc[month] = { revenue: 0, orders: 0 };
        }
        acc[month].revenue += order['Grand Total'];
        acc[month].orders += 1;
        return acc;
    }, {} as Record<string, { revenue: number, orders: number }>);

    const formattedData = Object.entries(monthlyData)
        .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
        .map(([month, data]) => `${month}: Revenue $${data.revenue.toFixed(2)} from ${data.orders} orders`)
        .join('\n');

    const prompt = `
        Based on the following historical monthly sales data, provide a sales forecast for the next month in Khmer.
        
        Historical Data:
        ${formattedData}

        Your analysis should include:
        1. A quantitative prediction for next month's total revenue and number of orders.
        2. A brief explanation of the trend (e.g., growing, declining, stable).
        3. One or two strategic recommendations based on this trend.

        Present the information clearly and concisely.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Gemini forecast generation error:", error);
        return "Could not generate sales forecast from Gemini.";
    }
};